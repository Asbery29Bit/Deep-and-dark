/**
 * Модуль 3D визуализации рельефа и маршрута
 * 
 * Предоставляет трехмерную визуализацию рельефа местности и маршрута
 * трубопровода с возможностью управления камерой и настройками отображения.
 */

class TerrainViewer3D {
    constructor(containerId, options = {}) {
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        
        // Параметры по умолчанию
        this.options = Object.assign({
            exaggeration: 2.0,      // Коэффициент вертикального преувеличения
            resolution: 50,         // Разрешение сетки (количество точек на сторону)
            dataResolution: 0.01,   // Разрешение данных (в градусах)
            routeHeight: 0.5,       // Высота маршрута над поверхностью
            cameraDistance: 100,    // Начальное расстояние камеры
            cameraAngle: 45         // Начальный угол камеры (в градусах)
        }, options);
        
        // Данные для отображения
        this.terrainData = null;
        this.terrainMesh = null;
        this.routeData = null;
        this.routeLine = null;
        
        // Границы области
        this.bounds = {
            north: 0,
            south: 0,
            east: 0,
            west: 0
        };
        
        // Инициализация Three.js
        this.setupScene();
        
        // Обработчики событий
        this.setupEventHandlers();
    }
    setPipelineData(points) {
        this.pipelineData = points;
        this.updatePipelineVisualization();
    }
    
    updatePipelineVisualization() {
        // Удаляем предыдущую визуализацию
        if (this.pipelineObject) {
            this.scene.remove(this.pipelineObject);
        }
        
        if (!this.pipelineData || this.pipelineData.length < 2) return;
        
        // Создаем геометрию трубопровода
        const pipelinePath = [];
        for (const point of this.pipelineData) {
            const x = this.mapCoordinateToScene(point.lng, this.bounds.west, this.bounds.east, -50, 50);
            const z = this.mapCoordinateToScene(point.lat, this.bounds.north, this.bounds.south, -50, 50);
            const y = -(point.depth || 2.5) * this.options.exaggeration;
            pipelinePath.push(new THREE.Vector3(x, y, z));
        }
        
        // Создаем трубку для визуализации
        const curve = new THREE.CatmullRomCurve3(pipelinePath);
        const geometry = new THREE.TubeGeometry(
            curve, 
            pipelinePath.length * 2, 
            0.5,  // радиус трубы
            16,   // сегменты по окружности
            false // закрытые концы
        );
        
        const material = new THREE.MeshStandardMaterial({
            color: 0x4682B4,
            metalness: 0.7,
            roughness: 0.3,
            side: THREE.DoubleSide
        });
        
        this.pipelineObject = new THREE.Mesh(geometry, material);
        this.scene.add(this.pipelineObject);
    }
    
    /**
     * Настройка сцены, камеры и рендерера Three.js
     */
    setupScene() {
        // Создание сцены
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xf0f0f0);
        
        // Добавление тумана для создания эффекта дистанции
        this.scene.fog = new THREE.Fog(0xf0f0f0, 100, 1000);
        
        // Создание камеры
        const aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
        this.setCameraPosition(this.options.cameraDistance, this.options.cameraAngle);
        
        // Создание рендерера
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.renderer.shadowMap.enabled = true;
        this.container.appendChild(this.renderer.domElement);
        
        // Создание орбитальных элементов управления камерой
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.25;
        this.controls.screenSpacePanning = false;
        this.controls.maxPolarAngle = Math.PI / 2;
        
        // Добавление освещения
        this.addLights();
        
        // Координатные оси для отладки
        const axesHelper = new THREE.AxesHelper(5);
        this.scene.add(axesHelper);
        
