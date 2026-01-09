const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    listProjects: () => ipcRenderer.invoke('project:list'),
    addProject: (project) => ipcRenderer.invoke('project:add', project),
    removeProject: (path, deleteFiles) => ipcRenderer.invoke('project:remove', path, deleteFiles),
    cloneProject: (url, targetDir) => ipcRenderer.invoke('project:clone', url, targetDir),
    detectType: (path) => ipcRenderer.invoke('project:detect', path),
    installProject: (project) => ipcRenderer.invoke('project:install', project),
    runProject: (project, scriptName, options) => ipcRenderer.send('project:run', project, scriptName, options),
    stopProject: (project) => ipcRenderer.send('project:stop', project),
    getScripts: (project) => ipcRenderer.invoke('project:get-scripts', project),
    updateProject: (project) => ipcRenderer.invoke('project:update', project),
    getBranch: (project) => ipcRenderer.invoke('project:get-branch', project),
    checkAllStatuses: () => ipcRenderer.invoke('project:check-all-statuses'),
    executeCommand: (command, projectPath) => ipcRenderer.send('terminal:execute', command, projectPath),
    startShell: (projectPath) => ipcRenderer.send('terminal:start-shell', projectPath),
    sendInput: (data) => ipcRenderer.send('terminal:input', data),
    sendProjectInput: (projectId, data) => ipcRenderer.send('project:input', { projectId, data }),
    getProjectHistory: (projectId) => ipcRenderer.invoke('project:get-history', projectId),
    openFolder: (path) => ipcRenderer.invoke('folder:open', path),
    selectLocalProject: () => ipcRenderer.invoke('project:select-local'),
    openExternal: (url) => ipcRenderer.invoke('app:open-external', url),

    // Events
    onTerminalOutput: (callback) => {
        const subscription = (event, value) => callback(value);
        ipcRenderer.on('terminal-output', subscription);
        return () => ipcRenderer.removeListener('terminal-output', subscription);
    },
    removeTerminalListener: () => ipcRenderer.removeAllListeners('terminal-output'), // Simple cleanup for now
    onStatusChange: (callback) => ipcRenderer.on('project:status-change', (event, value) => callback(value)),
    onPortDetected: (callback) => {
        const subscription = (event, value) => callback(value);
        ipcRenderer.on('project:port-detected', subscription);
        return () => ipcRenderer.removeListener('project:port-detected', subscription);
    },
    onMenuAddUrl: (callback) => ipcRenderer.on('menu:add-url', () => callback()),
    onMenuImportLocal: (callback) => ipcRenderer.on('menu:import-local', () => callback()),

    // Gemini CLI (streaming)
    checkGeminiAvailable: () => ipcRenderer.invoke('gemini:check-available'),
    queryGemini: (query, context) => ipcRenderer.send('gemini:query', query, context),
    onGeminiData: (callback) => ipcRenderer.on('gemini:data', (event, data) => callback(data)),
    onGeminiError: (callback) => ipcRenderer.on('gemini:error', (event, error) => callback(error)),
    onGeminiComplete: (callback) => ipcRenderer.on('gemini:complete', () => callback()),
    removeAllGeminiListeners: () => {
        ipcRenderer.removeAllListeners('gemini:data');
        ipcRenderer.removeAllListeners('gemini:error');
        ipcRenderer.removeAllListeners('gemini:complete');
    },
});
