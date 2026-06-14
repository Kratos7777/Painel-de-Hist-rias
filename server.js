/**
 * ==============================================================================
 * TR: VIDA - ECOSSISTEMA SUPREMO (SERVER.JS)
 * ==============================================================================
 * Versão: 7.0.0 - Arquitetura de Resiliência Total
 * Descrição: O núcleo inabalável do portal. Gerencia identidade, segurança, 
 *            fluxo de dados e performance com monitoramento em tempo real.
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

const app = express();

// ==========================================
// 1. CONFIGURAÇÕES E CONSTANTES
// ==========================================
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const DISCORD_ID = process.env.DISCORD_ID; // ID do Administrador
const SESSION_SECRET = process.env.SESSION_SECRET || "trvida_secret_ancestral_key_2026";

// Caminhos do Sistema
const PATHS = {
    PUBLIC: path.join(__dirname, 'public'),
    DATA: path.join(__dirname, 'data'),
    IMAGENS: path.join(__dirname, 'imagens'),
    LOGS: path.join(__dirname, 'logs')
};

// Inicialização de Pastas
Object.values(PATHS).forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ==========================================
// 2. MIDDLEWARES DE SEGURANÇA & PERFORMANCE
// ==========================================

// Rate Limiting: Proteção contra abuso
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 200, // Limite por IP
    message: { error: "Muitas requisições. Tente novamente em 15 minutos." }
});

app.set('trust proxy', 1);
app.use(limiter);
app.use(compression()); // Gzip para respostas rápidas

// Helmet: Blindagem de Headers HTTP
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
app.use(morgan('dev')); // Logs no console
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser(SESSION_SECRET));

// ==========================================
// 3. GESTÃO DE ARQUIVOS ESTÁTICOS
// ==========================================

// Cache de arquivos estáticos (1 dia)
const staticOptions = {
    maxAge: '1d',
    etag: true,
    setHeaders: (res) => res.set('X-Powered-By', 'TR-Vida-Core')
};

app.use(express.static(PATHS.PUBLIC, staticOptions));
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
        maxAge: 1000 * 60 * 60 * 24 * 30 // 30 dias
    }
}));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

if (process.env.CLIENT_ID && process.env.CLIENT_SECRET) {
    passport.use(new DiscordStrategy({
        clientID: process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET,
        callbackURL: process.env.REDIRECT_URI,
        scope: ['identify']
    }, (accessToken, refreshToken, profile, done) => {
        console.log(`[AUTH] Login: ${profile.username}#${profile.discriminator}`);
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
    if (req.xhr || req.path.startsWith('/api/')) {
        return res.status(401).json({ error: "Sessão expirada. Faça login novamente." });
    }
    res.redirect('/');
};

const checkAdmin = (req, res, next) => {
    if (req.isAuthenticated() && req.user.id === DISCORD_ID) return next();
    res.status(403).send("Acesso negado: Requer privilégios de Administrador.");
};

// ==========================================
// 6. ROTAS DE NAVEGAÇÃO (PÁGINAS)
// ==========================================

app.get('/', (req, res) => {
    if (req.isAuthenticated()) return res.redirect('/capa');
    res.sendFile(path.join(PATHS.PUBLIC, 'index.html'));
});

app.get('/auth/discord', passport.authenticate('discord'));

app.get('/auth/discord/callback',
    passport.authenticate('discord', { failureRedirect: '/' }),
    (req, res) => {
        req.session.save(() => res.redirect('/capa'));
    }
);

app.get('/capa', checkAuth, (req, res) => {
    res.sendFile(path.join(PATHS.PUBLIC, 'capa.html'));
});

app.get('/trvida/:numero', checkAuth, (req, res) => {
    const num = parseInt(req.params.numero, 10);
    if (isNaN(num)) return res.status(400).send("Capítulo inválido.");
    res.sendFile(path.join(PATHS.PUBLIC, 'capitulo.html'));
});

app.get('/perfil', checkAuth, (req, res) => {
    res.sendFile(path.join(PATHS.PUBLIC, 'perfil.html'));
});

app.get('/dashboard', checkAdmin, (req, res) => {
    res.sendFile(path.join(PATHS.PUBLIC, 'dashboard.html'));
});

// ==========================================
// 7. ENDPOINTS DA API (SISTEMA DE DADOS)
// ==========================================

/**
 * Retorna dados do usuário logado com avatar processado
 */
