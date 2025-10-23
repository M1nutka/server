// js/config.js
const CONFIG = {
    PROXY_URL: process.env.PROXY_URL || 'https://your-proxy-server.com/api',
    CACHE_DURATION: 30 * 60 * 1000, // 30 минут
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000,
    
    // Настройки для разных сред
    ENVIRONMENTS: {
        DEVELOPMENT: {
            DEBUG: true,
            LOG_REQUESTS: true
        },
        PRODUCTION: {
            DEBUG: false,
            LOG_REQUESTS: false
        }
    }
};

// Определяем текущую среду
const CURRENT_ENV = window.location.hostname === 'localhost' 
    ? CONFIG.ENVIRONMENTS.DEVELOPMENT 
    : CONFIG.ENVIRONMENTS.PRODUCTION;