import React, { useState, useEffect } from 'react';
import { Play, Square, RefreshCw, FolderOpen, GitBranch, Server, Trash2 } from 'lucide-react';

const ProjectRow = ({ project, onRun, onStop, onUpdate, onOpenFolder, onDelete, onSelect }) => {
    const [scripts, setScripts] = useState({});
    const [selectedScript, setSelectedScript] = useState('');
    const [branch, setBranch] = useState('');
    const [port, setPort] = useState(null);
    const [customPort, setCustomPort] = useState('');
    const [updating, setUpdating] = useState(false);

    useEffect(() => {
        if (window.electronAPI) {
            // Load scripts if node
            if (project.type === 'node') {
                window.electronAPI.getScripts(project).then(s => {
                    setScripts(s || {});
                    // Prioritize 'dev' over 'start' for better developer experience
                    if (s && s.dev) setSelectedScript('dev');
                    else if (s && s.start) setSelectedScript('start');
                    else if (s && Object.keys(s).length > 0) setSelectedScript(Object.keys(s)[0]);
                });
            }

            // Load branch
            window.electronAPI.getBranch(project).then(b => setBranch(b));

            // Listen for port
            if (window.electronAPI.onPortDetected) {
                window.electronAPI.onPortDetected(({ projectId, port: p }) => {
                    if (projectId === project.path) setPort(p);
                });
            }
        }
    }, [project]);

    const handleRun = () => {
        const options = customPort ? { port: customPort } : {};
        onRun(project, selectedScript, options);
    };

    const handleUpdate = async () => {
        setUpdating(true);
        if (onUpdate) await onUpdate(project);

        if (window.electronAPI) {
            window.electronAPI.getBranch(project).then(b => setBranch(b));
        }
        setUpdating(false);
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'running': return 'text-green-500';
            case 'error': return 'text-red-500';
            default: return 'text-gray-400';
        }
    };

    return (
        <tr
            className="border-b border-border hover:bg-secondary/50 transition-colors cursor-pointer"
            onClick={() => onSelect && onSelect(project)}
        >
            {/* Name */}
            <td className="py-3 px-4">
                <div className="font-medium text-foreground">{project.name}</div>
                <div className="text-xs text-muted-foreground truncate max-w-[200px]" title={project.path}>
                    {project.path}
                </div>
            </td>

            {/* Type */}
            <td className="py-3 px-4">
                <span className="bg-secondary px-2 py-1 rounded text-xs text-secondary-foreground uppercase">
                    {project.type}
                </span>
            </td>

            {/* Branch */}
            <td className="py-3 px-4">
                {branch && (
                    <div className="flex items-center gap-1 text-sm text-blue-400">
                        <GitBranch size={14} />
                        <span>{branch === 'unknown' ? 'local' : branch}</span>
                    </div>
                )}
            </td>

            {/* Port */}
            <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                {project.status === 'running' ? (
                    port && (
                        <div
                            className="flex items-center gap-1 text-sm text-purple-400 hover:text-purple-300 hover:underline cursor-pointer transition-colors"
                            onClick={() => window.electronAPI && window.electronAPI.openExternal(`http://localhost:${port}`)}
                            title={`Open http://localhost:${port}`}
                        >
                            <Server size={14} />
                            <span>:{port}</span>
                        </div>
                    )
                ) : (
                    <input
                        type="text"
                        placeholder="Port..."
                        value={customPort}
                        onChange={(e) => setCustomPort(e.target.value)}
                        className="bg-background/50 border border-border rounded px-2 py-1 text-xs w-20 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-purple-500 transition-colors"
                        title="Custom Port (Optional)"
                    />
                )}
            </td>

            {/* Status */}
            <td className="py-3 px-4">
                <span className={`text-sm font-medium ${getStatusColor(project.status)}`}>
                    {project.status.toUpperCase()}
                </span>
            </td>

            {/* Script Selector (Node.js only) */}
            <td className="py-3 px-4">
                {project.type === 'node' && Object.keys(scripts).length > 0 && (
                    <select
                        value={selectedScript}
                        onChange={(e) => {
                            e.stopPropagation();
                            setSelectedScript(e.target.value);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="bg-background border border-border rounded px-2 py-1 text-xs w-32 focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                        {Object.keys(scripts).map(s => (
                            <option key={s} value={s}>{s}</option>
                        ))}
                    </select>
                )}
            </td>

            {/* Actions */}
            <td className="py-3 px-4">
                <div className="flex items-center gap-2">
                    {project.status === 'running' ? (
                        <button
                            onClick={(e) => { e.stopPropagation(); onStop(project); }}
                            className="p-2 rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                            title="Stop"
                        >
                            <Square size={16} />
                        </button>
                    ) : (
                        <button
                            onClick={(e) => { e.stopPropagation(); handleRun(); }}
                            className="p-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                            title={`Run ${selectedScript ? selectedScript : ''}`}
                        >
                            <Play size={16} />
                        </button>
                    )}

                    <button
                        onClick={(e) => { e.stopPropagation(); handleUpdate(); }}
                        disabled={updating}
                        className={`p-2 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors ${updating ? 'opacity-50' : ''}`}
                        title="Update (Git Pull)"
                    >
                        <RefreshCw size={16} className={updating ? 'animate-spin' : ''} />
                    </button>

                    <button
                        onClick={(e) => { e.stopPropagation(); onOpenFolder(project); }}
                        className="p-2 rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
                        title="Open Folder"
                    >
                        <FolderOpen size={16} />
                    </button>

                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete(project); }}
                        className="p-2 rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                        title="Remove from Dashboard"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            </td>
        </tr>
    );
};

export default ProjectRow;
