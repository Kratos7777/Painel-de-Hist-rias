// ECOSSISTEMA SUPREMO - SERVER.JS
// O Tronco Inabalável: Gerencia o fluxo de vida do portal com APIs robustas e autenticação resiliente.
// Versão 6.0 - Purificação Atômica, Raio-X de Credenciais, Sincronização de Escopo e Expansão Monumental

// Módulos Essenciais: As raízes profundas do sistema para um ecossistema robusto e expansivo
const express = require("express");
const session = require("express-session");
const passport = require("passport");
const DiscordStrategy = require("passport-discord").Strategy;
const path = require("path");
const fs = require("fs");
const { readdir, readFile, writeFile, unlink } = require("fs").promises;
const helmet = require("helmet");
const cors = require("cors");
const compression = require("compression");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const dotenv = require("dotenv");
const util = require("util"); // Para util.inspect, essencial para o Raio-X detalhado
const { URL } = require("url"); // Para parsear URLs de forma robusta e dinâmica
const { exec } = require('child_process'); // Para comandos de shell, se necessário para setup avançado

// Carrega variáveis de ambiente do arquivo .env
const dotenvResult = dotenv.config({ path: path.resolve(__dirname, ".env") });

if (dotenvResult.error) {
    console.error("[ERRO CRÍTICO DOTENV] Falha ao carregar .env:", dotenvResult.error);
    process.exit(1);
}

// [DEBUG] Verificação de variáveis de ambiente após carregamento
console.log("\n[DEBUG .ENV] Verificando variáveis de ambiente (pós-dotenv.config()):");
console.log(`[DEBUG .ENV] process.env.DISCORD_CLIENT_ID: ${process.env.DISCORD_CLIENT_ID}`);
console.log(`[DEBUG .ENV] process.env.DISCORD_CLIENT_SECRET: ${process.env.DISCORD_CLIENT_SECRET}`);
console.log(`[DEBUG .ENV] process.env.DISCORD_CALLBACK_URL: ${process.env.DISCORD_CALLBACK_URL}`);
console.log("--------------------------------------------------\n");

// Adiciona um log completo do process.env para depuração profunda
console.log("\n[DEBUG .ENV] Conteúdo completo de process.env (filtrado para Discord/Session):");
for (const key in process.env) {
    if (key.startsWith("DISCORD_") || key.startsWith("SESSION_") || key === "PORT") {
        console.log(`  ${key}: ${process.env[key]}`);
    }
}
console.log("--------------------------------------------------\n");

// [DEBUG] Verificação de variáveis de ambiente após carregamento
console.log("\n[DEBUG .ENV] Verificando variáveis de ambiente (pós-dotenv.config()):");
console.log(`[DEBUG .ENV] process.env.DISCORD_CLIENT_ID: ${process.env.DISCORD_CLIENT_ID}`);
console.log(`[DEBUG .ENV] process.env.DISCORD_CLIENT_SECRET: ${process.env.DISCORD_CLIENT_SECRET}`);
console.log(`[DEBUG .ENV] process.env.DISCORD_CALLBACK_URL: ${process.env.DISCORD_CALLBACK_URL}`);
console.log("--------------------------------------------------\n");

const app = express();
const PORT = process.env.PORT || 3000; // Porta padrão 3000, configurável via .env

// ------------------------------------------------------------------------------
// 1. A SEMENTE: CONFIGURAÇÕES E SOLO (Garante que o ambiente esteja pronto e seguro)
// ------------------------------------------------------------------------------

// Definição de Caminhos Essenciais: O mapa do ecossistema para organização de arquivos
const PATHS = {
    ROOT: __dirname,
    PUBLIC: path.join(__dirname, "public"),
    DATA: path.join(__dirname, "data"),
    IMAGENS: path.join(__dirname, "public", "imagens"),
    LOGS: path.join(__dirname, "logs"),
    ERROR_LOG: path.join(__dirname, "logs", "error.log"),
    ACCESS_LOG: path.join(__dirname, "logs", "access.log"),
    // Adicionando um caminho para assets globais, se necessário
    ASSETS: path.join(__dirname, "public", "assets"),
};

// Garante que as pastas essenciais existam, criando-as se necessário.
// Isso previne erros de I/O antes mesmo do servidor iniciar, garantindo um solo fértil.
const ensureDirectoryExistence = (dirPath) => {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log(`[SETUP] Pasta essencial criada: ${dirPath}`);
    }
};

