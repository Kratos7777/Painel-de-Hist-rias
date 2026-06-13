/**
 * ==============================================================================
 * PORTAL TR: VIDA - O TRONCO (SERVER-SIDE CORE) - ARQUITETURA DE FLUXO NATURAL
 * ==============================================================================
 * Versão: 10.1.0 (Refatorado com Fluxo Natural)
 *
 * Este arquivo é o Tronco central do ecossistema, projetado para que cada
 * componente leve naturalmente ao próximo, como um sistema biológico.
 * A lógica flui de forma orgânica, sem redundâncias, focando na eficiência
 * e na clareza da interconexão entre as bases.
 *
 * ESTRUTURA LÓGICA (FLUXO NATURAL):
 * 1.  SEMENTE: Configurações Essenciais (Onde tudo começa)
 * 2.  CASCA: Proteção e Preparação (Defesa e alicerce para o fluxo)
 * 3.  RAÍZES: Autenticação (Nutrição para o acesso)
 * 4.  SEIVA: Fluxo de Dados e Lógica Central (Onde a vida acontece)
 * 5.  FRUTOS: API de Dados (A colheita de informações)
 * 6.  MONITORAMENTO E CICATRIZAÇÃO: Tratamento de Erros e Inicialização (Saúde e início da vida)
 * ==============================================================================
 */

// ------------------------------------------------------------------------------
// 1. A SEMENTE: CONFIGURAÇÕES ESSENCIAIS
// (Importações e variáveis globais que dão vida ao servidor)
// ------------------------------------------------------------------------------
require('dotenv').config();

const express = require('express');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const path = require('path');
const fs = require('fs');
const util = require('util');
const compression = require('compression');
const morgan = require('morgan');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');

// Promisificação para fluxo assíncrono natural
const readdir = util.promisify(fs.readdir);
const readFile = util.promisify(fs.readFile);

const app = express();

// Definição de Caminhos (Raízes do Sistema de Arquivos)
const PATHS = {
    PUBLIC: path.join(__dirname, 'public'),
    DATA: path.join(__dirname, 'data'),
    LOGS: path.join(__dirname, 'logs'),
    IMAGENS: path.join(__dirname, 'public', 'imagens')
};

// ------------------------------------------------------------------------------
// 2. A CASCA: PROTEÇÃO E PREPARAÇÃO
// (Middlewares que protegem e preparam as requisições para o processamento)
// ------------------------------------------------------------------------------
app.use(helmet({
    contentSecurityPolicy: false, // Permitir carregamento de assets externos de forma fluida
    crossOriginEmbedderPolicy: false
}));
app.use(cors());

// Limitador de requisições para evitar sobrecarga
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    message: "O servidor precisa respirar. Tente novamente em 15 minutos."
});
app.use('/api/', limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
const SESSION_SECRET = process.env.SESSION_SECRET || 'raiz_mestra_trvida_v10';

app.use(cookieParser(SESSION_SECRET));
app.use(compression()); // Comprime dados para transporte rápido
app.use(morgan('dev')); // Monitora o fluxo no terminal

// Gestão de Sessão (Memória do Tronco)
app.use(session({
    secret: SESSION_SECRET,
    resave: true, // Garante que a sessão seja salva de volta na loja
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 * 24 * 7 // 7 dias de vida
    }
}));

// ------------------------------------------------------------------------------
// 3. AS RAÍZES: AUTENTICAÇÃO
// (Nutrição essencial para controlar o acesso aos ramos)
// ------------------------------------------------------------------------------
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

if (process.env.CLIENT_ID) {
    passport.use(new DiscordStrategy({
        clientID: process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET,
        callbackURL: process.env.REDIRECT_URI,
        scope: ['identify', 'email']
    }, (at, rt, profile, done) => {
        process.nextTick(() => done(null, profile));
    }));
}

app.use(passport.initialize());
app.use(passport.session());

// Middleware de Proteção (Garante que apenas seres autorizados acessem os ramos)
const isAuth = (req, res, next) => {
    if (req.isAuthenticated()) return next();
    
    // Se for uma chamada de API, retorna erro 401 em vez de redirecionar
    if (req.originalUrl.startsWith('/api/')) {
        return res.status(401).json({ success: false, error: "Sessão expirada ou não autenticada." });
    }
    
    res.redirect('/');
};

