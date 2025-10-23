// js/cache.js
class CacheManager {
    constructor() {
        this.prefix = 'schedule_';
    }

    set(key, data, ttl = CONFIG.CACHE_DURATION) {
        try {
            const item = {
                data: data,
                expiry: Date.now() + ttl
            };
            localStorage.setItem(this.prefix + key, JSON.stringify(item));
            return true;
        } catch (error) {
            console.warn('Cache set failed:', error);
            return false;
        }
    }

    get(key) {
        try {
            const itemStr = localStorage.getItem(this.prefix + key);
            if (!itemStr) return null;

            const item = JSON.parse(itemStr);
            if (Date.now() > item.expiry) {
                this.remove(key);
                return null;
            }

            return item.data;
        } catch (error) {
            console.warn('Cache get failed:', error);
            return null;
        }
    }

    remove(key) {
        try {
            localStorage.removeItem(this.prefix + key);
        } catch (error) {
            console.warn('Cache remove failed:', error);
        }
    }

    clear() {
        try {
            Object.keys(localStorage)
                .filter(key => key.startsWith(this.prefix))
                .forEach(key => localStorage.removeItem(key));
        } catch (error) {
            console.warn('Cache clear failed:', error);
        }
    }
}

const cacheManager = new CacheManager();