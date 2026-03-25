# Adding Datasets to Smart GIS Chatbot

There are **3 ways** to add datasets to the application.

---

## Method 1: Add Sample Data (For Demo/Testing)

### Step 1: Add Layer Config in `config.js`

```javascript
// Add this to sampleLayers array
{
    id: 'your_data',
    name: 'Your Data Name',
    type: 'point',  // or 'polygon', 'line'
    color: '#FF5722',
    icon: 'map-pin',
    attributes: ['attribute1', 'attribute2'],
    queries: ['keyword1', 'keyword2']
}
```

### Step 2: Add Generator in `geoserver-client.js`

```javascript
// Add a method like this:
generateYourData(centerLat, centerLng) {
    const features = [];
    for (let i = 0; i < 50; i++) {
        features.push({
            type: 'Feature',
            geometry: {
                type: 'Point',
                coordinates: [
                    centerLng + (Math.random() - 0.5) * 0.1,
                    centerLat + (Math.random() - 0.5) * 0.1
                ]
            },
            properties: {
                id: `data_${i}`,
                name: `Item ${i}`,
                value: Math.floor(Math.random() * 100),
                category: ['A', 'B', 'C'][Math.floor(Math.random() * 3)]
            }
        });
    }
    return features;
}
```

### Step 3: Register the Generator

```javascript
// In getSampleData() method, add:
const yourData = this.generateYourData(centerLat, centerLng);

// And return it:
return { accidents, schools, hospitals, parks, buildings, roads, yourData };
```

---

## Method 2: Load from GeoJSON File

### Step 1: Create your GeoJSON file in `datasets/` folder

```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": {
        "type": "Point",
        "coordinates": [-74.006, 40.7128]
      },
      "properties": {
        "id": "1",
        "name": "Location 1",
        "category": "A"
      }
    }
  ]
}
```

### Step 2: Load it in `geoserver-client.js`

```javascript
async loadGeoJSON(filename) {
    try {
        const response = await fetch(`datasets/${filename}`);
        const data = await response.json();
        return data.features;
    } catch (error) {
        console.error('Failed to load GeoJSON:', error);
        return [];
    }
}
```

---

## Method 3: Connect to GeoServer

### Step 1: Update `config.js`

```javascript
geoserver: {
    url: 'http://YOUR_GEOSERVER:8080/geoserver',
    workspace: 'YOUR_WORKSPACE',
    // ...
}
```

### Step 2: Add layers in `geoserver-client.js`

```javascript
// In addDefaultLayers():
const wmsUrl = geoServerClient.getWMSUrl('your_layer_name');
const wmsLayer = L.tileLayer.wms(wmsUrl, {
    layers: 'workspace:your_layer_name',
    transparent: true,
    format: 'image/png'
});
```

---

## Quick Example: Add "Fire Stations" Dataset

### 1. Add to `config.js`:
```javascript
{
    id: 'fire_stations',
    name: 'Fire Stations',
    type: 'point',
    color: '#FF0000',
    icon: 'fire-extinguisher',
    attributes: ['name', 'capacity', 'status'],
    queries: ['fire', 'fire station', 'firefighter']
}
```

### 2. Add to `geoserver-client.js`:
```javascript
// In getSampleData():
const fireStations = this.generatePointFeatures(centerLat, centerLng, 20, {
    id: 'fire_stations',
    properties: {
        name: () => `Fire Station ${Math.floor(Math.random() * 50) + 1}`,
        capacity: () => Math.floor(Math.random() * 500) + 100,
        status: () => ['active', 'standby', 'maintenance'][Math.floor(Math.random() * 3)]
    }
});

// Add to return:
return { accidents, schools, hospitals, parks, buildings, roads, fireStations };
```

---

## Dataset Format Requirements

### Point Features
```json
{
  "type": "Feature",
  "geometry": {
    "type": "Point",
    "coordinates": [longitude, latitude]
  },
  "properties": {
    "id": "1",
    "name": "Name",
    "category": "type"
  }
}
```

### Polygon Features
```json
{
  "type": "Feature",
  "geometry": {
    "type": "Polygon",
    "coordinates": [[[lng1, lat1], [lng2, lat2], ...]]
  },
  "properties": {
    "id": "1",
    "name": "Area Name"
  }
}
```

### Line Features
```json
{
  "type": "Feature",
  "geometry": {
    "type": "LineString",
    "coordinates": [[lng1, lat1], [lng2, lat2], ...]
  },
  "properties": {
    "id": "1",
    "name": "Route Name"
  }
}
```

---

## Testing Your Dataset

After adding data, restart the server:
```bash
npm start
```

Try these queries:
- "Show me [your_data_name]"
- "Where are [keyword]?"
- "Count [your_data]"

---

## Need Help?

If you have a specific dataset, share it with me and I'll help you integrate it!
