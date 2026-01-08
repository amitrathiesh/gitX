import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

const TerminalView = ({ projectId }) => {
    const terminalRef = useRef(null);
    const xtermRef = useRef(null);
    const fitAddonRef = useRef(null);

    useEffect(() => {
        if (!terminalRef.current) return;

        // Initialize xterm.js
        const term = new Terminal({
            theme: {
                background: '#0f172a', // Match app background
                foreground: '#e2e8f0',
            },
            fontSize: 12,
            fontFamily: 'Menlo, Monaco, "Courier New", monospace',
            cursorBlink: true,
            rows: 15, // Initial height
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);

        term.open(terminalRef.current);
        fitAddon.fit();

        xtermRef.current = term;
        fitAddonRef.current = fitAddon;

        // Listen for logs
        let unsubscribe;
        if (window.electronAPI) {
            unsubscribe = window.electronAPI.onTerminalOutput(({ projectId: pid, data }) => {
                if (pid === projectId) {
                    term.write(data);
                }
            });
        }

        const handleResize = () => fitAddon.fit();
        window.addEventListener('resize', handleResize);

        return () => {
            // Cleanup
            term.dispose();
            window.removeEventListener('resize', handleResize);
            // unsubscribe logic would go here if event listener returns one
        };
    }, [projectId]);

    return (
        <div className="w-full h-[250px] bg-[#0f172a] rounded-md overflow-hidden border border-border">
            <div ref={terminalRef} className="h-full w-full" />
        </div>
    );
};

export default TerminalView;
