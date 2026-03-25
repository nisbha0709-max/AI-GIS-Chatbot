class MapManager {
    constructor() {
        this.map = null;
        this.baseLayers = {};
        this.overlayLayers = new Map();
        this.currentBaseLayer = null;
        this.analysisEngine = null;
        this.userLocationMarker = null;
        this.userLocationPulse = null;
        this.watchId = null;
    }

    init() {
        const config = window.GIS_CONFIG.map;

        this.map = L.map('map-container', {
            center: config.center,
            zoom: config.zoom,
            maxZoom: config.maxZoom,
            minZoom: config.minZoom,
            zoomControl: true,
            attributionControl: true
        });

        this.setupBaseLayers();
        this.setupEventListeners();
        this.addDefaultLayers();

        this.analysisEngine = new AnalysisEngine(this.map);
        window.analysisEngine = this.analysisEngine;

        this.addMapControls();
        this.addLegend();

        return this.map;
    }

    getUserLocation() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Geolocation is not supported by your browser'));
                return;
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    resolve({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                        accuracy: position.coords.accuracy
                    });
                },
                (error) => {
                    let errorMessage = 'Unable to retrieve your location';
                    switch (error.code) {
                        case error.PERMISSION_DENIED:
                            errorMessage = 'Location access denied. Please enable location permissions.';
                            break;
                        case error.POSITION_UNAVAILABLE:
                            errorMessage = 'Location information is unavailable.';
                            break;
                        case error.TIMEOUT:
                            errorMessage = 'Location request timed out.';
                            break;
                    }
                    reject(new Error(errorMessage));
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                }
            );
        });
    }

    watchUserLocation() {
        if (!navigator.geolocation) {
            showToast('Geolocation not supported', 'error');
            return;
        }

        if (this.watchId) {
            navigator.geolocation.clearWatch(this.watchId);
        }

        this.watchId = navigator.geolocation.watchPosition(
            (position) => {
                const userLoc = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                this.showUserLocation(userLoc, false);
            },
            (error) => {
                console.warn('Watch position error:', error);
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
        );
    }

    stopWatchingLocation() {
        if (this.watchId) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }
    }

    async showMyLocation() {
        showLoading(true);
        try {
            const location = await this.getUserLocation();
            this.showUserLocation(location, true);
            showToast('Your location has been found!', 'success');
            return location;
        } catch (error) {
            showToast(error.message, 'error');
            return null;
        } finally {
            showLoading(false);
        }
    }

    showUserLocation(location, animate = true) {
        const { lat, lng, accuracy } = location;

        if (this.userLocationMarker) {
            this.map.removeLayer(this.userLocationMarker);
        }
        if (this.userLocationPulse) {
            this.map.removeLayer(this.userLocationPulse);
        }

        const pulseIcon = L.divIcon({
            html: `
                <div class="user-location-pulse ${animate ? 'animate' : ''}">
                    <div class="pulse-ring"></div>
                    <div class="pulse-ring delay-1"></div>
                    <div class="pulse-dot"></div>
                </div>
            `,
            className: 'user-location-pulse-container',
            iconSize: [50, 50],
            iconAnchor: [25, 25]
        });

        this.userLocationPulse = L.marker([lat, lng], { icon: pulseIcon, zIndexOffset: 1000 }).addTo(this.map);

        const markerIcon = L.divIcon({
            html: `
                <div class="user-location-marker ${animate ? 'bounce-in' : ''}">
                    <div class="marker-dot"></div>
                    <div class="marker-ring"></div>
                </div>
            `,
            className: 'user-marker-container',
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        });

        this.userLocationMarker = L.marker([lat, lng], { 
            icon: markerIcon,
            zIndexOffset: 1001,
            title: 'Your Location'
        }).addTo(this.map);

        this.userLocationMarker.bindPopup(`
            <div class="user-location-popup">
                <div class="popup-header">
                    <i class="fas fa-location-crosshairs"></i>
                    <strong>Your Location</strong>
                </div>
                <div class="popup-content">
                    <p><strong>Latitude:</strong> ${lat.toFixed(6)}°</p>
                    <p><strong>Longitude:</strong> ${lng.toFixed(6)}°</p>
                    ${accuracy ? `<p><strong>Accuracy:</strong> ±${Math.round(accuracy)}m</p>` : ''}
                </div>
            </div>
        `);

        if (animate) {
            this.map.flyTo([lat, lng], 15, {
                duration: 1.5,
                easeLinearity: 0.25
            });
        } else {
            this.map.setView([lat, lng], this.map.getZoom());
        }

        if (accuracy) {
            const accuracyCircle = L.circle([lat, lng], {
                radius: accuracy,
                color: '#4285F4',
                fillColor: '#4285F4',
                fillOpacity: 0.1,
                weight: 1,
                className: 'accuracy-circle'
            }).addTo(this.map);
        }
    }

    clearUserLocation() {
        if (this.userLocationMarker) {
            this.map.removeLayer(this.userLocationMarker);
            this.userLocationMarker = null;
        }
        if (this.userLocationPulse) {
            this.map.removeLayer(this.userLocationPulse);
            this.userLocationPulse = null;
        }
        this.stopWatchingLocation();
    }

    flyToLocation(location, zoom = 15) {
        if (location.lat && location.lng) {
            this.map.flyTo([location.lat, location.lng], zoom, {
                duration: 1.5
            });
        }
    }

    setupBaseLayers() {
        this.baseLayers.osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
        });

        this.baseLayers.satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
            attribution: '© Esri',
            maxZoom: 19
        });

        this.baseLayers.terrain = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenTopoMap',
            maxZoom: 17
        });

        this.currentBaseLayer = this.baseLayers.osm;
        this.currentBaseLayer.addTo(this.map);
    }

    setupEventListeners() {
        document.querySelectorAll('input[name="base-layer"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.switchBaseLayer(e.target.value);
            });
        });

        document.getElementById('heatmap-layer')?.addEventListener('change', (e) => {
            if (e.target.checked) {
                document.getElementById('cluster-layer').checked = false;
                document.getElementById('density-layer').checked = false;
            }
        });

        document.getElementById('cluster-layer')?.addEventListener('change', (e) => {
            if (e.target.checked) {
                document.getElementById('heatmap-layer').checked = false;
                document.getElementById('density-layer').checked = false;
            }
        });

        document.getElementById('density-layer')?.addEventListener('change', (e) => {
            if (e.target.checked) {
                document.getElementById('heatmap-layer').checked = false;
                document.getElementById('cluster-layer').checked = false;
            }
        });
    }

    switchBaseLayer(layerName) {
        if (this.currentBaseLayer) {
            this.map.removeLayer(this.currentBaseLayer);
        }

        this.currentBaseLayer = this.baseLayers[layerName];
        this.currentBaseLayer.addTo(this.map);
    }

    addDefaultLayers() {
        const sampleLayers = window.GIS_CONFIG.sampleLayers;
        const geoServerClient = new GeoServerClient();

        sampleLayers.forEach(layer => {
            const wmsUrl = geoServerClient.getWMSUrl(layer.id);
            const wmsLayer = L.tileLayer.wms(wmsUrl, {
                layers: `${window.GIS_CONFIG.geoserver.workspace}:${layer.id}`,
                transparent: true,
                format: 'image/png',
                opacity: 0.7,
                visible: false
            });

            this.overlayLayers.set(layer.id, {
                layer: wmsLayer,
                config: layer,
                visible: false
            });

            this.addLayerToPanel(layer);
        });
    }

    async loadAccidentData() {
        try {
            const response = await fetch('./datasets/tamilnadu_accidents.geojson');
            if (!response.ok) throw new Error('Failed to load');
            const geojson = await response.json();
            return geojson.features || [];
        } catch (error) {
            console.warn('Could not load GeoJSON:', error);
            return [];
        }
    }

    displayAccidentData(features, mapAction = 'cluster') {
        if (this.tnAccidentsLayer) {
            this.map.removeLayer(this.tnAccidentsLayer);
        }

        if (!features || features.length === 0) {
            showToast('No accident data to display', 'info');
            return;
        }

        const tnLayer = L.geoJSON({
            type: 'FeatureCollection',
            features: features
        }, {
            pointToLayer: (feature, latlng) => {
                const severity = feature.properties.severity || 'Minor';
                const color = severity === 'Fatal' ? '#d32f2f' : severity === 'Major' ? '#f57c00' : '#4caf50';
                
                return L.circleMarker(latlng, {
                    radius: 8,
                    fillColor: color,
                    color: '#fff',
                    weight: 2,
                    opacity: 1,
                    fillOpacity: 0.8
                });
            },
            onEachFeature: (feature, layer) => {
                const props = feature.properties;
                const popupContent = `
                    <div style="min-width: 200px;">
                        <h4 style="margin: 0 0 8px; color: #333;">${props.district || 'Accident'}</h4>
                        <p style="margin: 4px 0;"><strong>ID:</strong> ${props.id || 'N/A'}</p>
                        <p style="margin: 4px 0;"><strong>Severity:</strong> <span style="color: ${props.severity === 'Fatal' ? '#d32f2f' : props.severity === 'Major' ? '#f57c00' : '#4caf50'}; font-weight: bold;">${props.severity || 'N/A'}</span></p>
                        <p style="margin: 4px 0;"><strong>Date:</strong> ${props.date || 'N/A'}</p>
                        <p style="margin: 4px 0;"><strong>Time:</strong> ${props.time || 'N/A'}</p>
                        <p style="margin: 4px 0;"><strong>Cause:</strong> ${props.cause || 'N/A'}</p>
                        <p style="margin: 4px 0;"><strong>Road:</strong> ${props.roadtype || 'N/A'}</p>
                        <p style="margin: 4px 0;"><strong>Vehicles:</strong> ${props.vehicles || 'N/A'}</p>
                        <p style="margin: 4px 0;"><strong>Weather:</strong> ${props.weather || 'N/A'}</p>
                        <p style="margin: 4px 0;"><strong>Fatalities:</strong> ${props.fatals || 0}</p>
                        <p style="margin: 4px 0;"><strong>Injuries:</strong> ${props.injuries || 0}</p>
                    </div>
                `;
                layer.bindPopup(popupContent);
            }
        });

        this.tnAccidentsLayer = tnLayer;
        tnLayer.addTo(this.map);
        
        const bounds = tnLayer.getBounds();
        if (bounds.isValid()) {
            this.map.fitBounds(bounds, { padding: [30, 30] });
        }

        window.tnAccidentsData = features;
        return features;
    }

    addLayerToPanel(layerConfig) {
        const container = document.getElementById('geoserver-layers');
        if (!container) return;

        const layerItem = document.createElement('div');
        layerItem.className = 'layer-item';
        layerItem.innerHTML = `
            <input type="checkbox" id="layer-${layerConfig.id}" value="${layerConfig.id}" ${layerConfig.id === 'accidents' ? 'checked' : ''}>
            <label for="layer-${layerConfig.id}">
                <span class="layer-color" style="background: ${layerConfig.color}"></span>
                ${layerConfig.name}
            </label>
        `;

        container.appendChild(layerItem);

        layerItem.querySelector('input').addEventListener('change', (e) => {
            this.toggleLayer(layerConfig.id, e.target.checked);
        });
    }

    toggleLayer(layerId, visible) {
        const layerData = this.overlayLayers.get(layerId);
        if (!layerData) return;

        if (visible) {
            layerData.layer.addTo(this.map);
        } else {
            this.map.removeLayer(layerData.layer);
        }

        layerData.visible = visible;
    }

    executeMapAction(action) {
        switch (action.type) {
            case 'heatmap':
                this.createHeatmap(action.data);
                break;
            case 'cluster':
                this.createClusters(action.data);
                break;
            case 'density':
                this.createDensity(action.data);
                break;
            case 'accident_display':
                this.displayAccidentData(action.data);
                break;
            case 'flyTo':
                this.flyToLocation(action.data);
                break;
            default:
                this.displayAccidentData(action.data);
        }
    }

    createHeatmap(features) {
        if (this.analysisEngine) {
            this.analysisEngine.createHeatmap(features);

            document.getElementById('heatmap-layer').checked = true;
            document.getElementById('cluster-layer').checked = false;
            document.getElementById('density-layer').checked = false;

            if (features.length > 0) {
                this.fitBounds(features);
            }
        }
    }

    createClusters(features) {
        if (this.analysisEngine) {
            this.analysisEngine.createClusters(features);

            document.getElementById('cluster-layer').checked = true;
            document.getElementById('heatmap-layer').checked = false;
            document.getElementById('density-layer').checked = false;

            if (features.length > 0) {
                this.fitBounds(features);
            }
        }
    }

    createDensity(features) {
        if (this.analysisEngine) {
            this.analysisEngine.createDensityContours(features);

            document.getElementById('density-layer').checked = true;
            document.getElementById('heatmap-layer').checked = false;
            document.getElementById('cluster-layer').checked = false;

            if (features.length > 0) {
                this.fitBounds(features);
            }
        }
    }

    fitBounds(features) {
        const points = features.filter(f => f.geometry?.type === 'Point');
        if (points.length === 0) return;

        const bounds = L.latLngBounds(
            points.map(f => [f.geometry.coordinates[1], f.geometry.coordinates[0]])
        );

        this.map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }

    flyToLocation(location) {
        if (location.lat && location.lng) {
            this.map.flyTo([location.lat, location.lng], location.zoom || 15);
        }
    }

    addMapControls() {
        L.control.scale({ imperial: false }).addTo(this.map);

        const customControl = L.control({ position: 'topright' });
        customControl.onAdd = () => {
            const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control custom-controls');
            div.innerHTML = `
                <button onclick="window.mapManager.showMyLocation()" title="My Location" class="location-btn">
                    <i class="fas fa-location-crosshairs"></i>
                </button>
                <button onclick="window.mapManager.fullscreen()" title="Fullscreen">
                    <i class="fas fa-expand"></i>
                </button>
                <button onclick="window.mapManager.resetView()" title="Reset View">
                    <i class="fas fa-home"></i>
                </button>
                <button onclick="window.mapManager.exportMap()" title="Export">
                    <i class="fas fa-download"></i>
                </button>
            `;
            return div;
        };
        customControl.addTo(this.map);
    }

    addLegend() {
        const legend = L.control({ position: 'bottomright' });
        legend.onAdd = () => {
            const div = L.DomUtil.create('div', 'legend');
            div.innerHTML = `
                <h4>Feature Types</h4>
                ${window.GIS_CONFIG.sampleLayers.slice(0, 6).map(layer => `
                    <div class="legend-item">
                        <span class="legend-color" style="background: ${layer.color}"></span>
                        <span>${layer.name}</span>
                    </div>
                `).join('')}
                <h4 style="margin-top: 16px;">Severity</h4>
                <div class="legend-item">
                    <span class="legend-color" style="background: #EA4335"></span>
                    <span>High</span>
                </div>
                <div class="legend-item">
                    <span class="legend-color" style="background: #FBBC05"></span>
                    <span>Medium</span>
                </div>
                <div class="legend-item">
                    <span class="legend-color" style="background: #34A853"></span>
                    <span>Low</span>
                </div>
            `;
            return div;
        };
        legend.addTo(this.map);
    }

    fullscreen() {
        const container = document.getElementById('map-container');
        const chatPanel = document.getElementById('chat-panel');

        if (document.fullscreenElement) {
            document.exitFullscreen();
            container.style.right = 'var(--chat-width)';
            chatPanel.style.display = 'flex';
        } else {
            container.requestFullscreen();
            container.style.right = '0';
            chatPanel.style.display = 'none';
        }
    }

    resetView() {
        const config = window.GIS_CONFIG.map;
        this.map.setView(config.center, config.zoom);

        if (this.analysisEngine) {
            this.analysisEngine.clearAllLayers();
        }

        document.getElementById('heatmap-layer').checked = false;
        document.getElementById('cluster-layer').checked = false;
        document.getElementById('density-layer').checked = false;
    }

    exportMap() {
        const mapCanvas = document.querySelector('#map-container .leaflet-overlay-pane svg') || 
                          document.querySelector('#map-container canvas');

        if (mapCanvas) {
            const link = document.createElement('a');
            link.download = `gis-map-${Date.now()}.png`;
            link.href = mapCanvas.toDataURL();
            link.click();

            showToast('Map exported successfully!', 'success');
        } else {
            showToast('Unable to export map. Please try again.', 'error');
        }
    }
}

