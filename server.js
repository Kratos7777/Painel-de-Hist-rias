/**
 * ==============================================================================
 * PORTAL DE HISTÓRIAS - SERVER.JS
 * ==============================================================================
 * Versão: 11.0.0
 * CORREÇÕES v11:
 *  - resave: false (evita race condition de sessão)
 *  - Rota /api/buscar-capitulo adicionada (usada pelo Dashboard)
 * ==============================================================================
 */

require('dotenv').config();

const express      = require('express');
const session      = require('express-session');
const passport     = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const path         = require('path');
const fs           = require('fs');
const helmet       = require('helmet');
const compression  = require('compression');
const morgan       = require('morgan');
const cookieParser = require('cookie-parser');

const app = express();

// ==========================================
// 1. CONFIGURAÇÕES INICIAIS
// ==========================================
const PORT    = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Remove aspas e espaços acidentais nas vars de ambiente
const cleanEnv = (val) => val.trim().replace(/['"]/g, '');

const CLIENT_ID        = cleanEnv(process.env.CLIENT_ID);
const CLIENT_SECRET    = cleanEnv(process.env.CLIENT_SECRET);
const CALLBACK_URL     = cleanEnv(process.env.REDIRECT_URI) || cleanEnv(process.env.CALLBACK_URL);
const DISCORD_ADMIN_ID = cleanEnv(process.env.DISCORD_ID);
const SESSION_SECRET   = cleanEnv(process.env.SESSION_SECRET) || 'portal_historias_super_secret_2026';

console.log('\n' + '='.repeat(50));
console.log('INICIANDO PORTAL DE HISTÓRIAS');
console.log('='.repeat(50));
console.log(`Ambiente : ${NODE_ENV.toUpperCase()}`);
console.log(`Porta    : ${PORT}`);
console.log(`Client ID: ${CLIENT_ID ? CLIENT_ID.substring(0, 5) + '...' : 'NAO DEFINIDO'}`);
console.log(`Callback : ${CALLBACK_URL || 'NAO DEFINIDO'}`);
console.log('='.repeat(50) + '\n');

// ==========================================
// 2. MIDDLEWARES
// ==========================================
app.set('trust proxy', 1); // essencial no Render (HTTPS)
app.use(compression());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(SESSION_SECRET));

app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// ==========================================
// 3. SESSÃO E PASSPORT
// ==========================================
app.use(session({
    secret: SESSION_SECRET,
    resave: false,            // CORRIGIDO: era true (causava race condition)
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
        clientID:    CLIENT_ID,
        clientSecret: CLIENT_SECRET,
        callbackURL: CALLBACK_URL,
        scope: ['identify', 'email']
    }, (accessToken, refreshToken, profile, done) => {
        console.log(`[AUTH] Login: ${profile.username} (${profile.id})`);
        profile.isAdmin = (profile.id === DISCORD_ADMIN_ID);
        if (profile.isAdmin) console.log(`[AUTH] Admin detectado: ${profile.username}`);
        return done(null, profile);
    }));
} else {
    console.error('ERRO: Variaveis Discord (CLIENT_ID, CLIENT_SECRET, REDIRECT_URI) nao configuradas!');
}

app.use(passport.initialize());
app.use(passport.session());

// ==========================================
// 4. AUTENTICAÇÃO
// ==========================================
app.get('/auth/discord', (req, res, next) => {
    console.log('[AUTH] Redirecionando para o Discord...');
    passport.authenticate('discord')(req, res, next);
});

