
//📄 server.js - v12.1.0 (com persistência MongoDB Atlas)
//Substitui inteiro o server.js no VS Code (Ctrl+A → cola → Ctrl+S).

/**
 * ==============================================================================
 * 🚀 PORTAL DE HISTÓRIAS - SISTEMA ULTRA PREMIUM (SERVER.JS)
 * ==============================================================================
 * Versão: 12.1.0 - Persistência MongoDB Atlas
 * Stack: Node.js + Express + Passport (Discord OAuth2) + Mongoose
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
const mongoose = require('mongoose');

const app = express();

// ==========================================
// 🛠️ 1. CONFIGURAÇÕES INICIAIS
// ==========================================
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
// Localize estas linhas:
const APP_VERSION = '12.1.1'; // Atualize a versão se quiser
const APP_NAME = 'Portal de Histórias - TR: Vida';

// ADICIONE ESTA LINHA ABAIXO:
const DISCORD_PROXY_URL = 'https://discord-proxy.red2005pokemon.workers.dev';

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
const MONGO_URL = cleanEnv(process.env.MONGO_URL);
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
console.log(`🗄️  MongoDB URL:     ${MONGO_URL ? '✅ configurado' : '❌ NÃO DEFINIDO'}`);
console.log(`📂 Pasta de dados:  ${DATA_DIR}`);
console.log('='.repeat(60) + '\n');

// ==========================================
// 🗄️  1.5. CONEXÃO MONGODB + SCHEMA DE CAPÍTULOS
// ==========================================
const capituloSchema = new mongoose.Schema({
    numero: { type: Number, required: true, unique: true, index: true },
    conteudo: { type: String, required: true },
    postadoEm: { type: Date, default: Date.now },
    atualizadoEm: { type: Date, default: Date.now }
});

capituloSchema.pre('save', function(next) {
    this.atualizadoEm = new Date();
    next();
});

const Capitulo = mongoose.model('Capitulo', capituloSchema);
// ==========================================
// 🗄️ SCHEMAS: OBRAS + CAPÍTULOS DE OBRAS
// ==========================================
const obraSchema = new mongoose.Schema({
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    titulo: { type: String, required: true },
    descricao: { type: String, default: '' },
    generos: { type: [String], default: [] },
    capaUrl: { type: String, default: '' },
    dataCriacaoOriginal: { type: Date },
    status: { type: String, enum: ['em-andamento', 'concluida', 'pausada', 'oneshot'], default: 'em-andamento' },
    tipo: { type: String, enum: ['unico', 'serie'], required: true },
    conteudoUnico: { type: String, default: '' },
    ehObraPrincipal: { type: Boolean, default: false },
    postadoEm: { type: Date, default: Date.now },
    atualizadoEm: { type: Date, default: Date.now }
});
obraSchema.pre('save', function (next) { this.atualizadoEm = new Date(); next(); });
const Obra = mongoose.model('Obra', obraSchema);

const capituloObraSchema = new mongoose.Schema({
    obraSlug: { type: String, required: true, index: true },
    numero: { type: Number, required: true },
    titulo: { type: String, default: '' },
    conteudo: { type: String, required: true },
    postadoEm: { type: Date, default: Date.now },
    atualizadoEm: { type: Date, default: Date.now }
});
capituloObraSchema.index({ obraSlug: 1, numero: 1 }, { unique: true });
capituloObraSchema.pre('save', function (next) { this.atualizadoEm = new Date(); next(); });
const CapituloObra = mongoose.model('CapituloObra', capituloObraSchema);

// Helper para gerar slug
function gerarSlug(texto) {
    return String(texto || '').toLowerCase().trim()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

let mongoConectado = false;

async function conectarMongo() {
    if (!MONGO_URL) {
        console.error('❌ MONGO_URL não configurado! Capítulos não vão persistir.');
        return;
    }
    // ===== INÍCIO BLOCO PROGRESSO =====
const progressoSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true, index: true },
    username: { type: String },
    ultimoCapituloLido: { type: Number, required: true },
    lidoEm: { type: Date, default: Date.now }
});
const Progresso = mongoose.model('Progresso', progressoSchema);
// ===== FIM BLOCO PROGRESSO =====
    try {
        await mongoose.connect(MONGO_URL, {
            serverSelectionTimeoutMS: 10000
        });
        mongoConectado = true;
        console.log('✅ MongoDB Atlas conectado com sucesso!');
        await migrarArquivosParaMongo();
    } catch (err) {
        console.error('❌ Erro ao conectar no MongoDB:', err.message);
    }
}

// Migração automática: se houver trvida{N}.txt no disco, copia pro Mongo (1x só)
async function migrarArquivosParaMongo() {
    try {
        const arquivos = fs.readdirSync(DATA_DIR).filter(f => /^trvida\d+\.txt$/.test(f));
        if (arquivos.length === 0) return;
        console.log(`[MIGRAÇÃO] ${arquivos.length} arquivo(s) .txt encontrado(s). Verificando...`);
        let migrados = 0;
        for (const f of arquivos) {
            const numero = parseInt(f.replace(/\D/g, ''), 10);
            const existe = await Capitulo.findOne({ numero });
            if (!existe) {
                const conteudo = fs.readFileSync(path.join(DATA_DIR, f), 'utf8');
                const stats = fs.statSync(path.join(DATA_DIR, f));
                await Capitulo.create({ numero, conteudo, postadoEm: stats.mtime, atualizadoEm: stats.mtime });
                migrados++;
                console.log(`[MIGRAÇÃO] ✅ Cap. ${numero} importado pro MongoDB`);
            }
        }
        console.log(`[MIGRAÇÃO] Concluída. ${migrados} novo(s), ${arquivos.length - migrados} já existiam.`);
    } catch (err) {
        console.error('[MIGRAÇÃO] Erro:', err.message);
    }
}

conectarMongo();

mongoose.connection.on('disconnected', () => {
    mongoConectado = false;
    console.warn('⚠️  MongoDB desconectado.');
});
mongoose.connection.on('reconnected', () => {
    mongoConectado = true;
    console.log('✅ MongoDB reconectado.');
});

// ==========================================
// 🛡️ 2. MIDDLEWARES GLOBAIS
// ==========================================
app.set('trust proxy', 1); // Render usa proxy reverso HTTPS
app.disable('x-powered-by'); // Remove header que entrega que é Express

app.use(compression());
app.use(morgan(NODE_ENV === 'production' ? 'tiny' : 'dev'));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
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
        scope: ['identify', 'email'],
        // 🔥 ADICIONE ESTAS DUAS LINHAS ABAIXO 🔥
        tokenURL: `${DISCORD_PROXY_URL}/oauth2/token`,
        userProfileURL: `${DISCORD_PROXY_URL}/users/@me`,
        // --------------------------------------
        customHeaders: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
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
            // 🔍 Expõe a resposta real do Discord (motivo do fracasso)
            if (err.oauthError) {
                console.error(`[AUTH] OAuth status: ${err.oauthError.statusCode}`);
                console.error(`[AUTH] OAuth body:`, err.oauthError.data);
            }
            console.error(`[AUTH] CLIENT_ID usado: ${CLIENT_ID}`);
            console.error(`[AUTH] CALLBACK_URL usado: ${CALLBACK_URL}`);
            const detalhe = err.oauthError && err.oauthError.data
                ? `${err.message}\n\nDiscord respondeu:\n${err.oauthError.data}`
                : err.message;
            return res.status(500).send(renderAuthError(detalhe));
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

const requireMongo = (req, res, next) => {
    if (!mongoConectado) {
        return res.status(503).json({ error: 'Banco de dados indisponível. Tente novamente em instantes.' });
    }
    next();
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
// ==========================================
// 📄 PÁGINAS — OUTRAS OBRAS + CATÁLOGO
// ==========================================
app.get('/outras-obras', isAuth, (req, res) => enviarPagina(res, 'outras-obras.html'));
app.get('/obra/:slug', isAuth, (req, res) => enviarPagina(res, 'obra.html'));
app.get('/obra/:slug/cap/:numero', isAuth, (req, res) => enviarPagina(res, 'capitulo-outra-obra.html'));
app.get('/catalogo', isAuth, (req, res) => enviarPagina(res, 'catalogo.html'));
app.get('/editor-obras', isAdmin, (req, res) => enviarPagina(res, 'editor-obras.html'));

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

function contarPalavras(txt) {
    return (txt || '').trim().split(/\s+/).filter(Boolean).length;
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

app.get('/api/capitulos', isAuth, requireMongo, async (req, res) => {
    try {
        const docs = await Capitulo.find({}, 'numero conteudo postadoEm atualizadoEm').sort({ numero: 1 }).lean();
        const lista = docs.map(d => {
            const palavras = contarPalavras(d.conteudo);
            const tamanhoBytes = Buffer.byteLength(d.conteudo || '', 'utf8');
            return {
                numero: d.numero,
                postadoEm: d.postadoEm,
                atualizadoEm: d.atualizadoEm,
                tamanho: (tamanhoBytes / 1024).toFixed(1) + ' KB',
                palavras
            };
        });
        res.json(lista);
    } catch (err) {
        console.error('[API] Erro listar:', err);
        res.status(500).json({ error: 'Erro ao buscar capítulos.' });
    }
});

app.get('/api/capitulo/:numero', isAuth, requireMongo, async (req, res) => {
    const numero = parseInt(req.params.numero, 10);
    if (isNaN(numero) || numero < 1) return res.status(400).json({ error: 'Número inválido.' });
    try {
        const doc = await Capitulo.findOne({ numero }).lean();
        if (!doc) return res.status(404).json({ error: 'Capítulo ainda não postado.' });
        res.json({
            numero: doc.numero,
            conteudo: doc.conteudo,
            palavras: contarPalavras(doc.conteudo),
            postadoEm: doc.postadoEm,
            atualizadoEm: doc.atualizadoEm
        });
    } catch (err) {
        console.error('[API] Erro buscar capítulo:', err);
        res.status(500).json({ error: 'Erro na leitura.' });
    }
});

app.post('/api/salvar-capitulo', isAdmin, requireMongo, async (req, res) => {
    const { numero, conteudo } = req.body;
    if (!numero || !conteudo) return res.status(400).json({ error: 'Número e conteúdo obrigatórios.' });
    const num = parseInt(numero, 10);
    if (isNaN(num) || num < 1) return res.status(400).json({ error: 'Número inválido.' });
    try {
        const doc = await Capitulo.findOneAndUpdate(
            { numero: num },
            { $set: { conteudo: String(conteudo), atualizadoEm: new Date() }, $setOnInsert: { postadoEm: new Date() } },
            { upsert: true, new: true }
        );
        console.log(`[EDITOR] Cap. ${num} salvo no MongoDB por ${req.user.username} (${doc.conteudo.length} chars)`);
        res.json({ success: true, message: `Capítulo ${num} salvo com sucesso!` });
    } catch (err) {
        console.error('[EDITOR] Erro salvar:', err);
        res.status(500).json({ error: 'Erro ao salvar.' });
    }
});

app.delete('/api/capitulo/:numero', isAdmin, requireMongo, async (req, res) => {
    const num = parseInt(req.params.numero, 10);
    if (isNaN(num) || num < 1) return res.status(400).json({ error: 'Número inválido.' });
    try {
        const result = await Capitulo.deleteOne({ numero: num });
        if (result.deletedCount === 0) return res.status(404).json({ error: 'Capítulo não encontrado.' });
        console.log(`[EDITOR] Cap. ${num} deletado por ${req.user.username}`);
        res.json({ success: true, message: `Capítulo ${num} excluído.` });
    } catch (err) {
        console.error('[EDITOR] Erro deletar:', err);
        res.status(500).json({ error: 'Erro ao deletar.' });
    }
});

app.get('/api/stats', isAuth, requireMongo, async (req, res) => {
    try {
        const docs = await Capitulo.find({}, 'numero conteudo postadoEm').sort({ numero: 1 }).lean();
        const totalPalavras = docs.reduce((acc, d) => acc + contarPalavras(d.conteudo), 0);
        res.json({
            totalCapitulos: docs.length,
            totalPalavras,
            tempoLeituraEstimado: Math.ceil(totalPalavras / 200) + ' min',
            ultimoPublicado: docs.length > 0 ? docs[docs.length - 1].postadoEm : null,
            versao: APP_VERSION
        });
    } catch (err) {
        console.error('[API] Erro stats:', err);
        res.status(500).json({ error: 'Erro ao buscar estatísticas.' });
    }
});

app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        version: APP_VERSION,
        uptime: Math.round(process.uptime()) + 's',
        mongo: mongoConectado ? 'connected' : 'disconnected'
    });
});

// ===== INÍCIO BLOCO ROTAS PROGRESSO =====

// Salva o último capítulo que o usuário leu
app.post('/api/progresso', isAuth, requireMongo, async (req, res) => {
    const { numero } = req.body;
    const num = parseInt(numero, 10);
    if (isNaN(num) || num < 1) return res.status(400).json({ error: 'Número inválido.' });
    try {
        await Progresso.findOneAndUpdate(
            { userId: req.user.id },
            { $set: { username: req.user.username, ultimoCapituloLido: num, lidoEm: new Date() } },
            { upsert: true, new: true }
        );
        res.json({ success: true });
    } catch (err) {
        console.error('[PROGRESSO] Erro salvar:', err.message);
        res.status(500).json({ error: 'Erro ao salvar progresso.' });
    }
});

// Retorna o último capítulo lido (usado pelo frontend se quiser exibir)
app.get('/api/progresso', isAuth, requireMongo, async (req, res) => {
    try {
        const doc = await Progresso.findOne({ userId: req.user.id }).lean();
        res.json({ ultimoCapituloLido: doc ? doc.ultimoCapituloLido : null });
    } catch (err) {
        console.error('[PROGRESSO] Erro buscar:', err.message);
        res.status(500).json({ error: 'Erro ao buscar progresso.' });
    }
});

// Redireciona o usuário pro último capítulo lido (ou pro 1 se nunca leu nada)
app.get('/continuar', isAuth, async (req, res) => {
    try {
        if (!mongoConectado) return res.redirect('/trvida/1');
        const progresso = await Progresso.findOne({ userId: req.user.id }).lean();
        if (progresso && progresso.ultimoCapituloLido) {
            // Confirma que o capítulo ainda existe (caso tenha sido deletado)
            const existe = await Capitulo.findOne({ numero: progresso.ultimoCapituloLido }).lean();
            if (existe) return res.redirect(`/trvida/${progresso.ultimoCapituloLido}`);
        }
        // Fallback: vai pro primeiro capítulo existente, ou pro 1
        const primeiro = await Capitulo.findOne().sort({ numero: 1 }).lean();
        return res.redirect(`/trvida/${primeiro ? primeiro.numero : 1}`);
    } catch (err) {
        console.error('[CONTINUAR] Erro:', err.message);
        return res.redirect('/trvida/1');
    }
});

// ==========================================
// 📊 API — OBRAS E CAPÍTULOS DE OBRAS
// ==========================================
app.get('/api/obras', isAuth, requireMongo, async (req, res) => {
    try {
        const obras = await Obra.find({ ehObraPrincipal: { $ne: true } }).sort({ atualizadoEm: -1 }).lean();
        res.json(obras);
    } catch (err) { console.error('[OBRAS] listar:', err); res.status(500).json({ error: err.message }); }
});

app.get('/api/obra/:slug', isAuth, requireMongo, async (req, res) => {
    try {
        const obra = await Obra.findOne({ slug: req.params.slug }).lean();
        if (!obra) return res.status(404).json({ error: 'Obra não encontrada.' });
        let capitulos = [];
        if (obra.tipo === 'serie') {
            const caps = await CapituloObra.find({ obraSlug: obra.slug }).sort({ numero: 1 }).lean();
            capitulos = caps.map(c => ({
                numero: c.numero, titulo: c.titulo,
                postadoEm: c.postadoEm, atualizadoEm: c.atualizadoEm,
                palavras: contarPalavras(c.conteudo)
            }));
        }
        res.json({ ...obra, capitulos });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/obra/:slug/cap/:numero', isAuth, requireMongo, async (req, res) => {
    const numero = parseInt(req.params.numero, 10);
    try {
        const cap = await CapituloObra.findOne({ obraSlug: req.params.slug, numero }).lean();
        if (!cap) return res.status(404).json({ error: 'Capítulo não encontrado.' });
        const obra = await Obra.findOne({ slug: req.params.slug }, 'titulo').lean();
        res.json({ ...cap, obraTitulo: obra ? obra.titulo : '', palavras: contarPalavras(cap.conteudo) });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/salvar-obra', isAdmin, requireMongo, async (req, res) => {
    const { slug, titulo, descricao, generos, capaUrl, dataCriacaoOriginal, status, tipo, conteudoUnico } = req.body;
    if (!titulo || !tipo) return res.status(400).json({ error: 'Título e tipo obrigatórios.' });
    const finalSlug = gerarSlug(slug || titulo);
    if (!finalSlug) return res.status(400).json({ error: 'Slug inválido.' });
    try {
        const generosArr = Array.isArray(generos) ? generos
            : (generos ? String(generos).split(',').map(g => g.trim()).filter(Boolean) : []);
        const doc = await Obra.findOneAndUpdate(
            { slug: finalSlug },
            {
                $set: {
                    titulo, descricao: descricao || '', generos: generosArr,
                    capaUrl: capaUrl || '',
                    dataCriacaoOriginal: dataCriacaoOriginal ? new Date(dataCriacaoOriginal) : null,
                    status: status || 'em-andamento', tipo,
                    conteudoUnico: tipo === 'unico' ? (conteudoUnico || '') : '',
                    atualizadoEm: new Date()
                },
                $setOnInsert: { postadoEm: new Date(), ehObraPrincipal: false }
            },
            { upsert: true, new: true }
        );
        res.json({ success: true, obra: doc });
    } catch (err) {
        if (err.code === 11000) return res.status(409).json({ error: 'Já existe obra com esse slug.' });
        res.status(500).json({ error: err.message });
    }
});

app.delete('/api/obra/:slug', isAdmin, requireMongo, async (req, res) => {
    try {
        const obra = await Obra.findOne({ slug: req.params.slug }).lean();
        if (!obra) return res.status(404).json({ error: 'Obra não encontrada.' });
        if (obra.ehObraPrincipal) return res.status(403).json({ error: 'Não é possível excluir a obra principal.' });
        await Obra.deleteOne({ slug: req.params.slug });
        await CapituloObra.deleteMany({ obraSlug: req.params.slug });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/salvar-cap-obra', isAdmin, requireMongo, async (req, res) => {
    const { obraSlug, numero, titulo, conteudo } = req.body;
    const num = parseInt(numero, 10);
    if (!obraSlug || isNaN(num) || num < 1 || !conteudo) return res.status(400).json({ error: 'Dados inválidos.' });
    try {
        const obraExiste = await Obra.findOne({ slug: obraSlug, tipo: 'serie' }).lean();
        if (!obraExiste) return res.status(404).json({ error: 'Obra (tipo série) não encontrada.' });
        await CapituloObra.findOneAndUpdate(
            { obraSlug, numero: num },
            { $set: { titulo: titulo || '', conteudo: String(conteudo), atualizadoEm: new Date() }, $setOnInsert: { postadoEm: new Date() } },
            { upsert: true, new: true }
        );
        await Obra.updateOne({ slug: obraSlug }, { $set: { atualizadoEm: new Date() } });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/obra/:slug/cap/:numero', isAdmin, requireMongo, async (req, res) => {
    const num = parseInt(req.params.numero, 10);
    try {
        const r = await CapituloObra.deleteOne({ obraSlug: req.params.slug, numero: num });
        if (r.deletedCount === 0) return res.status(404).json({ error: 'Capítulo não encontrado.' });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// TR: Vida (catálogo + metadados)
app.get('/api/tr-vida-info', isAuth, requireMongo, async (req, res) => {
    try {
        const obra = await Obra.findOne({ ehObraPrincipal: true }).lean();
        const capitulos = await Capitulo.find({}, 'numero conteudo postadoEm atualizadoEm').sort({ numero: 1 }).lean();
        res.json({
            obra,
            capitulos: capitulos.map(c => ({
                numero: c.numero, postadoEm: c.postadoEm, atualizadoEm: c.atualizadoEm,
                palavras: contarPalavras(c.conteudo)
            }))
        });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/salvar-tr-vida-info', isAdmin, requireMongo, async (req, res) => {
    const { titulo, descricao, generos, capaUrl, dataCriacaoOriginal, status } = req.body;
    try {
        const generosArr = Array.isArray(generos) ? generos
            : (generos ? String(generos).split(',').map(g => g.trim()).filter(Boolean) : []);
        await Obra.findOneAndUpdate(
            { slug: 'tr-vida' },
            {
                $set: {
                    titulo: titulo || 'TR: Vida', descricao: descricao || '',
                    generos: generosArr, capaUrl: capaUrl || '',
                    dataCriacaoOriginal: dataCriacaoOriginal ? new Date(dataCriacaoOriginal) : null,
                    status: status || 'em-andamento', tipo: 'serie', ehObraPrincipal: true,
                    atualizadoEm: new Date()
                },
                $setOnInsert: { postadoEm: new Date() }
            },
            { upsert: true, new: true }
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
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

// 🔥 LINHAS QUE ESTAVAM FALTANDO 🔥
app.use(express.static(PUBLIC_DIR, { dotfiles: 'deny', index: false, maxAge: '1h' }));
app.use('/imagens', express.static(IMAGES_DIR, { maxAge: '7d' }));

// Página 404 customizada (vem ANTES do error handler)
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

// Error handler global (SEMPRE por último, com 4 parâmetros)
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

// ==========================================
// 🚀 9. INICIALIZAÇÃO E SHUTDOWN GRACIOSO
// ==========================================
const server = app.listen(PORT, () => {
    console.log(`✅ SERVIDOR v${APP_VERSION} ATIVO em http://localhost:${PORT}`);
    console.log(`🚀 Aliases de login: /auth/discord, /login, /entrar, /signin, /sign-in, /discord\n`);
});

process.on('SIGTERM', async () => {
    console.log('\n[SHUTDOWN] Encerrando servidor com graça...');
    try { await mongoose.connection.close(); } catch (e) {}
    server.close(() => process.exit(0));
});

process.on('uncaughtException', (err) => console.error('[FATAL]', err));
process.on('unhandledRejection', (err) => console.error('[PROMISE REJECTED]', err));
