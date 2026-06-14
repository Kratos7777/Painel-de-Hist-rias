/**
 * ==============================================================================
 * TR: VIDA - ECOSSISTEMA SUPREMO (SERVER.JS)
 * ==============================================================================
 * Versão: 7.2.0 - Sincronização Final de Variáveis e Rotas de Compatibilidade
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
// 1. CONFIGURAÇÕES E MAPEAMENTO DO .ENV
// ==========================================
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// MAPEAMENTO EXATO DO SEU .ENV
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const CALLBACK_URL = process.env.CALLBACK_URL; // 'https://hist-ria.onrender.com/auth/discord/callback'
const DISCORD_ADMIN_ID = process.env.DISCORD_ID;
const SESSION_SECRET = process.env.SESSION_SECRET || "trvida_secret_key_2026";

// Rota de Callback fixa conforme seu log
const CALLBACK_PATH = "/auth/discord/callback";

console.log(`\n[SISTEMA] Inicializando com as seguintes configurações:`);
console.log(` > CLIENT_ID: ${CLIENT_ID ? 'OK' : 'AUSENTE'}`);
console.log(` > CALLBACK_URL: ${CALLBACK_URL}`);
console.log(` > CALLBACK_PATH: ${CALLBACK_PATH}\n`);

// Caminhos
const PATHS = {
    PUBLIC: path.join(__dirname, 'public'),
    DATA: path.join(__dirname, 'data'),
    IMAGENS: path.join(__dirname, 'imagens')
};

Object.values(PATHS).forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ==========================================
// 2. MIDDLEWARES
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

// ==========================================
// 3. SESSÃO E PASSPORT
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

if (CLIENT_ID && CLIENT_SECRET) {
    passport.use(new DiscordStrategy({
        clientID: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
        callbackURL: CALLBACK_URL,
        scope: ['identify']
    }, (accessToken, refreshToken, profile, done) => {
        return done(null, profile);
    }));
}

app.use(passport.initialize());
app.use(passport.session());

// ==========================================
// 4. ROTAS DE AUTENTICAÇÃO
// ==========================================

// Rota de compatibilidade para evitar o erro "Cannot GET /login"
app.get('/login', (req, res) => {
    res.redirect('/auth/discord');
});

app.get('/auth/discord', passport.authenticate('discord'));

app.get(CALLBACK_PATH,
    passport.authenticate('discord', { failureRedirect: '/' }),
    (req, res) => {
        req.session.save(() => res.redirect('/capa'));
    }
);

app.get('/logout', (req, res) => {
    req.logout(() => {
        req.session.destroy(() => {
            res.clearCookie('trvida.sid');
            res.redirect('/');
        });
    });
});

// ==========================================
// 5. ROTAS DE PÁGINAS (PROTEGIDAS)
// ==========================================
const checkAuth = (req, res, next) => {
    if (req.isAuthenticated()) return next();
    res.redirect('/');
};

app.get('/', (req, res) => {
    if (req.isAuthenticated()) return res.redirect('/capa');
    res.sendFile(path.join(PATHS.PUBLIC, 'index.html'));
});

app.get('/capa', checkAuth, (req, res) => {
    res.sendFile(path.join(PATHS.PUBLIC, 'capa.html'));
});

app.get('/trvida/:numero', checkAuth, (req, res) => {
    res.sendFile(path.join(PATHS.PUBLIC, 'capitulo.html'));
});

// ==========================================
// 6. API ENDPOINTS
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

// ==========================================
// 7. ARQUIVOS ESTÁTICOS E INICIALIZAÇÃO
// ==========================================
app.use(express.static(PATHS.PUBLIC, { maxAge: '1d' }));
app.use('/imagens', express.static(path.join(__dirname, 'imagens'), { maxAge: '7d' }));

app.listen(PORT, () => {
    console.log(`\n🚀 SERVIDOR SINCRONIZADO: http://localhost:${PORT}`);
    console.log(`🔗 CALLBACK ATIVO EM: ${CALLBACK_PATH}\n`);
});
