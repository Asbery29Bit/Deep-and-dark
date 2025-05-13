// Main application logic for pipeline route planning system

document.addEventListener('DOMContentLoaded', function() {
    // Initialize application state
    const appState = {
        calculationInProgress: false,
        currentRoute: null,
        routeMetrics: null,
        serverConnected: true,
        lastUpdate: null
    };

    // DOM Elements
    const elements = {
        // Tabs
        inputTab: document.getElementById('input-tab'),
        resultsTab: document.getElementById('results-tab'),
        helpTab: document.getElementById('help-tab'),

        // Form inputs
        projectName: document.getElementById('project-name'),
        pipeType: document.getElementById('pipe-type'),
        startPoint: document.getElementById('start-point'),
        endPoint: document.getElementById('end-point'),
        pipeDiameter: document.getElementById('pipe-diameter'),
        pipeMaterial: document.getElementById('pipe-material'),
        maxPressure: document.getElementById('max-pressure'),

        // Weights sliders
        distanceWeight: document.getElementById('distance-weight'),
        terrainWeight: document.getElementById('terrain-weight'),
        environmentWeight: document.getElementById('environment-weight'),
        costWeight: document.getElementById('cost-weight'),
        accessWeight: document.getElementById('access-weight'),

        // Weight values displays
        distanceWeightValue: document.getElementById('distance-weight-value'),
        terrainWeightValue: document.getElementById('terrain-weight-value'),
        environmentWeightValue: document.getElementById('environment-weight-value'),
        costWeightValue: document.getElementById('cost-weight-value'),
        accessWeightValue: document.getElementById('access-weight-value'),

        // Buttons
        calculateBtn: document.getElementById('calculate-btn'),
        cancelBtn: document.getElementById('cancel-btn'),
        clearStartBtn: document.getElementById('clear-start'),
        clearEndBtn: document.getElementById('clear-end'),
        generateReportBtn: document.getElementById('generate-report-btn'),
        exportRouteBtn: document.getElementById('export-route-btn'),

        // Results elements
        routeLength: document.getElementById('route-length'),
        routeCost: document.getElementById('route-cost'),
        constructionTime: document.getElementById('construction-time'),
        terrainDifficulty: document.getElementById('terrain-difficulty'),
        environmentalImpact: document.getElementById('environmental-impact'),
        criteriaChartContainer: document.getElementById('criteria-chart-container'),

        // UI elements
        progressContainer: document.getElementById('progress-container'),
        progressBar: document.getElementById('progress-bar'),
        loading: document.getElementById('loading'),
        serverStatusIndicator: document.getElementById('server-status-indicator'),
        serverStatus: document.getElementById('server-status'),
        lastUpdate: document.getElementById('last-update')
    };

    // Initialize sliders and their value displays
    initializeSliders();

    // Set up event listeners
    setupEventListeners();

    // Check server connection
    checkServerConnection();

    // Initialize the chart
    let criteriaChart = null;

    // Functions
    function initializeSliders() {
        // Set up weights sliders
        setupSlider(elements.distanceWeight, elements.distanceWeightValue);
        setupSlider(elements.terrainWeight, elements.terrainWeightValue);
        setupSlider(elements.environmentWeight, elements.environmentWeightValue);
        setupSlider(elements.costWeight, elements.costWeightValue);
        setupSlider(elements.accessWeight, elements.accessWeightValue);

        // Ensure weights add up to 100%
        elements.distanceWeight.addEventListener('input', normalizeWeights);
        elements.terrainWeight.addEventListener('input', normalizeWeights);
        elements.environmentWeight.addEventListener('input', normalizeWeights);
        elements.costWeight.addEventListener('input', normalizeWeights);
        elements.accessWeight.addEventListener('input', normalizeWeights);
    }

    function setupSlider(slider, valueDisplay) {
        slider.addEventListener('input', function() {
            valueDisplay.textContent = this.value + '%';
        });
    }

    function normalizeWeights() {
        // Get all current weights
        const weights = {
            distance: parseInt(elements.distanceWeight.value),
            terrain: parseInt(elements.terrainWeight.value),
            environment: parseInt(elements.environmentWeight.value),
            cost: parseInt(elements.costWeight.value),
            access: parseInt(elements.accessWeight.value)
        };

        // Calculate total (should be 100)
        const total = weights.distance + weights.terrain + weights.environment + weights.cost + weights.access;

        // Only normalize if needed and not while user is still adjusting
        if (total !== 100 && !document.activeElement.matches('input[type="range"]')) {
            // Normalize all weights to sum to 100
            const factor = 100 / total;
            weights.distance = Math.round(weights.distance * factor);
            weights.terrain = Math.round(weights.terrain * factor);
            weights.environment = Math.round(weights.environment * factor);
            weights.cost = Math.round(weights.cost * factor);

            // Adjust the last weight to ensure sum is exactly 100
            weights.access = 100 - weights.distance - weights.terrain - weights.environment - weights.cost;

            // Update sliders and displays
            elements.distanceWeight.value = weights.distance;
            elements.terrainWeight.value = weights.terrain;
            elements.environmentWeight.value = weights.environment;
            elements.costWeight.value = weights.cost;
            elements.accessWeight.value = weights.access;

            elements.distanceWeightValue.textContent = weights.distance + '%';
            elements.terrainWeightValue.textContent = weights.terrain + '%';
            elements.environmentWeightValue.textContent = weights.environment + '%';
            elements.costWeightValue.textContent = weights.cost + '%';
            elements.accessWeightValue.textContent = weights.access + '%';
        }
    }

    function setupEventListeners() {
        // Tab navigation
        document.querySelectorAll('.menu-item').forEach(item => {
            item.addEventListener('click', function() {
                document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
                this.classList.add('active');

                // Get the tab id from the item's onclick attribute
                const tabId = this.getAttribute('onclick').match(/'([^']+)'/)[1];

                // Hide all tabs and show the selected one
                document.querySelectorAll('.tab-content').forEach(tab => {
                    tab.classList.remove('active');
                });
                document.getElementById(tabId).classList.add('active');
            });
        });

        // Calculate route button
        elements.calculateBtn.addEventListener('click', calculateRoute);

        // Cancel calculation button
        elements.cancelBtn.addEventListener('click', cancelCalculation);

        // Clear points buttons
        elements.clearStartBtn.addEventListener('click', function() {
            elements.startPoint.value = '';
            Map.clearStartMarker();
        });

        elements.clearEndBtn.addEventListener('click', function() {
            elements.endPoint.value = '';
            Map.clearEndMarker();
        });

        // Report generation
        elements.generateReportBtn.addEventListener('click', generateReport);

        // Export route
        elements.exportRouteBtn.addEventListener('click', exportRoute);

        // Update pipe type dependent weights
        elements.pipeType.addEventListener('change', function() {
            const pipeType = this.value;

            // Adjust weights based on pipe type
            if (pipeType === 'gas') {
                elements.environmentWeight.value = 25;
                elements.terrainWeight.value = 25;
                elements.costWeight.value = 15;
                elements.environmentWeightValue.textContent = '25%';
                elements.terrainWeightValue.textContent = '25%';
                elements.costWeightValue.textContent = '15%';
            } else if (pipeType === 'water') {
                elements.terrainWeight.value = 15;
                elements.costWeight.value = 25;
                elements.terrainWeightValue.textContent = '15%';
                elements.costWeightValue.textContent = '25%';
            } else { // oil (default)
                elements.distanceWeight.value = 30;
                elements.terrainWeight.value = 20;
                elements.environmentWeight.value = 15;
                elements.costWeight.value = 20;
                elements.accessWeight.value = 15;
                elements.distanceWeightValue.textContent = '30%';
                elements.terrainWeightValue.textContent = '20%';
                elements.environmentWeightValue.textContent = '15%';
                elements.costWeightValue.textContent = '20%';
                elements.accessWeightValue.textContent = '15%';
            }

            normalizeWeights();
        });
    }

    function calculateRoute() {
        // Validate input
        if (!validateInput()) {
            return;
        }

        // Show loading and progress indicators
        appState.calculationInProgress = true;
        elements.loading.style.display = 'flex';
        elements.progressContainer.style.display = 'block';
        elements.calculateBtn.style.display = 'none';
        elements.cancelBtn.style.display = 'block';

        // Reset progress
        let progress = 0;
        const progressInterval = setInterval(() => {
            // Simulate progress from 0% to 95%
            if (progress < 95) {
                progress += Math.random() * 5;
                elements.progressBar.style.width = progress + '%';
                elements.progressBar.textContent = Math.round(progress) + '%';
            }
        }, 300);

        // Get criteria weights
        const criteriaWeights = {
            distance: parseInt(elements.distanceWeight.value) / 100,
            terrain_difficulty: parseInt(elements.terrainWeight.value) / 100,
            environmental_impact: parseInt(elements.environmentWeight.value) / 100,
            construction_cost: parseInt(elements.costWeight.value) / 100,
            maintenance_access: parseInt(elements.accessWeight.value) / 100
        };

        // Prepare request data
        const requestData = {
            projectName: elements.projectName.value,
            pipeType: elements.pipeType.value,
            startPoint: elements.startPoint.value,
            endPoint: elements.endPoint.value,
            pipeDiameter: elements.pipeDiameter.value,
            pipeMaterial: elements.pipeMaterial.value,
            maxPressure: elements.maxPressure.value,
            criteriaWeights: criteriaWeights
        };

        // Send request to the server
        fetch('/api/calculate_route', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestData)
        })
        .then(response => response.json())
        .then(data => {
            // Stop progress simulation
            clearInterval(progressInterval);

            // Complete progress to 100%
            elements.progressBar.style.width = '100%';
            elements.progressBar.textContent = '100%';

            // Set calculation completed state
            appState.calculationInProgress = false;
            elements.loading.style.display = 'none';
            elements.calculateBtn.style.display = 'block';
            elements.cancelBtn.style.display = 'none';

            if (data.success) {
                // Store route data
                appState.currentRoute = data.route;
                appState.routeMetrics = data.metrics;

                // Clear previous routes
                Map.clearRoutes();

                // Draw all routes on map
                if (data.routes) {
                    data.routes.forEach(routeData => {
                        Map.displayRoute(routeData.route, {
                            color: routeData.color,
                            weight: routeData.type === "Основной маршрут" ? 5 : 3,
                            opacity: routeData.type === "Основной маршрут" ? 1 : 0.7
                        });

                        // Add route type label to the map
                        const midpoint = routeData.route[Math.floor(routeData.route.length / 2)];
                        const label = L.marker(midpoint, {
                            icon: L.divIcon({
                                className: 'route-label',
                                html: `<div style="color:${routeData.color}">${routeData.type}</div>`
                            })
                        }).addTo(Map.map);
                        Map.routeLines.push(label);
                    });
                }

                // Update results tab
                updateResults(data);

                // Switch to results tab
                document.querySelector('.menu-item[onclick="openTab(event, \'results-tab\')"]').click();

                // Update last update time
                appState.lastUpdate = new Date();
                elements.lastUpdate.textContent = 'Последнее обновление: ' + 
                    appState.lastUpdate.toLocaleTimeString();
            } else {
                // Show error message
                alert('Ошибка расчета маршрута: ' + data.error);
            }
        })
        .catch(error => {
            // Handle error
            clearInterval(progressInterval);
            appState.calculationInProgress = false;
            elements.loading.style.display = 'none';
            elements.progressContainer.style.display = 'none';
            elements.calculateBtn.style.display = 'block';
            elements.cancelBtn.style.display = 'none';

            alert('Произошла ошибка при расчете: ' + error.message);
            console.error('Calculation error:', error);

            // Update server status
            updateServerStatus(false);
        });
    }

    function validateInput() {
        // Check start and end points
        if (!elements.startPoint.value) {
            alert('Пожалуйста, укажите начальную точку.');
            return false;
        }

        if (!elements.endPoint.value) {
            alert('Пожалуйста, укажите конечную точку.');
            return false;
        }

        // Check pipe diameter
        const diameter = parseFloat(elements.pipeDiameter.value);
        if (isNaN(diameter) || diameter < 100 || diameter > 2000) {
            alert('Диаметр трубопровода должен быть от 100 до 2000 мм.');
            return false;
        }

        // Check pressure
        const pressure = parseFloat(elements.maxPressure.value);
        if (isNaN(pressure) || pressure < 1 || pressure > 100) {
            alert('Максимальное давление должно быть от 1 до 100 атм.');
            return false;
        }

        return true;
    }

    function cancelCalculation() {
        // Reset calculation state
        appState.calculationInProgress = false;
        elements.loading.style.display = 'none';
        elements.progressContainer.style.display = 'none';
        elements.calculateBtn.style.display = 'block';
        elements.cancelBtn.style.display = 'none';

        // Send cancel request to server (if needed)
        // This would be necessary if the server implementation supports cancellation
        fetch('/api/cancel_calculation', {
            method: 'POST'
        }).catch(error => {
            console.log('Cancel request error (expected):', error);
        });
    }

    function updateResults(data) {
        // Проверяем наличие данных или задаём значения по умолчанию
        const routeLength = data.total_distance !== undefined ? `${data.total_distance} км` : '-';
        const routeCost = data.estimated_cost !== undefined ? `${data.estimated_cost} руб.` : '-';
        const constructionTime = data.metrics?.estimated_construction_time !== undefined ? `${data.metrics.estimated_construction_time} дней` : '-';
        const terrainDifficulty = data.metrics?.terrain_difficulty_score !== undefined ? `${data.metrics.terrain_difficulty_score}` : '-';
        const environmentalImpact = data.metrics?.environmental_impact_score !== undefined ? `${data.metrics.environmental_impact_score}` : '-';

        // Обновляем элементы
        document.getElementById('route-length').textContent = `Длина: ${routeLength}`;
        document.getElementById('route-cost').textContent = `Стоимость строительства: ${routeCost}`;
        document.getElementById('construction-time').textContent = `Время строительства: ${constructionTime}`;
        document.getElementById('terrain-difficulty').textContent = `Сложность рельефа: ${terrainDifficulty}`;
        document.getElementById('environmental-impact').textContent = `Экологический эффект: ${environmentalImpact}`;
    }

    function updateCriteriaChart(metrics) {
        const ctx = document.createElement('canvas');
        elements.criteriaChartContainer.innerHTML = '';
        elements.criteriaChartContainer.appendChild(ctx);

        if (criteriaChart) {
            criteriaChart.destroy();
        }

        // Prepare data for radar chart
        const data = {
            labels: [
                'Дистанция',
                'Сложность рельефа',
                'Экологический эффект',
                'Стоимость',
                'Доступность'
            ],
            datasets: [{
                label: 'Показатели маршрута',
                data: [
                    // Invert some values where lower is better
                    1 - (metrics.total_distance / 100), // Normalize distance (0 is long, 1 is short)
                    1 - metrics.terrain_difficulty_score, // Lower terrain difficulty is better
                    1 - metrics.environmental_impact_score, // Lower environmental impact is better
                    1 - (metrics.estimated_cost / 100), // Lower cost is better
                    1 - (metrics.accessibility || 0.5) // Higher accessibility is better
                ],
                fill: true,
                backgroundColor: 'rgba(52, 152, 219, 0.2)',
                borderColor: 'rgba(52, 152, 219, 1)',
                pointBackgroundColor: 'rgba(52, 152, 219, 1)',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: 'rgba(52, 152, 219, 1)'
            }]
        };

        criteriaChart = new Chart(ctx, {
            type: 'radar',
            data: data,
            options: {
                scales: {
                    r: {
                        angleLines: {
                            display: true
                        },
                        suggestedMin: 0,
                        suggestedMax: 1
                    }
                }
            }
        });
    }

    function generateReport() {
        if (!appState.currentRoute) {
            alert('Сначала рассчитайте маршрут');
            return;
        }

        // In a full implementation, this would generate a PDF or other report format
        // For now, we'll just open a new window with a simple report
        const reportWindow = window.open('', '_blank');

        // Get project details
        const projectName = elements.projectName.value || 'Без названия';
        const pipeType = {
            'oil': 'Нефтепровод',
            'gas': 'Газопровод',
            'water': 'Водопровод'
        }[elements.pipeType.value] || 'Трубопровод';

        const pipeMaterial = {
            'steel': 'Сталь',
            'plastic': 'Пластик',
            'composite': 'Композит'
        }[elements.pipeMaterial.value] || 'Неизвестный материал';

        // Build report content
        reportWindow.document.write(`
            <html>
                <head>
                    <title>Отчет: ${projectName}</title>
                    <style>
                        body { font-family: Arial, sans-serif; margin: 40px; line-height: 1.6; }
                        h1 { color: #2c3e50; }
                        h2 { color: #3498db; margin-top: 30px; }
                        .section { margin-bottom: 30px; }
                        table { border-collapse: collapse; width: 100%; margin: 20px 0; }
                        th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
                        th { background-color: #f8f9fa; }
                        .footer { margin-top: 50px; font-size: 12px; color: #777; text-align: center; }
                    </style>
                </head>
                <body>
                    <h1>Отчет по проекту: ${projectName}</h1>
                    <div class="section">
                        <h2>Основные параметры</h2>
                        <table>
                            <tr><th>Тип трубопровода</th><td>${pipeType}</td></tr>
                            <tr><th>Материал</th><td>${pipeMaterial}</td></tr>
                            <tr><th>Диаметр</th><td>${elements.pipeDiameter.value} мм</td></tr>
                            <tr><th>Максимальное давление</th><td>${elements.maxPressure.value} атм</td></tr>
                            <tr><th>Начальная точка</th><td>${elements.startPoint.value}</td></tr>
                            <tr><th>Конечная точка</th><td>${elements.endPoint.value}</td></tr>
                        </table>
                    </div>

                    <div class="section">
                        <h2>Результаты расчета оптимального маршрута</h2>
                        <table>
                            <tr><th>Общая длина маршрута</th><td>${elements.routeLength.textContent.replace('Длина: ', '')}</td></tr>
                            <tr><th>Стоимость строительства</th><td>${elements.routeCost.textContent.replace('Стоимость строительства: ', '')}</td></tr>
                            <tr><th>Время строительства</th><td>${elements.constructionTime.textContent.replace('Время строительства: ', '')}</td></tr>
                            <tr><th>Сложность рельефа</th><td>${elements.terrainDifficulty.textContent.replace('Сложность рельефа: ', '')}</td></tr>
                            <tr><th>Экологический эффект</th><td>${elements.environmentalImpact.textContent.replace('Экологический эффект: ', '')}</td></tr>
                        </table>
                    </div>

                    <div class="section">
                        <h2>Критерии оптимизации</h2>
                        <table>
                            <tr><th>Дистанция</th><td>${elements.distanceWeight.value}%</td></tr>
                            <tr><th>Сложность рельефа</th><td>${elements.terrainWeight.value}%</td></tr>
                            <tr><th>Экологический эффект</th><td>${elements.environmentWeight.value}%</td></tr>
                            <tr><th>Стоимость</th><td>${elements.costWeight.value}%</td></tr>
                            <tr><th>Доступность</th><td>${elements.accessWeight.value}%</td></tr>
                        </table>
                    </div>

                    <div class="section">
                        <h2>Координаты маршрута</h2>
                        <table>
                            <tr><th>№</th><th>Широта</th><th>Долгота</th></tr>
                            ${appState.currentRoute.map((point, index) => 
                                `<tr><td>${index + 1}</td><td>${point[0].toFixed(6)}</td><td>${point[1].toFixed(6)}</td></tr>`
                            ).join('')}
                        </table>
                    </div>

                    <div class="footer">
                        Отчет сгенерирован ${new Date().toLocaleString()} | 
                        Система проектирования трасс трубопроводов
                    </div>
                </body>
            </html>
        `);
        reportWindow.document.close();
    }

    function exportRoute() {
        if (!appState.currentRoute) {
            alert('Сначала рассчитайте маршрут');
            return;
        }

        // Create GeoJSON structure
        const geojson = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "properties": {
                        "name": elements.projectName.value || "Трубопровод",
                        "type": elements.pipeType.value,
                        "diameter": elements.pipeDiameter.value,
                        "material": elements.pipeMaterial.value,
                        "pressure": elements.maxPressure.value,
                        "length": appState.routeMetrics.total_distance,
                        "cost": appState.routeMetrics.estimated_cost
                    },
                    "geometry": {
                        "type": "LineString",
                        "coordinates": appState.currentRoute.map(point => [point[1], point[0]])
                    }
                }
            ]
        };

        // Convert to string
        const geojsonStr = JSON.stringify(geojson, null, 2);

        // Create blob and download link
        const blob = new Blob([geojsonStr], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = (elements.projectName.value || 'pipeline') + '.geojson';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function checkServerConnection() {
        // Check server connection status
        fetch('/api/terrain?north=53&south=52&east=105&west=104')
            .then(response => {
                // Update server status based on response
                updateServerStatus(response.ok);
            })
            .catch(error => {
                console.error('Server check error:', error);
                updateServerStatus(false);
            });

        // Check again every 30 seconds
        setTimeout(checkServerConnection, 30000);
    }

    function updateServerStatus(connected) {
        appState.serverConnected = connected;

        if (connected) {
            elements.serverStatusIndicator.className = 'indicator green';
            elements.serverStatus.textContent = 'Сервер: подключен';
        } else {
            elements.serverStatusIndicator.className = 'indicator red';
            elements.serverStatus.textContent = 'Сервер: ошибка соединения';
        }
    }

    // Helper functions
    function formatDistance(distance) {
        if (typeof distance !== 'number') return '-';

        if (distance < 1) {
            // Convert to meters if less than 1 km
            const meters = Math.round(distance * 1000);
            return `${meters} м`;
        } else {
            // Round to 2 decimal places
            return `${distance.toFixed(2)} км`;
        }
    }

    function formatCost(cost) {
        if (typeof cost !== 'number') return '-';

        if (cost < 1) {
            // Convert to thousands if less than 1 million
            const thousands = Math.round(cost * 1000);
            return `${thousands} тыс. ₽`;
        } else {
            // Round to 2 decimal places
            return `${cost.toFixed(2)} млн. ₽`;
        }
    }

    function formatTime(days) {
        if (typeof days !== 'number') return '-';

        if (days < 1) {
            // Convert to hours if less than 1 day
            const hours = Math.round(days * 24);
            return `${hours} часов`;
        } else if (days < 30) {
            // Display days
            return `${Math.round(days)} дней`;
        } else {
            // Convert to months for longer periods
            const months = Math.round(days / 30);
            return `${months} месяцев`;
        }
    }

    function formatScore(score) {
        if (typeof score !== 'number') return '-';

        // Convert to percentage
        const percentage = Math.round(score * 100);

        // Add qualitative description
        let description;
        if (score < 0.2) {
            description = 'очень низкая';
        } else if (score < 0.4) {
            description = 'низкая';
        } else if (score < 0.6) {
            description = 'средняя';
        } else if (score < 0.8) {
            description = 'высокая';
        } else {
            description = 'очень высокая';
        }

        return `${percentage}% (${description})`;
    }
});

