/**
 * ==============================================================================
 * TR: VIDA - ECOSSISTEMA SUPREMO (SERVER.JS)
 * ==============================================================================
 * Versão: 7.1.0 - Correção de Fluxo de Autenticação e Sincronização de .env
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
const cors = require('cors');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const { URL } = require('url');

const app = express();

// ==========================================
// 1. CONFIGURAÇÕES E MAPEAMENTO DO .ENV
// ==========================================
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// MAPEAMENTO DE VARIÁVEIS (Compatibilidade com seu .env)
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID || process.env.CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET || process.env.CLIENT_SECRET;
const DISCORD_CALLBACK_URL = process.env.DISCORD_CALLBACK_URL || process.env.REDIRECT_URI;
const DISCORD_ADMIN_ID = process.env.DISCORD_ID; // ID do Administrador
const SESSION_SECRET = process.env.SESSION_SECRET || "trvida_secret_ancestral_key_2026";

// Extração dinâmica do PATH do Callback para registrar a rota corretamente
let CALLBACK_PATH = "/auth/discord/callback"; // Fallback padrão
if (DISCORD_CALLBACK_URL) {
    try {
        const parsedUrl = new URL(DISCORD_CALLBACK_URL);
        CALLBACK_PATH = parsedUrl.pathname;
    } catch (e) {
        console.error("[CONFIG] URL de Callback inválida no .env. Usando padrão.");
    }
}

console.log(`\n[DEBUG] Configurações de Autenticação:`);
console.log(` > ID do Cliente: ${DISCORD_CLIENT_ID ? 'Configurado' : 'AUSENTE'}`);
console.log(` > URL de Retorno: ${DISCORD_CALLBACK_URL}`);
console.log(` > Rota Interna: ${CALLBACK_PATH}\n`);

// Caminhos do Sistema
const PATHS = {
    PUBLIC: path.join(__dirname, 'public'),
    DATA: path.join(__dirname, 'data'),
    IMAGENS: path.join(__dirname, 'imagens')
};

Object.values(PATHS).forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ==========================================
// 2. MIDDLEWARES DE SEGURANÇA & PERFORMANCE
// ==========================================
app.set('trust proxy', 1);
app.use(compression());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(SESSION_SECRET));

app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "https://cdn.discordapp.com", "https://via.placeholder.com"],
            connectSrc: ["'self'"]
        }
    }
}));

app.use(cors({ origin: '*', credentials: true }));

// ==========================================
// 3. GESTÃO DE ARQUIVOS ESTÁTICOS
// ==========================================
app.use(express.static(PATHS.PUBLIC, { maxAge: '1d' }));
app.use('/imagens', express.static(PATHS.IMAGENS, { maxAge: '7d' }));

// ==========================================
// 4. SISTEMA DE SESSÃO E AUTENTICAÇÃO
// ==========================================
app.use(session({
    secret: SESSION_SECRET,
    resave: false,
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

if (DISCORD_CLIENT_ID && DISCORD_CLIENT_SECRET) {
    passport.use(new DiscordStrategy({
        clientID: DISCORD_CLIENT_ID,
        clientSecret: DISCORD_CLIENT_SECRET,
        callbackURL: DISCORD_CALLBACK_URL,
        scope: ['identify']
    }, (accessToken, refreshToken, profile, done) => {
        return done(null, profile);
    }));
}

app.use(passport.initialize());
app.use(passport.session());

// ==========================================
// 5. MIDDLEWARES DE CONTROLE DE ACESSO
// ==========================================
const checkAuth = (req, res, next) => {
    if (req.isAuthenticated()) return next();
    res.redirect('/');
};

const checkAdmin = (req, res, next) => {
    if (req.isAuthenticated() && req.user.id === DISCORD_ADMIN_ID) return next();
    res.status(403).send("Acesso negado.");
};

// ==========================================
// 6. ROTAS DE NAVEGAÇÃO E AUTENTICAÇÃO
// ==========================================

// Página Inicial
app.get('/', (req, res) => {
    if (req.isAuthenticated()) return res.redirect('/capa');
    res.sendFile(path.join(PATHS.PUBLIC, 'index.html'));
});

// INÍCIO DO LOGIN DISCORD
app.get('/auth/discord', passport.authenticate('discord'));

// RETORNO DO DISCORD (Dinâmico com base no seu .env)
app.get(CALLBACK_PATH,
    passport.authenticate('discord', { failureRedirect: '/' }),
    (req, res) => {
        req.session.save(() => res.redirect('/capa'));
    }
);

// Páginas Protegidas
app.get('/capa', checkAuth, (req, res) => {
    res.sendFile(path.join(PATHS.PUBLIC, 'capa.html'));
});

app.get('/trvida/:numero', checkAuth, (req, res) => {
    res.sendFile(path.join(PATHS.PUBLIC, 'capitulo.html'));
});

app.get('/dashboard', checkAdmin, (req, res) => {
    res.sendFile(path.join(PATHS.PUBLIC, 'dashboard.html'));
});

// ==========================================
// 7. ENDPOINTS DA API
// ==========================================

app.get('/api/me', (req, res) => {
    if (!req.isAuthenticated()) return res.json({ authenticated: false });
    res.json({
        authenticated: true,
        user: {
            id: req.user.id,
            username: req.user.username,
            avatar: req.user.avatar ? `https://cdn.discordapp.com/avatars/${req.user.id}/${req.user.avatar}.png` : null,
            isAdmin: req.user.id === DISCORD_ADMIN_ID
        }
    });
});

app.get('/api/capitulos', checkAuth, async (req, res) => {
    try {
        const targetDir = fs.existsSync(PATHS.DATA) ? PATHS.DATA : __dirname;
        const files = await fs.promises.readdir(targetDir);
        const caps = files
            .filter(f => f.startsWith('trvida') && f.endsWith('.txt'))
            .map(f => {
                const num = parseInt(f.replace('trvida', '').replace('.txt', ''), 10);
                const stats = fs.statSync(path.join(targetDir, f));
                return { numero: num, postadoEm: stats.mtime, tamanho: (stats.size / 1024).toFixed(1) + ' KB' };
            })
            .filter(c => !isNaN(c.numero))
            .sort((a, b) => a.numero - b.numero);
        res.json(caps);
    } catch (err) {
        res.status(500).json({ error: "Erro ao listar capítulos." });
    }
});

app.get('/api/capitulo/:numero', checkAuth, (req, res) => {
    const num = parseInt(req.params.numero, 10);
    let filePath = path.join(PATHS.DATA, `trvida${num}.txt`);
    if (!fs.existsSync(filePath)) filePath = path.join(__dirname, `trvida${num}.txt`);
    if (!fs.existsSync(filePath)) return res.status(404).send("Capítulo não encontrado.");
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) return res.status(500).send("Erro na leitura.");
        res.send(data);
    });
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
// 8. INICIALIZAÇÃO
// ==========================================
app.listen(PORT, () => {
    console.log(`\n🚀 SERVIDOR ONLINE: http://localhost:${PORT}`);
    console.log(`🔗 CALLBACK CONFIGURADO: ${CALLBACK_PATH}\n`);
});
