
//📄 Arquivo 1 de 9: server.js
//Substitui inteiro o server.js no VS Code (Ctrl+A → cola → Ctrl+S).

/**
 * ==============================================================================
 * 🚀 PORTAL DE HISTÓRIAS - SISTEMA ULTRA PREMIUM (SERVER.JS)
 * ==============================================================================
 * Versão: 12.0.0 - Edição Expandida
 * Stack: Node.js + Express + Passport (Discord OAuth2)
 * Hospedagem alvo: Render.com (com fallback local)
 * ==============================================================================
 */

require('dotenv').config();

const express = require('express');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');

const app = express();

// ==========================================
// 🛠️ 1. CONFIGURAÇÕES INICIAIS
// ==========================================
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const APP_VERSION = '12.0.0';
const APP_NAME = 'Portal de Histórias - TR: Vida';

// Limpa variáveis de ambiente (remove aspas, espaços extras e quebras de linha)
const cleanEnv = (val) => {
    if (!val) return null;
    return String(val).trim().replace(/^['"]|['"]$/g, '');
};

const CLIENT_ID = cleanEnv(process.env.CLIENT_ID);
const CLIENT_SECRET = cleanEnv(process.env.CLIENT_SECRET);
const CALLBACK_URL = cleanEnv(process.env.REDIRECT_URI) || cleanEnv(process.env.CALLBACK_URL);
const DISCORD_ADMIN_ID = cleanEnv(process.env.DISCORD_ID);
const SESSION_SECRET = cleanEnv(process.env.SESSION_SECRET) || 'portal_historias_super_secret_2026';
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(PUBLIC_DIR, 'data');
const IMAGES_DIR = path.join(PUBLIC_DIR, 'imagens');

// Garante diretórios necessários
[DATA_DIR, IMAGES_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Banner de inicialização
console.log('\n' + '='.repeat(60));
console.log(`🌟 ${APP_NAME}`);
console.log(`🔖 Versão: ${APP_VERSION}`);
console.log('='.repeat(60));
console.log(`📡 Ambiente:        ${NODE_ENV.toUpperCase()}`);
console.log(`🔌 Porta:           ${PORT}`);
console.log(`🆔 Client ID:       ${CLIENT_ID ? CLIENT_ID.substring(0, 6) + '...' : '❌ NÃO DEFINIDO'}`);
console.log(`🔗 Redirect URI:    ${CALLBACK_URL || '❌ NÃO DEFINIDO'}`);
console.log(`👑 Admin Discord:   ${DISCORD_ADMIN_ID ? DISCORD_ADMIN_ID.substring(0, 6) + '...' : '❌ NÃO DEFINIDO'}`);
console.log(`📂 Pasta de dados:  ${DATA_DIR}`);
console.log('='.repeat(60) + '\n');

// ==========================================
// 🛡️ 2. MIDDLEWARES GLOBAIS
// ==========================================
app.set('trust proxy', 1); // Render usa proxy reverso HTTPS
app.disable('x-powered-by'); // Remove header que entrega que é Express

app.use(compression());
app.use(morgan(NODE_ENV === 'production' ? 'tiny' : 'dev'));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser(SESSION_SECRET));

app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginEmbedderPolicy: false
}));

// Identificador único de requisição (útil pra debug no Render)
app.use((req, res, next) => {
    req.requestId = Math.random().toString(36).slice(2, 10);
    res.setHeader('X-Request-Id', req.requestId);
    next();
});

// ==========================================
// 🔑 3. SESSÃO E PASSPORT
// ==========================================
app.use(session({
    secret: SESSION_SECRET,
    resave: true,
    saveUninitialized: false,
    name: 'portal_historias.sid',
    cookie: {
        httpOnly: true,
        secure: NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 * 24 * 30 // 30 dias
    }
}));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