Object.values(PATHS).forEach(dirPath => {
    // Verifica se é um diretório (não um arquivo de log) antes de tentar criar
    if (!path.extname(dirPath)) {
        ensureDirectoryExistence(dirPath);
    }
});

// Variáveis de Ambiente para Segredos: Protegendo as sementes mais sensíveis
// ATENÇÃO: VOCÊ PRECISA CONFIGURAR ESTAS VARIÁVEIS NO SEU ARQUIVO .env
// Crie um arquivo chamado .env na raiz do seu projeto com o seguinte conteúdo:
// SESSION_SECRET="SUA_CHAVE_SECRETA_UNICA_E_FORTE" (String longa e aleatória)
// DISCORD_CLIENT_ID="SEU_CLIENT_ID_DO_DISCORD" (APENAS NÚMEROS! Ex: 123456789012345678)
// DISCORD_CLIENT_SECRET="SEU_CLIENT_SECRET_DO_DISCORD" (String alfanumérica)
// DISCORD_CALLBACK_URL="SUA_URL_DE_CALLBACK_DO_DISCORD" (Ex: http://localhost:3000/callback ou https://seusite.com/auth/discord/callback)
// CORS_ORIGIN="*" ou "http://localhost:3000" (Para controle de CORS)

const SESSION_SECRET_RAW = process.env.SESSION_SECRET;
const DISCORD_CLIENT_ID_RAW = process.env.DISCORD_CLIENT_ID || ""; // Garante que seja string vazia, não undefined
const DISCORD_CLIENT_SECRET_RAW = process.env.DISCORD_CLIENT_SECRET || ""; // Garante que seja string vazia, não undefined
const DISCORD_CALLBACK_URL_FULL_RAW = process.env.DISCORD_CALLBACK_URL || ""; // Garante que seja string vazia, não undefined

// Purificação Atômica do CLIENT_ID: Garante que seja um snowflake puro e limpo de qualquer contaminação
// Remove tudo que não for dígito, espaços e caracteres de controle invisíveis.
const DISCORD_CLIENT_ID = DISCORD_CLIENT_ID_RAW.replace(/[^0-9]/g, "").trim();

// Extrai o PATH da CALLBACK_URL para uso dinâmico nas rotas do Express
let DISCORD_CALLBACK_PATH = "/callback"; // Default fallback para compatibilidade
let DISCORD_CALLBACK_URL_FULL = DISCORD_CALLBACK_URL_FULL_RAW.trim(); // URL completa para a estratégia
let DISCORD_CALLBACK_URL_ENCODED = DISCORD_CALLBACK_URL_FULL; // Valor padrão, pode ser ajustado

if (DISCORD_CALLBACK_URL_FULL) {
    try {
        const parsedUrl = new URL(DISCORD_CALLBACK_URL_FULL);
        DISCORD_CALLBACK_PATH = parsedUrl.pathname; // Pega apenas o /caminho/da/url
        // Codifica a URL para garantir que caracteres especiais sejam tratados corretamente pelo Discord
        // e reconstrói a URL completa para a estratégia do Passport
        DISCORD_CALLBACK_URL_ENCODED = `${parsedUrl.protocol}//${parsedUrl.host}${encodeURIComponent(parsedUrl.pathname)}${parsedUrl.search}${parsedUrl.hash}`;
    } catch (e) {
        console.error(`[SETUP ERROR] DISCORD_CALLBACK_URL inválida no .env: ${e.message}. Usando default /callback.`);
        // Se a URL for inválida, voltamos para a RAW para o diagnóstico, mas o path será o default
        DISCORD_CALLBACK_URL_ENCODED = DISCORD_CALLBACK_URL_FULL_RAW; 
    }
}
const DISCORD_CLIENT_SECRET_RAW = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_CALLBACK_URL_FULL = process.env.DISCORD_CALLBACK_URL;
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

// Purificação Atômica do CLIENT_ID: Garante que seja um snowflake puro e limpo de qualquer contaminação
// Remove tudo que não for dígito, espaços e caracteres de controle invisíveis.
const DISCORD_CLIENT_ID = DISCORD_CLIENT_ID_RAW 
    ? DISCORD_CLIENT_ID_RAW.replace(/[^0-9]/g, "").trim() 
    : null; 

// Extrai o PATH da CALLBACK_URL para uso dinâmico nas rotas do Express
let DISCORD_CALLBACK_PATH = "/callback"; // Default fallback para compatibilidade
let DISCORD_CALLBACK_URL_ENCODED = DISCORD_CALLBACK_URL_FULL; // Valor padrão, pode ser ajustado

