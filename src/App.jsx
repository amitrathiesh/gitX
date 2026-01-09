import React, { useState, useEffect, useRef } from 'react';
import { Sun, Moon, Terminal } from 'lucide-react';
import Dashboard from './components/Dashboard';
import GlobalTerminal from './components/GlobalTerminal';

function App() {
    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
    const [selectedProject, setSelectedProject] = useState(null);
    const [terminalVisible, setTerminalVisible] = useState(false);
    const [terminalWidth, setTerminalWidth] = useState(500);
    const [isResizing, setIsResizing] = useState(false);

    const toggleTheme = () => {
        const newTheme = theme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
        localStorage.setItem('theme', newTheme);
        document.documentElement.classList.toggle('light', newTheme === 'light');
    };

    const handleProjectSelect = (project) => {
        setSelectedProject(project);
        setTerminalVisible(true);
    };

    const startResize = (e) => {
        setIsResizing(true);
        e.preventDefault();
    };

    useEffect(() => {
        const handleMouseMove = (e) => {
            if (!isResizing) return;

            const newWidth = window.innerWidth - e.clientX;
            if (newWidth >= 300 && newWidth <= 800) {
                setTerminalWidth(newWidth);
            }
        };

        const handleMouseUp = () => {
            setIsResizing(false);
        };

        if (isResizing) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing]);

    return (
        <div className={`h-screen overflow-hidden bg-background text-foreground font-sans flex flex-col ${theme}`}>
            {/* Draggable Title Bar */}
            <div className="h-10 bg-background/80 backdrop-blur-md border-b border-border sticky top-0 z-50 flex items-center justify-between pl-20 pr-4 draggable select-none">
                <div className="font-semibold text-sm tracking-tight flex items-center gap-2">
                    <span>GitX Manager</span>
                </div>
                <div className="flex items-center gap-2 non-draggable">
                    <button
                        onClick={() => setTerminalVisible(!terminalVisible)}
                        className={`p-1.5 rounded hover:bg-secondary/80 transition-colors ${terminalVisible ? 'text-primary' : 'text-muted-foreground'
                            }`}
                        title="Toggle Terminal"
                    >
                        <Terminal size={16} />
                    </button>
                    <button
                        onClick={toggleTheme}
                        className="p-1.5 rounded hover:bg-secondary/80 text-muted-foreground transition-colors"
                        title="Toggle Theme"
                    >
                        {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                    </button>
                </div>
            </div>

            <div className="flex flex-1 overflow-hidden">
                {/* Main Content */}
                <div className="flex-1 overflow-auto p-8">
                    <header className="mb-8">
                        <h2 className="text-2xl font-bold tracking-tight">Projects</h2>
                        <p className="text-muted-foreground mt-1">Manage all your local repositories from one place.</p>
                    </header>
                    <main>
                        <Dashboard onProjectSelect={handleProjectSelect} />
                    </main>
                </div>

                {/* Terminal Sidebar with Resize Handle */}
                {terminalVisible && (
                    <div className="relative h-full flex flex-col border-l border-border bg-card" style={{ width: `${terminalWidth}px` }}>
                        {/* Resize Handle */}
                        <div
                            className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 transition-colors z-50"
                            onMouseDown={startResize}
                            style={{ touchAction: 'none' }}
                        />
                        <GlobalTerminal
                            project={selectedProject}
                            isVisible={terminalVisible}
                            onClose={() => setTerminalVisible(false)}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}

export default App;
