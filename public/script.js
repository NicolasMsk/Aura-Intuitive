/* ═══════════════════════════════════════════════════════
   AURA INTUITIVE — Frontend JS
   Stars, navbar, mobile menu, reveal animations
   ═══════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {

    /* ── Stars ──────────────────────────────────────── */
    const canvas = document.getElementById('starsCanvas');
    if (canvas) {
        const count = Math.min(Math.floor(window.innerWidth * 0.12), 120);
        for (let i = 0; i < count; i++) {
            const star = document.createElement('div');
            star.className = 'star';
            star.style.left = Math.random() * 100 + '%';
            star.style.top = Math.random() * 100 + '%';
            star.style.setProperty('--dur', (3 + Math.random() * 5) + 's');
            star.style.setProperty('--max-op', (0.3 + Math.random() * 0.5).toString());
            star.style.animationDelay = (Math.random() * 6) + 's';
            if (Math.random() > 0.7) {
                star.style.width = '3px';
                star.style.height = '3px';
            }
            canvas.appendChild(star);
        }
    }

    /* ── Navbar scroll ─────────────────────────────── */
    const navbar = document.getElementById('navbar');
    if (navbar) {
        const onScroll = () => {
            navbar.classList.toggle('scrolled', window.scrollY > 50);
        };
        window.addEventListener('scroll', onScroll, { passive: true });
        onScroll();
    }

    /* ── Mobile menu ───────────────────────────────── */
    const toggle = document.getElementById('menuToggle');
    const navLinks = document.getElementById('navLinks');
    if (toggle && navLinks) {
        toggle.addEventListener('click', () => {
            navLinks.classList.toggle('open');
        });
        navLinks.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                navLinks.classList.remove('open');
            });
        });
    }

    /* ── Reveal on scroll ──────────────────────────── */
    const reveals = document.querySelectorAll('.reveal');
    if (reveals.length) {
        const observer = new IntersectionObserver(
            entries => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('visible');
                        observer.unobserve(entry.target);
                    }
                });
            },
            { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
        );
        reveals.forEach(el => observer.observe(el));
    }

    /* ── Smooth scroll for anchor links ────────────── */
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', e => {
            const href = anchor.getAttribute('href');
            if (!href || href === '#') return;
            const target = document.querySelector(href);
            if (target) {
                e.preventDefault();
                target.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });
});