        // Запуск цикла анимации
        this.animate();
    }
    
    /**
     * Добавление источников света на сцену
     */
    addLights() {
        // Направленный свет (имитация солнца)
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
        directionalLight.position.set(50, 100, 50);
        directionalLight.castShadow = true;
        
        // Настройка теней
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 500;
        
        const d = 100;
        directionalLight.shadow.camera.left = -d;
        directionalLight.shadow.camera.right = d;
        directionalLight.shadow.camera.top = d;
        directionalLight.shadow.camera.bottom = -d;
        
        this.scene.add(directionalLight);
        
        // Полусферическое освещение для имитации отраженного света
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
        hemiLight.position.set(0, 300, 0);
        this.scene.add(hemiLight);
        
        // Окружающее освещение
        const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
        this.scene.add(ambientLight);
    }
    
    /**
     * Установка позиции камеры
     * @param {number} distance - Расстояние от центра сцены
     * @param {number} angle - Угол в градусах
     */
    setCameraPosition(distance, angle) {
        const radians = THREE.MathUtils.degToRad(angle);
        this.camera.position.set(
            distance * Math.sin(radians),
            distance * Math.sin(radians) * 0.5,
            distance * Math.cos(radians)
        );
        this.camera.lookAt(0, 0, 0);
    }
    
    /**
     * Настройка обработчиков событий
     */
    setupEventHandlers() {
        // Обработка изменения размера окна
        window.addEventListener('resize', () => {
            this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
            this.camera.updateProjectionMatrix();
            this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        });
        
        // Обработка изменения коэффициента вертикального преувеличения
        const exaggerationSlider = document.getElementById('exaggeration');
        if (exaggerationSlider) {
            exaggerationSlider.addEventListener('input', (e) => {
                this.options.exaggeration = parseFloat(e.target.value);
                // Перестроение рельефа с новым коэффициентом
                if (this.terrainData) {
                    this.updateTerrainMesh();
                }
            });
        }
    }
    
    /**
     * Цикл анимации
     */
    animate() {
        requestAnimationFrame(this.animate.bind(this));
        
        // Обновление орбитальных элементов управления
        this.controls.update();
        
        // Рендеринг сцены
        this.renderer.render(this.scene, this.camera);
    }
    
    /**
     * Загрузка и установка данных о рельефе
     * @param {Object} data - Данные о рельефе от API
     */
    setTerrainData(data) {
        this.terrainData = data;
        
        // Определение границ области
        this.bounds.north = data.north;
        this.bounds.south = data.south;
        this.bounds.east = data.east;
        this.bounds.west = data.west;
        
        // Создание или обновление меша рельефа
        this.updateTerrainMesh();
        
        // Обновление маршрута, если он был загружен ранее
        if (this.routeData) {
            this.updateRouteLine();
        }
        
        // Перемещение камеры для охвата всей области
        this.focusCameraOnBounds();
    }
    
    /**
     * Создание или обновление меша рельефа
     */
    updateTerrainMesh() {
        // Очистка существующего меша, если он есть
        if (this.terrainMesh) {
            this.scene.remove(this.terrainMesh);
            this.terrainMesh.geometry.dispose();
            this.terrainMesh.material.dispose();
        }
        
        // Создание геометрии на основе данных о рельефе
        const geometry = new THREE.PlaneGeometry(
            100,  // Ширина в условных единицах
            100,  // Высота в условных единицах
            this.options.resolution - 1,  // Сегментов по ширине
            this.options.resolution - 1   // Сегментов по высоте
        );
        
        // Поворот геометрии для соответствия системе координат
        geometry.rotateX(-Math.PI / 2);
        
        // Настройка высот на основе данных о рельефе
        const positions = geometry.attributes.position.array;
        const width = this.options.resolution;
        const height = this.options.resolution;
        
        // Вычисление шага в градусах
        const latStep = (this.bounds.north - this.bounds.south) / (height - 1);
        const lngStep = (this.bounds.east - this.bounds.west) / (width - 1);
        
        // Массивы для хранения цветов поверхности
        const colors = [];
        const colorAttribute = new THREE.Float32BufferAttribute(colors, 3);
        
        // Настройка высот и цветов вершин
        for (let i = 0; i < height; i++) {
            for (let j = 0; j < width; j++) {
                const index = i * width + j;
                const vertex = index * 3;
                
                // Определение координат для получения высоты
                const lat = this.bounds.north - i * latStep;
                const lng = this.bounds.west + j * lngStep;
                
                // Получение высоты из данных
                const heightValue = this.getHeightAtCoordinates(lat, lng);
                
                // Применение вертикального преувеличения
                positions[vertex + 1] = heightValue * this.options.exaggeration;
                
                // Вычисление цвета на основе высоты (от зеленого до коричневого)
                // Нормализация высоты к диапазону 0-1
                const normalizedHeight = this.normalizeHeight(heightValue);
                
                // Интерполяция цвета между зеленым (низкий) и коричневым (высокий)
                const r = 0.2 + normalizedHeight * 0.6;  // от 0.2 до 0.8
                const g = 0.6 - normalizedHeight * 0.4;  // от 0.6 до 0.2
                const b = 0.1;  // постоянный синий компонент
                
                colors.push(r, g, b);
            }
        }
        
        // Добавление атрибута цвета к геометрии
        geometry.setAttribute('color', colorAttribute);
        
        // Создание материала с вертексными цветами
        const material = new THREE.MeshStandardMaterial({
            vertexColors: true,
            flatShading: true,
            wireframe: false,
            roughness: 0.8,
            metalness: 0.2,
            side: THREE.DoubleSide
        });
        
        // Создание меша и добавление его на сцену
        this.terrainMesh = new THREE.Mesh(geometry, material);
        this.terrainMesh.receiveShadow = true;
        this.terrainMesh.castShadow = true;
        
        // Центрирование меша на сцене
        this.terrainMesh.position.set(0, 0, 0);
        
        this.scene.add(this.terrainMesh);
    }
    
    /**
     * Нормализация высоты к диапазону 0-1
     * @param {number} height - Высота в метрах
     * @returns {number} - Нормализованное значение высоты
     */
    normalizeHeight(height) {
        // Примерные значения для нормализации (можно настроить в зависимости от региона)
        const minHeight = 0;    // примерный минимум высоты
        const maxHeight = 1000; // примерный максимум высоты
        
        return Math.max(0, Math.min(1, (height - minHeight) / (maxHeight - minHeight)));
    }
    
    /**
     * Интерполяция высоты в заданных координатах
     * @param {number} lat - Широта
     * @param {number} lng - Долгота
     * @returns {number} - Высота в метрах
     */
    getHeightAtCoordinates(lat, lng) {
        if (!this.terrainData || !this.terrainData.elevation) {
            return 0;
        }
        
        // Нахождение ближайших точек в сетке данных
        const latIndex = Math.floor((this.bounds.north - lat) / this.options.dataResolution);
        const lngIndex = Math.floor((lng - this.bounds.west) / this.options.dataResolution);
        
        // Проверка границ
        if (latIndex < 0 || latIndex >= this.terrainData.elevation.length - 1 ||
            lngIndex < 0 || lngIndex >= this.terrainData.elevation[0].length - 1) {
            return 0;
        }
        
        // Интерполяция между четырьмя ближайшими точками
        const latFraction = (this.bounds.north - lat) / this.options.dataResolution - latIndex;
        const lngFraction = (lng - this.bounds.west) / this.options.dataResolution - lngIndex;
        
        // Значения высот в ближайших точках
        const h00 = this.terrainData.elevation[latIndex][lngIndex];
        const h01 = this.terrainData.elevation[latIndex][lngIndex + 1];
        const h10 = this.terrainData.elevation[latIndex + 1][lngIndex];
        const h11 = this.terrainData.elevation[latIndex + 1][lngIndex + 1];
        
        // Билинейная интерполяция
        const h0 = h00 * (1 - lngFraction) + h01 * lngFraction;
        const h1 = h10 * (1 - lngFraction) + h11 * lngFraction;
        
        return h0 * (1 - latFraction) + h1 * latFraction;
    }
    
    /**
     * Установка данных о маршруте
     * @param {Array} route - Массив точек маршрута в формате [[lat1, lng1], [lat2, lng2], ...]
     */
    setRouteData(route) {
        this.routeData = route;
        
        // Если данные о рельефе уже загружены, обновляем линию маршрута
        if (this.terrainData) {
            this.updateRouteLine();
        }
    }
    
    /**
     * Создание или обновление линии маршрута
     */
    updateRouteLine() {
        // Удаляем предыдущую линию маршрута, если она существует
        if (this.routeLine) {
            this.scene.remove(this.routeLine);
        }
        
        if (!this.routeData || this.routeData.length < 2) {
                    if (this.pipelineData) {
            this.updatePipelineVisualization();
                    }
            return;
        }
        
        // Создание геометрии линии
        const points = [];
        
        // Конвертация географических координат в координаты сцены
        for (const point of this.routeData) {
            const lat = point[0];
            const lng = point[1];
            
            // Получение нормализованных координат
            const x = this.mapCoordinateToScene(lng, this.bounds.west, this.bounds.east, -50, 50);
            const z = this.mapCoordinateToScene(lat, this.bounds.north, this.bounds.south, -50, 50);
            
            // Получение высоты рельефа в данной точке
            const heightValue = this.getHeightAtCoordinates(lat, lng);
            
            // Вычисление высоты маршрута (немного выше поверхности)
            const y = heightValue * this.options.exaggeration + this.options.routeHeight;
            
            points.push(new THREE.Vector3(x, y, z));
        }
        
        // Создание геометрии линии
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        
        // Создание материала линии
        const material = new THREE.LineBasicMaterial({
            color: 0xff0000,  // Красный цвет для маршрута
            linewidth: 3     // Толщина линии (не работает в WebGL)
        });
        
        // Создание линии и добавление на сцену
        this.routeLine = new THREE.Line(geometry, material);
        this.scene.add(this.routeLine);
        
        // Создание трубы вокруг маршрута для лучшей видимости
        this.createRouteTube(points);
        
        // Создание маркеров начала и конца маршрута
        this.createRouteMarkers(points[0], points[points.length - 1]);
    }
    
    /**
     * Создание трубы вокруг маршрута для лучшей видимости
     * @param {Array} points - Массив точек маршрута в формате THREE.Vector3
     */
    createRouteTube(points) {
        if (this.routeTube) {
            this.scene.remove(this.routeTube);
        }
        
        // Создание кривой по точкам
        const curve = new THREE.CatmullRomCurve3(points);
        
        // Создание геометрии трубы
        const geometry = new THREE.TubeGeometry(curve, points.length * 2, 0.2, 8, false);
        
        // Создание материала трубы
        const material = new THREE.MeshStandardMaterial({
            color: 0xff3333,
            roughness: 0.5,
            metalness: 0.7,
            emissive: 0x220000
        });
        
        // Создание меша трубы и добавление на сцену
        this.routeTube = new THREE.Mesh(geometry, material);
        this.routeTube.castShadow = true;
        this.scene.add(this.routeTube);
    }
    
    /**
     * Создание маркеров начала и конца маршрута
     * @param {THREE.Vector3} startPoint - Начальная точка
     * @param {THREE.Vector3} endPoint - Конечная точка
     */
    createRouteMarkers(startPoint, endPoint) {
        // Удаление предыдущих маркеров, если они существуют
        if (this.startMarker) {
            this.scene.remove(this.startMarker);
        }
        if (this.endMarker) {
            this.scene.remove(this.endMarker);
        }
        
        // Создание геометрии сферы для маркеров
        const geometryStart = new THREE.SphereGeometry(0.8, 16, 16);
        const geometryEnd = new THREE.SphereGeometry(0.8, 16, 16);
        
        // Создание материалов маркеров
        const materialStart = new THREE.MeshStandardMaterial({
            color: 0x00ff00,  // Зеленый для начала
            roughness: 0.3,
            metalness: 0.8,
            emissive: 0x002200
        });
        
        const materialEnd = new THREE.MeshStandardMaterial({
            color: 0xff0000,  // Красный для конца
            roughness: 0.3,
            metalness: 0.8,
            emissive: 0x220000
        });
        
        // Создание мешей маркеров
        this.startMarker = new THREE.Mesh(geometryStart, materialStart);
        this.endMarker = new THREE.Mesh(geometryEnd, materialEnd);
        
        // Установка позиций маркеров
        this.startMarker.position.copy(startPoint);
        this.endMarker.position.copy(endPoint);
        
        // Добавление маркеров на сцену
        this.scene.add(this.startMarker);
        this.scene.add(this.endMarker);
    }
    
    /**
     * Отображение сложности рельефа в виде тепловой карты
     * @param {Object} difficultyData - Данные о сложности рельефа
     */
    showTerrainDifficulty(difficultyData) {
        // Реализация тепловой карты сложности рельефа
        // (будет дополнено в будущих версиях)
    }
    
    /**
     * Отображение экологической ценности в виде тепловой карты
     * @param {Object} environmentalData - Данные об экологической ценности
     */
    showEnvironmentalValue(environmentalData) {
        // Реализация тепловой карты экологической ценности
        // (будет дополнено в будущих версиях)
    }
    
    /**
     * Отображение инфраструктуры (дороги, реки, населенные пункты)
     * @param {Object} infrastructureData - Данные об инфраструктуре
     */
    showInfrastructure(infrastructureData) {
        // Реализация отображения инфраструктуры
        // (будет дополнено в будущих версиях)
    }
    
    /**
     * Фокусировка камеры на границах области
     */
    focusCameraOnBounds() {
        // Вычисление центра области
        const centerLat = (this.bounds.north + this.bounds.south) / 2;
        const centerLng = (this.bounds.east + this.bounds.west) / 2;
        
        // Определение расстояния камеры от центра
        const latDistance = this.bounds.north - this.bounds.south;
        const lngDistance = this.bounds.east - this.bounds.west;
        
        // Вычисление оптимального расстояния камеры
        const distance = Math.max(latDistance, lngDistance) * 200;
        
        // Установка камеры
        this.setCameraPosition(distance, 45);
        
        // Установка центра управления орбитой
        this.controls.target.set(0, 0, 0);
        this.controls.update();
    }
    
    /**
     * Отображение перекрестного разреза местности
     * @param {number} lat - Широта линии разреза
     * @param {number} lng - Долгота линии разреза
     * @param {string} direction - Направление разреза ('ns' или 'ew')
     */
    showTerrainCrossSection(lat, lng, direction) {
        // Реализация отображения разреза местности
        // (будет дополнено в будущих версиях)
    }
    
    /**
     * Преобразование географических координат в координаты сцены
     * @param {number} value - Значение координаты (широта или долгота)
     * @param {number} min - Минимальное значение диапазона
     * @param {number} max - Максимальное значение диапазона
     * @param {number} targetMin - Минимальное значение целевого диапазона
     * @param {number} targetMax - Максимальное значение целевого диапазона
     * @returns {number} - Значение в координатах сцены
     */
    mapCoordinateToScene(value, min, max, targetMin, targetMax) {
        return targetMin + (value - min) * (targetMax - targetMin) / (max - min);
    }
}

