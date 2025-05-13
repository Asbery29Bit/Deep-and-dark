/**
 * Модуль анализа и интерактивной визуализации маршрута трубопровода
 * 
 * Обеспечивает детальный анализ и интерактивное отображение информации
 * о сегментах маршрута и причинах принятия решений алгоритмом.
 */

class RouteAnalyzer {
    constructor(mapInstance) {
        this.map = mapInstance;
        this.route = [];
        this.routeSegments = [];
        this.metrics = {};
        this.routeDescription = '';
        this.segmentMarkers = [];
        
        // Элементы DOM
        this.routeSegmentsContainer = document.getElementById('route-segments-container');
        this.routeSegmentsElement = document.getElementById('route-segments');
        this.segmentInfoModal = new bootstrap.Modal(document.getElementById('segment-info-modal'));
        this.segmentInfoContent = document.getElementById('segment-info-content');
    }
    
    /**
     * Установка данных о маршруте
     * @param {Array} route - Координаты точек маршрута
     * @param {Object} metrics - Метрики маршрута
     * @param {string} description - Подробное описание маршрута
     */
    setRouteData(route, metrics, description) {
        this.route = route;
        this.metrics = metrics;
        this.routeDescription = description;
        
        // Разбиение маршрута на сегменты
        this.analyzeRouteSegments();
        
        // Отображение сегментов маршрута
        this.displayRouteSegments();
        
        // Маркеры поворотов маршрута
        this.addSegmentMarkers();
    }
    
    /**
     * Анализ маршрута и разбиение на логические сегменты
     */
    analyzeRouteSegments() {
        this.routeSegments = [];
        
        if (!this.route || this.route.length < 2) {
            return;
        }
        
        // Разбор текста описания для извлечения информации о сегментах
        this.parseDescriptionForSegments();
        
        // Если не удалось извлечь сегменты из описания, создаем базовые сегменты
        if (this.routeSegments.length === 0) {
            this.createBaseSegments();
        }
    }
    
    /**
     * Разбор текста описания маршрута для извлечения информации о сегментах
     */
    parseDescriptionForSegments() {
        if (!this.routeDescription) return;
        
        // Разбиение описания на предложения
        const sentences = this.routeDescription.split(/(?<=\.)(?=\s)/);
        
        // Поиск предложений, описывающих сегменты маршрута
        const segmentSentences = sentences.filter(sentence => {
            return sentence.includes('На расстоянии') || 
                   sentence.includes('Маршрут начинается') || 
                   sentence.includes('Маршрут заканчивается');
        });
        
        // Создание сегментов на основе найденных предложений
        for (let i = 0; i < segmentSentences.length; i++) {
            const sentence = segmentSentences[i];
            
            // Определение типа сегмента
            let segmentType = 'route';
            if (sentence.includes('пересекает водную преграду')) {
                segmentType = 'water';
            } else if (sentence.includes('сложного рельефа')) {
                segmentType = 'difficult';
            } else if (sentence.includes('поворачивает')) {
                segmentType = 'turn';
            } else if (sentence.includes('Маршрут начинается')) {
                segmentType = 'start';
            } else if (sentence.includes('Маршрут заканчивается')) {
                segmentType = 'end';
            }
            
            // Определение позиции сегмента в маршруте
            let position = 0;
            if (segmentType === 'start') {
                position = 0;
            } else if (segmentType === 'end') {
                position = this.route.length - 1;
            } else {
                // Извлечение расстояния из текста (в км)
                const distanceMatch = sentence.match(/На расстоянии ([\d,\.]+) км/);
                if (distanceMatch) {
                    const distance = parseFloat(distanceMatch[1].replace(',', '.'));
                    position = this.findPositionByDistance(distance);
                }
            }
            
            // Создание объекта сегмента
            this.routeSegments.push({
                type: segmentType,
                description: sentence,
                position: position,
                coordinates: this.route[position],
                index: i
            });
        }
    }
    
