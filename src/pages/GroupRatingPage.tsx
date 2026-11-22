import React, { useState } from 'react';
import { Star, Trophy, Users } from 'lucide-react';
import TopNav from '@/components/layout/TopNav';
import { useAuthStore } from '@/store/useAuthStore';
import { DEMO_COURSES, DEMO_GROUPS, DEMO_ME, DEMO_STUDENTS, groupPoints } from '@/utils/demoPoints';

export const CourseSelect: React.FC<{ value: string; onChange: (id: string) => void }> = ({ value, onChange }) => (
    <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="bg-white border border-[#E0E4EB] rounded-[10px] px-3 py-2 text-sm text-[#1A1D2D] min-w-[180px] focus:outline-none focus:border-[#734DE6]"
    >
        {DEMO_COURSES.map(c => (
            <option key={c.id} value={c.id}>{c.emoji} {c.title}</option>
        ))}
    </select>
);

const GroupRatingPage: React.FC = () => {
    const { user } = useAuthStore();
    const isStudent = user?.role === 'student';
    const [courseId, setCourseId] = useState(DEMO_COURSES[0].id);

    const rows = DEMO_GROUPS
        .map(g => ({
            ...g,
            members: DEMO_STUDENTS.filter(s => s.groupId === g.id).length,
            points: groupPoints(g.id, courseId),
        }))
        .sort((a, b) => b.points - a.points);
    const max = rows[0]?.points || 1;
    const myGroup = rows.find(r => r.id === DEMO_ME.groupId)!;
    const myPoints = DEMO_ME.points[courseId] ?? 0;

    return (
        <div className="min-h-screen bg-[#F8FAFB]">
            <TopNav />

            <main className="max-w-6xl mx-auto px-4 py-8">
                <div className="flex items-start justify-between gap-4 mb-6">
                    <div>
                        <div className="text-xs font-bold text-[#734DE6] uppercase tracking-wide mb-1">Вместе к новым победам</div>
                        <h1 className="text-3xl font-bold text-[#1A1D2D] mb-2">Рейтинг групп 🏆</h1>
                        <p className="text-[#6B7280]">Одна команда — общая копилка баллов.</p>
                    </div>
                    <label className="flex flex-col gap-1.5 text-xs font-medium text-[#6B7280]">
                        Курс
                        <CourseSelect value={courseId} onChange={setCourseId} />
                    </label>
                </div>

                <div className="bg-[#E3F3F3] rounded-[16px] px-6 py-5 flex items-center gap-4 mb-8">
                    <span className="text-3xl">🤝</span>
                    <div className="flex-1">
                        <div className="font-semibold text-[#1A1D2D]">Каждый вклад важен</div>
                        <div className="text-sm text-[#6B7280]">Баллы всех учеников складываются в результат группы. Побеждаем вместе!</div>
                    </div>
                    <span className="text-xs text-[#6B7280] border border-[#C9DCDC] rounded-full px-3 py-1">Демо-данные</span>
                </div>

                <h2 className="flex items-center gap-2 text-lg font-bold text-[#1A1D2D] mb-3">
                    <Trophy className="w-5 h-5" /> Командные результаты
                </h2>

                <table className="w-full text-sm mb-8">
                    <thead>
                        <tr className="text-left text-xs text-[#6B7280] border-b border-[#EEF0F4]">
                            <th className="font-medium py-3 px-3 w-28">Место</th>
                            <th className="font-medium py-3">Группа</th>
                            <th className="font-medium py-3">Участники</th>
                            <th className="font-medium py-3 px-3 text-right">Баллы в курсе</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((r, i) => {
                            const mine = isStudent && r.id === DEMO_ME.groupId;
                            return (
                                <tr key={r.id} className={`border-b border-[#EEF0F4] ${mine ? 'bg-[#E8F4F6]' : ''}`}>
                                    <td className="py-3 px-3">
                                        <span className={`w-8 h-8 rounded-[8px] flex items-center justify-center font-bold ${
                                            i === 0 ? 'bg-[#FBEFC8] text-[#6B4E16]' : 'bg-[#EEF0F4] text-[#6B7280]'
                                        }`}>
                                            {i + 1}
                                        </span>
                                    </td>
                                    <td className="py-3">
                                        <div className="flex items-center gap-3">
                                            <span className={`w-10 h-10 rounded-[10px] ${r.tint} flex items-center justify-center text-xl`}>{r.emoji}</span>
                                            <div>
                                                <div className="font-semibold text-[#1A1D2D]">{r.name}</div>
                                                {mine && <div className="text-xs text-[#1BA3AE]">Твоя команда</div>}
                                                <div className="h-1 w-20 rounded-full bg-[#EEF0F4] mt-1 overflow-hidden">
                                                    <div className={`h-full rounded-full ${r.bar}`} style={{ width: `${(r.points / max) * 100}%` }} />
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-3 text-[#6B7280]">
                                        <span className="flex items-center gap-1.5"><Users className="w-4 h-4" /> {r.members}</span>
                                    </td>
                                    <td className="py-3 px-3 text-right">
                                        <div className="text-xl font-bold text-[#1A1D2D]">{r.points}</div>
                                        <div className="text-xs text-[#6B7280]">баллов</div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                {isStudent && (
                    <div className="flex items-center gap-3 pt-6 border-t border-[#EEF0F4]">
                        <span className="w-9 h-9 rounded-[10px] bg-[#FFF3D6] flex items-center justify-center">
                            <Star className="w-4 h-4 text-[#6B4E16]" />
                        </span>
                        <div className="flex-1">
                            <div className="text-sm font-semibold text-[#1A1D2D]">Твой вклад в команду</div>
                            <div className="text-xs text-[#6B7280]">{myGroup.name} · баллы в выбранном курсе</div>
                        </div>
                        <div className="text-right">
                            <div className="text-[#734DE6] font-bold">
                                <span className="text-2xl">{myPoints}</span> баллов
                            </div>
                            <div className="text-xs text-[#6B7280]">из {myGroup.points} баллов команды</div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default GroupRatingPage;
