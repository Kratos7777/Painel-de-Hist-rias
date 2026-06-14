// ECOSSISTEMA FINAL - SERVER.JS
// O Tronco Inabalável: Gerencia o fluxo de vida do portal com APIs robustas e autenticação resiliente.

const express = require('express');
const session = require('express-session');
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;
const path = require('path');
const fs = require('fs');
const { readdir, readFile, writeFile, unlink } = require('fs').promises;
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 3000;

// ------------------------------------------------------------------------------
// 1. A SEMENTE: CONFIGURAÇÕES E SOLO (Garante que o ambiente esteja pronto)
// ------------------------------------------------------------------------------
const PATHS = {
    ROOT: __dirname,
    PUBLIC: path.join(__dirname, 'public'),
    DATA: path.join(__dirname, 'data'),
    IMAGENS: path.join(__dirname, 'public', 'imagens')
};

// Garante que as pastas essenciais existam, criando-as se necessário.
[PATHS.DATA, PATHS.IMAGENS].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`[SETUP] Pasta criada: ${dir}`);
    }
});

const SESSION_SECRET = process.env.SESSION_SECRET || 'trvida_ecosistema_secreto_ancestral_2026';

// ------------------------------------------------------------------------------
// 2. A CASCA: PROTEÇÃO E PREPARAÇÃO (Blindagem do servidor e processamento inicial)
// ------------------------------------------------------------------------------
app.set('trust proxy', 1); // Essencial para ambientes com proxy (Render, Heroku, etc.)
app.use(helmet({ contentSecurityPolicy: false })); // Permite flexibilidade para assets externos
app.use(cors());
app.use(compression());
app.use(morgan('dev')); // Log de requisições para diagnóstico
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(SESSION_SECRET));

app.use(session({
    name: 'trvida_ecosystem_sid',
    secret: SESSION_SECRET,
    resave: true, // Força o salvamento da sessão de volta ao armazenamento da sessão
    saveUninitialized: false, // Não salva sessões novas que não foram modificadas
    rolling: true, // Reseta o tempo de expiração do cookie a cada requisição
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 30, // 30 dias de vida para o cookie
        secure: process.env.NODE_ENV === 'production', // Apenas HTTPS em produção
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax' // Configuração para cookies cross-site
    }
}));

// ------------------------------------------------------------------------------
// 3. AS RAÍZES: AUTENTICAÇÃO (Passport.js para Discord - A seiva da identidade)
// ------------------------------------------------------------------------------
app.use(passport.initialize());
app.use(passport.session());

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

passport.use(new DiscordStrategy({
    clientID: process.env.DISCORD_CLIENT_ID || '1314353266555293758',
    clientSecret: process.env.DISCORD_CLIENT_SECRET || 'H9e_qH080-v_uY7Y16-U-oY_2Z_X-Z-X', // Substitua pelo seu segredo real
    callbackURL: process.env.DISCORD_CALLBACK_URL || 'http://localhost:3000/callback',
    scope: ['identify', 'email'],
    prompt: 'none' // Evita prompt de autorização repetitivo
}, (accessToken, refreshToken, profile, done) => {
    // Aqui você pode salvar o perfil do usuário no seu banco de dados, se tiver um.
    // Por enquanto, apenas passamos o perfil adiante.
    console.log(`[AUTH] Perfil Discord recebido: ${profile.username}`);
    return done(null, profile);
}));

// Middleware de Proteção (Garante que apenas usuários autenticados acessem os ramos)
const isAuth = (req, res, next) => {
    if (req.isAuthenticated()) {
        console.log(`[AUTH] Usuário autenticado: ${req.user.username}`);
        return next();
    }
    
    console.log(`[AUTH] Acesso não autorizado para: ${req.path}`);
    // Se for uma chamada de API (AJAX), retorna 401; caso contrário, redireciona para o login
    if (req.xhr || (req.headers.accept && req.headers.accept.indexOf('json') > -1)) {
        return res.status(401).json({ success: false, error: "Sessão expirada ou não autenticada." });
    }
    res.redirect('/');
};

// ------------------------------------------------------------------------------
// 4. OS RAMOS: ROTAS E FLUXO (Define os caminhos e a navegação do ecossistema)
// ------------------------------------------------------------------------------

// Rota Raiz: Ponto de entrada do portal
app.get('/', (req, res) => {
    if (req.isAuthenticated()) {
        console.log(`[FLUXO] Usuário autenticado, redirecionando para /capa.`);
        return res.redirect('/capa');
    }
    console.log(`[FLUXO] Usuário não autenticado, exibindo tela de login.`);
    res.send(`
        <h1>TR: VIDA - O Ecossistema Literário</h1>
        <p>Bem-vindo ao portal. Faça login para explorar as histórias.</p>
        <a href="/login">Entrar via Discord</a>
    `);
});

// Rota de Login: Inicia o fluxo de autenticação do Discord
app.get('/login', passport.authenticate('discord'));