if (CLIENT_ID && CLIENT_SECRET && CALLBACK_URL) {
    passport.use(new DiscordStrategy({
        clientID: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
        callbackURL: CALLBACK_URL,
        scope: ['identify', 'email']
    }, (accessToken, refreshToken, profile, done) => {
        profile.isAdmin = (profile.id === DISCORD_ADMIN_ID);
        profile.loginTime = new Date().toISOString();
        console.log(`[AUTH] ${profile.username} (${profile.id})${profile.isAdmin ? ' 👑' : ''}`);
        return done(null, profile);
    }));
} else {
    console.error('❌ ERRO: Variáveis do Discord não configuradas!');
    console.error('   Necessárias: CLIENT_ID, CLIENT_SECRET, REDIRECT_URI');
}

app.use(passport.initialize());
app.use(passport.session());

// ==========================================
// 🚪 4. AUTENTICAÇÃO (com aliases pra qualquer URL)
// ==========================================
const startDiscordAuth = (req, res, next) => {
    console.log(`[AUTH] Iniciando login via ${req.path} (req:${req.requestId})`);
    passport.authenticate('discord')(req, res, next);
};

// Todas estas rotas iniciam o login com Discord
['/auth/discord', '/login', '/entrar', '/signin', '/sign-in', '/discord'].forEach(route => {
    app.get(route, startDiscordAuth);
});

app.get('/auth/discord/callback', (req, res, next) => {
    passport.authenticate('discord', (err, user) => {
        if (err) {
            console.error(`[AUTH] Erro (req:${req.requestId}):`, err.message);
            return res.status(500).send(renderAuthError(err.message));
        }
        if (!user) {
            console.warn(`[AUTH] Login cancelado (req:${req.requestId})`);
            return res.redirect('/');
        }
        req.logIn(user, (loginErr) => {
            if (loginErr) return next(loginErr);
            console.log(`[AUTH] ✅ ${user.username} entrou`);
            req.session.save(() => res.redirect('/funcionalidades'));
        });
    })(req, res, next);
});

app.get('/logout', (req, res) => {
    const username = req.user ? req.user.username : 'anônimo';
    req.logout(() => {
        req.session.destroy(() => {
            res.clearCookie('portal_historias.sid');
            console.log(`[AUTH] 👋 ${username} saiu`);
            res.redirect('/');
        });
    });
});

// Página HTML de erro de autenticação
function renderAuthError(message) {
    return `
        <!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
        <title>Erro de Autenticação</title></head>
        <body style="font-family:'Segoe UI',sans-serif;background:#0f1115;color:white;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;margin:0;">
            <div style="max-width:600px;text-align:center;background:#181c25;padding:40px;border-radius:12px;border-left:5px solid #ff4757;">
                <h1 style="color:#ff4757;margin-bottom:20px;">⚠️ Erro na Conexão com Discord</h1>
                <p style="color:#a4b0be;margin-bottom:20px;">Algo deu errado ao validar sua conta. Geralmente é erro na Redirect URI ou Client Secret.</p>
                <code style="display:block;background:#0f1115;color:#ffa502;padding:15px;border-radius:6px;margin-bottom:25px;text-align:left;">${message}</code>
                <a href="/" style="background:#5865F2;color:white;padding:12px 28px;text-decoration:none;border-radius:6px;font-weight:bold;">Tentar Novamente</a>
            </div>
        </body></html>`;
}

// ==========================================
// 🛡️ 5. MIDDLEWARES DE PROTEÇÃO
// ==========================================
const isAuth = (req, res, next) => {
    if (req.isAuthenticated()) return next();
    if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Não autenticado.' });
    res.redirect('/');
};

const isAdmin = (req, res, next) => {
    if (req.isAuthenticated() && req.user.id === DISCORD_ADMIN_ID) return next();
    if (req.path.startsWith('/api/')) return res.status(403).json({ error: 'Permissão negada.' });
    res.status(403).send('🚫 Acesso restrito ao autor da obra.');
};

// ==========================================
// 📄 6. ROTAS DE PÁGINAS HTML
// ==========================================
const pages = {
    '/': 'index.html',
    '/funcionalidades': 'funcionalidades.html',
    '/capa': 'capa.html',
    '/perfil': 'perfil.html',
    '/configuracoes': 'configuracoes.html'
};

