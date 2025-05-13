// Algorithm visualization and interaction for pipeline route planning

// AlgorithmViz namespace for visualization of algorithm execution
const AlgorithmViz = (function() {
    // Private variables
    let visualizationEnabled = false;
    let visualizationLayer = null;
    let exploredNodes = [];
    let visitedEdges = [];
    let currentPath = [];
    let map = null;
    let stepInterval = null;
    let animationSpeed = 100; // ms between steps
    
    // Path gradients - for visualizing multi-criteria costs
    const costColors = {
        distance: '#3498db',           // Blue
        terrain_difficulty: '#e74c3c', // Red
        environmental_impact: '#2ecc71', // Green
        construction_cost: '#f39c12',  // Orange
        maintenance_access: '#9b59b6'  // Purple
    };
    
    // Initialize visualization
    function initialize(mapInstance) {
        map = mapInstance;
        visualizationLayer = L.layerGroup().addTo(map);
        
        // Create control panel for visualization
        createControlPanel();
    }
    
    // Create visualization control panel
    function createControlPanel() {
        // Create custom control
        const VisualizationControl = L.Control.extend({
            options: {
                position: 'topright'
            },
            
            onAdd: function() {
                const container = L.DomUtil.create('div', 'algorithm-viz-control');
                container.style.backgroundColor = 'white';
                container.style.padding = '5px 10px';
                container.style.borderRadius = '4px';
                container.style.boxShadow = '0 1px 5px rgba(0,0,0,0.4)';
                
                // Toggle button
                const toggleBtn = L.DomUtil.create('button', '', container);
                toggleBtn.innerHTML = 'Показать визуализацию';
                toggleBtn.style.padding = '5px 10px';
                toggleBtn.style.cursor = 'pointer';
                toggleBtn.style.width = '100%';
                toggleBtn.style.marginBottom = '5px';
                
                // Speed control
                const speedContainer = L.DomUtil.create('div', '', container);
                speedContainer.style.display = 'none';
                
                const speedLabel = L.DomUtil.create('label', '', speedContainer);
                speedLabel.innerHTML = 'Скорость:';
                speedLabel.style.display = 'block';
                speedLabel.style.marginBottom = '5px';
                
                const speedSlider = L.DomUtil.create('input', '', speedContainer);
                speedSlider.type = 'range';
                speedSlider.min = '10';
                speedSlider.max = '1000';
                speedSlider.value = animationSpeed;
                speedSlider.style.width = '100%';
                
                // Toggle event
                L.DomEvent.on(toggleBtn, 'click', function() {
                    visualizationEnabled = !visualizationEnabled;
                    if (visualizationEnabled) {
                        toggleBtn.innerHTML = 'Скрыть визуализацию';
                        speedContainer.style.display = 'block';
                    } else {
                        toggleBtn.innerHTML = 'Показать визуализацию';
                        speedContainer.style.display = 'none';
                        clearVisualization();
                    }
                });
                
                // Speed slider event
                L.DomEvent.on(speedSlider, 'input', function() {
                    animationSpeed = parseInt(speedSlider.value);
                });
                
                // Prevent click events from propagating to the map
                L.DomEvent.disableClickPropagation(container);
                return container;
            }
        });
        
        // Add control to map
        map.addControl(new VisualizationControl());
    }
    
    // Simulate A* algorithm steps with visualization
    function simulateAlgorithmExecution(start, goal, criteria) {
        if (!visualizationEnabled) return;
        
        // Clear previous visualization
        clearVisualization();
        
        // Reset data
        exploredNodes = [];
        visitedEdges = [];
        currentPath = [];
        
        // Add start and goal markers
        const startMarker = L.circleMarker(start, {
            radius: 8,
            color: '#2ecc71',
            fillColor: '#2ecc71',
            fillOpacity: 1
        }).addTo(visualizationLayer);
        
        const goalMarker = L.circleMarker(goal, {
            radius: 8,
            color: '#e74c3c',
            fillColor: '#e74c3c',
            fillOpacity: 1
        }).addTo(visualizationLayer);
        
        // Generate a grid of points to simulate algorithm exploration
        const bounds = L.latLngBounds(start, goal).pad(0.5);
        const gridSize = 0.01; // Degrees
        
        // Priority to simulate A*
        const priorityQueue = generateSimulatedPriorityQueue(start, goal, bounds, gridSize, criteria);
        
        // Step through the queue visualization
        startStepSimulation(priorityQueue, goal);
    }
    
    // Generate simulated priority queue for visualization
    function generateSimulatedPriorityQueue(start, goal, bounds, gridSize, criteria) {
        const queue = [];
        const north = bounds.getNorth();
        const south = bounds.getSouth();
        const east = bounds.getEast();
        const west = bounds.getWest();
        
        // Start node
        queue.push({
            position: start,
            priority: 0,
            parent: null,
            costs: {
                distance: 0,
                terrain_difficulty: 0,
                environmental_impact: 0,
                construction_cost: 0,
                maintenance_access: 0
            }
        });
        
        // Add grid points with different priorities
        for (let lat = south; lat <= north; lat += gridSize) {
            for (let lng = west; lng <= east; lng += gridSize) {
                const position = [lat, lng];
                
                // Skip if too close to start
                if (calculateDistance(position, start) < gridSize) continue;
                
                // Calculate simulated costs
                const distanceToStart = calculateDistance(position, start);
                const distanceToGoal = calculateDistance(position, goal);
                
                // Generate simulated costs based on position
                const simulatedCosts = {
                    distance: distanceToStart,
                    terrain_difficulty: (Math.sin(lat * 10) * Math.cos(lng * 8) + 1) / 2 * distanceToStart,
                    environmental_impact: (Math.cos(lat * 12) * Math.sin(lng * 10) + 1) / 2 * 0.5,
                    construction_cost: distanceToStart * (1 + (Math.sin(lat * 15) + 1) / 4),
                    maintenance_access: (Math.sin(lat * 8) * Math.cos(lng * 15) + 1) / 2 * 0.4
                };
                
                // Calculate combined priority based on criteria weights
                let combinedPriority = 0;
                for (const [criterion, weight] of Object.entries(criteria)) {
                    combinedPriority += simulatedCosts[criterion] * weight;
                }
                
                // Add heuristic (distance to goal)
                combinedPriority += distanceToGoal;
                
                // Find a parent node (closest node already in queue)
                let parent = null;
                let minDistance = Infinity;
                
                for (const node of queue) {
                    const dist = calculateDistance(position, node.position);
                    if (dist < minDistance && dist < gridSize * 2) {
                        minDistance = dist;
                        parent = node;
                    }
                }
                
                // Only add if we found a parent
                if (parent) {
                    queue.push({
                        position: position,
                        priority: combinedPriority,
                        parent: parent,
                        costs: simulatedCosts
                    });
                }
            }
        }
        
        // Sort by priority
        queue.sort((a, b) => a.priority - b.priority);
        
        return queue;
    }
    
    // Start step-by-step simulation
    function startStepSimulation(queue, goal) {
        let currentIndex = 0;
        
        // Clear any existing interval
        if (stepInterval) clearInterval(stepInterval);
        
        stepInterval = setInterval(() => {
            if (currentIndex >= queue.length) {
                clearInterval(stepInterval);
                finishVisualization(queue[queue.length - 1], goal);
                return;
            }
            
            const node = queue[currentIndex];
            visualizeStep(node, currentIndex, queue.length);
            currentIndex++;
            
            // If we're near the goal, finish early
            if (calculateDistance(node.position, goal) < 0.01) {
                clearInterval(stepInterval);
                finishVisualization(node, goal);
            }
        }, animationSpeed);
    }
    
    // Visualize a single algorithm step
    function visualizeStep(node, index, total) {
        // Show the explored node
        const nodeMarker = L.circleMarker(node.position, {
            radius: 3,
            color: '#3498db',
            fillColor: '#3498db',
            fillOpacity: 0.7
        }).addTo(visualizationLayer);
        
        // Fade in effect
        setTimeout(() => {
            nodeMarker.setStyle({
                fillOpacity: 0.4
            });
        }, animationSpeed / 2);
        
        exploredNodes.push(nodeMarker);
        
        // Show the edge to parent
        if (node.parent) {
            // Create a line with color based on the dominant cost factor
            const dominantCost = getDominantCost(node.costs);
            const color = costColors[dominantCost];
            
            const edge = L.polyline([node.position, node.parent.position], {
                color: color,
                weight: 2,
                opacity: 0.5
            }).addTo(visualizationLayer);
            
            visitedEdges.push(edge);
        }
        
        // Update current path by tracing back to start
        updateCurrentPath(node);
    }
    
    // Get the dominant cost factor
    function getDominantCost(costs) {
        let maxCost = 0;
        let dominantFactor = 'distance';
        
        for (const [factor, cost] of Object.entries(costs)) {
            if (cost > maxCost) {
                maxCost = cost;
                dominantFactor = factor;
            }
        }
        
        return dominantFactor;
    }
    
    // Update the current path visualization
    function updateCurrentPath(node) {
        // Clear previous path
        for (const line of currentPath) {
            visualizationLayer.removeLayer(line);
        }
        currentPath = [];
        
        // Trace path back to start
        let current = node;
        let path = [];
        
        while (current.parent) {
            path.push(current.position);
            current = current.parent;
        }
        path.push(current.position); // Add start position
        
        // Reverse to get path from start to current
        path.reverse();
        
        // Create line segments with different colors based on costs
        for (let i = 1; i < path.length; i++) {
            const pathLine = L.polyline([path[i-1], path[i]], {
                color: '#f1c40f',
                weight: 4,
                opacity: 0.8
            }).addTo(visualizationLayer);
            
            currentPath.push(pathLine);
        }
    }
    
    // Finish visualization
    function finishVisualization(finalNode, goal) {
        // Create final path back to goal
        updateCurrentPath(finalNode);
        
        // Add final segment to goal
        const finalSegment = L.polyline([finalNode.position, goal], {
            color: '#f1c40f',
            weight: 4,
            opacity: 0.8,
            dashArray: '5, 10'
        }).addTo(visualizationLayer);
        
        currentPath.push(finalSegment);
        
        // Highlight final path
        for (const line of currentPath) {
            line.setStyle({
                color: '#2ecc71',
                weight: 5,
                opacity: 1
            });
        }
    }
    
    // Helper function to calculate distance between two points
    function calculateDistance(point1, point2) {
        // Convert lat/lng to radians
        const lat1 = point1[0] * Math.PI / 180;
        const lng1 = point1[1] * Math.PI / 180;
        const lat2 = point2[0] * Math.PI / 180;
        const lng2 = point2[1] * Math.PI / 180;
        
        // Haversine formula
        const R = 6371; // Earth radius in km
        const dLat = lat2 - lat1;
        const dLng = lng2 - lng1;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1) * Math.cos(lat2) *
                Math.sin(dLng/2) * Math.sin(dLng/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }
    
    // Clear all visualization elements
    function clearVisualization() {
        if (visualizationLayer) {
            visualizationLayer.clearLayers();
        }
        
        if (stepInterval) {
            clearInterval(stepInterval);
            stepInterval = null;
        }
        
        exploredNodes = [];
        visitedEdges = [];
        currentPath = [];
    }
    
    // Public API
    return {
        initialize: initialize,
        simulateAlgorithmExecution: simulateAlgorithmExecution,
        clearVisualization: clearVisualization
    };
})();

