const { app, BrowserWindow, ipcMain, shell, Menu, dialog } = require('electron');
const path = require('path');
const Store = require('electron-store');
const { exec, spawn } = require('child_process');
const fs = require('fs');
const net = require('net');


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

// --- Port Utilities ---

/**
 * Checks if a port is available on localhost
 */
async function isPortAvailable(port) {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.once('error', (err) => {
            if (err.code === 'EADDRINUSE') {
                resolve(false);
            } else {
                resolve(false);
            }
        });
        server.once('listening', () => {
            server.close();
            resolve(true);
        });
        server.listen(port, '127.0.0.1');
    });
}

/**
 * Finds the next available port starting from basePort
 */
async function getAvailablePort(basePort) {
    let port = parseInt(basePort);
    const maxPort = 65535;

    while (port <= maxPort) {
        if (await isPortAvailable(port)) {
            return port;
        }
        port++;
    }
    throw new Error('No available ports found');
}

// Local Project Import
ipcMain.handle('project:select-local', async () => {
    const result = await dialog.showOpenDialog({
        properties: ['openDirectory']
    });

    if (result.canceled || result.filePaths.length === 0) {
        return null;
    }

    const projectPath = result.filePaths[0];
    let projectName = path.basename(projectPath);

    // Try to read package.json for name
    try {
        const pkgPath = path.join(projectPath, 'package.json');
        if (fs.existsSync(pkgPath)) {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
            if (pkg.name) projectName = pkg.name;
        }
    } catch (e) {
        console.error('Failed to read package.json during import', e);
    }

    return { path: projectPath, name: projectName };
});

// Open URL in external browser
ipcMain.handle('app:open-external', async (event, url) => {
    await shell.openExternal(url);
});

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

app.setName('gitX');