function enviarPagina(res, nomeArquivo) {
    const filePath = path.join(PUBLIC_DIR, nomeArquivo);
    if (!fs.existsSync(filePath)) {
        console.error(`[PAGINA] ❌ Arquivo não encontrado: ${filePath}`);
        return res.status(500).send(
            `<h1>Erro 500</h1><p>Arquivo <code>${nomeArquivo}</code> não foi enviado para o servidor.</p>`
        );
    }
    res.sendFile(filePath, (err) => {
        if (err) console.error(`[PAGINA] Erro ao enviar ${nomeArquivo}:`, err.message);
    });
}

app.get('/', (req, res) => {
    if (req.isAuthenticated()) return res.redirect('/funcionalidades');
    enviarPagina(res, pages['/']);
});

Object.entries(pages).forEach(([route, file]) => {
    if (route === '/') return;
    app.get(route, isAuth, (req, res) => enviarPagina(res, file));
});

app.get('/trvida/:numero', isAuth, (req, res) => {
    enviarPagina(res, 'capitulo.html');
});

app.get('/dashboard', isAdmin, (req, res) => {
    enviarPagina(res, 'dashboard.html');
});

app.get('/editor', isAdmin, (req, res) => {
    enviarPagina(res, 'editor.html');
});

// ==========================================
// 📊 7. API
// ==========================================
function buildAvatarUrl(user) {
    return user.avatar
        ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=256`
        : 'https://cdn.discordapp.com/embed/avatars/0.png';
}

function listarCapitulos() {
    const arquivos = fs.readdirSync(DATA_DIR).filter(f => /^trvida\d+\.txt$/.test(f));
    return arquivos.map(f => {
        const numero = parseInt(f.replace(/\D/g, ''), 10);
        const stats = fs.statSync(path.join(DATA_DIR, f));
        return {
            numero,
            postadoEm: stats.mtime,
            tamanho: (stats.size / 1024).toFixed(1) + ' KB',
            palavras: estimarPalavras(path.join(DATA_DIR, f))
        };
    }).sort((a, b) => a.numero - b.numero);
}

function estimarPalavras(filePath) {
    try {
        const txt = fs.readFileSync(filePath, 'utf8');
        return txt.trim().split(/\s+/).filter(Boolean).length;
    } catch { return 0; }
}

app.get('/api/user', (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: 'Não autenticado' });
    res.json({
        id: req.user.id,
        username: req.user.username,
        avatar: buildAvatarUrl(req.user),
        isAdmin: req.user.id === DISCORD_ADMIN_ID,
        loginTime: req.user.loginTime
    });
});

app.get('/api/capitulos', isAuth, (req, res) => {
    try {
        res.json(listarCapitulos());
    } catch (err) {
        console.error('[API] Erro listar:', err);
        res.status(500).json({ error: 'Erro ao buscar capítulos.' });
    }
});

app.get('/api/capitulo/:numero', isAuth, (req, res) => {
    const numero = parseInt(req.params.numero, 10);
    if (isNaN(numero) || numero < 1) return res.status(400).json({ error: 'Número inválido.' });
    const filePath = path.join(DATA_DIR, `trvida${numero}.txt`);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Capítulo ainda não postado.' });
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) return res.status(500).json({ error: 'Erro na leitura.' });
        res.json({ numero, conteudo: data, palavras: data.trim().split(/\s+/).filter(Boolean).length });
    });
});

app.post('/api/salvar-capitulo', isAdmin, (req, res) => {
    const { numero, conteudo } = req.body;
    if (!numero || !conteudo) return res.status(400).json({ error: 'Número e conteúdo obrigatórios.' });
    const num = parseInt(numero, 10);
    if (isNaN(num) || num < 1) return res.status(400).json({ error: 'Número inválido.' });
    fs.writeFile(path.join(DATA_DIR, `trvida${num}.txt`), String(conteudo), 'utf8', (err) => {
        if (err) return res.status(500).json({ error: 'Erro ao salvar.' });
        console.log(`[EDITOR] Cap. ${num} salvo por ${req.user.username}`);
        res.json({ success: true, message: `Capítulo ${num} salvo com sucesso!` });
    });
});

app.delete('/api/capitulo/:numero', isAdmin, (req, res) => {
    const num = parseInt(req.params.numero, 10);
    const filePath = path.join(DATA_DIR, `trvida${num}.txt`);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'Capítulo não encontrado.' });
    fs.unlinkSync(filePath);
    console.log(`[EDITOR] Cap. ${num} deletado por ${req.user.username}`);
    res.json({ success: true, message: `Capítulo ${num} excluído.` });
});

app.get('/api/stats', isAuth, (req, res) => {
    const capitulos = listarCapitulos();
    const totalPalavras = capitulos.reduce((acc, c) => acc + c.palavras, 0);
    res.json({
        totalCapitulos: capitulos.length,
        totalPalavras,
        tempoLeituraEstimado: Math.ceil(totalPalavras / 200) + ' min',
        ultimoPublicado: capitulos.length > 0 ? capitulos[capitulos.length - 1].postadoEm : null,
        versao: APP_VERSION
    });
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', version: APP_VERSION, uptime: Math.round(process.uptime()) + 's' });
});

// ==========================================
// 📂 8. ARQUIVOS ESTÁTICOS + SEGURANÇA
// ==========================================
const SENSITIVE = new Set([
    '/server.js', '/package.json', '/package-lock.json', '/yarn.lock',
    '/.env', '/.env.local', '/.env.production', '/.gitignore',
    '/readme.md', '/funcionalidades_global.md'
]);

app.use((req, res, next) => {
    if (SENSITIVE.has(req.path.toLowerCase())) return res.status(404).send('Não encontrado.');
    next();
});

app.use((err, req, res, next) => {
    console.error(`[ERRO] (req:${req.requestId}) ${req.method} ${req.path}`);
    console.error(`  Mensagem: ${err.message}`);
    console.error(`  Código:   ${err.code || 'N/A'}`);
    console.error(`  Stack:`, err.stack);
    res.status(500).json({
        error: 'Erro interno no servidor.',
        requestId: req.requestId,
        ...(NODE_ENV !== 'production' && { message: err.message, code: err.code, path: req.path })
    });
});
// Página 404 customizada e útil
app.use((req, res) => {
    res.status(404).send(`
        <!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><title>404 - Não Encontrado</title></head>
        <body style="font-family:'Segoe UI',sans-serif;background:#0f1115;color:white;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;margin:0;text-align:center;">
            <div style="max-width:500px;">
                <h1 style="font-size:120px;color:#11CAA0;margin:0;line-height:1;text-shadow:0 0 30px rgba(17,202,160,0.3);">404</h1>
                <h2 style="margin:10px 0 20px;">Página não encontrada</h2>
                <p style="color:#A0A0A0;margin-bottom:30px;">A página <code style="color:#FFC107;background:#181c25;padding:4px 8px;border-radius:4px;">${req.path}</code> não existe neste portal.</p>
                <div>
                    <a href="/" style="display:inline-block;background:#11CAA0;color:#121212;padding:12px 28px;text-decoration:none;border-radius:6px;font-weight:bold;margin:5px;">🏠 Voltar ao Início</a>
                    <a href="/auth/discord" style="display:inline-block;background:#5865F2;color:white;padding:12px 28px;text-decoration:none;border-radius:6px;font-weight:bold;margin:5px;">🎮 Entrar com Discord</a>
                </div>
            </div>
        </body></html>`);
});

// Tratamento global de erros não capturados
app.use((err, req, res, next) => {
    console.error(`[ERRO] (req:${req.requestId})`, err.stack);
    res.status(500).json({ error: 'Erro interno no servidor.', requestId: req.requestId });
});

// ==========================================
// 🚀 9. INICIALIZAÇÃO E SHUTDOWN GRACIOSO
// ==========================================
const server = app.listen(PORT, () => {
    console.log(`✅ SERVIDOR v${APP_VERSION} ATIVO em http://localhost:${PORT}`);
    console.log(`🚀 Aliases de login: /auth/discord, /login, /entrar, /signin, /sign-in, /discord\n`);
});

process.on('SIGTERM', () => {
    console.log('\n[SHUTDOWN] Encerrando servidor com graça...');
    server.close(() => process.exit(0));
});

process.on('uncaughtException', (err) => console.error('[FATAL]', err));
process.on('unhandledRejection', (err) => console.error('[PROMISE REJECTED]', err));