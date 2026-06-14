Substitui inteiro o global.js no VS Code.

/**
 * ==============================================================================
 * GLOBAL.JS - Sistema Central do Portal de Histórias
 * Versão: 12.0.0 - Edição Expandida
 * ==============================================================================
 * Centraliza notificações, temas, atalhos, barra de progresso e usuário.
 * Inclua em todas as páginas: <script src="/global.js"></script>
 * ==============================================================================
 */

(function () {
    'use strict';

    // =====================================================================
    // SISTEMA DE NOTIFICAÇÕES (TOASTS)
    // =====================================================================
    class NotificationSystem {
        constructor() {
            this.container = null;
            this.init();
        }

        init() {
            if (document.getElementById('toast-container')) {
                this.container = document.getElementById('toast-container');
                return;
            }
            this.container = document.createElement('div');
            this.container.id = 'toast-container';
            this.container.setAttribute('role', 'status');
            this.container.setAttribute('aria-live', 'polite');
            this.container.style.cssText = `
                position: fixed; bottom: 20px; right: 20px; z-index: 9999;
                display: flex; flex-direction: column; gap: 10px; pointer-events: none;
            `;
            (document.body || document.documentElement).appendChild(this.container);
        }

        show(message, type = 'info', duration = 3000) {
            if (!this.container) this.init();

            const palette = {
                success: { bg: 'rgba(17, 202, 160, 0.18)', border: '#11CAA0', text: '#11CAA0', icon: '✅' },
                error:   { bg: 'rgba(255, 107, 107, 0.18)', border: '#FF6B6B', text: '#FF6B6B', icon: '❌' },
                info:    { bg: 'rgba(88, 101, 242, 0.18)', border: '#5865F2', text: '#A8B0FF', icon: 'ℹ️' },
                warning: { bg: 'rgba(255, 193, 7, 0.18)',  border: '#FFC107', text: '#FFD54F', icon: '⚠️' }
            };

            const c = palette[type] || palette.info;
            const toast = document.createElement('div');
            toast.style.cssText = `
                background: ${c.bg}; border: 1px solid ${c.border}; color: ${c.text};
                padding: 14px 20px; border-radius: 8px; font-weight: 600;
                animation: toastSlideIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
                max-width: 320px; word-wrap: break-word; pointer-events: auto;
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3); display: flex; align-items: center; gap: 10px;
                backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
            `;
            toast.innerHTML = `<span style="font-size:1.1rem;">${c.icon}</span><span>${this.escapeHtml(message)}</span>`;
            this.container.appendChild(toast);

            setTimeout(() => {
                toast.style.animation = 'toastSlideOut 0.3s ease-out forwards';
                setTimeout(() => toast.remove(), 320);
            }, duration);
        }

        escapeHtml(str) {
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        }
    }

    // =====================================================================
    // SISTEMA DE TEMAS (escuro, claro, sépia)
    // =====================================================================
    class ThemeSystem {
        constructor() {
            this.themes = ['dark', 'light', 'sepia'];
            this.currentTheme = localStorage.getItem('tema') || 'dark';
            this.init();
        }

        init() {
            this.injectStyles();
            this.applyTheme(this.currentTheme);
        }

        injectStyles() {
            if (document.getElementById('theme-styles')) return;
            const style = document.createElement('style');
            style.id = 'theme-styles';
            style.textContent = `
                @keyframes toastSlideIn { from { opacity:0; transform:translateX(40px) scale(0.9); } to { opacity:1; transform:translateX(0) scale(1); } }
                @keyframes toastSlideOut { from { opacity:1; transform:translateX(0); } to { opacity:0; transform:translateX(40px); } }
                @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
                body.theme-sepia { background:#f4ecd8 !important; color:#5c4033 !important; }
                body.theme-sepia .chapter-content { background:#faf6f0 !important; color:#5c4033 !important; }
                body.theme-light { background:#ffffff !important; color:#222 !important; }
                body.theme-light .chapter-content { background:#f5f5f5 !important; color:#222 !important; }
                ::selection { background:rgba(17,202,160,0.4); color:#fff; }
            `;
            document.head.appendChild(style);
        }

        applyTheme(theme) {
            if (!this.themes.includes(theme)) theme = 'dark';
            this.currentTheme = theme;
            localStorage.setItem('tema', theme);
            document.body.classList.remove('theme-dark', 'theme-light', 'theme-sepia');
            document.body.classList.add(`theme-${theme}`);
        }

        toggle() {
            const idx = this.themes.indexOf(this.currentTheme);
            const next = this.themes[(idx + 1) % this.themes.length];
            this.applyTheme(next);
            return next;
        }
    }

    // =====================================================================
    // SISTEMA DE PREFERÊNCIAS DE LEITURA
    // =====================================================================
    class ReadingPreferences {
        constructor() {
            this.fontSize = parseInt(localStorage.getItem('fontSize')) || 16;
            this.lineHeight = parseFloat(localStorage.getItem('lineHeight')) || 1.8;
            this.apply();
        }

        apply() {
            let style = document.getElementById('reading-prefs');
            if (!style) {
                style = document.createElement('style');
                style.id = 'reading-prefs';
                document.head.appendChild(style);
            }
            style.textContent = `
                body { font-size:${this.fontSize}px; line-height:${this.lineHeight}; }
                .chapter-content { font-size:${this.fontSize}px; line-height:${this.lineHeight}; }
            `;
        }

        setFontSize(size) {
            this.fontSize = Math.max(12, Math.min(28, parseInt(size) || 16));
            localStorage.setItem('fontSize', this.fontSize);
            this.apply();
        }

        setLineHeight(height) {
            this.lineHeight = Math.max(1.2, Math.min(3, parseFloat(height) || 1.8));
            localStorage.setItem('lineHeight', this.lineHeight);
            this.apply();
        }
    }

    // =====================================================================
    // ATALHOS DE TECLADO E NAVEGAÇÃO
    // =====================================================================
    class NavigationSystem {
        constructor() {
            this.setupKeyboardShortcuts();
        }

        setupKeyboardShortcuts() {
            document.addEventListener('keydown', (e) => {
                const tag = (e.target && e.target.tagName) || '';
                const isEditable = ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) ||
                                   (e.target && e.target.isContentEditable);
                if (isEditable) return;

                if (e.key === 'ArrowLeft') this.clickIfExists('btn-anterior');
                if (e.key === 'ArrowRight') this.clickIfExists('btn-proximo');
                if (e.key === 't' && !e.ctrlKey && !e.metaKey && !e.altKey) {
                    const novo = window.themeSystem.toggle();
                    window.notify.show(`Tema: ${novo}`, 'info', 1800);
                }
                if (e.key === '?' && !e.shiftKey === false) this.showShortcuts();
            });
        }

        clickIfExists(id) {
            const btn = document.getElementById(id);
            if (btn && !btn.disabled) btn.click();
        }

        showShortcuts() {
            window.notify.show('← → navega capítulos · T muda tema', 'info', 4000);
        }
    }

    // =====================================================================
    // BARRA DE CARREGAMENTO
    // =====================================================================
    class LoadingBar {
        constructor() {
            this.bar = document.createElement('div');
            this.bar.id = 'loading-bar';
            this.bar.style.cssText = `
                position: fixed; top: 0; left: 0; height: 3px;
                background: linear-gradient(90deg, #11CAA0, #0a9d7f);
                width: 0%; z-index: 10000; transition: width 0.3s ease;
                box-shadow: 0 0 12px rgba(17, 202, 160, 0.6);
            `;
            (document.body || document.documentElement).appendChild(this.bar);
        }

        start() { this.bar.style.width = '35%'; }

        finish() {
            this.bar.style.width = '100%';
            setTimeout(() => {
                this.bar.style.opacity = '0';
                this.bar.style.transition = 'opacity 0.4s ease';
                setTimeout(() => {
                    this.bar.style.width = '0%';
                    this.bar.style.opacity = '1';
                    this.bar.style.transition = 'width 0.3s ease';
                }, 400);
            }, 250);
        }
    }

    // =====================================================================
    // BOTÃO "VOLTAR AO TOPO"
    // =====================================================================
    class ScrollToTop {
        constructor() {
            this.btn = document.createElement('button');
            this.btn.setAttribute('aria-label', 'Voltar ao topo');
            this.btn.innerHTML = '↑';
            this.btn.style.cssText = `
                position: fixed; bottom: 20px; left: 20px; z-index: 9998;
                width: 48px; height: 48px; border-radius: 50%; border: none;
                background: linear-gradient(135deg, #11CAA0, #0a9d7f); color: #121212;
                font-size: 1.4rem; font-weight: bold; cursor: pointer; opacity: 0;
                transform: translateY(20px); pointer-events: none;
                transition: opacity 0.3s ease, transform 0.3s ease;
                box-shadow: 0 6px 16px rgba(17, 202, 160, 0.4);
            `;
            this.btn.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
            (document.body || document.documentElement).appendChild(this.btn);
            window.addEventListener('scroll', () => this.update(), { passive: true });
        }

        update() {
            const show = window.scrollY > 400;
            this.btn.style.opacity = show ? '1' : '0';
            this.btn.style.transform = show ? 'translateY(0)' : 'translateY(20px)';
            this.btn.style.pointerEvents = show ? 'auto' : 'none';
        }
    }

    // =====================================================================
    // SISTEMA DE USUÁRIO
    // =====================================================================
    class UserSystem {
        constructor() {
            this.user = null;
            this.load();
        }

        async load() {
            try {
                const r = await fetch('/api/user');
                if (!r.ok) return;
                this.user = await r.json();
                this.render();
            } catch (e) {
                console.log('[UserSystem] Não autenticado');
            }
        }

        render() {
            if (!this.user || !this.user.username) return;
            document.querySelectorAll('[data-user-name]').forEach(el => {
                el.textContent = this.user.username;
            });
            document.querySelectorAll('[data-user-avatar]').forEach(el => {
                el.src = this.user.avatar;
                el.alt = `Avatar de ${this.user.username}`;
            });
            if (this.user.isAdmin) {
                document.querySelectorAll('[data-admin-only]').forEach(el => {
                    el.style.display = '';
                });
            }
        }
    }

    // =====================================================================
    // INICIALIZAÇÃO GLOBAL
    // =====================================================================
    function boot() {
        window.notify = new NotificationSystem();
        window.themeSystem = new ThemeSystem();
        window.readingPrefs = new ReadingPreferences();
        window.navigation = new NavigationSystem();
        window.loadingBar = new LoadingBar();
        window.scrollToTop = new ScrollToTop();
        window.userSystem = new UserSystem();

        document.addEventListener('click', (e) => {
            const link = e.target.closest('a[href^="/"]');
            if (link && !link.target && !link.hasAttribute('download')) {
                window.loadingBar.start();
            }
        });

        window.addEventListener('load', () => window.loadingBar.finish());
        console.log('%c✅ Global.js v12.0.0 carregado', 'color:#11CAA0;font-weight:bold;');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();