// Landing page content and interactions

document.addEventListener('DOMContentLoaded', async () => {
    const FEATURE_ICONS = {
        invoice: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>',
        inventory: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>',
        delivery: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>',
        analytics: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>',
        users: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
        returns: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>'
    };

    const FLOATING_ICONS = {
        trend: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>',
        check: '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>'
    };

    async function loadLandingContent() {
        return null;
    }

    function setText(id, value) {
        const element = document.getElementById(id);
        if (element && value !== undefined && value !== null) {
            element.textContent = String(value);
        }
    }

    function setHtml(id, value) {
        const element = document.getElementById(id);
        if (element && value !== undefined && value !== null) {
            element.innerHTML = String(value);
        }
    }

    function setLink(id, config) {
        const element = document.getElementById(id);
        if (!element || !config || typeof config !== 'object') return;
        if (config.href) element.setAttribute('href', config.href);
        if (config.label) {
            const labelNode = Array.from(element.childNodes).find(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
            if (labelNode) {
                labelNode.textContent = `${config.label} `;
            } else {
                element.textContent = config.label;
            }
        }
    }

    function renderNavLinks(items) {
        const container = document.getElementById('navLinks');
        if (!container || !Array.isArray(items) || !items.length) return;
        container.innerHTML = items.map(item => `
            <a href="${item.href || '#'}" class="nav-link">${item.label || 'Link'}</a>
        `).join('');
    }

    function renderFeatures(items) {
        const container = document.getElementById('featuresGrid');
        if (!container || !Array.isArray(items) || !items.length) return;
        container.innerHTML = items.map(item => `
            <div class="feature-card">
                <div class="feature-icon">${FEATURE_ICONS[item.icon] || FEATURE_ICONS.invoice}</div>
                <h3>${item.title || 'Feature'}</h3>
                <p>${item.description || ''}</p>
            </div>
        `).join('');
    }

    function renderStats(items) {
        const container = document.getElementById('statsRow');
        if (!container || !Array.isArray(items) || !items.length) return;
        container.innerHTML = items.map((item, index) => `
            <div class="stat-item">
                <span class="stat-number" data-target="${Number(item.value) || 0}">0</span>
                <span class="stat-suffix">${item.suffix || ''}</span>
                <span class="stat-label">${item.label || ''}</span>
            </div>
            ${index < items.length - 1 ? '<div class="stat-divider"></div>' : ''}
        `).join('');
    }

    function renderSteps(items) {
        const container = document.getElementById('stepsGrid');
        if (!container || !Array.isArray(items) || !items.length) return;
        container.innerHTML = items.map((item, index) => `
            <div class="step-card">
                <div class="step-number">${item.number || String(index + 1).padStart(2, '0')}</div>
                <div class="step-content">
                    <h3>${item.title || 'Step'}</h3>
                    <p>${item.description || ''}</p>
                </div>
                ${index < items.length - 1 ? '<div class="step-connector"></div>' : ''}
            </div>
        `).join('');
    }

    function renderTestimonials(items) {
        const container = document.getElementById('testimonialsGrid');
        if (!container || !Array.isArray(items) || !items.length) return;
        container.innerHTML = items.map(item => `
            <div class="testimonial-card ${item.featured ? 'featured' : ''}">
                <div class="testimonial-stars">★★★★★</div>
                <p class="testimonial-text">"${item.quote || ''}"</p>
                <div class="testimonial-author">
                    <div class="author-avatar">${item.avatar || 'BB'}</div>
                    <div class="author-info">
                        <span class="author-name">${item.name || 'Customer'}</span>
                        <span class="author-role">${item.role || ''}</span>
                    </div>
                </div>
            </div>
        `).join('');
    }

    function renderFooterColumns(columns) {
        const container = document.getElementById('footerColumns');
        if (!container || !Array.isArray(columns) || !columns.length) return;
        container.innerHTML = columns.map(column => `
            <div class="footer-col">
                <h4>${column.title || ''}</h4>
                ${(column.links || []).map(link => `<a href="${link.href || '#'}">${link.label || 'Link'}</a>`).join('')}
            </div>
        `).join('');
    }

    function renderFooterLegalLinks(links) {
        const container = document.getElementById('footerLegalLinks');
        if (!container || !Array.isArray(links) || !links.length) return;
        container.innerHTML = links.map(link => `<a href="${link.href || '#'}">${link.label || 'Link'}</a>`).join('');
    }

    function hydrateLandingContent(data) {
        if (data.meta) {
            if (data.meta.title) document.title = data.meta.title;
            const metaDescription = document.querySelector('meta[name="description"]');
            if (metaDescription && data.meta.description) {
                metaDescription.setAttribute('content', data.meta.description);
            }
        }

        if (data.navigation) {
            renderNavLinks(data.navigation.links);
            setLink('navSignInBtn', data.navigation.signIn);
            setLink('navPrimaryBtn', data.navigation.cta);
        }

        if (data.hero) {
            setText('heroBadgeText', data.hero.badge);
            if (Array.isArray(data.hero.titleLines)) {
                setText('heroTitleLine1', data.hero.titleLines[0] || '');
                setText('heroTitleLine2', data.hero.titleLines[1] || '');
            }
            setText('heroSubtitle', data.hero.subtitle);
            setLink('heroPrimaryBtn', data.hero.primaryCta);
            setLink('heroSecondaryBtn', data.hero.secondaryCta);

            if (data.hero.preview) {
                setText('previewUrl', data.hero.preview.url);
                const previewStats = Array.isArray(data.hero.preview.stats) ? data.hero.preview.stats : [];
                setText('previewStatLabel1', previewStats[0] && previewStats[0].label);
                setText('previewStatValue1', previewStats[0] && previewStats[0].value);
                setText('previewStatLabel2', previewStats[1] && previewStats[1].label);
                setText('previewStatValue2', previewStats[1] && previewStats[1].value);
                setText('previewStatLabel3', previewStats[2] && previewStats[2].label);
                setText('previewStatValue3', previewStats[2] && previewStats[2].value);
            }

            const floatingCards = Array.isArray(data.hero.floatingCards) ? data.hero.floatingCards : [];
            if (floatingCards[0]) {
                setText('floatCardLabel1', floatingCards[0].label);
                setText('floatCardValue1', floatingCards[0].value);
                setHtml('floatCardIcon1', FLOATING_ICONS[floatingCards[0].icon] || FLOATING_ICONS.trend);
                document.getElementById('floatCardIcon1')?.classList.toggle('blue', floatingCards[0].tone === 'blue');
                document.getElementById('floatCardIcon1')?.classList.toggle('green', floatingCards[0].tone !== 'blue');
            }
            if (floatingCards[1]) {
                setText('floatCardLabel2', floatingCards[1].label);
                setText('floatCardValue2', floatingCards[1].value);
                setHtml('floatCardIcon2', FLOATING_ICONS[floatingCards[1].icon] || FLOATING_ICONS.check);
                document.getElementById('floatCardIcon2')?.classList.toggle('green', floatingCards[1].tone === 'green');
                document.getElementById('floatCardIcon2')?.classList.toggle('blue', floatingCards[1].tone !== 'green');
            }
        }

        if (data.features) {
            setText('featuresTag', data.features.tag);
            setText('featuresTitle', data.features.title);
            setText('featuresDesc', data.features.description);
            renderFeatures(data.features.items);
        }

        renderStats(data.stats);

        if (data.howItWorks) {
            setText('howTag', data.howItWorks.tag);
            setText('howTitle', data.howItWorks.title);
            setText('howDesc', data.howItWorks.description);
            renderSteps(data.howItWorks.steps);
        }

        if (data.testimonials) {
            setText('testimonialsTag', data.testimonials.tag);
            setText('testimonialsTitle', data.testimonials.title);
            setText('testimonialsDesc', data.testimonials.description);
            renderTestimonials(data.testimonials.items);
        }

        if (data.cta) {
            setText('ctaTitle', data.cta.title);
            setText('ctaDesc', data.cta.description);
            setText('ctaNote', data.cta.note);
            setLink('ctaPrimaryBtn', data.cta.primaryCta);
        }

        if (data.footer) {
            setText('footerTagline', data.footer.tagline);
            renderFooterColumns(data.footer.columns);
            setText('footerBottomText', data.footer.bottomText);
            renderFooterLegalLinks(data.footer.legalLinks);
        }
    }

    const landingContent = await loadLandingContent();
    if (landingContent) {
        hydrateLandingContent(landingContent);
    }

    const navbar = document.getElementById('navbar');
    const scrollThreshold = 50;

    function handleScroll() {
        if (!navbar) return;
        if (window.scrollY > scrollThreshold) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    }

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    const mobileToggle = document.getElementById('mobileToggle');
    const navLinks = document.getElementById('navLinks');

    if (mobileToggle && navLinks) {
        mobileToggle.addEventListener('click', () => {
            navLinks.classList.toggle('open');
            document.body.style.overflow = navLinks.classList.contains('open') ? 'hidden' : '';
        });

        navLinks.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', () => {
                navLinks.classList.remove('open');
                document.body.style.overflow = '';
            });
        });
    }

    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', (e) => {
            const target = document.querySelector(anchor.getAttribute('href'));
            if (!target) return;
            e.preventDefault();
            const offset = 80;
            const top = target.getBoundingClientRect().top + window.pageYOffset - offset;
            window.scrollTo({ top, behavior: 'smooth' });
        });
    });

    const revealElements = document.querySelectorAll(
        '.feature-card, .step-card, .testimonial-card, .stat-item, .section-header, .cta-card'
    );

    revealElements.forEach(el => el.classList.add('reveal'));

    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                revealObserver.unobserve(entry.target);
            }
        });
    }, {
        threshold: 0.12,
        rootMargin: '0px 0px -40px 0px'
    });

    revealElements.forEach(el => revealObserver.observe(el));

    const statNumbers = document.querySelectorAll('.stat-number[data-target]');

    function animateCounter(el) {
        const target = parseInt(el.getAttribute('data-target'), 10);
        const duration = 2000;
        const start = performance.now();

        function formatNumber(n) {
            if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
            if (n >= 1000) return (n / 1000).toFixed(0) + 'K';
            return n.toString();
        }

        function step(timestamp) {
            const elapsed = timestamp - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = Math.floor(eased * target);
            el.textContent = formatNumber(current);
            if (progress < 1) {
                requestAnimationFrame(step);
            } else {
                el.textContent = formatNumber(target);
            }
        }

        requestAnimationFrame(step);
    }

    const statsObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                animateCounter(entry.target);
                statsObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });

    statNumbers.forEach(el => statsObserver.observe(el));
});
