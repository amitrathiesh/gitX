import React, { useState, useEffect, useRef } from 'react';
import { Plus, Search, RefreshCw, FolderInput } from 'lucide-react';
import ProjectRow from './ProjectRow';

const Dashboard = ({ onProjectSelect }) => {
    const [projects, setProjects] = useState([]);
    const [repoUrl, setRepoUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [targetDir, setTargetDir] = useState('/Users/amitrathiesh/Projects');
    const urlInputRef = useRef(null);

    useEffect(() => {
        loadProjects();

        // Listen for status changes
        if (window.electronAPI) {
            window.electronAPI.onStatusChange(({ projectId, status }) => {
                setProjects(prev => prev.map(p => p.path === projectId ? { ...p, status } : p));
            });

            // Listen for port detection
            window.electronAPI.onPortDetected(({ projectId, port }) => {
                setProjects(prev => prev.map(p => p.path === projectId ? { ...p, port } : p));
            });

            // Menu Handlers
            if (window.electronAPI.onMenuAddUrl) {
                window.electronAPI.onMenuAddUrl(() => {
                    if (urlInputRef.current) urlInputRef.current.focus();
                });
            }
            if (window.electronAPI.onMenuImportLocal) {
                window.electronAPI.onMenuImportLocal(() => {
                    handleImportLocal();
                });
            }
        }

        // Auto-poll status every 10s (Ghost Process detection)
        const interval = setInterval(() => {
            if (window.electronAPI?.checkAllStatuses) {
                window.electronAPI.checkAllStatuses().then(updatedList => {
                    if (updatedList) setProjects(updatedList);
                });
            }
        }, 10000);

        return () => clearInterval(interval);
    }, []);

    const loadProjects = async () => {
        if (window.electronAPI) {
            const list = await window.electronAPI.listProjects();
            setProjects(list);

            // Sync status (detect ghost processes)
            if (window.electronAPI.checkAllStatuses) {
                window.electronAPI.checkAllStatuses().then(updatedList => {
                    if (updatedList) setProjects(updatedList);
                });
            }
        }
    };

    const handleAddProject = async (e) => {
        e.preventDefault();
        if (!repoUrl) return;

        setLoading(true);
        try {
            if (window.electronAPI) {
                const project = await window.electronAPI.cloneProject(repoUrl, targetDir);
                await window.electronAPI.addProject(project);

                // Auto-detect type
                const type = await window.electronAPI.detectType(project.path);
                const updatedProject = { ...project, type };

                // Auto-install
                console.log('Installing dependencies...');
                await window.electronAPI.installProject(updatedProject);

                loadProjects();
                setRepoUrl('');
            }
        } catch (error) {
            console.error("Failed to add project", error);
            alert(`Error cloning project: ${error}`);
        } finally {
            setLoading(false);
        }
    };

    const handleImportLocal = async () => {
        if (!window.electronAPI) return;

        try {
            const result = await window.electronAPI.selectLocalProject();
            if (result) {
                setLoading(true);
                const project = {
                    name: result.name,
                    path: result.path,
                    url: 'local',
                    type: 'unknown',
                    branch: 'main',
                    status: 'stopped'
                };

                await window.electronAPI.addProject(project); // Add to store

                const type = await window.electronAPI.detectType(project.path);
                const updated = { ...project, type };

                await window.electronAPI.installProject(updated);
                loadProjects();
            }
        } catch (e) {
            console.error('Import failed', e);
            alert('Import failed: ' + e);
        } finally {
            setLoading(false);
        }
    };

    const handleRun = (project, scriptName, options) => {
        window.electronAPI.runProject(project, scriptName, options);
        if (onProjectSelect) onProjectSelect(project);
    };

    const handleStop = (project) => {
        if (window.electronAPI && window.electronAPI.stopProject) {
            window.electronAPI.stopProject(project);
        }
    };

    const handleUpdate = async (project) => {
        try {
            await window.electronAPI.updateProject(project);
            await window.electronAPI.installProject(project);
            loadProjects();
        } catch (error) {
            console.error('Update failed', error);
        }
    };

    const handleOpenFolder = (project) => {
        if (window.electronAPI && window.electronAPI.openFolder) {
            window.electronAPI.openFolder(project.path);
        }
    };

    const handleDelete = async (project) => {
        const removeFromDashboard = window.confirm(
            `Remove "${project.name}" from gitX dashboard?`
        );

        if (!removeFromDashboard) return;

        const deleteFiles = window.confirm(
            `Do you also want to DELETE the project files from disk?\n\n` +
            `Click OK to DELETE FILES or Cancel to keep them.`
        );

        try {
            if (window.electronAPI) {
                await window.electronAPI.removeProject(project.path, deleteFiles);
                loadProjects();
            }
        } catch (error) {
            console.error('Failed to delete project', error);
            alert(`Error removing project: ${error}`);
        }
    };

    const filteredProjects = projects.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.path.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-8">
            {/* Controls Bar */}
            <div className="flex flex-col md:flex-row gap-4">
                {/* Search */}
                <div className="relative flex-1 group">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500 group-focus-within:text-primary transition-colors" />
                    <input
                        type="text"
                        placeholder="Search projects..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-white/5 rounded-xl pl-10 pr-4 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all shadow-sm dark:shadow-black/20"
                    />
                </div>

                {/* Add Project Form (Condensed) */}
                <div className="flex-[2] flex gap-2">
                    <form onSubmit={handleAddProject} className="flex-1 flex gap-2">
                        <input
                            ref={urlInputRef}
                            type="text"
                            value={repoUrl}
                            onChange={(e) => setRepoUrl(e.target.value)}
                            placeholder="Clone URL..."
                            className="flex-1 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-white/5 rounded-xl px-4 py-2 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all shadow-sm dark:shadow-black/20"
                        />
                        <button
                            type="submit"
                            disabled={loading}
                            className="bg-primary text-white hover:bg-primary/90 rounded-xl px-4 py-2 flex items-center gap-2 disabled:opacity-50 transition-all font-medium whitespace-nowrap shadow-lg shadow-primary/20"
                        >
                            <Plus size={18} />
                            {loading ? 'Cloning...' : 'Add'}
                        </button>
                    </form>

                    <button
                        onClick={handleImportLocal}
                        disabled={loading}
                        className="bg-white dark:bg-white/5 text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/10 rounded-xl px-4 py-2 flex items-center gap-2 border border-slate-200 dark:border-white/5 transition-all shadow-sm dark:shadow-none"
                        title="Import Local Folder"
                    >
                        <FolderInput size={18} />
                    </button>

                    <button
                        onClick={loadProjects}
                        className="bg-white dark:bg-white/5 text-slate-500 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/10 rounded-xl px-3 py-2 border border-slate-200 dark:border-white/5 transition-all shadow-sm dark:shadow-none"
                        title="Refresh Status"
                    >
                        <RefreshCw size={18} />
                    </button>
                </div>
            </div>

            {/* Header for list */}
            <div className="flex items-center justify-between px-2">
                <div className="text-sm font-medium text-slate-500 uppercase tracking-wider">
                    {filteredProjects.length} Projects
                </div>
                {/* Sort controls could go here */}
            </div>

            {/* Projects List */}
            <div className="space-y-3">
                {filteredProjects.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20 text-slate-500 bg-slate-50/50 dark:bg-white/5 border border-slate-200 dark:border-white/5 rounded-2xl border-dashed">
                        <div className="p-4 bg-slate-100 dark:bg-slate-800/50 rounded-full mb-4">
                            <Plus size={32} className="opacity-50" />
                        </div>
                        <p className="text-lg font-medium text-slate-700 dark:text-slate-200">No projects found</p>
                        <p className="text-sm opacity-70">Add a repository or import a folder to get started</p>
                    </div>
                ) : (
                    filteredProjects.map((project) => (
                        <ProjectRow
                            key={project.path}
                            project={project}
                            onRun={handleRun}
                            onStop={handleStop}
                            onUpdate={handleUpdate}
                            onOpenFolder={handleOpenFolder}
                            onDelete={handleDelete}
                            onSelect={onProjectSelect}
                        />
                    ))
                )}
            </div>
        </div>
    );
};

export default Dashboard;
