# Claude Code Viewer

A web-based viewer for browsing Claude Code conversation history files. View and navigate your Claude Code project conversations through a clean, intuitive interface.

## Overview

Claude Code Viewer parses JSONL conversation files stored in `~/.claude/projects/` and presents them in a human-readable web UI. Browse projects, sessions, and detailed conversation history with support for tool usage, subtasks, and real-time file monitoring.

## Features

- **Project Browser** - View all Claude Code projects with metadata and session counts
- **Session Navigation** - Browse conversation sessions within projects with filtering options
- **Conversation Display** - Human-readable format for Claude Code logs with syntax highlighting
- **Subtask Support** - Separate display for subtasks and sidechain conversations
- **Real-time Updates** - Automatic refresh when conversation files are modified
- **File System Watching** - Monitors `~/.claude/projects/` for changes and updates the UI
- **Responsive Design** - Works on desktop and mobile devices

## Installation & Usage

### Quick Start

Run directly from GitHub without installation:

```bash
PORT=3400 npx github:d-kimuson/claude-code-viewer
```

The server will start on port 3400 (or the specified PORT). Open `http://localhost:3400` in your browser.

### Alternative Installation

Clone and run locally:

```bash
git clone https://github.com/d-kimuson/claude-code-viewer.git
cd claude-code-viewer
pnpm i
pnpm build
pnpm start
```

## Requirements

- **Node.js** 18 or later
- **Claude Code** with conversation history in `~/.claude/projects/`

## Data Source

The application reads Claude Code conversation files from:

- **Location**: `~/.claude/projects/<project>/<session-id>.jsonl`
- **Format**: JSONL files containing conversation entries
- **Auto-detection**: Automatically discovers new projects and sessions

## Usage Guide

### 1. Project List

- Browse all Claude Code projects
- View project metadata (name, path, session count, last modified)
- Click any project to view its sessions

### 2. Session Browser  

- View all conversation sessions within a project
- Filter to hide empty sessions
- Sessions show message counts and timestamps
- Click to view detailed conversation

### 3. Conversation Viewer

- Full conversation history with proper formatting
- Syntax highlighting for code blocks
- Tool usage and results clearly displayed
- Navigation sidebar for jumping between sessions
- Support for different message types (user, assistant, system, tools)

## Configuration

### Port Configuration

Set a custom port using the `PORT` environment variable:

```bash
PORT=8080 npx github:d-kimuson/claude-code-viewer
```

### Data Directory

The application automatically detects the standard Claude Code directory at `~/.claude/projects/`. No additional configuration is required.

## Browser Support

- Chrome/Chromium 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Troubleshooting

### No Projects Found

- Ensure Claude Code has been used and has created conversation files
- Check that `~/.claude/projects/` exists and contains project directories
- Verify file permissions allow reading the projects directory

### Connection Issues

- Check that the specified port is not in use
- Ensure firewall settings allow local connections
- Try a different port using the `PORT` environment variable

### Real-time Updates Not Working

- The application uses Server-Sent Events for real-time updates
- Some browsers or network configurations may block SSE connections
- Refresh the page manually to see latest changes

## License

This project is available under the MIT License. See the LICENSE file for details.

## Contributing

See [docs/dev.md](docs/dev.md) for development setup and contribution guidelines.
