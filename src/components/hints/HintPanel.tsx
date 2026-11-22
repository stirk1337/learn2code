import React, { useEffect, useRef, useState } from 'react';
import * as Blockly from 'blockly';
import { v4 as uuid } from 'uuid';
import { ArrowRight, Check, Lightbulb, Loader2, RotateCcw, Sparkles, Waypoints, Wand2 } from 'lucide-react';
import { api, ApiError, HintAnalysisReceipt, HintDeliveryResponse } from '@/services/api';
import { getWorkspaceXml } from '@/blockly/setup';
import { applyPlanToWorkspace, describePlan, planBlockIds } from '@/blockly/hintRepair';

interface HintPanelProps {
    taskId: string;
    workspaceRef: React.MutableRefObject<Blockly.WorkspaceSvg | null>;
    semanticRevision: number;
    getWorkspaceRevision: () => number;
}

type Step = 1 | 2 | 3;

const STEP_TITLES: Record<Step, string> = { 1: 'Намёк', 2: 'Пример', 3: 'Исправление' };

const ERRORS: Record<string, string> = {
    teaching_configuration_required: 'Для этого задания подсказки ещё не настроены учителем.',
    assistance_restricted: 'В этом задании подсказки отключены.',
    access_denied: 'Нет доступа к подсказкам для этого задания.',
    analysis_rate_limit: 'Слишком много запросов. Подожди минуту и попробуй снова.',
    repair_rate_limit: 'Слишком много запросов. Подожди минуту и попробуй снова.',
    analysis_queue_full: 'Сервер сейчас занят. Попробуй ещё раз.',
    analysis_stale: 'Код изменился — обнови подсказку.',
    repair_unavailable: 'Для этой ошибки автоматическое исправление недоступно.',
    invalid_request: 'Не получилось разобрать программу. Оставь один скрипт, который начинается с «когда ⚑ нажат».',
};

const errorText = (e: unknown) => {
    const err = e as ApiError;
    if (err?.status === 404 && !ERRORS[err.message]) return 'Подсказки сейчас недоступны.';
    return ERRORS[err?.message] ?? (e instanceof Error ? e.message : 'Не удалось получить подсказку. Попробуй ещё раз.');
};

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const sha256 = async (text: string) => {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
};

// ponytail: фиксированный интервал опроса, backoff — если сервер начнёт отвечать 429 на GET
const poll = async <T,>(load: () => Promise<T>, done: (t: T) => boolean, alive: () => boolean): Promise<T> => {
    const deadline = Date.now() + 60_000;
    for (;;) {
        const result = await load();
        if (done(result) || !alive()) return result;
        if (Date.now() > deadline) throw new Error('Сервер долго не отвечает. Попробуй ещё раз.');
        await sleep(700);
    }
};

