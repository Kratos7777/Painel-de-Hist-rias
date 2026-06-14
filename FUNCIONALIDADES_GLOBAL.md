# 🚀 Funcionalidades do Global.js

O arquivo `global.js` é o **coração inteligente** do seu portal. Ele centraliza toda a lógica compartilhada entre as páginas, deixando o código mais limpo, rápido e fácil de manter.

---

## 📋 O que o Global.js faz?

### 1. **Sistema de Notificações (Toasts)**
Avisos bonitos que aparecem no canto inferior direito da tela.

**Como usar:**
```javascript
window.notify.show('Capítulo salvo com sucesso!', 'success');
window.notify.show('Erro ao carregar', 'error');
window.notify.show('Informação importante', 'info');
window.notify.show('Atenção!', 'warning');
```

**Tipos de notificação:**
- `success` (verde) - Para ações bem-sucedidas
- `error` (vermelho) - Para erros
- `info` (azul) - Para informações
- `warning` (amarelo) - Para avisos

---

### 2. **Sistema de Temas**
Gerencia automaticamente os temas (Escuro, Claro, Sépia) e salva a preferência do usuário.

**Como usar:**
```javascript
// Aplicar um tema específico
window.themeSystem.applyTheme('dark');    // Escuro
window.themeSystem.applyTheme('light');   // Claro
window.themeSystem.applyTheme('sepia');   // Sépia

// Alternar para o próximo tema
const novoTema = window.themeSystem.toggle();
console.log(novoTema); // Retorna: 'light', 'sepia' ou 'dark'
```

**Atalho de teclado:**
Pressione a tecla **T** para alternar entre temas automaticamente.

---

### 3. **Sistema de Preferências de Leitura**
Controla tamanho da fonte e espaçamento entre linhas.

**Como usar:**
```javascript
// Definir tamanho da fonte (em pixels)
window.readingPrefs.setFontSize(18);

// Definir espaçamento entre linhas
window.readingPrefs.setLineHeight(2.0);
```

**Valores recomendados:**
- **Fonte**: 14px a 24px
- **Espaçamento**: 1.5 a 2.5

---

### 4. **Sistema de Navegação com Atalhos**
Permite navegar entre capítulos usando o teclado.

**Atalhos disponíveis:**
- **Seta Esquerda (←)** - Ir para o capítulo anterior
- **Seta Direita (→)** - Ir para o próximo capítulo
- **T** - Alternar tema

---

### 5. **Barra de Carregamento**
Uma barrinha elegante que aparece no topo da página durante o carregamento.

**Uso automático:**
- Inicia quando você clica em um link
- Termina quando a página carrega completamente

**Controle manual:**
```javascript
window.loadingBar.start();  // Iniciar
window.loadingBar.finish(); // Finalizar
```

---

### 6. **Sistema de Usuário**
Carrega automaticamente as informações do usuário logado.

**Como usar:**
```javascript
// Acessar dados do usuário
console.log(window.userSystem.user.username);
console.log(window.userSystem.user.id);
console.log(window.userSystem.user.avatar);
```

**Exibir dados do usuário no HTML:**
```html
<!-- Nome do usuário -->
<span data-user-name>Carregando...</span>

<!-- Avatar do usuário -->
<img data-user-avatar src="" alt="Avatar">
```

---

## 🎨 Exemplos Práticos

### Exemplo 1: Notificar quando um capítulo é salvo
```javascript
async function salvarCapitulo() {
    try {
        // ... código de salvamento ...
        window.notify.show('✅ Capítulo salvo com sucesso!', 'success', 3000);
    } catch (e) {
        window.notify.show('❌ Erro ao salvar capítulo', 'error', 3000);
    }
}
```

### Exemplo 2: Alternar tema ao clicar em um botão
```html
<button onclick="alternarTema()">🌙 Alternar Tema</button>

<script>
function alternarTema() {
    const novoTema = window.themeSystem.toggle();
    window.notify.show(`Tema alterado para: ${novoTema}`, 'info');
}
</script>
```

### Exemplo 3: Ajustar preferências de leitura
```javascript
// Aumentar fonte para 20px e espaçamento para 2.0
window.readingPrefs.setFontSize(20);
window.readingPrefs.setLineHeight(2.0);
window.notify.show('Preferências atualizadas!', 'success');
```

---

## 💾 Dados Salvos Automaticamente

O `global.js` salva automaticamente no navegador:
- **Tema preferido** (localStorage: `tema`)
- **Tamanho da fonte** (localStorage: `fontSize`)
- **Espaçamento entre linhas** (localStorage: `lineHeight`)

Esses dados persistem mesmo após o usuário fechar o navegador!

---

## 🔧 Como Adicionar Novas Funcionalidades

Se você quiser adicionar uma nova funcionalidade ao `global.js`:

1. Crie uma nova classe:
```javascript
class MinhaNovaFuncionalidade {
    constructor() {
        this.init();
    }

    init() {
        // Código de inicialização
    }

    meuMetodo() {
        // Seu código aqui
    }
}
```

2. Inicialize no final do arquivo:
```javascript
window.minhaFuncionalidade = new MinhaNovaFuncionalidade();
```

3. Use em qualquer lugar:
```javascript
window.minhaFuncionalidade.meuMetodo();
```

---

## 🐛 Troubleshooting

### "Global.js não está carregando"
- Certifique-se de que `<script src="/global.js"></script>` está no `</head>` de todos os HTMLs
- Verifique se o arquivo `global.js` está na pasta raiz do projeto

### "window.notify não está definido"
- Aguarde o carregamento completo da página
- Verifique o console do navegador (F12) para erros

### "Tema não está sendo salvo"
- Limpe o cache do navegador (Ctrl+Shift+Delete)
- Verifique se o localStorage está habilitado

---

## 📊 Estrutura do Global.js

```
global.js
├── NotificationSystem (Toasts)
├── ThemeSystem (Temas)
├── ReadingPreferences (Preferências)
├── NavigationSystem (Atalhos)
├── LoadingBar (Barra de progresso)
└── UserSystem (Dados do usuário)
```

---

## 🎯 Próximos Passos

Com o `global.js` ativo, seu portal agora tem:
- ✅ Sistema de notificações profissional
- ✅ Temas dinâmicos e persistentes
- ✅ Atalhos de teclado intuitivos
- ✅ Barra de carregamento elegante
- ✅ Gerenciamento centralizado de usuário

**Seu portal está oficialmente potencializado! 🚀**