if (DISCORD_CALLBACK_URL_FULL) {
    try {
        const parsedUrl = new URL(DISCORD_CALLBACK_URL_FULL);
        DISCORD_CALLBACK_PATH = parsedUrl.pathname; // Pega apenas o /caminho/da/url
        // Codifica a URL para garantir que caracteres especiais sejam tratados corretamente pelo Discord
        // e reconstrói a URL completa para a estratégia do Passport
        DISCORD_CALLBACK_URL_ENCODED = `${parsedUrl.protocol}//${parsedUrl.host}${encodeURIComponent(parsedUrl.pathname)}${parsedUrl.search}${parsedUrl.hash}`;
    } catch (e) {
        console.error(`[SETUP ERROR] DISCORD_CALLBACK_URL inválida no .env: ${e.message}. Usando default /callback.`);
        DISCORD_CALLBACK_URL_ENCODED = DISCORD_CALLBACK_URL_FULL; // Fallback para a URL original se houver erro de parse
    }
}

// Aplica valores padrão se não estiverem definidos no .env (apenas para desenvolvimento/teste)
const SESSION_SECRET = SESSION_SECRET_RAW || "trvida_ecosistema_secreto_ancestral_2026_super_seguro_e_longo_demais_para_ser_quebrado_facilmente";
const DISCORD_CLIENT_SECRET = DISCORD_CLIENT_SECRET_RAW.trim(); // Garante que não haja espaços extras
const DISCORD_CALLBACK_URL = DISCORD_CALLBACK_URL_ENCODED; // A URL já está purificada e codificada

// VERIFICAÇÃO CRÍTICA: Garante que as credenciais do Discord foram fornecidas e são válidas
// Este bloco é um Raio-X completo das suas credenciais antes de iniciar o servidor.
if (!DISCORD_CLIENT_ID || DISCORD_CLIENT_ID.length === 0 || isNaN(parseInt(DISCORD_CLIENT_ID, 10)) || !DISCORD_CLIENT_SECRET || DISCORD_CLIENT_SECRET.length === 0 || !DISCORD_CALLBACK_URL_FULL || DISCORD_CALLBACK_URL_FULL.length === 0) {
    // Verifica se o erro é devido a variáveis undefined, o que indica falha na leitura do .env
    if (DISCORD_CLIENT_ID_RAW === undefined || DISCORD_CLIENT_SECRET_RAW === undefined || DISCORD_CALLBACK_URL_FULL_RAW === undefined) {
        console.error("\n--- ERRO CRÍTICO: VARIÁVEIS DE AMBIENTE NÃO CARREGADAS DO .ENV --- ");
        console.error("Isso geralmente indica que o arquivo .env não foi encontrado ou está mal formatado.");
        console.error("1. Certifique-se de que o arquivo .env está na raiz do projeto (mesma pasta do server.js).");
        console.error("2. Verifique se os nomes das variáveis (DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_CALLBACK_URL) estão EXATAMENTE corretos no .env.");
        console.error("3. Verifique se não há erros de sintaxe no .env (ex: aspas duplas em valores numéricos).");
        console.error("------------------------------------------------------------------\n");
    }
    console.error("\n--- ERRO CRÍTICO DE CONFIGURAÇÃO DO DISCORD ---");
    console.error("As variáveis DISCORD_CLIENT_ID (deve ser um número válido) e DISCORD_CLIENT_SECRET não foram definidas ou estão incorretas no seu arquivo .env.");
    console.error("Por favor, verifique o Portal do Desenvolvedor do Discord e seu arquivo .env.");
    console.error("--------------------------------------------------");
    console.error(`DIAGNÓSTICO CLIENT_ID RAW: ${util.inspect(DISCORD_CLIENT_ID_RAW)}`);
console.error(`DIAGNÓSTICO CLIENT_ID PURIFICADO: ${util.inspect(DISCORD_CLIENT_ID)}`);
console.error(`É um número válido (isNaN): ${!isNaN(parseInt(DISCORD_CLIENT_ID, 10))}`);
console.error(`CLIENT_SECRET (PRESENTE): ${!!DISCORD_CLIENT_SECRET && DISCORD_CLIENT_SECRET.length > 0}`);
console.error(`CALLBACK_URL (RAW): ${util.inspect(DISCORD_CALLBACK_URL_FULL_RAW)}`);
console.error(`CALLBACK_URL (USADA NA ESTRATÉGIA): ${util.inspect(DISCORD_CALLBACK_URL)}`);
console.error(`CALLBACK_PATH (EXTRAÍDO PARA ROTA): ${util.inspect(DISCORD_CALLBACK_PATH)}`);
    console.error(`DIAGNÓSTICO CLIENT_ID PURIFICADO: ${util.inspect(DISCORD_CLIENT_ID)}`);
    console.error(`É um número válido (isNaN): ${!isNaN(DISCORD_CLIENT_ID)}`);
    console.error(`CLIENT_SECRET (PRESENTE): ${!!DISCORD_CLIENT_SECRET}`);
    console.error(`CALLBACK_URL (RAW): ${util.inspect(DISCORD_CALLBACK_URL_FULL)}`);
    console.error(`CALLBACK_URL (USADA NA ESTRATÉGIA): ${util.inspect(DISCORD_CALLBACK_URL)}`);
    console.error(`CALLBACK_PATH (EXTRAÍDO PARA ROTA): ${util.inspect(DISCORD_CALLBACK_PATH)}`);
    console.error("--------------------------------------------------\n");
    process.exit(1); // Encerra o processo do servidor para forçar a correção
}

