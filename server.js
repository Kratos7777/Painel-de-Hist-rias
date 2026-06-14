/**
 * ==============================================================================
 * TR: VIDA - ECOSSISTEMA SUPREMO (SERVER.JS)
 * ==============================================================================
 * Versão: 7.4.0 - Diagnóstico Profundo e Resiliência de Variáveis
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
// 1. CONFIGURAÇÕES E LIMPEZA DE VARIÁVEIS
// ==========================================
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Limpeza agressiva de espaços e caracteres invisíveis nas variáveis
const cleanEnv = (val) => val ? val.trim().replace(/['"]/g, '') : null;

const CLIENT_ID = cleanEnv(process.env.CLIENT_ID);
const CLIENT_SECRET = cleanEnv(process.env.CLIENT_SECRET);
const CALLBACK_URL = cleanEnv(process.env.CALLBACK_URL);
const DISCORD_ADMIN_ID = cleanEnv(process.env.DISCORD_ID);
const SESSION_SECRET = cleanEnv(process.env.SESSION_SECRET) || "trvida_secret_key_2026";

const CALLBACK_PATH = "/auth/discord/callback";

console.log("\n" + "=".repeat(40));
console.log("🔍 DIAGNÓSTICO DE INICIALIZAÇÃO:");
console.log(` > CLIENT_ID: ${CLIENT_ID ? 'OK (Verificado)' : '❌ AUSENTE'}`);
console.log(` > CALLBACK_URL: ${CALLBACK_URL}`);
console.log(` > MODO: ${NODE_ENV}`);
console.log("=".repeat(40) + "\n");

// ==========================================
// 2. MIDDLEWARES DE BASE
// ==========================================
app.set('trust proxy', 1);
app.use(compression());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(SESSION_SECRET));

// Helmet configurado para não bloquear o fluxo de login em desenvolvimento
app.use(helmet({
    contentSecurityPolicy: false, // Desativado temporariamente para debugar o Erro 500
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// ==========================================
// 3. SESSÃO E PASSPORT
// ==========================================
app.use(session({
    secret: SESSION_SECRET,
    resave: true,
    saveUninitialized: false,
    name: 'trvida.sid',
    cookie: {
        httpOnly: true,
        secure: NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 * 24 * 30
    }
}));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

if (CLIENT_ID && CLIENT_SECRET) {
    passport.use(new DiscordStrategy({
        clientID: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
        callbackURL: CALLBACK_URL,
        scope: ['identify']
    }, (accessToken, refreshToken, profile, done) => {
        return done(null, profile);
    }));
} else {
    console.error("❌ ERRO: CLIENT_ID ou CLIENT_SECRET não configurados no .env!");
}

app.use(passport.initialize());
app.use(passport.session());

// ==========================================
// 4. ROTAS DE LOGIN
// ==========================================

app.get('/login', (req, res) => res.redirect('/auth/discord'));

app.get('/auth/discord', (req, res, next) => {
    console.log("[AUTH] Iniciando redirecionamento para o Discord...");
    passport.authenticate('discord')(req, res, next);
});

app.get(CALLBACK_PATH, (req, res, next) => {
    console.log("[AUTH] Recebendo retorno do Discord...");
    passport.authenticate('discord', (err, user, info) => {
        if (err) {
            console.error("[AUTH ERROR] Falha na estratégia:", err);
            return res.status(500).send(`Erro de Autenticação: ${err.message}`);
        }
        if (!user) {
            console.error("[AUTH ERROR] Nenhum usuário retornado:", info);
            return res.redirect('/');
        }
        req.logIn(user, (loginErr) => {
            if (loginErr) {
                console.error("[AUTH ERROR] Erro ao logar na sessão:", loginErr);
                return res.status(500).send("Erro ao criar sessão de login.");
            }
            req.session.save(() => res.redirect('/capa'));
        });
    })(req, res, next);
});

app.get('/logout', (req, res) => {
    req.logout(() => {
        req.session.destroy(() => {
            res.clearCookie('trvida.sid');
            res.redirect('/');
        });
    });
});

// ==========================================
// 5. ROTAS DE PÁGINAS E API
// ==========================================
const checkAuth = (req, res, next) => {
    if (req.isAuthenticated()) return next();
    res.redirect('/');
};

app.get('/', (req, res) => {
    if (req.isAuthenticated()) return res.redirect('/capa');
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/capa', checkAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'capa.html'));
});

app.get('/api/me', (req, res) => {
    if (!req.isAuthenticated()) return res.json({ authenticated: false });
    res.json({
        authenticated: true,
        user: {
            id: req.user.id,
            username: req.user.username,
            avatar: req.user.avatar ? `https://cdn.discordapp.com/avatars/${req.user.id}/${req.user.avatar}.png` : null
        }
    });
});

app.get('/api/capitulos', checkAuth, async (req, res) => {
    try {
        const files = await fs.promises.readdir(__dirname);
        const caps = files
            .filter(f => f.startsWith('trvida') && f.endsWith('.txt'))
            .map(f => {
                const num = parseInt(f.replace('trvida', '').replace('.txt', ''), 10);
                const stats = fs.statSync(path.join(__dirname, f));
                return { numero: num, postadoEm: stats.mtime, tamanho: (stats.size / 1024).toFixed(1) + ' KB' };
            })
            .filter(c => !isNaN(c.numero))
            .sort((a, b) => a.numero - b.numero);
        res.json(caps);
    } catch (err) {
        res.status(500).json({ error: "Erro ao listar capítulos." });
    }
});

// ==========================================
// 6. TRATAMENTO DE ERROS GLOBAL
// ==========================================
app.use((err, req, res, next) => {
    console.error("\x1b[31m[ERRO 500]\x1b[0m", err.message);
    console.error(err.stack);
    res.status(500).send(`<h1>Erro Interno do Servidor</h1><p>${err.message}</p><pre>${err.stack}</pre>`);
});

// Arquivos Estáticos
app.use(express.static(path.join(__dirname, 'public')));
app.use('/imagens', express.static(path.join(__dirname, 'imagens')));

app.listen(PORT, () => {
    console.log(`\n🚀 SERVIDOR EM MODO DIAGNÓSTICO: http://localhost:${PORT}\n`);
});
