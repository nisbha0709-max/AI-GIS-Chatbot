class NLPEngine {
    constructor() {
        this.config = window.GIS_CONFIG;
        this.intentPatterns = this.buildIntentPatterns();
        this.entityPatterns = this.buildEntityPatterns();
        this.tamilNaduDistricts = [
            'chennai', 'coimbatore', 'madurai', 'tiruchirappalli', 'salem', 'vellore', 'erode',
            'tirunelveli', 'dindigul', 'kancheepuram', 'thanjavur', 'karur', 'namakkal',
            'dharmapuri', 'krishnagiri', 'thoothukudi', 'cuddalore', 'nagapattinam', 'villupuram'
        ];
        this.accidentKeywords = [
            'accident', 'accidents', 'crash', 'crashes', 'collision', 'incident', 'road accident',
            'traffic', 'fatalities', 'deaths', 'kills', 'injuries'
        ];
        this.severityKeywords = ['fatal', 'major', 'minor', 'serious', 'critical', 'dangerous'];
        this.causeKeywords = [
            'overspeeding', 'drunk driving', 'drunk', 'brake failure', 'wrong turn',
            'distracted driving', 'lane change', 'poor visibility', 'road damage',
            'animal crossing', 'pedestrian crossing', 'hit and run'
        ];
        this.roadKeywords = ['national highway', 'state highway', 'city road', 'village road', 'bypass', 'junction', 'highway', 'nh', 'sh'];
        this.weatherKeywords = ['rain', 'fog', 'cloudy', 'clear', 'storm'];
    }

    buildIntentPatterns() {
        return {
            my_location: {
                patterns: [
                    /my\s+location/i,
                    /where\s+am\s+i/i,
                    /show\s+my\s+location/i,
                    /find\s+my\s+location/i,
                    /current\s+location/i,
                    /my\s+position/i,
                    /where\s+(?:is|are)\s+(?:me|I)/i,
                    /get\s+my\s+(?:location|position)/i,
                    /locate\s+me/i,
                    /gps/i,
                    /latitude.*longitude/i
                ],
                intent: 'MY_LOCATION'
            },
            accident_query: {
                patterns: [
                    /accident/i,
                    /crash/i,
                    /collision/i,
                    /road\s+(?:accident|incident)/i,
                    /traffic\s+(?:accident|incident)/i,
                    /fatalit/i,
                    /death/i,
                    /kill/i
                ],
                intent: 'ACCIDENT_QUERY'
            },
            find_hotspots: {
                patterns: [
                    /where\s+(?:are\s+)?(.+?)(?:\s+hotspots?)?/i,
                    /hotspot/i,
                    /hot\s+spot/i,
                    /cluster.*?(?:of|with)\s+(.+)/i,
                    /danger.*zone/i,
                    /unsafe.*area/i
                ],
                intent: 'FIND_HOTSPOTS'
            },
            count_features: {
                patterns: [
                    /how\s+many\s+(.+)/i,
                    /count\s+(?:of\s+)?(.+)/i,
                    /number\s+of\s+(.+)/i,
                    /total\s+(.+)/i
                ],
                intent: 'COUNT_FEATURES'
            },
            density_analysis: {
                patterns: [
                    /density/i,
                    /concentration/i,
                    /spread\s+of/i,
                    /distribution\s+of/i
                ],
                intent: 'DENSITY_ANALYSIS'
            },
            find_nearby: {
                patterns: [
                    /near(?:by)?\s+(.+)/i,
                    /close\s+to\s+(.+)/i,
                    /within\s+(.+?)\s+(?:of|from)/i,
                    /around\s+(.+)/i
                ],
                intent: 'FIND_NEARBY'
            },
            filter_features: {
                patterns: [
                    /show\s+(?:only\s+)?(.+?)\s+(?:with|that\s+have)/i,
                    /filter.*?(?:by|for)\s+(.+)/i,
                    /where\s+(?:is|are)\s+(.+)/i
                ],
                intent: 'FILTER_FEATURES'
            },
            compare: {
                patterns: [
                    /compare\s+(.+)\s+(?:to|with|and)\s+(.+)/i,
                    /difference\s+between\s+(.+)\s+and\s+(.+)/i,
                    /vs\.?\s+(.+)/i
                ],
                intent: 'COMPARE'
            },
            route: {
                patterns: [
                    /route\s+(?:from|between)\s+(.+)\s+(?:to|and)\s+(.+)/i,
                    /direction/i,
                    /navigate/i
                ],
                intent: 'FIND_ROUTE'
            },
            statistics: {
                patterns: [
                    /statistic/i,
                    /statistical\s+analysis/i,
                    /average/i,
                    /mean/i,
                    /summarize/i,
                    /analysis/i
                ],
                intent: 'STATISTICS'
            },
            general_query: {
                patterns: [/.*/],
                intent: 'GENERAL_QUERY'
            }
        };
    }

    buildEntityPatterns() {
        return {
            severity: /(fatal|major|minor|high|medium|low|serious|critical|dangerous)\s*(severity|priority|risk)?/i,
            date: /(\d{4})|(\d{1,2}\/\d{1,2}\/\d{2,4})/g,
            distance: /(\d+(?:\.\d+)?)\s*(km|kilometer|m|meter|mile|miles)/gi,
            area: /(\d+(?:\.\d+)?)\s*(sq\.?\s*km|square\s*(?:kilometer|mile|km|m))/gi,
            region: /(north|south|east|west|northeast|northwest|southeast|southwest|center|central)/gi
        };
    }

    parse(query) {
        const normalizedQuery = query.toLowerCase().trim();
        const intent = this.identifyIntent(normalizedQuery);
        const entities = this.extractEntities(normalizedQuery);
        const features = this.identifyFeatures(normalizedQuery);
        const actions = this.identifyActions(normalizedQuery);
        const parameters = this.extractParameters(normalizedQuery, entities);

        return {
            original: query,
            normalized: normalizedQuery,
            intent,
            entities,
            features,
            actions,
            parameters,
            confidence: this.calculateConfidence(intent, entities, features)
        };
    }

    identifyIntent(query) {
        const lowerQuery = query.toLowerCase();
        
        if (lowerQuery.includes('accident') || lowerQuery.includes('crash') || 
            lowerQuery.includes('fatal') || lowerQuery.includes('death') ||
            lowerQuery.includes('killed') || lowerQuery.includes('injury')) {
            return 'ACCIDENT_QUERY';
        }
        
        for (const [key, pattern] of Object.entries(this.intentPatterns)) {
            if (key === 'general_query' || key === 'accident_query') continue;
            for (const regex of pattern.patterns) {
                if (regex.test(query)) {
                    return pattern.intent;
                }
            }
        }
        return 'GENERAL_QUERY';
    }

    extractEntities(query) {
        const entities = {};
        
        for (const [entityType, pattern] of Object.entries(this.entityPatterns)) {
            const matches = query.match(pattern);
            if (matches) {
                entities[entityType] = matches;
            }
        }

        const layerMatch = this.config.sampleLayers.find(layer =>
            layer.queries.some(q => query.includes(q)) ||
            query.includes(layer.name.toLowerCase())
        );
        if (layerMatch) {
            entities.layer = layerMatch.id;
        }

        return entities;
    }

    identifyFeatures(query) {
        const features = [];
        
        this.config.sampleLayers.forEach(layer => {
            if (layer.queries.some(q => query.includes(q))) {
                features.push(layer.id);
            }
        });

        if (features.length === 0) {
            features.push('all');
        }

        return features;
    }

    identifyActions(query) {
        const actions = [];
        const actionKeywords = this.config.nlp.actions;

        for (const [action, keywords] of Object.entries(actionKeywords)) {
            if (keywords.some(kw => query.includes(kw))) {
                actions.push(action);
            }
        }

        if (actions.length === 0) {
            actions.push('list');
        }

        return actions;
    }

    extractParameters(query, entities) {
        const parameters = {};
        const lowerQuery = query.toLowerCase();

        const districtMatch = this.tamilNaduDistricts.find(d => lowerQuery.includes(d));
        if (districtMatch) {
            parameters.district = districtMatch.charAt(0).toUpperCase() + districtMatch.slice(1);
        }

        const locationMatch = query.match(/near\s+(?:the\s+)?(.+?)(?:\s+or|$)/i) ||
                            query.match(/in\s+(?:the\s+)?(.+?)(?:\s+area)?$/i);
        if (locationMatch) {
            parameters.location = locationMatch[1];
        }

        const severityMatch = lowerQuery.match(/(fatal|major|minor|serious|critical)/i);
        if (severityMatch) {
            parameters.severity = severityMatch[1].charAt(0).toUpperCase() + severityMatch[1].slice(1).toLowerCase();
            if (parameters.severity === 'Serious') parameters.severity = 'Major';
            if (parameters.severity === 'Critical') parameters.severity = 'Fatal';
        }

        const causeMatch = this.causeKeywords.find(c => lowerQuery.includes(c));
        if (causeMatch) {
            parameters.cause = causeMatch.charAt(0).toUpperCase() + causeMatch.slice(1);
            if (parameters.cause === 'Drunk') parameters.cause = 'Drunk Driving';
        }

        const roadMatch = this.roadKeywords.find(r => lowerQuery.includes(r));
        if (roadMatch) {
            let roadType = roadMatch;
            if (roadMatch === 'nh') roadType = 'National Hwy';
            else if (roadMatch === 'sh') roadType = 'State Hwy';
            else if (roadMatch === 'highway') roadType = 'National Hwy';
            parameters.roadtype = roadType;
        }

        const weatherMatch = this.weatherKeywords.find(w => lowerQuery.includes(w));
        if (weatherMatch) {
            parameters.weather = weatherMatch.charAt(0).toUpperCase() + weatherMatch.slice(1);
        }

        const distanceMatch = query.match(/(\d+(?:\.\d+)?)\s*(km|m|miles)/i);
        if (distanceMatch) {
            parameters.distance = {
                value: parseFloat(distanceMatch[1]),
                unit: distanceMatch[2].toLowerCase()
            };
        }

        const regionMatch = query.match(/(north|south|east|west|northeast|northwest|southeast|southwest)/i);
        if (regionMatch) {
            parameters.region = regionMatch[1].toLowerCase();
        }

        return parameters;
    }

    calculateConfidence(intent, entities, features) {
        let confidence = 0.5;

        if (intent !== 'GENERAL_QUERY') {
            confidence += 0.3;
        }

        if (Object.keys(entities).length > 0) {
            confidence += 0.1;
        }

        if (features.length > 0 && features[0] !== 'all') {
            confidence += 0.1;
        }

        return Math.min(confidence, 1.0);
    }

    generateResponseContext(parsedQuery) {
        const context = {
            type: parsedQuery.intent,
            features: parsedQuery.features,
            actions: parsedQuery.actions,
            parameters: parsedQuery.parameters
        };

        return context;
    }

    getSuggestions() {
        return [
            { query: 'Show accident hotspots in Tamil Nadu', icon: 'fa-fire', action: 'ACCIDENT_QUERY' },
            { query: 'How many fatal accidents?', icon: 'fa-exclamation-triangle', action: 'ACCIDENT_QUERY' },
            { query: 'Show accidents in Chennai', icon: 'fa-map-marker-alt', action: 'ACCIDENT_QUERY' },
            { query: 'What causes most accidents?', icon: 'fa-question-circle', action: 'ACCIDENT_QUERY' },
            { query: 'Accidents during rain', icon: 'fa-cloud-rain', action: 'ACCIDENT_QUERY' },
            { query: 'Show major accidents on highways', icon: 'fa-road', action: 'ACCIDENT_QUERY' },
            { query: 'Where am I?', icon: 'fa-location-crosshairs', action: 'MY_LOCATION' }
        ];
    }
}

window.NLPEngine = NLPEngine;
