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
    - [Configurações de Servidores MCP](#configurações-de-servidores-mcp)
    - [Configurações de Gerenciamento de Contexto](#configurações-de-gerenciamento-de-contexto)
  - [Fluxo de Trabalho Típico](#fluxo-de-trabalho-típico)
    - [Colaboração em Arquivos](#colaboração-em-arquivos)
    - [Trabalho com Documentos Assistido por IA](#trabalho-com-documentos-assistido-por-ia)
  - [Recursos de IA](#recursos-de-ia)
    - [Modo Chat — Exploração Fluida](#modo-chat--exploração-fluida)
    - [Modo Compose — Análise Abrangente](#modo-compose--análise-abrangente)
    - [Modo Write — Edição Direcionada](#modo-write--edição-direcionada)
    - [Provedores de IA Suportados](#provedores-de-ia-suportados)
  - [Integração MCP](#integração-mcp)
    - [O que é MCP?](#o-que-é-mcp)
    - [Configurando Servidores MCP](#configurando-servidores-mcp)
    - [Usando Ferramentas MCP](#usando-ferramentas-mcp)
  - [Recursos Avançados](#recursos-avançados)
    - [Gerenciamento de Contexto](#gerenciamento-de-contexto)
    - [Sistema de Memória](#sistema-de-memória)
    - [Ferramentas de Planejamento](#ferramentas-de-planejamento)
    - [Busca por Similaridade](#busca-por-similaridade)
  - [Resolução de Conflitos](#resolução-de-conflitos)
  - [Limitações](#limitações)
  - [Segurança e Privacidade](#segurança-e-privacidade)
  - [Solução de Problemas](#solução-de-problemas)
  - [FAQ](#faq)
  - [Licença](#licença)

---

Colabore em anotações Markdown com sua equipe usando **seu próprio repositório Git** como backend de sincronização — sem serviços pagos.  
Este plugin do Obsidian adiciona recursos leves de colaboração sobre o Git, além de um poderoso assistente de IA com integração MCP (Model Context Protocol) para capacidades estendidas.

Recursos principais incluem:

- Reservas de edição e commits automáticos
- Assistente de IA multi-provedor com raciocínio avançado
- Integração MCP para ferramentas externas e fontes de dados
- Gerenciamento inteligente de contexto e memória
- Feed de atividades e auxiliares de resolução de conflitos

É **gratuito**, **auditável** e escala desde uso pessoal até equipes médias.

---

## Principais Recursos

- **Sincronização baseada em Git** — Funciona com GitHub, GitLab, Bitbucket ou Git auto-hospedado.
- **Reservas de edição** — Evita sobrescritas acidentais permitindo "reservar" um arquivo por tempo limitado.
- **Commit automático** — Salva e envia alterações após um curto período de inatividade.
- **Assistente de IA avançado** — IA multi-modal com exibição de raciocínio, gerenciamento de contexto e memória.
- **Integração MCP** — Conecte-se a servidores Model Context Protocol externos para capacidades expandidas.
- **Operações inteligentes de documentos** — Busca por similaridade, travessia de links e suporte a arquivos base do Obsidian.
- **Gerenciamento inteligente de contexto** — Resumo automático, extração de memória e planejamento.
- **Feed de atividades** — Mostra eventos recentes e reservas da equipe.
- **Indicador de status** — Status ao vivo de sincronização/conflitos/erros na barra de status do Obsidian.
- **Auxiliares de conflitos** — Resolução guiada para conflitos de merge e alterações locais.
- **Design responsivo** — Interface moderna que se adapta a diferentes tamanhos de tela e dispositivos móveis.
- **Escopo flexível** — Escolha entre operações de IA apenas nos documentos da equipe ou em toda a vault.

---

## Como Funciona

- Sua vault contém uma subpasta (ex.: `Team/Docs`) como raiz dos **Documentos da Equipe**.
- O plugin executa comandos Git nessa pasta: fetch, pull, push, add, commit.
- Reservas de edição são registradas via commits Git vazios (ex.: `[RESERVE] caminho - usuário - timestamp`).
- Ao salvar/ficar inativo, o plugin faz commit automático das suas alterações e dispara uma sincronização.
- Se outra pessoa reservou um arquivo, você será avisado antes de editar.
- O assistente de IA pode pesquisar, analisar e aprimorar sua documentação usando múltiplos provedores e ferramentas externas.
- Servidores MCP estendem as capacidades da IA com fontes de dados externas e ferramentas especializadas.

---

## Requisitos

- **Obsidian Desktop** (Git CLI necessário — suporte móvel limitado).
- **Git instalado** e disponível no PATH do sistema.
- **Repositório Git remoto gravável** (GitHub, GitLab, Bitbucket ou auto-hospedado).
- **Opcional**: Chaves de API para provedores de IA (OpenAI, Anthropic, Google ou Ollama local).
- **Opcional**: Servidores MCP para capacidades estendidas da IA.

---

## Instalação

**Recomendado (Fácil)**

1. Vá para a página **[Releases](https://github.com/lutefd/team-docs-syncer/releases/)** deste repositório.
2. Baixe o arquivo `.zip` mais recente.
3. Extraia para a pasta `.obsidian/plugins/` da sua vault:
   ```
   .obsidian/plugins/team-docs-git-sync/
   ```
4. Reinicie o Obsidian e ative o plugin em **Configurações → Community Plugins**.

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
4. Copie ou crie um symlink da saída da compilação para:
   ```
   .obsidian/plugins/team-docs-git-sync/
   ```

---

## Configuração

Abra a aba de configurações do plugin no Obsidian:

### Configurações do Git

- **Pasta de Documentos da Equipe** — Caminho dentro da sua vault para documentos compartilhados (ex.: `Team/Docs`).
- **URL Remota do Git** — URL do seu repositório.
- **Nome / E-mail do Usuário** — Usado para commits Git e reservas.
- **Sincronização Automática na Inicialização** — Sincroniza automaticamente quando o Obsidian é aberto.
- **Intervalo de Sincronização Automática (min)** — Intervalo de sincronização periódica (0 para desativar).
- **Subdiretório de Anexos** — Onde imagens coladas são armazenadas (ex.: `assets`).

### Configurações do Provedor de IA

- **OpenAI** — Chave de API para modelos GPT.
- **Anthropic** — Chave de API para modelos Claude.
- **Google** — Chave de API para modelos Gemini.
- **Ollama** — URL base e lista de modelos para modelos de IA locais.
- **Configurações Avançadas** — Temperatura, tokens máximos e outros parâmetros.

### Configurações de Servidores MCP

- **Adicionar Servidores MCP** — Configure servidores Model Context Protocol externos.
- **Tipos de Transporte** — Suporte para conexões STDIO, HTTP e SSE.
- **Autenticação** — Tratamento automático de fluxos OAuth para servidores que requerem autenticação.
- **Status de Conexão** — Monitoramento em tempo real de conexões de servidores MCP.

### Configurações de Gerenciamento de Contexto

- **Escopo da IA** — Escolha entre operações apenas nos documentos da equipe ou em toda a vault.
- **Resumo** — Configure quando conversas são automaticamente resumidas.
- **Memória e Planejamento** — Configurações para memória persistente e planejamento automático.
- **Recuperação** — Configure parâmetros de busca de documentos e recuperação de contexto.

---

## Fluxo de Trabalho Típico

### Colaboração em Arquivos

1. Abra um arquivo na pasta de Documentos da Equipe.
2. Comece a editar — o plugin reservará o arquivo para você.
3. A reserva é estendida automaticamente enquanto você edita.
4. Após inatividade, as alterações são commitadas automaticamente.
5. Use o Indicador de Status para sincronizar, verificar atualizações ou abrir o feed de atividades.

### Trabalho com Documentos Assistido por IA

- Abra a **Visão do Chatbot** pelo ribbon ou paleta de comandos.
- Selecione seu provedor de IA, modelo e opcionalmente servidores MCP.
- Faça perguntas, solicite resumos ou briefings de documentos.
- Use `[[nome-do-arquivo]]` para referenciar e anexar automaticamente arquivos específicos.
- Alterne entre os modos **Chat**, **Compose** e **Write** dependendo da sua tarefa.

---

## Recursos de IA

O assistente de IA oferece três modos especializados:

### Modo Chat — Exploração Fluida

- Conversa natural sobre sua documentação.
- Recuperação automática de contexto e integração de memória.
- Suporte para anexos de arquivos e referências.
- Integração de ferramentas MCP para fontes de dados externas.
- Exibição de raciocínio em seções recolhíveis.

### Modo Compose — Análise Abrangente

- Análise profunda com coleta automática de contexto.
- Travessia inteligente de links e descoberta de documentos.
- Citações automáticas de fontes com links clicáveis.
- Extração de memória e integração de planejamento.
- Suporte para tarefas complexas multi-etapa.

### Modo Write — Edição Direcionada

- Escolha arquivos específicos para editar com contexto focado.
- IA propõe edições completas de arquivos com revisão interativa de diff.
- Crie novos arquivos com conteúdo gerado por IA.
- Suporte para arquivos base do Obsidian e dados estruturados.
- Edite propostas antes de aplicar alterações.

### Provedores de IA Suportados

- **OpenAI** — Todos os modelos baseados em texto.
- **Anthropic** — Todos os modelos Claude.
- **Google** — Todos os modelos Gemini.
- **Ollama** — Modelos locais como Llama, Gemma e ajustes finos personalizados.

---

## Integração MCP

### O que é MCP?

Model Context Protocol (MCP) permite que assistentes de IA se conectem a ferramentas externas e fontes de dados. Este plugin suporta servidores MCP para estender as capacidades da IA além da sua documentação.

### Configurando Servidores MCP

1. **Instalar Servidores MCP** — Siga a documentação dos servidores MCP escolhidos.
2. **Configurar nas Configurações** — Adicione configurações de servidor com tipos de transporte apropriados.
3. **Autenticação** — O plugin trata fluxos OAuth automaticamente quando necessário.
4. **Testar Conexões** — Verifique o status do servidor na seção de configurações MCP.

### Usando Ferramentas MCP

- **Selecionar Servidores** — Escolha quais servidores MCP usar em suas sessões de chat.
- **Integração Automática** — A IA decide automaticamente quando usar ferramentas MCP vs. ferramentas internas.
- **Sistema de Prioridade** — Ferramentas MCP são preferidas quando oferecem funcionalidade superior.
- **Monitoramento de Status** — Status de conexão em tempo real e tratamento de erros.

Tipos comuns de servidores MCP:

- **Sistemas de Arquivos** — Acesse arquivos fora da sua vault
- **APIs Web** — Motores de busca, bancos de dados, serviços externos
- **Ferramentas de Desenvolvimento** — Operações Git, análise de código, testes
- **Domínios Especializados** — Dados científicos, informações financeiras, etc.

---

## Recursos Avançados

### Gerenciamento de Contexto

- **Resumo Automático** — Conversas longas são comprimidas inteligentemente.
- **Gerenciamento de Tokens** — Poda inteligente de contexto para ficar dentro dos limites do modelo.
- **Recuperação de Documentos** — Documentos relevantes são automaticamente incluídos no contexto.
- **Integração de Memória** — Fatos persistentes e preferências são apresentados quando relevantes.

### Sistema de Memória

- **Armazenamento de Fatos** — Informações importantes são automaticamente extraídas e armazenadas.
- **Preferências** — Preferências do usuário e convenções da equipe são lembradas.
- **Rastreamento de Entidades** — Pessoas, projetos e entidades importantes são rastreados entre sessões.
- **Persistência de Sessão** — Memória persiste entre sessões de chat e reinicializações do plugin.

### Ferramentas de Planejamento

- **Planejamento Automático** — Tarefas complexas disparam geração automática de planos.
- **Rascunho** — Planejamento específico de sessão e rastreamento de progresso.
- **Próximos Passos** — IA sugere ações de acompanhamento após completar tarefas.
- **Rastreamento de Progresso** — Planos são atualizados conforme o trabalho progride.

### Busca por Similaridade

- **Similaridade de Documentos** — Encontre documentos similares a um arquivo semente usando tags e conteúdo.
- **Busca Multi-semente** — Encontre documentos similares a múltiplos arquivos semente.
- **Geração de Arquivos Base** — Geração automática de arquivos base do Obsidian para resultados de busca.
- **Análise de Links** — Traverse links de documentos e analise conexões.

---

## Resolução de Conflitos

- Alterações locais que seriam sobrescritas disparam um modal:
  - **Commit & Sync**
  - **Stash & Sync**
  - **Discard & Sync**
- Conflitos de merge abrem um modal de resolução com opções de estratégia.
- Alterações propostas pela IA sempre são revisadas via diff interativo.

---

## Limitações

- Não é em tempo real — sincronização é baseada em Git e periódica.
- Reservas de edição são cooperativas, não forçadas.
- Apenas desktop (móvel limitado pelo Git CLI).
- Arquivos binários grandes ou repositórios enormes podem reduzir o desempenho.
- Recursos de IA requerem internet e chaves de API válidas (exceto Ollama).
- Servidores MCP requerem configuração e manutenção externa.

---

## Segurança e Privacidade

- Suas notas permanecem **no seu repositório** — sem servidores de terceiros além do seu host Git.
- Provedores de IA processam conteúdo conforme suas políticas de privacidade.
- Ollama roda localmente e mantém todos os dados na sua máquina.
- Servidores MCP podem ter suas próprias implicações de privacidade — revise sua documentação.
- Evite commitar segredos — use `.gitignore`.
- Histórico de chat da IA, memória e dados de planejamento são armazenados localmente.
- Fluxos OAuth são tratados de forma segura com limpeza automática.

---

## Solução de Problemas

- Certifique-se de que o Git está instalado e no PATH.
- Verifique URL remota e credenciais.
- Verifique chaves de API e conectividade dos provedores de IA.
- Para Ollama, certifique-se de que o serviço está rodando e os modelos estão disponíveis.
- Para servidores MCP, verifique a configuração e status de conexão.
- Verifique o console para erros de Git, IA ou MCP.
- Limpe os dados do plugin se enfrentar problemas persistentes.

---

## FAQ

**Por que Git em vez de sincronização em tempo real?**  
Git é gratuito, ubíquo e funciona offline. Este plugin o torna prático para equipes que já usam Git.

**Duas pessoas podem editar o mesmo arquivo?**  
Sim, mas o sistema de reservas reduz conflitos. Conflitos ainda podem acontecer e devem ser resolvidos.

**Isso substitui serviços pagos de sincronização?**  
Para muitas equipes, sim. Para colaboração em tempo real, um serviço dedicado pode ser melhor.

**O que são servidores MCP e preciso deles?**  
Servidores MCP estendem as capacidades da IA com ferramentas externas e dados. São opcionais, mas podem melhorar muito a funcionalidade para casos de uso específicos.

**Posso usar múltiplos provedores de IA e servidores MCP?**  
Sim — configure múltiplos provedores e servidores, depois selecione quais usar para cada conversa.

**Meus dados são enviados para provedores de IA?**  
Apenas ao usar provedores em nuvem. Ollama mantém tudo local. Servidores MCP dependem de sua implementação.

**Como funciona o sistema de memória?**  
A IA automaticamente extrai fatos importantes, preferências e decisões das conversas e os armazena localmente para referência futura.

---

## Licença

MIT © 2025 Luis Dourado
