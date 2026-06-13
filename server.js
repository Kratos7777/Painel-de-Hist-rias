/**
 * ==============================================================================
 * PORTAL TR: VIDA - O ECOSSISTEMA PRIMORDIAL (SERVER-SIDE CORE)
 * ==============================================================================
 * Versão: 10.5.0 (Expansão Máxima e Fluxo Absoluto)
 *
 * Este é o ápice da engenharia para o Portal TR: Vida. O Ecossistema Primordial
 * não apenas serve arquivos; ele sustenta a vida literária com uma estrutura
 * inquebrável, onde a naturalidade do fluxo é garantida por camadas de 
 * resiliência profunda. Nada aqui é por acaso; cada linha é um nervo que
 * conecta a semente ao fruto final.
 *
 * FILOSOFIA:
 * - Persistência Absoluta: A sessão é a alma, e ela nunca morre durante o ciclo.
 * - Fluxo Orgânico: Uma rota nutre a próxima, sem barreiras ou erros.
 * - Blindagem Total: Proteção contra falhas de rede, ambiente e redirecionamento.
 * ==============================================================================
 */

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
const cookieParser = require('cookie-parser');

// FERRAMENTAS DE MANIPULAÇÃO DE VIDA (FileSystem Promisificado)
const readdir = util.promisify(fs.readdir);
const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);
const unlink = util.promisify(fs.unlink);
const mkdir = util.promisify(fs.mkdir);

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'seiva_primordial_ancestral_trvida_v10';

// CONFIGURAÇÃO DE RAÍZES (Caminhos Absolutos e Seguros)
const PATHS = {
    ROOT: __dirname,
    PUBLIC: path.join(__dirname, 'public'),
    DATA: path.join(__dirname, 'data'),
    LOGS: path.join(__dirname, 'logs'),
    IMAGENS: path.join(__dirname, 'public', 'imagens')
};

// GARANTIA DE ESTRUTURA (Criação de pastas vitais no início da vida)
(async () => {
    for (const p of Object.values(PATHS)) {
        if (!fs.existsSync(p)) await mkdir(p, { recursive: true });
    }
})();

// ------------------------------------------------------------------------------
// 1. A CASCA: BLINDAGEM E ADAPTABILIDADE
// ------------------------------------------------------------------------------
app.set('trust proxy', 1); // Confiança total em ambientes de rede complexos

app.use(helmet({
    contentSecurityPolicy: false, // Fluidez para assets externos
    crossOriginEmbedderPolicy: false
}));

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));
app.use(cookieParser(SESSION_SECRET));
app.use(compression());
app.use(morgan(':method :url :status :res[content-length] - :response-time ms'));

// GESTÃO DE SESSÃO (A MEMÓRIA ETERNA DO ECOSSISTEMA)
// Configurada para persistência máxima entre domínios e redirecionamentos
const sessionConfig = {
    secret: SESSION_SECRET,
    resave: true,
    saveUninitialized: false,
    name: 'trvida_ecosystem_sid',
    rolling: true,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 dias de persistência natural
        sameSite: 'lax',
        path: '/'
    }
};
app.use(session(sessionConfig));

// ------------------------------------------------------------------------------
// 2. AS RAÍZES: AUTENTICAÇÃO DISCORD (O FLUXO DA VIDA)
// ------------------------------------------------------------------------------
passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((obj, done) => {
    done(null, obj);
});

if (process.env.CLIENT_ID) {
    passport.use(new DiscordStrategy({
        clientID: process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET,
        callbackURL: process.env.REDIRECT_URI,
        scope: ['identify', 'email'],
        prompt: 'none'
    }, (accessToken, refreshToken, profile, done) => {
        // O perfil é injetado nas veias do sistema
        process.nextTick(() => done(null, profile));
    }));
}

app.use(passport.initialize());
app.use(passport.session());

// MIDDLEWARE DE PROTEÇÃO (O FILTRO DA SEIVA)
// Garante que apenas seres autenticados acessem os ramos internos
const isAuth = (req, res, next) => {
    if (req.isAuthenticated()) return next();
    
    // Diferenciação inteligente entre navegação e dados
    if (req.xhr || req.headers.accept?.indexOf('json') > -1 || req.path.startsWith('/api/')) {
        return res.status(401).json({ success: false, error: "Sessão não identificada pelo Tronco." });
    }
    res.redirect('/');
};

// ------------------------------------------------------------------------------
// 3. OS RAMOS: NAVEGAÇÃO E PÁGINAS (FLUXO ORGÂNICO)
// ------------------------------------------------------------------------------
app.use(express.static(PATHS.PUBLIC));
app.use('/imagens', express.static(PATHS.IMAGENS));

// Rota Raiz (A Semente)
app.get('/', (req, res) => {
    if (req.isAuthenticated()) return res.redirect('/capa');
    res.sendFile(path.join(PATHS.PUBLIC, 'index.html'));
});

// LOGIN DISCORD (A PONTE DE LUZ)
app.get('/auth/discord', passport.authenticate('discord'));

app.get('/auth/discord/callback', (req, res, next) => {
    passport.authenticate('discord', { failureRedirect: '/?error=auth_failed' }, (err, user) => {
        if (err) return next(err);
        if (!user) return res.redirect('/?error=no_user');
        
        req.logIn(user, (err) => {
            if (err) return next(err);
            
            // Consolidação da sessão antes do redirecionamento final
            req.session.save((err) => {
                if (err) return next(err);
                res.redirect('/capa');
            });
        });
    })(req, res, next);
});

