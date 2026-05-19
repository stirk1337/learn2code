import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import * as Blockly from 'blockly';
import { pythonGenerator } from 'blockly/python';
import {
    Loader2,
    ChevronLeft,
    Save,
    Send,
    Flag,
    AlertCircle,
    CheckCircle,
    Lightbulb,
    RotateCcw,
} from 'lucide-react';
import { api, SubmissionDto, TaskDto } from '@/services/api';
import { useToastStore } from '@/store/useToastStore';
import { useProjectStore } from '@/store/useProjectStore';
import { useEditorStore } from '@/store/useEditorStore';
import { runtime } from '@/engine/Runtime';
import { toolboxConfig } from '@/blockly/toolbox';
import { ScratchTheme } from '@/blockly/theme';
import { loadWorkspaceFromXml, getWorkspaceXml } from '@/blockly/setup';
import '@/blockly/generators/python';
import StageCanvas from '@/components/stage/StageCanvas';
import { buildProjectFromSceneState } from '@/utils/spriteDefaults';
import { STAGE_WIDTH, STAGE_HEIGHT } from '@/utils/constants';

const StudentTaskPage: React.FC = () => {
    const { taskId } = useParams<{ taskId: string }>();
    const navigate = useNavigate();
    const { addToast } = useToastStore();

    const [task, setTask] = useState<TaskDto | null>(null);
    const [draft, setDraft] = useState<SubmissionDto | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const { currentProject, setProject, updateBlocks } = useProjectStore();
    const { setRunning, isRunning } = useEditorStore();

    const blocklyRef = useRef<HTMLDivElement>(null);
    const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null);
    const hasInitializedRef = useRef(false);

    // Refs для актуальных значений в change-listener'е
    const updateBlocksRef = useRef(updateBlocks);
    const taskIdRef = useRef<string | undefined>(taskId);
    const primaryTargetIdRef = useRef<string | null>(null);
    useEffect(() => {
        updateBlocksRef.current = updateBlocks;
    }, [updateBlocks]);
    useEffect(() => {
        taskIdRef.current = taskId;
    }, [taskId]);
    useEffect(() => {
        // Привязываем XML к первому спрайту проекта (или к stage, если спрайтов нет)
        if (!currentProject) {
            primaryTargetIdRef.current = null;
            return;
        }
        primaryTargetIdRef.current = currentProject.sprites[0]?.id || currentProject.stage.id;
    }, [currentProject]);

    // Загрузка задания + черновика. Если черновика нет — создаём через POST.
    useEffect(() => {
        if (!taskId) return;
        let cancelled = false;

        const load = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const taskDto = await api.getTask(taskId);
                if (cancelled) return;
                setTask(taskDto);

                // Гидрируем сцену из initialState задания (read-only для ученика)
                const project = buildProjectFromSceneState(
                    taskDto.title || 'Задание',
                    'student',
                    'Student',
                    taskDto.initialState
                );
                setProject(project);

                // Черновик: пробуем получить, если 404 — создаём
                let draftDto: SubmissionDto | null = null;
                try {
                    draftDto = await api.getDraftSubmission(taskId);
                } catch (e: unknown) {
                    const status = (e as { status?: number })?.status;
                    if (status === 404) {
                        draftDto = await api.createDraftSubmission(taskId);
                    } else {
                        throw e;
                    }
                }
                if (cancelled) return;
                setDraft(draftDto);
            } catch (e) {
                if (cancelled) return;
                console.error('[StudentTaskPage] load error:', e);
                setError('Не удалось загрузить задание');
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };

        load();
        return () => {
            cancelled = true;
        };
    }, [taskId, setProject]);

    // Инициализация Blockly — только после загрузки задания. Не зависим от draft,
    // чтобы handleSaveDraft не пересоздавал воркспейс.
    useEffect(() => {
        if (isLoading) return;
        if (!blocklyRef.current || hasInitializedRef.current) return;

        workspaceRef.current = Blockly.inject(blocklyRef.current, {
            toolbox: toolboxConfig,
            theme: ScratchTheme,
            renderer: 'zelos',
            grid: { spacing: 40, length: 2, colour: '#DDD', snap: false },
            zoom: {
                controls: true,
                wheel: true,
                startScale: 0.675,
                maxScale: 4,
                minScale: 0.25,
                scaleSpeed: 1.1,
            },
            trashcan: true,
            move: { scrollbars: true, drag: true, wheel: true },
            sounds: true,
            media: 'https://unpkg.com/blockly/media/',
        });
        hasInitializedRef.current = true;

        // Восстанавливаем XML из localStorage (бэкенд в SubmissionDto его не возвращает)
        const savedXml = taskIdRef.current
            ? localStorage.getItem(`student_solution_${taskIdRef.current}`)
            : null;
        if (savedXml) {
            try {
                loadWorkspaceFromXml(workspaceRef.current, savedXml);
            } catch (e) {
                console.error('Failed to load saved blockly xml:', e);
            }
        }

        // Слушатель изменений: кэшируем XML в localStorage и обновляем блоки
        // у первого спрайта проекта, чтобы runtime их видел при запуске.
        const persistBlocks = () => {
            const ws = workspaceRef.current;
            if (!ws) return;
            const xml = getWorkspaceXml(ws);
            const id = taskIdRef.current;
            if (id) {
                localStorage.setItem(`student_solution_${id}`, xml || '');
            }
            const targetId = primaryTargetIdRef.current;
            if (targetId) {
                updateBlocksRef.current(targetId, xml || '');
            }
        };

        workspaceRef.current.addChangeListener((event) => {
            if (!event || event.isUiEvent) return;
            persistBlocks();
        });

        return () => {
            workspaceRef.current?.dispose();
            workspaceRef.current = null;
            hasInitializedRef.current = false;
        };
    }, [isLoading]);

    // Восстановить начальные позиции из task.initialState. Сохранённые блоки в проекте
    // сохраняются (Blockly XML живёт в первом спрайте), поэтому записываем его обратно.
    const handleResetScene = () => {
        if (!task) return;
        runtime.stop();
        setRunning(false);

        const fresh = buildProjectFromSceneState(
            task.title || 'Задание',
            'student',
            'Student',
            task.initialState
        );

        // Переносим текущий XML блоков в первый новый спрайт, чтобы решение не потерялось
        const ws = workspaceRef.current;
        const xml = ws ? getWorkspaceXml(ws) : '';
        const targetId = fresh.sprites[0]?.id || fresh.stage.id;
        if (xml && targetId) {
            const updateTarget = (id: string) => {
                if (id === fresh.stage.id) {
                    fresh.stage = { ...fresh.stage, blocks: xml };
                    return;
                }
                fresh.sprites = fresh.sprites.map(s =>
                    s.id === id ? { ...s, blocks: xml } : s
                );
            };
            updateTarget(targetId);
        }
        setProject(fresh);
        primaryTargetIdRef.current = targetId;
    };

    const handleRun = async () => {
        const project = useProjectStore.getState().currentProject;
        if (!project) return;
        runtime.loadProject(project);
        setRunning(true);
        try {
            await runtime.start();
        } catch (e) {
            console.error('Runtime error:', e);
        }

        // Синхронизируем финальные позиции спрайтов из runtime в проект,
        // чтобы канвас сразу отобразил результат после остановки.
        const finalState = runtime.getState();
        const { updateSprite, updateStage } = useProjectStore.getState();
        finalState.sprites.forEach(rs => {
            updateSprite(rs.id, {
                x: rs.x,
                y: rs.y,
                direction: rs.direction,
                size: rs.size,
                visible: rs.visible,
                currentCostume: rs.currentCostume,
            });
        });
        updateStage({ currentBackdrop: finalState.stage.currentBackdrop });

        setRunning(false);
    };

    const handleSaveDraft = async () => {
        if (!taskId || !workspaceRef.current) return;
        setIsSaving(true);
        try {
            const blocklyXml = getWorkspaceXml(workspaceRef.current);
            const code = pythonGenerator.workspaceToCode(workspaceRef.current);
            const updated = await api.updateDraftSubmission(taskId, { blocklyXml, code });
            setDraft(updated);
            addToast('Черновик сохранён', 'success');
        } catch (e) {
            console.error('Save draft error:', e);
            addToast('Не удалось сохранить черновик', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSubmit = async () => {
        if (!taskId || !workspaceRef.current) return;
        if (!confirm('Отправить решение на проверку?')) return;
        setIsSubmitting(true);
        try {
            // Сначала сохраним последнее состояние, чтобы submit ушёл с актуальным кодом
            const blocklyXml = getWorkspaceXml(workspaceRef.current);
            const code = pythonGenerator.workspaceToCode(workspaceRef.current);
            await api.updateDraftSubmission(taskId, { blocklyXml, code });

            const submitted = await api.submitDraft(taskId);
            setDraft(submitted);
            if (submitted.result?.isPassed) {
                addToast('✅ Решение принято', 'success');
            } else {
                addToast(submitted.result?.hint || 'Решение отправлено на проверку', 'info');
            }
        } catch (e) {
            console.error('Submit error:', e);
            addToast('Не удалось отправить решение', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="h-screen flex flex-col bg-[#F8FAFB]">
                <header className="bg-white border-b border-[#EEF0F4] px-4 py-3">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 text-[#6B7280] hover:text-[#1A1D2D]"
                    >
                        <ChevronLeft className="w-5 h-5" />
                        <span className="text-sm">Назад</span>
                    </button>
                </header>
                <div className="flex-1 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-3">
                        <Loader2 className="w-8 h-8 text-[#734DE6] animate-spin" />
                        <span className="text-[#6B7280]">Загрузка задания...</span>
                    </div>
                </div>
            </div>
        );
    }

    if (error || !task) {
        return (
            <div className="h-screen flex flex-col bg-[#F8FAFB]">
                <header className="bg-white border-b border-[#EEF0F4] px-4 py-3">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 text-[#6B7280] hover:text-[#1A1D2D]"
                    >
                        <ChevronLeft className="w-5 h-5" />
                        <span className="text-sm">Назад</span>
                    </button>
                </header>
                <div className="flex-1 flex items-center justify-center">
                    <div className="bg-amber-50 border border-amber-200 rounded-[16px] p-8 max-w-md text-center">
                        <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
                        <p className="text-amber-700 text-sm">{error || 'Задание не найдено'}</p>
                    </div>
                </div>
            </div>
        );
    }

    const isPassed = draft?.result?.isPassed === true;

    return (
        <div className="h-screen flex flex-col overflow-hidden bg-[#F8FAFB]">
            {/* Header */}
            <header className="bg-white border-b border-[#EEF0F4] flex items-center justify-between px-4 py-2">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-1 text-[#6B7280] hover:text-[#1A1D2D]"
                    >
                        <ChevronLeft className="w-5 h-5" />
                        <span className="text-sm">Назад</span>
                    </button>
                    <div className="h-6 w-px bg-[#EEF0F4]" />
                    <div>
                        <div className="text-sm text-[#734DE6] font-medium">Задание</div>
                        <div className="text-sm text-[#1A1D2D] font-semibold">
                            {task.title || 'Без названия'}
                        </div>
                    </div>
                    {isPassed && (
                        <span className="ml-2 inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                            <CheckCircle className="w-3 h-3" /> Принято
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleSaveDraft}
                        disabled={isSaving}
                        className="flex items-center gap-2 px-3 py-2 rounded-[10px] text-sm font-medium border border-[#E0E4EB] text-[#1A1D2D] hover:bg-gray-50 disabled:opacity-50"
                    >
                        {isSaving ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Save className="w-4 h-4" />
                        )}
                        Сохранить
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="flex items-center gap-2 bg-[#734DE6] text-white px-4 py-2 rounded-[10px] text-sm font-medium hover:bg-[#5a3eb8] transition-colors disabled:opacity-50"
                    >
                        {isSubmitting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Send className="w-4 h-4" />
                        )}
                        Отправить решение
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left Panel — Описание */}
                <div className="w-72 bg-white border-r border-[#EEF0F4] flex flex-col shrink-0 overflow-y-auto">
                    <div className="p-4 border-b border-[#EEF0F4]">
                        <h2 className="font-semibold text-[#1A1D2D] mb-2">{task.title || 'Без названия'}</h2>
                        <p className="text-sm text-[#6B7280] leading-relaxed whitespace-pre-line">
                            {task.description || 'Без описания'}
                        </p>
                    </div>
                    {draft?.result?.hint && (
                        <div className="p-4 m-3 bg-amber-50 rounded-[12px] border border-amber-100">
                            <div className="flex items-center gap-2 mb-2">
                                <Lightbulb className="w-4 h-4 text-amber-500" />
                                <span className="text-sm font-medium text-amber-700">Подсказка</span>
                            </div>
                            <p className="text-sm text-amber-700">{draft.result.hint}</p>
                        </div>
                    )}
                </div>

                {/* Center — Blockly Editor */}
                <div className="flex-1 flex flex-col min-w-0 bg-[#F8FAFB]">
                    <div className="flex-1 overflow-hidden relative">
                        <div ref={blocklyRef} className="w-full h-full" />
                    </div>
                </div>

                {/* Right Panel — Stage (read-only) */}
                <div className="w-[520px] flex flex-col border-l border-[#EEF0F4] bg-white shrink-0">
                    <div className="flex items-center justify-between px-4 py-2 border-b border-[#EEF0F4]">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={handleRun}
                                disabled={isRunning}
                                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                                    isRunning
                                        ? 'bg-green-100 text-green-600'
                                        : 'bg-green-500 text-white hover:bg-green-600 shadow-lg shadow-green-200'
                                }`}
                                title="Запустить"
                            >
                                {isRunning ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <Flag size={20} fill="currentColor" />
                                )}
                            </button>
                            <button
                                onClick={handleResetScene}
                                disabled={isRunning}
                                className="flex items-center gap-1.5 px-3 h-9 rounded-[10px] text-sm font-medium border border-[#E0E4EB] text-[#1A1D2D] hover:bg-gray-50 disabled:opacity-50"
                                title="Вернуть спрайты на исходные позиции"
                            >
                                <RotateCcw className="w-4 h-4" />
                                Сброс
                            </button>
                        </div>
                    </div>

                    <div className="p-4">
                        <div
                            className="relative rounded-[16px] overflow-hidden border border-[#EEF0F4] shadow-sm mx-auto"
                            style={{ width: STAGE_WIDTH, height: STAGE_HEIGHT }}
                        >
                            {currentProject ? (
                                <StageCanvas readOnly />
                            ) : (
                                <div className="w-full h-full bg-white" />
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default StudentTaskPage;
