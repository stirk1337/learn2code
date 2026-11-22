import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Award, Check, Lock, Star, Users } from 'lucide-react';
import TopNav from '@/components/layout/TopNav';
import { useAuthStore } from '@/store/useAuthStore';
import { DEMO_ACHIEVEMENTS, DEMO_GROUPS, DEMO_ME, DEMO_RECENT_POINTS, totalPoints } from '@/utils/demoPoints';

const FILTERS = [
    { id: 'all', label: 'Все' },
    { id: 'received', label: 'Получены' },
    { id: 'ahead', label: 'Впереди' },
] as const;

type Filter = typeof FILTERS[number]['id'];

const AchievementsPage: React.FC = () => {
    const { user } = useAuthStore();
    const navigate = useNavigate();
    const [filter, setFilter] = useState<Filter>('all');

    const received = DEMO_ACHIEVEMENTS.filter(a => a.receivedAt).length;
    const group = DEMO_GROUPS.find(g => g.id === DEMO_ME.groupId)!;
    const visible = DEMO_ACHIEVEMENTS.filter(a =>
        filter === 'all' || (filter === 'received' ? a.receivedAt : !a.receivedAt)
    );
    const next = DEMO_ACHIEVEMENTS.find(a => a.title === 'Шаг за шагом')!;
    const name = user?.displayName?.split(' ')[0] || 'Ученик';

    return (
        <div className="min-h-screen bg-[#F8FAFB]">
            <TopNav />

            <main className="max-w-6xl mx-auto px-4 py-8">
                <div className="flex items-start justify-between gap-4 mb-6">
                    <div>
                        <div className="text-xs font-bold text-[#734DE6] uppercase tracking-wide mb-1">Твой путь в программировании</div>
                        <h1 className="text-3xl font-bold text-[#1A1D2D] mb-2">Мои достижения 🏆</h1>
                        <p className="text-[#6B7280]">{name}, каждый маленький шаг — большая победа!</p>
                    </div>
                    <span className="shrink-0 text-xs text-[#6B7280] border border-[#E0E4EB] rounded-full px-3 py-1">Демо-данные</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
                    <div className="bg-[#FBF1D6] rounded-[16px] p-6 flex items-center gap-4">
                        <span className="text-4xl">🌟</span>
                        <div>
                            <div className="text-3xl font-bold text-[#1A1D2D]">{totalPoints(DEMO_ME)}</div>
                            <div className="text-sm font-semibold text-[#1A1D2D]">Мои баллы</div>
                            <div className="text-xs text-[#6B7280]">За все курсы</div>
                        </div>
                    </div>
                    <div className="bg-[#E3F3F3] rounded-[16px] p-6 flex items-center gap-4">
                        <span className="text-4xl">🏅</span>
                        <div>
                            <div className="text-3xl font-bold text-[#1A1D2D]">
                                {received} <span className="text-lg text-[#6B7280]">из {DEMO_ACHIEVEMENTS.length}</span>
                            </div>
                            <div className="text-sm font-semibold text-[#1A1D2D]">Наград получено</div>
                            <div className="text-xs text-[#6B7280]">Есть чем гордиться!</div>
                        </div>
                    </div>
                    <div className="bg-[#E6F1FA] rounded-[16px] p-6 flex flex-col justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <span className="text-3xl">{group.emoji}</span>
                            <div>
                                <div className="text-sm font-semibold text-[#1A1D2D]">Моя группа — {group.name}</div>
                                <div className="text-xs text-[#6B7280]">Твои баллы помогают команде</div>
                            </div>
                        </div>
                        <Link to="/student/rating" className="flex items-center gap-1 text-sm font-semibold text-[#734DE6] hover:underline">
                            К рейтингу групп <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>
                </div>

                <div className="flex items-center justify-between mb-4">
                    <h2 className="flex items-center gap-2 text-xl font-bold text-[#1A1D2D]">
                        <Award className="w-5 h-5 text-[#734DE6]" /> Коллекция наград
                    </h2>
                    <div className="flex bg-[#EEF0F4] rounded-[10px] p-1">
                        {FILTERS.map(f => (
                            <button
                                key={f.id}
                                onClick={() => setFilter(f.id)}
                                className={`px-3 py-1.5 rounded-[8px] text-sm font-medium ${
                                    filter === f.id ? 'bg-white text-[#734DE6] shadow-sm' : 'text-[#6B7280]'
                                }`}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
                    {visible.map(a => (
                        <div key={a.title} className="bg-white rounded-[16px] border border-[#EEF0F4] p-3 flex flex-col">
                            <div className={`relative ${a.tint} rounded-[12px] h-24 flex items-center justify-center text-4xl mb-4`}>
                                <span className={a.receivedAt ? '' : 'opacity-70'}>{a.emoji}</span>
                                {a.receivedAt ? (
                                    <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[#22C55E] flex items-center justify-center">
                                        <Check className="w-3 h-3 text-white" strokeWidth={3} />
                                    </span>
                                ) : (
                                    <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-white flex items-center justify-center">
                                        <Lock className="w-3 h-3 text-[#6B7280]" />
                                    </span>
                                )}
                            </div>
                            <div className="px-1 flex-1 flex flex-col">
                                <div className="font-semibold text-[#1A1D2D] mb-1">{a.title}</div>
                                <div className="text-sm text-[#6B7280] mb-6">{a.description}</div>
                                <div className="mt-auto">
                                    {a.receivedAt ? (
                                        <div className="flex items-center gap-1 text-xs font-semibold text-[#16A34A]">
                                            <Check className="w-3.5 h-3.5" /> Получено · {a.receivedAt}
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex justify-between text-xs text-[#6B7280] mb-1.5">
                                                <span>Впереди</span>
                                                <span>{a.progress![0]} / {a.progress![1]}</span>
                                            </div>
                                            <div className="h-1.5 rounded-full bg-[#3CC6D0]/70 overflow-hidden">
                                                <div
                                                    className="h-full bg-[#734DE6] rounded-full"
                                                    style={{ width: `${(a.progress![0] / a.progress![1]) * 100}%` }}
                                                />
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-8">
                    <section>
                        <h2 className="text-lg font-bold text-[#1A1D2D] mb-3">Последние баллы</h2>
                        <ul>
                            {DEMO_RECENT_POINTS.map(r => (
                                <li key={r.task} className="flex items-center gap-3 py-3 border-b border-[#EEF0F4] last:border-0">
                                    <span className="w-8 h-8 rounded-[8px] bg-[#FFF3D6] flex items-center justify-center">
                                        <Star className="w-4 h-4 text-[#6B4E16]" />
                                    </span>
                                    <div className="flex-1">
                                        <div className="text-sm font-semibold text-[#1A1D2D]">{r.task}</div>
                                        <div className="text-xs text-[#6B7280]">{r.meta}</div>
                                    </div>
                                    <span className="font-bold text-[#16A34A]">+{r.points}</span>
                                </li>
                            ))}
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold text-[#1A1D2D] mb-3">Следующая цель</h2>
                        <div className="flex gap-3">
                            <span className="text-2xl">{next.emoji}</span>
                            <div>
                                <div className="text-sm font-semibold text-[#1A1D2D]">{next.title}</div>
                                <div className="text-xs text-[#6B7280] mb-3">
                                    Ещё {next.progress![1] - next.progress![0]} урока до новой награды
                                </div>
                                <button
                                    onClick={() => navigate('/student')}
                                    className="flex items-center gap-1.5 bg-[#734DE6] text-white px-4 py-2 rounded-[10px] text-sm font-medium hover:bg-[#5a3eb8]"
                                >
                                    Продолжить учиться <ArrowRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-[#6B7280] mt-4">
                            <Users className="w-3.5 h-3.5" /> У каждого свой темп. Продолжай свой путь!
                        </div>
                    </section>
                </div>
            </main>
        </div>
    );
};

export default AchievementsPage;
