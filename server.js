/**
 * ==============================================================================
 * 🚀 PORTAL DE HISTÓRIAS - SISTEMA ULTRA PREMIUM (SERVER.JS)
 * ==============================================================================
 * Versão: 10.0.0 - Otimizado para Render & Estabilidade de Sessão
 * Desenvolvido para: Kratos7777
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
// 🛠️ 1. CONFIGURAÇÕES INICIAIS
// ==========================================
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';

// Função para limpar variáveis de ambiente (remove aspas e espaços)
const cleanEnv = (val) => {
    if (!val) return null;
    return val.trim().replace(/['"]/g, '');
};

const CLIENT_ID = cleanEnv(process.env.CLIENT_ID);
const CLIENT_SECRET = cleanEnv(process.env.CLIENT_SECRET);
const CALLBACK_URL = cleanEnv(process.env.REDIRECT_URI) || cleanEnv(process.env.CALLBACK_URL);
const DISCORD_ADMIN_ID = cleanEnv(process.env.DISCORD_ID);
const SESSION_SECRET = cleanEnv(process.env.SESSION_SECRET) || "portal_historias_super_secret_2026";

// Log de inicialização detalhado
console.log("\n" + "=".repeat(50));
console.log("🌟 INICIANDO PORTAL DE HISTÓRIAS ULTRA PREMIUM");
console.log("=".repeat(50));
console.log(`📡 Ambiente: ${NODE_ENV.toUpperCase()}`);
console.log(`🔌 Porta: ${PORT}`);
console.log(`🆔 Client ID: ${CLIENT_ID ? CLIENT_ID.substring(0, 5) + '...' : '❌ NÃO DEFINIDO'}`);
console.log(`🔗 Redirect URI: ${CALLBACK_URL || '❌ NÃO DEFINIDO'}`);
console.log("=".repeat(50) + "\n");

// ==========================================
// 🛡️ 2. MIDDLEWARES DE SEGURANÇA E PERFORMANCE
// ==========================================
app.set('trust proxy', 1); // Essencial para o Render (HTTPS)
app.use(compression()); // Compacta as respostas para carregar mais rápido
app.use(morgan('dev')); // Logs de requisições no terminal
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(SESSION_SECRET));

// Configuração de segurança Helmet
app.use(helmet({
    contentSecurityPolicy: false, // Desativado para facilitar carregamento de recursos externos
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// ==========================================
// 🔑 3. SISTEMA DE SESSÃO E PASSPORT
// ==========================================
app.use(session({
    secret: SESSION_SECRET,
    resave: true,
    saveUninitialized: false,
    name: 'portal_historias.sid',
    cookie: {
        httpOnly: true,
        secure: NODE_ENV === 'production', // Apenas HTTPS em produção (Render)
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 * 24 * 30 // 30 dias de login persistente
    }
}));

passport.serializeUser((user, done) => {
    done(null, user);
});

passport.deserializeUser((obj, done) => {
    done(null, obj);
});

// Configuração da Estratégia Discord
if (CLIENT_ID && CLIENT_SECRET && CALLBACK_URL) {
    passport.use(new DiscordStrategy({
        clientID: CLIENT_ID,
        clientSecret: CLIENT_SECRET,
        callbackURL: CALLBACK_URL,
        scope: ['identify', 'email']
    }, (accessToken, refreshToken, profile, done) => {
        console.log(`[AUTH] Tentativa de login: ${profile.username} (${profile.id})`);
        
        // Adiciona flag de administrador
        profile.isAdmin = (profile.id === DISCORD_ADMIN_ID);
        if (profile.isAdmin) console.log(`[AUTH] Administrador detectado: ${profile.username}`);
        
        return done(null, profile);
    }));
} else {
    console.error("❌ ERRO: Variáveis do Discord (ID, SECRET ou REDIRECT_URI) não foram configuradas!");
}

app.use(passport.initialize());
app.use(passport.session());

// ==========================================
// 🚪 4. ROTAS DE AUTENTICAÇÃO
// ==========================================

// Iniciar Login
app.get('/auth/discord', (req, res, next) => {
    console.log("[AUTH] Redirecionando para o Discord...");
    passport.authenticate('discord')(req, res, next);
});

// Callback do Discord
app.get('/auth/discord/callback', (req, res, next) => {
    console.log("[AUTH] Recebendo retorno do Discord...");
    
    passport.authenticate('discord', (err, user, info) => {
        if (err) {
            console.error("\x1b[31m[ERRO NA AUTENTICAÇÃO]\x1b[0m");
            console.error("Mensagem:", err.message);
            
            return res.status(500).send(`
                <div style="font-family: 'Segoe UI', sans-serif; padding: 50px; text-align: center; background: #0f1115; color: white; height: 100vh;">
                    <h1 style="color: #ff4757;">Erro de Conexão com o Discord</h1>
                    <p style="color: #a4b0be; max-width: 600px; margin: 20px auto;">Ocorreu um erro técnico ao validar sua conta. Isso geralmente acontece por um erro na Redirect URI ou no Client Secret.</p>
                    <div style="background: #1e2124; padding: 20px; border-radius: 10px; display: inline-block; text-align: left; border-left: 5px solid #ff4757;">
                        <code style="color: #ffa502;">ERRO: ${err.message}</code><br><br>
                        <small style="color: #747d8c;">DICA: Verifique se o seu link no Render é igual ao do Discord Developer Portal.</small>
                    </div>
                    <br><br>
                    <a href="/" style="background: #5865F2; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold;">Voltar ao Início</a>
                </div>
            `);
        }

        if (!user) {
            console.warn("[AUTH] Login falhou: Usuário não autorizado ou cancelou.");
            return res.redirect('/');
        }

        req.logIn(user, (loginErr) => {
            if (loginErr) {
                console.error("[AUTH] Erro ao criar sessão:", loginErr);
                return next(loginErr);
            }
            console.log(`[AUTH] Sucesso! Bem-vindo, ${user.username}`);
            
            // Salva a sessão explicitamente antes de redirecionar
            req.session.save(() => {
                res.redirect('/funcionalidades');
            });
        });
    })(req, res, next);
});

// Logout
app.get('/logout', (req, res) => {
    console.log(`[AUTH] Usuário ${req.user ? req.user.username : 'desconhecido'} saindo...`);
    req.logout(() => {
        req.session.destroy((err) => {
            if (err) console.error("[SESSÃO] Erro ao destruir sessão:", err);
            res.clearCookie('portal_historias.sid');
            res.redirect('/');
        });
    });
});

// ==========================================
// 🛡️ 5. MIDDLEWARES DE PROTEÇÃO
// ==========================================

// Protege rotas para usuários logados
const isAuth = (req, res, next) => {
    if (req.isAuthenticated()) return next();
    console.warn(`[ACESSO NEGADO] Tentativa de acesso não autorizado em: ${req.path}`);
    res.redirect('/');
};

// Protege rotas apenas para o Administrador
const isAdmin = (req, res, next) => {
    if (req.isAuthenticated() && req.user.id === DISCORD_ADMIN_ID) return next();
    console.error(`[ACESSO NEGADO] Usuário ${req.user ? req.user.username : 'ANÔNIMO'} tentou acessar área administrativa!`);
    res.status(403).send("Acesso Negado: Apenas o autor da obra pode acessar esta página.");
};

// ==========================================
// 📄 6. ROTAS DE PÁGINAS (HTML)
// ==========================================

// Página de Login (Index)
app.get('/', (req, res) => {
    if (req.isAuthenticated()) return res.redirect('/funcionalidades');
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Página de Funcionalidades (Boas-vindas)
app.get('/funcionalidades', isAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'funcionalidades.html'));
});

// Página da Capa
app.get('/capa', isAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'capa.html'));
});

// Página do Capítulo (Leitura)
app.get('/trvida/:numero', isAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'capitulo.html'));
});

// Página de Perfil
app.get('/perfil', isAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'perfil.html'));
});

// Página de Configurações
app.get('/configuracoes', isAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'configuracoes.html'));
});

// Painel do Editor (Dashboard) - APENAS ADMIN
app.get('/dashboard', isAdmin, (req, res) => {
    res.sendFile(path.join(__dirname, 'dashboard.html'));
});

// ==========================================
// 📊 7. API E DADOS
// ==========================================

// Retorna dados do usuário logado
app.get('/api/user', (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).json({ error: "Não autenticado" });
    
    res.json({
        id: req.user.id,
        username: req.user.username,
        avatar: req.user.avatar ? `https://cdn.discordapp.com/avatars/${req.user.id}/${req.user.avatar}.png` : 'https://cdn.discordapp.com/embed/avatars/0.png',
        isAdmin: req.user.id === DISCORD_ADMIN_ID
    });
});

// Listar todos os capítulos postados
app.get('/api/capitulos', isAuth, async (req, res) => {
    try {
        const dataDir = path.join(__dirname, 'data');
        if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

        const files = fs.readdirSync(dataDir);
        const capitulos = files
            .filter(f => f.startsWith('trvida') && f.endsWith('.txt'))
            .map(f => {
                const numero = parseInt(f.replace('trvida', '').replace('.txt', ''), 10);
                const stats = fs.statSync(path.join(dataDir, f));
                return {
                    numero,
                    postadoEm: stats.mtime,
                    tamanho: (stats.size / 1024).toFixed(1) + ' KB'
                };
            })
            .sort((a, b) => a.numero - b.numero);

        res.json(capitulos);
    } catch (err) {
        console.error("[API] Erro ao listar capítulos:", err);
        res.status(500).json({ error: "Erro ao buscar lista de capítulos." });
    }
});

// Ler conteúdo de um capítulo específico
app.get('/api/capitulo/:numero', isAuth, (req, res) => {
    const numero = parseInt(req.params.numero, 10);
    const filePath = path.join(__dirname, 'data', `trvida${numero}.txt`);

    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "Capítulo ainda não postado." });
    }

    fs.readFile(filePath, 'utf8', (err, data) => {
        if (err) {
            console.error(`[API] Erro ao ler capítulo ${numero}:`, err);
            return res.status(500).json({ error: "Erro interno na leitura do arquivo." });
        }
        res.json({ numero, conteudo: data });
    });
});

// Salvar/Editar capítulo - APENAS ADMIN
app.post('/api/salvar-capitulo', isAdmin, (req, res) => {
    const { numero, conteudo } = req.body;
    
    if (!numero || !conteudo) {
        return res.status(400).json({ error: "Número e conteúdo são obrigatórios." });
    }

    const dataDir = path.join(__dirname, 'data');
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

    const filePath = path.join(dataDir, `trvida${numero}.txt`);

    fs.writeFile(filePath, conteudo, 'utf8', (err) => {
        if (err) {
            console.error(`[API] Erro ao salvar capítulo ${numero}:`, err);
            return res.status(500).json({ error: "Erro ao gravar arquivo no servidor." });
        }
        console.log(`[EDITOR] Capítulo ${numero} salvo por ${req.user.username}`);
        res.json({ success: true, message: `Capítulo ${numero} salvo com sucesso!` });
    });
});

// ==========================================
// 📂 8. ARQUIVOS ESTÁTICOS
// ==========================================

// Serve arquivos da raiz (HTML, JS, CSS)
app.use(express.static(__dirname));

// Serve imagens da pasta imagens/
app.use('/imagens', express.static(path.join(__dirname, 'imagens')));

// Página 404 personalizada
app.use((req, res) => {
    res.status(404).send(`
        <div style="font-family: sans-serif; text-align: center; padding: 100px; background: #0f1115; color: white; height: 100vh;">
            <h1 style="font-size: 80px; color: #11CAA0; margin: 0;">404</h1>
            <h2>Página não encontrada</h2>
            <p>O capítulo que você procura ainda não foi escrito ou a página mudou de lugar.</p>
            <br>
            <a href="/" style="color: #11CAA0; text-decoration: none; font-weight: bold;">← Voltar para a Segurança</a>
        </div>
    `);
});

// ==========================================
// 🚀 9. INICIALIZAÇÃO DO SERVIDOR
// ==========================================
app.listen(PORT, () => {
    console.log("\n" + "=".repeat(50));
    console.log(`✅ SERVIDOR v10.0.0 RODANDO COM SUCESSO!`);
    console.log(`🌍 URL Local: http://localhost:${PORT}`);
    console.log(`📦 NODE_ENV: ${NODE_ENV}`);
    console.log("=".repeat(50));
    console.log("💡 Dica: Verifique se o seu .env tem o CLIENT_ID e CLIENT_SECRET.");
    console.log("🚀 Pressione Ctrl + C para encerrar o servidor.\n");
});
