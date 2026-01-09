import React, { useState, useEffect } from 'react';
import { Play, Square, RefreshCw, FolderOpen, GitBranch, Server, Trash2, ChevronDown, ChevronRight, Terminal, Sparkles, Maximize2 } from 'lucide-react';
import TerminalView from './TerminalView';

const ProjectRow = ({ project, onRun, onStop, onUpdate, onOpenFolder, onDelete, onSelect }) => {
    const [scripts, setScripts] = useState({});
    const [selectedScript, setSelectedScript] = useState('');
    const [branch, setBranch] = useState('');
    const [port, setPort] = useState(null);
    const [customPort, setCustomPort] = useState('');
    const [updating, setUpdating] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);
    const [aiMode, setAiMode] = useState(false);

    useEffect(() => {
        if (window.electronAPI) {
            // Load scripts if node
            if (project.type === 'node') {
                window.electronAPI.getScripts(project).then(s => {
                    setScripts(s || {});
                    if (s && s.dev) setSelectedScript('dev');
                    else if (s && s.start) setSelectedScript('start');
                    else if (s && Object.keys(s).length > 0) setSelectedScript(Object.keys(s)[0]);
                });
            }

            // Load branch
            window.electronAPI.getBranch(project).then(b => setBranch(b));

            // Listen for port
            let unsubscribePort = null;
            if (window.electronAPI.onPortDetected) {
                unsubscribePort = window.electronAPI.onPortDetected(({ projectId, port: p }) => {
                    if (projectId === project.path) setPort(p);
                });
            }

            return () => {
                if (unsubscribePort && typeof unsubscribePort === 'function') {
                    unsubscribePort();
                }
            };
        }
    }, [project]);

    const handleRun = (e) => {
        e?.stopPropagation();
        const options = customPort ? { port: customPort } : {};
        onRun(project, selectedScript, options);
        setIsExpanded(true); // Auto expand on run
    };

    const handleStop = (e) => {
        e?.stopPropagation();
        onStop(project);
    };

    const handleUpdate = async (e) => {
        e?.stopPropagation();
        setUpdating(true);
        if (onUpdate) await onUpdate(project);

        if (window.electronAPI) {
            window.electronAPI.getBranch(project).then(b => setBranch(b));
        }
        setUpdating(false);
    };

    const toggleExpand = () => setIsExpanded(!isExpanded);

    return (
        <div className="group flex flex-col bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 border border-slate-200 dark:border-white/5 rounded-xl transition-all duration-300 overflow-hidden backdrop-blur-sm shadow-sm dark:shadow-none">
            {/* Main Row Content */}
            <div
                className="flex items-center p-4 gap-4 cursor-pointer"
                onClick={toggleExpand}
            >
                {/* Icon/Expand State */}
                <div className={`p-2 rounded-lg transition-colors ${isExpanded ? 'bg-primary/20 text-primary' : 'bg-slate-100 dark:bg-white/5 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-white'}`}>
                    {isExpanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                </div>

                {/* Project Info */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                        <h3 className="font-semibold text-lg text-slate-800 dark:text-white truncate">{project.name}</h3>
                        {branch && (
                            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-500/20">
                                <GitBranch size={12} />
                                {branch}
                            </span>
                        )}
                        <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-500/10 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-500/20 uppercase">
                            {project.type}
                        </span>
                    </div>
                    <div className="text-sm text-slate-500 truncate" title={project.path}>
                        {project.path.replace(/\/Users\/[^/]+/, '~')}
                    </div>
                </div>

                {/* Script Selector */}
                {project.type === 'node' && Object.keys(scripts).length > 0 && (
                    <div className="text-sm" onClick={e => e.stopPropagation()}>
                        <select
                            value={selectedScript}
                            onChange={(e) => setSelectedScript(e.target.value)}
                            className="bg-slate-100 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-slate-700 dark:text-slate-300 focus:outline-none focus:border-primary/50 transition-colors"
                        >
                            {Object.keys(scripts).map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                    </div>
                )}

                {/* Status Indicator */}
                <div className="flex items-center gap-3">
                    {project.status === 'running' && (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                            <span className="text-sm font-medium text-green-400">Running</span>
                        </div>
                    )}
                    {project.status === 'error' && (
                        <div className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-medium">
                            Error
                        </div>
                    )}
                    {project.status === 'stopped' && (
                        <span className="text-sm text-slate-600 font-medium px-2">Stopped</span>
                    )}

                    {/* Port */}
                    {port ? (
                        <div
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-purple-50 dark:bg-purple-500/10 border border-purple-200 dark:border-purple-500/20 text-purple-600 dark:text-purple-400 text-sm font-medium cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-500/20 transition-colors"
                            onClick={(e) => {
                                e.stopPropagation();
                                window.electronAPI && window.electronAPI.openExternal(`http://localhost:${port}`);
                            }}
                        >
                            <Server size={14} />
                            <span>:{port}</span>
                        </div>
                    ) : project.status !== 'running' && (
                        <input
                            type="text"
                            placeholder="Port"
                            value={customPort}
                            onChange={(e) => setCustomPort(e.target.value)}
                            onClick={e => e.stopPropagation()}
                            className="w-16 bg-slate-100 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-lg px-2 py-1.5 text-sm text-slate-700 dark:text-slate-300 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-primary/50 transition-colors"
                        />
                    )}
                </div>

                {/* Actions Group - Visible on Hover or when Expanded */}
                <div className="flex items-center gap-1 opacity-100 transition-opacity">
                    {project.status === 'running' ? (
                        <button
                            onClick={handleStop}
                            className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-all border border-transparent hover:border-red-500/20"
                            title="Stop Process"
                        >
                            <Square size={18} />
                        </button>
                    ) : (
                        <button
                            onClick={handleRun}
                            className="p-2 rounded-lg bg-primary text-white hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all transform hover:scale-105 active:scale-95"
                            title={`Run ${selectedScript}`}
                        >
                            <Play size={18} fill="currentColor" />
                        </button>
                    )}

                    <div className="w-px h-6 bg-slate-200 dark:bg-white/10 mx-1" />

                    <button
                        onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
                        className={`p-2 rounded-lg transition-colors ${isExpanded ? 'bg-slate-200 dark:bg-white/10 text-slate-800 dark:text-white' : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-800 dark:hover:text-white'}`}
                        title="Toggle Terminal"
                    >
                        <Terminal size={18} />
                    </button>

                    <button
                        onClick={handleUpdate}
                        disabled={updating}
                        className={`p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-800 dark:hover:text-white transition-colors ${updating ? 'opacity-50' : ''}`}
                        title="Git Pull & Install"
                    >
                        <RefreshCw size={18} className={updating ? 'animate-spin' : ''} />
                    </button>

                    <button
                        onClick={(e) => { e.stopPropagation(); onOpenFolder(project); }}
                        className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-800 dark:hover:text-white transition-colors"
                        title="Open in Finder"
                    >
                        <FolderOpen size={18} />
                    </button>

                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete(project); }}
                        className="p-2 rounded-lg text-slate-400 dark:text-slate-600 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                        title="Remove Project"
                    >
                        <Trash2 size={18} />
                    </button>
                </div>
            </div>

            {/* Expanded Terminal Area */}
            {isExpanded && (
                <div className="border-t border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-black/40">
                    <div className="p-4">
                        <div className="flex items-center justify-between mb-2 px-2">
                            <span className="text-xs font-medium text-slate-500 flex items-center gap-2">
                                <Terminal size={12} />
                                Terminal Output
                            </span>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setAiMode(!aiMode);
                                    }}
                                    className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-colors border ${aiMode
                                        ? 'bg-purple-100 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-500/20'
                                        : 'bg-white dark:bg-white/5 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/10 hover:text-slate-900 dark:hover:text-white'}`}
                                >
                                    <Sparkles size={12} />
                                    {aiMode ? 'AI Active' : 'Ask AI'}
                                </button>

                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (onSelect) onSelect(project, true);
                                    }}
                                    className="p-1 rounded text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10 hover:text-slate-600 dark:hover:text-white transition-colors"
                                    title="Open Full Screen"
                                >
                                    <Maximize2 size={14} />
                                </button>
                            </div>
                        </div>
                        <div className="h-64 rounded-lg overflow-hidden border border-slate-200 dark:border-white/10 bg-black">
                            <TerminalView projectId={project.path} aiModeEnabled={aiMode} project={project} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProjectRow;
