# Team Docs Git Sync (Plugin do Obsidian)

[🇺🇸 English Version](README.md) | [🇦🇷 Versión en Español (Argentina)](README.es-AR.md)

## 📑 Índice

- [Team Docs Git Sync (Plugin do Obsidian)](#team-docs-git-sync-plugin-do-obsidian)
  - [📑 Índice](#-índice)
  - [Principais Recursos](#principais-recursos)
  - [Como Funciona](#como-funciona)
  - [Requisitos](#requisitos)
  - [Instalação](#instalação)
  - [Configuração](#configuração)
    - [Configurações do Git](#configurações-do-git)
    - [Configurações do Provedor de IA](#configurações-do-provedor-de-ia)
  - [Fluxo de Trabalho Típico](#fluxo-de-trabalho-típico)
    - [Colaboração em Arquivos](#colaboração-em-arquivos)
    - [Trabalho com Documentos Assistido por IA](#trabalho-com-documentos-assistido-por-ia)
  - [Recursos de IA](#recursos-de-ia)
    - [Modo Chat — Exploração Fluida](#modo-chat--exploração-fluida)
    - [Modo Edição — Edição Direcionada](#modo-edição--edição-direcionada)
    - [Provedores de IA Suportados](#provedores-de-ia-suportados)
  - [Resolução de Conflitos](#resolução-de-conflitos)
  - [Limitações](#limitações)
  - [Segurança e Privacidade](#segurança-e-privacidade)
  - [Solução de Problemas](#solução-de-problemas)
  - [FAQ](#faq)
  - [Licença](#licença)

---

Colabore em anotações Markdown com sua equipe usando **seu próprio repositório Git** como backend de sincronização — sem serviços pagos.  
Este plugin do Obsidian adiciona recursos leves de colaboração sobre o Git, incluindo:

- Reservas de edição
- Commits automáticos
- Auxiliares de resolução de conflitos
- Assistente de documentos com IA
- Feed de atividades

É **gratuito**, **auditável** e funciona bem para equipes pequenas e médias que já usam Git.

---

## Principais Recursos

- **Sincronização baseada em Git** — Funciona com GitHub, GitLab, Bitbucket ou Git auto-hospedado.
- **Reservas de edição** — Evita sobrescritas acidentais permitindo “reservar” um arquivo por tempo limitado.
- **Commit automático** — Salva e envia alterações após um curto período de inatividade.
- **Assistente de documentos com IA** — Pesquisa, resume e gera briefings dos documentos, como um NotebookLM autoatualizável.
- **Operações inteligentes de arquivos** — IA pode propor edições, criar arquivos e gerar conteúdo.
- **Feed de atividades** — Mostra eventos recentes e reservas.
- **Indicador de status** — Mostra sincronização, conflitos ou erros.
- **Auxiliares de conflitos** — Guias para resolver conflitos de merge.
- **Design responsivo** — Interface moderna adaptável.
- **Configuração flexível** — Escolha pasta, repositório remoto, provedores de IA e mais.

---

## Como Funciona

- Sua vault contém uma subpasta (ex.: `Team/Docs`) como raiz dos **Documentos da Equipe**.
- O plugin executa comandos Git nessa pasta: fetch, pull, push, add, commit.
- Reservas são registradas via commits vazios (`[RESERVE] caminho - usuário - data`).
- Ao salvar ou ficar inativo, o plugin faz commit e sincroniza.
- Se outro usuário reservou o arquivo, você será avisado antes de editar.
- O assistente de IA pode pesquisar, ler e resumir documentos usando vários provedores de IA.

---

## Requisitos

- **Obsidian Desktop** (Git CLI necessário — suporte móvel limitado).
- **Git instalado** e no PATH do sistema.
- **Repositório Git remoto gravável** (GitHub, GitLab, Bitbucket ou auto-hospedado).
- **Opcional**: Chaves de API para IA (OpenAI, Anthropic, Google ou Ollama local).

---

## Instalação

**Recomendado (Fácil)**

1. Vá para a página **[Releases](https://github.com/lutefd/team-docs-syncer/releases/)**.
2. Baixe o `.zip` mais recente.
3. Extraia para:

```

.obsidian/plugins/team-docs-git-sync/

```

4. Reinicie o Obsidian e ative o plugin em **Configurações → Plugins da Comunidade**.

**Instalação para Desenvolvimento**

1. Clone este repositório.
2. Instale as dependências:

```sh
pnpm install
```

3. Compile para produção:
   ```sh
   pnpm build
   ```
4. Copie ou crie um symlink para:
   ```
   .obsidian/plugins/team-docs-git-sync/
   ```

---

## Configuração

Abra a aba de configurações do plugin no Obsidian:

### Configurações do Git

- **Pasta de Documentos da Equipe** — Caminho dentro da sua vault para os documentos compartilhados (ex.: `Team/Docs`).
- **URL Remota do Git** — URL do seu repositório.
- **Nome / E-mail do Usuário** — Usado nos commits e nas reservas.
- **Sincronizar ao Iniciar** — Sincroniza automaticamente ao abrir o Obsidian.
- **Intervalo de Sincronização (min)** — Intervalo de sincronização periódica (0 para desativar).
- **Subpasta de Anexos** — Onde imagens coladas serão armazenadas (ex.: `assets`).

### Configurações do Provedor de IA

- **OpenAI** — Chave de API para modelos GPT (GPT‑5, GPT‑4o, GPT‑4o-mini, etc.).
- **Anthropic** — Chave de API para modelos Claude (Claude 3.5 Sonnet, Haiku, Opus).
- **Google** — Chave de API para modelos Gemini (Gemini 2.5 Pro, Gemini 1.5 Flash, etc.).
- **Ollama** — URL base e lista de modelos locais.
- **Configurações Avançadas** — Temperatura, tokens máximos e outros parâmetros.

---

## Fluxo de Trabalho Típico

### Colaboração em Arquivos

1. Abra um arquivo na pasta de Documentos da Equipe.
2. Comece a editar — o plugin reservará o arquivo para você.
3. A reserva é estendida automaticamente enquanto você edita.
4. Após inatividade, as alterações são commitadas automaticamente.
5. Use o Indicador de Status para sincronizar, verificar atualizações ou abrir o feed de atividades.

### Trabalho com Documentos Assistido por IA

- Abra a **Visão do Chatbot** pelo menu lateral ou paleta de comandos.
- Selecione o provedor e modelo de IA.
- Faça perguntas, solicite resumos ou briefings de documentos.
- Use `@nome-do-arquivo` para referenciar arquivos específicos.
- Alterne entre **Modo Chat** (exploração fluida) e **Modo Edição** (edição direcionada) conforme a tarefa.

---

## Recursos de IA

Ambos os modos compartilham as mesmas ferramentas de IA através do **composer**, mas diferem no foco:

### Modo Chat — Exploração Fluida

- Pesquisa e leitura de arquivos relevantes para responder perguntas.
- Resumo e briefing de seções inteiras dos documentos.
- Segue links entre notas para descobrir contexto relacionado que você talvez não conheça.
- Explora a estrutura de diretórios para encontrar conexões mais profundas.
- Citações automáticas com links clicáveis.
- Fixação de arquivos para focar a atenção da IA.

### Modo Edição — Edição Direcionada

- Escolha arquivos específicos para editar, economizando tokens e tempo.
- Solicite criação ou modificação de conteúdo para arquivos selecionados.
- IA propõe edições completas com revisão interativa de diff.
- Criação de novos arquivos com conteúdo gerado por IA.
- Edição das propostas antes de aplicar.

### Provedores de IA Suportados

- **OpenAI** — Todos os modelos baseados em texto.
- **Anthropic** — Todos os modelos baseados em texto.
- **Google** — Todos os modelos baseados em texto.
- **Ollama** — Modelos locais como Llama, Gemma e modelos customizados.

---

## Resolução de Conflitos

- Alterações locais que seriam sobrescritas exibem um modal com opções:
  - **Commit & Sync**
  - **Stash & Sync**
  - **Discard & Sync**
- Conflitos de merge abrem um modal de resolução com estratégias.
- Alterações propostas pela IA sempre passam por revisão interativa de diff.

---

## Limitações

- Não é em tempo real — sincronização é baseada em Git e periódica.
- Reservas de edição são cooperativas, não forçadas.
- Apenas desktop (suporte móvel limitado pelo Git CLI).
- Arquivos binários grandes ou repositórios enormes podem reduzir o desempenho.
- Recursos de IA requerem internet e chaves de API válidas (exceto Ollama).

---

## Segurança e Privacidade

- Suas notas permanecem **no seu repositório** — sem servidores de terceiros além do seu host Git.
- Provedores de IA processam conteúdo conforme suas políticas de privacidade.
- Ollama roda localmente e mantém todos os dados na sua máquina.
- Evite commitar segredos — use `.gitignore`.
- Histórico de chat da IA é armazenado localmente.

---

## Solução de Problemas

- Verifique se o Git está instalado e no PATH.
- Confirme a URL remota e credenciais.
- Verifique chaves de API e conectividade dos provedores de IA.
- Para Ollama, confirme que o serviço está rodando e os modelos disponíveis.
- Veja o console para erros de Git ou IA.

---

## FAQ

**Por que Git em vez de sincronização em tempo real?**  
Git é gratuito, ubíquo e funciona offline. Este plugin o torna prático para equipes que já usam Git.

**Duas pessoas podem editar o mesmo arquivo?**  
Sim, mas o sistema de reservas reduz conflitos. Conflitos ainda podem ocorrer e precisam ser resolvidos.

**Isso substitui serviços pagos de sincronização?**  
Para muitas equipes, sim. Para colaboração em tempo real, um serviço dedicado pode ser melhor.

**Qual provedor de IA devo escolher?**

- **GPT‑5** para uso geral e desempenho equilibrado.
- **Claude** para raciocínio complexo.
- **Gemini** para contextos muito longos.
- **Ollama** para privacidade e uso offline.

**Posso usar vários provedores de IA?**  
Sim — configure vários e alterne quando quiser.

**Meus dados são enviados para provedores de IA?**  
Somente ao usar provedores em nuvem. Ollama mantém tudo local.

---

## Licença

MIT © 2025 Luis Dourado