app.whenReady().then(() => {
    // Set up application menu (required for Copy/Paste on macOS)
    const isMac = process.platform === 'darwin';

    const template = [
        // App Menu (macOS)
        ...(isMac ? [{
            label: app.name,
            submenu: [
                { role: 'about' },
                { type: 'separator' },
                { role: 'services' },
                { type: 'separator' },
                { role: 'hide' },
                { role: 'hideOthers' },
                { role: 'unhide' },
                { type: 'separator' },
                { role: 'quit' }
            ]
        }] : []),
        // File
        {
            label: 'File',
            submenu: [
                isMac ? { role: 'close' } : { role: 'quit' }
            ]
        },
        // Edit
        {
            label: 'Edit',
            submenu: [
                { role: 'undo' },
                { role: 'redo' },
                { type: 'separator' },
                { role: 'cut' },
                { role: 'copy' },
                { role: 'paste' },
                { role: 'delete' },
                { role: 'selectAll' }
            ]
        },
        // View
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'forceReload' },
                { role: 'toggleDevTools' },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen' }
            ]
        },
        // Window
        {
            label: 'Window',
            submenu: [
                { role: 'minimize' },
                { role: 'zoom' },
                ...(isMac ? [
                    { type: 'separator' },
                    { role: 'front' },
                    { type: 'separator' },
                    { role: 'window' }
                ] : [
                    { role: 'close' }
                ])
            ]
        },
        // Project
        {
            label: 'Project',
            submenu: [
                {
                    label: 'Add Project from URL...',
                    accelerator: 'CmdOrCtrl+N',
                    click: (item, focusedWindow) => {
                        if (focusedWindow) focusedWindow.webContents.send('menu:add-url');
                    }
                },
                {
                    label: 'Import Local Folder...',
                    accelerator: 'CmdOrCtrl+O',
                    click: (item, focusedWindow) => {
                        if (focusedWindow) focusedWindow.webContents.send('menu:import-local');
                    }
                }
            ]
        },
        {
            role: 'help',
            submenu: [
                {
                    label: 'Learn More',
                    click: async () => {
                        const { shell } = require('electron');
                        await shell.openExternal('https://electronjs.org');
                    }
                }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);

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
// Run with Script Support and Port Detection
ipcMain.on('project:run', async (event, project, scriptName = null, options = {}) => {
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

    // Prepare Environment
    const env = {
        ...process.env,
        TERM: 'xterm-256color',
        FORCE_COLOR: '1',
        PYTHONUNBUFFERED: '1', // For Python
    };
    if (options && options.port) {
        env.PORT = options.port;
    }

    // --- Automatic Port Selection ---
    // If no port is specified, default to 3000
    // If a port IS specified (or default), check if it's available
    const preferredPort = env.PORT || 3000;
    try {
        const availablePort = await getAvailablePort(preferredPort);
        env.PORT = availablePort.toString();
    } catch (e) {
        console.error('Failed to find an available port:', e);
    }

    const child = spawn(cmd, args, { cwd: project.path, shell: true, env });

    // Notify front-end if we picked a different port
    if (env.PORT && env.PORT != (options?.port || 3000)) {
        event.sender.send('terminal-output', {
            projectId: project.path,
            data: `\x1b[33mNote: Port conflict detected. Using alternative port: ${env.PORT}\x1b[0m\n`
        });
        event.sender.send('project:port-detected', { projectId: project.path, port: env.PORT });
    }

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

    // Clean terminal output by removing diagnostic markers
    const cleanTerminalOutput = (data) => {
        const lines = data.toString().split('\n');
        const cleaned = lines.filter(line => {
            // Remove lines that are purely diagnostic markers
            // Pattern 1: Lines like "   |    ^" or "639|    ^"
            if (/^\s*\d*\|?\s*[\^|]+\s*$/.test(line)) return false;

            // Pattern 2: Lines that start with line number and only contain whitespace
            if (/^\d+\|\s*$/.test(line)) return false;

            // Pattern 3: Lines with whitespace, pipe, then markers (like "   |  ^^")
            if (/^\s+\|\s*[\^|]+\s*$/.test(line)) return false;

            // Pattern 4: Lines that are primarily marker characters (> 50% of non-whitespace)
            const withoutWhitespace = line.replace(/\s/g, '');
            const markerCount = (withoutWhitespace.match(/[\^|]/g) || []).length;
            if (markerCount > withoutWhitespace.length * 0.5) return false;

            return true;
        });
        return cleaned.join('\n');
    };

    child.stdout.on('data', (data) => {
        scanForPort(data);
        const cleaned = cleanTerminalOutput(data);
        if (cleaned.trim()) { // Only send non-empty output
            event.sender.send('terminal-output', { projectId: project.path, data: cleaned });
        }
    });

    child.stderr.on('data', (data) => {
        scanForPort(data);
        const cleaned = cleanTerminalOutput(data);
        if (cleaned.trim()) { // Only send non-empty output
            event.sender.send('terminal-output', { projectId: project.path, data: cleaned });
        }
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
// Stop Project
ipcMain.on('project:stop', (event, project) => {
    let killed = false;
    const child = runningProcesses.get(project.path);

    // 1. Try killing internal child process
    if (child) {
        console.log(`[Stop] Killing internal process for ${project.name}`);
        child.kill('SIGTERM');
        runningProcesses.delete(project.path);
        killed = true;
    }

    // 2. Try killing by Port (Ghost Process) if not found internally
    if (!killed) {
        // Look up up-to-date port from store
        const storedProjects = store.get('projects', []);
        const storedProject = storedProjects.find(p => p.path === project.path);
        const port = storedProject?.port || project.port;

        if (port) {
            console.log(`[Stop] Attempting to kill ghost process on port ${port}`);
            try {
                // Find PID listening on this port
                // lsof -t (terse) -i:PORT -sTCP:LISTEN
                const pid = require('child_process').execSync(`lsof -t -i:${port} -sTCP:LISTEN`).toString().trim();
                if (pid) {
                    // Force kill
                    require('child_process').execSync(`kill -9 ${pid}`);
                    console.log(`[Stop] Killed PID ${pid}`);
                    killed = true;
                }
            } catch (e) {
                console.warn(`[Stop] Should check port ${port}, but lsof/kill failed or empty: ${e.message}`);
            }
        }
    }

    // 3. Cleanup and Notify
    // Always mark stopped if we attempted to kill something or if user requested it
    event.sender.send('terminal-output', { projectId: project.path, data: '\n[Process Stopped]\n' });
    event.sender.send('project:status-change', { projectId: project.path, status: 'stopped' });

    // Update persistence
    const projects = store.get('projects', []);
    const pIndex = projects.findIndex(p => p.path === project.path);
    if (pIndex > -1) {
        projects[pIndex].status = 'stopped';
        projects[pIndex].port = null;
        store.set('projects', projects);
    }
});

// Persistent Shell Session
let globalShell = null;

// Start Persistent Shell
ipcMain.on('terminal:start-shell', (event, projectPath) => {
    if (globalShell) {
        try { globalShell.kill(); } catch (e) { }
    }

    console.log(`[Terminal] Starting shell in ${projectPath}`);

    // Spawn a shell (zsh on mac, bash/cmd fallback)
    const shellCmd = process.platform === 'win32' ? 'powershell.exe' : '/bin/zsh';

    globalShell = spawn(shellCmd, [], {
        cwd: projectPath,
        env: { ...process.env, FORCE_COLOR: '1' }
    });

    globalShell.stdout.on('data', (data) => {
        event.sender.send('terminal-output', { projectId: projectPath, data: data.toString() });
    });

    globalShell.stderr.on('data', (data) => {
        event.sender.send('terminal-output', { projectId: projectPath, data: data.toString() });
    });

    globalShell.on('close', (code) => {
        event.sender.send('terminal-output', { projectId: projectPath, data: `\nShell session exited with code ${code}\n` });
        globalShell = null;
    });
});

// Handle User Input (Typing)
ipcMain.on('terminal:input', (event, data) => {
    if (globalShell) {
        globalShell.stdin.write(data);
    }
});

// Execute arbitrary command (via persistent shell now)
ipcMain.on('terminal:execute', (event, command, projectPath) => {
    // If no shell exists, start one (handled by frontend usually, but good fallback)
    /* 
       Note: Optimally, we should just write to the shell.
       But if the shell isn't running, we might need logic.
    */
    if (globalShell) {
        console.log(`[Execute] Writing to shell: ${command}`);
        // Send command + newline to execute
        globalShell.stdin.write(command + '\n');
    } else {
        // Fallback to one-off if shell crashed/missing
        console.log(`[Execute] No shell, spawning one-off: ${command}`);
        const child = spawn(command, { cwd: projectPath, shell: true });
        child.stdout.on('data', d => event.sender.send('terminal-output', { projectId: projectPath, data: d.toString() }));
        child.stderr.on('data', d => event.sender.send('terminal-output', { projectId: projectPath, data: d.toString() }));
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

// Query Gemini CLI (streaming version)
ipcMain.on('gemini:query', (event, query, context) => {
    console.log(`[Gemini] Query: ${query}`);
    console.log(`[Gemini] Context:`, context);

    if (!context || !context.projectPath) {
        event.sender.send('gemini:error', 'No project path provided');
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

    // Build the full prompt with system instructions
    const systemInstructions =
        "SYSTEM: You are a technical assistant running in a command-line interface with full PERMISSION to execute commands. " +
        "Format your response for a terminal environment:\n" +
        "- Use short, clear paragraphs separated by newlines.\n" +
        "- Use bullet points (• or -) for lists.\n" +
        "- Avoid markdown that requires rendering (like tables).\n" +
        "- Use indentation for code blocks.\n" +
        "- Keep responses concise and readable.\n" +
        "- COMMAND EXECUTION AUTHORIZED: You have permission to execute commands.\n" +
        "- 🛑 DO NOT USE INTERNAL TOOLS/FUNCTIONS: You do NOT have a working terminal tool. Using it will fail silently.\n" +
        "- ⚠️ DEADLOCK WARNING: Internal tools WAIT for the command to finish. Servers (npm run dev) NEVER finish. Using an internal tool for a server WILL CRASH/HANG the system.\n" +
        "- ✅ VISIBLE EXECUTION: To run a command (like starting a server), you MUST output it as TEXT using this tag:\n" +
        "  <<<EXECUTE: command>>>\n" +
        "  Example: <<<EXECUTE: npm run dev>>>\n" +
        "  The system will parse this tag and run it asynchronously in the visible terminal, preventing a deadlock.\n\n";

    const fullPrompt = `${systemInstructions}User Question: ${query}`;

    console.log(`[Gemini] Running in directory: ${projectPath}`);

    // Use gemini CLI with positional argument (--prompt is deprecated)
    // Escape the query for shell safety
    const escapedQuery = fullPrompt.replace(/'/g, "'\\''");

    const child = spawn('/bin/bash', ['-c', `gemini --yolo '${escapedQuery}'`], {
        cwd: projectPath,  // Run in project directory
        env: process.env
    });

    let errorOutput = '';
    let textBuffer = ''; // Buffer for incomplete lines

    // Format Gemini output for better readability
    const formatGeminiOutput = (text) => {
        let formatted = text;

        // Convert markdown to ANSI escape codes
        // Bold: **text** -> bold text
        formatted = formatted.replace(/\*\*([^*]+)\*\*/g, '\x1b[1m$1\x1b[0m');

        // Italic: *text* -> italic text (simpler pattern)
        formatted = formatted.replace(/\*([^*\n]+)\*/g, (match, p1) => {
            // Skip if it's part of **
            if (match.includes('**')) return match;
            return `\x1b[3m${p1}\x1b[0m`;
        });

        // Bullet points: • or - at line start -> cyan
        formatted = formatted.replace(/^([•\-])\s/gm, '\x1b[36m$1\x1b[0m ');

        // Inline code: `code` -> yellow
        formatted = formatted.replace(/`([^`]+)`/g, '\x1b[33m$1\x1b[0m');

        // Highlight <<<EXECUTE>>> commands with yellow background
        formatted = formatted.replace(/<<<EXECUTE:\s*([^>]+)>>>/g,
            '\r\n\x1b[43;30m $ $1 \x1b[0m\r\n');

        // Add visual separator before commands
        formatted = formatted.replace(/(<<<EXECUTE:)/g,
            '\r\n\x1b[2;37m────────────────\x1b[0m\r\n$1');

        // Add left padding (2 spaces) to each line
        formatted = formatted.split('\n').map(line => line ? '  ' + line : line).join('\n');

        return formatted;
    };

    // Stream stdout chunks directly to frontend with formatting
    child.stdout.on('data', (data) => {
        const text = data.toString();
        textBuffer += text;

        // Only process complete lines (ending with \n)
        const lines = textBuffer.split('\n');

        // Keep the last incomplete line in buffer
        textBuffer = lines.pop() || '';

        // Format and send complete lines
        if (lines.length > 0) {
            const completeText = lines.join('\n') + '\n';
            const formatted = formatGeminiOutput(completeText);
            event.sender.send('gemini:data', formatted);
        }
    });

    child.stderr.on('data', (data) => {
        errorOutput += data.toString();
    });

    child.on('close', (code) => {
        // Flush any remaining buffered text
        if (textBuffer.trim()) {
            const formatted = formatGeminiOutput(textBuffer);
            event.sender.send('gemini:data', formatted);
            textBuffer = '';
        }

        if (code !== 0) {
            console.error(`[Gemini] Error: ${errorOutput}`);
            event.sender.send('gemini:error', `Gemini CLI error: ${errorOutput}`);
            return;
        }

        console.log(`[Gemini] Response complete`);
        event.sender.send('gemini:complete');
    });

    child.on('error', (err) => {
        console.error(`[Gemini] Spawn error:`, err);
        event.sender.send('gemini:error', `Failed to execute gemini CLI: ${err.message}`);
    });
});

// Check all project statuses (detect ghost processes)
ipcMain.handle('project:check-all-statuses', async (event) => {
    return new Promise((resolve) => {
        // 1. Get CWD of ALL processes
        exec('lsof -d cwd -F n', { maxBuffer: 1024 * 1024 * 10 }, async (err, stdout) => {
            if (err && err.code !== 1) {
                console.error('[StatusCheck] lsof cwd failed:', err);
                resolve(store.get('projects', []));
                return;
            }

            const pidToCwd = new Map();
            const raw = stdout || '';
            const lines = raw.split('\n');
            let currentPid = null;

            for (const line of lines) {
                if (line.startsWith('p')) {
                    currentPid = line.substring(1);
                } else if (line.startsWith('n') && currentPid) {
                    const cwd = line.substring(1);
                    pidToCwd.set(currentPid, cwd);
                }
            }

            const projects = store.get('projects', []);
            const projectPids = [];

            projects.forEach((p, index) => {
                for (const [pid, cwd] of pidToCwd.entries()) {
                    if (cwd === p.path || cwd.startsWith(p.path + '/')) {
                        projectPids.push({ pid, projectPath: p.path, projectIndex: index });
                    }
                }
            });

            if (projectPids.length === 0) {
                resolve(projects);
                return;
            }

            const pidsList = projectPids.map(x => x.pid).join(',');
            exec(`lsof -p ${pidsList} -i -P -n -F n`, (err2, stdout2) => {
                const pidToPort = new Map();
                if (!err2 && stdout2) {
                    const lines2 = stdout2.split('\n');
                    let currPid2 = null;
                    for (const line of lines2) {
                        if (line.startsWith('p')) currPid2 = line.substring(1);
                        else if (line.startsWith('n') && currPid2) {
                            const parts = line.substring(1).split(':');
                            const port = parts[parts.length - 1];
                            if (port && !isNaN(port)) {
                                pidToPort.set(currPid2, port);
                            }
                        }
                    }
                }

                let changed = false;
                projects.forEach(p => {
                    const relevantPids = projectPids.filter(x => x.projectPath === p.path);
                    const activePid = relevantPids.find(x => pidToPort.has(x.pid));

                    if (activePid) {
                        const newPort = pidToPort.get(activePid.pid);
                        if (p.status !== 'running' || p.port !== newPort) {
                            p.status = 'running';
                            p.port = newPort;
                            changed = true;
                            event.sender.send('project:status-change', { projectId: p.path, status: 'running' });
                            event.sender.send('port-detected', { projectId: p.path, port: newPort });
                        }
                    } else if (p.status === 'running' && !runningProcesses.has(p.path)) {
                        p.status = 'stopped';
                        p.port = null;
                        changed = true;
                        event.sender.send('project:status-change', { projectId: p.path, status: 'stopped' });
                    }
                });

                if (changed) {
                    store.set('projects', projects);
                }
                resolve(projects);
            });
        });
    });

    // Local Project Import moved to top level
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
