# gitX Manager

A powerful, cross-platform Git repository management dashboard built with Electron, React, and Tailwind CSS. Manage all your development projects from one beautiful interface with integrated terminal support and AI-powered debugging assistance.

![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)
![Electron](https://img.shields.io/badge/Electron-28.0.0-47848F?logo=electron)
![React](https://img.shields.io/badge/React-18.2.0-61DAFB?logo=react)

## ✨ Features

### 🚀 Project Management
- **One-Click Git Cloning**: Paste any Git repository URL and clone it directly to your preferred directory
- **Auto-Detection**: Automatically detects project type (Node.js, Python, Rust, Go, Docker)
- **Dependency Installation**: Auto-installs dependencies based on project type
  - Node.js: `npm install`
  - Python: `pip install -r requirements.txt`
  - Rust: `cargo build`
  - Go: `go mod download`
  - Docker: `docker-compose up --no-start`

### 📊 Dashboard Interface
- **Project Overview**: Clean table view showing all your projects at a glance
- **Real-time Status**: Live status indicators (Running/Stopped) for each project
- **Search & Filter**: Quickly find projects by name or path
- **Branch Tracking**: See the current Git branch for each project
- **Port Detection**: Automatically detects and displays development server ports

### 🎮 Project Controls
- **Quick Run**: Launch projects with custom npm scripts or default commands
- **Stop Button**: Gracefully terminate running processes
- **Update Projects**: Pull latest changes and reinstall dependencies with one click
- **Open in Finder**: Quick access to project folders in your file system

### 💻 Integrated Terminal
- **xterm.js Terminal**: Full-featured terminal with scrollback support
- **Live Output**: Real-time display of build logs and server output
- **Resizable Panel**: Adjust terminal height to your preference
- **Project-Specific**: Each project's output is routed to the terminal when selected

### 🤖 AI-Powered Debugging (Gemini Integration)
- **AI Mode Toggle**: Switch between normal terminal and AI assistant mode
- **Context-Aware**: Gemini CLI integration with full project context
- **Project Analysis**: Automatically includes README, package.json, and project metadata
- **Error Debugging**: Ask questions about errors directly in the terminal
- **Smart Responses**: Get debugging suggestions, code explanations, and solutions

### 🎨 Beautiful UI/UX
- **Dark Theme**: Modern dark interface optimized for long coding sessions
- **Lucide Icons**: Clean, consistent iconography throughout
- **Smooth Animations**: Polished transitions and interactions
- **Native macOS Feel**: Custom title bar with traffic light controls
- **Responsive Layout**: Adapts to different window sizes

## 🛠️ Tech Stack

- **Frontend**: React 18 with functional components and hooks
- **Desktop Framework**: Electron 28
- **Styling**: Tailwind CSS with custom design system
- **Terminal**: xterm.js with fit addon
- **Icons**: Lucide React
- **Build Tool**: Vite
- **State Management**: Electron Store for persistence
- **IPC**: Electron's main/renderer process communication

## 📦 Installation

### Prerequisites
- Node.js 16+ and npm
- Git installed and available in PATH
- (Optional) [Gemini CLI](https://github.com/google/generative-ai-docs) for AI features

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/amitrathiesh/gitX.git
   cd gitX
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run in development mode**
   ```bash
   npm run dev
   ```

   This will:
   - Start the Vite dev server on port 5173
   - Launch the Electron app
   - Enable hot-reload for React components

## 🚀 Usage

### Adding a Project

1. Paste a Git repository URL in the top input field
2. (Optional) Customize the target directory
3. Click "Add Project"
4. gitX will:
   - Clone the repository
   - Detect the project type
   - Install dependencies automatically

### Running a Project

1. Find your project in the table
2. Select a script from the dropdown (for Node.js projects)
3. Click the "Play" button
4. View live output in the integrated terminal

### Using AI Mode

1. Select a running project
2. Open the terminal panel
3. Click the "AI" button with sparkles icon
4. Type your question and press Enter
5. Get context-aware responses from Gemini

Example queries:
- "Why is my build failing?"
- "Explain this error message"
- "How do I fix this dependency issue?"
- "What does this package do?"

## 🔧 Configuration

### Project Detection
Projects are identified by key files:
- **Node.js**: `package.json`
- **Python**: `requirements.txt`
- **Rust**: `Cargo.toml`
- **Go**: `go.mod`
- **Docker**: `docker-compose.yml`

### Port Detection
Development servers are auto-detected using regex patterns:
- `localhost:PORT`
- `:PORT`
- `port PORT`

Detected ports appear in the dashboard automatically.

## 📁 Project Structure

```
gitX/
├── electron/
│   ├── main.js          # Electron main process
│   └── preload.js       # IPC bridge (context isolation)
├── src/
│   ├── components/
│   │   ├── Dashboard.jsx       # Main project list
│   │   ├── ProjectRow.jsx      # Individual project item
│   │   ├── GlobalTerminal.jsx  # Terminal with AI mode
│   │   └── TerminalView.jsx    # Terminal component
│   ├── App.jsx          # Root component
│   ├── main.jsx         # React entry point
│   └── index.css        # Global styles + Tailwind
├── package.json
├── vite.config.js
└── tailwind.config.js
```

## 🎯 Roadmap

- [ ] Multi-terminal tabs
- [ ] Custom script management
- [ ] Project templates
- [ ] Docker container management
- [ ] Git operations (commit, push, pull) UI
- [ ] Extension system for custom project types
- [ ] Project groups/workspaces
- [ ] Export/import project lists

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT License - See LICENSE file for details

## 👨‍💻 Author

Created by Antigravity

---

**Note**: This project is under active development. Some features may be experimental.
