class AnalysisEngine {
    constructor(map) {
        this.map = map;
        this.heatLayer = null;
        this.clusterGroup = null;
        this.densityLayer = null;
        this.analysisLayers = new Map();
        this.config = window.GIS_CONFIG.analysis;
    }

    createHeatmap(features, options = {}) {
        this.removeLayer('heatmap');

        const heatmapData = features
            .filter(f => f.geometry && f.geometry.type === 'Point')
            .map(f => {
                const [lng, lat] = f.geometry.coordinates;
                const intensity = this.calculateIntensity(f.properties);
                return [lat, lng, intensity];
            });

        if (heatmapData.length === 0) {
            console.warn('No point features for heatmap');
            return null;
        }

        this.heatLayer = L.heatLayer(heatmapData, {
            radius: options.radius || this.config.heatmapRadius,
            blur: options.blur || this.config.heatmapBlur,
            maxZoom: options.maxZoom || 17,
            max: options.maxIntensity || 1.0,
            gradient: {
                0.2: '#4285F4',
                0.4: '#34A853',
                0.6: '#FBBC05',
                0.8: '#FF9800',
                1.0: '#EA4335'
            }
        }).addTo(this.map);

        this.analysisLayers.set('heatmap', this.heatLayer);
        return this.heatLayer;
    }

    createClusters(features, options = {}) {
        this.removeLayer('cluster');

        this.clusterGroup = L.markerClusterGroup({
            maxClusterRadius: options.radius || this.config.clusterRadius,
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false,
            zoomToBoundsOnClick: true,
            maxZoom: options.maxZoom || this.config.clusterMaxZoom,
            iconCreateFunction: (cluster) => {
                const count = cluster.getChildCount();
                let size = 'small';
                let color = '#4285F4';

                if (count > 50) {
                    size = 'large';
                    color = '#EA4335';
                } else if (count > 20) {
                    size = 'medium';
                    color = '#FBBC05';
                }

                return L.divIcon({
                    html: `<div class="cluster-icon ${size}" style="background: ${color}">
                        <span>${count}</span>
                    </div>`,
                    className: 'custom-cluster-icon',
                    iconSize: L.point(40, 40)
                });
            }
        });

        features.forEach(feature => {
            if (feature.geometry && feature.geometry.type === 'Point') {
                const [lng, lat] = feature.geometry.coordinates;
                const marker = this.createFeatureMarker(feature);
                this.clusterGroup.addLayer(marker);
            }
        });

        this.map.addLayer(this.clusterGroup);
        this.analysisLayers.set('cluster', this.clusterGroup);
        return this.clusterGroup;
    }

    createFeatureMarker(feature) {
        const props = feature.properties;
        const layerConfig = window.GIS_CONFIG.sampleLayers.find(l => l.id === props.id?.split('_')[0]);

        let iconHtml = '<i class="fas fa-map-marker-alt"></i>';
        let color = '#4285F4';

        if (layerConfig) {
            color = layerConfig.color;
            iconHtml = `<i class="fas fa-${layerConfig.icon}"></i>`;
        }

        const icon = L.divIcon({
            html: `<div class="custom-marker" style="color: ${color}">${iconHtml}</div>`,
            className: 'custom-marker-icon',
            iconSize: L.point(30, 30),
            iconAnchor: L.point(15, 30)
        });

        const marker = L.marker([feature.geometry.coordinates[1], feature.geometry.coordinates[0]], { icon });

        const popupContent = this.generatePopupContent(feature);
        marker.bindPopup(popupContent);

        return marker;
    }

    generatePopupContent(feature) {
        const props = feature.properties;
        let content = '<div class="feature-popup">';
        content += '<h4>' + (props.name || props.id || 'Feature') + '</h4>';
        content += '<table>';

        for (const [key, value] of Object.entries(props)) {
            if (key !== 'id' && key !== 'name') {
                const formattedKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                content += `<tr><td>${formattedKey}:</td><td>${value}</td></tr>`;
            }
        }

        content += '</table></div>';
        return content;
    }

    createDensityContours(features, options = {}) {
        this.removeLayer('density');

        const points = features
            .filter(f => f.geometry && f.geometry.type === 'Point')
            .map(f => ({
                lat: f.geometry.coordinates[1],
                lng: f.geometry.coordinates[0],
                value: this.calculateIntensity(f.properties)
            }));

        if (points.length < 3) {
            console.warn('Not enough points for density analysis');
            return null;
        }

        const bounds = this.getBounds(points);
        const gridSize = 30;
        const grid = this.createDensityGrid(points, bounds, gridSize);
        const contours = this.generateContours(grid, bounds, gridSize, [0.2, 0.4, 0.6, 0.8]);

        this.densityLayer = L.layerGroup();

        contours.forEach((contour, index) => {
            const latlngs = contour.map(coord => [coord[1], coord[0]]);
            const polyline = L.polyline(latlngs, {
                color: this.getContourColor(index),
                weight: 2,
                opacity: 0.8
            });
            this.densityLayer.addLayer(polyline);
        });

        this.densityLayer.addTo(this.map);
        this.analysisLayers.set('density', this.densityLayer);
        return this.densityLayer;
    }