app.get('/auth/discord/callback', (req, res, next) => {
    console.log('[AUTH] Retorno do Discord recebido...');

    passport.authenticate('discord', (err, user) => {
        if (err) {
    // Captura a mensagem real independente do formato do erro
    const mensagem = err.message || err.description || (typeof err === 'string' ? err : JSON.stringify(err));
    console.error('[AUTH] Erro completo:', err);

    return res.status(500).send(`
        <div style="font-family:'Segoe UI',sans-serif;padding:50px;text-align:center;background:#0f1115;color:white;min-height:100vh;">
            <h1 style="color:#ff4757;">Erro de Conexão com o Discord</h1>
            <p style="color:#a4b0be;max-width:600px;margin:20px auto;">
                Ocorreu um erro ao validar sua conta. Verifique a Redirect URI e o Client Secret.
            </p>
            <div style="background:#1e2124;padding:20px;border-radius:10px;display:inline-block;text-align:left;border-left:5px solid #ff4757;">
                <code style="color:#ffa502;">ERRO: ${mensagem}</code>
            </div>
            <br><br>
            <a href="/" style="background:#5865F2;color:white;padding:12px 25px;text-decoration:none;border-radius:5px;font-weight:bold;">Voltar ao Início</a>
        </div>
    `);
}

        if (!user) {
            console.warn('[AUTH] Login cancelado ou não autorizado.');
            return res.redirect('/');
        }

        req.logIn(user, (loginErr) => {
            if (loginErr) {
                console.error('[AUTH] Erro ao criar sessão:', loginErr);
                return next(loginErr);
            }
            console.log(`[AUTH] Bem-vindo, ${user.username}!`);
            req.session.save(() => res.redirect('/funcionalidades'));
        });
    })(req, res, next);
});

app.get('/logout', (req, res) => {
    console.log(`[AUTH] Logout: ${req.user ? req.user.username : 'desconhecido'}`);
    req.logout(() => {
        req.session.destroy((err) => {
            if (err) console.error('[SESSÃO] Erro ao destruir sessão:', err);
            res.clearCookie('portal_historias.sid');
            res.redirect('/');
        });
    });
});

    // Redireciona /login para o fluxo correto do Discord
app.get('/login', (req, res) => {
    res.redirect('/auth/discord');
});


app.get('/entrar', (req, res) => {
    res.redirect('/auth/discord');
});
// ==========================================
// 5. MIDDLEWARES DE PROTEÇÃO
// ==========================================
const isAuth = (req, res, next) => {
    if (req.isAuthenticated()) return next();
    console.warn(`[ACESSO NEGADO] Rota: ${req.path}`);
    res.redirect('/');
};

const isAdmin = (req, res, next) => {
    if (req.isAuthenticated() && req.user.id === DISCORD_ADMIN_ID) return next();
    console.error(`[ACESSO NEGADO] Admin tentou por: ${req.user ? req.user.username : 'ANONIMO'}`);
    res.status(403).send('Acesso Negado: apenas o autor pode acessar esta área.');
};

// ==========================================
// 6. ROTAS DE PÁGINAS
// ==========================================
app.get('/', (req, res) => {
    if (req.isAuthenticated()) return res.redirect('/funcionalidades');
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/funcionalidades', isAuth, (req, res) => res.sendFile(path.join(__dirname, 'funcionalidades.html')));
app.get('/capa',            isAuth, (req, res) => res.sendFile(path.join(__dirname, 'capa.html')));
app.get('/trvida/:numero',  isAuth, (req, res) => res.sendFile(path.join(__dirname, 'capitulo.html')));
app.get('/perfil',          isAuth, (req, res) => res.sendFile(path.join(__dirname, 'perfil.html')));
app.get('/configuracoes',   isAuth, (req, res) => res.sendFile(path.join(__dirname, 'configuracoes.html')));
app.get('/dashboard',      isAdmin, (req, res) => res.sendFile(path.join(__dirname, 'dashboard.html')));

// ==========================================
// 7. API
// ==========================================

// Dados do usuário logado
app.get('/api/user', (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: 'Não autenticado' });
    res.json({
        id:       req.user.id,
        username: req.user.username,
        avatar:   req.user.avatar
            ? `https://cdn.discordapp.com/avatars/${req.user.id}/${req.user.avatar}.png`
            : 'https://cdn.discordapp.com/embed/avatars/0.png',
        isAdmin: req.user.id === DISCORD_ADMIN_ID
    });
});

