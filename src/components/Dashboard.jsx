import React, { useState, useEffect } from 'react';
import { Plus, Search } from 'lucide-react';
import ProjectRow from './ProjectRow';

const Dashboard = ({ onProjectSelect }) => {
    const [projects, setProjects] = useState([]);
    const [repoUrl, setRepoUrl] = useState('');
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [targetDir, setTargetDir] = useState('/Users/amitrathiesh/Projects');

    useEffect(() => {
        loadProjects();

        // Listen for status changes
        if (window.electronAPI) {
            window.electronAPI.onStatusChange(({ projectId, status }) => {
                setProjects(prev => prev.map(p => p.path === projectId ? { ...p, status } : p));
            });
        }
    }, []);

    const loadProjects = async () => {
        if (window.electronAPI) {
            const list = await window.electronAPI.listProjects();
            setProjects(list);
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

                // Update project with type
                const updatedProject = { ...project, type };

                // Auto-install
                console.log('Installing dependencies...');
                await window.electronAPI.installProject(updatedProject);
                console.log('Dependencies installed.');

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

    const handleRun = (project, scriptName) => {
        window.electronAPI.runProject(project, scriptName);
        // Select this project in terminal
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
        // First confirmation: Remove from dashboard
        const removeFromDashboard = window.confirm(
            `Remove "${project.name}" from gitX dashboard?\n\n` +
            `The project will be removed from the list, but files will remain on disk.`
        );

        if (!removeFromDashboard) return;

        // Second confirmation: Delete files from disk?
        const deleteFiles = window.confirm(
            `Do you also want to DELETE the project files from disk?\n\n` +
            `⚠️ WARNING: This will permanently delete:\n${project.path}\n\n` +
            `Click OK to DELETE FILES or Cancel to keep them.`
        );

        try {
            if (window.electronAPI) {
                await window.electronAPI.removeProject(project.path, deleteFiles);
                loadProjects();

                if (deleteFiles) {
                    alert(`Project removed and files deleted successfully.`);
                }
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
        <div className="space-y-6">
            {/* Add Project Bar */}
            <div className="bg-card border border-border rounded-lg p-4 shadow-sm">
                <form onSubmit={handleAddProject} className="flex gap-4">
                    <input
                        type="text"
                        value={repoUrl}
                        onChange={(e) => setRepoUrl(e.target.value)}
                        placeholder="Paste Git Repository URL..."
                        className="flex-1 bg-background border border-input rounded-md px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring non-draggable"
                    />
                    <input
                        type="text"
                        value={targetDir}
                        onChange={(e) => setTargetDir(e.target.value)}
                        placeholder="Target Directory"
                        className="w-1/3 bg-background border border-input rounded-md px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring non-draggable"
                    />
                    <button
                        type="submit"
                        disabled={loading}
                        className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-4 py-2 flex items-center gap-2 disabled:opacity-50 non-draggable"
                    >
                        <Plus size={18} />
                        {loading ? 'Cloning...' : 'Add Project'}
                    </button>
                </form>
            </div>

            {/* Projects Table */}
            <div className="space-y-4">
                <div className="flex justify-between items-center">
                    <h2 className="text-xl font-semibold">Your Projects</h2>
                    <div className="relative w-64">
                        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search projects..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-background border border-input rounded-md pl-8 pr-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring non-draggable"
                        />
                    </div>
                </div>

                {filteredProjects.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground bg-card/50 rounded-lg border border-dashed border-border">
                        No projects found. Add one above!
                    </div>
                ) : (
                    <div className="bg-card border border-border rounded-lg overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-secondary/50 border-b border-border">
                                <tr>
                                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Project</th>
                                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Type</th>
                                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Branch</th>
                                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Port</th>
                                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Status</th>
                                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Script</th>
                                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredProjects.map((project) => (
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
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Dashboard;
