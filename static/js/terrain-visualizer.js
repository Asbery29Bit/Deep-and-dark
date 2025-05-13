/**
 * Модуль визуализации сложности рельефа в виде тепловой карты
 * 
 * Обеспечивает визуализацию различных характеристик местности
 * с использованием тепловых карт, наложенных на основную карту
 */

class TerrainVisualizer {
    constructor(map) {
        this.map = map;
        this.heatmapLayer = null;
        this.terrainData = null;
        this.currentMode = null;
        
        // Цветовые градиенты для разных типов визуализации
        this.gradients = {
            terrain: {
                0.0: 'rgb(0,128,0)',    // Зеленый для низких участков
                0.3: 'rgb(240,240,64)',  // Желтый для средних высот
                0.6: 'rgb(160,82,45)',   // Коричневый для высоких участков
                0.8: 'rgb(128,128,128)', // Серый для очень высоких участков
                1.0: 'rgb(255,255,255)'  // Белый для вершин
            },
            difficulty: {
                0.0: 'rgb(0,255,0)',     // Зеленый для простых участков
                0.3: 'rgb(255,255,0)',   // Желтый для участков средней сложности
                0.7: 'rgb(255,128,0)',   // Оранжевый для сложных участков
                1.0: 'rgb(255,0,0)'      // Красный для очень сложных участков
            },
            environmental: {
                0.0: 'rgb(255,255,255)', // Белый для неважных экологически участков
                0.3: 'rgb(173,216,230)', // Светло-голубой для участков с низкой ценностью
                0.6: 'rgb(0,128,0)',     // Зеленый для участков средней ценности
                0.8: 'rgb(0,100,0)',     // Темно-зеленый для ценных участков
                1.0: 'rgb(0,64,0)'       // Очень темный зеленый для критически важных участков
            },
            infrastructure: {
                0.0: 'rgba(255,255,255,0)',  // Прозрачный для участков без инфраструктуры
                0.3: 'rgba(255,255,0,0.5)',  // Полупрозрачный желтый для низкой плотности
                0.7: 'rgba(255,128,0,0.7)',  // Полупрозрачный оранжевый для средней плотности
                1.0: 'rgba(255,0,0,0.8)'     // Полупрозрачный красный для высокой плотности
            }
        };
    }
    