// Stream para logs de acesso: O registro da vida do ecossistema
const accessLogStream = fs.createWriteStream(PATHS.ACCESS_LOG, { flags: "a" });

// ------------------------------------------------------------------------------
// 2. A CASCA: PROTEÇÃO E PREPARAÇÃO (Blindagem do servidor e processamento inicial)
// ------------------------------------------------------------------------------

// Configuração de Rate Limiting: Protege contra ataques de força bruta e abuso
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // Limita cada IP a 100 requisições por windowMs
    message: "Muitas requisições de seu IP, tente novamente após 15 minutos."
});

// Aplica o rate limiter a todas as requisições de API
app.use("/api/", apiLimiter);

app.set("trust proxy", 1); // Essencial para ambientes com proxy (Render, Heroku, etc.)

// Helmet: Coleção de middlewares de segurança HTTP para fortalecer a casca
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdnjs.cloudflare.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
            imgSrc: ["'self'", "data:", "https://via.placeholder.com"],
            connectSrc: ["'self'", "https://discord.com", "https://discordapp.com"], // Adicionado para permitir conexão com Discord
        },
    },
    crossOriginEmbedderPolicy: false, // Necessário para alguns embeds
    crossOriginOpenerPolicy: { policy: "same-origin" },
    crossOriginResourcePolicy: { policy: "cross-origin" },
}));

// CORS: Permite requisições de diferentes origens (se necessário para o ecossistema)
app.use(cors({
    origin: CORS_ORIGIN, // Ajuste para domínios específicos em produção
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true,
}));

app.use(compression()); // Comprime as respostas HTTP para maior velocidade e eficiência

// Morgan: Log de requisições detalhado para acesso e depuração em tempo real
app.use(morgan(":method :url :status :res[content-length] - :response-time ms", { stream: accessLogStream }));
app.use(morgan("dev")); // Log para o console durante o desenvolvimento

app.use(express.json()); // Processa corpos de requisição JSON
app.use(express.urlencoded({ extended: true })); // Processa corpos de requisição URL-encoded
app.use(cookieParser(SESSION_SECRET)); // Parseia cookies e os assina com o segredo

// Configuração de Sessão: A memória persistente do ecossistema
app.use(session({
    name: "trvida_ecosystem_sid", // Nome do cookie de sessão
    secret: SESSION_SECRET,
    resave: true, // Força o salvamento da sessão de volta ao armazenamento da sessão
    saveUninitialized: false, // Não salva sessões novas que não foram modificadas
    rolling: true, // Reseta o tempo de expiração do cookie a cada requisição
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 30, // 30 dias de vida para o cookie
        httpOnly: true, // Impede acesso via JavaScript no cliente
        secure: process.env.NODE_ENV === "production", // Apenas HTTPS em produção
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax", // Configuração para cookies cross-site
    },
}));

// ------------------------------------------------------------------------------
// 3. AS RAÍZES: AUTENTICAÇÃO (Passport.js para Discord - A seiva da identidade)
// ------------------------------------------------------------------------------
app.use(passport.initialize());
app.use(passport.session());

