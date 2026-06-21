//📄 server.js - v12.2.0 (com persistência MongoDB Atlas + Sistema Inteligente)
//Substitui inteiro o server.js no VS Code (Ctrl+A → cola → Ctrl+S).

/**
 * ==============================================================================
 * 🚀 PORTAL DE HISTÓRIAS - SISTEMA ULTRA PREMIUM (SERVER.JS)
 * ==============================================================================
 * Versão: 12.2.0 - Sistema Multi-Obras Inteligente
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
const APP_VERSION = '12.2.0';
const APP_NAME = 'Portal de Histórias - Tempus Requiém: ጀምር';

const DISCORD_PROXY_URL = 'https://discord-proxy.red2005pokemon.workers.dev';

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
// 🗄️  1.5. CONEXÃO MONGODB + SCHEMAS
// ==========================================
const capituloSchema = new mongoose.Schema({
    numero: { type: Number, required: true, unique: true, index: true },
    conteudo: { type: String, required: true },
    postadoEm: { type: Date, default: Date.now },
    atualizadoEm: { type: Date, default: Date.now }
});
capituloSchema.pre('save', function(next) { this.atualizadoEm = new Date(); next(); });
const Capitulo = mongoose.model('Capitulo', capituloSchema);

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

const progressoSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true, index: true },
    username: { type: String },
    ultimoCapituloLido: { type: Number, required: true },
    lidoEm: { type: Date, default: Date.now }
});
const Progresso = mongoose.model('Progresso', progressoSchema);

// Helper para gerar slug
function gerarSlug(texto) {
    return String(texto || '').toLowerCase().trim()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function contarPalavras(str) {
    return str ? str.trim().split(/\s+/).length : 0;
}

let mongoConectado = false;
async function conectarMongo() {
    if (!MONGO_URL) return;
    try {
        await mongoose.connect(MONGO_URL, { serverSelectionTimeoutMS: 10000 });
        mongoConectado = true;
        console.log('✅ MongoDB Atlas conectado!');
        await migrarArquivosParaMongo();
    } catch (err) { console.error('❌ Erro MongoDB:', err.message); }
}

async function migrarArquivosParaMongo() {
    try {
        const arquivos = fs.readdirSync(DATA_DIR).filter(f => /^trvida\d+\.txt$/.test(f));
        if (arquivos.length === 0) return;
        for (const f of arquivos) {
            const numero = parseInt(f.replace(/\D/g, ''), 10);
            const existe = await Capitulo.findOne({ numero });
            if (!existe) {
                const conteudo = fs.readFileSync(path.join(DATA_DIR, f), 'utf8');
                const stats = fs.statSync(path.join(DATA_DIR, f));
                await Capitulo.create({ numero, conteudo, postadoEm: stats.mtime, atualizadoEm: stats.mtime });
            }
        }
    } catch (err) { console.error('[MIGRAÇÃO] Erro:', err.message); }
}
conectarMongo();

// ==========================================
// 🛡️ 2. MIDDLEWARES GLOBAIS
// ==========================================
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(compression());
app.use(morgan(NODE_ENV === 'production' ? 'tiny' : 'dev'));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use(cookieParser(SESSION_SECRET));
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'cross-origin' }, crossOriginEmbedderPolicy: false }));

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
    cookie: { httpOnly: true, secure: NODE_ENV === 'production', sameSite: 'lax', maxAge: 1000 * 60 * 60 * 24 * 30 }
}));

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

if (CLIENT_ID && CLIENT_SECRET && CALLBACK_URL) {
    passport.use(new DiscordStrategy({
        clientID: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
        callbackURL: CALLBACK_URL,
        scope: ['identify', 'email'],
        tokenURL: `${DISCORD_PROXY_URL}/oauth2/token`,
        userProfileURL: `${DISCORD_PROXY_URL}/users/@me`,
        customHeaders: { 'User-Agent': 'Mozilla/5.0' }
    }, (accessToken, refreshToken, profile, done) => {
        profile.isAdmin = (profile.id === DISCORD_ADMIN_ID);
        return done(null, profile);
    }));
}

app.use(passport.initialize());
app.use(passport.session());

// ==========================================
// 🚪 4. AUTENTICAÇÃO
// ==========================================
const startDiscordAuth = (req, res, next) => passport.authenticate('discord')(req, res, next);
['/auth/discord', '/login', '/entrar', '/signin', '/sign-in', '/discord'].forEach(route => app.get(route, startDiscordAuth));

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
            res.clearCookie('portal_historias.sid');
            res.redirect('/');
        });
    });
});

// ==========================================
// 🛡️ 5. MIDDLEWARES DE PROTEÇÃO
// ==========================================
const isAuth = (req, res, next) => req.isAuthenticated() ? next() : res.redirect('/');
const isAdmin = (req, res, next) => {
    if (req.isAuthenticated() && req.user.id === DISCORD_ADMIN_ID) return next();
    if (req.path.startsWith('/api/')) return res.status(403).json({ error: 'Permissão negada.' });
    res.redirect('/');
};
const requireMongo = (req, res, next) => mongoConectado ? next() : res.status(503).json({ error: 'Banco de dados offline.' });

// ==========================================
// ✍️ 6. API — EDITOR E CAPÍTULOS GLOBAIS
// ==========================================
app.get('/api/capitulos', isAuth, requireMongo, async (req, res) => {
    try {
        const docs = await Capitulo.find({}, 'numero postadoEm atualizadoEm').sort({ numero: 1 }).lean();
        res.json(docs);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/capitulo/:numero', isAuth, requireMongo, async (req, res) => {
    const num = parseInt(req.params.numero, 10);
    try {
        const doc = await Capitulo.findOne({ numero: num }).lean();
        if (!doc) return res.status(404).json({ error: 'Capítulo não encontrado.' });
        res.json({ ...doc, palavras: contarPalavras(doc.conteudo) });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/salvar-capitulo', isAdmin, requireMongo, async (req, res) => {
    const { numero, conteudo } = req.body;
    const num = parseInt(numero, 10);
    try {
        await Capitulo.findOneAndUpdate(
            { numero: num },
            { $set: { conteudo: String(conteudo), atualizadoEm: new Date() }, $setOnInsert: { postadoEm: new Date() } },
            { upsert: true, new: true }
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/capitulo/:numero', isAdmin, requireMongo, async (req, res) => {
    const num = parseInt(req.params.numero, 10);
    try {
        await Capitulo.deleteOne({ numero: num });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/stats', isAuth, requireMongo, async (req, res) => {
    try {
        const docs = await Capitulo.find({}, 'numero conteudo postadoEm').sort({ numero: 1 }).lean();
        const totalPalavras = docs.reduce((acc, d) => acc + contarPalavras(d.conteudo), 0);
        res.json({ totalCapitulos: docs.length, totalPalavras, tempoLeituraEstimado: Math.ceil(totalPalavras / 200) + ' min', versao: APP_VERSION });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================================
// 📈 7. ROTAS DE PROGRESSO
// ==========================================
app.post('/api/progresso', isAuth, requireMongo, async (req, res) => {
    const { numero } = req.body;
    try {
        await Progresso.findOneAndUpdate(
            { userId: req.user.id },
            { $set: { username: req.user.username, ultimoCapituloLido: parseInt(numero, 10), lidoEm: new Date() } },
            { upsert: true }
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/progresso', isAuth, requireMongo, async (req, res) => {
    try {
        const doc = await Progresso.findOne({ userId: req.user.id }).lean();
        res.json({ ultimoCapituloLido: doc ? doc.ultimoCapituloLido : null });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/continuar', isAuth, async (req, res) => {
    try {
        const prog = await Progresso.findOne({ userId: req.user.id }).lean();
        if (prog) return res.redirect(`/trvida/${prog.ultimoCapituloLido}`);
        res.redirect('/trvida/1');
    } catch (err) { res.redirect('/trvida/1'); }
});

// ==========================================
// 🚀 8. ROTAS INTELIGENTES DE OBRAS (ATUALIZADO)
// ==========================================

// Rota de visualização dinâmica
app.get('/obra/:slug', isAuth, (req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, 'capa-detalhes.html'));
});

app.get('/api/obras', isAuth, requireMongo, async (req, res) => {
    try {
        const obras = await Obra.find({ ehObraPrincipal: { $ne: true } }).sort({ atualizadoEm: -1 }).lean();
        res.json(obras);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/obra/:slug', isAuth, requireMongo, async (req, res) => {
    try {
        const { slug } = req.params;
        let obra;
        if (slug === 'tr-vida' || slug === 'tempus-requiem-begin') {
            obra = await Obra.findOne({ ehObraPrincipal: true }).lean();
        } else {
            obra = await Obra.findOne({ slug }).lean();
        }
        if (!obra) return res.status(404).json({ error: 'Obra não encontrada.' });

        let capitulos = [];
        if (obra.ehObraPrincipal) {
            const caps = await Capitulo.find({}, 'numero conteudo postadoEm atualizadoEm').sort({ numero: 1 }).lean();
            capitulos = caps.map(c => ({ numero: c.numero, titulo: `Capítulo ${c.numero}`, postadoEm: c.postadoEm, palavras: contarPalavras(c.conteudo) }));
        } else if (obra.tipo === 'serie') {
            const caps = await CapituloObra.find({ obraSlug: obra.slug }).sort({ numero: 1 }).lean();
            capitulos = caps.map(c => ({ numero: c.numero, titulo: c.titulo || `Capítulo ${c.numero}`, postadoEm: c.postadoEm, palavras: contarPalavras(c.conteudo) }));
        }
        res.json({ ...obra, capitulos });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/salvar-obra', isAdmin, requireMongo, async (req, res) => {
    const { slug, titulo, descricao, generos, capaUrl, status, tipo, conteudoUnico } = req.body;
    const finalSlug = gerarSlug(slug || titulo);
    try {
        const doc = await Obra.findOneAndUpdate(
            { slug: finalSlug },
            { $set: { titulo, descricao, generos, capaUrl, status, tipo, conteudoUnico, atualizadoEm: new Date() }, $setOnInsert: { postadoEm: new Date(), ehObraPrincipal: false } },
            { upsert: true, new: true }
        );
        res.json({ success: true, obra: doc });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/obra/:slug', isAdmin, requireMongo, async (req, res) => {
    try {
        await Obra.deleteOne({ slug: req.params.slug });
        await CapituloObra.deleteMany({ obraSlug: req.params.slug });
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/salvar-cap-obra', isAdmin, requireMongo, async (req, res) => {
    const { obraSlug, numero, titulo, conteudo } = req.body;
    try {
        await CapituloObra.findOneAndUpdate(
            { obraSlug, numero },
            { $set: { titulo, conteudo, atualizadoEm: new Date() }, $setOnInsert: { postadoEm: new Date() } },
            { upsert: true }
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// TR: Vida Principal
app.get('/api/tr-vida-info', isAuth, requireMongo, async (req, res) => {
    try {
        const obra = await Obra.findOne({ ehObraPrincipal: true }).lean();
        const caps = await Capitulo.find({}, 'numero conteudo postadoEm').sort({ numero: 1 }).lean();
        res.json({ obra, capitulos: caps.map(c => ({ numero: c.numero, postadoEm: c.postadoEm, palavras: contarPalavras(c.conteudo) })) });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/salvar-tr-vida-info', isAdmin, requireMongo, async (req, res) => {
    const { titulo, descricao, generos, capaUrl } = req.body;
    try {
        await Obra.findOneAndUpdate(
            { slug: 'tr-vida' },
            { $set: { titulo, descricao, generos, capaUrl, ehObraPrincipal: true, tipo: 'serie', atualizadoEm: new Date() } },
            { upsert: true }
        );
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ==========================================
// 📂 9. ARQUIVOS ESTÁTICOS + SERVIDOR
// ==========================================
app.use(express.static(PUBLIC_DIR));
app.use('/imagens', express.static(IMAGES_DIR));

app.use((req, res) => {
    res.status(404).send('Página não encontrada.');
});

const server = app.listen(PORT, () => {
    console.log(`✅ SERVIDOR v${APP_VERSION} ATIVO em http://localhost:${PORT}`);
});

process.on('SIGTERM', async () => {
    await mongoose.connection.close();
    server.close(() => process.exit(0));
});