app.get('/api/me', (req, res) => {
    if (!req.isAuthenticated()) return res.json({ authenticated: false });
    
    const { id, username, avatar, global_name } = req.user;
    res.json({
        authenticated: true,
        user: {
            id,
            name: global_name || username,
            avatar: avatar ? `https://cdn.discordapp.com/avatars/${id}/${avatar}.png` : null,
            isAdmin: id === DISCORD_ID
        }
    });
});

/**
 * Listagem inteligente de capítulos com metadados
 */
app.get('/api/capitulos', checkAuth, async (req, res) => {
    try {
        const targetDir = fs.existsSync(PATHS.DATA) ? PATHS.DATA : __dirname;
        const files = await fs.promises.readdir(targetDir);
        
        const caps = files
            .filter(f => f.startsWith('trvida') && f.endsWith('.txt'))
            .map(f => {
                const num = parseInt(f.replace('trvida', '').replace('.txt', ''), 10);
                const stats = fs.statSync(path.join(targetDir, f));
                return {
                    numero: num,
                    postadoEm: stats.mtime,
                    tamanho: (stats.size / 1024).toFixed(1) + ' KB'
                };
            })
            .filter(c => !isNaN(c.numero))
            .sort((a, b) => a.numero - b.numero);

        res.json(caps);
    } catch (err) {
        console.error("[API ERROR] Falha ao listar capítulos:", err);
        res.status(500).json({ error: "Erro ao processar capítulos." });
    }
});

/**
 * Recupera o conteúdo de um capítulo específico
 */
app.get('/api/capitulo/:numero', checkAuth, (req, res) => {
    const num = parseInt(req.params.numero, 10);
    if (isNaN(num)) return res.status(400).json({ error: "Número inválido" });

    let filePath = path.join(PATHS.DATA, `trvida${num}.txt`);
    if (!fs.existsSync(filePath)) filePath = path.join(__dirname, `trvida${num}.txt`);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "Este capítulo ainda não foi escrito." });
    }

    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) return res.status(500).send("Erro na leitura do arquivo.");
        res.send(data);
    });
});

/**
 * Logout Seguro e limpeza de sessão
 */
app.get('/logout', (req, res) => {
    req.logout((err) => {
        req.session.destroy(() => {
            res.clearCookie('trvida.sid');
            res.redirect('/');
        });
    });
});

// ==========================================
// 8. MANIPULAÇÃO DE ERROS E 404
// ==========================================

// Página 404 Personalizada
app.use((req, res) => {
    res.status(404).sendFile(path.join(PATHS.PUBLIC, '404.html'), (err) => {
        if (err) res.status(404).send("Página não encontrada.");
    });
});

// Manipulador de Erros Global
app.use((err, req, res, next) => {
    console.error(`\x1b[31m[ERRO CRÍTICO] ${err.message}\x1b[0m`);
    console.error(err.stack);
    
    const status = err.status || 500;
    res.status(status).json({
        message: "Ocorreu um erro interno no portal.",
        error: NODE_ENV === 'production' ? {} : err.message
    });
});

// ==========================================
// 9. INICIALIZAÇÃO DO SERVIDOR
// ==========================================

const server = app.listen(PORT, () => {
    console.log("\n" + "=".repeat(60));
    console.log(`\x1b[32m🚀 TR: VIDA - SERVIDOR INICIALIZADO\x1b[0m`);
    console.log(`\x1b[36m🌐 PORTA:\x1b[0m ${PORT}`);
    console.log(`\x1b[36m🛠️  MODO:\x1b[0m  ${NODE_ENV}`);
    console.log(`\x1b[36m📁 ROOT:\x1b[0m  ${__dirname}`);
    console.log("=".repeat(60) + "\n");
});

// Graceful Shutdown: Encerramento limpo
process.on('SIGTERM', () => {
    console.log('Encerrando conexões suavemente...');
    server.close(() => {
        console.log('Processo encerrado com sucesso.');
        process.exit(0);
    });
});