// Serialização e Desserialização do Usuário: Como o Passport gerencia a sessão
passport.serializeUser((user, done) => {
    console.log(`[AUTH] Serializando usuário: ${user.id}`);
    done(null, user);
});

passport.deserializeUser((obj, done) => {
    console.log(`[AUTH] Desserializando usuário: ${obj.id}`);
    done(null, obj);
});

// Estratégia de Autenticação Discord: A conexão com o mundo exterior
passport.use(new DiscordStrategy({
    clientID: DISCORD_CLIENT_ID,
    clientSecret: DISCORD_CLIENT_SECRET,
    callbackURL: DISCORD_CALLBACK_URL, // Usando a URL codificada e purificada
    scope: ["identify", "email"], // Escopos mínimos para identificação
    prompt: "none", // Evita prompt de autorização repetitivo se já autorizado
}, (accessToken, refreshToken, profile, done) => {
    // Aqui você pode integrar com seu banco de dados para salvar/atualizar o usuário
    console.log(`[AUTH] Perfil Discord recebido: ${profile.username} (${profile.id})`);
    // Retorna o perfil do usuário para ser serializado na sessão
    return done(null, profile);
}));

// Middleware de Proteção (Garante que apenas usuários autenticados acessem os ramos)
const isAuth = (req, res, next) => {
    if (req.isAuthenticated()) {
        console.log(`[AUTH] Acesso autorizado para ${req.user.username} em ${req.path}`);
        return next();
    }
    
    console.log(`[AUTH] Acesso não autorizado para ${req.path}. Redirecionando/Erro.`);
    // Detecta se a requisição é AJAX ou de página para responder adequadamente
    if (req.xhr || (req.headers.accept && req.headers.accept.indexOf("json") > -1)) {
        return res.status(401).json({ success: false, error: "Sessão expirada ou não autenticada. Por favor, faça login novamente." });
    }
    // Redireciona para a página inicial para login
    res.redirect("/");
};

// ------------------------------------------------------------------------------
// 4. OS RAMOS: ROTAS E FLUXO (Define os caminhos e a navegação do ecossistema)
// ------------------------------------------------------------------------------

// Rota Raiz: Ponto de entrada do portal - O solo onde tudo começa
app.get("/", (req, res) => {
    if (req.isAuthenticated()) {
        console.log(`[FLUXO] Usuário ${req.user.username} autenticado, redirecionando para /capa.`);
        return res.redirect("/capa");
    }
    console.log(`[FLUXO] Usuário não autenticado, exibindo tela de login.`);
    res.sendFile(path.join(PATHS.PUBLIC, "index.html"));
});

// Rota de Login: Inicia o fluxo de autenticação do Discord
app.get("/login", passport.authenticate("discord"));

// Rota de Callback: Recebe a resposta do Discord após a autenticação
// Usa o caminho extraído dinamicamente da DISCORD_CALLBACK_URL para sincronização absoluta
app.get(DISCORD_CALLBACK_PATH, (req, res, next) => {
    console.log(`[FLUXO AUTENTICAÇÃO] Recebida requisição em ${DISCORD_CALLBACK_PATH}`);
    passport.authenticate("discord", (err, user, info) => {
        if (err) {
            console.error("[FLUXO AUTENTICAÇÃO] Erro durante autenticação:", err);
            return res.redirect("/?error=auth_failed");
        }
        if (!user) {
            console.warn("[FLUXO AUTENTICAÇÃO] Usuário não autenticado:", info);
            return res.redirect("/?error=auth_denied");
        }
        req.logIn(user, (err) => {
            if (err) {
                console.error("[FLUXO AUTENTICAÇÃO] Erro ao fazer login:", err);
                return res.redirect("/?error=login_failed");
            }
            req.session.save(() => {
                console.log(`[FLUXO AUTENTICAÇÃO] Usuário ${user.username} logado e sessão salva. Redirecionando para /capa.`);
                res.redirect("/capa");
            });
        });
    })(req, res, next);
});
    passport.authenticate("discord", (err, user, info) => {
        if (err) {
            console.error(`[AUTH ERROR] Erro no callback do Discord: ${err.message}`);
            return res.redirect(`/?error=auth_failed&details=${encodeURIComponent(err.message)}`);
        }
        if (!user) {
            console.log(`[AUTH] Usuário não retornado pelo Discord após autenticação.`);
            return res.redirect("/?error=user_not_found");
        }
        
        req.logIn(user, (loginErr) => {
            if (loginErr) {
                console.error(`[AUTH ERROR] Erro ao fazer login (req.logIn): ${loginErr.message}`);
                return res.redirect(`/?error=login_failed&details=${encodeURIComponent(loginErr.message)}`);
            }
            
            // Salva a sessão explicitamente para garantir persistência antes do redirecionamento
            req.session.save((saveErr) => {
                if (saveErr) {
                    console.error(`[AUTH ERROR] Erro ao salvar sessão: ${saveErr.message}`);
                    return res.redirect(`/?error=session_save_failed&details=${encodeURIComponent(saveErr.message)}`);
                }
                console.log(`[AUTH] Sessão salva para ${user.username}. Redirecionando para /capa.`);
                res.redirect("/capa");
            });
        });
    })(req, res, next);
});

