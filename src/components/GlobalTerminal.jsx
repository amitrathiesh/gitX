import React, { useState, useEffect, useRef } from 'react';
import { Terminal, X, Trash2, Sparkles } from 'lucide-react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

const GlobalTerminal = ({ project, isVisible, onClose }) => {
    const terminalRef = useRef(null);
    const xtermRef = useRef(null);
    const fitAddonRef = useRef(null);
    const [aiMode, setAiMode] = useState(false);
    const [currentInput, setCurrentInput] = useState('');
    const inputBufferRef = useRef('');

    useEffect(() => {
        if (!terminalRef.current) return;

        // Initialize xterm
        const term = new XTerm({
            cursorBlink: true,
            theme: {
                background: '#0f172a',
                foreground: '#e2e8f0',
                cursor: aiMode ? '#a855f7' : '#64748b',
            },
            fontSize: 12,
            fontFamily: 'Menlo, Monaco, "Courier New", monospace',
            rows: 30,
            cols: 80,
            scrollback: 1000,
            convertEol: true,
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.open(terminalRef.current);

        setTimeout(() => {
            fitAddon.fit();
        }, 100);

        xtermRef.current = term;
        fitAddonRef.current = fitAddon;

        // Show AI mode indicator
        if (aiMode) {
            term.write('\r\n\x1b[35m[AI Mode Active - Type your question and press Enter]\x1b[0m\r\n');
            term.write('\x1b[35m❯\x1b[0m ');
        }

        // Listen for terminal output from project
        const handleOutput = (data) => {
            if (!aiMode && data.projectId === project?.path) {
                term.write(data.data);
            }
        };

        // Handle user input in AI mode
        const handleKey = (e) => {
            if (!aiMode) return;

            const char = e.key;

            if (e.domEvent.key === 'Enter') {
                const query = inputBufferRef.current.trim();
                if (query) {
                    term.write('\r\n');
                    handleAiQuery(query, term);
                    inputBufferRef.current = '';
                } else {
                    term.write('\r\n\x1b[35m❯\x1b[0m ');
                }
            } else if (e.domEvent.key === 'Backspace') {
                if (inputBufferRef.current.length > 0) {
                    inputBufferRef.current = inputBufferRef.current.slice(0, -1);
                    term.write('\b \b');
                }
            } else if (char && char.length === 1 && !e.domEvent.ctrlKey && !e.domEvent.metaKey) {
                inputBufferRef.current += char;
                term.write(char);
            }
        };

        term.onKey(handleKey);

        if (window.electronAPI) {
            window.electronAPI.onTerminalOutput(handleOutput);
        }

        const handleResize = () => {
            if (fitAddonRef.current) {
                fitAddonRef.current.fit();
            }
        };

        window.addEventListener('resize', handleResize);

        return () => {
            term.dispose();
            window.removeEventListener('resize', handleResize);
        };
    }, [project, aiMode]);

    const handleAiQuery = async (query, term) => {
        if (!window.electronAPI) return;

        term.write(`\x1b[36mQuerying Gemini...\x1b[0m\r\n`);

        try {
            const { available } = await window.electronAPI.checkGeminiAvailable();

            if (!available) {
                term.write('\x1b[31mError: Gemini CLI not installed\x1b[0m\r\n');
                term.write('\x1b[35m❯\x1b[0m ');
                return;
            }

            // Build context from project and recent terminal logs
            const context = {
                projectType: project?.type || 'unknown',
                projectName: project?.name,
                projectPath: project?.path, // Add full path for sandboxing
                // Could add recent error logs here in future
            };

            // Query Gemini
            const response = await window.electronAPI.queryGemini(query, context);

            // Write AI response in purple
            term.write(`\x1b[35m${response}\x1b[0m\r\n\r\n`);
            term.write('\x1b[35m❯\x1b[0m ');
        } catch (error) {
            term.write(`\x1b[31mError: ${error.message || error}\x1b[0m\r\n`);
            term.write('\x1b[35m❯\x1b[0m ');
        }
    };

    const handleClear = () => {
        if (xtermRef.current) {
            xtermRef.current.clear();
            if (aiMode) {
                xtermRef.current.write('\x1b[35m[AI Mode Active]\x1b[0m\r\n\x1b[35m❯\x1b[0m ');
            }
        }
    };

    const handleToggleAiMode = () => {
        const newMode = !aiMode;
        setAiMode(newMode);

        if (xtermRef.current) {
            xtermRef.current.clear();
            if (newMode) {
                xtermRef.current.write('\r\n\x1b[35m[AI Mode Active - Type your question and press Enter]\x1b[0m\r\n');
                xtermRef.current.write('\x1b[35m❯\x1b[0m ');
            }
        }

        inputBufferRef.current = '';
    };

    if (!isVisible) return null;

    return (
        <div className="h-full flex flex-col bg-card border-l border-border">
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-border bg-secondary/30">
                <div className="flex items-center gap-2">
                    <Terminal size={16} className="text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">
                        {project ? project.name : 'Terminal'}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    {/* AI Mode Toggle */}
                    <button
                        onClick={handleToggleAiMode}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${aiMode
                            ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                            : 'bg-secondary text-muted-foreground hover:bg-secondary/80'
                            }`}
                        title="Toggle AI Mode"
                    >
                        <Sparkles size={14} />
                        AI
                    </button>

                    <button
                        onClick={handleClear}
                        className="p-1.5 rounded hover:bg-secondary/80 text-muted-foreground"
                        title="Clear"
                    >
                        <Trash2 size={14} />
                    </button>

                    <button
                        onClick={onClose}
                        className="p-1.5 rounded hover:bg-secondary/80 text-muted-foreground"
                        title="Close Terminal"
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>

            {/* Terminal */}
            <div ref={terminalRef} className="flex-1 p-2" />
        </div>
    );
};

export default GlobalTerminal;
