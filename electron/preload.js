const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    listProjects: () => ipcRenderer.invoke('project:list'),
    addProject: (project) => ipcRenderer.invoke('project:add', project),
    removeProject: (path, deleteFiles) => ipcRenderer.invoke('project:remove', path, deleteFiles),
    cloneProject: (url, targetDir) => ipcRenderer.invoke('project:clone', url, targetDir),
    detectType: (path) => ipcRenderer.invoke('project:detect', path),
    installProject: (project) => ipcRenderer.invoke('project:install', project),
    runProject: (project, scriptName) => ipcRenderer.send('project:run', project, scriptName),
    stopProject: (project) => ipcRenderer.send('project:stop', project),
    getScripts: (project) => ipcRenderer.invoke('project:get-scripts', project),
    updateProject: (project) => ipcRenderer.invoke('project:update', project),
    getBranch: (project) => ipcRenderer.invoke('project:get-branch', project),
    openFolder: (path) => ipcRenderer.invoke('folder:open', path),

    // Events
    onTerminalOutput: (callback) => ipcRenderer.on('terminal-output', (event, value) => callback(value)),
    onStatusChange: (callback) => ipcRenderer.on('project:status-change', (event, value) => callback(value)),
    onPortDetected: (callback) => ipcRenderer.on('project:port-detected', (event, value) => callback(value)),

    // Gemini CLI
    checkGeminiAvailable: () => ipcRenderer.invoke('gemini:check-available'),
    queryGemini: (query, context) => ipcRenderer.invoke('gemini:query', query, context),
});
