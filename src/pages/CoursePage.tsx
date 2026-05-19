import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/store/useAuthStore';
import { useCourseStore } from '@/store/useCourseStore';
import { BookOpen, Clock, CheckCircle, Play, Lock, ChevronLeft, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { api, TaskDto } from '@/services/api';

// Расширенный тип урока с задачами
interface LessonWithTasks {
    id: string;
    title: string | null;
    description: string | null;
    order: number;
    courseId: string;
    tasks: TaskDto[];
    status: 'completed' | 'in-progress' | 'available' | 'locked';
}

const CoursePage: React.FC = () => {
    const { courseId } = useParams<{ courseId: string }>();
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const [expandedLessonId, setExpandedLessonId] = useState<string | null>(null);
    const [lessonTasks, setLessonTasks] = useState<Record<string, TaskDto[]>>({});

    const {
        currentCourse,
        lessons,
        tasks,
        progress,
        isLoading,
        error,
        fetchCourse,
        fetchLessons,
        fetchTasks,
        fetchStudentProgress,
        clearError,
    } = useCourseStore();

    // Загружаем курс и уроки
    useEffect(() => {
        if (courseId) {
            fetchCourse(courseId);
            fetchLessons(courseId);
            if (user?.id) {
                fetchStudentProgress(user.id);
            }
        }
    }, [courseId, fetchCourse, fetchLessons, fetchStudentProgress, user?.id]);

    // Загружаем задачи при раскрытии урока и сохраняем в локальный кэш
    useEffect(() => {
        if (expandedLessonId) {
            fetchTasks(expandedLessonId);
        }
    }, [expandedLessonId, fetchTasks]);

    useEffect(() => {
        if (expandedLessonId && tasks.length >= 0) {
            setLessonTasks(prev => ({ ...prev, [expandedLessonId]: tasks }));
        }
    }, [expandedLessonId, tasks]);

    // При загрузке курса заранее подтягиваем задания всех уроков, чтобы статус
    // "Выполнено / в процессе" отображался на карточках уроков сразу, без раскрытия.
    useEffect(() => {
        if (lessons.length === 0) return;
        let cancelled = false;

        Promise.all(
            lessons.map(async (lesson) => {
                try {
                    const list = await api.getTasks(lesson.id);
                    return [lesson.id, list] as const;
                } catch {
                    return [lesson.id, [] as TaskDto[]] as const;
                }
            })
        ).then((entries) => {
            if (cancelled) return;
            setLessonTasks(prev => {
                const next = { ...prev };
                for (const [lessonId, list] of entries) {
                    next[lessonId] = list;
                }
                return next;
            });
        });

        return () => { cancelled = true; };
    }, [lessons]);

    if (!user || user.role !== 'student') return null;

    // Множество выполненных тасок из ProgressDto
    const completedTaskIds = new Set(progress.filter(p => p.completed).map(p => p.taskId));

    // Прогресс курса как доля выполненных тасок от всех загруженных в кэш
    const allKnownTasks = Object.values(lessonTasks).flat();
    const totalTasks = allKnownTasks.length || tasks.length;
    const completedCount = allKnownTasks.filter(t => completedTaskIds.has(t.id)).length;
    const progressPercentage = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

    // Определяем статус урока: выполнен если все задания выполнены и есть хоть одно
    const getLessonStatus = (lessonId: string, index: number): LessonWithTasks['status'] => {
        const lessonTasksList = lessonTasks[lessonId] || [];
        if (lessonTasksList.length > 0 && lessonTasksList.every(t => completedTaskIds.has(t.id))) {
            return 'completed';
        }
        if (lessonTasksList.some(t => completedTaskIds.has(t.id))) {
            return 'in-progress';
        }
        if (index === 0) return 'available';
        // TODO: разблокировать на основе прогресса предыдущего урока
        return 'available';
    };

    // Подготавливаем уроки
    const lessonsWithStatus: LessonWithTasks[] = lessons.map((lesson, index) => ({
        ...lesson,
        tasks: lessonTasks[lesson.id] || [],
        status: getLessonStatus(lesson.id, index),
    }));

    const getLessonIcon = (status: LessonWithTasks['status']) => {
        switch (status) {
            case 'completed':
                return (
                    <div className="w-12 h-12 bg-green-100 rounded-[12px] flex items-center justify-center">
                        <CheckCircle className="w-6 h-6 text-green-500" />
                    </div>
                );
            case 'in-progress':
                return (
                    <div className="w-12 h-12 bg-[rgba(115,77,230,0.1)] rounded-[12px] flex items-center justify-center">
                        <Play className="w-6 h-6 text-[#734DE6]" />
                    </div>
                );
            case 'available':
                return (
                    <div className="w-12 h-12 bg-gray-100 rounded-[12px] flex items-center justify-center">
                        <div className="w-6 h-6 rounded-full border-2 border-gray-400" />
                    </div>
                );
            case 'locked':
                return (
                    <div className="w-12 h-12 bg-gray-100 rounded-[12px] flex items-center justify-center">
                        <Lock className="w-5 h-5 text-gray-400" />
                    </div>
                );
            default:
                return null;
        }
    };

    const getLessonStyles = (status: LessonWithTasks['status']) => {
        switch (status) {
            case 'in-progress':
                return 'border-[#734DE6] bg-white shadow-sm';
            case 'completed':
                return 'border-[#EEF0F4] bg-white';
            case 'available':
                return 'border-[#EEF0F4] bg-white hover:border-[#734DE6] transition-colors';
            case 'locked':
                return 'border-[#EEF0F4] bg-gray-50 opacity-60';
            default:
                return '';
        }
    };

    const handleLessonClick = (lessonId: string, status: LessonWithTasks['status']) => {
        if (status === 'locked') return;
        setExpandedLessonId(prev => prev === lessonId ? null : lessonId);
    };

    const handleStartTask = (taskId: string) => {
        navigate(`/student/task/${taskId}`);
    };

    const courseEmoji = '🐱';

    return (
        <div className="min-h-screen bg-[#F8FAFB]">
            {/* Gradient Header */}
            <div className="bg-gradient-to-br from-[#734DE6] via-[#6366F1] to-[#14B8A6] relative">
                <div className="max-w-6xl mx-auto px-4 py-8">
                    {/* Back Button */}
                    <button
                        onClick={() => navigate('/student')}
                        className="flex items-center gap-2 text-white/80 hover:text-white mb-6 transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5" />
                        <span>Назад к курсам</span>
                    </button>

                    {/* Course Info */}
                    {isLoading && !currentCourse ? (
                        <div className="flex items-center gap-4">
                            <Loader2 className="w-8 h-8 text-white animate-spin" />
                            <span className="text-white">Загрузка курса...</span>
                        </div>
                    ) : currentCourse ? (
                        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
                            <div className="flex-1">
                                <div className="flex items-center gap-3 mb-3">
                                    <span className="text-4xl">{courseEmoji}</span>
                                    <h1 className="text-2xl md:text-3xl font-bold text-white">{currentCourse.title}</h1>
                                </div>
                                <p className="text-white/80 max-w-xl mb-4">
                                    {currentCourse.description}
                                </p>
                                <div className="flex items-center gap-4 text-sm text-white/70">
                                    <span className="flex items-center gap-1.5">
                                        <BookOpen className="w-4 h-4" />
                                        {lessons.length} уроков
                                    </span>
                                    <span className="flex items-center gap-1.5">
                                        <Clock className="w-4 h-4" />
                                        ~{Math.round(lessons.length * 0.5)} часа
                                    </span>
                                </div>
                            </div>

                            {/* Progress Card */}
                            <div className="bg-white/10 backdrop-blur-sm rounded-[16px] p-5 min-w-[180px]">
                                <div className="text-white/70 text-sm mb-1">Прогресс</div>
                                <div className="text-3xl font-bold text-white mb-3">{progressPercentage}%</div>
                                <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-[#734DE6] rounded-full"
                                        style={{ width: `${progressPercentage}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>

            {/* Lessons List */}
            <main className="max-w-6xl mx-auto px-4 py-8">
                {/* Error Message */}
                {error && (
                    <div className="mb-6 bg-red-50 border border-red-200 rounded-[12px] p-4 flex items-center justify-between">
                        <span className="text-red-600 text-sm">{error}</span>
                        <button
                            onClick={clearError}
                            className="text-red-600 hover:text-red-700 text-sm font-medium"
                        >
                            ✕
                        </button>
                    </div>
                )}

                {/* Loading State */}
                {isLoading && lessons.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 text-[#734DE6] animate-spin mb-4" />
                        <p className="text-[#6B7280]">Загрузка уроков...</p>
                    </div>
                )}

                <h2 className="text-xl font-bold text-[#1A1D2D] mb-5">Уроки</h2>

                {lessons.length === 0 && !isLoading ? (
                    <div className="bg-white rounded-[16px] p-8 text-center border border-[#EEF0F4]">
                        <p className="text-[#6B7280]">В этом курсе пока нет уроков</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {lessonsWithStatus.map((lesson) => (
                            <div key={lesson.id}>
                                <div
                                    className={`flex items-center gap-4 p-4 rounded-[16px] border-2 ${getLessonStyles(lesson.status)} ${lesson.status !== 'locked' ? 'cursor-pointer' : ''}`}
                                    onClick={() => handleLessonClick(lesson.id, lesson.status)}
                                >
                                    {/* Lesson Icon */}
                                    {getLessonIcon(lesson.status)}

                                    {/* Lesson Info */}
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3">
                                            <h3 className={`font-semibold ${lesson.status === 'locked' ? 'text-gray-400' : 'text-[#1A1D2D]'}`}>
                                                {lesson.order}. {lesson.title || 'Без названия'}
                                            </h3>
                                            {lesson.status === 'in-progress' && (
                                                <span className="bg-[rgba(115,77,230,0.1)] text-[#734DE6] text-xs px-2 py-0.5 rounded-full">
                                                    В процессе
                                                </span>
                                            )}
                                        </div>
                                        <div className={`text-sm mt-1 ${lesson.status === 'locked' ? 'text-gray-400' : 'text-[#6B7280]'}`}>
                                            {lesson.tasks.length} заданий · ~{lesson.tasks.length * 15} мин
                                        </div>
                                    </div>

                                    {/* Expand Icon */}
                                    {lesson.status !== 'locked' && (
                                        <div className="text-[#6B7280]">
                                            {expandedLessonId === lesson.id ? (
                                                <ChevronUp className="w-5 h-5" />
                                            ) : (
                                                <ChevronDown className="w-5 h-5" />
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Tasks List */}
                                {expandedLessonId === lesson.id && lesson.status !== 'locked' && (
                                    <div className="ml-16 mt-2 space-y-2">
                                        {isLoading ? (
                                            <div className="flex items-center gap-2 py-3">
                                                <Loader2 className="w-4 h-4 text-[#734DE6] animate-spin" />
                                                <span className="text-sm text-[#6B7280]">Загрузка заданий...</span>
                                            </div>
                                        ) : tasks.length === 0 ? (
                                            <div className="py-3 text-sm text-[#9CA3AF]">
                                                В этом уроке пока нет заданий
                                            </div>
                                        ) : (
                                            tasks.map((task, index) => {
                                                const isCompleted = completedTaskIds.has(task.id);
                                                return (
                                                    <div
                                                        key={task.id}
                                                        className={`flex items-center justify-between p-3 bg-white rounded-[12px] border transition-colors cursor-pointer ${
                                                            isCompleted
                                                                ? 'border-emerald-200 bg-emerald-50/40'
                                                                : 'border-[#EEF0F4] hover:border-[#734DE6]'
                                                        }`}
                                                        onClick={() => handleStartTask(task.id)}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div
                                                                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                                                                    isCompleted
                                                                        ? 'bg-emerald-100 text-emerald-700'
                                                                        : 'bg-[rgba(115,77,230,0.1)] text-[#734DE6]'
                                                                }`}
                                                            >
                                                                {isCompleted ? <CheckCircle className="w-4 h-4" /> : index + 1}
                                                            </div>
                                                            <span className="text-sm font-medium text-[#1A1D2D]">{task.title || 'Без названия'}</span>
                                                            {isCompleted && (
                                                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                                                                    Выполнено
                                                                </span>
                                                            )}
                                                        </div>
                                                        <button
                                                            className={`px-3 py-1.5 text-xs font-medium rounded-[8px] transition-colors ${
                                                                isCompleted
                                                                    ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                                                                    : 'bg-[#734DE6] text-white hover:bg-[#5a3eb8]'
                                                            }`}
                                                        >
                                                            {isCompleted ? 'Открыть' : 'Начать'}
                                                        </button>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
};

export default CoursePage;