    /**
     * Создание базовых сегментов маршрута (если не удалось извлечь из описания)
     */
    createBaseSegments() {
        // Стартовая точка
        this.routeSegments.push({
            type: 'start',
            description: `Маршрут начинается от точки (${this.route[0][0]}, ${this.route[0][1]}).`,
            position: 0,
            coordinates: this.route[0],
            index: 0
        });
        
        // Определение ключевых точек маршрута (повороты более чем на 20 градусов)
        for (let i = 1; i < this.route.length - 1; i++) {
            const prev = this.route[i - 1];
            const current = this.route[i];
            const next = this.route[i + 1];
            
            // Вычисление углов
            const angle1 = Math.atan2(current[0] - prev[0], current[1] - prev[1]);
            const angle2 = Math.atan2(next[0] - current[0], next[1] - current[1]);
            
            // Разница углов (в градусах)
            const angleDiff = Math.abs((angle1 - angle2) * 180 / Math.PI);
            
            // Если поворот значительный
            if (angleDiff > 20) {
                // Определение типа сегмента
                const segmentType = 'turn';
                
                // Создание объекта сегмента
                this.routeSegments.push({
                    type: segmentType,
                    description: `Поворот маршрута на ${angleDiff.toFixed(1)} градусов в точке (${current[0].toFixed(4)}, ${current[1].toFixed(4)}).`,
                    position: i,
                    coordinates: current,
                    index: this.routeSegments.length
                });
            }
        }
        
        // Конечная точка
        this.routeSegments.push({
            type: 'end',
            description: `Маршрут заканчивается в точке (${this.route[this.route.length - 1][0]}, ${this.route[this.route.length - 1][1]}).`,
            position: this.route.length - 1,
            coordinates: this.route[this.route.length - 1],
            index: this.routeSegments.length
        });
    }
    
    /**
     * Поиск индекса точки в маршруте, соответствующей заданному расстоянию от начала
     * @param {number} targetDistance - Искомое расстояние в км
     * @returns {number} - Индекс точки в маршруте
     */
    findPositionByDistance(targetDistance) {
        if (!this.route || this.route.length < 2) {
            return 0;
        }
        
        let cumulativeDistance = 0;
        
        for (let i = 1; i < this.route.length; i++) {
            const prevPoint = this.route[i - 1];
            const currentPoint = this.route[i];
            
            // Вычисление расстояния между точками (приближение)
            const segmentDistance = this.calculateDistance(prevPoint, currentPoint);
            
            // Обновление суммарного расстояния
            cumulativeDistance += segmentDistance;
            
            // Если достигнуто или превышено целевое расстояние
            if (cumulativeDistance >= targetDistance) {
                return i;
            }
        }
        
        // Если расстояние больше длины маршрута, возвращаем последнюю точку
        return this.route.length - 1;
    }
    