    createDensityGrid(points, bounds, gridSize) {
        const grid = [];
        const cellWidth = (bounds.maxLng - bounds.minLng) / gridSize;
        const cellHeight = (bounds.maxLat - bounds.minLat) / gridSize;

        for (let i = 0; i < gridSize; i++) {
            grid[i] = [];
            for (let j = 0; j < gridSize; j++) {
                const cellCenterLat = bounds.minLat + (i + 0.5) * cellHeight;
                const cellCenterLng = bounds.minLng + (j + 0.5) * cellWidth;

                let density = 0;
                points.forEach(point => {
                    const dist = this.haversineDistance(
                        cellCenterLat, cellCenterLng,
                        point.lat, point.lng
                    );
                    density += point.value / (dist + 0.001);
                });

                grid[i][j] = density;
            }
        }

        return grid;
    }

    generateContours(grid, bounds, gridSize, levels) {
        const contours = [];
        const cellWidth = (bounds.maxLng - bounds.minLng) / gridSize;
        const cellHeight = (bounds.maxLat - bounds.minLat) / gridSize;

        levels.forEach(level => {
            const maxVal = Math.max(...grid.flat());
            const threshold = level * maxVal;

            for (let i = 0; i < gridSize - 1; i++) {
                for (let j = 0; j < gridSize - 1; j++) {
                    const val = grid[i][j];
                    const valRight = grid[i][j + 1];
                    const valBottom = grid[i + 1][j];
                    const valDiag = grid[i + 1][j + 1];

                    if (val >= threshold && valRight >= threshold && valBottom >= threshold && valDiag >= threshold) {
                        const lat1 = bounds.minLat + i * cellHeight;
                        const lng1 = bounds.minLng + j * cellWidth;
                        contours.push([
                            [lng1, lat1],
                            [lng1 + cellWidth, lat1],
                            [lng1 + cellWidth, lat1 + cellHeight],
                            [lng1, lat1 + cellHeight]
                        ]);
                    }
                }
            }
        });

        return contours;
    }

    getContourColor(index) {
        const colors = ['#4285F4', '#34A853', '#FBBC05', '#EA4335'];
        return colors[index % colors.length];
    }

    getBounds(points) {
        return {
            minLat: Math.min(...points.map(p => p.lat)),
            maxLat: Math.max(...points.map(p => p.lat)),
            minLng: Math.min(...points.map(p => p.lng)),
            maxLng: Math.max(...points.map(p => p.lng))
        };
    }

