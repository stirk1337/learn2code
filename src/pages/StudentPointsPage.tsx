import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Star, Trophy, Users } from 'lucide-react';
import TopNav from '@/components/layout/TopNav';
import { CourseSelect } from '@/pages/GroupRatingPage';
import { DEMO_COURSES, DEMO_GROUPS, DEMO_STUDENTS, totalPoints } from '@/utils/demoPoints';

const StudentPointsPage: React.FC = () => {
    const navigate = useNavigate();
    const [courseId, setCourseId] = useState(DEMO_COURSES[0].id);
    const [groupId, setGroupId] = useState('all');
    const [query, setQuery] = useState('');

    const students = DEMO_STUDENTS.filter(s =>
        (groupId === 'all' || s.groupId === groupId) &&
        s.name.toLowerCase().includes(query.trim().toLowerCase())
    );
    const sum = students.reduce((a, s) => a + (s.points[courseId] ?? 0), 0);

    return (
        <div className="min-h-screen bg-[#F8FAFB]">
            <TopNav />

            <main className="max-w-6xl mx-auto px-4 py-8">
                <div className="flex items-start justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-[#1A1D2D] mb-2">Баллы учеников</h1>
                        <p className="text-[#6B7280]">Личный прогресс и вклад в результат группы</p>
                    </div>
                    <button
                        onClick={() => navigate('/teacher/rating')}
                        className="flex items-center gap-2 bg-white border border-[#E0E4EB] rounded-[10px] px-3 py-2 text-sm font-medium text-[#1A1D2D] hover:bg-gray-50"
                    >
                        <Trophy className="w-4 h-4" /> Рейтинг групп
                    </button>
                </div>

                <div className="flex flex-wrap items-end gap-3 mb-4">
                    <label className="flex flex-col gap-1.5 text-xs font-medium text-[#6B7280]">
                        Курс
                        <CourseSelect value={courseId} onChange={setCourseId} />
                    </label>
                    <label className="flex flex-col gap-1.5 text-xs font-medium text-[#6B7280]">
                        Группа
                        <select
                            value={groupId}
                            onChange={e => setGroupId(e.target.value)}
                            className="bg-white border border-[#E0E4EB] rounded-[10px] px-3 py-2 text-sm text-[#1A1D2D] min-w-[140px] focus:outline-none focus:border-[#734DE6]"
                        >
                            <option value="all">Все группы</option>
                            {DEMO_GROUPS.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                        </select>
                    </label>
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            placeholder="Найти ученика"
                            className="w-full bg-white border border-[#E0E4EB] rounded-[10px] pl-9 pr-3 py-2 text-sm text-[#1A1D2D] focus:outline-none focus:border-[#734DE6]"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                    <div className="bg-[#E3F3F3] rounded-[16px] px-5 py-4 flex items-center gap-4">
                        <Users className="w-5 h-5 text-[#1BA3AE]" />
                        <div>
                            <div className="text-xl font-bold text-[#1A1D2D]">{students.length}</div>
                            <div className="text-xs text-[#6B7280]">Учеников в выборке</div>
                        </div>
                    </div>
                    <div className="bg-[#FBF1D6] rounded-[16px] px-5 py-4 flex items-center gap-4">
                        <Star className="w-5 h-5 text-[#1A1D2D]" />
                        <div>
                            <div className="text-xl font-bold text-[#1A1D2D]">{sum}</div>
                            <div className="text-xs text-[#6B7280]">Баллов в выбранном курсе</div>
                        </div>
                    </div>
                </div>

                <p className="text-xs text-[#9CA3AF] mb-3">Демо-данные · список учеников без индивидуального рейтинга</p>

                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left text-xs text-[#6B7280] border-b border-[#EEF0F4]">
                            <th className="font-medium py-3 px-2">Ученик</th>
                            <th className="font-medium py-3">Группа</th>
                            <th className="font-medium py-3 text-right">Баллы в курсе</th>
                            <th className="font-medium py-3 px-2 text-right">За все курсы</th>
                        </tr>
                    </thead>
                    <tbody>
                        {students.map(s => (
                            <tr key={s.id} className="border-b border-[#EEF0F4]">
                                <td className="py-3 px-2">
                                    <div className="flex items-center gap-3">
                                        <span className="w-9 h-9 rounded-[10px] bg-[#EEF0F4] flex items-center justify-center text-lg">{s.avatar}</span>
                                        <span className="font-semibold text-[#1A1D2D]">{s.name}</span>
                                    </div>
                                </td>
                                <td className="py-3 text-[#1A1D2D]">{DEMO_GROUPS.find(g => g.id === s.groupId)?.name}</td>
                                <td className="py-3 text-right font-bold text-[#734DE6]">{s.points[courseId] ?? 0}</td>
                                <td className="py-3 px-2 text-right font-bold text-[#1A1D2D]">{totalPoints(s)}</td>
                            </tr>
                        ))}
                        {students.length === 0 && (
                            <tr>
                                <td colSpan={4} className="py-8 text-center text-[#6B7280]">Никого не нашлось</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </main>
        </div>
    );
};

export default StudentPointsPage;
