import React, { useState, useEffect } from 'react';
import { Play, Square, RefreshCw, Trash2, FolderOpen, Terminal as TerminalIcon } from 'lucide-react';
import TerminalView from './TerminalView';

const ProjectCard = ({ project, onRun, onStop, onDelete, onUpdate, onOpenFolder }) => {
    const [showTerminal, setShowTerminal] = useState(false);
    const [scripts, setScripts] = useState({});
    const [selectedScript, setSelectedScript] = useState('');
    const [branch, setBranch] = useState('');
    const [port, setPort] = useState(null);
    const [updating, setUpdating] = useState(false);

    useEffect(() => {
        if (window.electronAPI) {
            // Load scripts if node
            if (project.type === 'node') {
                window.electronAPI.getScripts(project).then(s => {
                    setScripts(s || {});
                    if (s && s.start) setSelectedScript('start');
                    else if (s && s.dev) setSelectedScript('dev');
                    else if (s && Object.keys(s).length > 0) setSelectedScript(Object.keys(s)[0]);
                });
            }

            // Load branch
            window.electronAPI.getBranch(project).then(b => setBranch(b));

            // Listen for port
            if (window.electronAPI.onPortDetected) {
                const unsubscribe = window.electronAPI.onPortDetected(({ projectId, port: p }) => {
                    if (projectId === project.path) setPort(p);
                });
                return () => { }; // Cleanup not fully implemented in preload
            }
        }
    }, [project]);

    const handleRun = () => {
        onRun(project, selectedScript);
    };

    const handleUpdate = async () => {
        setUpdating(true);
        if (onUpdate) await onUpdate(project);

        // Re-fetch branch after update
        if (window.electronAPI) {
            window.electronAPI.getBranch(project).then(b => setBranch(b));
        }
        setUpdating(false);
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'running': return 'bg-green-500/10 text-green-500 border-green-500/20';
            case 'error': return 'bg-red-500/10 text-red-500 border-red-500/20';
            default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
        }
    };

    return (
        <div className="bg-card border border-border rounded-lg p-4 flex flex-col gap-4 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start">
                <div className="overflow-hidden">
                    <h3 className="font-semibold text-lg text-foreground truncate">{project.name}</h3>
                    <p className="text-xs text-muted-foreground truncate max-w-[200px]" title={project.path}>{project.path}</p>
                    {branch && <p className="text-xs text-blue-400 mt-1 flex items-center gap-1"> {branch}</p>}
                </div>
                <div className="flex flex-col gap-1 items-end">
                    <div className={`px-2 py-0.5 rounded text-xs font-medium border ${getStatusColor(project.status)}`}>
                        {project.status.toUpperCase()}
                    </div>
                    {port && (
                        <div className="bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded text-xs animate-pulse">
                            :{port}
                        </div>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="bg-secondary px-2 py-0.5 rounded text-secondary-foreground">
                    {project.type.toUpperCase()}
                </span>
                {project.type === 'node' && Object.keys(scripts).length > 0 && (
                    <select
                        value={selectedScript}
                        onChange={(e) => setSelectedScript(e.target.value)}
                        className="bg-background border border-border rounded px-1 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                        {Object.keys(scripts).map(s => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>
                )}
            </div>

            <div className="grid grid-cols-4 gap-2 mt-auto">
                {project.status === 'running' ? (
                    <button
                        onClick={() => onStop(project)}
                        className="flex items-center justify-center gap-2 bg-destructive/10 text-destructive hover:bg-destructive/20 p-2 rounded-md transition-colors"
                        title="Stop"
                    >
                        <Square size={16} />
                    </button>
                ) : (
                    <button
                        onClick={handleRun}
                        className="flex items-center justify-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 p-2 rounded-md transition-colors"
                        title={`Run ${selectedScript ? selectedScript : ''}`}
                    >
                        <Play size={16} />
                    </button>
                )}

                <button
                    onClick={handleUpdate}
                    disabled={updating}
                    className={`flex items-center justify-center gap-2 bg-secondary text-secondary-foreground hover:bg-secondary/80 p-2 rounded-md transition-colors ${updating ? 'opacity-50' : ''}`}
                    title="Update (Git Pull & Install)"
                >
                    <RefreshCw size={16} className={updating ? 'animate-spin' : ''} />
                </button>

                <button
                    onClick={() => onOpenFolder(project)}
                    className="flex items-center justify-center gap-2 bg-secondary text-secondary-foreground hover:bg-secondary/80 p-2 rounded-md transition-colors"
                    title="Open Folder"
                >
                    <FolderOpen size={16} />
                </button>

                <button
                    onClick={() => setShowTerminal(!showTerminal)}
                    className={`flex items-center justify-center gap-2 p-2 rounded-md transition-colors ${showTerminal ? 'bg-accent text-accent-foreground' : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'}`}
                    title="Toggle Terminal"
                >
                    <TerminalIcon size={16} />
                </button>
            </div>

            {showTerminal && (
                <div className="mt-2 border-t border-border pt-2">
                    <TerminalView projectId={project.path} />
                </div>
            )}
        </div>
    );
};

export default ProjectCard;
