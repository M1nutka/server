// js/vk-api.js
class VKIntegration {
    constructor() {
        this.isVK = false;
        this.init();
    }

    async init() {
        // Проверяем, запущено ли в VK
        if (typeof VK !== 'undefined') {
            this.isVK = true;
            await this.initializeVK();
        }
    }

    async initializeVK() {
        try {
            // Инициализация VK Mini App
            await VK.init({
                apiId: YOUR_APP_ID
            });

            // Получение информации о пользователе
            const user = await VK.Api.call('users.get', {});
            this.user = user[0];

            // Настройка интерфейса VK
            this.setupVKUI();

        } catch (error) {
            console.error('VK initialization error:', error);
        }
    }

    setupVKUI() {
        // Адаптация интерфейса под VK
        document.body.classList.add('vk-environment');
        
        // Изменение цветовой схемы
        const style = document.createElement('style');
        style.textContent = `
            .vk-environment {
                --primary-color: #5181B8;
                --background-color: #F5F5F5;
            }
            .vk-environment .schedule-item {
                background: #FFFFFF;
            }
        `;
        document.head.appendChild(style);
    }

    // Метод для отправки событий в VK
    trackEvent(eventName, data = {}) {
        if (this.isVK) {
            VK.AppEvent(eventName, data);
        }
    }
}

// Инициализация VK интеграции
const vkIntegration = new VKIntegration();