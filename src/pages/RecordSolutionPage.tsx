import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import * as Blockly from 'blockly';
import { pythonGenerator } from 'blockly/python';
import { useCourseStore } from '@/store/useCourseStore';
import { useToastStore } from '@/store/useToastStore';
import { useProjectStore } from '@/store/useProjectStore';
import { useEditorStore } from '@/store/useEditorStore';
import { runtime } from '@/engine/Runtime';
import { Loader2, ChevronLeft, Save, AlertCircle, Flag, RotateCcw, Lock } from 'lucide-react';
import { toolboxConfig } from '@/blockly/toolbox';
import { ScratchTheme } from '@/blockly/theme';
import { loadWorkspaceFromXml, getWorkspaceXml } from '@/blockly/setup';
import '@/blockly/generators/python';
import StageCanvas from '@/components/stage/StageCanvas';
import SpriteList from '@/components/sprites/SpriteList';
import SpriteInfo from '@/components/sprites/SpriteInfo';
import BackdropSelector from '@/components/sprites/BackdropSelector';
import TabBar from '@/components/editor/TabBar';
import CostumeEditor from '@/components/editor/CostumeEditor';
import SoundEditor from '@/components/editor/SoundEditor';
import type { SceneStateDto, SpriteStateDto, TaskConfigDto } from '@/services/api';
import { STAGE_WIDTH, STAGE_HEIGHT } from '@/utils/constants';

// Категории блоков
const blockCategories = [
    { id: 'motion', name: 'Движение', color: '#3B82F6', colorClass: 'bg-blue-500' },
    { id: 'looks', name: 'Внешность', color: '#8B5CF6', colorClass: 'bg-violet-500' },
    { id: 'sound', name: 'Звук', color: '#EC4899', colorClass: 'bg-pink-500' },
    { id: 'events', name: 'События', color: '#F59E0B', colorClass: 'bg-amber-500' },
    { id: 'control', name: 'Управление', color: '#F97316', colorClass: 'bg-orange-500' },
    { id: 'sensing', name: 'Сенсоры', color: '#06B6D4', colorClass: 'bg-cyan-500' },
    { id: 'operators', name: 'Операторы', color: '#10B981', colorClass: 'bg-emerald-500' },
    { id: 'variables', name: 'Переменные', color: '#F97316', colorClass: 'bg-orange-500' },
];

// Фильтруем toolbox по выбранным категориям
const filterToolbox = (categories: string[]) => {
    const fullToolbox = JSON.parse(JSON.stringify(toolboxConfig));

    const categoryNameToId: Record<string, string> = {
        'движение': 'motion',
        'внешнийвид': 'looks',
        'внешний вид': 'looks',
        'внешность': 'looks',
        'звук': 'sound',
        'события': 'events',
        'управление': 'control',
        'сенсоры': 'sensing',
        'операторы': 'operators',
        'переменные': 'variables',
        'другиеблоки': 'procedures',
    };

    fullToolbox.contents = fullToolbox.contents.filter((cat: any) => {
        const catName = cat.name.toLowerCase().replace(/[^a-zа-я]/g, '');
        const catId = categoryNameToId[catName] || catName;
        return categories.some(selectedId =>
            selectedId.toLowerCase() === catId.toLowerCase() ||
            cat.name.toLowerCase().includes(selectedId.toLowerCase()) ||
            catId.toLowerCase().includes(selectedId.toLowerCase())
        );
    });

    return fullToolbox;
};

// Интерфейс для draft данных
interface TaskDraft {
    title: string;
    description: string;
    hint: string;
    selectedCategories: string[];
    sprites?: any[];
    config?: { sceneWidth: number; sceneHeight: number };
}

