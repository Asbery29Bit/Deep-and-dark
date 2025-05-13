/**
 * Модуль управления ползунками для настройки критериев оптимизации маршрута
 * 
 * Обеспечивает интерактивную настройку весов различных критериев с автоматической
 * нормализацией и визуализацией распределения весов.
 */

class CriteriaSliders {
    constructor() {
        // Идентификаторы слайдеров и связанных элементов
        this.sliders = {
            distance: {
                id: 'distance-slider',
                valueId: 'distance-value',
                inputId: 'distance-weight',
                defaultValue: 0.3,
                color: 'rgb(44, 123, 229)'
            },
            terrain: {
                id: 'terrain-slider',
                valueId: 'terrain-value',
                inputId: 'terrain-weight',
                defaultValue: 0.2,
                color: 'rgb(72, 159, 64)'
            },
            environmental: {
                id: 'environmental-slider',
                valueId: 'environmental-value',
                inputId: 'environmental-weight',
                defaultValue: 0.15,
                color: 'rgb(27, 158, 119)'
            },
            cost: {
                id: 'cost-slider',
                valueId: 'cost-value',
                inputId: 'cost-weight',
                defaultValue: 0.2,
                color: 'rgb(217, 83, 79)'
            },
            maintenance: {
                id: 'maintenance-slider',
                valueId: 'maintenance-value',
                inputId: 'maintenance-weight',
                defaultValue: 0.15,
                color: 'rgb(250, 164, 58)'
            }
        };
        
        // Объект для хранения инстансов слайдеров noUiSlider
        this.sliderInstances = {};
        
        // График распределения весов
        this.chart = null;
        
        // Инициализация
        this.initialize();
    }
    
    /**
     * Инициализация слайдеров и графика
     */
    initialize() {
        // Инициализация слайдеров
        this.initializeSliders();
        
        // Инициализация графика
        this.initializeChart();
        
        // Настройка кнопок предустановок
        this.setupPresetButtons();
        
        // Настройка кнопки сброса
        this.setupResetButton();
    }
    
    /**
     * Инициализация слайдеров noUiSlider
     */
    initializeSliders() {
        // Обход всех слайдеров
        for (const key in this.sliders) {
            const slider = this.sliders[key];
            const sliderElement = document.getElementById(slider.id);
            
            if (!sliderElement) {
                console.warn(`Элемент слайдера ${slider.id} не найден`);
                continue;
            }
            
            // Создание слайдера noUiSlider
            noUiSlider.create(sliderElement, {
                start: [slider.defaultValue],
                connect: [true, false],
                step: 0.01,
                range: {
                    'min': [0],
                    'max': [1]
                },
                format: {
                    to: value => parseFloat(value).toFixed(2),
                    from: value => parseFloat(value)
                }
            });
            
            // Сохранение инстанса слайдера
            this.sliderInstances[key] = sliderElement.noUiSlider;
            
            // Элемент отображения значения
            const valueElement = document.getElementById(slider.valueId);
            
            // Инициализация элемента отображения значения
            if (valueElement) {
                valueElement.textContent = slider.defaultValue.toFixed(2);
            }
            
            // Элемент скрытого инпута
            const inputElement = document.getElementById(slider.inputId);
            
            // Инициализация значения скрытого инпута
            if (inputElement) {
                inputElement.value = slider.defaultValue.toFixed(2);
            }
            
            // Добавление обработчика события обновления слайдера
            sliderElement.noUiSlider.on('update', (values, handle) => {
                const value = parseFloat(values[handle]);
                
                // Обновление элемента отображения значения
                if (valueElement) {
                    valueElement.textContent = value.toFixed(2);
                }
                
                // Обновление значения скрытого инпута
                if (inputElement) {
                    inputElement.value = value.toFixed(2);
                }
                
                // Нормализация весов
                this.normalizeWeights(key);
                
                // Обновление графика
                this.updateChart();
            });
        }
    }
    
    /**
     * Нормализация весов для обеспечения суммы = 1
     * @param {string} changedKey - Ключ измененного слайдера
     */
    normalizeWeights(changedKey) {
        // Получение текущих значений весов
        const weights = {};
        let sum = 0;
        
        for (const key in this.sliders) {
            if (this.sliderInstances[key]) {
                weights[key] = parseFloat(this.sliderInstances[key].get());
                sum += weights[key];
            }
        }
        
        // Если сумма не равна 1, нормализация весов
        if (sum !== 1 && sum > 0) {
            // Коэффициент нормализации
            const normalizationFactor = 1 / sum;
            
            // Нормализация весов без обратной связи
            for (const key in this.sliders) {
                if (key !== changedKey && this.sliderInstances[key]) {
                    const normalizedValue = weights[key] * normalizationFactor;
                    
                    // Обновление значения слайдера без обратной связи
                    this.sliderInstances[key].set(normalizedValue);
                    
                    // Обновление элемента отображения значения
                    const valueElement = document.getElementById(this.sliders[key].valueId);
                    if (valueElement) {
                        valueElement.textContent = normalizedValue.toFixed(2);
                    }
                    
                    // Обновление значения скрытого инпута
                    const inputElement = document.getElementById(this.sliders[key].inputId);
                    if (inputElement) {
                        inputElement.value = normalizedValue.toFixed(2);
                    }
                }
            }
        }
    }
    