// ------------------------------------------------------------------------------
// 4. A SEIVA: FLUXO DE DADOS E LÓGICA CENTRAL
// (Rotas que guiam o usuário através do portal e preparam os dados)
// ------------------------------------------------------------------------------
// Servindo Arquivos Estáticos (A base da árvore)
app.use(express.static(PATHS.PUBLIC));
app.use('/imagens', express.static(PATHS.IMAGENS)); // Garante que a pasta imagens seja acessível para a capa

app.get('/', (req, res) => {
    if (req.isAuthenticated()) return res.redirect('/capa');
    res.sendFile(path.join(PATHS.PUBLIC, 'index.html'));
});

app.get('/auth/discord', passport.authenticate('discord'));
app.get('/auth/discord/callback',
    passport.authenticate('discord', { failureRedirect: '/' }),
    (req, res) => {
        // Salva a sessão explicitamente antes do redirecionamento para garantir persistência
        req.session.save((err) => {
            if (err) {
                console.error("Erro ao salvar sessão no callback:", err);
                return res.redirect('/');
            }
            res.redirect('/capa');
        });
    }
);

app.get('/capa', isAuth, (req, res) => res.sendFile(path.join(PATHS.PUBLIC, 'capa.html')));
app.get('/perfil', isAuth, (req, res) => res.sendFile(path.join(PATHS.PUBLIC, 'perfil.html')));
app.get('/configuracoes', isAuth, (req, res) => res.sendFile(path.join(PATHS.PUBLIC, 'configuracoes.html')));

app.get('/ler/:id', isAuth, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    
    // Verifica se o capítulo existe usando a lógica de busca inteligente
    const stories = await getStoriesList();
    const exists = stories.some(s => s.id === id);

    console.log(`[TRONCO] Verificando existência do capítulo ${id}: ${exists ? 'ENCONTRADO' : 'NÃO ENCONTRADO'}`);

    if (exists) {
        res.sendFile(path.join(PATHS.PUBLIC, 'capitulo.html'));
    } else {
        res.redirect('/capa?error=nao_encontrado');
    }
});

app.get('/logout', (req, res) => {
    req.logout(() => {
        req.session.destroy();
        res.redirect('/');
    });
});

// Funções auxiliares para manipulação de dados (alimentam a API de Frutos)
async function getStoriesList() {
    const files = await readdir(PATHS.DATA);
    return files
        .filter(f => f.startsWith('trvida') && f.endsWith('.txt'))
        .map(f => {
            const id = parseInt(f.replace('trvida', '').replace('.txt', ''), 10);
            return { id, title: `Capítulo ${id}`, url: `/ler/${id}` };
        })
        .filter(story => !isNaN(story.id)) // Remove obras fantasmas (arquivos que não têm ID numérico válido)
        .sort((a, b) => a.id - b.id);
}

async function getStoryContent(id) {
    const files = await readdir(PATHS.DATA);
    // Busca inteligente: encontra o arquivo que corresponde ao ID numérico, 
    // ignorando zeros à esquerda (ex: trvida1.txt ou trvida01.txt)
    const fileName = files.find(f => {
        const match = f.match(/^trvida(\d+)\.txt$/);
        return match && parseInt(match[1], 10) === parseInt(id, 10);
    });

    if (fileName) {
        const filePath = path.join(PATHS.DATA, fileName);
        const content = await readFile(filePath, 'utf8');
        return { id: parseInt(id, 10), content, stats: { words: content.split(/\s+/).length } };
    }
    return null;
}

// ------------------------------------------------------------------------------
// 5. OS FRUTOS: API DE DADOS
// (Rotas que expõem os dados processados pela Seiva)
// ------------------------------------------------------------------------------

// Rota para obter o próximo ID de capítulo disponível
app.get("/api/stories/next-id", isAuth, async (req, res) => {
    try {
        const stories = await getStoriesList();
        const maxId = stories.reduce((max, story) => Math.max(max, story.id), 0);
        res.json({ success: true, nextId: maxId + 1 });
    } catch (err) {
        console.error("Erro ao obter próximo ID:", err);
        res.status(500).json({ success: false, error: "Erro ao obter próximo ID." });
    }
});