// Global function for tab navigation (called from HTML)
function openTab(event, tabId) {
    // Prevent default if it's an event
    if (event) {
        event.preventDefault();
    }

    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });

    // Show selected tab
    document.getElementById(tabId).classList.add('active');

    // Update menu active state
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active');
    });

    // Find and activate the menu item that opens this tab
    const menuItems = document.querySelectorAll('.menu-item');
    for (let i = 0; i < menuItems.length; i++) {
        const item = menuItems[i];
        if (item.getAttribute('onclick').includes(tabId)) {
            item.classList.add('active');
            break;
        }
    }
}
// Проверка перед использованием свойства
elements.constructionTime.textContent = 'Время строительства: ' + 
    (data.metrics.estimated_construction_time !== undefined 
        ? formatTime(data.metrics.estimated_construction_time) 
        : 'Данные недоступны');
// Обработчик для кнопки "Рассчитать маршрут"
document.getElementById('calculate-btn').addEventListener('click', async function () {
    const startValue = document.getElementById('start-point').value;
    const endValue = document.getElementById('end-point').value;
    
    if (!startValue || !endValue) {
        alert('Пожалуйста, укажите начальную и конечную точки');
        return;
    }
    
    const requestData = {
        startPoint: startValue,
        endPoint: endValue,
        pipeType: document.getElementById('pipe-type').value,
        pipeDiameter: document.getElementById('pipe-diameter').value,
        pipeMaterial: document.getElementById('pipe-material').value,
        maxPressure: document.getElementById('max-pressure').value,
        criteriaWeights: {
            distance: parseInt(document.getElementById('distance-weight').value) / 100,
            terrain_difficulty: parseInt(document.getElementById('terrain-weight').value) / 100,
            environmental_impact: parseInt(document.getElementById('environment-weight').value) / 100,
            construction_cost: parseInt(document.getElementById('cost-weight').value) / 100,
            maintenance_access: parseInt(document.getElementById('access-weight').value) / 100
        }
    };
    
    try {
        const response = await fetch('/api/calculate_route', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData)
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Обновляем результаты на UI
            const metrics = result.metrics;
            document.getElementById('route-length').textContent = 
                `Длина: ${(metrics.total_distance || 0).toFixed(2)} км`;
            document.getElementById('route-cost').textContent = 
                `Стоимость строительства: ${(metrics.estimated_cost || 0).toLocaleString()} руб.`;
            document.getElementById('construction-time').textContent = 
                metrics.estimated_construction_time 
                    ? `Время строительства: ${metrics.estimated_construction_time} дней`
                    : 'Время строительства: данные недоступны';
        } else {
            alert(result.error || 'Не удалось выполнить расчет маршрута.');
        }
    } catch (error) {
        console.error('Ошибка при вызове API:', error);
        alert('Произошла ошибка при расчете маршрута.');
    }
});