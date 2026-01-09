const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const Store = require('electron-store');
const { exec, spawn } = require('child_process');
const fs = require('fs');

process.env.PATH = [
    './node_modules/.bin',
    '/.nodebrew/current/bin',
    '/usr/local/bin',
    '/usr/bin',
    '/bin',
    '/usr/sbin',
    '/sbin',
    '/opt/homebrew/bin', // Add homebrew for gemini CLI
    process.env.PATH || ''
].join(':');

const store = new Store();

// Track running processes by project path
const runningProcesses = new Map();

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
ipcMain.handle('project:remove', async (event, projectPath, deleteFiles = false) => {
    // Remove from store
    let projects = store.get('projects', []);
    projects = projects.filter(p => p.path !== projectPath);
    store.set('projects', projects);

    // Optionally delete files from disk
    if (deleteFiles) {
        try {
            console.log(`[Delete] Removing files at: ${projectPath}`);
            // Use fs.rm with recursive option (Node 14.14+)
            await fs.promises.rm(projectPath, { recursive: true, force: true });
            console.log(`[Delete] Successfully deleted: ${projectPath}`);
        } catch (error) {
            console.error(`[Delete] Failed to delete files:`, error);
            throw new Error(`Failed to delete project files: ${error.message}`);
        }
    }

    return projects;
});

// Open folder in system file manager
ipcMain.handle('folder:open', async (event, folderPath) => {
    try {
        const result = await shell.openPath(folderPath);
        if (result) {
            // openPath returns empty string on success, error message on failure
            console.error(`[Open Folder] Failed: ${result}`);
            return { success: false, error: result };
        }
        console.log(`[Open Folder] Opened: ${folderPath}`);
        return { success: true };
    } catch (error) {
        console.error(`[Open Folder] Error:`, error);
        return { success: false, error: error.message };
    }
});

