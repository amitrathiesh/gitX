import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';
import { useGeminiTerminal } from '../hooks/useGeminiTerminal';

const TerminalView = ({ projectId, aiModeEnabled = false, project }) => {
    const terminalRef = useRef(null);
    const xtermRef = useRef(null);
    const fitAddonRef = useRef(null);

    // AI Hook
    const { aiMode, handleToggleAiMode, handleData, getAiHistory } = useGeminiTerminal(xtermRef, project);

    // Sync AI mode from props
    useEffect(() => {
        if (aiModeEnabled !== aiMode) {
            handleToggleAiMode(aiModeEnabled);
        }
    }, [aiModeEnabled, aiMode, handleToggleAiMode]);

    useEffect(() => {
        if (!terminalRef.current) return;

        let term = null;
        let fitAddon = null;
        let unsubscribeLogs = null;
        let resizeObserver = null;
        let isOpen = false;

        // Suppress xterm dimensions error globally
        const originalError = console.error;
        const errorHandler = (...args) => {
            const msg = args[0]?.toString() || '';
            // Suppress the specific dimensions error but log others
            if (msg.includes('dimensions') || msg.includes('Viewport')) {
                // Silently ignore this specific error
                return;
            }
            originalError.apply(console, args);
        };
        console.error = errorHandler;

        const tryOpenTerminal = () => {
            if (isOpen || !terminalRef.current) return;

            const container = terminalRef.current;
            const width = container.clientWidth;
            const height = container.clientHeight;

            // Additional check: ensure element is visible in DOM
            if (width === 0 || height === 0 || !container.offsetParent) {
                // Container not ready or hidden
                return;
            }

            try {
                // Initialize xterm.js
                term = new Terminal({
                    theme: {
                        background: '#000000',
                        foreground: '#e2e8f0',
                        cursor: '#ffffff'
                    },
                    fontSize: 12,
                    fontFamily: 'Menlo, Monaco, "Courier New", monospace',
                    cursorBlink: true,
                    rows: 15,
                    convertEol: true,
                });

                fitAddon = new FitAddon();
                term.loadAddon(fitAddon);

                // CRITICAL: Wrap open in try-catch in case viewport fails to initialize
                try {
                    term.open(container);
                    isOpen = true;
                } catch (openError) {
                    console.error('[TerminalView] term.open() failed:', openError);
                    // Dispose and retry later
                    if (term) {
                        try { term.dispose(); } catch (e) { }
                    }
                    term = null;
                    fitAddon = null;
                    // Retry after a longer delay
                    setTimeout(tryOpenTerminal, 500);
                    return;
                }

                // Fit after opening - increased timeout for safety
                setTimeout(() => {
                    try {
                        if (fitAddon && container.clientWidth > 0 && container.offsetParent) {
                            fitAddon.fit();
                        }
                    } catch (e) {
                        console.warn('[TerminalView] Fit error:', e);
                    }
                }, 150);

                xtermRef.current = term;
                fitAddonRef.current = fitAddon;

                // CRITICAL: Wait for xterm to fully initialize its viewport before ANY operations
                setTimeout(() => {
                    // Setup event handlers AFTER viewport is ready
                    if (window.electronAPI) {
                        // 1. Fetch History (shell output)
                        window.electronAPI.getProjectHistory(projectId).then(history => {
                            if (history && term) {
                                term.write(history);
                            }

                            // 2. Restore AI conversation history (if any) AFTER shell history
                            const aiHistory = getAiHistory();
                            if (aiHistory && term) {
                                setTimeout(() => term.write(aiHistory), 50);
                            }
                        });

                        // 3. Listen for new logs
                        unsubscribeLogs = window.electronAPI.onTerminalOutput(({ projectId: pid, data }) => {
                            if (pid === projectId && !xtermRef.current?.aiMode) {
                                term.write(data);
                            }
                        });

                        // 4. Handle User Input
                        term.onData((data) => {
                            handleData(data);
                        });
                    }
                }, 200); // Wait 200ms for viewport initialization
            } catch (e) {
                console.error('[TerminalView] Failed to open terminal:', e);
            }
        };

        // Use ResizeObserver to detect when container gets dimensions
        resizeObserver = new ResizeObserver(() => {
            if (!isOpen) {
                tryOpenTerminal();
            } else if (fitAddonRef.current && terminalRef.current) {
                try {
                    fitAddonRef.current.fit();
                } catch (e) {
                    // Ignore resize errors
                }
            }
        });

        if (terminalRef.current) {
            resizeObserver.observe(terminalRef.current);
        }

        // Try immediate open
        tryOpenTerminal();

        const handleResize = () => {
            if (fitAddonRef.current && terminalRef.current && terminalRef.current.offsetParent) {
                try {
                    fitAddonRef.current.fit();
                } catch (e) {
                    // Ignore
                }
            }
        };
        window.addEventListener('resize', handleResize);

        return () => {
            // Restore console.error
            console.error = originalError;

            if (unsubscribeLogs && typeof unsubscribeLogs === 'function') {
                unsubscribeLogs();
            }
            window.removeEventListener('resize', handleResize);
            if (resizeObserver) {
                resizeObserver.disconnect();
            }
            if (xtermRef.current) {
                try {
                    xtermRef.current.dispose();
                } catch (e) {
                    console.warn('[TerminalView] Dispose error:', e);
                }
                xtermRef.current = null;
            }
            if (fitAddonRef.current) {
                fitAddonRef.current = null;
            }
        };
    }, [projectId]); // Removed handleData from deps - causes terminal recreation

    // Keep ref sync for hook's log interception check
    useEffect(() => {
        if (xtermRef.current) {
            xtermRef.current.aiMode = aiMode;
        }
    }, [aiMode]);

    return (
        <div className="w-full h-[250px] bg-[#0f172a] rounded-md overflow-hidden border border-border">
            <div ref={terminalRef} className="h-full w-full" />
        </div>
    );
};

export default TerminalView;
