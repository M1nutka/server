// js/slider.js
class Slider {
    constructor() {
        this.slideContainer = document.querySelector('.slide-container');
        this.slideDate = document.querySelector('.slide-date');
        this.arrowLeft = document.querySelector('.arrow-left');
        this.arrowRight = document.querySelector('.arrow-right');
        
        this.init();
    }

    init() {
        if (this.arrowLeft && this.arrowRight) {
            this.arrowLeft.addEventListener('click', () => this.scrollLeft());
            this.arrowRight.addEventListener('click', () => this.scrollRight());
        }

        this.setupDragScroll();
    }

    scrollLeft() {
        if (this.slideContainer) {
            this.slideContainer.scrollBy({ left: -120, behavior: 'smooth' });
        }
    }

    scrollRight() {
        if (this.slideContainer) {
            this.slideContainer.scrollBy({ left: 120, behavior: 'smooth' });
        }
    }

    setupDragScroll() {
        if (!this.slideContainer) return;

        let isDown = false;
        let startX;
        let scrollLeft;

        this.slideContainer.addEventListener('mousedown', (e) => {
            isDown = true;
            startX = e.pageX - this.slideContainer.offsetLeft;
            scrollLeft = this.slideContainer.scrollLeft;
        });

        this.slideContainer.addEventListener('mouseleave', () => {
            isDown = false;
        });

        this.slideContainer.addEventListener('mouseup', () => {
            isDown = false;
        });

        this.slideContainer.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            e.preventDefault();
            const x = e.pageX - this.slideContainer.offsetLeft;
            const walk = (x - startX) * 2;
            this.slideContainer.scrollLeft = scrollLeft - walk;
        });

        // Touch events для мобильных устройств
        this.slideContainer.addEventListener('touchstart', (e) => {
            isDown = true;
            startX = e.touches[0].pageX - this.slideContainer.offsetLeft;
            scrollLeft = this.slideContainer.scrollLeft;
        });

        this.slideContainer.addEventListener('touchend', () => {
            isDown = false;
        });

        this.slideContainer.addEventListener('touchmove', (e) => {
            if (!isDown) return;
            const x = e.touches[0].pageX - this.slideContainer.offsetLeft;
            const walk = (x - startX) * 2;
            this.slideContainer.scrollLeft = scrollLeft - walk;
        });
    }
}

// Инициализация слайдера
document.addEventListener('DOMContentLoaded', () => {
    new Slider();
});