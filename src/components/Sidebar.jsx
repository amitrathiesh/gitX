import React from 'react';
import { LayoutGrid, Settings, Terminal, Moon, Sun, GitBranch } from 'lucide-react';

const Sidebar = ({ activeView, onViewChange, theme, onToggleTheme }) => {
    return (
        <div className="w-64 h-full flex flex-col border-r border-slate-200 dark:border-white/5 bg-slate-100/90 dark:bg-slate-900/50 backdrop-blur-xl transition-colors duration-300">
            {/* Title Bar Area (Draggable) */}
            <div className="h-16 flex items-center px-6 draggable select-none border-b border-slate-200 dark:border-white/5">
                <div className="flex items-center gap-2 text-primary ml-16">
                    <div className="p-1.5 bg-primary/20 rounded-lg">
                        <GitBranch size={20} className="text-primary" />
                    </div>
                    <span className="font-bold text-lg tracking-tight text-slate-800 dark:text-white">GitX</span>
                </div>
            </div>

            {/* Navigation */}
            <div className="flex-1 py-6 px-3 flex flex-col gap-1">
                <NavButton
                    icon={<LayoutGrid size={20} />}
                    label="Projects"
                    active={activeView === 'projects'}
                    onClick={() => onViewChange('projects')}
                />
                <NavButton
                    icon={<Terminal size={20} />}
                    label="Terminal"
                    active={activeView === 'terminal'}
                    onClick={() => onViewChange('terminal')}
                />
                <NavButton
                    icon={<Settings size={20} />}
                    label="Settings"
                    active={activeView === 'settings'}
                    onClick={() => onViewChange('settings')}
                />
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-white/5">
                <button
                    onClick={onToggleTheme}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5 transition-all duration-200"
                >
                    {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
                    <span className="text-sm font-medium">
                        {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
                    </span>
                </button>
            </div>
        </div>
    );
};

const NavButton = ({ icon, label, active, onClick }) => (
    <button
        onClick={onClick}
        className={`
            w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group relative overflow-hidden
            ${active
                ? 'bg-primary/10 text-primary'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'}
        `}
    >
        {active && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary rounded-r-full shadow-[0_0_10px_rgba(124,58,237,0.5)]" />
        )}
        <span className="relative z-10">{icon}</span>
        <span className="text-sm font-medium relative z-10">{label}</span>
    </button>
);

export default Sidebar;