let mapManager;
let chatbot;
let insightsGenerator;

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let iconClass = 'fa-info-circle';
    switch (type) {
        case 'success': iconClass = 'fa-check-circle'; break;
        case 'error': iconClass = 'fa-exclamation-circle'; break;
        case 'info': iconClass = 'fa-info-circle'; break;
    }

    toast.innerHTML = `<i class="fas ${iconClass}"></i><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 4000);
}

function showLoading(show) {
    const overlay = document.getElementById('loading-overlay');
    if (show) {
        overlay.classList.remove('hidden');
    } else {
        overlay.classList.add('hidden');
    }
}

function initApp() {
    mapManager = new MapManager();
    chatbot = new Chatbot();
    insightsGenerator = new InsightsGenerator();

    window.mapManager = mapManager;
    window.chatbot = chatbot;
    window.insightsGenerator = insightsGenerator;

    mapManager.init();
    chatbot.showSuggestions();

    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');

    sendBtn.addEventListener('click', () => {
        const message = chatInput.value.trim();
        if (message) {
            showLoading(true);
            chatbot.processMessage(message).finally(() => showLoading(false));
            chatInput.value = '';
        }
    });

    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const message = chatInput.value.trim();
            if (message) {
                showLoading(true);
                chatbot.processMessage(message).finally(() => showLoading(false));
                chatInput.value = '';
            }
        }
    });

    document.getElementById('toggle-layers')?.addEventListener('click', () => {
        const panel = document.getElementById('layer-panel');
        panel.classList.toggle('hidden');
    });

    document.getElementById('close-layers')?.addEventListener('click', () => {
        document.getElementById('layer-panel').classList.add('hidden');
    });

    document.getElementById('clear-analysis')?.addEventListener('click', () => {
        mapManager.resetView();
        chatbot.clearMessages();
        showToast('Analysis cleared', 'info');
    });

    document.getElementById('export-map')?.addEventListener('click', () => {
        mapManager.exportMap();
    });

    document.getElementById('my-location-btn')?.addEventListener('click', async () => {
        showLoading(true);
        const location = await mapManager.showMyLocation();
        showLoading(false);
        if (location) {
            showToast(`Location found: ${location.lat.toFixed(4)}°, ${location.lng.toFixed(4)}°`, 'success');
        }
    });

    document.getElementById('close-analysis')?.addEventListener('click', () => {
        document.getElementById('analysis-panel').classList.add('hidden');
    });

    const micBtn = document.getElementById('mic-btn');
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();

        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            chatInput.value = transcript;
            showLoading(true);
            chatbot.processMessage(transcript).finally(() => showLoading(false));
        };

        recognition.onerror = () => {
            showToast('Speech recognition failed. Please try again.', 'error');
        };

        micBtn?.addEventListener('click', () => {
            recognition.start();
            micBtn.innerHTML = '<i class="fas fa-stop"></i>';
            setTimeout(() => {
                micBtn.innerHTML = '<i class="fas fa-microphone"></i>';
            }, 3000);
        });
    } else {
        micBtn.style.display = 'none';
    }

    document.addEventListener('fullscreenchange', () => {
        const container = document.getElementById('map-container');
        const chatPanel = document.getElementById('chat-panel');

        if (!document.fullscreenElement) {
            container.style.right = 'var(--chat-width)';
            chatPanel.style.display = 'flex';
        }
    });

    showToast('Smart GIS Chatbot ready!', 'success');
}

document.addEventListener('DOMContentLoaded', initApp);
