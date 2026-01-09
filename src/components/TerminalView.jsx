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

        const tryOpenTerminal = () => {
            if (isOpen || !terminalRef.current) return;

            const container = terminalRef.current;
            const width = container.clientWidth;
            const height = container.clientHeight;

            if (width === 0 || height === 0) {
                // Container not ready
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
                term.open(container);
                isOpen = true;

                // Fit after opening
                setTimeout(() => {
                    try {
                        if (fitAddon && container.clientWidth > 0) {
                            fitAddon.fit();
                        }
                    } catch (e) {
                        console.warn('[TerminalView] Fit error:', e);
                    }
                }, 100);

                xtermRef.current = term;
                fitAddonRef.current = fitAddon;

                // Setup event handlers
                if (window.electronAPI) {
                    // 1. Fetch History (shell output)
                    window.electronAPI.getProjectHistory(projectId).then(history => {
                        if (history && term) {
                            term.write(history);
                        }

                        // 2. Restore AI conversation history (if any)
                        const aiHistory = getAiHistory();
                        if (aiHistory && term) {
                            term.write(aiHistory);
                        }
                    });

                    // 2. Listen for new logs
                    unsubscribeLogs = window.electronAPI.onTerminalOutput(({ projectId: pid, data }) => {
                        if (pid === projectId && !xtermRef.current?.aiMode) {
                            term.write(data);
                        }
                    });

                    // 3. Handle User Input
                    term.onData((data) => {
                        handleData(data);
                    });
                }
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
