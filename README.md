# Smart GIS Chatbot

An AI-powered conversational GIS chatbot that allows users to ask questions in simple English and receive meaningful, data-driven spatial insights.

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Server
```bash
npm start
```

### 3. Open in Browser
```
http://localhost:3000
```

## Features

- **Natural Language Processing**: Ask questions like "Where are accident hotspots?"
- **Real-time GIS Analysis**: Automated heatmaps, density maps, and clustering
- **GeoServer Integration**: WMS/WFS support for map layers
- **AI-Powered Insights**: Plain language summaries of spatial analysis
- **Interactive Map**: Full-screen map with layer controls
- **Voice Input**: Speech-to-text support using Web Speech API

## Supported Queries

| Query Type | Example |
|------------|---------|
| Hotspots | "Where are accident hotspots?" |
| Count | "How many schools are there?" |
| Density | "What is the density of hospitals?" |
| Nearby | "Find hospitals near Times Square" |
| Filter | "Show only high severity accidents" |
| Statistics | "Summarize crime statistics" |

## Available Layers

- Traffic Accidents (with severity levels)
- Buildings
- Road Network
- Parks & Green Spaces
- Schools
- Hospitals
- Crime Data
- Traffic Patterns

## Project Structure

```
GIS-2/
├── index.html          # Main application
├── styles.css          # Styling
├── app.js              # Main app logic
├── chatbot.js          # Chat interface
├── config.js           # Configuration
├── nlp-engine.js       # Frontend NLP
├── geoserver-client.js # GeoServer client
├── analysis-engine.js   # Spatial analysis
├── insights-generator.js # Insights
├── server.js           # Backend server
├── src/                # Backend source
│   ├── config/         # Configuration
│   ├── services/       # Business logic
│   └── utils/          # Utilities
├── presentation.html   # Slides
├── package.json        # Dependencies
└── README.md           # Documentation
```

## API Endpoints

### POST /api/chat
Process natural language queries
```bash
curl -X POST http://localhost:3000/api/chat -H "Content-Type: application/json" -d '{"message": "Where are accident hotspots?"}'
```

### GET /api/layers
Get available layers
```bash
curl http://localhost:3000/api/layers
```

### GET /api/features/:layer
Get features from a layer
```bash
curl http://localhost:3000/api/features/accidents
```

### GET /api/health
Health check
```bash
curl http://localhost:3000/api/health
```

## Development

```bash
# Install dependencies
npm install

# Start server
npm start

# Development mode (auto-reload)
npm run dev
```

## Tech Stack

- **Frontend**: HTML5, CSS3, JavaScript ES6+, Leaflet.js
- **Backend**: Node.js, Express.js
- **GIS**: GeoServer (WMS/WFS), Sample data fallback
- **NLP**: Custom pattern matching engine
- **Visualization**: Heatmaps, Marker Clusters, Density Contours

## License

MIT