    /**
     * Получение и установка данных о рельефе
     * @param {Object} bounds - Границы области в формате {north, south, east, west}
     * @param {Function} callback - Функция обратного вызова после получения данных
     */
    fetchTerrainData(bounds, callback) {
        // Запрос данных о рельефе с сервера
        fetch(`/api/terrain?north=${bounds.north}&south=${bounds.south}&east=${bounds.east}&west=${bounds.west}`)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    this.terrainData = data.data;
                    if (callback) callback(data.data);
                } else {
                    console.error('Ошибка при получении данных о рельефе:', data.error);
                }
            })
            .catch(error => {
                console.error('Ошибка при запросе данных о рельефе:', error);
            });
    }
    
    /**
     * Создание и отображение тепловой карты
     * @param {string} mode - Режим визуализации ('terrain', 'difficulty', 'environmental', 'infrastructure')
     */
    showHeatmap(mode) {
        // Если данные о рельефе не загружены, ничего не делаем
        if (!this.terrainData) {
            console.warn('Данные о рельефе не загружены');
            return;
        }
        
        // Если тепловая карта уже отображается, удаляем её
        this.removeHeatmap();
        
        // Устанавливаем текущий режим
        this.currentMode = mode;
        
        // Подготовка данных для тепловой карты в зависимости от режима
        const heatmapData = this.prepareHeatmapData(mode);
        
        // Создание и конфигурация тепловой карты
        const heatmapConfig = {
            radius: 15,
            maxOpacity: 0.8,
            minOpacity: 0.3,
            blur: 0.85,
            gradient: this.gradients[mode]
        };
        
        // Создание контейнера для тепловой карты
        const heatmapContainer = document.createElement('div');
        heatmapContainer.id = 'heatmap-container';
        heatmapContainer.style.width = '100%';
        heatmapContainer.style.height = '100%';
        heatmapContainer.style.position = 'absolute';
        heatmapContainer.style.top = '0';
        heatmapContainer.style.left = '0';
        heatmapContainer.style.zIndex = '400';  // Над картой, но под контролами
        document.querySelector('.leaflet-map-pane').appendChild(heatmapContainer);
        
        // Создание тепловой карты
        const heatmapInstance = h337.create({
            container: heatmapContainer,
            ...heatmapConfig
        });
        
        // Установка данных тепловой карты
        heatmapInstance.setData(heatmapData);
        
        // Сохранение ссылки на слой тепловой карты
        this.heatmapLayer = heatmapContainer;
        
        // Добавление обработчика изменения масштаба карты
        this.map.on('zoomend', () => {
            // Обновление тепловой карты при изменении масштаба
            if (this.currentMode) {
                this.showHeatmap(this.currentMode);
            }
        });
        
        // Добавление обработчика перемещения карты
        this.map.on('moveend', () => {
            // Обновление тепловой карты при перемещении
            if (this.currentMode) {
                this.showHeatmap(this.currentMode);
            }
        });
    }
    
    /**
     * Удаление тепловой карты с карты
     */
    removeHeatmap() {
        if (this.heatmapLayer) {
            // Удаление тепловой карты
            if (this.heatmapLayer.parentNode) {
                this.heatmapLayer.parentNode.removeChild(this.heatmapLayer);
            }
            this.heatmapLayer = null;
            this.currentMode = null;
        }
    }
    
    /**
     * Подготовка данных для тепловой карты в зависимости от режима
     * @param {string} mode - Режим визуализации
     * @returns {Object} - Данные для тепловой карты
     */
    prepareHeatmapData(mode) {
        // Получение видимых границ карты
        const bounds = this.map.getBounds();
        const northEast = bounds.getNorthEast();
        const southWest = bounds.getSouthWest();
        
        // Определение размеров карты в пикселях
        const mapSize = this.map.getSize();
        const width = mapSize.x;
        const height = mapSize.y;
        
        // Подготовка точек для тепловой карты
        const points = [];
        
        // Количество точек сетки
        const gridSize = 50;
        
        // Шаг в градусах между точками сетки
        const latStep = (northEast.lat - southWest.lat) / gridSize;
        const lngStep = (northEast.lng - southWest.lng) / gridSize;
        
        // Генерация точек сетки
        for (let i = 0; i <= gridSize; i++) {
            for (let j = 0; j <= gridSize; j++) {
                // Вычисление координат точки
                const lat = southWest.lat + i * latStep;
                const lng = southWest.lng + j * lngStep;
                
                // Вычисление значения в зависимости от режима
                let value;
                switch (mode) {
                    case 'terrain':
                        value = this.getElevationValue(lat, lng);
                        break;
                    case 'difficulty':
                        value = this.getDifficultyValue(lat, lng);
                        break;
                    case 'environmental':
                        value = this.getEnvironmentalValue(lat, lng);
                        break;
                    case 'infrastructure':
                        value = this.getInfrastructureValue(lat, lng);
                        break;
                    default:
                        value = 0;
                }
                
                // Преобразование географических координат в пиксели
                const point = this.map.latLngToContainerPoint([lat, lng]);
                
                // Добавление точки в массив
                points.push({
                    x: point.x,
                    y: point.y,
                    value: value
                });
            }
        }
        
        // Формирование данных для тепловой карты
        return {
            max: 1.0,
            min: 0.0,
            data: points
        };
    }
    
    /**
     * Получение значения высоты для точки
     * @param {number} lat - Широта
     * @param {number} lng - Долгота
     * @returns {number} - Нормализованное значение высоты (0-1)
     */
    getElevationValue(lat, lng) {
        if (!this.terrainData || !this.terrainData.elevation) {
            return 0;
        }
        
        // Поиск ближайшей точки в данных о рельефе
        const latIndex = this.findNearestIndex(lat, this.terrainData.latitudes);
        const lngIndex = this.findNearestIndex(lng, this.terrainData.longitudes);
        
        // Проверка на выход за границы массива
        if (latIndex < 0 || latIndex >= this.terrainData.elevation.length ||
            lngIndex < 0 || lngIndex >= this.terrainData.elevation[0].length) {
            return 0;
        }
        
        // Получение значения высоты
        const elevation = this.terrainData.elevation[latIndex][lngIndex];
        
        // Нормализация высоты (примерные значения минимума и максимума)
        const minElevation = 0;
        const maxElevation = 1000;
        
        return Math.max(0, Math.min(1, (elevation - minElevation) / (maxElevation - minElevation)));
    }
    
    /**
     * Получение значения сложности рельефа для точки
     * @param {number} lat - Широта
     * @param {number} lng - Долгота
     * @returns {number} - Нормализованное значение сложности (0-1)
     */
    getDifficultyValue(lat, lng) {
        if (!this.terrainData || !this.terrainData.difficulty) {
            // Если данные о сложности не загружены, вычисляем её на основе рельефа
            
            // Получение высоты
            const elevation = this.getElevationValue(lat, lng);
            
            // Вычисление уклона (примерно)
            const latStep = 0.001;  // Примерный шаг в градусах
            const lngStep = 0.001;
            
            const elevN = this.getElevationValue(lat + latStep, lng);
            const elevS = this.getElevationValue(lat - latStep, lng);
            const elevE = this.getElevationValue(lat, lng + lngStep);
            const elevW = this.getElevationValue(lat, lng - lngStep);
            
            // Вычисление градиента
            const gradientNS = Math.abs(elevN - elevS) / (2 * latStep);
            const gradientEW = Math.abs(elevE - elevW) / (2 * lngStep);
            
            // Общий градиент (уклон)
            const gradient = Math.sqrt(gradientNS * gradientNS + gradientEW * gradientEW);
            
            // Комбинирование высоты и уклона для оценки сложности
            // Высота имеет вес 0.3, уклон - 0.7
            return 0.3 * elevation + 0.7 * Math.min(1, gradient * 10);
        }
        
        // Если данные о сложности загружены, используем их
        const latIndex = this.findNearestIndex(lat, this.terrainData.latitudes);
        const lngIndex = this.findNearestIndex(lng, this.terrainData.longitudes);
        
        if (latIndex < 0 || latIndex >= this.terrainData.difficulty.length ||
            lngIndex < 0 || lngIndex >= this.terrainData.difficulty[0].length) {
            return 0;
        }
        
        return this.terrainData.difficulty[latIndex][lngIndex];
    }
    
    /**
     * Получение значения экологической ценности для точки
     * @param {number} lat - Широта
     * @param {number} lng - Долгота
     * @returns {number} - Нормализованное значение экологической ценности (0-1)
     */
    getEnvironmentalValue(lat, lng) {
        if (!this.terrainData || !this.terrainData.environmental) {
            // Если данные об экологической ценности не загружены, 
            // используем простую модель на основе высоты и наличия воды
            
            // Получение высоты
            const elevation = this.getElevationValue(lat, lng);
            
            // Примерная проверка на наличие воды (озера, реки)
            const isWater = this.isWaterBody(lat, lng);
            
            // Экологическая ценность выше для водных объектов и средних высот
            if (isWater) {
                return 0.8;  // Высокая ценность для водных объектов
            } else if (elevation < 0.1) {
                return 0.2;  // Низкая ценность для низменностей
            } else if (elevation > 0.8) {
                return 0.5;  // Средняя ценность для гор
            } else {
                // Ценность зависит от высоты, максимум для средних высот (~300-500м)
                return 0.3 + 0.5 * (1 - Math.abs(elevation - 0.4) * 2.5);
            }
        }
        
        // Если данные об экологической ценности загружены, используем их
        const latIndex = this.findNearestIndex(lat, this.terrainData.latitudes);
        const lngIndex = this.findNearestIndex(lng, this.terrainData.longitudes);
        
        if (latIndex < 0 || latIndex >= this.terrainData.environmental.length ||
            lngIndex < 0 || lngIndex >= this.terrainData.environmental[0].length) {
            return 0;
        }
        
        return this.terrainData.environmental[latIndex][lngIndex];
    }
    
    /**
     * Получение значения плотности инфраструктуры для точки
     * @param {number} lat - Широта
     * @param {number} lng - Долгота
     * @returns {number} - Нормализованное значение плотности инфраструктуры (0-1)
     */
    getInfrastructureValue(lat, lng) {
        if (!this.terrainData || !this.terrainData.infrastructure) {
            // Если данные об инфраструктуре не загружены, используем упрощенную модель
            
            // Функция для вычисления расстояния до ближайшей дороги или населенного пункта
            // (здесь используется упрощенная модель)
            
            // Расстояние до ближайшей дороги (примерная модель)
            const distToRoad = this.getDistanceToNearestRoad(lat, lng);
            
            // Расстояние до ближайшего населенного пункта (примерная модель)
            const distToSettlement = this.getDistanceToNearestSettlement(lat, lng);
            
            // Нормализация расстояний (0 - далеко, 1 - близко)
            const roadProximity = Math.max(0, 1 - distToRoad / 5);  // 5 км как максимум
            const settlementProximity = Math.max(0, 1 - distToSettlement / 10);  // 10 км как максимум
            
            // Комбинирование значений
            return Math.max(roadProximity, settlementProximity * 0.8);
        }
        
        // Если данные об инфраструктуре загружены, используем их
        const latIndex = this.findNearestIndex(lat, this.terrainData.latitudes);
        const lngIndex = this.findNearestIndex(lng, this.terrainData.longitudes);
        
        if (latIndex < 0 || latIndex >= this.terrainData.infrastructure.length ||
            lngIndex < 0 || lngIndex >= this.terrainData.infrastructure[0].length) {
            return 0;
        }
        
        return this.terrainData.infrastructure[latIndex][lngIndex];
    }
    
    /**
     * Поиск ближайшего индекса в массиве для заданного значения
     * @param {number} value - Искомое значение
     * @param {Array} array - Массив значений
     * @returns {number} - Индекс ближайшего значения
     */
    findNearestIndex(value, array) {
        if (!array || array.length === 0) return -1;
        
        // Бинарный поиск ближайшего значения
        let left = 0;
        let right = array.length - 1;
        
        while (left <= right) {
            const mid = Math.floor((left + right) / 2);
            
            if (array[mid] === value) {
                return mid;
            } else if (array[mid] < value) {
                left = mid + 1;
            } else {
                right = mid - 1;
            }
        }
        
        // После выхода из цикла left > right
        // Выбираем ближайшее значение
        if (right < 0) return 0;
        if (left >= array.length) return array.length - 1;
        
        const distLeft = Math.abs(array[right] - value);
        const distRight = Math.abs(array[left] - value);
        
        return distLeft < distRight ? right : left;
    }
    
    /**
     * Проверка, является ли точка водным объектом
     * @param {number} lat - Широта
     * @param {number} lng - Долгота
     * @returns {boolean} - True, если точка является водным объектом
     */
    isWaterBody(lat, lng) {
        // Упрощенная модель для демонстрации
        // В реальной системе это должно быть основано на данных о водных объектах
        
        // Примерные координаты рек и озер в регионе
        const waterBodies = [
            // Пример Байкала (грубое приближение)
            {
                type: 'lake',
                polygon: [
                    [53.0, 107.5], [53.0, 108.5], [52.0, 108.5], [52.0, 107.5]
                ]
            },
            // Пример реки Ангара (грубое приближение)
            {
                type: 'river',
                points: [
                    [51.9, 104.8], [52.1, 104.9], [52.3, 105.0], [52.5, 105.1]
                ],
                width: 0.05  // ширина реки в градусах
            }
        ];
        
        // Проверка на попадание в озеро (примитивный алгоритм "точка в многоугольнике")
        for (const water of waterBodies) {
            if (water.type === 'lake') {
                if (this.pointInPolygon(lat, lng, water.polygon)) {
                    return true;
                }
            } else if (water.type === 'river') {
                // Проверка на близость к линии реки
                if (this.pointNearLine(lat, lng, water.points, water.width)) {
                    return true;
                }
            }
        }
        
        return false;
    }
    
    /**
     * Проверка, находится ли точка внутри многоугольника
     * @param {number} lat - Широта точки
     * @param {number} lng - Долгота точки
     * @param {Array} polygon - Массив вершин многоугольника в формате [[lat1, lng1], [lat2, lng2], ...]
     * @returns {boolean} - True, если точка находится внутри многоугольника
     */
    pointInPolygon(lat, lng, polygon) {
        // Реализация алгоритма "точка в многоугольнике" (ray casting)
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i][1], yi = polygon[i][0];
            const xj = polygon[j][1], yj = polygon[j][0];
            
            const intersect = ((yi > lat) !== (yj > lat)) &&
                (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi);
            
            if (intersect) inside = !inside;
        }
        
        return inside;
    }
    
    /**
     * Проверка, находится ли точка рядом с линией
     * @param {number} lat - Широта точки
     * @param {number} lng - Долгота точки
     * @param {Array} line - Массив точек линии в формате [[lat1, lng1], [lat2, lng2], ...]
     * @param {number} width - Ширина линии в градусах
     * @returns {boolean} - True, если точка находится рядом с линией
     */
    pointNearLine(lat, lng, line, width) {
        for (let i = 0; i < line.length - 1; i++) {
            const x1 = line[i][1], y1 = line[i][0];
            const x2 = line[i+1][1], y2 = line[i+1][0];
            
            // Вычисление расстояния от точки до отрезка
            const dist = this.distToSegment(lng, lat, x1, y1, x2, y2);
            
            if (dist < width) {
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Вычисление расстояния от точки до отрезка
     * @param {number} px - X координата точки
     * @param {number} py - Y координата точки
     * @param {number} x1 - X координата начала отрезка
     * @param {number} y1 - Y координата начала отрезка
     * @param {number} x2 - X координата конца отрезка
     * @param {number} y2 - Y координата конца отрезка
     * @returns {number} - Расстояние от точки до отрезка
     */
    distToSegment(px, py, x1, y1, x2, y2) {
        const A = px - x1;
        const B = py - y1;
        const C = x2 - x1;
        const D = y2 - y1;
        
        const dot = A * C + B * D;
        const len_sq = C * C + D * D;
        let param = -1;
        
        if (len_sq !== 0) {
            param = dot / len_sq;
        }
        
        let xx, yy;
        
        if (param < 0) {
            xx = x1;
            yy = y1;
        } else if (param > 1) {
            xx = x2;
            yy = y2;
        } else {
            xx = x1 + param * C;
            yy = y1 + param * D;
        }
        
        const dx = px - xx;
        const dy = py - yy;
        
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    /**
     * Получение расстояния до ближайшей дороги
     * @param {number} lat - Широта
     * @param {number} lng - Долгота
     * @returns {number} - Расстояние в километрах
     */
    getDistanceToNearestRoad(lat, lng) {
        // Упрощенная модель дорог в регионе
        const roads = [
            // Примеры основных дорог (грубое приближение)
            [
                [52.28, 104.28], [52.30, 104.30], [52.32, 104.32], [52.34, 104.34]
            ],
            [
                [52.20, 104.30], [52.22, 104.35], [52.24, 104.40], [52.26, 104.45]
            ]
        ];
        
        let minDist = Infinity;
        
        for (const road of roads) {
            for (let i = 0; i < road.length - 1; i++) {
                const [lat1, lng1] = road[i];
                const [lat2, lng2] = road[i+1];
                
                // Вычисление расстояния от точки до сегмента дороги
                const dist = this.distToSegment(lng, lat, lng1, lat1, lng2, lat2);
                
                // Примерное преобразование градусов в километры (очень грубо)
                const distKm = dist * 111;  // 1 градус ≈ 111 км
                
                minDist = Math.min(minDist, distKm);
            }
        }
        
        return minDist;
    }
    
    /**
     * Получение расстояния до ближайшего населенного пункта
     * @param {number} lat - Широта
     * @param {number} lng - Долгота
     * @returns {number} - Расстояние в километрах
     */
    getDistanceToNearestSettlement(lat, lng) {
        // Упрощенная модель населенных пунктов в регионе
        const settlements = [
            { name: 'Иркутск', coords: [52.28, 104.28], radius: 20 },
            { name: 'Ангарск', coords: [52.54, 103.91], radius: 10 },
            { name: 'Шелехов', coords: [52.21, 104.10], radius: 5 }
        ];
        
        let minDist = Infinity;
        
        for (const settlement of settlements) {
            const [settlementLat, settlementLng] = settlement.coords;
            
            // Вычисление расстояния до населенного пункта
            const latDiff = lat - settlementLat;
            const lngDiff = lng - settlementLng;
            
            // Примерное преобразование градусов в километры (очень грубо)
            const distKm = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111;
            
            // Учет размера населенного пункта
            const adjustedDist = Math.max(0, distKm - settlement.radius / 10);
            
            minDist = Math.min(minDist, adjustedDist);
        }
        
        return minDist;
    }
}

// Инициализация визуализатора при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    // Инициализация переменной для хранения экземпляра класса
    window.terrainVisualizer = null;
    
    // Функция инициализации визуализатора
    window.initializeTerrainVisualizer = function(map) {
        if (!map) {
            console.error('Карта не инициализирована');
            return;
        }
        
        // Проверка наличия необходимых библиотек
        if (typeof h337 === 'undefined') {
            console.error('Библиотека heatmap.js не загружена');
            return;
        }
        
        // Создание экземпляра класса TerrainVisualizer
        window.terrainVisualizer = new TerrainVisualizer(map);
        
        // Получение данных о рельефе для текущего вида карты
        const bounds = map.getBounds();
        window.terrainVisualizer.fetchTerrainData({
            north: bounds.getNorth(),
            south: bounds.getSouth(),
            east: bounds.getEast(),
            west: bounds.getWest()
        }, function() {
            console.log('Данные о рельефе загружены');
        });
        
        // Настройка обработчиков для переключения режимов отображения
        const layerRadios = document.querySelectorAll('input[name="map-layer"]');
        layerRadios.forEach(radio => {
            radio.addEventListener('change', function(e) {
                const mode = e.target.value;
                
                // Очистка предыдущей визуализации
                window.terrainVisualizer.removeHeatmap();
                
                // Если выбран режим, отличный от обычной карты, показываем тепловую карту
                if (mode !== 'default') {
                    window.terrainVisualizer.showHeatmap(mode === 'terrain' ? 'terrain' :
                                                        mode === 'environmental' ? 'environmental' :
                                                        mode === 'infrastructure' ? 'infrastructure' :
                                                        'difficulty');
                }
            });
        });
    };
});