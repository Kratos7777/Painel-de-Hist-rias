require('dotenv').config();

const express = require('express');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const path = require('path');
const fs = require('fs');

const app = express();

// ==========================================
// CONFIGURAÇÕES BÁSICAS DO EXPRESS
// ==========================================
app.set('trust proxy', 1);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(__dirname));

// Rota estática dedicada para servir as imagens locais no contêiner do Render
app.use('/imagens', express.static(path.resolve(__dirname, 'imagens'), {
    setHeaders: (res) => {
        res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    }
}));

// ==========================================
// CARREGAMENTO DAS VARIÁVEIS DE AMBIENTE (.ENV)
// ==========================================
const CLIENT_ID = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI = process.env.REDIRECT_URI;
const SESSION_SECRET = process.env.SESSION_SECRET || "change_this_secret";
const DISCORD_ID = process.env.DISCORD_ID;

// ==========================================
// CONFIGURAÇÃO DE SESSÃO DO USUÁRIO
// ==========================================
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

// ==========================================
// CONFIGURAÇÃO DO PASSPORT (AUTENTICAÇÃO DISCORD)
// ==========================================
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
// MIDDLEWARES DE VALIDAÇÃO DE SEGURANÇA
// ==========================================
function auth(req, res, next) {
    if (req.isAuthenticated()) return next();
    return res.redirect('/');
}

// Vinculação de segurança para evitar o erro fatal de "ReferenceError" na rota da capa
const verificarAutenticacao = auth;

function admin(req, res, next) {
    if (req.isAuthenticated() && req.user.id === DISCORD_ID) return next();
    return res.status(403).send("Acesso negado");
}

// ==========================================
// ROTAS DO FLUXO PRINCIPAL (LOGIN E REDIRECIONAMENTO)
// ==========================================

// Se o usuário já tiver um cookie de login ativo, vai para a capa. Se não, exibe o index.html
app.get('/', (req, res) => {
    if (req.isAuthenticated()) {
        return res.redirect('/capa');
    }
    res.sendFile(path.resolve(__dirname, 'index.html'));
});

// Rota de disparo que inicia o processo de login junto ao aplicativo do Discord
app.get('/auth/discord', passport.authenticate('discord'));

// Rota de retorno do Discord que salva a sessão e redireciona para a Capa com segurança
app.get('/auth/discord/callback',
    passport.authenticate('discord', { failureRedirect: '/' }),
    (req, res) => {
        req.session.save(() => res.redirect('/capa'));
    }
);

// ==========================================
// ROTAS DE INTERFACE DO PORTAL (PÁGINAS HTML)
// ==========================================

app.get('/funcionalidades', auth, (req, res) => {
    res.sendFile(path.join(__dirname, 'funcionalidades.html'));
});

app.get('/capa', verificarAutenticacao, (req, res) => {
    const caminhoCapa = path.resolve(__dirname, 'capa.html');
    res.sendFile(caminhoCapa, (err) => {
        if (err) {
            res.status(500).send(`Erro ao carregar capa.html: ${err.message}. Caminho tentado: ${caminhoCapa}`);
        }
    });
});

app.get('/perfil', auth, (req, res) => {
    res.sendFile(path.join(__dirname, 'perfil.html'));
});

app.get('/configuracoes', auth, (req, res) => {
    res.sendFile(path.join(__dirname, 'configuracoes.html'));
});

app.get('/trvida/:numero', auth, (req, res) => {
    const num = parseInt(req.params.numero, 10);
    if (isNaN(num) || num <= 0) {
        return res.status(400).send("Capítulo inválido");
    }
    res.sendFile(path.join(__dirname, 'capitulo.html'));
});

app.get('/dashboard', admin, (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// ==========================================
// ENDPOINTS DA API INTERNA DO SISTEMA
// ==========================================

// Retorna as informações básicas do perfil logado
app.get('/api/usuario', auth, (req, res) => {
    res.json({
        id: req.user.id,
        username: req.user.username,
        avatar: req.user.avatar,
        discriminator: req.user.discriminator
    });
});

// Retorna o texto bruto de um capítulo específico da história
app.get('/api/capitulo/:numero', auth, (req, res) => {
    const num = parseInt(req.params.numero, 10);
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

// Varre a pasta do projeto para retornar a lista de todos os capítulos existentes
app.get('/api/capitulos', auth, (req, res) => {
    let dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) {
        dataDir = __dirname;
    }

    fs.readdir(dataDir, (err, files) => {
        if (err) return res.json([]);

        const caps = files
            .filter(f => f.startsWith('trvida') && f.endsWith('.txt'))
            .map(f => parseInt(f.replace('trvida', '').replace('.txt', ''), 10))
            .filter(n => !isNaN(n))
            .sort((a, b) => a - b);

        res.json(caps);
    });
});

// Recupera o conteúdo de um arquivo para exibição interna no painel do editor (Restrito)
app.get('/api/buscar-capitulo', admin, (req, res) => {
    const num = parseInt(req.query.numero, 10);
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

// Recebe e salva alterações enviadas pelo editor criando subpastas se necessário (Restrito)
app.post('/api/salvar-capitulo', admin, (req, res) => {
    const num = parseInt(req.body.numero, 10);
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

// Endpoint rápido para verificar se a sessão atual pertence ao ID administrador
app.get('/api/me', (req, res) => {
    if (!req.isAuthenticated()) {
        return res.json({ admin: false });
    }
    return res.json({
        admin: req.user.id === DISCORD_ID
    });
});

// ==========================================
// ROTA DE LOGOUT E DESTRUIÇÃO DE SESSÃO
// ==========================================
app.get('/logout', (req, res) => {
    req.logout(() => {
        req.session.destroy(() => {
            res.redirect('/');
        });
    });
});

// ==========================================
// MANIPULADOR DE ERROS INTRÍNSECOS DO EXPRESS
// ==========================================
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send("Erro no servidor. Tente novamente.");
});

// ==========================================
// INICIALIZAÇÃO DO SERVIDOR HTTP
// ==========================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log("=========================================");
    console.log(`🛸 PORTAL ONLINE: http://localhost:${PORT}`);
    console.log("=========================================");
}).on('error', (err) => {
    console.error("ERRO CRÍTICO AO LIGAR O SERVIDOR:", err);
});