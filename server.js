require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const rateLimit = require('express-rate-limit');
const path = require('path');
const logger = require('./src/utils/logger');
const GeoServerService = require('./src/services/geoserver');
const NLPService = require('./src/services/nlp');
const AnalysisService = require('./src/services/analysis');
const InsightsService = require('./src/services/insights');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3000;

const geoserver = new GeoServerService();
const nlp = new NLPService();
const analysis = new AnalysisService();
const insights = new InsightsService();
const queryHistory = new Map();

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Too many requests, please try again later.' }
});

app.use(cors());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true }));

app.use((req, res, next) => {
    logger.info(`${req.method} ${req.path}`);
    next();
});

app.use(express.static(path.join(__dirname)));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/presentation', (req, res) => {
    res.sendFile(path.join(__dirname, 'presentation.html'));
});

app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: '1.0.0'
    });
});

app.get('/api/layers', async (req, res) => {
    try {
        const layers = await geoserver.getLayers();
        res.json({ success: true, layers, count: layers.length });
    } catch (error) {
        logger.error('Failed to get layers:', error);
        res.status(500).json({ error: 'Failed to retrieve layers' });
    }
});

app.get('/api/features/:layer', async (req, res) => {
    try {
        const { layer } = req.params;
        const { bbox, limit } = req.query;
        const features = await geoserver.getFeatures(layer, { bbox, limit });
        res.json(features);
    } catch (error) {
        logger.error('Failed to get features:', error);
        res.status(500).json({ error: 'Failed to retrieve features' });
    }
});

app.post('/api/chat', async (req, res) => {
    try {
        const { message, sessionId, context } = req.body;

        if (!message) {
            return res.status(400).json({ success: false, error: 'Message is required' });
        }

        const session = sessionId || uuidv4();
        const parsedQuery = nlp.parseQuery(message);

        let features = [];
        for (const layer of parsedQuery.layers) {
            const layerData = await geoserver.getFeatures(layer.id);
            features = features.concat(layerData.features || []);
        }

        const result = await analysis.processQuery(parsedQuery, {
            ...context,
            session,
            center: context?.center
        });

        const insightResult = insights.generate(result);

        const queryRecord = {
            id: uuidv4(),
            session,
            message,
            parsed: parsedQuery,
            result,
            insights: insightResult,
            timestamp: new Date().toISOString()
        };

        if (queryHistory.has(session)) {
            const history = queryHistory.get(session);
            history.push(queryRecord);
            if (history.length > 100) history.shift();
        } else {
            queryHistory.set(session, [queryRecord]);
        }

        res.json({
            success: true,
            sessionId: session,
            query: message,
            parsed: {
                intent: parsedQuery.intent,
                layers: parsedQuery.layers,
                confidence: parsedQuery.confidence,
                parameters: parsedQuery.parameters
            },
            result: {
                features: result.features.slice(0, 100),
                totalFeatures: result.features.length,
                hotspots: result.hotspots?.slice(0, 10),
                statistics: result.statistics,
                summary: result.summary
            },
            insights: insightResult,
            mapAction: result.mapAction,
            context: {
                layers: parsedQuery.layers.map(l => l.id),
                intent: parsedQuery.intent,
                confidence: parsedQuery.confidence
            }
        });
    } catch (error) {
        logger.error('Chat query error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/nlp/parse', (req, res) => {
    try {
        const { query } = req.body;
        if (!query) {
            return res.status(400).json({ success: false, error: 'Query is required' });
        }
        const parsed = nlp.parseQuery(query);
        res.json({ success: true, ...parsed });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/analysis/hotspots', async (req, res) => {
    try {
        const { layer, parameters } = req.body;
        if (!layer) {
            return res.status(400).json({ success: false, error: 'Layer is required' });
        }
        const features = await geoserver.getFeatures(layer);
        const result = await analysis.findHotspots(features.features, parameters || {});
        res.json({ success: true, hotspots: result.hotspots, statistics: result.statistics, mapAction: result.mapAction });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/analysis/density', async (req, res) => {
    try {
        const { layer, resolution } = req.body;
        if (!layer) {
            return res.status(400).json({ success: false, error: 'Layer is required' });
        }
        const features = await geoserver.getFeatures(layer);
        const result = await analysis.densityAnalysis(features.features, { resolution });
        res.json({ success: true, densityGrid: result.densityGrid, contours: result.contours, spread: result.spread, mapAction: result.mapAction });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/analysis/nearby', async (req, res) => {
    try {
        const { layer, center, radius } = req.body;
        if (!layer || !center) {
            return res.status(400).json({ success: false, error: 'Layer and center are required' });
        }
        const features = await geoserver.getFeatures(layer);
        const result = await analysis.findNearby(features.features, { distance: { value: radius || 5, unit: 'km' } }, { center });
        res.json({ success: true, features: result.features, center: result.center, radius: result.radius, mapAction: result.mapAction });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/analysis/filter', async (req, res) => {
    try {
        const { layer, filters } = req.body;
        if (!layer) {
            return res.status(400).json({ success: false, error: 'Layer is required' });
        }
        const features = await geoserver.getFeatures(layer);
        const result = analysis.filterFeatures(features.features, filters || {}, {});
        res.json({ success: true, features: result.features, statistics: result.statistics, mapAction: result.mapAction });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.use((err, req, res, next) => {
    logger.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error', message: err.message });
});

app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

app.listen(PORT, () => {
    logger.info(`========================================`);
    logger.info(`  Smart GIS Chatbot Server`);
    logger.info(`========================================`);
    logger.info(`  Server running at: http://localhost:${PORT}`);
    logger.info(`  Frontend:           http://localhost:${PORT}/`);
    logger.info(`  Presentation:      http://localhost:${PORT}/presentation`);
    logger.info(`  Health Check:      http://localhost:${PORT}/api/health`);
    logger.info(`  Layers API:        http://localhost:${PORT}/api/layers`);
    logger.info(`========================================`);
    console.log(`\n  Server is running! Open: http://localhost:${PORT}\n`);
});

module.exports = app;
