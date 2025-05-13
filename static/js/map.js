// Map handling for pipeline route planning system
// Добавляем в начало файла
const PipelineTools = {
    depthMarkers: [],
    pipelineLayer: null,
    
    init: function(map) {
        this.pipelineLayer = L.layerGroup().addTo(map);
        this.setupPipelineControls();
    },
    
    setupPipelineControls: function() {
        const controlPanel = document.getElementById('pipeline-controls');
        
        // Глубина прокладки
        const depthControl = document.createElement('div');
        depthControl.innerHTML = `
            <div class="form-group">
                <label>Глубина прокладки (м)</label>
                <input type="range" id="pipeline-depth" min="1" max="10" step="0.5" value="2.5">
                <span id="depth-value">2.5</span>
            </div>
        `;
        controlPanel.appendChild(depthControl);
        
        document.getElementById('pipeline-depth').addEventListener('input', (e) => {
            document.getElementById('depth-value').textContent = e.target.value;
            this.updateDepthMarkers();
        });
    },
    
    addPipelinePoint: function(latlng, depth = 2.5) {
        const marker = L.circleMarker(latlng, {
            radius: 6,
            color: '#3498db',
            fillColor: '#2980b9',
            fillOpacity: 0.8,
            weight: 2
        }).addTo(this.pipelineLayer);
        
        marker.bindPopup(`
            <div class="pipeline-point-info">
                <h4>Точка трубопровода</h4>
                <p>Координаты: ${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)}</p>
                <p>Глубина: <input type="number" value="${depth}" step="0.1" min="1" max="20"></p>
            </div>
        `);
        
        this.depthMarkers.push({
            marker: marker,
            depth: depth
        });
    },
    
    updateDepthMarkers: function() {
        const newDepth = parseFloat(document.getElementById('pipeline-depth').value);
        this.depthMarkers.forEach(marker => {
            marker.depth = newDepth;
            marker.marker.setPopupContent(`
                <div class="pipeline-point-info">
                    <h4>Точка трубопровода</h4>
                    <p>Координаты: ${marker.marker.getLatLng().lat.toFixed(4)}, 
                                  ${marker.marker.getLatLng().lng.toFixed(4)}</p>
                    <p>Глубина: <input type="number" value="${newDepth}" step="0.1" min="1" max="20"></p>
                </div>
            `);
        });
    }
};
// Define Map namespace to prevent global conflicts
const Map = {
    map: null,
    startMarker: null,
    endMarker: null,
    routeLines: [],
    terrainLayer: null,
    grid: null,
    isGridVisible: false,
    coordsDisplay: null,
    gridToggle: null,
    mapCenter: [52.3, 104.3],
    terrainCache: {},

    initialize: function() {
        this.map = L.map('map').setView(this.mapCenter, 10);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 18
        }).addTo(this.map);

        this.terrainLayer = L.layerGroup().addTo(this.map);
        this.grid = L.layerGroup().addTo(this.map);

        this.coordsDisplay = document.getElementById('coordinates');
        this.gridToggle = document.getElementById('grid-toggle');

        this.setupEventListeners();
        this.loadTerrainData();

        console.log('Map initialized');
        PipelineTools.init(this.map);
    },

    loadTerrainData: function() {
        const bounds = this.map.getBounds();
        const url = `/api/terrain?north=${bounds.getNorth()}&south=${bounds.getSouth()}&east=${bounds.getEast()}&west=${bounds.getWest()}`;

        fetch(url)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    this.updateTerrainLayer(data.terrain_data);
                }
            })
            .catch(error => console.error('Error loading terrain data:', error));
    },

    setupEventListeners: function() {
        const self = this;

        this.map.on('mousemove', function(e) {
            self.coordsDisplay.textContent = `Координаты: ${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)}`;
        });
        this.map.on('click', this.onMapClick.bind(this));
        if (this.gridToggle) {
            this.gridToggle.addEventListener('click', function() {
                self.toggleGrid();
            });
        }

        this.map.on('moveend', () => this.loadTerrainData());
    },

    clearStartMarker: function() {
        if (this.startMarker) {
            this.map.removeLayer(this.startMarker);
            this.startMarker = null;
        }
    },

    clearEndMarker: function() {
        if (this.endMarker) {
            this.map.removeLayer(this.endMarker);
            this.endMarker = null;
        }
    },

    clearRoutes: function() {
        this.routeLines.forEach(line => this.map.removeLayer(line));
        this.routeLines = [];
    },

    displayRoutes: function(routes) {
    this.clearRoutes();

    // Проверка наличия маршрутов
    if (!routes || !Array.isArray(routes)) {
        console.error('Нет данных маршрутов для отображения');
        return;
    }

    // Создаем таблицу сравнения с защитой от undefined
    let comparisonDiv = document.createElement('div');
    comparisonDiv.className = 'route-comparison';
    
    comparisonDiv.innerHTML = `
        <h4>Сравнение маршрутов</h4>
        <table class="table table-bordered">
            <thead>
                <tr>
                    <th>Параметр</th>
                    ${routes.map(r => 
                        `<th style="color:${r.color || '#3498db'}">${r.type || 'Маршрут'}</th>`
                    ).join('')}
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>Расстояние</td>
                    ${routes.map(r => 
                        `<td>${r.metrics?.total_distance ? r.metrics.total_distance.toFixed(2) + ' км' : '—'}</td>`
                    ).join('')}
                </tr>
                <tr>
                    <td>Сложность</td>
                    ${routes.map(r => 
                        `<td>${r.metrics?.terrain_difficulty_score ? (r.metrics.terrain_difficulty_score * 100).toFixed(1) + '%' : '—'}</td>`
                    ).join('')}
                </tr>
                <tr>
                    <td>Стоимость</td>
                    ${routes.map(r => 
                        `<td>${r.metrics?.estimated_cost ? r.metrics.estimated_cost.toFixed(2) + ' млн ₽' : '—'}</td>`
                    ).join('')}
                </tr>
                <tr>
                    <td>Время строительства</td>
                    ${routes.map(r => 
                        `<td>${r.metrics?.estimated_construction_time || '—'}</td>`
                    ).join('')}
                </tr>
            </tbody>
        </table>
    `;

    document.getElementById('route-info').innerHTML = '';
    document.getElementById('route-info').appendChild(comparisonDiv);

    // Отображаем линии маршрутов с проверкой данных
    routes.forEach(route => {
        if (!route.route || !Array.isArray(route.route)) {
            console.warn('Некорректные данные маршрута:', route);
            return;
        }

        const routeLine = L.polyline(route.route, {
            color: route.color || '#3498db',
            weight: route.type === "Основной маршрут" ? 4 : 3,
            opacity: 0.8
        }).addTo(this.map);

        // Создаем содержимое popup с защитой от undefined
        let popupContent = `<strong>${route.type || 'Маршрут'}</strong><br>`;
        
        if (route.metrics?.total_distance) {
            popupContent += `Расстояние: ${route.metrics.total_distance.toFixed(2)} км<br>`;
        }
        if (route.metrics?.terrain_difficulty_score) {
            popupContent += `Сложность: ${(route.metrics.terrain_difficulty_score * 100).toFixed(1)}%<br>`;
        }
        if (route.metrics?.estimated_cost) {
            popupContent += `Стоимость: ${route.metrics.estimated_cost.toFixed(2)} млн ₽<br>`;
        }
        if (route.metrics?.estimated_construction_time) {
            popupContent += `Время строительства: ${route.metrics.estimated_construction_time} дней`;
        }

        routeLine.bindPopup(popupContent);
        this.routeLines.push(routeLine);
    });

    // Масштабируем карту к первому маршруту
    if (routes.length > 0 && routes[0].route) {
        this.map.fitBounds(L.latLngBounds(routes[0].route));
    }
    },

    setStartMarker: function(latLng) {
        if (this.startMarker) {
            this.map.removeLayer(this.startMarker);
        }

        const greenIcon = L.divIcon({
            className: 'custom-div-icon',
            html: `<div style="background-color: #2ecc71; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>`,
            iconSize: [16, 16],
            iconAnchor: [8, 8]
        });

        this.startMarker = L.marker(latLng, {
            icon: greenIcon,
            title: 'Начальная точка (A)'
        }).addTo(this.map);

        this.startMarker.bindTooltip('A', {
            permanent: true,
            direction: 'right',
            className: 'marker-label'
        });
    },

    setEndMarker: function(latLng) {
        if (this.endMarker) {
            this.map.removeLayer(this.endMarker);
        }

        const redIcon = L.divIcon({
            className: 'custom-div-icon',
            html: `<div style="background-color: #e74c3c; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white;"></div>`,
            iconSize: [16, 16],
            iconAnchor: [8, 8]
        });

        this.endMarker = L.marker(latLng, {
            icon: redIcon,
            title: 'Конечная точка (B)'
        }).addTo(this.map);

        this.endMarker.bindTooltip('B', {
            permanent: true,
            direction: 'right',
            className: 'marker-label'
        });
    },

    onMapClick: function(e) {
        const latlng = e.latlng;
        console.log('Clicked at:', latlng);
        const startInput = document.getElementById('start-point');
        const endInput = document.getElementById('end-point');

        const coordsStr = `${e.latlng.lat.toFixed(6)}, ${e.latlng.lng.toFixed(6)}`;
        // Режим добавления точек трубопровода
        if (document.getElementById('pipeline-mode').checked) {
            PipelineTools.addPipelinePoint(latlng);
            return;
        }
        if (!startInput.value) {
            startInput.value = coordsStr;
            this.setStartMarker([e.latlng.lat, e.latlng.lng]);
        }
        else if (!endInput.value) {
            endInput.value = coordsStr;
            this.setEndMarker([e.latlng.lat, e.latlng.lng]);
        }
        else {
            endInput.value = coordsStr;
            this.setEndMarker([e.latlng.lat, e.latlng.lng]);
        }
    },

    toggleGrid: function() {
        this.isGridVisible = !this.isGridVisible;

        if (this.isGridVisible) {
            this.gridToggle.textContent = 'Скрыть сетку';
            this.showGrid();
        } else {
            this.gridToggle.textContent = 'Показать сетку';
            this.grid.clearLayers();
        }
    },

    showGrid: function() {
        this.grid.clearLayers();

        const bounds = this.map.getBounds();
        const north = bounds.getNorth();
        const south = bounds.getSouth();
        const east = bounds.getEast();
        const west = bounds.getWest();

        const gridSize = 0.05;

        for (let lng = Math.floor(west / gridSize) * gridSize; lng <= east; lng += gridSize) {
            L.polyline([[south, lng], [north, lng]], {
                color: '#aaa',
                weight: 1,
                opacity: 0.5
            }).addTo(this.grid);
        }

        for (let lat = Math.floor(south / gridSize) * gridSize; lat <= north; lat += gridSize) {
            L.polyline([[lat, west], [lat, east]], {
                color: '#aaa',
                weight: 1,
                opacity: 0.5
            }).addTo(this.grid);
        }
    },

    updateTerrainLayer: function(terrainData) {
        this.terrainLayer.clearLayers();
        if (terrainData && terrainData.grid) {
            this.renderTerrainHeatmap(terrainData.grid);

            if (terrainData.features) {
                this.renderFeatures(terrainData.features);
            }
        }
    },

    renderTerrainHeatmap: function(grid) {
        for (let row of grid) {
            for (let cell of row) {
                const position = cell.position;
                const difficulty = cell.difficulty;

                if (difficulty < 0.1) continue;

                const color = this.getDifficultyColor(difficulty);

                L.circleMarker(position, {
                    radius: 8,
                    color: color,
                    fillColor: color,
                    fillOpacity: 0.4,
                    weight: 0
                }).addTo(this.terrainLayer);
            }
        }
    },

    getDifficultyColor: function(difficulty) {
        if (difficulty < 0.3) {
            return '#2ecc71';
        } else if (difficulty < 0.6) {
            return '#f1c40f';
        } else {
            return '#e74c3c';
        }
    },

    renderFeatures: function(features) {
        for (let feature of features) {
            switch (feature.type) {
                case 'river':
                    this.renderRiver(feature);
                    break;
                case 'road':
                    this.renderRoad(feature);
                    break;
                case 'settlement':
                    this.renderSettlement(feature);
                    break;
                case 'protected_area':
                    this.renderProtectedArea(feature);
                    break;
            }
        }
    },

    renderRiver: function(river) {
        L.polyline(river.points, {
            color: '#3498db',
            weight: Math.max(2, river.width * 1000),
            opacity: 0.7
        }).addTo(this.terrainLayer)
        .bindTooltip(river.name);
    },

    renderRoad: function(road) {
        L.polyline(road.points, {
            color: '#7f8c8d',
            weight: 2,
            opacity: 0.8
        }).addTo(this.terrainLayer)
        .bindTooltip(road.name);
    },

    renderSettlement: function(settlement) {
        L.circle(settlement.center, {
            radius: settlement.radius * 111000,
            color: '#2c3e50',
            fillColor: '#2c3e50',
            fillOpacity: 0.2,
            weight: 1
        }).addTo(this.terrainLayer)
        .bindTooltip(settlement.name);
    },

    renderProtectedArea: function(area) {
        L.circle(area.center, {
            radius: area.radius * 111000,
            color: '#c0392b',
            fillColor: '#c0392b',
            fillOpacity: 0.2,
            weight: 1,
            dashArray: '5, 5'
        }).addTo(this.terrainLayer)
        .bindTooltip(area.name);
    },

    displayRoute: function(route, options = {}) {
        const coordinates = route.map(point => [point[0], point[1]]);

        const routeLine = L.polyline(coordinates, {
            color: options.color || '#3498db',
            weight: options.weight || 4,
            opacity: options.opacity || 0.8,
            lineJoin: 'round'
        }).addTo(this.map);

        this.routeLines.push(routeLine);

        if (this.routeLines.length === 1) {
            this.map.fitBounds(routeLine.getBounds(), {
                padding: [50, 50]
            });
        }

        this.addDistanceMarkers(coordinates);
        this.highlightDifficultSections(coordinates);
    },

    addDistanceMarkers: function(coordinates) {
        let distanceSoFar = 0;

        for (let i = 1; i < coordinates.length; i++) {
            const segmentDistance = this.calculateDistance(coordinates[i-1], coordinates[i]);
            distanceSoFar += segmentDistance;

            if (Math.floor(distanceSoFar) > Math.floor(distanceSoFar - segmentDistance)) {
                const km = Math.floor(distanceSoFar);

                const position = this.interpolatePosition(
                    coordinates[i-1], 
                    coordinates[i], 
                    (km - (distanceSoFar - segmentDistance)) / segmentDistance
                );

                const marker = L.circleMarker(position, {
                    radius: 4,
                    color: '#3498db',
                    fillColor: '#3498db',
                    fillOpacity: 1
                }).addTo(this.map);

                marker.bindTooltip(`${km} км`, {
                    permanent: false,
                    direction: 'top'
                });
            }
        }
    },

    calculateDistance: function(point1, point2) {
        const lat1 = point1[0] * Math.PI / 180;
        const lng1 = point1[1] * Math.PI / 180;
        const lat2 = point2[0] * Math.PI / 180;
        const lng2 = point2[1] * Math.PI / 180;

        const R = 6371;
        const dLat = lat2 - lat1;
        const dLng = lng2 - lng1;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1) * Math.cos(lat2) *
                Math.sin(dLng/2) * Math.sin(dLng/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    },

    interpolatePosition: function(point1, point2, ratio) {
        return [
            point1[0] + (point2[0] - point1[0]) * ratio,
            point1[1] + (point2[1] - point1[1]) * ratio
        ];
    },

    highlightDifficultSections: function(coordinates) {
        for (let i = 1; i < coordinates.length; i++) {
            const lat = coordinates[i][0];
            const lng = coordinates[i][1];
            const difficulty = Math.sin(lat * 10) * Math.cos(lng * 10);

            if (difficulty > 0.7) {
                L.polyline([coordinates[i-1], coordinates[i]], {
                    color: '#f1c40f',
                    weight: 6,
                    opacity: 0.7,
                    dashArray: '5, 10'
                }).addTo(this.map);
            }
        }
    }
};

document.addEventListener('DOMContentLoaded', function() {
    Map.initialize();
});