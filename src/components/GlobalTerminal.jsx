import React, { useState, useEffect, useRef } from 'react';
import { Terminal, X, Trash2, Sparkles } from 'lucide-react';
import { Terminal as XTerm } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

import { useGeminiTerminal } from '../hooks/useGeminiTerminal';

const GlobalTerminal = ({ project, isVisible, onClose }) => {
    const terminalRef = useRef(null);
    const xtermRef = useRef(null);
    const fitAddonRef = useRef(null);

    // Use the hook
    const { aiMode, handleToggleAiMode, handleData } = useGeminiTerminal(xtermRef, project);

    // We still need local state if we want to bind UI buttons to hook state,
    // but the hook returns aiMode which is reactive.

    useEffect(() => {
        if (!terminalRef.current) return;

        // Initialize xterm
        const term = new XTerm({
            cursorBlink: true,
            theme: {
                background: '#0a0a0a', // Almost black
                foreground: '#ffffff', // Pure white
                cursor: aiMode ? '#a855f7' : '#ffffff',
                selection: '#5b5b5b',
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
            // Safety check for dimensions - only fit if visible and has width
            if (terminalRef.current && terminalRef.current.offsetParent && terminalRef.current.clientWidth > 0) {
                try {
                    fitAddon.fit();
                } catch (e) {
                    console.warn('[GlobalTerminal] Initial fit error:', e);
                }
            }
        }, 150);

        xtermRef.current = term;
        fitAddonRef.current = fitAddon;

        // Start persistent shell
        if (project && window.electronAPI && window.electronAPI.startShell) {
            window.electronAPI.startShell(project.path);
        }

        // Hook sync for initial AI mode if needed
        if (aiMode) {
            term.write('\r\n\x1b[36mGemini: Type your question and press Enter\x1b[0m\r\n');
            term.write('\x1b[36m❯\x1b[0m ');
        }

        // Listen for terminal output from project
        const handleOutput = (data) => {
            // Need to access current ref for aiMode check, or use the value from closure if it updates?
            // Since this effect runs on project change, aiMode might be stale if we don't use ref.
            // But useGeminiTerminal handles its own mode state. 
            // We can check xtermRef.current.aiMode if we set it.
            if (!xtermRef.current?.aiMode && data.projectId === project?.path) {
                term.write(data.data);
            }
        };

        // Input handling via Hook
        term.onData(handleData);

        // Listeners
        let unsubscribeLogs;
        if (window.electronAPI) {
            unsubscribeLogs = window.electronAPI.onTerminalOutput(handleOutput);
        }

        const handleResize = () => {
            if (fitAddonRef.current && terminalRef.current && terminalRef.current.offsetParent) {
                fitAddonRef.current.fit();
            }
        };

        window.addEventListener('resize', handleResize);
        const resizeObserver = new ResizeObserver(() => handleResize());
        if (terminalRef.current) {
            resizeObserver.observe(terminalRef.current);
        }

        return () => {
            // Cleanup
            if (unsubscribeLogs && typeof unsubscribeLogs === 'function') unsubscribeLogs();
            term.dispose();
            window.removeEventListener('resize', handleResize);
            resizeObserver.disconnect();
        };
    }, [project?.path]); // Removed handleData - it changes too often and causes terminal recreation

    // Sync AI mode to xterm instance for the handleOutput check
    useEffect(() => {
        if (xtermRef.current) {
            xtermRef.current.aiMode = aiMode;
        }
    }, [aiMode]);

    const handleClear = () => {
        if (xtermRef.current) {
            xtermRef.current.clear();
            if (aiMode) {
                xtermRef.current.write('\x1b[35m[AI Mode Active]\x1b[0m\r\n\x1b[35m❯\x1b[0m ');
            }
        }
    };

    // Use CSS to hide instead of unmounting to preserve history
    return (
        <div className={`h-full flex flex-col bg-slate-50 dark:bg-card border-l border-slate-200 dark:border-border ${!isVisible ? 'hidden' : ''}`}>
            {/* Header */}
            <div className="flex items-center justify-between p-3 border-b border-slate-200 dark:border-border bg-white/50 dark:bg-secondary/30 backdrop-blur-sm">
                <div className="flex items-center gap-2">
                    <Terminal size={16} className="text-slate-500 dark:text-muted-foreground" />
                    <span className="text-sm font-medium text-slate-700 dark:text-foreground">
                        {project ? project.name : 'Terminal'}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    {/* AI Mode Toggle */}
                    <button
                        onClick={() => handleToggleAiMode()}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-colors ${aiMode
                            ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-500/30'
                            : 'bg-white dark:bg-secondary text-slate-500 dark:text-muted-foreground hover:text-slate-900 dark:hover:text-foreground border border-slate-200 dark:border-transparent'
                            }`}
                        title="Toggle AI Mode"
                    >
                        <Sparkles size={14} />
                        AI
                    </button>

                    <button
                        onClick={handleClear}
                        className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-secondary/80 text-slate-500 dark:text-muted-foreground transition-colors"
                        title="Clear"
                    >
                        <Trash2 size={14} />
                    </button>

                    <button
                        onClick={onClose}
                        className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-secondary/80 text-slate-500 dark:text-muted-foreground transition-colors"
                        title="Close Terminal"
                    >
                        <X size={14} />
                    </button>
                </div>
            </div>

            {/* Terminal */}
            <div ref={terminalRef} className="flex-1 overflow-hidden bg-black pl-2 pt-2" />
        </div>
    );
};

export default GlobalTerminal;
