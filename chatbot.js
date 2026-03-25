class Chatbot {
    constructor() {
        this.messages = [];
        this.sessionId = null;
        this.isProcessing = false;
        this.useBackend = false;
    }

    async processMessage(message) {
        if (this.isProcessing) return;
        this.isProcessing = true;

        this.addMessage('user', message);

        const typingId = this.showTypingIndicator();

        try {
            const response = await this.processLocally(message);

            this.hideTypingIndicator(typingId);
            this.addMessage('bot', response.text, response.insights);

        } catch (error) {
            console.error('Chat error:', error);
            this.hideTypingIndicator(typingId);
            this.addMessage('bot', `I encountered an error: ${error.message}. Please try again.`);
        } finally {
            this.isProcessing = false;
        }
    }

    async processWithBackend(message) {
        const apiUrl = `${window.GIS_CONFIG.api.baseUrl}${window.GIS_CONFIG.api.chatEndpoint}`;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                message,
                sessionId: this.sessionId
            })
        });

        if (!response.ok) {
            throw new Error(`API request failed: ${response.status}`);
        }

        const data = await response.json();

        if (data.sessionId) {
            this.sessionId = data.sessionId;
        }

        if (data.mapAction && window.mapManager) {
            window.mapManager.executeMapAction({
                ...data.mapAction,
                features: data.result?.features
            });
        }

        return {
            text: data.insights?.summary || this.generateResponseFromResult(data),
            insights: data.insights?.insights || []
        };
    }

    generateResponseFromResult(data) {
        const result = data.result;
        const intent = data.parsed?.intent;

        switch (intent) {
            case 'MY_LOCATION':
                return 'Fetching your current location...';

            case 'FIND_HOTSPOTS':
            case 'ACCIDENT_QUERY':
                if (result?.hotspots?.length > 0) {
                    return `I found <strong>${result.hotspots.length} hotspot${result.hotspots.length > 1 ? 's' : ''}</strong>. ` +
                           `The most concentrated area has <span class="stat danger">${result.hotspots[0].count}</span> features.`;
                }
                return `Analyzed <strong>${result?.features?.length || 0}</strong> accidents.`;

            case 'COUNT_FEATURES':
                return `Found <span class="stat">${result?.totalFeatures || result?.features?.length || 0}</span> features.`;

            case 'DENSITY_ANALYSIS':
                return `Analyzed density of <span class="stat">${result?.features?.length || 0}</span> features.`;

            case 'FIND_NEARBY':
                return `Found <span class="stat">${result?.features?.length || 0}</span> nearby features.`;

            case 'FILTER_FEATURES':
                return `Filtered to <span class="stat">${result?.features?.length || 0}</span> features matching your criteria.`;

            default:
                return `Processed <span class="stat">${result?.totalFeatures || result?.features?.length || 0}</span> features.`;
        }
    }

    async processLocally(message) {
        const nlpEngine = new NLPEngine();
        const insightsGenerator = new InsightsGenerator();

        const parsedQuery = nlpEngine.parse(message);

        if (parsedQuery.intent === 'MY_LOCATION') {
            return this.handleMyLocation();
        }

        const features = await this.loadAccidentData();
        
        if (parsedQuery.intent === 'GENERAL_QUERY' || parsedQuery.intent === 'ACCIDENT_QUERY') {
            return this.handleGeneralQuery(parsedQuery, features, insightsGenerator);
        }

        let analysisResults = { features };
        let insights = [];
        let mapAction = null;

        switch (parsedQuery.intent) {
            case 'FIND_HOTSPOTS':
                analysisResults = this.performHotspotAnalysis(features, parsedQuery);
                insights = insightsGenerator.generateInsights(parsedQuery, analysisResults.features, analysisResults.stats);
                mapAction = { type: 'heatmap', data: analysisResults.features };
                break;

            case 'COUNT_FEATURES':
                analysisResults = { features };
                insights = insightsGenerator.generateInsights(parsedQuery, features, {});
                mapAction = { type: 'cluster', data: features };
                break;

            case 'DENSITY_ANALYSIS':
                analysisResults = this.performDensityAnalysis(features);
                insights = insightsGenerator.generateInsights(parsedQuery, features, analysisResults.stats);
                mapAction = { type: 'density', data: analysisResults.features };
                break;

            case 'FIND_NEARBY':
                const center = parsedQuery.parameters.location ||
                    (features[0]?.geometry ? {
                        lat: features[0].geometry.coordinates[1],
                        lng: features[0].geometry.coordinates[0]
                    } : window.GIS_CONFIG.map.center);
                analysisResults = this.performNearbyAnalysis(features, center);
                insights = insightsGenerator.generateInsights(parsedQuery, analysisResults.features, {});
                mapAction = { type: 'cluster', data: analysisResults.features };
                break;

            case 'FILTER_FEATURES':
                analysisResults = this.performFiltering(features, parsedQuery);
                insights = insightsGenerator.generateInsights(parsedQuery, analysisResults.features, {});
                mapAction = { type: 'cluster', data: analysisResults.features };
                break;

            case 'STATISTICS':
                analysisResults = { features, stats: window.analysisEngine.calculateStatistics(features) };
                insights = insightsGenerator.generateInsights(parsedQuery, features, analysisResults.stats);
                mapAction = { type: 'cluster', data: features };
                break;

            default:
                return this.handleGeneralQuery(parsedQuery, features, insightsGenerator);
        }

        if (mapAction && window.mapManager) {
            window.mapManager.executeMapAction(mapAction);
        }

        const responseText = this.generateResponseText(parsedQuery, analysisResults);

        return { text: responseText, insights };
    }

    async loadAccidentData() {
        try {
            const response = await fetch('./datasets/tamilnadu_accidents.geojson');
            if (!response.ok) throw new Error('Failed to load');
            const geojson = await response.json();
            return geojson.features || [];
        } catch (error) {
            console.warn('Using fallback data:', error);
            return this.getFallbackAccidentData();
        }
    }

    getFallbackAccidentData() {
        const districts = ['Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 'Vellore', 'Erode', 'Tirunelveli', 'Dindigul', 'Kancheepuram'];
        const severities = ['Minor', 'Major', 'Fatal'];
        const roads = ['National Hwy', 'State Hwy', 'City Road', 'Village Road'];
        const weathers = ['Clear', 'Rain', 'Cloudy', 'Fog'];
        const lights = ['Daylight', 'Night-Lit', 'Night-Unlit'];
        const causes = ['Overspeeding', 'Drunk Driving', 'Brake Failure', 'Wrong Turn', 'Distracted Driving'];
        
        const features = [];
        const centerLat = 11.1271;
        const centerLng = 78.6569;
        
        for (let i = 0; i < 100; i++) {
            const lat = centerLat + (Math.random() - 0.5) * 6;
            const lng = centerLng + (Math.random() - 0.5) * 6;
            const severity = severities[Math.floor(Math.random() * severities.length)];
            
            features.push({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [lng, lat] },
                properties: {
                    id: `TNACC${String(i + 1).padStart(4, '0')}`,
                    date: `2024-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`,
                    time: `${String(Math.floor(Math.random() * 24)).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}`,
                    district: districts[Math.floor(Math.random() * districts.length)],
                    severity: severity,
                    vehicles: ['Car', 'Truck', 'Two Wheeler', 'Auto', 'Bus'][Math.floor(Math.random() * 5)],
                    roadtype: roads[Math.floor(Math.random() * roads.length)],
                    weather: weathers[Math.floor(Math.random() * weathers.length)],
                    lightcond: lights[Math.floor(Math.random() * lights.length)],
                    fatals: severity === 'Fatal' ? Math.floor(Math.random() * 3) + 1 : 0,
                    injuries: severity === 'Major' ? Math.floor(Math.random() * 4) + 1 : Math.floor(Math.random() * 2),
                    cause: causes[Math.floor(Math.random() * causes.length)]
                }
            });
        }
        
        console.log('Using fallback data with', features.length, 'accidents');
        return features;
    }

    handleGeneralQuery(parsedQuery, features, insightsGenerator) {
        let filteredFeatures = [...features];
        let responseParts = [];
        let insights = [];
        const normalizedMsg = parsedQuery.normalized.toLowerCase();

        if (parsedQuery.parameters.severity) {
            const sev = parsedQuery.parameters.severity.toLowerCase();
            filteredFeatures = filteredFeatures.filter(f => {
                const fSev = (f.properties.severity || '').toLowerCase();
                return fSev === sev || fSev.includes(sev);
            });
        }

        if (normalizedMsg.includes('fatal') || normalizedMsg.includes('killed') || normalizedMsg.includes('death')) {
            filteredFeatures = filteredFeatures.filter(f => (f.properties.severity || '').toLowerCase() === 'fatal');
        }
        if (normalizedMsg.includes('major') || normalizedMsg.includes('serious')) {
            filteredFeatures = filteredFeatures.filter(f => (f.properties.severity || '').toLowerCase() === 'major');
        }
        if (normalizedMsg.includes('minor')) {
            filteredFeatures = filteredFeatures.filter(f => (f.properties.severity || '').toLowerCase() === 'minor');
        }

        if (parsedQuery.parameters.district) {
            const district = parsedQuery.parameters.district.toLowerCase();
            filteredFeatures = filteredFeatures.filter(f => 
                (f.properties.district || '').toLowerCase().includes(district)
            );
        }

        if (parsedQuery.parameters.cause) {
            const cause = parsedQuery.parameters.cause.toLowerCase();
            filteredFeatures = filteredFeatures.filter(f => 
                (f.properties.cause || '').toLowerCase().includes(cause)
            );
        }

        if (parsedQuery.parameters.roadtype) {
            const road = parsedQuery.parameters.roadtype.toLowerCase();
            filteredFeatures = filteredFeatures.filter(f => 
                (f.properties.roadtype || '').toLowerCase().includes(road)
            );
        }

        if (parsedQuery.parameters.weather) {
            const weather = parsedQuery.parameters.weather.toLowerCase();
            filteredFeatures = filteredFeatures.filter(f => 
                (f.properties.weather || '').toLowerCase().includes(weather)
            );
        }

        if (normalizedMsg.includes('night') || normalizedMsg.includes('dark')) {
            filteredFeatures = filteredFeatures.filter(f => 
                (f.properties.lightcond || '').toLowerCase().includes('night')
            );
        }
        if (normalizedMsg.includes('rain') || normalizedMsg.includes('rainy')) {
            filteredFeatures = filteredFeatures.filter(f => 
                (f.properties.weather || '').toLowerCase().includes('rain')
            );
        }

        const stats = this.calculateStats(filteredFeatures);
        insights = insightsGenerator.generateInsights(parsedQuery, filteredFeatures, stats);

        if (window.mapManager) {
            window.mapManager.executeMapAction({ type: 'accident_display', data: filteredFeatures });
        }

        if (normalizedMsg.includes('how many') || normalizedMsg.includes('count') || normalizedMsg.includes('total')) {
            responseParts.push(`Found <strong>${filteredFeatures.length}</strong> accident${filteredFeatures.length !== 1 ? 's' : ''}.`);
        }

        if (normalizedMsg.includes('hotspot') || normalizedMsg.includes('dangerous') || normalizedMsg.includes('unsafe')) {
            const hotspots = this.findHotspots(filteredFeatures);
            responseParts.push(`Identified <strong>${hotspots.length}</strong> hotspot${hotspots.length !== 1 ? 's' : ''}.`);
            if (hotspots.length > 0) {
                responseParts.push(`Most affected: <strong>${hotspots[0].district}</strong> with ${hotspots[0].count} accidents.`);
            }
        }

        if (normalizedMsg.includes('where') || normalizedMsg.includes('location')) {
            const districts = this.groupByDistrict(filteredFeatures);
            const topDistrict = Object.entries(districts).sort((a, b) => b[1].length - a[1].length)[0];
            if (topDistrict) {
                responseParts.push(`Most accidents in <strong>${topDistrict[0]}</strong> (${topDistrict[1].length} cases).`);
            }
        }

        if (normalizedMsg.includes('when') || normalizedMsg.includes('date') || normalizedMsg.includes('time')) {
            responseParts.push(`Records span from <strong>${stats.minDate}</strong> to <strong>${stats.maxDate}</strong>.`);
        }

        if (normalizedMsg.includes('cause') || normalizedMsg.includes('reason')) {
            const causes = this.groupByCause(filteredFeatures);
            const topCause = Object.entries(causes).sort((a, b) => b[1] - a[1])[0];
            if (topCause) {
                responseParts.push(`Top cause: <strong>${topCause[0]}</strong> (${topCause[1]} accidents).`);
            }
        }

        if (normalizedMsg.includes('road') || normalizedMsg.includes('highway')) {
            const roads = this.groupByRoadType(filteredFeatures);
            const topRoad = Object.entries(roads).sort((a, b) => b[1] - a[1])[0];
            if (topRoad) {
                responseParts.push(`Most accidents on <strong>${topRoad[0]}</strong> (${topRoad[1]} cases).`);
            }
        }

        if (responseParts.length === 0) {
            responseParts.push(`Analyzed <strong>${filteredFeatures.length}</strong> accident${filteredFeatures.length !== 1 ? 's' : ''}.`);
            if (stats.fatalCount > 0) responseParts.push(`${stats.fatalCount} fatal, ${stats.majorCount} major, ${stats.minorCount} minor.`);
        }

        return { text: responseParts.join(' '), insights };
    }

    calculateStats(features) {
        const fatal = features.filter(f => (f.properties.severity || '').toLowerCase() === 'fatal');
        const major = features.filter(f => (f.properties.severity || '').toLowerCase() === 'major');
        const minor = features.filter(f => (f.properties.severity || '').toLowerCase() === 'minor');
        
        const dates = features.map(f => f.properties.date).filter(Boolean).sort();
        const totalFatals = features.reduce((sum, f) => sum + (f.properties.fatals || 0), 0);
        const totalInjuries = features.reduce((sum, f) => sum + (f.properties.injuries || 0), 0);

        return {
            total: features.length,
            fatalCount: fatal.length,
            majorCount: major.length,
            minorCount: minor.length,
            minDate: dates[0] || 'N/A',
            maxDate: dates[dates.length - 1] || 'N/A',
            totalFatals,
            totalInjuries
        };
    }

    findHotspots(features) {
        const districts = this.groupByDistrict(features);
        return Object.entries(districts)
            .map(([district, accidents]) => ({
                district,
                count: accidents.length,
                intensity: accidents.length > 10 ? 'High' : accidents.length > 5 ? 'Medium' : 'Low'
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
    }

    groupByDistrict(features) {
        return features.reduce((acc, f) => {
            const district = f.properties.district || 'Unknown';
            if (!acc[district]) acc[district] = [];
            acc[district].push(f);
            return acc;
        }, {});
    }

    groupByCause(features) {
        return features.reduce((acc, f) => {
            const cause = f.properties.cause || 'Unknown';
            acc[cause] = (acc[cause] || 0) + 1;
            return acc;
        }, {});
    }

    groupByRoadType(features) {
        return features.reduce((acc, f) => {
            const road = f.properties.roadtype || 'Unknown';
            acc[road] = (acc[road] || 0) + 1;
            return acc;
        }, {});
    }

        const layerId = parsedQuery.features[0] || 'accidents';
        const features = await geoServerClient.fetchFeatures(layerId);

        let analysisResults = { features };
        let insights = [];
        let mapAction = null;

        switch (parsedQuery.intent) {
            case 'FIND_HOTSPOTS':
                analysisResults = this.performHotspotAnalysis(features, parsedQuery);
                insights = insightsGenerator.generateInsights(parsedQuery, analysisResults.features, analysisResults.stats);
                mapAction = { type: 'heatmap', data: analysisResults.features };
                break;

            case 'COUNT_FEATURES':
                analysisResults = { features };
                insights = insightsGenerator.generateInsights(parsedQuery, features, {});
                mapAction = { type: 'cluster', data: features };
                break;

            case 'DENSITY_ANALYSIS':
                analysisResults = this.performDensityAnalysis(features);
                insights = insightsGenerator.generateInsights(parsedQuery, features, analysisResults.stats);
                mapAction = { type: 'density', data: features };
                break;

            case 'FIND_NEARBY':
                const center = parsedQuery.parameters.location ||
                    (features[0]?.geometry ? {
                        lat: features[0].geometry.coordinates[1],
                        lng: features[0].geometry.coordinates[0]
                    } : window.GIS_CONFIG.map.center);
                analysisResults = this.performNearbyAnalysis(features, center);
                insights = insightsGenerator.generateInsights(parsedQuery, analysisResults.features, {});
                mapAction = { type: 'cluster', data: analysisResults.features };
                break;

            case 'FILTER_FEATURES':
                analysisResults = this.performFiltering(features, parsedQuery);
                insights = insightsGenerator.generateInsights(parsedQuery, analysisResults.features, {});
                mapAction = { type: 'cluster', data: analysisResults.features };
                break;

            case 'STATISTICS':
                analysisResults = { features, stats: window.analysisEngine.calculateStatistics(features) };
                insights = insightsGenerator.generateInsights(parsedQuery, features, analysisResults.stats);
                mapAction = { type: 'cluster', data: features };
                break;

            default:
                analysisResults = { features };
                insights = insightsGenerator.generateInsights(parsedQuery, features, {});
                mapAction = { type: 'cluster', data: features };
        }

        if (mapAction && window.mapManager) {
            window.mapManager.executeMapAction(mapAction);
        }

        const responseText = this.generateResponseText(parsedQuery, analysisResults);

        return { text: responseText, insights };
    }

    async handleMyLocation() {
        const location = await window.mapManager.showMyLocation();
        
        if (location) {
            const insights = [{
                type: 'location',
                icon: 'location-crosshairs',
                title: 'Your Current Location',
                content: `Located at <strong>${location.lat.toFixed(6)}°N, ${Math.abs(location.lng).toFixed(6)}°W</strong> with accuracy of ±${Math.round(location.accuracy)}m.`
            }];

            return {
                text: `I've found your location! You are at <strong>${location.lat.toFixed(6)}°N, ${Math.abs(location.lng).toFixed(6)}°W</strong> (accuracy: ±${Math.round(location.accuracy)}m).`,
                insights
            };
        } else {
            return {
                text: 'I could not access your location. Please make sure location services are enabled and you have granted permission.',
                insights: []
            };
        }
    }

    performHotspotAnalysis(features, parsedQuery) {
        const hotspots = window.analysisEngine.performHotspotAnalysis(features);
        return {
            features,
            hotspots,
            stats: window.analysisEngine.calculateStatistics(features)
        };
    }

    performDensityAnalysis(features) {
        return {
            features,
            stats: window.analysisEngine.calculateStatistics(features)
        };
    }

    performNearbyAnalysis(features, center) {
        const nearbyFeatures = window.analysisEngine.findNearbyFeatures(center, features);
        return { features: nearbyFeatures };
    }

    performFiltering(features, parsedQuery) {
        let filtered = [...features];

        if (parsedQuery.parameters.severity) {
            const sev = parsedQuery.parameters.severity.toLowerCase();
            filtered = filtered.filter(f => {
                const fSev = (f.properties.severity || '').toLowerCase();
                return fSev === sev || fSev.includes(sev);
            });
        }

        if (parsedQuery.normalized.includes('fatal')) {
            filtered = filtered.filter(f =>
                (f.properties.severity || '').toLowerCase() === 'fatal'
            );
        }

        if (parsedQuery.normalized.includes('major')) {
            filtered = filtered.filter(f =>
                (f.properties.severity || '').toLowerCase() === 'major'
            );
        }

        if (parsedQuery.normalized.includes('minor')) {
            filtered = filtered.filter(f =>
                (f.properties.severity || '').toLowerCase() === 'minor'
            );
        }

        if (parsedQuery.parameters.region) {
            const region = parsedQuery.parameters.region.toLowerCase();
            filtered = filtered.filter(f => {
                if (!f.geometry || f.geometry.type !== 'Point') return false;
                const [lng, lat] = f.geometry.coordinates;
                const latDir = lat >= 40.75 ? 'north' : 'south';
                const lngDir = lng >= -74.02 ? 'east' : 'west';
                const featureRegion = `${latDir}-${lngDir}`;
                return featureRegion.includes(region);
            });
        }

        return { features: filtered };
    }

    generateResponseText(parsedQuery, analysisResults) {
        const { features, hotspots, stats } = analysisResults;
        let response = '';

        switch (parsedQuery.intent) {
            case 'FIND_HOTSPOTS':
                if (hotspots && hotspots.length > 0) {
                    response = `I found <strong>${hotspots.length} hotspot${hotspots.length > 1 ? 's' : ''}</strong> based on your query. `;
                    response += `The most concentrated area contains <span class="stat danger">${hotspots[0].count}</span> features `;
                    response += `with <span class="stat">${hotspots[0].intensity}</span> intensity.`;
                } else {
                    response = `No significant hotspots found. The data shows a relatively uniform distribution.`;
                }
                break;

            case 'COUNT_FEATURES':
                response = `Your query returned <span class="stat">${features.length}</span> features. `;
                if (stats?.byType) {
                    const topType = Object.entries(stats.byType).sort((a, b) => b[1] - a[1])[0];
                    if (topType) {
                        response += `<strong>${topType[0]}</strong> is the most common type with ${topType[1]} features.`;
                    }
                }
                break;

            case 'DENSITY_ANALYSIS':
                response = `Density analysis shows <span class="stat">${features.length}</span> features distributed `;
                if (stats?.spatial?.spread) {
                    const spread = stats.spatial.spread;
                    const avgSpread = ((spread.latStdDev + spread.lngStdDev) / 2 * 111).toFixed(2);
                    response += `across approximately <strong>${avgSpread} km</strong> radius.`;
                }
                break;

            case 'FIND_NEARBY':
                response = `Found <span class="stat">${features.length}</span> features near the specified location. `;
                if (features.length > 0 && features[0].distance !== undefined) {
                    response += `Nearest feature is <strong>${features[0].distance.toFixed(2)} km</strong> away.`;
                }
                break;

            case 'FILTER_FEATURES':
                response = `After applying your filters, <span class="stat">${features.length}</span> features match your criteria. `;
                if (features.length === 0) {
                    response += `Try adjusting your filter conditions.`;
                }
                break;

            case 'STATISTICS':
                response = `Statistical summary: <span class="stat">${features.length}</span> total features. `;
                if (stats?.bySeverity) {
                    const severityText = Object.entries(stats.bySeverity)
                        .map(([k, v]) => `${v} ${k}`)
                        .join(', ');
                    response += `Severity breakdown: ${severityText}.`;
                }
                break;

            default:
                response = `I found <span class="stat">${features.length}</span> features matching your query. `;
                response += `The results have been displayed on the map with cluster view.`;
        }

        return response;
    }

    addMessage(type, content, insights = []) {
        const messagesContainer = document.getElementById('chat-messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;

        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
        avatar.innerHTML = type === 'bot' ? '<i class="fas fa-robot"></i>' : '<i class="fas fa-user"></i>';

        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        messageContent.innerHTML = content;

        if (insights.length > 0) {
            insights.forEach(insight => {
                const card = this.createInsightCard(insight);
                messageContent.appendChild(card);
            });
        }

        messageDiv.appendChild(avatar);
        messageDiv.appendChild(messageContent);
        messagesContainer.appendChild(messageDiv);

        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        this.messages.push({ type, content, insights });

        return messageDiv;
    }

    createInsightCard(insight) {
        const card = document.createElement('div');
        card.className = `insight-card insight-${insight.type}`;

        let iconClass = 'fa-circle';
        switch (insight.icon) {
            case 'fire': iconClass = 'fa-fire'; break;
            case 'map-marker-alt': iconClass = 'fa-map-marker-alt'; break;
            case 'chart-line': iconClass = 'fa-chart-line'; break;
            case 'hashtag': iconClass = 'fa-hashtag'; break;
            case 'filter': iconClass = 'fa-filter'; break;
            case 'chart-bar': iconClass = 'fa-chart-bar'; break;
            default: iconClass = 'fa-info-circle';
        }

        card.innerHTML = `
            <div class="insight-header">
                <i class="fas ${iconClass}"></i>
                <strong>${insight.title}</strong>
            </div>
            <p>${insight.content}</p>
        `;

        return card;
    }

    showTypingIndicator() {
        const messagesContainer = document.getElementById('chat-messages');
        const indicator = document.createElement('div');
        indicator.className = 'message bot typing';
        indicator.id = 'typing-indicator';

        indicator.innerHTML = `
            <div class="message-avatar"><i class="fas fa-robot"></i></div>
            <div class="message-content">
                <div class="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        `;

        messagesContainer.appendChild(indicator);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        return indicator.id;
    }

    hideTypingIndicator(indicatorId) {
        const indicator = document.getElementById(indicatorId);
        if (indicator) {
            indicator.remove();
        }
    }

    showSuggestions() {
        const nlpEngine = new NLPEngine();
        const suggestions = nlpEngine.getSuggestions();
        const suggestionsContainer = document.getElementById('suggestions');

        suggestionsContainer.innerHTML = suggestions.map(s => `
            <button class="suggestion-chip" data-query="${s.query}">
                <i class="fas ${s.icon}"></i>
                ${s.query}
            </button>
        `).join('');

        suggestionsContainer.querySelectorAll('.suggestion-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const query = chip.dataset.query;
                document.getElementById('chat-input').value = query;
                this.processMessage(query);
            });
        });
    }

    clearMessages() {
        const messagesContainer = document.getElementById('chat-messages');
        messagesContainer.innerHTML = '';
        this.messages = [];

        const welcomeMessage = `
            <div style="text-align: center; padding: 20px; color: var(--text-secondary);">
                <i class="fas fa-map-marked-alt" style="font-size: 48px; margin-bottom: 16px; color: var(--primary);"></i>
                <h3>Welcome to Smart GIS Chatbot</h3>
                <p style="margin-top: 8px; font-size: 14px;">
                    Ask me about Tamil Nadu road accidents and I'll analyze the data and show you insights on the map.
                </p>
            </div>
        `;
        messagesContainer.innerHTML = welcomeMessage;

        this.showSuggestions();
    }
}

window.Chatbot = Chatbot;
