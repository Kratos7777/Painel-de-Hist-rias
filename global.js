/**
 * GLOBAL.JS - Sistema Central de Potencialização do Portal
 * Este arquivo centraliza toda a lógica compartilhada entre as páginas
 * Inclua este arquivo em todos os HTML: <script src="/global.js"></script>
 */

// =====================
// SISTEMA DE NOTIFICAÇÕES (TOASTS)
// =====================
class NotificationSystem {
    constructor() {
        this.container = null;
        this.init();
    }

    init() {
        if (!document.getElementById('toast-container')) {
            this.container = document.createElement('div');
            this.container.id = 'toast-container';
            this.container.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                z-index: 9999;
                display: flex;
                flex-direction: column;
                gap: 10px;
            `;
            document.body.appendChild(this.container);
        } else {
            this.container = document.getElementById('toast-container');
        }
    }

    show(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        
        const colors = {
            success: { bg: 'rgba(17, 202, 160, 0.2)', border: '#11CAA0', text: '#11CAA0' },
            error: { bg: 'rgba(255, 107, 107, 0.2)', border: '#FF6B6B', text: '#FF6B6B' },
            info: { bg: 'rgba(88, 101, 242, 0.2)', border: '#5865F2', text: '#5865F2' },
            warning: { bg: 'rgba(255, 193, 7, 0.2)', border: '#FFC107', text: '#FFC107' }
        };

        const color = colors[type] || colors.info;

        toast.style.cssText = `
            background: ${color.bg};
            border: 1px solid ${color.border};
            color: ${color.text};
            padding: 15px 20px;
            border-radius: 6px;
            font-weight: bold;
            animation: slideInRight 0.3s ease-out;
            max-width: 300px;
            word-wrap: break-word;
        `;

        toast.textContent = message;
        this.container.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideOutRight 0.3s ease-out';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }
}

// =====================
// SISTEMA DE TEMAS
// =====================
class ThemeSystem {
    constructor() {
        this.currentTheme = localStorage.getItem('tema') || 'dark';
        this.init();
    }

    init() {
        this.applyTheme(this.currentTheme);
        this.addStyleSheet();
    }

    addStyleSheet() {
        if (!document.getElementById('theme-styles')) {
            const style = document.createElement('style');
            style.id = 'theme-styles';
            style.textContent = `
                @keyframes slideInRight {
                    from { opacity: 0; transform: translateX(20px); }
                    to { opacity: 1; transform: translateX(0); }
                }
                @keyframes slideOutRight {
                    from { opacity: 1; transform: translateX(0); }
                    to { opacity: 0; transform: translateX(20px); }
                }
                body.theme-sepia {
                    background: #f4ecd8 !important;
                    color: #5c4033 !important;
                }
                body.theme-sepia .chapter-content {
                    background: #faf6f0 !important;
                    color: #5c4033 !important;
                }
                body.theme-light {
                    background: #ffffff !important;
                    color: #333333 !important;
                }
                body.theme-light .chapter-content {
                    background: #f5f5f5 !important;
                    color: #333333 !important;
                }
            `;
            document.head.appendChild(style);
        }
    }

    applyTheme(theme) {
        this.currentTheme = theme;
        localStorage.setItem('tema', theme);
        
        document.body.classList.remove('theme-dark', 'theme-sepia', 'theme-light');
        document.body.classList.add(`theme-${theme}`);
    }

    toggle() {
        const themes = ['dark', 'light', 'sepia'];
        const currentIndex = themes.indexOf(this.currentTheme);
        const nextTheme = themes[(currentIndex + 1) % themes.length];
        this.applyTheme(nextTheme);
        return nextTheme;
    }
}

// =====================
// SISTEMA DE PREFERÊNCIAS DE LEITURA
// =====================
class ReadingPreferences {
    constructor() {
        this.fontSize = parseInt(localStorage.getItem('fontSize')) || 16;
        this.lineHeight = parseFloat(localStorage.getItem('lineHeight')) || 1.8;
        this.init();
    }

    init() {
        this.applyPreferences();
    }

    applyPreferences() {
        const style = document.getElementById('reading-prefs') || document.createElement('style');
        style.id = 'reading-prefs';
        style.textContent = `
            body {
                font-size: ${this.fontSize}px;
                line-height: ${this.lineHeight};
            }
            .chapter-content {
                font-size: ${this.fontSize}px;
                line-height: ${this.lineHeight};
            }
        `;
        if (!document.getElementById('reading-prefs')) {
            document.head.appendChild(style);
        }
    }

    setFontSize(size) {
        this.fontSize = size;
        localStorage.setItem('fontSize', size);
        this.applyPreferences();
    }

    setLineHeight(height) {
        this.lineHeight = height;
        localStorage.setItem('lineHeight', height);
        this.applyPreferences();
    }
}

// =====================
// SISTEMA DE NAVEGAÇÃO
// =====================
class NavigationSystem {
    constructor() {
        this.setupKeyboardShortcuts();
        this.setupNavbar();
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Seta esquerda = capítulo anterior
            if (e.key === 'ArrowLeft') {
                const btnAnterior = document.getElementById('btn-anterior');
                if (btnAnterior && !btnAnterior.disabled) {
                    btnAnterior.click();
                }
            }
            // Seta direita = próximo capítulo
            if (e.key === 'ArrowRight') {
                const btnProximo = document.getElementById('btn-proximo');
                if (btnProximo && !btnProximo.disabled) {
                    btnProximo.click();
                }
            }
            // T = alternar tema
            if (e.key === 't' && !e.ctrlKey && !e.metaKey) {
                const novoTema = window.themeSystem.toggle();
                window.notify.show(`Tema alterado para: ${novoTema}`, 'info', 2000);
            }
        });
    }

    setupNavbar() {
        // Se a navbar ainda não foi carregada, criar uma dinâmica
        if (!document.querySelector('.navbar')) {
            this.createDynamicNavbar();
        }
    }

    createDynamicNavbar() {
        const navbar = document.createElement('div');
        navbar.className = 'navbar';
        navbar.style.cssText = `
            background: linear-gradient(135deg, #11CAA0 0%, #0a9d7f 100%);
            padding: 15px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);
            flex-wrap: wrap;
            gap: 15px;
            position: sticky;
            top: 0;
            z-index: 100;
        `;

        navbar.innerHTML = `
            <h1 style="color: white; font-size: 1.5rem; margin: 0;">TR: Vida</h1>
            <div class="nav-links" style="display: flex; gap: 10px; flex-wrap: wrap;">
                <a href="/capa" style="color: white; text-decoration: none; padding: 8px 16px; border-radius: 4px; background: rgba(255, 255, 255, 0.1); transition: 0.3s;">📖 Capa</a>
                <a href="/perfil" style="color: white; text-decoration: none; padding: 8px 16px; border-radius: 4px; background: rgba(255, 255, 255, 0.1); transition: 0.3s;">👤 Perfil</a>
                <a href="/configuracoes" style="color: white; text-decoration: none; padding: 8px 16px; border-radius: 4px; background: rgba(255, 255, 255, 0.1); transition: 0.3s;">⚙️ Config</a>
                <a href="/logout" style="color: white; text-decoration: none; padding: 8px 16px; border-radius: 4px; background: rgba(255, 255, 255, 0.1); transition: 0.3s;">Sair</a>
            </div>
        `;

        document.body.insertBefore(navbar, document.body.firstChild);
    }
}

// =====================
// SISTEMA DE CARREGAMENTO
// =====================
class LoadingBar {
    constructor() {
        this.bar = null;
        this.init();
    }

    init() {
        const bar = document.createElement('div');
        bar.id = 'loading-bar';
        bar.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            height: 3px;
            background: linear-gradient(90deg, #11CAA0, #0a9d7f);
            width: 0%;
            z-index: 10000;
            transition: width 0.3s ease;
            box-shadow: 0 0 10px rgba(17, 202, 160, 0.5);
        `;
        document.body.appendChild(bar);
        this.bar = bar;
    }

    start() {
        this.bar.style.width = '30%';
    }

    finish() {
        this.bar.style.width = '100%';
        setTimeout(() => {
            this.bar.style.opacity = '0';
            this.bar.style.transition = 'opacity 0.5s ease';
            setTimeout(() => {
                this.bar.style.width = '0%';
                this.bar.style.opacity = '1';
                this.bar.style.transition = 'width 0.3s ease';
            }, 500);
        }, 300);
    }
}

// =====================
// SISTEMA DE USUÁRIO
// =====================
class UserSystem {
    constructor() {
        this.user = null;
        this.loadUser();
    }

