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
    '/opt/homebrew/bin', // Add homebrew for gemini CLI
    process.env.PATH || ''
].join(':');

const store = new Store();

// Track running processes by project path
const runningProcesses = new Map();