// Clone project
ipcMain.handle('project:clone', async (event, url, targetDir) => {
    return new Promise((resolve, reject) => {
        console.log(`[Clone] Attempting to clone ${url} to ${targetDir} `);

        // Ensure target directory exists
        if (!fs.existsSync(targetDir)) {
            console.log(`[Clone] Creating target directory: ${targetDir} `);
            try {
                fs.mkdirSync(targetDir, { recursive: true });
            } catch (err) {
                reject(`Failed to create directory: ${err.message} `);
                return;
            }
        }

        // Use absolute path on macOS to ensure binary is found
        const gitPath = process.platform === 'darwin' && fs.existsSync('/usr/bin/git')
            ? '/usr/bin/git'
            : 'git';

        console.log(`[Clone] Using git command with exec`);

        // Use exec instead of spawn - shell is yes by default and more reliable  
        const gitCommand = `git clone "${url}"`;
        console.log(`[Clone] Executing: ${gitCommand} `);

        exec(gitCommand, {
            cwd: targetDir,
            env: process.env,
            shell: '/bin/bash',
            maxBuffer: 1024 * 1024 * 10 // 10MB buffer
        }, (error, stdout, stderr) => {
            console.log(`[Clone] Stdout: ${stdout} `);
            console.log(`[Clone] Stderr: ${stderr} `);

            if (error) {
                console.error(`[Clone] Error: ${error.message} `);
                reject(error.message);
                return;
            }

            // Extract project name from URL to guess the folder name
            const repoName = url.split('/').pop().replace('.git', '');
            const projectPath = path.join(targetDir, repoName);

            console.log(`[Clone] Success! Project at: ${projectPath} `);

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

// Detect Project Type (simple version)
ipcMain.handle('project:detect', async (event, projectPath) => {
    try {
        const files = fs.readdirSync(projectPath);
        let type = 'other';

        if (files.includes('package.json')) type = 'node';
        else if (files.includes('requirements.txt')) type = 'python';
        else if (files.includes('Cargo.toml')) type = 'rust';
        else if (files.includes('go.mod')) type = 'go';
        else if (files.includes('docker-compose.yml')) type = 'docker';

        // Update in store if it exists
        let projects = store.get('projects', []);
        const pIndex = projects.findIndex(p => p.path === projectPath);
        if (pIndex > -1) {
            projects[pIndex].type = type;
            store.set('projects', projects);
        }

        return type;
    } catch (e) {
        console.error('Detection failed', e);
        return 'unknown';
    }
});

// Install dependencies
ipcMain.handle('project:install', async (event, project) => {
    return new Promise((resolve, reject) => {
        let cmd = '';
        if (project.type === 'node') cmd = 'npm install';
        else if (project.type === 'python') cmd = 'pip install -r requirements.txt';
        else if (project.type === 'rust') cmd = 'cargo build';
        else if (project.type === 'go') cmd = 'go mod download';
        else if (project.type === 'docker') cmd = 'docker-compose up --no-start';
        else {
            resolve('No install command for this type');
            return;
        }

        exec(cmd, { cwd: project.path }, (error, stdout, stderr) => {
            if (error) {
                console.warn(`Install warning / error: ${error.message} `);
            }
            resolve(stdout);
        });
    });
});

// Get Scripts
ipcMain.handle('project:get-scripts', async (event, project) => {
    if (project.type !== 'node') return {};
    try {
        const pkgPath = path.join(project.path, 'package.json');
        if (fs.existsSync(pkgPath)) {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
            return pkg.scripts || {};
        }
    } catch (e) {
        console.error('Failed to parse package.json', e);
    }
    return {};
});

// Update Project (Git Pull + Install)
ipcMain.handle('project:update', async (event, project) => {
    return new Promise((resolve, reject) => {
        exec('git pull', { cwd: project.path }, async (error, stdout, stderr) => {
            if (error) {
                reject(error.message);
                return;
            }
            resolve(stdout);
        });
    });
});

// Get Current Branch
ipcMain.handle('project:get-branch', async (event, project) => {
    return new Promise((resolve) => {
        exec('git rev-parse --abbrev-ref HEAD', { cwd: project.path }, (error, stdout) => {
            if (error) resolve('unknown');
            else resolve(stdout.trim());
        });
    });
});

// Run with Script Support and Port Detection
ipcMain.on('project:run', (event, project, scriptName = null) => {
    // Determine command based on type
    let cmd = '';
    let args = [];

    if (project.type === 'node') {
        cmd = 'npm';
        args = scriptName ? ['run', scriptName] : ['start'];
    } else if (project.type === 'python') {
        cmd = 'python';
        args = ['main.py']; // simplified
    } else if (project.type === 'rust') {
        cmd = 'cargo';
        args = ['run'];
    } else {
        // Fallback
        cmd = 'npm';
        args = ['start'];
    }

    const child = spawn(cmd, args, { cwd: project.path, shell: true });

    // Store process for stopping later
    runningProcesses.set(project.path, child);

    const scanForPort = (data) => {
        const str = data.toString();
        // Regex to find ports like: localhost:3000, :8080, port 5000
        const portRegex = /(?:localhost:|:|port\s+)(\d{4,5})/i;
        const match = str.match(portRegex);
        if (match && match[1]) {
            event.sender.send('project:port-detected', { projectId: project.path, port: match[1] });
        }
    };

    child.stdout.on('data', (data) => {
        scanForPort(data);
        event.sender.send('terminal-output', { projectId: project.path, data: data.toString() });
    });

    child.stderr.on('data', (data) => {
        scanForPort(data);
        event.sender.send('terminal-output', { projectId: project.path, data: data.toString() });
    });

    child.on('close', (code) => {
        runningProcesses.delete(project.path);
        event.sender.send('terminal-output', { projectId: project.path, data: `\nProcess exited with code ${code} \n` });
        event.sender.send('project:status-change', { projectId: project.path, status: 'stopped' });
    });

    // Notify frontend that it started
    event.sender.send('project:status-change', { projectId: project.path, status: 'running' });
});

// Stop Project
ipcMain.on('project:stop', (event, project) => {
    const child = runningProcesses.get(project.path);
    if (child) {
        console.log(`[Stop] Killing process for ${project.name}`);
        // Kill the process and all its children
        child.kill('SIGTERM');

        // Force kill after 2 seconds if still running
        setTimeout(() => {
            if (runningProcesses.has(project.path)) {
                child.kill('SIGKILL');
                runningProcesses.delete(project.path);
            }
        }, 2000);

        event.sender.send('terminal-output', { projectId: project.path, data: '\n[Stopped by user]\n' });
        event.sender.send('project:status-change', { projectId: project.path, status: 'stopped' });
    } else {
        console.log(`[Stop] No running process found for ${project.name}`);
    }
});

// Check if Gemini CLI is available
ipcMain.handle('gemini:check-available', async () => {
    return new Promise((resolve) => {
        exec('which gemini', (error, stdout) => {
            if (error || !stdout.trim()) {
                resolve({ available: false, path: null });
            } else {
                resolve({ available: true, path: stdout.trim() });
            }
        });
    });
});

// Query Gemini CLI
ipcMain.handle('gemini:query', async (event, query, context) => {
    return new Promise((resolve, reject) => {
        console.log(`[Gemini] Query: ${query}`);
        console.log(`[Gemini] Context:`, context);

        if (!context || !context.projectPath) {
            reject('No project path provided');
            return;
        }

        const projectPath = context.projectPath;

        // Build rich context from project files
        let contextInfo = `Project: ${context.projectName}\nType: ${context.projectType}\nLocation: ${projectPath}\n\n`;

        // Try to read README
        const readmePaths = ['README.md', 'README.txt', 'readme.md'];
        for (const readme of readmePaths) {
            const readmePath = path.join(projectPath, readme);
            if (fs.existsSync(readmePath)) {
                try {
                    const readmeContent = fs.readFileSync(readmePath, 'utf8');
                    // Limit README to first 2000 chars to avoid overwhelming context
                    contextInfo += `README:\n${readmeContent.substring(0, 2000)}\n\n`;
                    break;
                } catch (e) {
                    console.error('[Gemini] Failed to read README:', e);
                }
            }
        }

        // For Node projects, include package.json info
        if (context.projectType === 'node') {
            const pkgPath = path.join(projectPath, 'package.json');
            if (fs.existsSync(pkgPath)) {
                try {
                    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
                    contextInfo += `Package Info:\n`;
                    contextInfo += `- Name: ${pkg.name}\n`;
                    contextInfo += `- Version: ${pkg.version}\n`;
                    contextInfo += `- Description: ${pkg.description || 'N/A'}\n`;
                    if (pkg.scripts) {
                        contextInfo += `- Scripts: ${Object.keys(pkg.scripts).join(', ')}\n`;
                    }
                    if (pkg.dependencies) {
                        contextInfo += `- Dependencies: ${Object.keys(pkg.dependencies).slice(0, 10).join(', ')}${Object.keys(pkg.dependencies).length > 10 ? '...' : ''}\n`;
                    }
                    contextInfo += '\n';
                } catch (e) {
                    console.error('[Gemini] Failed to read package.json:', e);
                }
            }
        }

        // Include recent logs if provided
        if (context.recentLogs) {
            contextInfo += `Recent Logs:\n${context.recentLogs}\n\n`;
        }

        // Build the full prompt
        const fullPrompt = `${contextInfo}User Question: ${query}`;

        console.log(`[Gemini] Running in directory: ${projectPath}`);

        // Use gemini CLI with positional argument (--prompt is deprecated)
        // This runs in the project directory and has access to project files
        // Escape the query for shell safety
        const escapedQuery = query.replace(/'/g, "'\\''");
        const child = spawn('/bin/bash', ['-c', `gemini '${escapedQuery}'`], {
            cwd: projectPath,  // Run in project directory
            env: process.env
        });

        let response = '';
        let errorOutput = '';

        child.stdout.on('data', (data) => {
            response += data.toString();
        });

        child.stderr.on('data', (data) => {
            errorOutput += data.toString();
        });

        child.on('close', (code) => {
            if (code !== 0) {
                console.error(`[Gemini] Error: ${errorOutput}`);
                reject(`Gemini CLI error: ${errorOutput}`);
                return;
            }

            console.log(`[Gemini] Response received (${response.length} chars)`);
            resolve(response.trim());
        });

        child.on('error', (err) => {
            console.error(`[Gemini] Spawn error:`, err);
            reject(`Failed to execute gemini CLI: ${err.message}`);
        });
    });
});
