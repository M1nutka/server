// js/vk-init.js
// Инициализация VK Mini App
vkBridge.send('VKWebAppInit', {})
    .then(() => {
        console.log('VK Mini App initialized');
        // Дополнительная инициализация для VK
        initializeVKFeatures();
    })
    .catch((error) => {
        console.error('VK initialization failed:', error);
    });

function initializeVKFeatures() {
    // Получение информации о пользователе
    vkBridge.send('VKWebAppGetUserInfo')
        .then((user) => {
            console.log('User info:', user);
            // Можно сохранить информацию о пользователе
            localStorage.setItem('vkUser', JSON.stringify(user));
        })
        .catch((error) => {
            console.error('Failed to get user info:', error);
        });

    // Настройка внешнего вида
    vkBridge.send('VKWebAppSetViewSettings', {
        status_bar_style: 'light',
        action_bar_color: '#5181B8'
    });
}

// Обработка глубоких ссылок VK
vkBridge.subscribe((e) => {
    if (e.detail.type === 'VKWebAppUpdateConfig') {
        const scheme = e.detail.data.scheme;
        // Адаптация под цветовую схему VK
    }
});