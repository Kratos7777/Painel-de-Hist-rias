/**
 * ==============================================================================
 * 🚀 PORTAL DE HISTÓRIAS - ECOSSISTEMA SUPREMO (SERVER.JS)
 * ==============================================================================
 * Versão: 12.0.0 - Inteligência de Caminhos e Blindagem de 404
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

const app = express();

// ==========================================
// 🛠️ 1. CONFIGURAÇÕES E LIMPEZA
// ==========================================
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

const cleanEnv = (val) => val ? val.trim().replace(/['"]/g, '') : null;

const CLIENT_ID = cleanEnv(process.env.CLIENT_ID);
const CLIENT_SECRET = cleanEnv(process.env.CLIENT_SECRET);
const CALLBACK_URL = cleanEnv(process.env.REDIRECT_URI) || cleanEnv(process.env.CALLBACK_URL);
const DISCORD_ADMIN_ID = cleanEnv(process.env.DISCORD_ID);
const SESSION_SECRET = cleanEnv(process.env.SESSION_SECRET) || "trvida_secret_key_2026";

console.log("\n[SISTEMA] Iniciando v12.0.0...");
console.log(` > Ambiente: ${NODE_ENV}`);
console.log(` > Redirect URI: ${CALLBACK_URL}\n`);

// ==========================================
// 🛡️ 2. MIDDLEWARES
// ==========================================
app.set('trust proxy', 1);
app.use(compression());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// ==========================================
// 🔑 3. SESSÃO E PASSPORT
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

if (CLIENT_ID && CLIENT_SECRET && CALLBACK_URL) {
    passport.use(new DiscordStrategy({
        clientID: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
        callbackURL: CALLBACK_URL,
        scope: ['identify', 'email']
    }, (accessToken, refreshToken, profile, done) => {
        profile.isAdmin = (profile.id === DISCORD_ADMIN_ID);
        return done(null, profile);
    }));
}

app.use(passport.initialize());
app.use(passport.session());

// ==========================================
// 📂 4. GERENCIADOR DE ARQUIVOS (ANTI-404)
// ==========================================
const getFilePath = (fileName) => {
    // Procura na raiz primeiro, depois em /public
    const paths = [
        path.join(__dirname, fileName),
        path.join(__dirname, 'public', fileName)
    ];
    for (const p of paths) {
        if (fs.existsSync(p)) return p;
    }
    return null;
};

const sendSecureFile = (res, fileName) => {
    const filePath = getFilePath(fileName);
    if (filePath) {
        res.sendFile(filePath);
    } else {
        console.error(`[ERRO] Arquivo não encontrado: ${fileName}`);
        res.status(404).send(`<h1>Erro 404</h1><p>O arquivo <b>${fileName}</b> não foi encontrado no servidor.</p>`);
    }
};

// ==========================================
// 🚪 5. ROTAS DE AUTENTICAÇÃO
// ==========================================

app.get('/auth/discord', passport.authenticate('discord'));

app.get('/auth/discord/callback', (req, res, next) => {
    passport.authenticate('discord', (err, user) => {
        if (err || !user) return res.redirect('/');
        req.logIn(user, (loginErr) => {
            if (loginErr) return next(loginErr);
            req.session.save(() => res.redirect('/funcionalidades'));
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
// 🛡️ 6. MIDDLEWARES DE PROTEÇÃO
// ==========================================
const isAuth = (req, res, next) => req.isAuthenticated() ? next() : res.redirect('/');
const isAdmin = (req, res, next) => (req.isAuthenticated() && req.user.id === DISCORD_ADMIN_ID) ? next() : res.status(403).send("Acesso Negado");

// ==========================================
// 📄 7. ROTAS DE PÁGINAS
// ==========================================

app.get('/', (req, res) => {
    if (req.isAuthenticated()) return res.redirect('/funcionalidades');
    sendSecureFile(res, 'index.html');
});

app.get('/funcionalidades', isAuth, (req, res) => sendSecureFile(res, 'funcionalidades.html'));
app.get('/capa', isAuth, (req, res) => sendSecureFile(res, 'capa.html'));
app.get('/trvida/:numero', isAuth, (req, res) => sendSecureFile(res, 'capitulo.html'));
app.get('/perfil', isAuth, (req, res) => sendSecureFile(res, 'perfil.html'));
app.get('/configuracoes', isAuth, (req, res) => sendSecureFile(res, 'configuracoes.html'));
app.get('/dashboard', isAdmin, (req, res) => sendSecureFile(res, 'dashboard.html'));

// ==========================================
// 📊 8. API
// ==========================================

app.get('/api/user', (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "Off" });
    res.json({
        id: req.user.id,
        username: req.user.username,
        avatar: req.user.avatar ? `https://cdn.discordapp.com/avatars/${req.user.id}/${req.user.avatar}.png` : null,
        isAdmin: req.user.id === DISCORD_ADMIN_ID
    });
});

app.get('/api/capitulos', isAuth, (req, res) => {
    const dataDir = fs.existsSync(path.join(__dirname, 'data')) ? path.join(__dirname, 'data') : __dirname;
    const files = fs.readdirSync(dataDir);
    const caps = files
        .filter(f => f.startsWith('trvida') && f.endsWith('.txt'))
        .map(f => parseInt(f.replace('trvida', '').replace('.txt', '')))
        .filter(n => !isNaN(n))
        .sort((a, b) => a - b);
    res.json(caps);
});

app.get('/api/capitulo/:numero', isAuth, (req, res) => {
    const num = req.params.numero;
    const paths = [
        path.join(__dirname, 'data', `trvida${num}.txt`),
        path.join(__dirname, `trvida${num}.txt`)
    ];
    let found = false;
    for (const p of paths) {
        if (fs.existsSync(p)) {
            res.send(fs.readFileSync(p, 'utf8'));
            found = true;
            break;
        }
    }
    if (!found) res.status(404).send("Capítulo não encontrado.");
});

app.post('/api/salvar-capitulo', isAdmin, (req, res) => {
    const { numero, conteudo } = req.body;
    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
    fs.writeFileSync(path.join(dataDir, `trvida${numero}.txt`), conteudo, 'utf8');
    res.json({ success: true });
});

// ==========================================
// 📂 9. ESTÁTICOS
// ==========================================
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/imagens', express.static(path.join(__dirname, 'imagens')));

app.listen(PORT, () => console.log(`\n✅ SERVIDOR v12 ONLINE: ${PORT}\n`));