    /**
     * Инициализация графика распределения весов
     */
    initializeChart() {
        const chartElement = document.getElementById('weights-chart');
        
        if (!chartElement) {
            console.warn('Элемент графика не найден');
            return;
        }
        
        // Подготовка данных для графика
        const labels = [];
        const data = [];
        const backgroundColor = [];
        
        for (const key in this.sliders) {
            const slider = this.sliders[key];
            labels.push(this.getHumanReadableName(key));
            data.push(slider.defaultValue);
            backgroundColor.push(slider.color);
        }
        
        // Создание графика
        this.chart = new Chart(chartElement, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: backgroundColor,
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            font: {
                                size: 12
                            }
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const value = context.raw;
                                const percentage = (value * 100).toFixed(0);
                                return `${context.label}: ${percentage}%`;
                            }
                        }
                    }
                }
            }
        });
    }
    
    /**
     * Обновление графика распределения весов
     */
    updateChart() {
        if (!this.chart) return;
        
        // Обновление данных графика
        for (let i = 0; i < this.chart.data.labels.length; i++) {
            const key = this.getKeyFromHumanReadableName(this.chart.data.labels[i]);
            if (key && this.sliderInstances[key]) {
                this.chart.data.datasets[0].data[i] = parseFloat(this.sliderInstances[key].get());
            }
        }
        
        // Обновление графика
        this.chart.update();
    }
    
    /**
     * Настройка кнопок предустановок
     */
    setupPresetButtons() {
        const presetButtons = document.querySelectorAll('.preset-btn');
        
        presetButtons.forEach(button => {
            button.addEventListener('click', () => {
                const presetName = button.getAttribute('data-preset');
                this.applyPreset(presetName);
            });
        });
    }
    
    /**
     * Применение предустановки весов
     * @param {string} presetName - Название предустановки
     */
    applyPreset(presetName) {
        // Предустановки весов
        const presets = {
            balanced: {
                distance: 0.20,
                terrain: 0.20,
                environmental: 0.20,
                cost: 0.20,
                maintenance: 0.20
            },
            eco: {
                distance: 0.10,
                terrain: 0.15,
                environmental: 0.50,
                cost: 0.10,
                maintenance: 0.15
            },
            cost: {
                distance: 0.15,
                terrain: 0.10,
                environmental: 0.10,
                cost: 0.50,
                maintenance: 0.15
            },
            distance: {
                distance: 0.50,
                terrain: 0.15,
                environmental: 0.10,
                cost: 0.15,
                maintenance: 0.10
            }
        };
        
        // Проверка наличия предустановки
        if (!presets[presetName]) {
            console.warn(`Предустановка ${presetName} не найдена`);
            return;
        }
        
        // Применение предустановки
        for (const key in presets[presetName]) {
            if (this.sliderInstances[key]) {
                this.sliderInstances[key].set(presets[presetName][key]);
            }
        }
    }
    
    /**
     * Настройка кнопки сброса
     */
    setupResetButton() {
        const resetButton = document.getElementById('reset-form-btn');
        
        if (resetButton) {
            resetButton.addEventListener('click', () => {
                this.resetToDefaults();
            });
        }
    }
    
    /**
     * Сброс весов к значениям по умолчанию
     */
    resetToDefaults() {
        for (const key in this.sliders) {
            if (this.sliderInstances[key]) {
                this.sliderInstances[key].set(this.sliders[key].defaultValue);
            }
        }
    }
    
    /**
     * Получение текущих весов
     * @returns {Object} - Объект с текущими весами
     */
    getCurrentWeights() {
        const weights = {};
        
        for (const key in this.sliders) {
            if (this.sliderInstances[key]) {
                weights[key] = parseFloat(this.sliderInstances[key].get());
            }
        }
        
        return weights;
    }
    
    /**
     * Преобразование ключа в читаемое название
     * @param {string} key - Ключ слайдера
     * @returns {string} - Читаемое название
     */
    getHumanReadableName(key) {
        const names = {
            distance: 'Расстояние',
            terrain: 'Рельеф',
            environmental: 'Экология',
            cost: 'Стоимость',
            maintenance: 'Обслуживание'
        };
        
        return names[key] || key;
    }
    
    /**
     * Получение ключа по читаемому названию
     * @param {string} name - Читаемое название
     * @returns {string|null} - Ключ слайдера или null, если не найден
     */
    getKeyFromHumanReadableName(name) {
        const keyMap = {
            'Расстояние': 'distance',
            'Рельеф': 'terrain',
            'Экология': 'environmental',
            'Стоимость': 'cost',
            'Обслуживание': 'maintenance'
        };
        
        return keyMap[name] || null;
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    // Проверка наличия необходимых библиотек
    if (typeof noUiSlider === 'undefined') {
        console.error('Библиотека noUiSlider не загружена');
        return;
    }
    
    if (typeof Chart === 'undefined') {
        console.error('Библиотека Chart.js не загружена');
        return;
    }
    
    // Создание экземпляра класса CriteriaSliders
    window.criteriaSliders = new CriteriaSliders();
});