// RAMOS PROTEGIDOS (A COPA DA ÁRVORE)
app.get('/capa', isAuth, (req, res) => res.sendFile(path.join(PATHS.PUBLIC, 'capa.html')));
app.get('/editor', isAuth, (req, res) => res.sendFile(path.join(PATHS.PUBLIC, 'editor.html')));
app.get('/perfil', isAuth, (req, res) => res.sendFile(path.join(PATHS.PUBLIC, 'perfil.html')));
app.get('/configuracoes', isAuth, (req, res) => res.sendFile(path.join(PATHS.PUBLIC, 'configuracoes.html')));

// O LEITOR (A FOLHA DA IMERSÃO)
app.get('/ler/:id', isAuth, (req, res) => {
    const id = req.params.id;
    // O Tronco apenas serve a folha; a seiva (dados) vem via API
    res.sendFile(path.join(PATHS.PUBLIC, 'capitulo.html'));
});

// LOGOUT (O RETORNO AO SOLO)
app.get('/logout', (req, res) => {
    req.logout((err) => {
        req.session.destroy(() => {
            res.clearCookie('trvida_ecosystem_sid');
            res.redirect('/');
        });
    });
});

// ------------------------------------------------------------------------------
// 4. OS FRUTOS: API DE DADOS (COLHEITA E GESTÃO)
// ------------------------------------------------------------------------------

// Utilitário de Colheita de Histórias
const harvest = async () => {
    const files = await readdir(PATHS.DATA);
    return files
        .filter(f => f.startsWith('trvida') && f.endsWith('.txt'))
        .map(f => {
            const id = parseInt(f.replace('trvida', '').replace('.txt', ''), 10);
            return { id, title: `Capítulo ${id}`, url: `/ler/${id}` };
        })
        .filter(s => !isNaN(s.id))
        .sort((a, b) => a.id - b.id);
};

// LISTAGEM DE FRUTOS
app.get('/api/stories/list', isAuth, async (req, res) => {
    try {
        const stories = await harvest();
        res.json({ success: true, stories });
    } catch (err) {
        res.status(500).json({ success: false, error: "Erro na colheita primordial." });
    }
});

// SABOR DO FRUTO (CONTEÚDO DO CAPÍTULO)
app.get('/api/stories/content/:id', isAuth, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    try {
        const files = await readdir(PATHS.DATA);
        const file = files.find(f => f.match(new RegExp(`^trvida0*${id}\\.txt$`)));
        
        if (file) {
            const content = await readFile(path.join(PATHS.DATA, file), 'utf8');
            res.json({ 
                success: true, 
                id, 
                content, 
                stats: { words: content.split(/\s+/).filter(Boolean).length } 
            });
        } else {
            res.status(404).json({ success: false, error: "Fruto não encontrado nas raízes." });
        }
    } catch (err) {
        res.status(500).json({ success: false, error: "Erro ao processar o fruto." });
    }
});

// PLANTIO DE NOVAS SEMENTES (SALVAR CAPÍTULO)
app.post('/api/stories/save', isAuth, async (req, res) => {
    const { id, content } = req.body;
    if (!id || content === undefined) return res.status(400).json({ success: false, error: "Semente incompleta." });
    
    try {
        const fileName = `trvida${parseInt(id, 10)}.txt`;
        await writeFile(path.join(PATHS.DATA, fileName), content, 'utf8');
        res.json({ success: true, message: "Semente plantada e nutrida." });
    } catch (err) {
        res.status(500).json({ success: false, error: "Erro ao plantar semente." });
    }
});

// PODA DE RAMOS (DELETAR CAPÍTULO)
app.delete('/api/stories/delete/:id', isAuth, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    try {
        const files = await readdir(PATHS.DATA);
        const file = files.find(f => f.match(new RegExp(`^trvida0*${id}\\.txt$`)));
        if (file) {
            await unlink(path.join(PATHS.DATA, file));
            res.json({ success: true, message: "Ramo podado com sucesso." });
        } else {
            res.status(404).json({ success: false, error: "Ramo não encontrado para poda." });
        }
    } catch (err) {
        res.status(500).json({ success: false, error: "Erro ao podar o ramo." });
    }
});

// PRÓXIMO ID (O CRESCIMENTO CONTÍNUO)
app.get('/api/stories/next-id', isAuth, async (req, res) => {
    try {
        const stories = await harvest();
        const maxId = stories.reduce((max, s) => Math.max(max, s.id), 0);
        res.json({ success: true, nextId: maxId + 1 });
    } catch (err) {
        res.status(500).json({ success: false, error: "Erro ao calcular crescimento." });
    }
});

// ------------------------------------------------------------------------------
// 5. MONITORAMENTO E VIDA (SAÚDE DO ECOSSISTEMA)
// ------------------------------------------------------------------------------
app.get('/health', (req, res) => {
    res.json({
        status: 'VIVO',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString()
    });
});

// Tratamento de Ramos Inexistentes (404)
app.use((req, res) => {
    const file404 = path.join(PATHS.PUBLIC, '404.html');
    if (fs.existsSync(file404)) {
        res.status(404).sendFile(file404);
    } else {
        res.status(404).send("<h1>404</h1><p>Este ramo não existe neste ecossistema.</p>");
    }
});

// Tratamento de Feridas Críticas (500)
app.use((err, req, res, next) => {
    console.error("FERIDA NO ECOSSISTEMA:", err);
    res.status(500).send("<h1>500</h1><p>O Ecossistema Primordial está se regenerando de uma falha crítica.</p>");
});

// INICIALIZAÇÃO DA VIDA
app.listen(PORT, () => {
    console.log(`\n🌳 O ECOSSISTEMA PRIMORDIAL ESTÁ VIVO NA PORTA ${PORT}`);
    console.log(`📂 RAÍZES: ${PATHS.ROOT}`);
    console.log(`🍃 RAMOS: ${PATHS.PUBLIC}\n`);
});
