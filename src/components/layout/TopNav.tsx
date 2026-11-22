import React from 'react';
import { NavLink } from 'react-router-dom';
import { BookOpen, Award, Star, Trophy, LogOut } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { DEMO_ME, totalPoints } from '@/utils/demoPoints';
import closeTagIcon from '../../../public/closeTagIcon.svg';

const STUDENT_LINKS = [
    { to: '/student', label: 'Мои курсы', icon: BookOpen },
    { to: '/student/achievements', label: 'Достижения', icon: Award },
    { to: '/student/rating', label: 'Рейтинг групп', icon: Trophy },
];

const TEACHER_LINKS = [
    { to: '/teacher', label: 'Мои курсы', icon: BookOpen },
    { to: '/teacher/points', label: 'Баллы учеников', icon: Star },
    { to: '/teacher/rating', label: 'Рейтинг групп', icon: Trophy },
];

const TopNav: React.FC = () => {
    const { user, logout } = useAuthStore();
    const isStudent = user?.role === 'student';
    const links = isStudent ? STUDENT_LINKS : TEACHER_LINKS;

    return (
        <header className="bg-white border-b border-[#EEF0F4]">
            <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                    <div className="shrink-0 bg-[rgba(115,77,230,0.1)] rounded-[10px] p-2">
                        <img src={closeTagIcon} alt="Logo" className="w-5 h-5" />
                    </div>
                    <span className="hidden sm:inline font-semibold text-[#1A1D2D]">Learn2Code</span>
                </div>

                <nav className="flex items-center gap-1">
                    {links.map(({ to, label, icon: Icon }) => (
                        <NavLink
                            key={to}
                            to={to}
                            end
                            className={({ isActive }) =>
                                `flex items-center gap-1.5 px-3 py-2 rounded-[10px] text-sm font-medium whitespace-nowrap transition-colors ${
                                    isActive ? 'bg-[rgba(115,77,230,0.1)] text-[#734DE6]' : 'text-[#6B7280] hover:text-[#1A1D2D]'
                                }`
                            }
                        >
                            <Icon className="w-4 h-4" />
                            <span className="hidden md:inline">{label}</span>
                        </NavLink>
                    ))}
                </nav>

                <div className="flex items-center gap-3">
                    {isStudent ? (
                        <span className="flex items-center gap-1.5 whitespace-nowrap bg-[#FFF3D6] text-[#6B4E16] rounded-[10px] px-3 py-2 text-sm font-semibold">
                            <Star className="w-4 h-4" /> {totalPoints(DEMO_ME)}<span className="hidden sm:inline">баллов</span>
                        </span>
                    ) : (
                        <span className="text-sm font-medium text-[#1A1D2D]">
                            {user?.role === 'admin' ? 'Администратор' : 'Преподаватель'}
                        </span>
                    )}
                    <button onClick={logout} aria-label="Выйти" className="text-[#6B7280] hover:text-[#1A1D2D] transition-colors">
                        <LogOut className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </header>
    );
};

export default TopNav;
