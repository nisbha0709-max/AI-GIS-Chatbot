# Smart GIS Chatbot - Quick Start Guide

## Prerequisites
- Node.js 18+ installed
- VS Code installed

## How to Run (3 Simple Steps)

### Step 1: Open Terminal in VS Code
- Open VS Code
- Open the project folder: `File > Open Folder > C:\Users\nithi\Downloads\GIS-2`
- Open terminal: `View > Terminal` or press `` Ctrl+` ``

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Start the Server
```bash
npm start
```

## Access the Application

Once running, you'll see:
```
========================================
  Smart GIS Chatbot Server
========================================
  Server running at: http://localhost:3000
  Frontend:           http://localhost:3000/
  Presentation:       http://localhost:3000/presentation
  Health Check:      http://localhost:3000/api/health
  Layers API:        http://localhost:3000/api/layers
========================================
```

Open **http://localhost:3000** in your browser!

## Available URLs

| URL | Description |
|-----|-------------|
| http://localhost:3000 | Main Chatbot Application |
| http://localhost:3000/presentation | Project Presentation |
| http://localhost:3000/api/health | API Health Check |
| http://localhost:3000/api/layers | Available Layers |
| http://localhost:3000/api/features/:layer | Get Features |

## Example API Calls

### Chat Query
```bash
curl -X POST http://localhost:3000/api/chat -H "Content-Type: application/json" -d "{\"message\": \"Where are accident hotspots?\"}"
```

### Get Layers
```bash
curl http://localhost:3000/api/layers
```

### Get Features
```bash
curl http://localhost:3000/api/features/accidents
```

## Development Mode (Auto-reload)
```bash
npm run dev
```

## Troubleshooting

### Port already in use?
```bash
# Find and kill the process using port 3000
# Windows:
netstat -ano | findstr :3000
taskkill /PID <pid> /F

# Or use a different port:
PORT=3001 npm start
```

### Module not found errors?
```bash
npm install
```

### Need to restart?
Press `Ctrl+C` to stop, then `npm start` to restart.
