/**
 * ==============================================================================
 * TR: VIDA - ECOSSISTEMA SUPREMO (SERVER.JS)
 * ==============================================================================
 * Versão: 7.5.0 - Blindagem de Autenticação e Debug de Estratégia
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
// 1. CONFIGURAÇÕES E LIMPEZA
// ==========================================
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

const cleanEnv = (val) => val ? val.trim().replace(/['"]/g, '') : null;

const CLIENT_ID = cleanEnv(process.env.CLIENT_ID);
const CLIENT_SECRET = cleanEnv(process.env.CLIENT_SECRET);
const CALLBACK_URL = cleanEnv(process.env.CALLBACK_URL);
const DISCORD_ADMIN_ID = cleanEnv(process.env.DISCORD_ID);
const SESSION_SECRET = cleanEnv(process.env.SESSION_SECRET) || "trvida_secret_key_2026";

const CALLBACK_PATH = "/auth/discord/callback";

console.log("\n[SISTEMA] Iniciando v7.5.0...");
console.log(` > ID: ${CLIENT_ID ? CLIENT_ID.substring(0, 5) + '...' : '❌'}`);
console.log(` > URL: ${CALLBACK_URL}\n`);

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
    contentSecurityPolicy: false,
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

if (CLIENT_ID && CLIENT_SECRET && CALLBACK_URL) {
    passport.use(new DiscordStrategy({
        clientID: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
        callbackURL: CALLBACK_URL,
        scope: ['identify']
    }, (accessToken, refreshToken, profile, done) => {
        console.log(`[AUTH] Perfil recebido com sucesso: ${profile.username}`);
        return done(null, profile);
    }));
}

app.use(passport.initialize());
app.use(passport.session());

// ==========================================
// 4. ROTAS DE LOGIN E CALLBACK
// ==========================================

app.get('/login', (req, res) => res.redirect('/auth/discord'));

app.get('/auth/discord', (req, res, next) => {
    console.log("[AUTH] Redirecionando usuário para o Discord...");
    passport.authenticate('discord')(req, res, next);
});

app.get(CALLBACK_PATH, (req, res, next) => {
    console.log("[AUTH] Callback recebido. Validando credenciais...");
    
    passport.authenticate('discord', (err, user, info) => {
        // TRATAMENTO DE ERRO DETALHADO
        if (err) {
            console.error("\x1b[31m[ERRO CRÍTICO DISCORD]\x1b[0m");
            console.error("Mensagem:", err.message);
            if (err.oauthError) {
                console.error("Detalhes OAuth:", JSON.stringify(err.oauthError));
            }
            
            return res.status(500).send(`
                <div style="font-family:sans-serif; padding:40px; line-height:1.6;">
                    <h1 style="color:#ef4444;">Erro na Autenticação com o Discord</h1>
                    <p>O servidor do Discord retornou um erro ao tentar validar seu acesso.</p>
                    <div style="background:#f4f4f4; padding:20px; border-radius:8px; border-left:4px solid #ef4444;">
                        <strong>Código do Erro:</strong> ${err.message || 'Desconhecido'}<br>
                        <strong>Dica:</strong> Verifique se a sua <strong>Redirect URI</strong> no Painel do Discord é EXATAMENTE igual a:<br>
                        <code>${CALLBACK_URL}</code>
                    </div>
                    <br>
                    <a href="/" style="display:inline-block; padding:10px 20px; background:#11CAA0; color:white; text-decoration:none; border-radius:5px;">Tentar Novamente</a>
                </div>
            `);
        }

        if (!user) {
            console.warn("[AUTH] Login falhou: Nenhum usuário retornado.");
            return res.redirect('/');
        }

        req.logIn(user, (loginErr) => {
            if (loginErr) return next(loginErr);
            console.log(`[AUTH] Sessão criada para: ${user.username}`);
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

app.get('/trvida/:numero', checkAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'capitulo.html'));
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

app.get('/api/capitulo/:numero', checkAuth, (req, res) => {
    const num = parseInt(req.params.numero, 10);
    const filePath = path.join(__dirname, `trvida${num}.txt`);
    if (!fs.existsSync(filePath)) return res.status(404).send("Capítulo não encontrado.");
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) return res.status(500).send("Erro na leitura.");
        res.send(data);
    });
});

// Arquivos Estáticos
app.use(express.static(path.join(__dirname, 'public')));
app.use('/imagens', express.static(path.join(__dirname, 'imagens')));

app.listen(PORT, () => {
    console.log(`\n🚀 SERVIDOR v7.5.0 ONLINE: http://localhost:${PORT}\n`);
});
