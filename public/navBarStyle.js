const primaryNav = document.querySelector('.primary-navigation');
const navToggle = document.querySelector('.mobile-nav-toggle');
const menuBtn = document.querySelector('.menu-btn'); //.mobile-nav-toggle

navToggle.addEventListener('click', () => {
    const isVisible = primaryNav.dataset.visible === 'true';
    primaryNav.dataset.visible = !isVisible;
    navToggle.setAttribute('aria-expanded', !isVisible);
    menuBtn.classList.toggle('open');
});

