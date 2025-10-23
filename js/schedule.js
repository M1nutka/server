// js/schedule.js
class ScheduleApp {
    constructor() {
        this.currentGroup = 'И-25-1';
        this.init();
    }

    async init() {
        await this.updateIndexPage();
        this.setupEventListeners();
    }

    // Обновление главной страницы
    async updateIndexPage() {
        try {
            const response = await fetch('/api/dates');
            const data = await response.json();
            
            if (data.success && data.dates.length > 0) {
                this.updateCalendar(data.dates);
            }
        } catch (error) {
            console.error('Ошибка обновления календаря:', error);
        }
    }

    // Обновление календаря на главной странице
    updateCalendar(dates) {
        const currentMonthGrid = document.querySelector('.currentMonth + .info-fgr + .calendar-grid');
        const septemberGrid = document.querySelector('.month + .info-fgr + .calendar-grid');
        
        if (!currentMonthGrid) return;

        // Очищаем календарь
        currentMonthGrid.innerHTML = '';
        if (septemberGrid) septemberGrid.innerHTML = '';

        // Создаем кнопки для доступных дат
        dates.forEach(dateInfo => {
            const button = document.createElement('a');
            button.href = `rasp.html?date=${encodeURIComponent(dateInfo.urlDate)}`;
            button.innerHTML = `<button class="day-btn" type="button">${dateInfo.displayDate}</button>`;
            
            if (currentMonthGrid.children.length < 30) {
                currentMonthGrid.appendChild(button);
            } else if (septemberGrid && septemberGrid.children.length < 30) {
                septemberGrid.appendChild(button);
            }
        });
    }

    // Настройка обработчиков событий
    setupEventListeners() {
        // Обработчик для поиска на rasp.html
        const searchBtn = document.querySelector('.search-sr');
        if (searchBtn) {
            searchBtn.addEventListener('click', () => this.handleSearch());
        }

        // Обработчик Enter в поле поиска
        const searchInput = document.querySelector('.search-ph');
        if (searchInput) {
            searchInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.handleSearch();
            });
        }

        // Загрузка расписания группы если мы на mainGroup.html
        if (window.location.pathname.includes('mainGroup.html')) {
            this.loadGroupSchedule();
        }

        // Загрузка общего расписания если мы на rasp.html
        if (window.location.pathname.includes('rasp.html')) {
            this.loadGeneralSchedule();
        }
    }

    // Поиск на странице rasp.html
    async handleSearch() {
        const searchInput = document.querySelector('.search-ph');
        if (!searchInput) return;

        const query = searchInput.value.trim();
        if (!query) return;

        try {
            const urlParams = new URLSearchParams(window.location.search);
            const currentDate = urlParams.get('date');
            
            const searchUrl = currentDate ? 
                `/api/search?q=${encodeURIComponent(query)}&date=${encodeURIComponent(currentDate)}` :
                `/api/search?q=${encodeURIComponent(query)}`;

            const response = await fetch(searchUrl);
            const data = await response.json();

            this.displaySearchResults(data.results, query);
        } catch (error) {
            console.error('Ошибка поиска:', error);
        }
    }

    // Отображение результатов поиска
    displaySearchResults(results, query) {
        const container = document.querySelector('.rasp');
        if (!container) return;

        if (results.length === 0) {
            container.innerHTML = `<div class="no-results">По запросу "${query}" ничего не найдено</div>`;
            return;
        }

        let html = `<div class="search-results">
                      <h3>Результаты поиска: "${query}"</h3>
                      <div class="results-grid">`;

        results.forEach(item => {
            html += `
                <div class="result-item">
                    <div class="result-group">${item.group}</div>
                    <div class="result-time">${item.time}</div>
                    <div class="result-subject">${item.subject}</div>
                    <div class="result-teacher">${item.teacher}</div>
                    <div class="result-room">${item.room}</div>
                    <div class="result-date">${item.date}</div>
                </div>
            `;
        });

        html += '</div></div>';
        container.innerHTML = html;
    }

    // Загрузка расписания группы
    async loadGroupSchedule() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const group = urlParams.get('group') || this.currentGroup;
            const date = urlParams.get('date') || '';

            const response = await fetch(`/api/schedule/group/${group}?date=${date}`);
            const data = await response.json();

            if (data.success) {
                this.renderGroupSchedule(data.schedule, data.group, data.date);
            }
        } catch (error) {
            console.error('Ошибка загрузки расписания группы:', error);
        }
    }

    // Отображение расписания группы
    renderGroupSchedule(schedule, group, date) {
        const container = document.getElementById('schedule-container');
        if (!container) return;

        if (!schedule || schedule.length === 0) {
            container.innerHTML = `
                <div class="no-schedule">
                    <h3>Группа: ${group}</h3>
                    <p>Нет занятий на выбранную дату</p>
                </div>
            `;
            return;
        }

        let html = `
            <div class="schedule-header">
                <h3>Группа: ${group}</h3>
                <p>Дата: ${date || 'все дни'}</p>
            </div>
            <div class="schedule-table">
        `;

        schedule.forEach(item => {
            html += `
                <div class="schedule-item">
                    <div class="pair-info">
                        <span class="pair-number">${item.pair} пара</span>
                        <span class="time">${item.time}</span>
                    </div>
                    <div class="subject">${item.subject}</div>
                    <div class="details">
                        <span class="teacher">${item.teacher}</span>
                        <span class="room">${item.room}</span>
                    </div>
                    <div class="date">${item.date}</div>
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;
    }

    // Загрузка общего расписания
    async loadGeneralSchedule() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const date = urlParams.get('date');

            if (date) {
                const response = await fetch(`/api/schedule/${date}`);
                const data = await response.json();

                if (data.success) {
                    this.renderGeneralSchedule(data.schedule, data.date);
                }
            }
        } catch (error) {
            console.error('Ошибка загрузки общего расписания:', error);
        }
    }

    // Отображение общего расписания
    renderGeneralSchedule(schedule, date) {
        const container = document.querySelector('.rasp');
        if (!container) return;

        if (!schedule || schedule.length === 0) {
            container.innerHTML = `<div class="no-schedule">Нет расписания на выбранную дату</div>`;
            return;
        }

        // Группируем по группам
        const groups = {};
        schedule.forEach(item => {
            if (!groups[item.group]) {
                groups[item.group] = [];
            }
            groups[item.group].push(item);
        });

        let html = `<div class="general-schedule">
                      <h3>Расписание на ${date}</h3>`;

        Object.keys(groups).sort().forEach(group => {
            html += `<div class="group-schedule">
                       <h4>${group}</h4>
                       <div class="group-lessons">`;

            groups[group].forEach(lesson => {
                html += `
                    <div class="lesson">
                        <span class="lesson-time">${lesson.time}</span>
                        <span class="lesson-subject">${lesson.subject}</span>
                        <span class="lesson-teacher">${lesson.teacher}</span>
                        <span class="lesson-room">${lesson.room}</span>
                    </div>
                `;
            });

            html += `</div></div>`;
        });

        html += '</div>';
        container.innerHTML = html;
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    new ScheduleApp();

});