    /**
     * Вычисление приближенного расстояния между двумя точками
     * @param {Array} point1 - Координаты первой точки [lat, lng]
     * @param {Array} point2 - Координаты второй точки [lat, lng]
     * @returns {number} - Расстояние в км
     */
    calculateDistance(point1, point2) {
        // Радиус Земли в км
        const R = 6371;
        
        // Конвертация градусов в радианы
        const lat1 = point1[0] * Math.PI / 180;
        const lat2 = point2[0] * Math.PI / 180;
        const lon1 = point1[1] * Math.PI / 180;
        const lon2 = point2[1] * Math.PI / 180;
        
        // Разница координат
        const dLat = lat2 - lat1;
        const dLon = lon2 - lon1;
        
        // Формула гаверсинуса
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1) * Math.cos(lat2) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        
        return R * c;
    }
    
    /**
     * Отображение сегментов маршрута в интерфейсе
     */
    displayRouteSegments() {
        if (!this.routeSegmentsContainer || !this.routeSegmentsElement) return;
        
        // Очистка контейнера
        this.routeSegmentsElement.innerHTML = '';
        
        // Если есть сегменты, показываем контейнер
        if (this.routeSegments.length > 0) {
            this.routeSegmentsContainer.classList.remove('d-none');
            
            // Создание элементов для каждого сегмента
            this.routeSegments.forEach((segment, index) => {
                const segmentElement = document.createElement('div');
                segmentElement.className = `route-segment route-segment-${segment.type}`;
                segmentElement.setAttribute('data-segment-index', index);
                
                // Иконка в зависимости от типа сегмента
                let icon = '';
                switch (segment.type) {
                    case 'start':
                        icon = '<i class="fas fa-play-circle text-success"></i>';
                        break;
                    case 'end':
                        icon = '<i class="fas fa-stop-circle text-danger"></i>';
                        break;
                    case 'turn':
                        icon = '<i class="fas fa-redo text-warning"></i>';
                        break;
                    case 'water':
                        icon = '<i class="fas fa-water text-primary"></i>';
                        break;
                    case 'difficult':
                        icon = '<i class="fas fa-mountain text-secondary"></i>';
                        break;
                    default:
                        icon = '<i class="fas fa-map-pin"></i>';
                        break;
                }
                
                // Создание содержимого сегмента
                segmentElement.innerHTML = `
                    <div class="segment-icon">${icon}</div>
                    <div class="segment-description">${this.truncateDescription(segment.description)}</div>
                    <div class="segment-action"><button class="btn btn-sm btn-outline-info segment-details-btn"><i class="fas fa-info-circle"></i></button></div>
                `;
                
                // Добавление обработчика клика
                segmentElement.querySelector('.segment-details-btn').addEventListener('click', () => {
                    this.showSegmentDetails(index);
                });
                
                // Добавление обработчика наведения
                segmentElement.addEventListener('mouseenter', () => {
                    this.highlightSegmentOnMap(index);
                });
                
                segmentElement.addEventListener('mouseleave', () => {
                    this.unhighlightSegmentOnMap();
                });
                
                // Добавление сегмента в контейнер
                this.routeSegmentsElement.appendChild(segmentElement);
            });
        } else {
            this.routeSegmentsContainer.classList.add('d-none');
        }
    }
    
    /**
     * Усечение описания сегмента до разумной длины
     * @param {string} description - Полное описание сегмента
     * @returns {string} - Усеченное описание
     */
    truncateDescription(description) {
        const maxLength = 40;
        
        if (description.length <= maxLength) {
            return description;
        }
        
        return description.substring(0, maxLength) + '...';
    }
    
    /**
     * Показ модального окна с подробной информацией о сегменте
     * @param {number} segmentIndex - Индекс сегмента
     */
    showSegmentDetails(segmentIndex) {
        if (segmentIndex < 0 || segmentIndex >= this.routeSegments.length) return;
        
        const segment = this.routeSegments[segmentIndex];
        
        // Формирование содержимого модального окна
        let content = `
            <h5 class="mb-3">${this.getSegmentTitle(segment)}</h5>
            <p>${segment.description}</p>
            <div class="row mb-3">
                <div class="col-4">Тип:</div>
                <div class="col-8">${this.getSegmentTypeName(segment.type)}</div>
            </div>
            <div class="row mb-3">
                <div class="col-4">Координаты:</div>
                <div class="col-8">${segment.coordinates[0]}, ${segment.coordinates[1]}</div>
            </div>
        `;
        
        // Добавление дополнительной информации в зависимости от типа сегмента
        if (segment.type === 'turn') {
            content += `
                <div class="row mb-3">
                    <div class="col-4">Причина поворота:</div>
                    <div class="col-8">${this.extractTurnReason(segment.description)}</div>
                </div>
            `;
        } else if (segment.type === 'water') {
            content += `
                <div class="row mb-3">
                    <div class="col-4">Тип преграды:</div>
                    <div class="col-8">Водная преграда</div>
                </div>
            `;
        }
        
        // Кнопка для центрирования карты на сегменте
        content += `
            <div class="text-center mt-4">
                <button id="center-map-on-segment" class="btn btn-primary">
                    <i class="fas fa-map-marker-alt"></i> Показать на карте
                </button>
            </div>
        `;
        
        // Установка содержимого модального окна
        this.segmentInfoContent.innerHTML = content;
        
        // Добавление обработчика клика на кнопку центрирования карты
        const centerMapButton = document.getElementById('center-map-on-segment');
        if (centerMapButton) {
            centerMapButton.addEventListener('click', () => {
                this.centerMapOnSegment(segmentIndex);
                this.segmentInfoModal.hide();
            });
        }
        
        // Отображение модального окна
        this.segmentInfoModal.show();
    }
    
    /**
     * Получение заголовка для сегмента
     * @param {Object} segment - Объект сегмента
     * @returns {string} - Заголовок
     */
    getSegmentTitle(segment) {
        switch (segment.type) {
            case 'start':
                return 'Начальная точка маршрута';
            case 'end':
                return 'Конечная точка маршрута';
            case 'turn':
                return 'Поворот маршрута';
            case 'water':
                return 'Пересечение водной преграды';
            case 'difficult':
                return 'Сложный участок рельефа';
            default:
                return 'Точка маршрута';
        }
    }
    
    /**
     * Получение понятного названия типа сегмента
     * @param {string} type - Тип сегмента
     * @returns {string} - Название типа
     */
    getSegmentTypeName(type) {
        const types = {
            'start': 'Начальная точка',
            'end': 'Конечная точка',
            'turn': 'Поворот',
            'water': 'Водная преграда',
            'difficult': 'Сложный рельеф',
            'route': 'Обычный участок'
        };
        
        return types[type] || 'Неизвестный тип';
    }
    
    /**
     * Извлечение причины поворота из описания
     * @param {string} description - Описание сегмента
     * @returns {string} - Причина поворота
     */
    extractTurnReason(description) {
        // Поиск части текста с причиной поворота
        const reasonMatch = description.match(/поворачивает .* (для .*?)\./) ||
                           description.match(/поворачивает .* (согласно .*?)\./) ||
                           description.match(/поворачивает .* (из-за .*?)\./);
        
        if (reasonMatch && reasonMatch[1]) {
            return reasonMatch[1];
        }
        
        return 'Согласно критериям оптимизации';
    }
    
    /**
     * Добавление маркеров ключевых точек маршрута на карту
     */
    addSegmentMarkers() {
        // Удаление предыдущих маркеров
        this.removeSegmentMarkers();
        
        if (!this.map || !this.routeSegments.length) return;
        
        // Создание маркеров для каждого сегмента
        this.routeSegments.forEach((segment, index) => {
            // Пропуск сегментов без координат
            if (!segment.coordinates) return;
            
            // Настройка иконки маркера в зависимости от типа сегмента
            let markerOptions = {};
            
            switch (segment.type) {
                case 'start':
                    markerOptions = {
                        icon: L.divIcon({
                            className: 'route-marker-start',
                            html: '<i class="fas fa-play-circle"></i>',
                            iconSize: [24, 24],
                            iconAnchor: [12, 12]
                        })
                    };
                    break;
                    
                case 'end':
                    markerOptions = {
                        icon: L.divIcon({
                            className: 'route-marker-end',
                            html: '<i class="fas fa-stop-circle"></i>',
                            iconSize: [24, 24],
                            iconAnchor: [12, 12]
                        })
                    };
                    break;
                    
                case 'turn':
                    markerOptions = {
                        icon: L.divIcon({
                            className: 'route-marker-turn',
                            html: '<i class="fas fa-redo"></i>',
                            iconSize: [20, 20],
                            iconAnchor: [10, 10]
                        })
                    };
                    break;
                    
                case 'water':
                    markerOptions = {
                        icon: L.divIcon({
                            className: 'route-marker-water',
                            html: '<i class="fas fa-water"></i>',
                            iconSize: [20, 20],
                            iconAnchor: [10, 10]
                        })
                    };
                    break;
                    
                case 'difficult':
                    markerOptions = {
                        icon: L.divIcon({
                            className: 'route-marker-difficult',
                            html: '<i class="fas fa-mountain"></i>',
                            iconSize: [20, 20],
                            iconAnchor: [10, 10]
                        })
                    };
                    break;
                    
                default:
                    markerOptions = {
                        icon: L.divIcon({
                            className: 'route-marker',
                            html: '<i class="fas fa-circle"></i>',
                            iconSize: [16, 16],
                            iconAnchor: [8, 8]
                        })
                    };
                    break;
            }
            
            // Создание маркера
            const marker = L.marker([segment.coordinates[0], segment.coordinates[1]], markerOptions);
            
            // Добавление всплывающей подсказки
            marker.bindTooltip(this.truncateDescription(segment.description));
            
            // Добавление обработчика клика на маркер
            marker.on('click', () => {
                this.showSegmentDetails(index);
            });
            
            // Добавление маркера на карту
            marker.addTo(this.map);
            
            // Сохранение ссылки на маркер
            this.segmentMarkers.push(marker);
        });
    }
    
    /**
     * Удаление маркеров сегментов с карты
     */
    removeSegmentMarkers() {
        if (!this.map) return;
        
        // Удаление каждого маркера с карты
        this.segmentMarkers.forEach(marker => {
            this.map.removeLayer(marker);
        });
        
        // Очистка массива маркеров
        this.segmentMarkers = [];
    }
    
    /**
     * Выделение сегмента на карте
     * @param {number} segmentIndex - Индекс сегмента
     */
    highlightSegmentOnMap(segmentIndex) {
        if (segmentIndex < 0 || segmentIndex >= this.routeSegments.length || !this.map) return;
        
        const segment = this.routeSegments[segmentIndex];
        if (!segment.coordinates) return;
        
        // Создание подсвеченного маркера
        this.highlightedMarker = L.circleMarker([segment.coordinates[0], segment.coordinates[1]], {
            radius: 12,
            color: '#ff3300',
            weight: 3,
            fillColor: '#ff9900',
            fillOpacity: 0.5,
            pane: 'markerPane'
        }).addTo(this.map);
    }
    
    /**
     * Удаление выделения сегмента на карте
     */
    unhighlightSegmentOnMap() {
        if (this.highlightedMarker && this.map) {
            this.map.removeLayer(this.highlightedMarker);
            this.highlightedMarker = null;
        }
    }
    
    /**
     * Центрирование карты на сегменте
     * @param {number} segmentIndex - Индекс сегмента
     */
    centerMapOnSegment(segmentIndex) {
        if (segmentIndex < 0 || segmentIndex >= this.routeSegments.length || !this.map) return;
        
        const segment = this.routeSegments[segmentIndex];
        if (!segment.coordinates) return;
        
        // Центрирование карты на координатах сегмента
        this.map.setView([segment.coordinates[0], segment.coordinates[1]], 14);
        
        // Подсветка сегмента
        this.highlightSegmentOnMap(segmentIndex);
        
        // Автоматическое удаление подсветки через 3 секунды
        setTimeout(() => {
            this.unhighlightSegmentOnMap();
        }, 3000);
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    // Создание экземпляра класса будет выполнено в main.js после инициализации карты
    window.initializeRouteAnalyzer = function(mapInstance) {
        if (!mapInstance) {
            console.error('Карта не инициализирована');
            return;
        }
        
        window.routeAnalyzer = new RouteAnalyzer(mapInstance);
    };
});