```javascript
// ECOSSISTEMA SUPREMO - SERVER.JS
// O Tronco Inabalável: Gerencia o fluxo de vida do portal com APIs robustas e autenticação resiliente.
// Versão 6.0 - Purificação Atômica, Raio-X de Credenciais, Sincronização de Escopo e Expansão Monumental
// Reconstruído do zero para garantir a ausência de declarações duplicadas e fluxo absoluto.

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
const { exec } = require("child_process"); // Para comandos de shell, se necessário para setup avançado

// Carrega variáveis de ambiente do arquivo .env
// Força o caminho para garantir que o .env seja lido da raiz do projeto
const dotenvResult = dotenv.config({ path: path.resolve(__dirname, ".env") });

// --- DEBUG DOTENV: Início --- //
console.log("\n[DEBUG .ENV] Resultado do dotenv.config():", dotenvResult);
console.log("\n[DEBUG .ENV] Conteúdo completo de process.env (filtrado para Discord/Session/Port):");
for (const key in process.env) {
    if (key.startsWith("DISCORD_") || key.startsWith("SESSION_") || key === "PORT") {
        console.log(`  ${key}: ${process.env[key]}`);
    }
}
console.log("--------------------------------------------------\n");
// --- DEBUG DOTENV: Fim --- //

if (dotenvResult.error) {
    console.error("[ERRO CRÍTICO DOTENV] Falha ao carregar .env:", dotenvResult.error);
    process.exit(1);
}

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

// Cria todas as pastas necessárias ao iniciar o servidor
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
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

// Aplica valores padrão se não estiverem definidos no .env (apenas para desenvolvimento/teste)
const SESSION_SECRET = SESSION_SECRET_RAW || "trvida_ecosistema_secreto_ancestral_2026_super_seguro_e_longo_demais_para_ser_quebrado_facilmente";
const DISCORD_CLIENT_SECRET = DISCORD_CLIENT_SECRET_RAW.trim(); // Garante que não haja espaços extras
const DISCORD_CALLBACK_URL = DISCORD_CALLBACK_URL_ENCODED; // A URL já está purificada e codificada

// --- RAIO-X DE CREDENCIAIS DISCORD: Início --- //
console.log("\n+-----------------------------------------------------------------------+");
console.log("|                 RAIO-X DE CREDENCIAIS DISCORD                       |");
console.log("+-----------------------------------------------------------------------+");
console.log(`| CLIENT_ID (RAW):         ${util.inspect(DISCORD_CLIENT_ID_RAW)}`);
console.log(`| CLIENT_ID (PURIFICADO):  ${util.inspect(DISCORD_CLIENT_ID)}`);
console.log(`| CLIENT_ID (VÁLIDO?):     ${!isNaN(parseInt(DISCORD_CLIENT_ID, 10)) && DISCORD_CLIENT_ID.length > 0}`);
console.log(`| CLIENT_SECRET (PRESENTE):${!!DISCORD_CLIENT_SECRET && DISCORD_CLIENT_SECRET.length > 0}`);
console.log(`| CALLBACK_URL (RAW):      ${util.inspect(DISCORD_CALLBACK_URL_FULL_RAW)}`);
console.log(`| CALLBACK_URL (USADA):    ${util.inspect(DISCORD_CALLBACK_URL)}`);
console.log(`| CALLBACK_PATH (EXTRAÍDO):${util.inspect(DISCORD_CALLBACK_PATH)}`);
console.log("+-----------------------------------------------------------------------+");
console.log("|  VERIFIQUE ESTES VALORES NO PORTAL DO DESENVOLVEDOR DO DISCORD!       |");
console.log("|  QUALQUER INCOMPATIBILIDADE CAUSARÁ O ERRO 'APLICATIVO DESCONHECIDO'. |");
console.log("+-----------------------------------------------------------------------+\n");
// --- RAIO-X DE CREDENCIAIS DISCORD: Fim --- //

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
    passport.authenticate("discord", (err, user, info) => {
        if (err) {
            console.error(`[AUTH ERROR] Erro no callback do Discord: ${err}`);
            return res.redirect("/?error=auth_failed");
        }
        if (!user) {
            console.log(`[AUTH] Autenticação Discord falhou, nenhum usuário retornado.`);
            return res.redirect("/?error=auth_denied");
        }
        req.logIn(user, (err) => {
            if (err) {
                console.error(`[AUTH ERROR] Erro ao fazer login (req.logIn): ${err}`);
                return res.redirect("/?error=login_error");
            }
            // Salva a sessão explicitamente para garantir que o cookie seja enviado antes do redirecionamento
            req.session.save(() => {
                console.log(`[AUTH] Login realizado com sucesso para ${user.username}, redirecionando para /capa.`);
                res.redirect("/capa");
            });
        });
    })(req, res, next);
});

// Rota de Logout: Encerra a sessão do usuário
app.get("/logout", (req, res) => {
    req.logout((err) => {
        if (err) {
            console.error(`[AUTH ERROR] Erro ao fazer logout: ${err}`);
            return res.redirect("/capa?error=logout_failed");
        }
        req.session.destroy((err) => {
            if (err) {
                console.error(`[AUTH ERROR] Erro ao destruir sessão: ${err}`);
                return res.redirect("/capa?error=session_destroy_failed");
            }
            res.clearCookie("trvida_ecosystem_sid"); // Limpa o cookie de sessão
            console.log(`[AUTH] Usuário deslogado, redirecionando para /.`);
            res.redirect("/");
        });
    });
});

// Rota para a Capa (Biblioteca): Protegida por autenticação
app.get("/capa", isAuth, (req, res) => {
    console.log(`[FLUXO] Exibindo capa para ${req.user.username}.`);
    res.sendFile(path.join(PATHS.PUBLIC, "capa.html"));
});

// Rota para o Leitor de Capítulos: Protegida por autenticação
app.get("/ler/:id", isAuth, (req, res) => {
    console.log(`[FLUXO] Exibindo capítulo ${req.params.id} para ${req.user.username}.`);
    res.sendFile(path.join(PATHS.PUBLIC, "capitulo.html"));
});

// Rota para o Editor: Protegida por autenticação
app.get("/editor", isAuth, (req, res) => {
    console.log(`[FLUXO] Exibindo editor para ${req.user.username}.`);
    res.sendFile(path.join(PATHS.PUBLIC, "editor.html"));
});

// API para listar todos os capítulos (Obras Fantasmas são filtradas aqui)
app.get("/api/stories/list", isAuth, async (req, res) => {
    try {
        const files = await readdir(PATHS.DATA);
        const stories = files
            .filter(file => file.startsWith("trvida") && file.endsWith(".txt"))
            .map(file => {
                const idMatch = file.match(/trvida(\d+)\.txt/);
                return idMatch ? { id: parseInt(idMatch[1], 10), title: `Capítulo ${parseInt(idMatch[1], 10)}` } : null;
            })
            .filter(story => story !== null && !isNaN(story.id))
            .sort((a, b) => a.id - b.id);

        res.json({ success: true, stories });
    } catch (error) {
        console.error(`[API ERROR] Erro ao listar capítulos: ${error.message}`);
        res.status(500).json({ success: false, error: "Erro ao listar capítulos." });
    }
});

// API para obter o conteúdo de um capítulo específico
app.get("/api/stories/content/:id", isAuth, async (req, res) => {
    const chapterId = parseInt(req.params.id, 10);
    if (isNaN(chapterId)) {
        return res.status(400).json({ success: false, error: "ID do capítulo inválido." });
    }

    try {
        const files = await readdir(PATHS.DATA);
        const storyFile = files.find(file => {
            const idMatch = file.match(/trvida(\d+)\.txt/);
            return idMatch && parseInt(idMatch[1], 10) === chapterId;
        });

        if (!storyFile) {
            return res.status(404).json({ success: false, error: "Capítulo não encontrado." });
        }

        const content = await readFile(path.join(PATHS.DATA, storyFile), "utf8");
        const wordCount = content.split(/\s+/).filter(word => word.length > 0).length;
        const readingTimeMinutes = Math.ceil(wordCount / 200); // Média de 200 palavras por minuto

        // Lógica para determinar o próximo e o capítulo anterior
        const allStories = files
            .filter(file => file.startsWith("trvida") && file.endsWith(".txt"))
            .map(file => {
                const idMatch = file.match(/trvida(\d+)\.txt/);
                return idMatch ? parseInt(idMatch[1], 10) : null;
            })
            .filter(id => id !== null && !isNaN(id))
            .sort((a, b) => a - b);

        const currentIndex = allStories.indexOf(chapterId);
        const prevChapterId = currentIndex > 0 ? allStories[currentIndex - 1] : null;
        const nextChapterId = currentIndex < allStories.length - 1 ? allStories[currentIndex + 1] : null;

        res.json({ 
            success: true, 
            id: chapterId, 
            title: `Capítulo ${chapterId}`, 
            content, 
            wordCount, 
            readingTimeMinutes,
            prevChapterId,
            nextChapterId,
            totalChapters: allStories.length,
            currentChapterIndex: currentIndex + 1
        });
    } catch (error) {
        console.error(`[API ERROR] Erro ao obter conteúdo do capítulo ${chapterId}: ${error.message}`);
        res.status(500).json({ success: false, error: "Erro ao obter conteúdo do capítulo." });
    }
});

// API para obter o próximo ID disponível para um novo capítulo
app.get("/api/stories/next-id", isAuth, async (req, res) => {
    try {
        const files = await readdir(PATHS.DATA);
        const existingIds = files
            .filter(file => file.startsWith("trvida") && file.endsWith(".txt"))
            .map(file => {
                const idMatch = file.match(/trvida(\d+)\.txt/);
                return idMatch ? parseInt(idMatch[1], 10) : 0;
            })
            .filter(id => !isNaN(id));

        const nextId = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;
        res.json({ success: true, nextId });
    } catch (error) {
        console.error(`[API ERROR] Erro ao obter próximo ID: ${error.message}`);
        res.status(500).json({ success: false, error: "Erro ao obter próximo ID." });
    }
});

// API para salvar/atualizar um capítulo
app.post("/api/stories/save", isAuth, async (req, res) => {
    const { id, content } = req.body;
    if (isNaN(parseInt(id, 10)) || !content) {
        return res.status(400).json({ success: false, error: "ID ou conteúdo inválido." });
    }
    const chapterId = parseInt(id, 10);
    const filename = path.join(PATHS.DATA, `trvida${chapterId}.txt`);

    try {
        await writeFile(filename, content, "utf8");
        console.log(`[API] Capítulo ${chapterId} salvo/atualizado por ${req.user.username}.`);
        res.json({ success: true, message: `Capítulo ${chapterId} salvo com sucesso.` });
    } catch (error) {
        console.error(`[API ERROR] Erro ao salvar capítulo ${chapterId}: ${error.message}`);
        res.status(500).json({ success: false, error: "Erro ao salvar capítulo." });
    }
});

// API para deletar um capítulo
app.delete("/api/stories/delete/:id", isAuth, async (req, res) => {
    const chapterId = parseInt(req.params.id, 10);
    if (isNaN(chapterId)) {
        return res.status(400).json({ success: false, error: "ID do capítulo inválido." });
    }
    const filename = path.join(PATHS.DATA, `trvida${chapterId}.txt`);

    try {
        if (fs.existsSync(filename)) {
            await unlink(filename);
            console.log(`[API] Capítulo ${chapterId} deletado por ${req.user.username}.`);
            res.json({ success: true, message: `Capítulo ${chapterId} deletado com sucesso.` });
        } else {
            res.status(404).json({ success: false, error: "Capítulo não encontrado para exclusão." });
        }
    } catch (error) {
        console.error(`[API ERROR] Erro ao deletar capítulo ${chapterId}: ${error.message}`);
        res.status(500).json({ success: false, error: "Erro ao deletar capítulo." });
    }
});

// Servir arquivos estáticos da pasta 'public'
app.use(express.static(PATHS.PUBLIC));
// Servir imagens da pasta 'imagens' dentro de 'public'
app.use("/imagens", express.static(PATHS.IMAGENS));

// ------------------------------------------------------------------------------
// 5. MONITORAMENTO E CICATRIZAÇÃO: TRATAMENTO DE ERROS E INICIALIZAÇÃO
// ------------------------------------------------------------------------------

// Rota de Health Check: Para monitoramento do ecossistema
app.get("/health", (req, res) => {
    res.status(200).json({ status: "UP", timestamp: new Date() });
});

// Middleware para tratamento de erros 404 (Recurso não encontrado)
app.use((req, res, next) => {
    console.warn(`[ERRO 404] Recurso não encontrado: ${req.method} ${req.originalUrl}`);
    res.status(404).sendFile(path.join(PATHS.PUBLIC, "404.html"), (err) => {
        if (err) {
            console.error(`[ERRO 404] Falha ao enviar 404.html: ${err.message}`);
            res.type("txt").send("404 - Recurso não encontrado. O Ecossistema não encontrou esta trilha.");
        }
    });
});

// Middleware para tratamento de erros 500 (Erros internos do servidor)
app.use((err, req, res, next) => {
    console.error(`[ERRO 500] Erro interno do servidor: ${err.stack}`);
    // Registra o erro em um arquivo de log
    fs.appendFile(PATHS.ERROR_LOG, `[${new Date().toISOString()}] ${err.stack}\n`, (logErr) => {
        if (logErr) console.error(`[ERRO LOG] Falha ao registrar erro 500: ${logErr.message}`);
    });

    res.status(500).sendFile(path.join(PATHS.PUBLIC, "500.html"), (htmlErr) => {
        if (htmlErr) {
            console.error(`[ERRO 500] Falha ao enviar 500.html: ${htmlErr.message}`);
            res.type("txt").send("500 - Erro interno do servidor. O Ecossistema encontrou uma falha crítica.");
        }
    });
});

// Inicia o servidor: A vida pulsa no ecossistema
app.listen(PORT, () => {
    console.log(`\n+-----------------------------------------------------------------------+`);
    console.log(`|               ECOSSISTEMA SUPREMO TR: VIDA INICIADO                   |`);
    console.log(`+-----------------------------------------------------------------------+`);
    console.log(`| Servidor ouvindo na porta: ${PORT}`);
    console.log(`| Ambiente: ${process.env.NODE_ENV || "development"}`);
    console.log(`| Acesse o Portal de Entrada: http://localhost:${PORT}`);
    console.log(`| Acesse a Biblioteca (após login): http://localhost:${PORT}/capa`);
    console.log(`| Acesse o Editor (após login): http://localhost:${PORT}/editor`);
    console.log(`+-----------------------------------------------------------------------+\n`);
});
```
