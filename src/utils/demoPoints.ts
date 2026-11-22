// Демо-данные для экранов баллов, рейтинга и достижений — API для них пока нет.
// ponytail: заменить на запросы к бэкенду, когда появятся эндпоинты баллов.

export const DEMO_COURSES = [
    { id: 'first-steps', title: 'Мои первые шаги', emoji: '🐱' },
    { id: 'games', title: 'Создаём игры', emoji: '🎮' },
];

export interface DemoGroup {
    id: string;
    name: string;
    emoji: string;
    tint: string;
    bar: string;
}

export const DEMO_GROUPS: DemoGroup[] = [
    { id: 'rockets', name: 'Ракеты', emoji: '🚀', tint: 'bg-[#E3F2FD]', bar: 'bg-[#3CC6D0]' },
    { id: 'stars', name: 'Звёзды', emoji: '⭐', tint: 'bg-[#FFF3D6]', bar: 'bg-gradient-to-r from-[#F5C542] to-[#3CC6D0]' },
];

export interface DemoStudent {
    id: string;
    name: string;
    avatar: string;
    groupId: string;
    // баллы по курсам
    points: Record<string, number>;
}

export const DEMO_STUDENTS: DemoStudent[] = [
    { id: 's1', name: 'Артём К.', avatar: '🧑‍🚀', groupId: 'rockets', points: { 'first-steps': 320, games: 160 } },
    { id: 's2', name: 'Маша Д.', avatar: '👩‍🚀', groupId: 'rockets', points: { 'first-steps': 280, games: 200 } },
    { id: 's3', name: 'Дима Л.', avatar: '👨‍💻', groupId: 'rockets', points: { 'first-steps': 240, games: 120 } },
    { id: 's4', name: 'Аня С.', avatar: '👩‍💻', groupId: 'stars', points: { 'first-steps': 300, games: 220 } },
    { id: 's5', name: 'Максим П.', avatar: '🦊', groupId: 'stars', points: { 'first-steps': 260, games: 180 } },
    { id: 's6', name: 'Соня М.', avatar: '🐼', groupId: 'stars', points: { 'first-steps': 220, games: 160 } },
];

// Текущий ученик в демо — Артём из «Ракет».
export const DEMO_ME = DEMO_STUDENTS[0];

export const totalPoints = (s: DemoStudent) => Object.values(s.points).reduce((a, b) => a + b, 0);

export const groupPoints = (groupId: string, courseId: string) =>
    DEMO_STUDENTS.filter(s => s.groupId === groupId).reduce((a, s) => a + (s.points[courseId] ?? 0), 0);

export interface DemoAchievement {
    title: string;
    description: string;
    emoji: string;
    tint: string;
    receivedAt?: string;
    progress?: [number, number];
}

export const DEMO_ACHIEVEMENTS: DemoAchievement[] = [
    { title: 'Первый запуск', description: 'Запусти свою первую программу', emoji: '🚀', tint: 'bg-[#E8F3FD]', receivedAt: '10 ноября' },
    { title: 'Повелитель движения', description: 'Выполни 5 заданий с движением', emoji: '🐱', tint: 'bg-[#FFF3D6]', receivedAt: '11 ноября' },
    { title: 'Часть команды', description: 'Внеси первые баллы в копилку группы', emoji: '🤝', tint: 'bg-[#E3F6F4]', receivedAt: '11 ноября' },
    { title: 'Исследователь', description: 'Выполни 10 заданий', emoji: '🧭', tint: 'bg-[#FDEBDD]', receivedAt: '13 ноября' },
    { title: 'Создатель игр', description: 'Заверши курс «Создаём игры»', emoji: '🎮', tint: 'bg-[#EFEAFB]', progress: [3, 12] },
    { title: 'Шаг за шагом', description: 'Заверши 5 уроков', emoji: '🏅', tint: 'bg-[#FFF3D6]', progress: [3, 5] },
    { title: 'Рассказчик', description: 'Создай свою первую историю', emoji: '🎬', tint: 'bg-[#F8E9F8]', progress: [0, 1] },
    { title: 'Мастер блоков', description: 'Выполни 25 заданий', emoji: '🧩', tint: 'bg-[#E6F6EA]', progress: [15, 25] },
];

export const DEMO_RECENT_POINTS = [
    { task: 'Кот идёт к яблоку', meta: 'Мои первые шаги · Сегодня', points: 40 },
    { task: 'Первые шаги героя', meta: 'Создаём игры · Вчера', points: 40 },
    { task: 'События и реакции', meta: 'Мои первые шаги · 13 ноября', points: 30 },
];