// Servir arquivos estáticos (CSS, JS, imagens) da pasta 'public'
// Ordem é importante: primeiro os arquivos estáticos, depois as rotas protegidas
app.use(express.static(PATHS.PUBLIC));
app.use("/imagens", express.static(PATHS.IMAGENS)); // Garante que /imagens seja acessível
app.use("/assets", express.static(PATHS.ASSETS)); // Servir assets globais

// Rotas Protegidas (A Copa da Árvore - Apenas para usuários autenticados)
app.get("/capa", isAuth, (req, res) => {
    console.log(`[FLUXO] Servindo capa.html para ${req.user.username}`);
    res.sendFile(path.join(PATHS.PUBLIC, "capa.html"));
});

app.get("/editor", isAuth, (req, res) => {
    console.log(`[FLUXO] Servindo editor.html para ${req.user.username}`);
    res.sendFile(path.join(PATHS.PUBLIC, "editor.html"));
});

app.get("/ler/:id", isAuth, (req, res) => {
    console.log(`[FLUXO] Servindo capitulo.html para ${req.user.username} (ID: ${req.params.id})`);
    res.sendFile(path.join(PATHS.PUBLIC, "capitulo.html"));
});

// Rota de Logout: Finaliza a sessão do usuário - O retorno ao solo
app.get("/logout", (req, res) => {
    req.logout((err) => {
        if (err) {
            console.error(`[AUTH ERROR] Erro ao fazer logout: ${err.message}`);
            return res.redirect(`/?error=logout_failed&details=${encodeURIComponent(err.message)}`);
        }
        req.session.destroy((destroyErr) => {
            if (destroyErr) {
                console.error(`[AUTH ERROR] Erro ao destruir sessão: ${destroyErr.message}`);
                return res.redirect(`/?error=session_destroy_failed&details=${encodeURIComponent(destroyErr.message)}`);
            }
            res.clearCookie("trvida_ecosystem_sid");
            console.log(`[AUTH] Usuário desconectado.`);
            res.redirect("/");
        });
    });
});

// ------------------------------------------------------------------------------
// 5. OS FRUTOS: API DE DADOS (Colheita e Gestão de Conteúdo - O coração dinâmico)
// ------------------------------------------------------------------------------

// Utilitário de Colheita de Histórias (Lê todos os arquivos .txt da pasta DATA)
// Otimizado para resiliência e performance
const harvestStories = async () => {
    try {
        const files = await readdir(PATHS.DATA);
        const stories = files
            .filter(f => f.startsWith("trvida") && f.endsWith(".txt"))
            .map(f => {
                const idMatch = f.match(/^trvida(\d+)\.txt$/);
                const id = idMatch ? parseInt(idMatch[1], 10) : null;
                // Se o ID for inválido, o filtro abaixo irá removê-lo
                return { id, title: `Capítulo ${id || "Desconhecido"}`, url: `/ler/${id}` };
            })
            .filter(s => s.id !== null && !isNaN(s.id)) // Garante que o ID é um número válido
            .sort((a, b) => a.id - b.id); // Garante ordem natural dos capítulos
        
        console.log(`[API] ${stories.length} histórias colhidas do solo.`);
        return stories;
    } catch (e) {
        console.error(`[API ERROR] Erro crítico na colheita de histórias: ${e.message}`);
        return []; // Retorna array vazio em caso de erro para evitar quebrar o app
    }
};

// API: Lista todos os capítulos disponíveis - A oferta de frutos
app.get("/api/stories/list", isAuth, async (req, res) => {
    try {
        const stories = await harvestStories();
        res.json({ success: true, stories });
    } catch (err) {
        console.error(`[API ERROR] Falha ao listar histórias: ${err.message}`);
        res.status(500).json({ success: false, error: "Erro interno ao listar histórias." });
    }
});

