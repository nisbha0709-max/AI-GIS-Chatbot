const CONFIG = {
    api: {
        baseUrl: 'http://localhost:3000/api',
        chatEndpoint: '/query/chat',
        layersEndpoint: '/geoserver/layers',
        featuresEndpoint: '/geoserver/features',
        timeout: 30000
    },
    geoserver: {
        url: 'http://localhost:8080/geoserver',
        workspace: 'gis_chatbot',
        formats: {
            wms: 'image/png',
            wfs: 'application/json'
        }
    },
    map: {
        center: [11.1271, 78.6569],
        zoom: 7,
        maxZoom: 18,
        minZoom: 6
    },
    analysis: {
        heatmapRadius: 25,
        heatmapBlur: 15,
        clusterMaxZoom: 14,
        clusterRadius: 50
    },
    sampleLayers: [
        {
            id: 'tamilnadu_accidents',
            name: 'Tamil Nadu Road Accidents',
            type: 'point',
            color: '#EA4335',
            icon: 'car-crash',
            attributes: ['id', 'date', 'time', 'district', 'severity', 'vehicles', 'roadtype', 'weather', 'lightcond', 'fatals', 'injuries', 'cause'],
            queries: ['accident', 'crash', 'collision', 'incident', 'road accident', 'traffic accident', 'TN']
        },
        {
            id: 'buildings',
            name: 'Buildings',
            type: 'polygon',
            color: '#4285F4',
            icon: 'building',
            attributes: ['height', 'type', 'year_built'],
            queries: ['building', 'structure', 'construction']
        },
        {
            id: 'roads',
            name: 'Road Network',
            type: 'line',
            color: '#FBBC05',
            icon: 'road',
            attributes: ['name', 'type', 'lanes'],
            queries: ['road', 'street', 'highway', 'route']
        },
        {
            id: 'parks',
            name: 'Parks & Green Spaces',
            type: 'polygon',
            color: '#34A853',
            icon: 'tree',
            attributes: ['name', 'area', 'type'],
            queries: ['park', 'green', 'recreation', 'garden']
        },
        {
            id: 'schools',
            name: 'Schools',
            type: 'point',
            color: '#9C27B0',
            icon: 'school',
            attributes: ['name', 'type', 'students'],
            queries: ['school', 'education', 'university', 'college']
        },
        {
            id: 'hospitals',
            name: 'Hospitals',
            type: 'point',
            color: '#FF5722',
            icon: 'hospital',
            attributes: ['name', 'beds', 'type'],
            queries: ['hospital', 'health', 'medical', 'clinic']
        },
        {
            id: 'fireStations',
            name: 'Fire Stations',
            type: 'point',
            color: '#FF0000',
            icon: 'fire-extinguisher',
            attributes: ['name', 'capacity', 'status', 'vehicles'],
            queries: ['fire', 'fire station', 'firefighter', 'rescue']
        }
    ],
    nlp: {
        keywords: {
            location: ['where', 'location', 'area', 'region', 'zone', 'near', 'nearby'],
            count: ['how many', 'count', 'number', 'total', 'quantity'],
            analysis: ['hotspot', 'cluster', 'density', 'pattern', 'concentration'],
            comparison: ['compare', 'difference', 'more', 'less', 'vs', 'versus'],
            filter: ['show', 'filter', 'only', 'except', 'excluding'],
            time: ['when', 'year', 'date', 'time', 'recent', 'old'],
            stats: ['statistics', 'stats', 'average', 'mean', 'sum', 'total'],
            fire: ['fire', 'fire station', 'firefighter', 'rescue', 'emergency']
        },
        actions: {
            heatmap: ['heatmap', 'heat', 'density map', 'hotspot'],
            list: ['list', 'show', 'display', 'find', 'get'],
            analyze: ['analyze', 'analysis', 'analyse', 'examine', 'study'],
            summarize: ['summarize', 'summary', 'overview', 'insights'],
            route: ['route', 'direction', 'navigate', 'path']
        }
    }
};

window.GIS_CONFIG = CONFIG;
