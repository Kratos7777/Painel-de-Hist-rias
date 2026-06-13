require('dotenv').config();

const express = require('express');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const path = require('path');
const fs = require('fs');

const app = express();

// =====================
// CONFIG BÁSICA
// =====================
app.set('trust proxy', 1);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// =====================
// ENV
// =====================
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
const SESSION_SECRET = process.env.SESSION_SECRET || "change_this_secret";
const DISCORD_ID = process.env.DISCORD_ID;

// =====================
// SESSION
// =====================
app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000
    }
}));

// =====================
// PASSPORT DISCORD
// =====================
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

passport.use(new DiscordStrategy({
    clientID: CLIENT_ID,
    clientSecret: CLIENT_SECRET,
    callbackURL: REDIRECT_URI,
    scope: ['identify']
}, (accessToken, refreshToken, profile, done) => {
    return done(null, profile);
}));

app.use(passport.initialize());
app.use(passport.session());

// ==========================================
// ROTAS DO PORTAL (FLUXO CORRIGIDO E BLINDADO)
// ==========================================

// Se o usuário já tiver sessão ativa, vai para a capa. Se não, tela de login (index.html)
app.get('/', (req, res) => {
    if (req.isAuthenticated()) {
        return res.redirect('/capa');
    }
    res.sendFile(path.resolve(__dirname, 'index.html'));
});

app.get('/auth/discord', passport.authenticate('discord'));

// =====================
// AUTH MIDDLEWARE
// =====================
function auth(req, res, next) {
    if (req.isAuthenticated()) return next();
    return res.redirect('/');
}

function admin(req, res, next) {
    if (req.isAuthenticated() && req.user.id === DISCORD_ID) return next();
    return res.status(403).send("Acesso negado");
}

// =====================
// HOME
// =====================
app.get('/', (req, res) => {
    if (req.isAuthenticated()) return res.redirect('/funcionalidades');
    res.sendFile(path.join(__dirname, 'index.html'));
});

// =====================
// LOGIN DISCORD
// =====================
app.get('/auth/discord', passport.authenticate('discord'));

app.get('/auth/discord/callback',
    passport.authenticate('discord', { failureRedirect: '/' }),
    (req, res) => {
        req.session.save(() => res.redirect('/funcionalidades'));
    }
);

// =====================
// FUNCIONALIDADES
// =====================
app.get('/funcionalidades', auth, (req, res) => {
    res.sendFile(path.join(__dirname, 'funcionalidades.html'));
});

// =====================
// CAPA
// =====================
app.get('/capa', auth, (req, res) => {
    res.sendFile(path.join(__dirname, 'capa.html'));
});

// =====================
// PERFIL DO USUÁRIO
// =====================
app.get('/perfil', auth, (req, res) => {
    res.sendFile(path.join(__dirname, 'perfil.html'));
});

// =====================
// CONFIGURAÇÕES
// =====================
app.get('/configuracoes', auth, (req, res) => {
    res.sendFile(path.join(__dirname, 'configuracoes.html'));
});

// =====================
// CAPÍTULO
// =====================
app.get('/trvida/:numero', auth, (req, res) => {
    const num = parseInt(req.params.numero);
    if (isNaN(num) || num <= 0) {
        return res.status(400).send("Capítulo inválido");
    }
    res.sendFile(path.join(__dirname, 'capitulo.html'));
});

// =====================
// DASHBOARD
// =====================
app.get('/dashboard', admin, (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// =====================
// API - DADOS DO USUÁRIO
// =====================
app.get('/api/usuario', auth, (req, res) => {
    res.json({
        id: req.user.id,
        username: req.user.username,
        avatar: req.user.avatar,
        discriminator: req.user.discriminator
    });
});

// =====================
// API - LER CAPÍTULO
// =====================
app.get('/api/capitulo/:numero', auth, (req, res) => {
    const num = parseInt(req.params.numero);

    if (isNaN(num) || num <= 0) {
        return res.status(400).send("Capítulo inválido");
    }

    let file = path.join(__dirname, 'data', `trvida${num}.txt`);
    
    if (!fs.existsSync(file)) {
        file = path.join(__dirname, `trvida${num}.txt`);
    }

    fs.readFile(file, 'utf8', (err, data) => {
        if (err) return res.send("Capítulo em construção...");
        res.send(data);
    });
});

// =====================
// API - LISTA CAPÍTULOS
// =====================
app.get('/api/capitulos', auth, (req, res) => {
    let dataDir = path.join(__dirname, 'data');
    
    if (!fs.existsSync(dataDir)) {
        dataDir = __dirname;
    }

    fs.readdir(dataDir, (err, files) => {
        if (err) return res.json([]);

        const caps = files
            .filter(f => f.startsWith('trvida') && f.endsWith('.txt'))
            .map(f => parseInt(f.replace('trvida', '').replace('.txt', '')))
            .filter(n => !isNaN(n))
            .sort((a, b) => a - b);

        res.json(caps);
    });
});

// =====================
// API - BUSCAR CAPÍTULO (EDITOR)
// =====================
app.get('/api/buscar-capitulo', admin, (req, res) => {
    const num = parseInt(req.query.numero);

    if (isNaN(num) || num <= 0) {
        return res.send("");
    }

    let file = path.join(__dirname, 'data', `trvida${num}.txt`);
    
    if (!fs.existsSync(file)) {
        file = path.join(__dirname, `trvida${num}.txt`);
    }

    fs.readFile(file, 'utf8', (err, data) => {
        if (err) return res.send("");
        res.send(data);
    });
});

// =====================
// API - SALVAR CAPÍTULO (EDITOR)
// =====================
app.post('/api/salvar-capitulo', admin, (req, res) => {
    const num = parseInt(req.body.numero);

    if (isNaN(num) || num <= 0) {
        return res.status(400).send("Número inválido");
    }

    let dataDir = path.join(__dirname, 'data');
    let file = path.join(dataDir, `trvida${num}.txt`);

    fs.mkdir(dataDir, { recursive: true }, (mkErr) => {
        if (mkErr) {
            file = path.join(__dirname, `trvida${num}.txt`);
        }

        fs.writeFile(file, req.body.conteudo || "", 'utf8', (err) => {
            if (err) return res.status(500).send("Erro ao salvar");
            res.send("OK");
        });
    });
});

// =====================
// API - ME (ADMIN CHECK)
// =====================
app.get('/api/me', (req, res) => {
    if (!req.isAuthenticated()) {
        return res.json({ admin: false });
    }

    return res.json({
        admin: req.user.id === DISCORD_ID
    });
});

// =====================
// LOGOUT
// =====================
app.get('/logout', (req, res) => {
    req.logout(() => {
        req.session.destroy(() => {
            res.redirect('/');
        });
    });
});

// =====================
// ERROR HANDLER
// =====================
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send("Erro no servidor. Tente novamente.");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log("=========================================");
    console.log(`🛸 PORTAL ONLINE: http://localhost:${PORT}`);
    console.log("=========================================");
}).on('error', (err) => {
    console.error("ERRO CRÍTICO AO LIGAR O SERVIDOR:", err);
});