const HintPanel: React.FC<HintPanelProps> = ({ taskId, workspaceRef, semanticRevision, getWorkspaceRevision }) => {
    const [analysis, setAnalysis] = useState<HintAnalysisReceipt | null>(null);
    const [hints, setHints] = useState<Partial<Record<Step, HintDeliveryResponse>>>({});
    const [repairRequestId, setRepairRequestId] = useState<string | null>(null);
    const [step, setStep] = useState<Step>(1);
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [applied, setApplied] = useState(false);
    const runRef = useRef(0);

    const stale = analysis !== null && analysis.semanticRevision !== semanticRevision && !applied;
    const opened = Object.keys(hints).length > 0;

    const ws = () => workspaceRef.current;

    // Ближайший не-shadow блок: подсвечивается и подписывается команда, а не число внутри неё.
    const visibleBlock = (id: string) => {
        let block = ws()?.getBlockById(id) ?? null;
        while (block?.isShadow()) block = block.getParent();
        return block;
    };
    const label = (id: string) => visibleBlock(id)?.toString(40) ?? 'блок';

    // Подсветка актуальна только для кода, который анализировался.
    useEffect(() => {
        const workspace = ws();
        if (!workspace) return;
        workspace.highlightBlock(null);
        if (!analysis || stale || applied) return;
        const current = hints[step];
        const ids =
            step === 1 && current?.advice?.focus?.blockId
                ? [current.advice.focus.blockId]
                : step === 3 && current?.repair
                  ? planBlockIds(current.repair)
                  : [];
        ids.forEach(id => {
            const block = visibleBlock(id);
            if (block) workspace.highlightBlock(block.id, true);
        });
        if (ids[0] && visibleBlock(ids[0])) workspace.centerOnBlock(visibleBlock(ids[0])!.id);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [analysis, hints, step, stale, applied]);

    useEffect(() => () => {
        runRef.current++;
        workspaceRef.current?.highlightBlock(null);
    }, [workspaceRef]);

    const run = async (message: string, action: (alive: () => boolean) => Promise<void>) => {
        const id = ++runRef.current;
        const alive = () => runRef.current === id;
        setBusy(message);
        setError(null);
        try {
            await action(alive);
        } catch (e) {
            if (alive()) setError(errorText(e));
        } finally {
            if (alive()) setBusy(null);
        }
    };

    const clear = () => {
        setAnalysis(null);
        setHints({});
        setRepairRequestId(null);
        setStep(1);
        setApplied(false);
    };

    const reset = () => {
        runRef.current++;
        clear();
        setBusy(null);
        setError(null);
    };

    const startAnalysis = () =>
        run('Ищу, где ошибка…', async alive => {
            const workspace = ws();
            if (!workspace) return;
            clear();
            const receipt = await api.submitHintAnalysis({
                requestId: uuid(),
                taskId,
                blocklyXml: getWorkspaceXml(workspace),
                semanticRevision,
                workspaceRevision: getWorkspaceRevision(),
            });
            const status = await poll(
                () => api.getHintAnalysis(receipt.analysisId),
                s => s.status !== 'queued' && s.status !== 'running',
                alive
            );
            if (!alive()) return;
            if (status.status !== 'completed' || status.resultStatus === 'technical_failure') {
                throw new Error('Не получилось проверить программу. Попробуй ещё раз.');
            }
            if (status.resultStatus === 'unsupported_profile') {
                throw new Error('В программе есть блоки, с которыми подсказки пока не работают.');
            }
            const hint = await api.requestHint({
                requestId: uuid(),
                analysisId: receipt.analysisId,
                level: 1,
                codeHash: receipt.codeHash,
                workspaceHash: receipt.workspaceHash,
                semanticRevision: receipt.semanticRevision,
            });
            if (!alive()) return;
            setAnalysis(receipt);
            setHints({ 1: hint });
        });

    const showExample = (another = false) =>
        run('Подбираю пример…', async alive => {
            if (!analysis) return;
            const hint = await api.requestHint({
                requestId: uuid(),
                analysisId: analysis.analysisId,
                level: 2,
                codeHash: analysis.codeHash,
                workspaceHash: analysis.workspaceHash,
                semanticRevision: analysis.semanticRevision,
                anotherExample: another,
            });
            if (!alive()) return;
            // «Другой пример» без новых вариантов оставляет прежний пример на месте.
            setHints(h => (another && hint.status !== 'delivered' ? h : { ...h, 2: hint }));
            setStep(2);
        });

    const showRepair = () =>
        run('Готовлю исправление…', async alive => {
            const workspace = ws();
            if (!analysis || !workspace) return;
            const { jobId } = await api.submitHintRepair({
                requestId: uuid(),
                analysisId: analysis.analysisId,
                codeHash: analysis.codeHash,
                semanticRevision: analysis.semanticRevision,
            });
            const status = await poll(
                () => api.getHintRepair(jobId),
                s => s.status !== 'queued' && s.status !== 'running',
                alive
            );
            if (!alive()) return;
            let hint: HintDeliveryResponse = {
                status: 'unavailable',
                analysisId: analysis.analysisId,
                semanticRevision: analysis.semanticRevision,
                level: 3,
                advice: null,
                example: null,
                variantIndex: null,
                repair: null,
            };
            const requestId = uuid();
            if (status.planReady) {
                const xml = getWorkspaceXml(workspace);
                hint = await api.requestHint({
                    requestId,
                    analysisId: analysis.analysisId,
                    level: 3,
                    codeHash: analysis.codeHash,
                    workspaceHash: await sha256(xml),
                    semanticRevision: analysis.semanticRevision,
                    repairJobId: jobId,
                    workspaceXml: xml,
                });
            }
            if (!alive()) return;
            setRepairRequestId(requestId);
            setHints(h => ({ ...h, 3: hint }));
            setStep(3);
        });

    const applyRepair = () =>
        run('Применяю…', async alive => {
            const workspace = ws();
            const plan = hints[3]?.repair;
            if (!analysis || !workspace || !plan || !repairRequestId) return;
            const xml = getWorkspaceXml(workspace);
            const accepted = await api.applyHintRepair(plan.patchId, {
                requestId: uuid(),
                deliveryRequestId: repairRequestId,
                analysisId: analysis.analysisId,
                baseRevision: analysis.semanticRevision,
                codeHash: analysis.codeHash,
                workspaceHash: await sha256(xml),
                workspaceXml: xml,
            });
            if (!alive()) return;
            workspace.highlightBlock(null);
            applyPlanToWorkspace(workspace, accepted.repair);
            setApplied(true);
        });

    // ---------- Разметка ----------

    const primaryButton = (text: string, onClick: () => void, Icon = ArrowRight) => (
        <button
            onClick={onClick}
            disabled={!!busy || stale}
            className="w-full flex items-center justify-center gap-2 bg-[#734DE6] text-white rounded-[10px] py-2 text-sm font-medium hover:bg-[#5a3eb8] transition-colors disabled:opacity-50"
        >
            {text}
            <Icon className="w-4 h-4" />
        </button>
    );

    const secondaryButton = (text: string, onClick: () => void) => (
        <button
            onClick={onClick}
            className="w-full flex items-center justify-center gap-2 py-1 text-sm text-[#1A1D2D] hover:text-[#734DE6]"
        >
            <RotateCcw className="w-4 h-4" />
            {text}
        </button>
    );

    const renderStep = () => {
        const hint = hints[step];
        if (!hint) return null;

        if (step === 1) {
            if (hint.status === 'no_issue_detected') {
                return (
                    <p className="text-sm text-[#6B7280] leading-relaxed">
                        Ошибок не нашлось — похоже, программа выполняет цель задания. Запусти её и отправь решение.
                    </p>
                );
            }
            if (hint.status !== 'delivered' || !hint.advice) {
                return <p className="text-sm text-[#6B7280]">Для этой программы подсказка пока недоступна.</p>;
            }
            const { advice } = hint;
            return (
                <>
                    <p className="text-sm text-[#6B7280] leading-relaxed">{advice.title}</p>
                    <p className="text-sm text-[#1A1D2D] leading-relaxed">{advice.question}</p>
                    {advice.focus?.blockId && !stale && (
                        <p className="text-xs text-[#6B7280]">Обрати внимание на подсвеченный блок.</p>
                    )}
                    {primaryButton('Показать пример', () => showExample())}
                </>
            );
        }

        if (step === 2) {
            const example = hint.status === 'delivered' ? hint.example : null;
            return (
                <>
                    {example ? (
                        <>
                            <p className="text-sm text-[#6B7280] leading-relaxed">{example.publicGoal}</p>
                            <pre className="text-xs bg-white border border-[#F2E3BF] rounded-[10px] p-3 overflow-x-auto text-[#1A1D2D]">
                                {example.code}
                            </pre>
                            <p className="text-sm text-[#1A1D2D] leading-relaxed">{example.explanation}</p>
                            <button
                                onClick={() => showExample(true)}
                                disabled={!!busy || stale}
                                className="self-start text-xs text-[#734DE6] hover:underline disabled:opacity-50"
                            >
                                Другой пример
                            </button>
                        </>
                    ) : (
                        <p className="text-sm text-[#6B7280] leading-relaxed">
                            Для этой ошибки готового примера пока нет. Можно посмотреть, как исправить твою программу.
                        </p>
                    )}
                    {primaryButton('Показать исправление', showRepair)}
                </>
            );
        }

        const plan = hint.status === 'delivered' ? hint.repair : null;
        if (!plan) {
            return (
                <p className="text-sm text-[#6B7280] leading-relaxed">
                    Для этой ошибки автоматическое исправление недоступно. Вернись к намёку и попробуй исправить сам.
                </p>
            );
        }
        if (applied) {
            return (
                <p className="text-sm text-[#1A1D2D] leading-relaxed">
                    Исправление применено. Запусти программу и проверь результат. Отменить можно через Ctrl+Z.
                </p>
            );
        }
        return (
            <>
                <ol className="flex flex-col gap-2 text-sm text-[#1A1D2D] leading-relaxed">
                    {describePlan(plan, label).map((text, i) => (
                        <li key={i}>
                            <span className="font-semibold text-[#734DE6]">{i + 1}.</span> {text}
                        </li>
                    ))}
                </ol>
                <p className="text-sm text-[#1A1D2D] leading-relaxed">Нажми кнопку — блоки поправятся сами. Потом нажми «Запуск».</p>
                {primaryButton('Применить исправление', applyRepair, Wand2)}
            </>
        );
    };

    const maxStep = (Math.max(...Object.keys(hints).map(Number), 1) as Step);
    const finished = maxStep === 3;

    return (
        <div className="m-3 p-4 bg-[#FFF8E6] rounded-[14px] border border-[#F2E3BF] flex flex-col gap-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-[#6B4E16]" />
                    <span className="text-sm font-semibold text-[#6B4E16]">Подсказки</span>
                </div>
                {opened && <span className="text-xs text-[#6B4E16]">{step} из 3</span>}
            </div>

            {!opened ? (
                <>
                    <p className="text-xs text-[#6B7280] leading-relaxed">Застрял? Нажми кнопку — я помогу шаг за шагом.</p>
                    <button
                        onClick={startAnalysis}
                        disabled={!!busy}
                        className="w-full flex items-center justify-center gap-2 bg-white border border-[#E0E4EB] rounded-full py-2 text-sm font-medium text-[#1A1D2D] hover:bg-gray-50 disabled:opacity-60"
                    >
                        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        {busy ?? 'Где ошибка?'}
                    </button>
                </>
            ) : (
                <>
                    <div className="flex items-center gap-2">
                        {([1, 2, 3] as Step[]).map(n => {
                            const done = n <= maxStep && n !== step;
                            return (
                                <button
                                    key={n}
                                    onClick={() => hints[n] && setStep(n)}
                                    disabled={!hints[n]}
                                    aria-label={`Шаг ${n}: ${STEP_TITLES[n]}`}
                                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm border ${
                                        n === step
                                            ? 'bg-[#734DE6] border-[#734DE6] text-white'
                                            : 'bg-white/60 border-[#E0E4EB] text-[#1A1D2D]'
                                    }`}
                                >
                                    {done ? <Check className="w-4 h-4" /> : n}
                                </button>
                            );
                        })}
                    </div>

                    <h3 className="text-sm font-semibold text-[#1A1D2D]">{STEP_TITLES[step]}</h3>

                    {stale && (
                        <div className="text-xs text-amber-800 bg-amber-100 rounded-[8px] px-3 py-2 flex flex-col gap-2">
                            Код изменён — проверь, актуальна ли подсказка.
                            <button onClick={startAnalysis} disabled={!!busy} className="self-start font-medium text-[#734DE6] hover:underline">
                                Обновить помощь
                            </button>
                        </div>
                    )}

                    {renderStep()}

                    {busy && (
                        <div className="flex items-center gap-2 text-xs text-[#6B7280]">
                            <Loader2 className="w-3 h-3 animate-spin" /> {busy}
                        </div>
                    )}

                    {secondaryButton(finished ? 'Вернуться к заданию' : 'Скрыть подсказки', reset)}

                    <div className="pt-3 border-t border-[#F2E3BF] flex items-center gap-2 text-xs text-[#6B7280]">
                        <Waypoints className="w-3.5 h-3.5" />
                        {finished ? 'Все подсказки открыты' : 'От намёка к решению'}
                    </div>
                </>
            )}

            {error && <p className="text-xs text-red-600 leading-relaxed">{error}</p>}
        </div>
    );
};

export default HintPanel;