// Function to visualize multi-criteria costs
function visualizeMultiCriteriaCosts(route, metrics) {
    // Create a radar chart to visualize multiple criteria
    const ctx = document.createElement('canvas');
    document.getElementById('criteria-chart-container').innerHTML = '';
    document.getElementById('criteria-chart-container').appendChild(ctx);
    
    // Normalize cost values for comparison
    const normalizedMetrics = {
        distance: normalizeValue(metrics.total_distance, 0, 100),
        terrain: normalizeValue(metrics.terrain_difficulty_score, 0, 1),
        environment: normalizeValue(metrics.environmental_impact_score, 0, 1),
        cost: normalizeValue(metrics.estimated_cost, 0, 100),
        time: normalizeValue(metrics.estimated_construction_time, 0, 30)
    };
    
    // Create chart
    new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['Дистанция', 'Сложность рельефа', 'Экология', 'Стоимость', 'Время строительства'],
            datasets: [{
                label: 'Показатели маршрута',
                data: [
                    // Invert values where lower is better
                    1 - normalizedMetrics.distance,
                    1 - normalizedMetrics.terrain,
                    1 - normalizedMetrics.environment,
                    1 - normalizedMetrics.cost,
                    1 - normalizedMetrics.time
                ],
                fill: true,
                backgroundColor: 'rgba(52, 152, 219, 0.2)',
                borderColor: 'rgba(52, 152, 219, 1)',
                pointBackgroundColor: 'rgba(52, 152, 219, 1)',
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: 'rgba(52, 152, 219, 1)'
            }]
        },
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