    async loadUser() {
        try {
            const response = await fetch('/api/usuario');
            this.user = await response.json();
            this.updateUserDisplay();
        } catch (e) {
            console.log('Usuário não autenticado');
        }
    }

    updateUserDisplay() {
        if (this.user && this.user.username) {
            const userElements = document.querySelectorAll('[data-user-name]');
            userElements.forEach(el => {
                el.textContent = this.user.username;
            });

            const avatarElements = document.querySelectorAll('[data-user-avatar]');
            avatarElements.forEach(el => {
                el.src = `https://cdn.discordapp.com/avatars/${this.user.id}/${this.user.avatar}.png`;
            });
        }
    }
}

// =====================
// INICIALIZAÇÃO GLOBAL
// =====================
window.notify = new NotificationSystem();
window.themeSystem = new ThemeSystem();
window.readingPrefs = new ReadingPreferences();
window.navigation = new NavigationSystem();
window.loadingBar = new LoadingBar();
window.userSystem = new UserSystem();

// Interceptar mudanças de página
document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="/"]');
    if (link && !link.target) {
        window.loadingBar.start();
    }
});

// Finalizar loading bar quando página carregar
window.addEventListener('load', () => {
    window.loadingBar.finish();
});

console.log('✅ Global.js carregado com sucesso! Sistema potencializado.');