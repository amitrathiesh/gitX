import { useState, useRef, useEffect, useCallback } from 'react';

export const useGeminiTerminal = (terminalRef, project, onToggleMode) => {
    const [aiMode, setAiMode] = useState(false);
    const aiModeRef = useRef(false);
    const inputBufferRef = useRef('');

    // Keep ref in sync
    useEffect(() => {
        aiModeRef.current = aiMode;
    }, [aiMode]);

    const handleToggleAiMode = useCallback((overrideMode = null) => {
        const newMode = overrideMode !== null ? overrideMode : !aiModeRef.current;
        setAiMode(newMode);
        aiModeRef.current = newMode;

        if (onToggleMode) onToggleMode(newMode);

        const term = terminalRef.current;
        if (term) {
            try {
                // Update cursor color - can trigger xterm refresh
                term.options.theme = {
                    ...term.options.theme,
                    cursor: newMode ? '#a855f7' : '#ffffff'
                };
            } catch (e) {
                console.warn('[useGeminiTerminal] Theme update error:', e);
            }

            if (newMode) {
                term.write('\r\n\x1b[36mGemini: Type your question and press Enter\x1b[0m\r\n');
                term.write('\x1b[36m❯\x1b[0m ');
            } else {
                term.write('\r\n\x1b[36mNormal Mode\x1b[0m\r\n');
            }

            try {
                term.focus();
            } catch (e) {
                console.warn('[useGeminiTerminal] Focus error:', e);
            }
        }
        inputBufferRef.current = '';
    }, [terminalRef, onToggleMode]);

    const handleAiQuery = async (query) => {
        const term = terminalRef.current;
        if (!term || !window.electronAPI) return;

        term.write(`\x1b[36mQuerying Gemini...\x1b[0m\r\n`);

        try {
            const { available } = await window.electronAPI.checkGeminiAvailable();

            if (!available) {
                term.write('\x1b[31mError: Gemini CLI not installed\x1b[0m\r\n');
                term.write('\x1b[36m❯\x1b[0m ');
                return;
            }

            // Build context
            const context = {
                projectType: project?.type || 'unknown',
                projectName: project?.name,
                projectPath: project?.path,
            };

            // Streaming setup
            const streamingBufferRef = { current: '' };
            const fullResponseRef = { current: '' };
            let isStreaming = false;
            let streamInterval = null;

            const processStreamBuffer = () => {
                console.log('[processStreamBuffer] Called. Buffer length:', streamingBufferRef.current?.length || 0, 'isStreaming:', isStreaming);

                if (!streamingBufferRef.current) {
                    if (!isStreaming && streamInterval) {
                        console.log('[processStreamBuffer] Stream complete, cleaning up');
                        clearInterval(streamInterval);
                        streamInterval = null;

                        // Check for execution command
                        const fullText = fullResponseRef.current;
                        const match = fullText.match(/<<<EXECUTE: (.*?)>>>/);

                        if (match) {
                            const command = match[1];
                            term.write(`\r\n\x1b[36mAuto-Running: ${command}\x1b[0m\r\n`);
                            setTimeout(() => {
                                handleToggleAiMode(false); // Switch to normal mode to run
                                if (window.electronAPI.executeCommand) {
                                    window.electronAPI.executeCommand(command, context.projectPath);
                                    // Trigger status check
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

                const bufferLength = streamingBufferRef.current.length;
                const chunkSize = Math.max(1, Math.floor(bufferLength / 50));
                const chunk = streamingBufferRef.current.slice(0, chunkSize);
                streamingBufferRef.current = streamingBufferRef.current.slice(chunkSize);

                console.log('[processStreamBuffer] Writing chunk of size:', chunk.length, 'Preview:', chunk.substring(0, 30));
                term.write(chunk);
                console.log('[processStreamBuffer] Write complete. Remaining buffer:', streamingBufferRef.current.length);
            };

            const handleData = (data) => {
                console.log('[useGeminiTerminal] Received chunk:', data.length, data.substring(0, 100));
                if (!isStreaming) {
                    term.write('\r\x1b[K'); // Clear "Querying..."
                    isStreaming = true;
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
            };

            const cleanup = () => {
                if (window.electronAPI.removeAllGeminiListeners) {
                    window.electronAPI.removeAllGeminiListeners();
                }
            };

            cleanup();
            console.log('[handleAiQuery] Attaching Gemini listeners...');
            window.electronAPI.onGeminiData(handleData);
            window.electronAPI.onGeminiError(handleError);
            window.electronAPI.onGeminiComplete(handleComplete);

            console.log('[handleAiQuery] Sending query to Gemini:', query);
            window.electronAPI.queryGemini(query, context);

        } catch (error) {
            term.write(`\x1b[31mError: ${error.message || error}\x1b[0m\r\n`);
            term.write('\x1b[36m❯\x1b[0m ');
        }
    };

    const handleData = useCallback((data) => {
        const term = terminalRef.current;
        if (!term) return;

        // AI Mode Interception
        if (aiModeRef.current) {
            const firstCode = data.charCodeAt(0);

            // Enter
            if (firstCode === 13) {
                const query = inputBufferRef.current.trim();
                if (query) {
                    term.write('\r\n');
                    handleAiQuery(query);
                    inputBufferRef.current = '';
                } else {
                    term.write('\r\n\x1b[35m❯\x1b[0m ');
                }
                return;
            }

            // Backspace
            if (firstCode === 127 || firstCode === 8) {
                if (inputBufferRef.current.length > 0) {
                    inputBufferRef.current = inputBufferRef.current.slice(0, -1);
                    term.write('\b \b');
                }
                return;
            }

            // Ctrl+C
            if (firstCode === 3) {
                inputBufferRef.current = '';
                term.write('^C\r\n\x1b[35m❯\x1b[0m ');
                return;
            }

            if (firstCode < 32) return;

            inputBufferRef.current += data;
            term.write(data);
        } else {
            // Normal Mode: Send to backend
            // Caller should handle this or we return a flag indicating "not handled"
            if (window.electronAPI && window.electronAPI.sendProjectInput && project) {
                window.electronAPI.sendProjectInput(project.path, data);
            }
        }
    }, [terminalRef, project]);

    return {
        aiMode,
        handleToggleAiMode,
        handleData
    };
};