    haversineDistance(lat1, lon1, lat2, lon2) {
        const R = 6371;
        const dLat = this.toRad(lat2 - lat1);
        const dLon = this.toRad(lon2 - lon1);
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    toRad(deg) {
        return deg * (Math.PI / 180);
    }

    calculateIntensity(properties) {
        let intensity = 0.5;

        if (properties.severity === 'high') intensity = 1.0;
        else if (properties.severity === 'medium') intensity = 0.6;
        else if (properties.severity === 'low') intensity = 0.3;

        if (properties.count) intensity *= Math.min(properties.count / 100, 1);
        if (properties.value) intensity *= Math.min(properties.value / 1000, 1);

        return intensity;
    }

    performHotspotAnalysis(features) {
        const hotspots = [];
        const gridSize = 0.02;

        const points = features.filter(f => f.geometry && f.geometry.type === 'Point');
        if (points.length === 0) return hotspots;

        const bounds = this.getBounds(points.map(p => ({
            lat: p.geometry.coordinates[1],
            lng: p.geometry.coordinates[0]
        })));

        for (let lat = bounds.minLat; lat < bounds.maxLat; lat += gridSize) {
            for (let lng = bounds.minLng; lng < bounds.maxLng; lng += gridSize) {
                const nearbyPoints = points.filter(p => {
                    const pLat = p.geometry.coordinates[1];
                    const pLng = p.geometry.coordinates[0];
                    return Math.abs(pLat - lat) < gridSize && Math.abs(pLng - lng) < gridSize;
                });

                if (nearbyPoints.length >= 5) {
                    const avgLat = nearbyPoints.reduce((sum, p) => sum + p.geometry.coordinates[1], 0) / nearbyPoints.length;
                    const avgLng = nearbyPoints.reduce((sum, p) => sum + p.geometry.coordinates[0], 0) / nearbyPoints.length;

                    hotspots.push({
                        location: { lat: avgLat, lng: avgLng },
                        count: nearbyPoints.length,
                        intensity: this.classifyIntensity(nearbyPoints),
                        features: nearbyPoints
                    });
                }
            }
        }

        return hotspots.sort((a, b) => b.count - a.count);
    }

    classifyIntensity(points) {
        const highSeverity = points.filter(p => p.properties.severity === 'high').length;
        const ratio = highSeverity / points.length;

        if (ratio > 0.5) return 'high';
        if (ratio > 0.25) return 'medium';
        return 'low';
    }

    calculateStatistics(features) {
        const stats = {
            total: features.length,
            byType: {},
            bySeverity: {},
            temporal: {},
            spatial: {}
        };

        features.forEach(f => {
            const props = f.properties;

            if (props.type) {
                stats.byType[props.type] = (stats.byType[props.type] || 0) + 1;
            }

            if (props.severity) {
                stats.bySeverity[props.severity] = (stats.bySeverity[props.severity] || 0) + 1;
            }

            if (props.date) {
                const year = props.date.split('-')[0];
                stats.temporal[year] = (stats.temporal[year] || 0) + 1;
            }
        });

        const points = features.filter(f => f.geometry && f.geometry.type === 'Point');
        if (points.length > 0) {
            const lats = points.map(p => p.geometry.coordinates[1]);
            const lngs = points.map(p => p.geometry.coordinates[0]);

            stats.spatial = {
                center: {
                    lat: lats.reduce((a, b) => a + b) / lats.length,
                    lng: lngs.reduce((a, b) => a + b) / lngs.length
                },
                bounds: {
                    north: Math.max(...lats),
                    south: Math.min(...lats),
                    east: Math.max(...lngs),
                    west: Math.min(...lngs)
                },
                spread: this.calculateSpread(lats, lngs)
            };
        }

        return stats;
    }

    calculateSpread(lats, lngs) {
        const latMean = lats.reduce((a, b) => a + b) / lats.length;
        const lngMean = lngs.reduce((a, b) => a + b) / lngs.length;

        const latVariance = lats.reduce((sum, lat) => sum + Math.pow(lat - latMean, 2), 0) / lats.length;
        const lngVariance = lngs.reduce((sum, lng) => sum + Math.pow(lng - lngMean, 2), 0) / lngs.length;

        return {
            latStdDev: Math.sqrt(latVariance),
            lngStdDev: Math.sqrt(lngVariance)
        };
    }

    findNearbyFeatures(center, features, radiusKm = 5) {
        return features.filter(f => {
            if (!f.geometry || f.geometry.type !== 'Point') return false;

            const [lng, lat] = f.geometry.coordinates;
            const distance = this.haversineDistance(center.lat, center.lng, lat, lng);

            return distance <= radiusKm;
        }).map(f => {
            const [lng, lat] = f.geometry.coordinates;
            return {
                ...f,
                distance: this.haversineDistance(center.lat, center.lng, lat, lng)
            };
        }).sort((a, b) => a.distance - b.distance);
    }

    compareFeatures(features1, features2) {
        const stats1 = this.calculateStatistics(features1);
        const stats2 = this.calculateStatistics(features2);

        return {
            total: {
                first: stats1.total,
                second: stats2.total,
                difference: stats2.total - stats1.total,
                percentChange: ((stats2.total - stats1.total) / stats1.total * 100).toFixed(1)
            },
            byType: this.compareCategories(stats1.byType, stats2.byType),
            spatial: {
                first: stats1.spatial,
                second: stats2.spatial
            }
        };
    }

    compareCategories(cat1, cat2) {
        const allCategories = new Set([...Object.keys(cat1), ...Object.keys(cat2)]);
        const comparison = {};

        allCategories.forEach(cat => {
            comparison[cat] = {
                first: cat1[cat] || 0,
                second: cat2[cat] || 0,
                difference: (cat2[cat] || 0) - (cat1[cat] || 0)
            };
        });

        return comparison;
    }

    removeLayer(layerName) {
        if (this.analysisLayers.has(layerName)) {
            const layer = this.analysisLayers.get(layerName);
            this.map.removeLayer(layer);
            this.analysisLayers.delete(layerName);
        }
    }

    clearAllLayers() {
        this.analysisLayers.forEach((layer, name) => {
            this.map.removeLayer(layer);
        });
        this.analysisLayers.clear();
        this.heatLayer = null;
        this.clusterGroup = null;
        this.densityLayer = null;
    }
}

window.AnalysisEngine = AnalysisEngine;
