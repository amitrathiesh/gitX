const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const Store = require('electron-store');
const { exec, spawn } = require('child_process');
const fs = require('fs');

// Fix PATH on macOS
process.env.PATH = [
    './node_modules/.bin',
    '/.nodebrew/current/bin',
    '/usr/local/bin',
    '/usr/bin',
    '/bin',
    '/usr/sbin',
    '/sbin',
    process.env.PATH || ''
].join(':');

const store = new Store();

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
        backgroundColor: '#0f172a', // Dark background by default
        titleBarStyle: 'hidden',
        trafficLightPosition: { x: 12, y: 12 },
    });

    // Load the local URL for development or the local file for production in the future
    // For now, assuming dev mode with Vite running on 5173
    const devUrl = 'http://localhost:5173';
    win.loadURL(devUrl).catch(() => {
        // If dev server isn't ready yet, retry or load file (logic can be improved)
        console.log('Waiting for Vite server...');
        setTimeout(() => win.loadURL(devUrl), 3000);
    });

    // win.webContents.openDevTools();
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// --- IPC Handlers ---

// List projects
ipcMain.handle('project:list', () => {
    return store.get('projects', []);
});

// Add project (manual or after clone)
ipcMain.handle('project:add', (event, project) => {
    const projects = store.get('projects', []);
    // Avoid duplicates by path
    if (!projects.find(p => p.path === project.path)) {
        projects.push(project);
        store.set('projects', projects);
    }
    return projects;
});

// Remove project
ipcMain.handle('project:remove', (event, projectPath) => {
    let projects = store.get('projects', []);
    projects = projects.filter(p => p.path !== projectPath);
    store.set('projects', projects);
    return projects;
});

// Clone project
ipcMain.handle('project:clone', async (event, url, targetDir) => {
    return new Promise((resolve, reject) => {
        console.log(`[Clone] Attempting to clone ${url} to ${targetDir}`);

        // Ensure target directory exists
        if (!fs.existsSync(targetDir)) {
            console.log(`[Clone] Creating target directory: ${targetDir}`);
            try {
                fs.mkdirSync(targetDir, { recursive: true });
            } catch (err) {
                reject(`Failed to create directory: ${err.message}`);
                return;
            }
        }

        // Use exec instead of spawn - more reliable on macOS Electron
        const gitCommand = `git clone "${url}"`;
        console.log(`[Clone] Executing: ${gitCommand} in ${targetDir}`);

        exec(gitCommand, {
            cwd: targetDir,
            env: process.env,
            shell: '/bin/bash',
            maxBuffer: 1024 * 1024 * 10 // 10MB buffer
        }, (error, stdout, stderr) => {
            console.log(`[Clone] Stdout: ${stdout}`);
            console.log(`[Clone] Stderr: ${stderr}`);

            if (error) {
                console.error(`[Clone] Error: ${error.message}`);
                reject(error.message);
                return;
            }

            // Extract project name from URL to guess the folder name
            const repoName = url.split('/').pop().replace('.git', '');
            const projectPath = path.join(targetDir, repoName);

            console.log(`[Clone] Success! Project at: ${projectPath}`);

            resolve({
                name: repoName,
                path: projectPath,
                url: url,
                status: 'stopped',
                type: 'unknown' // Detection will happen separately
            });
        });
    });
});

// REST OF FILE CONTINUES FROM HERE - keeping all other handlers intact