// Rota de Callback: Recebe a resposta do Discord após a autenticação
app.get('/callback', (req, res, next) => {
    passport.authenticate('discord', (err, user, info) => {
        if (err) {
            console.error(`[AUTH ERROR] Erro no callback: ${err}`);
            return res.redirect('/?error=auth_failed');
        }
        if (!user) {
            console.log(`[AUTH] Usuário não retornado pelo Discord.`);
            return res.redirect('/?error=user_not_found');
        }
        
        req.logIn(user, (loginErr) => {
            if (loginErr) {
                console.error(`[AUTH ERROR] Erro ao fazer login: ${loginErr}`);
                return res.redirect('/?error=login_failed');
            }
            
            // Salva a sessão explicitamente para garantir persistência antes do redirecionamento
            req.session.save(() => {
                console.log(`[AUTH] Sessão salva para ${user.username}. Redirecionando para /capa.`);
                res.redirect('/capa');
            });
        });
    })(req, res, next);
});

// Servir arquivos estáticos (CSS, JS, imagens) da pasta 'public'
app.use(express.static(PATHS.PUBLIC));
app.use('/imagens', express.static(PATHS.IMAGENS)); // Garante que /imagens seja acessível

// Rotas Protegidas (A Copa da Árvore - Apenas para usuários autenticados)
app.get('/capa', isAuth, (req, res) => {
    console.log(`[FLUXO] Servindo capa.html para ${req.user.username}`);
    res.sendFile(path.join(PATHS.PUBLIC, 'capa.html'));
});

app.get('/editor', isAuth, (req, res) => {
    console.log(`[FLUXO] Servindo editor.html para ${req.user.username}`);
    res.sendFile(path.join(PATHS.PUBLIC, 'editor.html'));
});

app.get('/ler/:id', isAuth, (req, res) => {
    console.log(`[FLUXO] Servindo capitulo.html para ${req.user.username} (ID: ${req.params.id})`);
    res.sendFile(path.join(PATHS.PUBLIC, 'capitulo.html'));
});

// Rota de Logout: Finaliza a sessão do usuário
app.get('/logout', (req, res) => {
    req.logout((err) => {
        if (err) { console.error(`[AUTH ERROR] Erro ao fazer logout: ${err}`); }
        req.session.destroy(() => {
            res.clearCookie('trvida_ecosystem_sid');
            console.log(`[AUTH] Usuário desconectado.`);
            res.redirect('/');
        });
    });
});

// ------------------------------------------------------------------------------
// 5. OS FRUTOS: API DE DADOS (Colheita e Gestão de Conteúdo - O coração dinâmico)
// ------------------------------------------------------------------------------

// Utilitário de Colheita de Histórias (Lê todos os arquivos .txt da pasta DATA)
const harvestStories = async () => {
    try {
        const files = await readdir(PATHS.DATA);
        const stories = files
            .filter(f => f.startsWith('trvida') && f.endsWith('.txt'))
            .map(f => {
                const idMatch = f.match(/^trvida(\d+)\.txt$/);
                const id = idMatch ? parseInt(idMatch[1], 10) : null;
                return { id, title: `Capítulo ${id}`, url: `/ler/${id}` };
            })
            .filter(s => s.id !== null && !isNaN(s.id)) // Garante que o ID é um número válido
            .sort((a, b) => a.id - b.id);
        
        console.log(`[API] ${stories.length} histórias colhidas.`);
        return stories;
    } catch (e) {
        console.error(`[API ERROR] Erro na colheita de histórias: ${e.message}`);
        return [];
    }
};

// API: Lista todos os capítulos disponíveis
app.get('/api/stories/list', isAuth, async (req, res) => {
    const stories = await harvestStories();
    res.json({ success: true, stories });
});

// API: Retorna o conteúdo de um capítulo específico, incluindo navegação
app.get('/api/stories/content/:id', isAuth, async (req, res) => {
    const requestedId = parseInt(req.params.id, 10);
    if (isNaN(requestedId)) {
        return res.status(400).json({ success: false, error: "ID de capítulo inválido." });
    }

    try {
        const stories = await harvestStories();
        const currentIndex = stories.findIndex(s => s.id === requestedId);
        
        if (currentIndex === -1) {
            console.log(`[API] Capítulo ${requestedId} não encontrado.`);
            return res.status(404).json({ success: false, error: "Fruto não encontrado nas raízes." });
        }

        const story = stories[currentIndex];
        const fileName = `trvida${story.id}.txt`; // Usa o ID do objeto story para garantir o nome correto
        const filePath = path.join(PATHS.DATA, fileName);
        
        if (fs.existsSync(filePath)) {
            const content = await readFile(filePath, 'utf8');
            const words = content.split(/\s+/).filter(Boolean).length;

            res.json({
                success: true,
                id: story.id,
                title: story.title,
                content: content,
                stats: {
                    words: words,
                    total: stories.length,
                    index: currentIndex + 1
                },
                navigation: {
                    prev: currentIndex > 0 ? stories[currentIndex - 1].id : null,
                    next: currentIndex < stories.length - 1 ? stories[currentIndex + 1].id : null
                }
            });
        } else {
            console.error(`[API ERROR] Arquivo físico ${filePath} não encontrado para o ID ${requestedId}.`);
            res.status(404).json({ success: false, error: "Arquivo físico do capítulo não encontrado." });
        }
    } catch (err) {
        console.error(`[API ERROR] Erro ao processar o fruto ${requestedId}: ${err.message}`);
        res.status(500).json({ success: false, error: `Erro interno do servidor: ${err.message}` });
    }
});

