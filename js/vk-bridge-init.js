// js/vk-init.js - полностью самостоятельный файл
(function() {
    'use strict';
    
    // Ждем загрузки VK Bridge и DOM
    window.addEventListener('DOMContentLoaded', async function() {
        console.log('🚀 Инициализация VK Mini App...');
        
        // Проверяем наличие VK Bridge
        if (typeof vkBridge === 'undefined') {
            console.log('🌐 VK Bridge не найден - работаем как сайт');
            return;
        }
        
        try {
            // 1. Инициализируем VK Mini App
            await vkBridge.send('VKWebAppInit', {});
            console.log('✅ VK Mini App инициализирован');
            
            // 2. Получаем информацию о пользователе
            const userInfo = await vkBridge.send('VKWebAppGetUserInfo', {});
            console.log('👤 Пользователь:', userInfo);
            
            // 3. Настраиваем интерфейс для VK
            setupVKInterface();
            
            // 4. Настраиваем события VK
            setupVKEvents();
            
            // 5. Показываем что всё работает
            showVKStatus('VK Mini App готов к работе!');
            
        } catch (error) {
            console.error('❌ Ошибка инициализации VK:', error);
        }
    });
    
    // Настройка интерфейса для VK
    function setupVKInterface() {
        // Добавляем класс для VK стилей
        document.body.classList.add('vk-mini-app');
        
        // Скрываем лишние элементы для VK
        const elementsToHide = [
            'header', '.header', '.navbar', 
            '.site-header', '.main-header'
        ];
        
        elementsToHide.forEach(selector => {
            const element = document.querySelector(selector);
            if (element) {
                element.style.display = 'none';
                console.log(`📱 Скрыт элемент: ${selector}`);
            }
        });
        
        // Добавляем Safe Area для современных устройств
        addSafeAreaStyles();
        
        // Улучшаем скролл для VK
        improveScroll();
    }
    
    // Добавляем стили Safe Area
    function addSafeAreaStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .vk-mini-app {
                padding-top: env(safe-area-inset-top, 0px);
                padding-bottom: env(safe-area-inset-bottom, 0px);
                padding-left: env(safe-area-inset-left, 0px);
                padding-right: env(safe-area-inset-right, 0px);
                min-height: 100vh;
                background: #ffffff;
            }
            
            .vk-mini-app .container {
                max-width: 100%;
                margin: 0 auto;
                padding: 16px;
            }
            
            /* Улучшаем кнопки для мобильных */
            .vk-mini-app button, 
            .vk-mini-app .btn {
                touch-action: manipulation;
                min-height: 44px;
            }
        `;
        document.head.appendChild(style);
    }
    
    // Улучшаем скролл для VK
    function improveScroll() {
        document.body.style.overflow = 'auto';
        document.body.style.webkitOverflowScrolling = 'touch';
    }
    
    // Настройка событий VK
    function setupVKEvents() {
        // Обработка кнопки "Назад"
        window.addEventListener('popstate', function() {
            vkBridge.send('VKWebAppGoBack')
                .catch(error => console.log('Ошибка возврата:', error));
        });
        
        // Отслеживание видимости приложения
        document.addEventListener('visibilitychange', function() {
            if (document.hidden) {
                vkBridge.send('VKWebAppSetSwipeSettings', { history: true })
                    .catch(error => console.log('Ошибка настройки свайпа:', error));
            }
        });
        
        // Подписка на события VK Bridge
        vkBridge.subscribe(function(event) {
            console.log('📨 Событие VK:', event.detail);
            
            switch(event.detail.type) {
                case 'VKWebAppUpdateConfig':
                    handleConfigUpdate(event.detail.data);
                    break;
                case 'VKWebAppViewHide':
                    console.log('Приложение скрыто');
                    break;
                case 'VKWebAppViewRestore':
                    console.log('Приложение восстановлено');
                    break;
            }
        });
    }
    
    // Обработка обновления конфигурации
    function handleConfigUpdate(config) {
        console.log('⚙️ Обновлена конфигурация:', config);
        
        // Меняем тему если нужно
        if (config.theme) {
            document.body.setAttribute('data-theme', config.theme);
        }
    }
    
    // Показываем статус работы VK
    function showVKStatus(message) {
        // Создаем небольшой индикатор в углу
        const statusDiv = document.createElement('div');
        statusDiv.style.cssText = `
            position: fixed;
            top: 10px;
            right: 10px;
            background: #4CAF50;
            color: white;
            padding: 5px 10px;
            border-radius: 12px;
            font-size: 10px;
            z-index: 10000;
            opacity: 0.9;
        `;
        statusDiv.textContent = 'VK ✓';
        statusDiv.title = message;
        
        document.body.appendChild(statusDiv);
        
        // Авто-скрытие через 3 секунды
        setTimeout(() => {
            statusDiv.style.opacity = '0';
            setTimeout(() => statusDiv.remove(), 1000);
        }, 3000);
        
        console.log('📢 ' + message);
    }
    
    // Глобальные методы для использования в других скриптах
    window.VKApp = {
        // Показать уведомление
        showNotification: async function(message) {
            try {
                await vkBridge.send('VKWebAppShowNotification', { message });
            } catch (error) {
                console.log('Ошибка уведомления:', error);
                alert(message); // Fallback
            }
        },
        
        // Открыть URL
        openURL: async function(url) {
            try {
                await vkBridge.send('VKWebAppOpenURL', { url });
            } catch (error) {
                console.log('Ошибка открытия URL:', error);
                window.open(url, '_blank');
            }
        },
        
        // Поделиться
        share: async function(link, description = '') {
            try {
                await vkBridge.send('VKWebAppShare', { link, description });
            } catch (error) {
                console.log('Ошибка шаринга:', error);
            }
        },
        
        // Получить информацию об устройстве
        getDeviceInfo: async function() {
            try {
                return await vkBridge.send('VKWebAppGetDeviceInfo', {});
            } catch (error) {
                console.log('Ошибка получения device info:', error);
                return null;
            }
        }
    };
    
})();
