import React, { useState, useEffect, useRef } from 'react';
import { Sun, Moon, Terminal } from 'lucide-react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import GlobalTerminal from './components/GlobalTerminal';

function App() {
    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
    const [activeView, setActiveView] = useState('projects');
    const [selectedProject, setSelectedProject] = useState(null);

    const toggleTheme = () => {
        const newTheme = theme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
        localStorage.setItem('theme', newTheme);
        document.documentElement.classList.toggle('dark', newTheme === 'dark');
    };

    // Initialize theme
    useEffect(() => {
        document.documentElement.classList.toggle('dark', theme === 'dark');
    }, []);

    const handleProjectSelect = (project, switchToTerminal = false) => {
        setSelectedProject(project);
        if (switchToTerminal) {
            setActiveView('terminal');
        }
    };

    return (
        <div className="flex h-screen w-screen overflow-hidden bg-background text-foreground font-sans transition-colors duration-300">
            {/* Sidebar Navigation */}
            <Sidebar
                activeView={activeView}
                onViewChange={setActiveView}
                theme={theme}
                onToggleTheme={toggleTheme}
            />

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 h-full relative z-0">
                {/* Background Gradients/Glass effects */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-purple-500/5 pointer-events-none z-[-1]" />

                {activeView === 'projects' && (
                    <div className="flex-1 overflow-y-auto overflow-x-hidden p-8 animate-in fade-in slide-in-from-right-4 duration-300">
                        <header className="mb-8 flex items-center justify-between">
                            <div>
                                <h2 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-500 dark:from-white dark:to-slate-400">
                                    My Projects
                                </h2>
                                <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">Manage and monitor your local repositories</p>
                            </div>
                        </header>

                        <Dashboard onProjectSelect={handleProjectSelect} />
                    </div>
                )}

                {activeView === 'terminal' && (
                    <div className="flex-1 h-full p-6 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="h-full rounded-2xl border border-white/10 overflow-hidden shadow-2xl bg-black/50 backdrop-blur-md">
                            <GlobalTerminal
                                project={selectedProject}
                                isVisible={true}
                                onClose={() => setActiveView('projects')}
                            />
                        </div>
                    </div>
                )}

                {activeView === 'settings' && (
                    <div className="flex-1 p-8 flex items-center justify-center text-slate-500 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="text-center">
                            <h3 className="text-xl font-medium mb-2">Settings</h3>
                            <p>Configuration options coming soon.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default App;