const RecordSolutionPage: React.FC = () => {
    const { courseId, lessonId, taskId } = useParams<{ courseId: string; lessonId: string; taskId: string }>();
    const navigate = useNavigate();
    const location = useLocation();

    const { addToast } = useToastStore();
    const [isSaving, setIsSaving] = useState(false);
    const [isRunning, setIsRunning] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [isLoadingTask, setIsLoadingTask] = useState(true);
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [draftData, setDraftData] = useState<TaskDraft | null>(null);
    const [isLocked, setIsLocked] = useState(false);
    const [lockedState, setLockedState] = useState<any>(null);

    const {
        currentTask,
        fetchTask,
        testSolution,
        updateTask,
    } = useCourseStore();

    const { currentProject, createProject, setProject, updateBlocks, updateSprite, updateStage } = useProjectStore();
    const { activeTab, selectSprite, selectedSpriteId, isStageSelected, setRunning } = useEditorStore();

    // Blockly refs
    const blocklyRef = useRef<HTMLDivElement>(null);
    const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null);
    const hasInitializedRef = useRef(false);

    // Refs для актуальных значений внутри change-listener'a, чтобы не пересоздавать workspace
    const currentProjectRef = useRef(currentProject);
    const selectedSpriteIdRef = useRef(selectedSpriteId);
    const isStageSelectedRef = useRef(isStageSelected);
    const updateBlocksRef = useRef(updateBlocks);

    useEffect(() => {
        currentProjectRef.current = currentProject;
    }, [currentProject]);
    useEffect(() => {
        selectedSpriteIdRef.current = selectedSpriteId;
    }, [selectedSpriteId]);
    useEffect(() => {
        isStageSelectedRef.current = isStageSelected;
    }, [isStageSelected]);
    useEffect(() => {
        updateBlocksRef.current = updateBlocks;
    }, [updateBlocks]);

    // Загружаем данные. Источники в порядке приоритета:
    // 1) location.state.draft (надёжно, передаётся при переходе с EditTaskPage)
    // 2) localStorage с ключом task_draft_<taskId>
    // 3) currentTask с бэка
    useEffect(() => {
        const loadData = async () => {
            setIsLoadingTask(true);

            const stateDraft = (location.state as { draft?: TaskDraft } | null)?.draft ?? null;
            let draft: TaskDraft | null = stateDraft;
            if (!draft && taskId) {
                const draftJson = localStorage.getItem(`task_draft_${taskId}`);
                if (draftJson) {
                    try {
                        draft = JSON.parse(draftJson) as TaskDraft;
                    } catch (e) {
                        console.error('Failed to parse draft:', e);
                    }
                }
            }
            if (draft) {
                setDraftData(draft);
                setSelectedCategories(draft.selectedCategories || []);
            }

            if (taskId) {
                await fetchTask(taskId);
            }

            setIsLoadingTask(false);
        };

        loadData();
    }, [taskId, fetchTask, location.state]);

    // Инициализация проекта (без дефолтного спрайта — учитель сам добавит нужные)
    useEffect(() => {
        if (!currentProject) {
            createProject('Solution Recording', 'teacher', 'Teacher', { withDefaultSprite: false });
        }
    }, [currentProject, createProject]);

    // Автовыбор спрайта: если ни один не выбран, но в проекте есть спрайты — берём первый.
    // Срабатывает и при первом монтировании, и при добавлении первого спрайта в пустой проект.
    useEffect(() => {
        if (!currentProject) return;
        if (isStageSelected) return;
        const hasSprites = currentProject.sprites.length > 0;
        if (!hasSprites) return;
        const selectedExists = currentProject.sprites.some(s => s.id === selectedSpriteId);
        if (!selectedExists) {
            selectSprite(currentProject.sprites[0].id);
        }
    }, [currentProject, selectedSpriteId, isStageSelected, selectSprite]);

    // Загружаем блоки при смене спрайта
    const loadedTargetIdRef = useRef<string | null>(null);

    useEffect(() => {
        if (!workspaceRef.current || !currentProject) return;

        const targetId = isStageSelected ? currentProject.stage.id : selectedSpriteId;

        if (!targetId) return;

        // Не загружаем если уже загружено для этого спрайта
        if (loadedTargetIdRef.current === targetId) {
            console.log('[RecordSolutionPage] Already loaded for target:', targetId, 'skipping');
            return;
        }

        // Получаем блоки из проекта
        const blocks = isStageSelected
            ? currentProject.stage.blocks
            : currentProject.sprites.find(s => s.id === selectedSpriteId)?.blocks;

        console.log('[RecordSolutionPage] Loading blocks for target:', targetId, 'blocks exist:', !!blocks, 'length:', blocks?.length);

        loadedTargetIdRef.current = targetId;

        if (blocks) {
            loadWorkspaceFromXml(workspaceRef.current, blocks);
        } else {
            // Если нет блоков - очищаем workspace
            workspaceRef.current.clear();
        }
    }, [currentProject?.id, selectedSpriteId, isStageSelected]);

    // Инициализация Blockly. Делаем один раз, когда лоадер ушёл и blocklyRef уже в DOM.
    // Toolbox обновляем отдельным эффектом ниже при изменении выбранных категорий.
    useEffect(() => {
        if (isLoadingTask) return;
        if (!blocklyRef.current || hasInitializedRef.current) return;

        const initialToolbox = selectedCategories.length > 0
            ? filterToolbox(selectedCategories)
            : toolboxConfig;

        workspaceRef.current = Blockly.inject(blocklyRef.current, {
            toolbox: initialToolbox,
            theme: ScratchTheme,
            renderer: 'zelos',
            grid: {
                spacing: 40,
                length: 2,
                colour: '#DDD',
                snap: false,
            },
            zoom: {
                controls: true,
                wheel: true,
                startScale: 0.675,
                maxScale: 4,
                minScale: 0.25,
                scaleSpeed: 1.1,
            },
            trashcan: true,
            move: {
                scrollbars: true,
                drag: true,
                wheel: true,
            },
            sounds: true,
            media: 'https://unpkg.com/blockly@11.2.2/media/',
        });

        hasInitializedRef.current = true;

        // Загружаем сохраненное решение если есть
        const savedSolution = taskId ? localStorage.getItem(`task_solution_${taskId}`) : null;
        if (savedSolution) {
            try {
                loadWorkspaceFromXml(workspaceRef.current, savedSolution);
            } catch (e) {
                console.error('Failed to load saved solution:', e);
            }
        }

        // Слушатель изменений - сохраняем блоки в текущий спрайт проекта
        const saveBlocksToProject = () => {
            const ws = workspaceRef.current;
            const project = currentProjectRef.current;
            if (!ws || !project) return;

            const xml = getWorkspaceXml(ws);
            const targetId = isStageSelectedRef.current
                ? project.stage.id
                : selectedSpriteIdRef.current;

            if (targetId) {
                updateBlocksRef.current(targetId, xml);
            }
        };

        workspaceRef.current.addChangeListener((event) => {
            if (!event || event.isUiEvent) return;
            saveBlocksToProject();
        });

        return () => {
            workspaceRef.current?.dispose();
            workspaceRef.current = null;
            hasInitializedRef.current = false;
            loadedTargetIdRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [taskId, isLoadingTask]);

    // Подменяем toolbox при изменении выбранных категорий
    useEffect(() => {
        const ws = workspaceRef.current;
        if (!ws || !hasInitializedRef.current) return;
        const next = selectedCategories.length > 0
            ? filterToolbox(selectedCategories)
            : toolboxConfig;
        try {
            ws.updateToolbox(next as unknown as Element);
        } catch (e) {
            console.error('[RecordSolutionPage] Failed to update toolbox:', e);
        }
    }, [selectedCategories]);

    // Обновляем размер Blockly при смене таба
    useEffect(() => {
        if (activeTab === 'code' && workspaceRef.current && hasInitializedRef.current) {
            requestAnimationFrame(() => {
                setTimeout(() => {
                    Blockly.svgResize(workspaceRef.current!);
                }, 50);
            });
        }
    }, [activeTab]);

    // Фиксация начального состояния
    const handleLock = () => {
        if (!currentProject) return;
        
        if (!isLocked) {
            // Сохраняем текущее состояние
            setLockedState({
                project: JSON.parse(JSON.stringify(currentProject)),
            });
            setIsLocked(true);
            addToast('Начальное состояние зафиксировано', 'success');
        } else {
            setIsLocked(false);
            addToast('Фиксация снята', 'info');
        }
    };

    // Сброс к зафиксированному состоянию
    const handleReset = () => {
        if (lockedState && lockedState.project) {
            setProject(lockedState.project);
            addToast('Состояние сброшено', 'info');
        } else {
            addToast('Нет зафиксированного состояния', 'info');
        }
    };

    // Конфиг сцены — фиксированные размеры превью 480×360 (в пикселях)
    const buildConfig = (): TaskConfigDto => ({
        sceneWidth: STAGE_WIDTH,
        sceneHeight: STAGE_HEIGHT,
    });

    // Преобразуем спрайты проекта в SceneStateDto для бэкенда
    const buildInitialState = (): SceneStateDto => {
        if (!currentProject) return { sprites: [] };
        const sprites: SpriteStateDto[] = currentProject.sprites.map(s => {
            const costume = s.costumes[s.currentCostume] ?? s.costumes[0];
            const scale = (s.size ?? 100) / 100;
            return {
                type: s.type ?? 'cat',
                x: s.x,
                y: s.y,
                width: (costume?.width ?? 0) * scale,
                height: (costume?.height ?? 0) * scale,
                visible: s.visible,
            };
        });
        return { sprites };
    };

    // Запуск кода с тестированием через API
    const handleRunWithTest = async () => {
        if (!workspaceRef.current || !currentProject) return;
        if (!taskId) {
            addToast('Не указан id задания', 'error');
            return;
        }

        // Генерируем Python код из блоков
        const pythonCode = pythonGenerator.workspaceToCode(workspaceRef.current);

        if (!pythonCode.trim()) {
            addToast('Нет кода для выполнения', 'error');
            return;
        }

        setIsRunning(true);
        setRunning(true);

        // Запускаем локально для визуализации
        runtime.loadProject(currentProject);
        try {
            await runtime.start();
        } catch (e) {
            console.error('Runtime error:', e);
        }

        // Синхронизируем финальные позиции спрайтов из runtime в проект,
        // чтобы превью отражало результат выполнения
        const finalState = runtime.getState();
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
        setIsRunning(false);

        // Тестируем через API
        setIsTesting(true);
        try {
            const result = await testSolution(taskId, pythonCode, {
                initialState: buildInitialState(),
                config: buildConfig(),
            });

            // Применяем финальное состояние с бэкенда (учитывает столкновения и
            // поедание яблок: съеденное яблоко приходит с visible: false).
            // Спрайты возвращаются в том же порядке, в каком отправлялись в initialState.
            if (result?.finalState?.sprites && currentProject) {
                result.finalState.sprites.forEach((bs, idx) => {
                    const target = currentProject.sprites[idx];
                    if (!target) return;
                    updateSprite(target.id, {
                        x: bs.x,
                        y: bs.y,
                        visible: bs.visible,
                    });
                });
            }

            if (result?.success) {
                addToast('✅ Решение прошло тестирование на сервере', 'success');
            } else {
                addToast(result?.error || '❌ Решение не прошло тестирование', 'error');
            }
        } catch (e) {
            console.error('API test error:', e);
            addToast('Ошибка при тестировании', 'error');
        } finally {
            setIsTesting(false);
        }
    };

    const handleSaveSolution = async () => {
        if (!workspaceRef.current || !courseId || !lessonId || !taskId) return;

        setIsSaving(true);

        try {
            // Получаем XML и Python код
            const xml = getWorkspaceXml(workspaceRef.current);
            const pythonCode = pythonGenerator.workspaceToCode(workspaceRef.current);

            // Сохраняем решение в localStorage (для превью на странице редактирования)
            localStorage.setItem(`task_solution_${taskId}`, xml || '');
            localStorage.setItem(`task_solution_python_${taskId}`, pythonCode || '');

            // Сохраняем актуальные категории, чтобы они подтянулись при возврате
            if (draftData) {
                localStorage.setItem(
                    `task_draft_${taskId}`,
                    JSON.stringify({
                        title: draftData.title,
                        description: draftData.description,
                        hint: draftData.hint,
                        selectedCategories,
                    })
                );
            }

            // Сохраняем задание на бэкенде: title/description (из черновика или с бэка),
            // initialState из текущей сцены, config 480×360, solutionCode = python.
            const title = draftData?.title || currentTask?.title || '';
            const description = draftData?.description || currentTask?.description || '';
            const order = currentTask?.order ?? 1;

            const result = await updateTask(taskId, {
                title,
                description,
                order,
                config: buildConfig(),
                initialState: buildInitialState(),
                solutionCode: pythonCode,
            });

            if (result) {
                addToast('Эталонное решение сохранено', 'success');
                navigate(
                    `/teacher/course/${courseId}/lesson/${lessonId}/task/${taskId}/edit`,
                    { state: { draft: { ...draftData, selectedCategories } } }
                );
            }
        } catch (error) {
            console.error('Error saving solution:', error);
            addToast('Ошибка сохранения решения', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    // Валидность: страница доступна, если есть название и описание задания.
    // Категории блоков не обязательны (учитель мог их пока не выбрать).
    const isValid = () => {
        if (draftData) {
            return Boolean(draftData.title?.trim() && draftData.description?.trim());
        }
        if (currentTask) {
            return Boolean(currentTask.title?.trim() && currentTask.description?.trim());
        }
        return false;
    };

    // Показываем лоадер
    if (isLoadingTask) {
        return (
            <div className="h-screen flex flex-col bg-[#F8FAFB]">
                <header className="bg-white border-b border-[#EEF0F4]">
                    <div className="max-w-7xl mx-auto px-4 py-3">
                        <button
                            onClick={() => navigate(-1)}
                            className="flex items-center gap-2 text-[#6B7280] hover:text-[#1A1D2D] transition-colors"
                        >
                            <ChevronLeft className="w-5 h-5" />
                            <span className="text-sm">Назад</span>
                        </button>
                    </div>
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

    if (!isValid()) {
        return (
            <div className="h-screen flex flex-col bg-[#F8FAFB]">
                <header className="bg-white border-b border-[#EEF0F4]">
                    <div className="max-w-7xl mx-auto px-4 py-3">
                        <button
                            onClick={() => navigate(-1)}
                            className="flex items-center gap-2 text-[#6B7280] hover:text-[#1A1D2D] transition-colors"
                        >
                            <ChevronLeft className="w-5 h-5" />
                            <span className="text-sm">Назад</span>
                        </button>
                    </div>
                </header>
                <div className="flex-1 flex items-center justify-center">
                    <div className="bg-amber-50 border border-amber-200 rounded-[16px] p-8 max-w-md text-center">
                        <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
                        <h2 className="text-lg font-bold text-amber-800 mb-2">Нельзя записать решение</h2>
                        <p className="text-amber-700 text-sm mb-4">
                            Перед записью решения необходимо заполнить:<br />
                            • Название задания<br />
                            • Описание задания
                        </p>
                        <button
                            onClick={() => navigate(-1)}
                            className="px-4 py-2 bg-[#734DE6] text-white rounded-[10px] text-sm font-medium hover:bg-[#5a3eb8] transition-colors"
                        >
                            Вернуться к редактированию
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen flex flex-col overflow-hidden bg-[#F8FAFB]">
            {/* Header */}
            <header className="bg-white border-b border-[#EEF0F4] flex items-center justify-between px-4 py-2">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-1 text-[#6B7280] hover:text-[#1A1D2D] transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5" />
                        <span className="text-sm">Запись эталонного решения</span>
                    </button>
                    <div className="h-6 w-px bg-[#EEF0F4]" />
                    <div>
                        <div className="text-sm text-[#734DE6] font-medium">
                            {draftData?.title || currentTask?.title || 'Запись решения'}
                        </div>
                        <div className="text-sm text-[#1A1D2D] font-semibold">
                            Доступно {selectedCategories.length} категорий блоков
                        </div>
                    </div>
                </div>
                
                <div className="flex items-center gap-2">
                    {/* Lock/Reset Controls */}
                    <button
                        onClick={handleLock}
                        className={`flex items-center gap-2 px-3 py-2 rounded-[8px] text-sm font-medium transition-colors ${
                            isLocked
                                ? 'bg-amber-100 text-amber-700 border border-amber-200'
                                : 'bg-[#F8FAFB] text-[#1A1D2D] border border-[#E0E4EB] hover:bg-gray-50'
                        }`}
                    >
                        {isLocked ? <Lock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                        {isLocked ? 'Зафиксировано' : 'Зафиксировать'}
                    </button>
                    
                    {isLocked && (
                        <button
                            onClick={handleReset}
                            className="flex items-center gap-2 px-3 py-2 rounded-[8px] text-sm font-medium bg-[#F8FAFB] text-[#1A1D2D] border border-[#E0E4EB] hover:bg-gray-50"
                        >
                            <RotateCcw className="w-4 h-4" />
                            Сброс
                        </button>
                    )}

                    <button
                        onClick={handleSaveSolution}
                        disabled={isSaving}
                        className="flex items-center gap-2 bg-[#734DE6] text-white px-4 py-2 rounded-[10px] text-sm font-medium hover:bg-[#5a3eb8] transition-colors disabled:opacity-50"
                    >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Сохранить решение
                    </button>
                </div>
            </header>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left Panel - Available Categories */}
                <div className="w-64 bg-white border-r border-[#EEF0F4] flex flex-col shrink-0 overflow-y-auto">
                    <div className="p-4 border-b border-[#EEF0F4]">
                        <h3 className="text-sm font-semibold text-[#1A1D2D] mb-1">Доступные блоки</h3>
                        <p className="text-xs text-[#6B7280]">Ученику будут доступны только эти категории:</p>
                    </div>
                    <div className="p-4">
                        <div className="space-y-3">
                            {selectedCategories.map(catId => {
                                const cat = blockCategories.find(c => c.id === catId);
                                return cat ? (
                                    <div key={catId} className="flex items-center gap-3">
                                        <div className={`w-3 h-3 rounded-full ${cat.colorClass}`} />
                                        <span className="text-sm text-[#1A1D2D]">{cat.name}</span>
                                    </div>
                                ) : null;
                            })}
                        </div>
                    </div>
                    <div className="mt-auto p-4 border-t border-[#EEF0F4]">
                        <div className="p-3 bg-blue-50 rounded-[12px] border border-blue-100">
                            <h4 className="text-sm font-medium text-blue-800 mb-2">Инструкция</h4>
                            <p className="text-xs text-blue-700">
                                1. Нажмите "Зафиксировать" для сохранения начального состояния<br/>
                                2. Соберите программу-решение<br/>
                                3. Нажмите 🚩 для тестирования<br/>
                                4. Сохраните решение
                            </p>
                        </div>
                    </div>
                </div>

                {/* Center - Editor Area */}
                <div className="flex-1 flex flex-col min-w-0 bg-[#F8FAFB]">
                    <TabBar />
                    <div className="flex-1 overflow-hidden relative">
                        {/* Все вкладки рендерятся но скрываются через CSS */}
                        <div className="absolute inset-0" style={{ display: activeTab === 'code' ? 'block' : 'none' }}>
                            <div ref={blocklyRef} className="w-full h-full" />
                        </div>
                        <div className="absolute inset-0" style={{ display: activeTab === 'costumes' ? 'block' : 'none' }}>
                            <CostumeEditor />
                        </div>
                        <div className="absolute inset-0" style={{ display: activeTab === 'sounds' ? 'block' : 'none' }}>
                            <SoundEditor />
                        </div>
                    </div>
                </div>

                {/* Right Panel - Stage & Sprites */}
                <div className="w-[520px] flex flex-col border-l border-[#EEF0F4] bg-white shrink-0 overflow-y-auto">
                    {/* Stage Controls */}
                    <div className="flex items-center justify-between px-4 py-2 border-b border-[#EEF0F4]">
                        <div className="flex items-center gap-2">
                            {/* Flag Button (Run with Test) */}
                            <button
                                onClick={handleRunWithTest}
                                disabled={isRunning || !isLocked}
                                className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                                    isRunning || isTesting
                                        ? 'bg-green-100 text-green-600'
                                        : !isLocked
                                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                            : 'bg-green-500 text-white hover:bg-green-600 shadow-lg shadow-green-200'
                                }`}
                                title={!isLocked ? 'Сначала зафиксируйте начальное состояние' : 'Запустить и протестировать'}
                            >
                                {isTesting ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <Flag size={20} fill="currentColor" />
                                )}
                            </button>
                        </div>
                        
                        {/* Lock Status */}
                        <div className={`text-xs flex items-center gap-1 ${isLocked ? 'text-amber-600' : 'text-gray-400'}`}>
                            {isLocked ? (
                                <><Lock className="w-3 h-3" /> Зафиксировано</>
                            ) : (
                                <><Lock className="w-3 h-3" /> Не зафиксировано</>
                            )}
                        </div>
                    </div>

                    {/* Stage 480×360 */}
                    <div className="p-4 shrink-0">
                        <div
                            className="relative rounded-[16px] overflow-hidden border border-[#EEF0F4] shadow-sm mx-auto"
                            style={{ width: STAGE_WIDTH, height: STAGE_HEIGHT }}
                        >
                            <StageCanvas />
                        </div>
                    </div>

                    {/* Sprite Info */}
                    <div className="px-4 py-2 border-t border-[#EEF0F4] shrink-0">
                        <SpriteInfo />
                    </div>

                    {/* Sprites */}
                    <div className="flex flex-col border-t border-[#EEF0F4] shrink-0">
                        <div className="px-4 py-2">
                            <h3 className="text-xs font-semibold text-[#6B7280] uppercase">Спрайты</h3>
                        </div>
                        <div className="h-52 overflow-hidden px-4 pb-4">
                            <SpriteList />
                        </div>
                    </div>

                    {/* Backdrop */}
                    <div className="px-4 py-3 border-t border-[#EEF0F4]">
                        <h3 className="text-xs font-semibold text-[#6B7280] uppercase mb-2">Сцена</h3>
                        <BackdropSelector />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RecordSolutionPage;
