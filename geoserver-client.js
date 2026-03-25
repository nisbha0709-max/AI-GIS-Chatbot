class GeoServerClient {
    constructor() {
        this.config = window.GIS_CONFIG.geoserver;
        this.layers = new Map();
        this.featureCache = new Map();
    }

    getWMSUrl(layerName, params = {}) {
        const defaultParams = {
            service: 'WMS',
            version: '1.1.0',
            request: 'GetMap',
            layers: `${this.config.workspace}:${layerName}`,
            format: this.config.formats.wms,
            transparent: true,
            width: 256,
            height: 256,
            srs: 'EPSG:4326'
        };

        const mergedParams = { ...defaultParams, ...params };
        const queryString = Object.entries(mergedParams)
            .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
            .join('&');

        return `${this.config.url}/wms?${queryString}`;
    }

    getWFSUrl(params = {}) {
        const defaultParams = {
            service: 'WFS',
            version: '1.1.0',
            request: 'GetFeature',
            typeName: `${this.config.workspace}:${params.typeName || 'layer'}`,
            outputFormat: this.config.formats.wfs,
            srsName: 'EPSG:4326'
        };

        if (params.bbox) {
            defaultParams.bbox = params.bbox.join(',');
        }

        if (params.maxFeatures) {
            defaultParams.maxFeatures = params.maxFeatures;
        }

        const mergedParams = { ...defaultParams, ...params };
        const queryString = Object.entries(mergedParams)
            .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
            .join('&');

        return `${this.config.url}/wfs?${queryString}`;
    }

    async fetchFeatures(layerName, options = {}) {
        const cacheKey = `${layerName}_${JSON.stringify(options)}`;
        
        if (this.featureCache.has(cacheKey)) {
            return this.featureCache.get(cacheKey);
        }

        try {
            const bbox = options.bbox || [-180, -90, 180, 90];
            const url = this.getWFSUrl({
                typeName: layerName,
                bbox: bbox,
                maxFeatures: options.maxFeatures || 1000
            });

            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`GeoServer request failed: ${response.status}`);
            }

            const data = await response.json();
            const features = this.parseGeoJSON(data);
            
            this.featureCache.set(cacheKey, features);
            return features;
        } catch (error) {
            console.warn(`Failed to fetch from GeoServer, using sample data: ${error.message}`);
            return this.getSampleFeatures(layerName);
        }
    }

    parseGeoJSON(geoServerData) {
        if (geoServerData.type === 'FeatureCollection') {
            return geoServerData.features.map(f => ({
                type: 'Feature',
                geometry: f.geometry,
                properties: {
                    ...f.properties,
                    id: f.id
                }
            }));
        }
        return [];
    }

    async loadTamilNaduAccidents() {
        try {
            const response = await fetch('./datasets/tamilnadu_accidents.geojson');
            if (!response.ok) throw new Error('Failed to load Tamil Nadu accidents');
            const data = await response.json();
            return data.features || [];
        } catch (error) {
            console.warn('Failed to load Tamil Nadu data, using fallback:', error);
            return this.generateTamilNaduAccidents();
        }
    }

    generateTamilNaduAccidents() {
        const districts = ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'Vellore', 'Erode', 'Tirunelveli', 'Dindigul', 'Kancheepuram', 'Thanjavur', 'Karur', 'Namakkal', 'Dharmapuri', 'Krishnagiri', 'Thoothukudi', 'Cuddalore', 'Nagapattinam', 'Villupuram'];
        const severities = ['Minor', 'Major', 'Fatal'];
        const roads = ['National Hwy', 'State Hwy', 'City Road', 'Village Road', 'Bypass', 'Junction'];
        const weathers = ['Clear', 'Rain', 'Cloudy', 'Fog'];
        const lights = ['Daylight', 'Night-Lit', 'Night-Unlit', 'Dawn/Dusk'];
        const causes = ['Overspeeding', 'Drunk Driving', 'Brake Failure', 'Wrong Turn', 'Distracted Driving', 'Lane Change', 'Poor Visibility', 'Road Damage', 'Animal Crossing', 'Pedestrian Crossing'];
        
        const accidents = [];
        const centerLat = 11.1271;
        const centerLng = 78.6569;
        const spread = 6;
        
        for (let i = 0; i < 200; i++) {
            const lat = centerLat + (Math.random() - 0.5) * spread;
            const lng = centerLng + (Math.random() - 0.5) * spread;
            const severity = severities[Math.floor(Math.random() * severities.length)];
            
            accidents.push({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [lng, lat] },
                properties: {
                    id: `TNACC${String(i + 1).padStart(4, '0')}`,
                    date: this.randomDate(2024, 2025),
                    time: `${String(Math.floor(Math.random() * 24)).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`,
                    district: districts[Math.floor(Math.random() * districts.length)],
                    severity: severity,
                    vehicles: ['Car', 'Truck', 'Two Wheeler', 'Auto', 'Bus', 'Van', 'Bicycle'][Math.floor(Math.random() * 7)],
                    roadtype: roads[Math.floor(Math.random() * roads.length)],
                    weather: weathers[Math.floor(Math.random() * weathers.length)],
                    lightcond: lights[Math.floor(Math.random() * lights.length)],
                    fatals: severity === 'Fatal' ? Math.floor(Math.random() * 5) + 1 : 0,
                    injuries: severity === 'Major' ? Math.floor(Math.random() * 5) + 1 : (severity === 'Minor' ? Math.floor(Math.random() * 3) : 0),
                    cause: causes[Math.floor(Math.random() * causes.length)]
                }
            });
        }
        return accidents;
    }

    getSampleFeatures(layerId) {
        if (layerId === 'tamilnadu_accidents' || layerId === 'accidents') {
            const cached = this.featureCache.get('tamilnadu_accidents');
            if (cached) return cached;
            
            const accidents = this.generateTamilNaduAccidents();
            this.featureCache.set('tamilnadu_accidents', accidents);
            return accidents;
        }

        const sampleData = this.getSampleData();
        
        if (layerId === 'all' || !layerId) {
            return Object.values(sampleData).flat();
        }

        return sampleData[layerId] || sampleData.accidents;
    }

    getSampleData() {
        const centerLat = 11.1271;
        const centerLng = 78.6569;

        const accidents = this.generateTamilNaduAccidents();

        // Fire Stations Dataset
        const fireStations = [
            { coords: [-74.0060, 40.7128], name: 'Downtown Fire Station', capacity: 500, status: 'active' },
            { coords: [-73.9857, 40.7484], name: 'Midtown Fire Station', capacity: 350, status: 'active' },
            { coords: [-73.9712, 40.7614], name: 'Upper East Station', capacity: 400, status: 'active' },
            { coords: [-73.9442, 40.6782], name: 'Brooklyn Station', capacity: 450, status: 'active' },
            { coords: [-73.7949, 40.7282], name: 'Queens Station', capacity: 380, status: 'active' },
            { coords: [-73.8648, 40.8448], name: 'Bronx Station', capacity: 420, status: 'standby' },
            { coords: [-74.0124, 40.7061], name: 'Financial District', capacity: 320, status: 'active' },
            { coords: [-73.9595, 40.7736], name: 'Upper West Station', capacity: 360, status: 'active' }
        ].map((station, i) => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: station.coords },
            properties: {
                id: `fs_${i + 1}`,
                name: station.name,
                capacity: station.capacity,
                status: station.status,
                vehicles: Math.floor(Math.random() * 4) + 3
            }
        }));

        const schools = this.generatePointFeatures(centerLat, centerLng, 25, {
            id: 'schools',
            properties: {
                name: () => this.randomName('School'),
                type: () => ['elementary', 'middle', 'high', 'university'][Math.floor(Math.random() * 4)],
                students: () => Math.floor(Math.random() * 2000) + 100
            }
        });

        const hospitals = this.generatePointFeatures(centerLat, centerLng, 15, {
            id: 'hospitals',
            properties: {
                name: () => this.randomName('Hospital'),
                beds: () => Math.floor(Math.random() * 500) + 50,
                type: () => ['general', 'specialty', 'trauma'][Math.floor(Math.random() * 3)]
            }
        });

        const parks = this.generatePolygonFeatures(centerLat, centerLng, 20, {
            id: 'parks',
            properties: {
                name: () => this.randomName('Park'),
                area: () => Math.floor(Math.random() * 50) + 1,
                type: () => ['public', 'national', 'state', 'community'][Math.floor(Math.random() * 4)]
            }
        });

        const buildings = this.generatePolygonFeatures(centerLat, centerLng, 80, {
            id: 'buildings',
            properties: {
                height: () => Math.floor(Math.random() * 200) + 5,
                type: () => ['residential', 'commercial', 'industrial'][Math.floor(Math.random() * 3)],
                year_built: () => 1900 + Math.floor(Math.random() * 124)
            }
        });

        const roads = this.generateLineFeatures(centerLat, centerLng, 50, {
            id: 'roads',
            properties: {
                name: () => ['Main St', 'Oak Ave', 'Highway 1', 'Park Blvd'][Math.floor(Math.random() * 4)],
                type: () => ['primary', 'secondary', 'tertiary'][Math.floor(Math.random() * 3)],
                lanes: () => Math.floor(Math.random() * 4) + 1
            }
        });

        return { accidents, schools, hospitals, parks, buildings, roads, fireStations };
    }

    generatePointFeatures(centerLat, centerLng, count, options) {
        const features = [];
        const spread = 0.15;

        for (let i = 0; i < count; i++) {
            const lat = centerLat + (Math.random() - 0.5) * spread * 2;
            const lng = centerLng + (Math.random() - 0.5) * spread * 2;

            const properties = {};
            for (const [key, valueFn] of Object.entries(options.properties)) {
                properties[key] = typeof valueFn === 'function' ? valueFn() : valueFn;
            }

            features.push({
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [lng, lat]
                },
                properties: {
                    id: `${options.id}_${i}`,
                    ...properties
                }
            });
        }

        return features;
    }

    generatePolygonFeatures(centerLat, centerLng, count, options) {
        const features = [];

        for (let i = 0; i < count; i++) {
            const baseLng = centerLng + (Math.random() - 0.5) * 0.3;
            const baseLat = centerLat + (Math.random() - 0.5) * 0.3;
            const size = 0.002 + Math.random() * 0.005;

            const coordinates = [
                [baseLng, baseLat],
                [baseLng + size, baseLat],
                [baseLng + size, baseLat + size],
                [baseLng, baseLat + size],
                [baseLng, baseLat]
            ].map(coord => [parseFloat(coord[0].toFixed(6)), parseFloat(coord[1].toFixed(6))]);

            const properties = {};
            for (const [key, valueFn] of Object.entries(options.properties)) {
                properties[key] = typeof valueFn === 'function' ? valueFn() : valueFn;
            }

            features.push({
                type: 'Feature',
                geometry: {
                    type: 'Polygon',
                    coordinates: [coordinates]
                },
                properties: {
                    id: `${options.id}_${i}`,
                    ...properties
                }
            });
        }

        return features;
    }

    generateLineFeatures(centerLat, centerLng, count, options) {
        const features = [];

        for (let i = 0; i < count; i++) {
            const startLng = centerLng + (Math.random() - 0.5) * 0.3;
            const startLat = centerLat + (Math.random() - 0.5) * 0.3;
            const length = 0.01 + Math.random() * 0.02;
            const angle = Math.random() * Math.PI * 2;

            const coordinates = [
                [startLng, startLat],
                [
                    parseFloat((startLng + Math.cos(angle) * length).toFixed(6)),
                    parseFloat((startLat + Math.sin(angle) * length).toFixed(6))
                ]
            ];

            const properties = {};
            for (const [key, valueFn] of Object.entries(options.properties)) {
                properties[key] = typeof valueFn === 'function' ? valueFn() : valueFn;
            }

            features.push({
                type: 'Feature',
                geometry: {
                    type: 'LineString',
                    coordinates
                },
                properties: {
                    id: `${options.id}_${i}`,
                    ...properties
                }
            });
        }

        return features;
    }

    randomDate(startYear = 2020, endYear = new Date().getFullYear()) {
        const start = new Date(startYear, 0, 1);
        const end = new Date(endYear, 11, 31);
        const date = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
        return date.toISOString().split('T')[0];
    }

    randomName(prefix) {
        const names = ['Central', 'North', 'South', 'East', 'West', 'Park', 'Green', 'Oak', 'Maple', 'River'];
        return `${names[Math.floor(Math.random() * names.length)]} ${prefix}`;
    }

    registerLayer(name, url, options = {}) {
        this.layers.set(name, {
            name,
            url,
            options,
            type: options.type || 'point'
        });
    }

    clearCache() {
        this.featureCache.clear();
    }
}

window.GeoServerClient = GeoServerClient;
