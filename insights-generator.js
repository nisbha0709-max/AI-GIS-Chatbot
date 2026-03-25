class InsightsGenerator {
    constructor() {
        this.insights = [];
    }

    generateInsights(queryResult, features, stats) {
        const insights = [];

        switch (queryResult.intent) {
            case 'FIND_HOTSPOTS':
                insights.push(...this.generateHotspotInsights(features, queryResult));
                break;
            case 'COUNT_FEATURES':
                insights.push(...this.generateCountInsights(features, queryResult));
                break;
            case 'DENSITY_ANALYSIS':
                insights.push(...this.generateDensityInsights(features, stats, queryResult));
                break;
            case 'FIND_NEARBY':
                insights.push(...this.generateNearbyInsights(features, queryResult));
                break;
            case 'FILTER_FEATURES':
                insights.push(...this.generateFilterInsights(features, queryResult));
                break;
            case 'COMPARE':
                insights.push(...this.generateComparisonInsights(features, queryResult));
                break;
            case 'STATISTICS':
                insights.push(...this.generateStatisticalInsights(features, stats, queryResult));
                break;
            default:
                insights.push(...this.generateGeneralInsights(features, queryResult));
        }

        return insights;
    }

    generateHotspotInsights(features, queryResult) {
        const insights = [];
        const layerNames = queryResult.features.map(id => {
            const layer = window.GIS_CONFIG.sampleLayers.find(l => l.id === id);
            return layer ? layer.name : id;
        }).join(', ');

        insights.push({
            type: 'primary',
            icon: 'fire',
            title: `Hotspot Analysis Complete`,
            content: `Identified <span class="stat danger">${features.length}</span> ${layerNames} features across the region.`
        });

        if (features.length > 0) {
            const regions = this.analyzeRegions(features);
            if (regions.hottest) {
                insights.push({
                    type: 'location',
                    icon: 'map-marker-alt',
                    title: 'Highest Concentration Found',
                    content: `Most ${layerNames.toLowerCase()} are concentrated in the <strong>${regions.hottest}</strong> region, accounting for <span class="stat">${regions.percentage}%</span> of total features.`
                });
            }

            if (regions.pattern) {
                insights.push({
                    type: 'pattern',
                    icon: 'chart-line',
                    title: 'Spatial Pattern Detected',
                    content: regions.pattern
                });
            }
        }

        return insights;
    }

    generateCountInsights(features, queryResult) {
        const insights = [];

        insights.push({
            type: 'count',
            icon: 'hashtag',
            title: 'Feature Count',
            content: `Found <span class="stat">${features.length}</span> features matching your query.`
        });

        const byType = this.groupByType(features);
        if (Object.keys(byType).length > 1) {
            const sorted = Object.entries(byType).sort((a, b) => b[1].length - a[1].length);
            const top = sorted[0];
            insights.push({
                type: 'breakdown',
                icon: 'list',
                title: 'Breakdown by Type',
                content: `<strong>${top[0]}</strong> has the highest count with <span class="stat">${top[1].length}</span> features.`
            });
        }

        return insights;
    }

    generateDensityInsights(features, stats, queryResult) {
        const insights = [];

        insights.push({
            type: 'density',
            icon: 'layer-group',
            title: 'Density Analysis Results',
            content: `Analyzed spatial distribution of <span class="stat">${features.length}</span> features across the map.`
        });

        if (stats.spatial && stats.spatial.spread) {
            const spread = stats.spatial.spread;
            const spreadDescription = this.describeSpread(spread);
            insights.push({
                type: 'spread',
                icon: 'arrows-alt',
                title: 'Distribution Pattern',
                content: `Features show a <strong>${spreadDescription}</strong> distribution pattern with standard deviations of ${(spread.latStdDev * 111).toFixed(2)}km (lat) and ${(spread.lngStdDev * 111).toFixed(2)}km (lng).`
            });
        }

        const hotspots = this.identifyDensityRegions(features);
        if (hotspots.length > 0) {
            insights.push({
                type: 'hotspots',
                icon: 'fire',
                title: 'High-Density Zones',
                content: `Identified <span class="stat danger">${hotspots.length}</span> high-density zones that may require attention.`
            });
        }

        return insights;
    }

    generateNearbyInsights(features, queryResult) {
        const insights = [];

        insights.push({
            type: 'nearby',
            icon: 'location-arrow',
            title: 'Nearby Features',
            content: `Found <span class="stat">${features.length}</span> features within the specified radius.`
        });

        const sorted = features.slice(0, 5).sort((a, b) => a.distance - b.distance);
        if (sorted.length > 0) {
            const nearest = sorted[0];
            insights.push({
                type: 'nearest',
                icon: 'star',
                title: 'Nearest Feature',
                content: `The closest feature is <strong>${nearest.properties.name || nearest.properties.id}</strong> at <span class="stat">${nearest.distance.toFixed(2)}</span> km.`
            });
        }

        return insights;
    }

    generateFilterInsights(features, queryResult) {
        const insights = [];

        const layerNames = queryResult.features.map(id => {
            const layer = window.GIS_CONFIG.sampleLayers.find(l => l.id === id);
            return layer ? layer.name : id;
        });

        insights.push({
            type: 'filter',
            icon: 'filter',
            title: 'Filtered Results',
            content: `Showing <span class="stat">${features.length}</span> ${layerNames.join(', ')} on the map.`
        });

        if (features.length > 0) {
            const severityCounts = this.countBySeverity(features);
            if (Object.keys(severityCounts).length > 0) {
                const severityText = Object.entries(severityCounts)
                    .map(([sev, count]) => `<span class="stat ${this.getSeverityClass(sev)}">${count} ${sev}</span>`)
                    .join(' ');
                insights.push({
                    type: 'severity',
                    icon: 'exclamation-triangle',
                    title: 'Severity Distribution',
                    content: severityText
                });
            }
        }

        return insights;
    }

    generateComparisonInsights(features, queryResult) {
        const insights = [];

        insights.push({
            type: 'compare',
            icon: 'balance-scale',
            title: 'Comparison Results',
            content: `Comparing <span class="stat">${features.length}</span> features across selected layers.`
        });

        return insights;
    }

    generateStatisticalInsights(features, stats, queryResult) {
        const insights = [];

        insights.push({
            type: 'stats',
            icon: 'chart-bar',
            title: 'Statistical Summary',
            content: `Summary of <span class="stat">${features.length}</span> features.`
        });

        if (stats.byType && Object.keys(stats.byType).length > 0) {
            const topTypes = Object.entries(stats.byType)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 3);
            insights.push({
                type: 'types',
                icon: 'tags',
                title: 'Top Categories',
                content: topTypes.map(([type, count]) => `<span class="stat">${count} ${type}</span>`).join(' ')
            });
        }

        if (stats.temporal && Object.keys(stats.temporal).length > 0) {
            const years = Object.keys(stats.temporal).sort();
            if (years.length > 1) {
                insights.push({
                    type: 'temporal',
                    icon: 'calendar',
                    title: 'Temporal Range',
                    content: `Data spans from <strong>${years[0]}</strong> to <strong>${years[years.length - 1]}</strong>.`
                });
            }
        }

        return insights;
    }

    generateGeneralInsights(features, queryResult) {
        const insights = [{
            type: 'general',
            icon: 'info-circle',
            title: 'Analysis Complete',
            content: `Processed <span class="stat">${features.length}</span> features based on your query.`
        }];

        if (features.length === 0) {
            insights[0].content = 'No features found matching your criteria. Try adjusting your query or filters.';
        }

        return insights;
    }

    analyzeRegions(features) {
        const regions = {
            counts: {},
            hottest: null,
            percentage: 0,
            pattern: null
        };

        features.forEach(f => {
            if (!f.geometry || f.geometry.type !== 'Point') return;

            const [lng, lat] = f.geometry.coordinates;
            const region = this.getRegionName(lat, lng);
            regions.counts[region] = (regions.counts[region] || 0) + 1;
        });

        const sorted = Object.entries(regions.counts).sort((a, b) => b[1] - a[1]);
        if (sorted.length > 0) {
            regions.hottest = sorted[0][0];
            regions.percentage = Math.round((sorted[0][1] / features.length) * 100);
        }

        if (sorted.length >= 3) {
            const total = sorted.reduce((sum, [, count]) => sum + count, 0);
            const top3Percent = sorted.slice(0, 3).reduce((sum, [, count]) => sum + count, 0) / total * 100;

            if (top3Percent > 70) {
                regions.pattern = 'Features are highly clustered in specific areas.';
            } else if (top3Percent < 30) {
                regions.pattern = 'Features are relatively evenly distributed across the region.';
            } else {
                regions.pattern = 'Features show moderate clustering with several distinct groups.';
            }
        }

        return regions;
    }

    getRegionName(lat, lng) {
        const latDirection = lat >= 40.75 ? 'North' : 'South';
        const lngDirection = lng >= -74.02 ? 'East' : 'West';

        if (Math.abs(lat - 40.75) < 0.05 && Math.abs(lng - (-74.02)) < 0.05) {
            return 'Central Manhattan';
        }

        return `${latDirection}-${lngDirection}`;
    }

    describeSpread(spread) {
        const avgSpread = (spread.latStdDev + spread.lngStdDev) / 2;
        const spreadKm = avgSpread * 111;

        if (spreadKm < 1) return 'compact';
        if (spreadKm < 5) return 'moderate';
        return 'dispersed';
    }

    identifyDensityRegions(features) {
        const hotspots = [];
        const gridSize = 0.02;
        const points = features.filter(f => f.geometry && f.geometry.type === 'Point');

        if (points.length < 5) return hotspots;

        const lats = points.map(p => p.geometry.coordinates[1]);
        const lngs = points.map(p => p.geometry.coordinates[0]);
        const bounds = {
            minLat: Math.min(...lats),
            maxLat: Math.max(...lats),
            minLng: Math.min(...lngs),
            maxLng: Math.max(...lngs)
        };

        for (let lat = bounds.minLat; lat < bounds.maxLat; lat += gridSize) {
            for (let lng = bounds.minLng; lng < bounds.maxLng; lng += gridSize) {
                const count = points.filter(p => {
                    const pLat = p.geometry.coordinates[1];
                    const pLng = p.geometry.coordinates[0];
                    return Math.abs(pLat - lat) < gridSize && Math.abs(pLng - lng) < gridSize;
                }).length;

                if (count >= 10) {
                    hotspots.push({ lat, lng, count });
                }
            }
        }

        return hotspots;
    }

    groupByType(features) {
        const groups = {};

        features.forEach(f => {
            const type = f.properties.type || 'Other';
            if (!groups[type]) groups[type] = [];
            groups[type].push(f);
        });

        return groups;
    }

    countBySeverity(features) {
        const counts = {};

        features.forEach(f => {
            if (f.properties.severity) {
                counts[f.properties.severity] = (counts[f.properties.severity] || 0) + 1;
            }
        });

        return counts;
    }

    getSeverityClass(severity) {
        switch (severity.toLowerCase()) {
            case 'high': return 'danger';
            case 'medium': return 'warning';
            case 'low': return 'success';
            default: return '';
        }
    }

    formatInsights(insights) {
        return insights.map(insight => {
            let iconClass = '';
            switch (insight.icon) {
                case 'fire': iconClass = 'fa-fire'; break;
                case 'map-marker-alt': iconClass = 'fa-map-marker-alt'; break;
                case 'chart-line': iconClass = 'fa-chart-line'; break;
                case 'hashtag': iconClass = 'fa-hashtag'; break;
                case 'list': iconClass = 'fa-list'; break;
                case 'layer-group': iconClass = 'fa-layer-group'; break;
                case 'arrows-alt': iconClass = 'fa-arrows-alt'; break;
                case 'location-arrow': iconClass = 'fa-location-arrow'; break;
                case 'star': iconClass = 'fa-star'; break;
                case 'filter': iconClass = 'fa-filter'; break;
                case 'balance-scale': iconClass = 'fa-balance-scale'; break;
                case 'chart-bar': iconClass = 'fa-chart-bar'; break;
                case 'tags': iconClass = 'fa-tags'; break;
                case 'calendar': iconClass = 'fa-calendar'; break;
                case 'info-circle': iconClass = 'fa-info-circle'; break;
                default: iconClass = 'fa-circle';
            }

            return `
                <div class="insight-card">
                    <div class="insight-header">
                        <i class="fas ${iconClass}"></i>
                        <strong>${insight.title}</strong>
                    </div>
                    <p>${insight.content}</p>
                </div>
            `;
        }).join('');
    }
}

window.InsightsGenerator = InsightsGenerator;