// API: Salva (cria ou atualiza) um capítulo
app.post('/api/stories/save', isAuth, async (req, res) => {
    const { id, content } = req.body;
    if (!id || content === undefined) {
        return res.status(400).json({ success: false, error: "Dados incompletos para plantar a semente." });
    }
    
    try {
        const fileName = `trvida${parseInt(id, 10)}.txt`;
        await writeFile(path.join(PATHS.DATA, fileName), content, 'utf8');
        console.log(`[API] Semente ${fileName} plantada/nutrida.`);
        res.json({ success: true, message: "Semente plantada e nutrida." });
    } catch (err) {
        console.error(`[API ERROR] Erro ao plantar semente ${id}: ${err.message}`);
        res.status(500).json({ success: false, error: `Erro ao plantar semente: ${err.message}` });
    }
});

// API: Deleta um capítulo
app.delete('/api/stories/delete/:id', isAuth, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
        return res.status(400).json({ success: false, error: "ID de capítulo inválido para poda." });
    }

    try {
        const files = await readdir(PATHS.DATA);
        const fileToDelete = files.find(f => f.match(new RegExp(`^trvida0*${id}\.txt$`)));
        
        if (fileToDelete) {
            await unlink(path.join(PATHS.DATA, fileToDelete));
            console.log(`[API] Ramo ${fileToDelete} podado com sucesso.`);
            res.json({ success: true, message: "Ramo podado com sucesso." });
        } else {
            console.log(`[API] Ramo ${id} não encontrado para poda.`);
            res.status(404).json({ success: false, error: "Ramo não encontrado para poda." });
        }
    } catch (err) {
        console.error(`[API ERROR] Erro ao podar o ramo ${id}: ${err.message}`);
        res.status(500).json({ success: false, error: `Erro ao podar o ramo: ${err.message}` });
    }
});

// API: Retorna o próximo ID disponível para um novo capítulo
app.get('/api/stories/next-id', isAuth, async (req, res) => {
    try {
        const stories = await harvestStories();
        const maxId = stories.reduce((max, s) => Math.max(max, s.id), 0);
        res.json({ success: true, nextId: maxId + 1 });
    } catch (err) {
        console.error(`[API ERROR] Erro ao calcular o próximo crescimento: ${err.message}`);
        res.status(500).json({ success: false, error: `Erro ao calcular próximo ID: ${err.message}` });
    }
});

// ------------------------------------------------------------------------------
// 6. MONITORAMENTO E VIDA (Saúde do Ecossistema e Tratamento de Erros)
// ------------------------------------------------------------------------------

// Rota de Saúde: Verifica se o servidor está vivo
app.get('/health', (req, res) => {
    res.json({
        status: 'VIVO',
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString()
    });
});

// Tratamento de Ramos Inexistentes (404 - Página não encontrada)
app.use((req, res) => {
    console.log(`[ERRO 404] Ramo não encontrado: ${req.originalUrl}`);
    const file404 = path.join(PATHS.PUBLIC, '404.html');
    if (fs.existsSync(file404)) {
        res.status(404).sendFile(file404);
    } else {
        res.status(404).send(`
            <h1>404 - Ramo Não Encontrado</h1>
            <p>A URL ${req.originalUrl} não existe neste ecossistema.</p>
            <a href="/">Voltar ao Solo</a>
        `);
    }
});

// Tratamento de Feridas Críticas (500 - Erro interno do servidor)
app.use((err, req, res, next) => {
    console.error("\n--- FERIDA CRÍTICA NO ECOSSISTEMA ---");
    console.error(err.stack);
    console.error("------------------------------------\n");
    res.status(500).send(`
        <h1>500 - Ferida Crítica</h1>
        <p>O Ecossistema Primordial está se regenerando de uma falha crítica.</p>
        <p>Detalhes: ${err.message}</p>
        <a href="/">Voltar ao Solo</a>
    `);
});

// INICIALIZAÇÃO DA VIDA: O Ecossistema ganha vida
app.listen(PORT, () => {
    console.log(`\n🌳 O ECOSSISTEMA FINAL ESTÁ VIVO NA PORTA ${PORT}`);
    console.log(`📂 RAÍZES DO PROJETO: ${PATHS.ROOT}`);
    console.log(`🍃 RAMOS PÚBLICOS: ${PATHS.PUBLIC}`);
    console.log(`📚 DADOS DOS FRUTOS: ${PATHS.DATA}`);
    console.log(`🖼️ IMAGENS: ${PATHS.IMAGENS}\n`);
    console.log(`Acesse: http://localhost:${PORT}`);
});