// Helper function to normalize values to 0-1 range
function normalizeValue(value, min, max) {
    if (value === undefined || value === null) return 0.5; // Default value
    return Math.min(Math.max((value - min) / (max - min), 0), 1);
}

// Function to trigger algorithm visualization
function visualizeAlgorithm(start, end, criteriaWeights) {
    // Parse coordinates
    const startCoords = parseCoordinates(start);
    const endCoords = parseCoordinates(end);
    
    if (!startCoords || !endCoords) return;
    
    // Start visualization
    AlgorithmViz.simulateAlgorithmExecution(startCoords, endCoords, criteriaWeights);
}

// Helper function to parse coordinates
function parseCoordinates(coordStr) {
    if (!coordStr) return null;
    
    // Remove any whitespace and split by comma
    const parts = coordStr.trim().replace(/\s+/g, '').split(',');
    
    if (parts.length !== 2) return null;
    
    try {
        const lat = parseFloat(parts[0]);
        const lng = parseFloat(parts[1]);
        
        if (isNaN(lat) || isNaN(lng)) return null;
        
        return [lat, lng];
    } catch (e) {
        return null;
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // AlgorithmViz will be initialized after Map is ready
    
    // Listen for calculate button click to visualize algorithm
    document.getElementById('calculate-btn').addEventListener('click', function() {
        const startPoint = document.getElementById('start-point').value;
        const endPoint = document.getElementById('end-point').value;
        
        // Get criteria weights
        const criteriaWeights = {
            distance: parseInt(document.getElementById('distance-weight').value) / 100,
            terrain_difficulty: parseInt(document.getElementById('terrain-weight').value) / 100,
            environmental_impact: parseInt(document.getElementById('environment-weight').value) / 100,
            construction_cost: parseInt(document.getElementById('cost-weight').value) / 100,
            maintenance_access: parseInt(document.getElementById('access-weight').value) / 100
        };
        
        // Trigger visualization if both points are set
        if (startPoint && endPoint) {
            setTimeout(() => {
                visualizeAlgorithm(startPoint, endPoint, criteriaWeights);
            }, 1000); // Delay to allow the main calculation to start
        }
    });
});