// Rota para salvar (criar/atualizar) um capítulo
app.post("/api/stories/save", isAuth, async (req, res) => {
    const { id, content } = req.body;
    if (!id || !content) {
        return res.status(400).json({ success: false, error: "ID e conteúdo são obrigatórios." });
    }

    const parsedId = parseInt(id, 10);
    if (isNaN(parsedId) || parsedId <= 0) {
        return res.status(400).json({ success: false, error: "ID de capítulo inválido." });
    }

    try {
        const fileName = `trvida${parsedId}.txt`;
        const filePath = path.join(PATHS.DATA, fileName);
        await util.promisify(fs.writeFile)(filePath, content, "utf8");
        res.json({ success: true, message: `Capítulo ${parsedId} salvo com sucesso.` });
    } catch (err) {
        console.error("Erro ao salvar capítulo:", err);
        res.status(500).json({ success: false, error: "Erro ao salvar capítulo." });
    }
});

// Rota para deletar um capítulo
app.delete("/api/stories/delete/:id", isAuth, async (req, res) => {
    const id = req.params.id;
    const parsedId = parseInt(id, 10);
    if (isNaN(parsedId) || parsedId <= 0) {
        return res.status(400).json({ success: false, error: "ID de capítulo inválido." });
    }

    try {
        const files = await readdir(PATHS.DATA);
        const fileNameToDelete = files.find(f => {
            const match = f.match(/^trvida(\d+)\.txt$/);
            return match && parseInt(match[1], 10) === parsedId;
        });

        if (fileNameToDelete) {
            const filePath = path.join(PATHS.DATA, fileNameToDelete);
            await util.promisify(fs.unlink)(filePath);
            res.json({ success: true, message: `Capítulo ${parsedId} deletado com sucesso.` });
        } else {
            res.status(404).json({ success: false, error: "Capítulo não encontrado para exclusão." });
        }
    } catch (err) {
        console.error("Erro ao deletar capítulo:", err);
        res.status(500).json({ success: false, error: "Erro ao deletar capítulo." });
    }
});

// ------------------------------------------------------------------------------
// 5. OS FRUTOS: API DE DADOS
// (Rotas que expõem os dados processados pela Seiva)
// ------------------------------------------------------------------------------
app.get('/api/stories/list', isAuth, async (req, res) => {
    try {
        const stories = await getStoriesList();
        res.json({ success: true, stories });
    } catch (err) {
        console.error("Erro na colheita de dados:", err);
        res.status(500).json({ success: false, error: "Erro na colheita de dados." });
    }
});

app.get('/api/stories/content/:id', isAuth, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
        return res.status(400).json({ success: false, error: "ID de capítulo inválido." });
    }

    try {
        const story = await getStoryContent(id);
        if (story) {
            res.json({ success: true, ...story });
        } else {
            res.status(404).json({ success: false, error: "Capítulo inexistente." });
        }
    } catch (err) {
        console.error("Erro ao processar o conteúdo do capítulo:", err);
        res.status(500).json({ success: false, error: "Erro ao processar o conteúdo." });
    }
});

// ------------------------------------------------------------------------------
// 6. MONITORAMENTO E CICATRIZAÇÃO: TRATAMENTO DE ERROS E INICIALIZAÇÃO
// (Garante a saúde do tronco e o inicia para a vida)
// ------------------------------------------------------------------------------
app.get('/health', (req, res) => {
    res.json({
        status: 'VIVO',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString()
    });
});

// Tratamento de Erros 404 (Ramos não encontrados)
app.use((req, res) => {
    const file404 = path.join(PATHS.PUBLIC, '404.html');
    if (fs.existsSync(file404)) {
        res.status(404).sendFile(file404);
    } else {
        res.status(404).send("Ramo não encontrado. (404)");
    }
});

// Tratamento de Erros 500 (Avaria interna no Tronco)
app.use((err, req, res, next) => {
    console.error("FERIDA NO TRONCO:", err);
    res.status(500).send("<h1>O Tronco sofreu uma avaria interna.</h1>");
});

// Inicia o Tronco (Faz a árvore ganhar vida)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`\n🌳 O TRONCO ESTÁ VIVO NA PORTA ${PORT}\n`);
});