// Lista todos os capítulos
app.get('/api/capitulos', isAuth, async (req, res) => {
    try {
        const dataDir = path.join(__dirname, 'data');
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

        const capitulos = fs.readdirSync(dataDir)
            .filter(f => f.startsWith('trvida') && f.endsWith('.txt'))
            .map(f => {
                const numero = parseInt(f.replace('trvida', '').replace('.txt', ''), 10);
                const stats  = fs.statSync(path.join(dataDir, f));
                return { numero, postadoEm: stats.mtime, tamanho: (stats.size / 1024).toFixed(1) + ' KB' };
            })
            .sort((a, b) => a.numero - b.numero);

        res.json(capitulos);
    } catch (err) {
        console.error('[API] Erro ao listar capitulos:', err);
        res.status(500).json({ error: 'Erro ao buscar lista de capítulos.' });
    }
});

// Lê um capítulo por URL param (/api/capitulo/1)
app.get('/api/capitulo/:numero', isAuth, (req, res) => {
    const numero   = parseInt(req.params.numero, 10);
    const filePath = path.join(__dirname, 'data', `trvida${numero}.txt`);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Capítulo ainda não postado.' });
    }

    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            console.error(`[API] Erro ao ler capitulo ${numero}:`, err);
            return res.status(500).json({ error: 'Erro interno na leitura do arquivo.' });
        }
        res.json({ numero, conteudo: data });
    });
});

// Alias para o Dashboard (/api/buscar-capitulo?numero=1)  ← ADICIONADO v11
app.get('/api/buscar-capitulo', isAuth, (req, res) => {
    const numero = parseInt(req.query.numero, 10);
    if (isNaN(numero) || numero <= 0) {
        return res.status(400).json({ error: 'Número inválido.' });
    }
    const filePath = path.join(__dirname, 'data', `trvida${numero}.txt`);
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Capítulo ainda não postado.' });
    }
    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            console.error(`[API] Erro ao ler capitulo ${numero}:`, err);
            return res.status(500).json({ error: 'Erro interno na leitura do arquivo.' });
        }
        res.json({ numero, conteudo: data });
    });
});

// Salva/edita capítulo — APENAS ADMIN
app.post('/api/salvar-capitulo', isAdmin, (req, res) => {
    const { numero, conteudo } = req.body;

    if (!numero || !conteudo) {
        return res.status(400).json({ error: 'Número e conteúdo são obrigatórios.' });
    }

    const dataDir  = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

    const filePath = path.join(dataDir, `trvida${numero}.txt`);

    fs.writeFile(filePath, conteudo, 'utf8', (err) => {
        if (err) {
            console.error(`[API] Erro ao salvar capitulo ${numero}:`, err);
            return res.status(500).json({ error: 'Erro ao gravar o arquivo.' });
        }
        console.log(`[API] Capitulo ${numero} salvo por ${req.user.username}`);
        res.json({ success: true, message: `Capítulo ${numero} salvo com sucesso!` });
    });
});

// Deleta um capítulo — APENAS ADMIN
app.delete('/api/capitulo/:numero', isAdmin, (req, res) => {
    const numero   = parseInt(req.params.numero, 10);
    const filePath = path.join(__dirname, 'data', `trvida${numero}.txt`);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Capítulo não encontrado.' });
    }

    fs.unlink(filePath, (err) => {
        if (err) {
            console.error(`[API] Erro ao deletar capitulo ${numero}:`, err);
            return res.status(500).json({ error: 'Erro ao deletar o arquivo.' });
        }
        console.log(`[API] Capitulo ${numero} deletado por ${req.user.username}`);
        res.json({ success: true, message: `Capítulo ${numero} deletado.` });
    });
});

// ==========================================
// 8. INICIAR SERVIDOR
// ==========================================
app.listen(PORT, () => {
    console.log(`\nServidor rodando em http://localhost:${PORT}`);
    console.log(`Ambiente: ${NODE_ENV}\n`);
});