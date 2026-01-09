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
    const aiModeRef = useRef(false);
    const [currentInput, setCurrentInput] = useState('');
    const inputBufferRef = useRef('');

    // Keep ref in sync
    useEffect(() => {
        aiModeRef.current = aiMode;
    }, [aiMode]);

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
            fitAddon.fit();
        }, 100);

        xtermRef.current = term;
        fitAddonRef.current = fitAddon;

        // Start persistent shell
        if (window.electronAPI && window.electronAPI.startShell) {
            window.electronAPI.startShell(project.path);
        }

        // Show AI mode indicator (initial check)
        if (aiModeRef.current) {
            term.write('\r\n\x1b[36mGemini: Type your question and press Enter\x1b[0m\r\n');
            term.write('\x1b[36m❯\x1b[0m ');
        }

        // Listen for terminal output from project (backend shell or process)
        const handleOutput = (data) => {
            console.log('[GlobalTerminal] Output:', data);
            if (!aiModeRef.current && data.projectId === project?.path) {
                term.write(data.data);
            }
        };

        const handleData = (data) => {
            // Priority: AI Mode intercepts all input
            if (aiModeRef.current) {
                // Check first character code for special handling
                const firstCode = data.charCodeAt(0);

                // Enter key
                if (firstCode === 13) {
                    const query = inputBufferRef.current.trim();
                    if (query) {
                        term.write('\r\n');
                        // Call AI handler
                        const termRef = xtermRef.current; // access term via ref if needed, or closure term
                        handleAiQuery(query, term);
                        inputBufferRef.current = '';
                    } else {
                        term.write('\r\n\x1b[35m❯\x1b[0m ');
                    }
                    return;
                }

                // Backspace/Delete (Simple local echo handling)
                if (firstCode === 127 || firstCode === 8) {
                    if (inputBufferRef.current.length > 0) {
                        inputBufferRef.current = inputBufferRef.current.slice(0, -1);
                        term.write('\b \b');
                    }
                    return;
                }

                // Ctrl+C (Abort AI input)
                if (firstCode === 3) {
                    inputBufferRef.current = '';
                    term.write('^C\r\n\x1b[35m❯\x1b[0m ');
                    return;
                }

                // Ignore other control characters
                if (firstCode < 32) return;

                // Local echo for AI input
                inputBufferRef.current += data;
                term.write(data);
            } else {
                // Normal Mode: Send input to backend shell
                if (window.electronAPI && window.electronAPI.sendInput) {
                    window.electronAPI.sendInput(data);
                }
            }
        };

        term.onData(handleData);

        if (window.electronAPI) {
            window.electronAPI.onTerminalOutput(handleOutput);
        }

        const handleResize = () => {
            if (fitAddonRef.current) {
                fitAddonRef.current.fit();
            }
        };

        window.addEventListener('resize', handleResize);
        const resizeObserver = new ResizeObserver(() => handleResize());
        if (terminalRef.current) {
            resizeObserver.observe(terminalRef.current);
        }

        return () => {
            term.dispose();
            window.removeEventListener('resize', handleResize);
            resizeObserver.disconnect();
            if (window.electronAPI.removeTerminalListener) {
                window.electronAPI.removeTerminalListener();
            }
        };
    }, [project.path]);

    const handleAiQuery = async (query, term) => {
        if (!window.electronAPI) return;

        term.write(`\x1b[36mQuerying Gemini...\x1b[0m\r\n`);

        try {
            const { available } = await window.electronAPI.checkGeminiAvailable();

            if (!available) {
                term.write('\x1b[31mError: Gemini CLI not installed\x1b[0m\r\n');
                term.write('\x1b[36m❯\x1b[0m ');
                return;
            }

            // Build context from project and recent terminal logs
            const context = {
                projectType: project?.type || 'unknown',
                projectName: project?.name,
                projectPath: project?.path,
            };

            // Set up steaming listeners
            const streamingBufferRef = { current: '' };
            const fullResponseRef = { current: '' };
            let isStreaming = false;
            let streamInterval = null;

            const processStreamBuffer = () => {
                if (!streamingBufferRef.current) {
                    if (!isStreaming && streamInterval) {
                        clearInterval(streamInterval);
                        streamInterval = null;
                        // Check for execution command at the end of stream
                        const fullText = fullResponseRef.current;
                        const match = fullText.match(/<<<EXECUTE: (.*?)>>>/);

                        if (match) {
                            const command = match[1];
                            term.write(`\r\n\x1b[36mAuto-Running: ${command}\x1b[0m\r\n`);
                            // Small delay to let user see the message
                            setTimeout(() => {
                                handleToggleAiMode(false); // Force switch to normal mode explicit
                                if (window.electronAPI.executeCommand) {
                                    window.electronAPI.executeCommand(command, context.projectPath);

                                    // Trigger status check after 3 seconds (allow server boot time)
                                    if (window.electronAPI.checkAllStatuses) {
                                        setTimeout(() => window.electronAPI.checkAllStatuses(), 3000);
                                    }
                                }
                            }, 800);
                        } else {
                            term.write('\r\n\r\n\x1b[36m❯\x1b[0m ');
                        }

                        cleanup();
                    }
                    return;
                }

                // Adaptive typing speed: if buffer is huge, type faster, but generally slower
                const bufferLength = streamingBufferRef.current.length;
                const chunkSize = Math.max(1, Math.floor(bufferLength / 50)); // Type ~2% of buffer per frame, min 1 char

                // Get chunk to write
                const chunk = streamingBufferRef.current.slice(0, chunkSize);
                streamingBufferRef.current = streamingBufferRef.current.slice(chunkSize);

                term.write(chunk);
            };

            const handleData = (data) => {
                if (!isStreaming) {
                    // Start streaming loop on first data
                    term.write('\r\x1b[K'); // Clear "Querying..."
                    isStreaming = true;
                    // Run loop every 30ms (approx 33fps) for smoother, slower reading speed
                    streamInterval = setInterval(processStreamBuffer, 30);
                }

                streamingBufferRef.current += data;
                fullResponseRef.current += data;
            };

            const handleError = (error) => {
                if (streamInterval) clearInterval(streamInterval);
                term.write(`\r\n\x1b[31mError: ${error}\x1b[0m\r\n`);
                term.write('\x1b[36m❯\x1b[0m ');
                cleanup();
            };

            const handleComplete = () => {
                isStreaming = false;
                // Don't cleanup immediately, let the buffer drain in the interval loop
            };

            const cleanup = () => {
                if (window.electronAPI.removeAllGeminiListeners) {
                    window.electronAPI.removeAllGeminiListeners();
                } else {
                    // Fallback for safety if reload hasn't happened yet
                    if (window.electronAPI.onGeminiData) window.electronAPI.onGeminiData(() => { });
                    if (window.electronAPI.onGeminiError) window.electronAPI.onGeminiError(() => { });
                    if (window.electronAPI.onGeminiComplete) window.electronAPI.onGeminiComplete(() => { });
                }
            };

            // Remove any existing listeners first
            cleanup();

            // Attach listeners
            window.electronAPI.onGeminiData(handleData);
            window.electronAPI.onGeminiError(handleError);
            window.electronAPI.onGeminiComplete(handleComplete);

            // Start query (non-blocking)
            window.electronAPI.queryGemini(query, context);

        } catch (error) {
            term.write(`\x1b[31mError: ${error.message || error}\x1b[0m\r\n`);
            term.write('\x1b[36m❯\x1b[0m ');
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

    const handleToggleAiMode = (overrideMode = null) => {
        const newMode = overrideMode !== null ? overrideMode : !aiMode;
        setAiMode(newMode);
        aiModeRef.current = newMode;

        if (xtermRef.current) {
            // Don't clear history! Let it persist.
            if (newMode) {
                xtermRef.current.write('\r\n\x1b[36mGemini: Type your question and press Enter\x1b[0m\r\n');
                xtermRef.current.write('\x1b[36m❯\x1b[0m ');
            } else {
                // Returning to shell
                xtermRef.current.write('\r\n\x1b[36mNormal Mode\x1b[0m\r\n');
            }
            xtermRef.current.focus(); // Auto-focus terminal
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
                        onClick={() => handleToggleAiMode()}
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
            <div ref={terminalRef} className="flex-1 overflow-hidden bg-black" />
        </div>
    );
};

export default GlobalTerminal;