// Инициализация 3D просмотра при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    // Инициализация переменной для хранения экземпляра класса
    window.terrainViewer3D = null;
    
    // Функция инициализации 3D просмотра
    window.initialize3DView = function() {
        // Проверка наличия контейнера
        const container = document.getElementById('map3d');
        if (!container) {
            console.error('Контейнер для 3D карты не найден');
            return;
        }
        
        // Проверка наличия необходимых библиотек
        if (typeof THREE === 'undefined') {
            console.error('Библиотека Three.js не загружена');
            return;
        }
        
        // Создание необходимых компонентов для OrbitControls, если они отсутствуют
        if (typeof THREE.OrbitControls === 'undefined') {
            // Реализация простых контролей орбиты для демонстрации
            THREE.OrbitControls = function(camera, domElement) {
                this.camera = camera;
                this.domElement = domElement;
                this.enableDamping = false;
                this.dampingFactor = 0.25;
                this.screenSpacePanning = false;
                this.maxPolarAngle = Math.PI;
                this.target = new THREE.Vector3();
                
                this.update = function() {};
            };
        }
        
        // Создание экземпляра класса TerrainViewer3D
        window.terrainViewer3D = new TerrainViewer3D('map3d');
        
        // Активация 3D режима
        container.classList.remove('d-none');
        document.getElementById('map').classList.add('d-none');
        
        console.log('3D-просмотр инициализирован');
    };
    
    // Обработчик переключения между 2D и 3D режимами
    const toggle3D = document.getElementById('toggle-3d');
    if (toggle3D) {
        toggle3D.addEventListener('change', function(e) {
            const map2D = document.getElementById('map');
            const map3D = document.getElementById('map3d');
            
            if (e.target.checked) {
                // Переключение на 3D режим
                if (!window.terrainViewer3D) {
                    window.initialize3DView();
                } else {
                    map3D.classList.remove('d-none');
                    map2D.classList.add('d-none');
                }
            } else {
                // Переключение на 2D режим
                map3D.classList.add('d-none');
                map2D.classList.remove('d-none');
            }
        });
    }
});