// API: Retorna o conteúdo de um capítulo específico, incluindo navegação - O sabor do fruto
app.get("/api/stories/content/:id", isAuth, async (req, res) => {
    const requestedId = parseInt(req.params.id, 10);
    if (isNaN(requestedId)) {
        console.warn(`[API] Tentativa de acesso com ID de capítulo inválido: ${req.params.id}`);
        return res.status(400).json({ success: false, error: "ID de capítulo inválido." });
    }

    try {
        const stories = await harvestStories();
        const currentIndex = stories.findIndex(s => s.id === requestedId);
        
        if (currentIndex === -1) {
            console.log(`[API] Capítulo ${requestedId} não encontrado na lista colhida.`);
            return res.status(404).json({ success: false, error: "Fruto não encontrado nas raízes." });
        }

        const story = stories[currentIndex];
        // Garante que o nome do arquivo seja consistente com o ID encontrado
        const fileName = `trvida${story.id}.txt`; 
        const filePath = path.join(PATHS.DATA, fileName);
        
        if (fs.existsSync(filePath)) {
            const content = await readFile(filePath, "utf8");
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
            res.status(404).json({ success: false, error: "Arquivo físico do capítulo não encontrado no solo." });
        }
    } catch (err) {
        console.error(`[API ERROR] Erro ao processar o fruto ${requestedId}: ${err.message}`);
        res.status(500).json({ success: false, error: `Erro interno do servidor ao buscar fruto: ${err.message}` });
    }
});

// API: Salva (cria ou atualiza) um capítulo - O plantio de novas sementes
app.post("/api/stories/save", isAuth, async (req, res) => {
    const { id, content } = req.body;
    if (!id || content === undefined) {
        console.warn(`[API] Tentativa de salvar semente com dados incompletos. ID: ${id}, Content: ${content !== undefined ? "presente" : "ausente"}`);
        return res.status(400).json({ success: false, error: "Dados incompletos para plantar a semente." });
    }
    
    try {
        const fileName = `trvida${parseInt(id, 10)}.txt`;
        const filePath = path.join(PATHS.DATA, fileName);
        await writeFile(filePath, content, "utf8");
        console.log(`[API] Semente ${fileName} plantada/nutrida com sucesso.`);
        res.json({ success: true, message: "Semente plantada e nutrida com sucesso." });
    } catch (err) {
        console.error(`[API ERROR] Erro ao plantar semente ${id}: ${err.message}`);
        res.status(500).json({ success: false, error: `Erro ao plantar semente: ${err.message}` });
    }
});

// API: Deleta um capítulo - A poda de ramos secos
app.delete("/api/stories/delete/:id", isAuth, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
        console.warn(`[API] Tentativa de poda com ID de capítulo inválido: ${req.params.id}`);
        return res.status(400).json({ success: false, error: "ID de capítulo inválido para poda." });
    }

    try {
        const files = await readdir(PATHS.DATA);
        const fileToDelete = files.find(f => f.match(new RegExp(`^trvida0*${id}\.txt$`)));
        
        if (fileToDelete) {
            const filePath = path.join(PATHS.DATA, fileToDelete);
            await unlink(filePath);
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

// API: Retorna o próximo ID disponível para um novo capítulo - O crescimento contínuo
app.get("/api/stories/next-id", isAuth, async (req, res) => {
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

// Rota de Saúde: Verifica se o servidor está vivo - O pulso do ecossistema
app.get("/health", (req, res) => {
    res.json({
        status: "VIVO",
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || "development",
        version: "6.0.0",
    });
});

// Tratamento de Ramos Inexistentes (404 - Página não encontrada) - A regeneração do solo
app.use((req, res) => {
    console.log(`[ERRO 404] Ramo não encontrado: ${req.originalUrl}`);
    const file404 = path.join(PATHS.PUBLIC, "404.html");
    if (fs.existsSync(file404)) {
        res.status(404).sendFile(file404);
    } else {
        res.status(404).send(`
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>404 - Ramo Não Encontrado</title>
                <style>
                    body { font-family: sans-serif; background-color: #090b0e; color: #fff; text-align: center; padding-top: 100px; }
                    h1 { color: #ef4444; }
                    a { color: #11CAA0; text-decoration: none; padding: 10px 20px; border: 1px solid #11CAA0; border-radius: 5px; }
                    a:hover { background-color: #11CAA0; color: #090b0e; }
                </style>
            </head>
            <body>
                <h1>404 - Ramo Não Encontrado</h1>
                <p>A URL <code>${req.originalUrl}</code> não existe neste ecossistema.</p>
                <a href="/">Voltar ao Solo</a>
            </body>
            </html>
        `);
    }
});

// Tratamento de Feridas Críticas (500 - Erro interno do servidor) - A cicatrização do ecossistema
app.use((err, req, res, next) => {
    console.error("\n--- FERIDA CRÍTICA NO ECOSSISTEMA ---");
    console.error(`[ERRO 500] Caminho: ${req.path}, Método: ${req.method}`);
    console.error(err.stack);
    fs.appendFileSync(PATHS.ERROR_LOG, `[${new Date().toISOString()}] ${req.method} ${req.path} - ${err.stack}\n`);
    console.error("------------------------------------\n");
    res.status(500).send(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>500 - Ferida Crítica</title>
            <style>
                body { font-family: sans-serif; background-color: #090b0e; color: #fff; text-align: center; padding-top: 100px; }
                h1 { color: #ef4444; }
                a { color: #11CAA0; text-decoration: none; padding: 10px 20px; border: 1px solid #11CAA0; border-radius: 5px; }
                a:hover { background-color: #11CAA0; color: #090b0e; }
            </style>
        </head>
        <body>
            <h1>500 - Ferida Crítica</h1>
            <p>O Ecossistema Primordial está se regenerando de uma falha crítica.</p>
            <p>Detalhes: ${err.message}</p>
            <a href="/">Voltar ao Solo</a>
        </body>
        </html>
    `);
});

// INICIALIZAÇÃO DA VIDA: O Ecossistema ganha vida
app.listen(PORT, () => {
    console.log(`\n🌳 O ECOSSISTEMA SUPREMO ESTÁ VIVO NA PORTA ${PORT}`);
    console.log(`
+-----------------------------------------------------------------------+
|                   PAINEL DE DIAGNÓSTICO DO TRONCO                     |
+-----------------------------------------------------------------------+
|  PORTA DO SERVIDOR: ${PORT.toString().padEnd(55)}|
|  RAÍZES DO PROJETO: ${PATHS.ROOT.padEnd(55)}|
|  RAMOS PÚBLICOS:    ${PATHS.PUBLIC.padEnd(55)}|
|  DADOS DOS FRUTOS:  ${PATHS.DATA.padEnd(55)}|
|  IMAGENS:           ${PATHS.IMAGENS.padEnd(55)}|
|  LOGS DE ERRO:      ${PATHS.ERROR_LOG.padEnd(55)}|
|  LOGS DE ACESSO:    ${PATHS.ACCESS_LOG.padEnd(55)}|
+-----------------------------------------------------------------------+
|  AUTENTICAÇÃO DISCORD                                                 |
+-----------------------------------------------------------------------+
|  CLIENT_ID (RAW):         ${util.inspect(DISCORD_CLIENT_ID_RAW).padEnd(50)}|
|  CLIENT_ID (PURIFICADO):  ${util.inspect(DISCORD_CLIENT_ID).padEnd(50)}|
|  CLIENT_ID (VÁLIDO?):     ${(!isNaN(DISCORD_CLIENT_ID) && DISCORD_CLIENT_ID !== null).toString().padEnd(50)}|
|  CLIENT_SECRET (PRESENTE):${!!DISCORD_CLIENT_SECRET_RAW.toString().padEnd(50)}|
|  CALLBACK_URL (RAW):      ${util.inspect(DISCORD_CALLBACK_URL_FULL).padEnd(50)}|
|  CALLBACK_URL (USADA):    ${util.inspect(DISCORD_CALLBACK_URL).padEnd(50)}|
|  CALLBACK_PATH (EXTRAÍDO):${util.inspect(DISCORD_CALLBACK_PATH).padEnd(50)}|
+-----------------------------------------------------------------------+
|  VERIFIQUE ESTES VALORES NO PORTAL DO DESENVOLVEDOR DO DISCORD!       |
|  A CALLBACK_URL NO DISCORD DEVE SER EXATAMENTE IGUAL À COMPLETA ACIMA.|
|  QUALQUER INCOMPATIBILIDADE CAUSARÁ O ERRO 'APLICATIVO DESCONHECIDO'. |
+-----------------------------------------------------------------------+
`);
    console.log(`Acesse o portal: http://localhost:${PORT}`);
});
