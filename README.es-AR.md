# Team Docs Git Sync (Plugin de Obsidian)

[🇺🇸 English Version](README.md) | [🇧🇷 Versão em Português (Brasil)](README.pt-BR.md)

## 📑 Índice

- [Team Docs Git Sync (Plugin de Obsidian)](#team-docs-git-sync-plugin-de-obsidian)
  - [📑 Índice](#-índice)
  - [Características Clave](#características-clave)
  - [Cómo Funciona](#cómo-funciona)
  - [Requisitos](#requisitos)
  - [Instalación](#instalación)
  - [Configuración](#configuración)
    - [Configuración de Git](#configuración-de-git)
    - [Configuración del Proveedor de IA](#configuración-del-proveedor-de-ia)
    - [Configuración de Servidores MCP](#configuración-de-servidores-mcp)
    - [Configuración de Gestión de Contexto](#configuración-de-gestión-de-contexto)
  - [Flujo de Trabajo Típico](#flujo-de-trabajo-típico)
    - [Colaboración en Archivos](#colaboración-en-archivos)
    - [Trabajo con Documentos Asistido por IA](#trabajo-con-documentos-asistido-por-ia)
  - [Funciones de IA](#funciones-de-ia)
    - [Modo Chat — Exploración Fluida](#modo-chat--exploración-fluida)
    - [Modo Compose — Análisis Integral](#modo-compose--análisis-integral)
    - [Modo Write — Edición Dirigida](#modo-write--edición-dirigida)
    - [Proveedores de IA Soportados](#proveedores-de-ia-soportados)
  - [Integración MCP](#integración-mcp)
    - [¿Qué es MCP?](#qué-es-mcp)
    - [Configurando Servidores MCP](#configurando-servidores-mcp)
    - [Usando Herramientas MCP](#usando-herramientas-mcp)
  - [Funciones Avanzadas](#funciones-avanzadas)
    - [Gestión de Contexto](#gestión-de-contexto)
    - [Sistema de Memoria](#sistema-de-memoria)
    - [Herramientas de Planificación](#herramientas-de-planificación)
    - [Búsqueda por Similitud](#búsqueda-por-similitud)
  - [Resolución de Conflictos](#resolución-de-conflictos)
  - [Limitaciones](#limitaciones)
  - [Seguridad y Privacidad](#seguridad-y-privacidad)
  - [Solución de Problemas](#solución-de-problemas)
  - [FAQ](#faq)
  - [Licencia](#licencia)

---

Colaborá en notas Markdown con tu equipo usando **tu propio repositorio Git** como backend de sincronización — sin servicios pagos.  
Este plugin de Obsidian agrega funciones ligeras de colaboración sobre Git, más un poderoso asistente de IA con integración MCP (Model Context Protocol) para capacidades extendidas.

Las características principales incluyen:

- Reservas de edición y commits automáticos
- Asistente de IA multi-proveedor con razonamiento avanzado
- Integración MCP para herramientas externas y fuentes de datos
- Gestión inteligente de contexto y memoria
- Feed de actividad y asistentes de resolución de conflictos

Es **gratis**, **auditable** y escala desde uso personal hasta equipos medianos.

---

## Características Clave

- **Sincronización basada en Git** — Funciona con GitHub, GitLab, Bitbucket o Git auto-hospedado.
- **Reservas de edición** — Evita sobrescrituras accidentales permitiendo "reservar" un archivo por tiempo limitado.
- **Commit automático** — Guarda y envía cambios tras un breve período de inactividad.
- **Asistente de IA avanzado** — IA multi-modal con visualización de razonamiento, gestión de contexto y memoria.
- **Integración MCP** — Conectate a servidores Model Context Protocol externos para capacidades expandidas.
- **Operaciones inteligentes de documentos** — Búsqueda por similitud, recorrido de enlaces y soporte para archivos base de Obsidian.
- **Gestión inteligente de contexto** — Resumen automático, extracción de memoria y planificación.
- **Feed de actividad** — Muestra eventos recientes del equipo y reservas.
- **Indicador de estado** — Estado en vivo de sincronización/conflictos/errores en la barra de estado de Obsidian.
- **Asistentes de conflictos** — Resolución guiada para conflictos de merge y cambios locales.
- **Diseño responsivo** — Interfaz moderna que se adapta a diferentes tamaños de pantalla y dispositivos móviles.
- **Alcance flexible** — Elegí entre operaciones de IA solo en documentos del equipo o en toda la vault.

---

## Cómo Funciona

- Tu vault contiene una subcarpeta (ej.: `Team/Docs`) como raíz de los **Documentos del Equipo**.
- El plugin ejecuta comandos Git en esa carpeta: fetch, pull, push, add, commit.
- Las reservas de edición se registran mediante commits Git vacíos (ej.: `[RESERVE] ruta - usuario - timestamp`).
- Al guardar/quedar inactivo, el plugin hace commit automático de tus cambios y dispara una sincronización.
- Si otra persona reservó un archivo, recibirás una advertencia antes de editar.
- El asistente de IA puede buscar, analizar y mejorar tu documentación usando múltiples proveedores y herramientas externas.
- Los servidores MCP extienden las capacidades de la IA con fuentes de datos externas y herramientas especializadas.

---

## Requisitos

- **Obsidian Desktop** (requiere Git CLI — soporte móvil limitado).
- **Git instalado** y disponible en el PATH del sistema.
- **Repositorio Git remoto con permisos de escritura** (GitHub, GitLab, Bitbucket o auto-hospedado).
- **Opcional**: Claves de API para proveedores de IA (OpenAI, Anthropic, Google u Ollama local).
- **Opcional**: Servidores MCP para capacidades extendidas de IA.

---

## Instalación

**Recomendado (Fácil)**

1. Ir a la página **[Releases](https://github.com/lutefd/team-docs-syncer/releases/)** de este repositorio.
2. Descargar el archivo `.zip` más reciente.
3. Extraerlo en la carpeta `.obsidian/plugins/` de tu vault:
   ```
   .obsidian/plugins/team-docs-git-sync/
   ```
4. Reiniciar Obsidian y activar el plugin en **Configuración → Community Plugins**.

**Instalación para Desarrollo**

1. Clonar este repositorio.
2. Instalar dependencias:
   ```sh
   pnpm install
   ```
3. Compilar para producción:
   ```sh
   pnpm build
   ```
4. Copiar o crear un symlink de la salida de compilación hacia:
   ```
   .obsidian/plugins/team-docs-git-sync/
   ```

---

## Configuración

Abrir la pestaña de configuración del plugin en Obsidian:

### Configuración de Git

- **Carpeta de Documentos del Equipo** — Ruta dentro de tu vault para documentos compartidos (ej.: `Team/Docs`).
- **URL Remota de Git** — URL de tu repositorio.
- **Nombre / Email de Usuario** — Usado para commits Git y reservas.
- **Sincronización Automática al Iniciar** — Sincroniza automáticamente cuando se abre Obsidian.
- **Intervalo de Sincronización Automática (min)** — Intervalo de sincronización periódica (0 para desactivar).
- **Subdirectorio de Adjuntos** — Donde se guardan las imágenes pegadas (ej.: `assets`).

### Configuración del Proveedor de IA

- **OpenAI** — Clave de API para modelos GPT.
- **Anthropic** — Clave de API para modelos Claude.
- **Google** — Clave de API para modelos Gemini.
- **Ollama** — URL base y lista de modelos para modelos de IA locales.
- **Configuraciones Avanzadas** — Temperatura, tokens máximos y otros parámetros.

### Configuración de Servidores MCP

- **Agregar Servidores MCP** — Configurar servidores Model Context Protocol externos.
- **Tipos de Transporte** — Soporte para conexiones STDIO, HTTP y SSE.
- **Autenticación** — Manejo automático de flujos OAuth para servidores que requieren autenticación.
- **Estado de Conexión** — Monitoreo en tiempo real de conexiones de servidores MCP.

### Configuración de Gestión de Contexto

- **Alcance de la IA** — Elegir entre operaciones solo en documentos del equipo o en toda la vault.
- **Resumen** — Configurar cuándo las conversaciones se resumen automáticamente.
- **Memoria y Planificación** — Configuraciones para memoria persistente y planificación automática.
- **Recuperación** — Configurar parámetros de búsqueda de documentos y recuperación de contexto.

---

## Flujo de Trabajo Típico

### Colaboración en Archivos

1. Abrir un archivo en la carpeta de Documentos del Equipo.
2. Comenzar a editar — el plugin reservará el archivo para vos.
3. La reserva se extiende automáticamente mientras editás.
4. Tras inactividad, los cambios se commitean automáticamente.
5. Usar el Indicador de Estado para sincronizar, verificar actualizaciones o abrir el feed de actividad.

### Trabajo con Documentos Asistido por IA

- Abrir la **Vista del Chatbot** desde el ribbon o paleta de comandos.
- Seleccionar tu proveedor de IA, modelo y opcionalmente servidores MCP.
- Hacer preguntas, solicitar resúmenes o briefings de documentos.
- Usar `[[nombre-de-archivo]]` para referenciar y adjuntar automáticamente archivos específicos.
- Alternar entre modos **Chat**, **Compose** y **Write** dependiendo de tu tarea.

---

## Funciones de IA

El asistente de IA ofrece tres modos especializados:

### Modo Chat — Exploración Fluida

- Conversación natural sobre tu documentación.
- Recuperación automática de contexto e integración de memoria.
- Soporte para adjuntos de archivos y referencias.
- Integración de herramientas MCP para fuentes de datos externas.
- Visualización de razonamiento en secciones plegables.

### Modo Compose — Análisis Integral

- Análisis profundo con recopilación automática de contexto.
- Recorrido inteligente de enlaces y descubrimiento de documentos.
- Citas automáticas de fuentes con enlaces clicables.
- Extracción de memoria e integración de planificación.
- Soporte para tareas complejas multi-etapa.

### Modo Write — Edición Dirigida

- Elegir archivos específicos para editar con contexto enfocado.
- La IA propone ediciones completas de archivos con revisión interactiva de diff.
- Crear nuevos archivos con contenido generado por IA.
- Soporte para archivos base de Obsidian y datos estructurados.
- Editar propuestas antes de aplicar cambios.

### Proveedores de IA Soportados

- **OpenAI** — Todos los modelos basados en texto.
- **Anthropic** — Todos los modelos Claude.
- **Google** — Todos los modelos Gemini.
- **Ollama** — Modelos locales como Llama, Gemma y ajustes finos personalizados.

---

## Integración MCP

### ¿Qué es MCP?

Model Context Protocol (MCP) permite que los asistentes de IA se conecten a herramientas externas y fuentes de datos. Este plugin soporta servidores MCP para extender las capacidades de la IA más allá de tu documentación.

### Configurando Servidores MCP

1. **Instalar Servidores MCP** — Seguir la documentación de los servidores MCP elegidos.
2. **Configurar en Ajustes** — Agregar configuraciones de servidor con tipos de transporte apropiados.
3. **Autenticación** — El plugin maneja flujos OAuth automáticamente cuando es necesario.
4. **Probar Conexiones** — Verificar el estado del servidor en la sección de configuraciones MCP.

### Usando Herramientas MCP

- **Seleccionar Servidores** — Elegir qué servidores MCP usar en tus sesiones de chat.
- **Integración Automática** — La IA decide automáticamente cuándo usar herramientas MCP vs. herramientas internas.
- **Sistema de Prioridad** — Las herramientas MCP se prefieren cuando ofrecen funcionalidad superior.
- **Monitoreo de Estado** — Estado de conexión en tiempo real y manejo de errores.

Tipos comunes de servidores MCP:

- **Sistemas de Archivos** — Acceder a archivos fuera de tu vault
- **APIs Web** — Motores de búsqueda, bases de datos, servicios externos
- **Herramientas de Desarrollo** — Operaciones Git, análisis de código, testing
- **Dominios Especializados** — Datos científicos, información financiera, etc.

---

## Funciones Avanzadas

### Gestión de Contexto

- **Resumen Automático** — Las conversaciones largas se comprimen inteligentemente.
- **Gestión de Tokens** — Poda inteligente de contexto para mantenerse dentro de los límites del modelo.
- **Recuperación de Documentos** — Los documentos relevantes se incluyen automáticamente en el contexto.
- **Integración de Memoria** — Los hechos persistentes y preferencias se presentan cuando son relevantes.

### Sistema de Memoria

- **Almacenamiento de Hechos** — La información importante se extrae y almacena automáticamente.
- **Preferencias** — Las preferencias del usuario y convenciones del equipo se recuerdan.
- **Seguimiento de Entidades** — Personas, proyectos y entidades importantes se rastrean entre sesiones.
- **Persistencia de Sesión** — La memoria persiste entre sesiones de chat y reinicios del plugin.

### Herramientas de Planificación

- **Planificación Automática** — Las tareas complejas disparan generación automática de planes.
- **Borrador** — Planificación específica de sesión y seguimiento de progreso.
- **Próximos Pasos** — La IA sugiere acciones de seguimiento después de completar tareas.
- **Seguimiento de Progreso** — Los planes se actualizan conforme progresa el trabajo.

### Búsqueda por Similitud

- **Similitud de Documentos** — Encontrar documentos similares a un archivo semilla usando etiquetas y contenido.
- **Búsqueda Multi-semilla** — Encontrar documentos similares a múltiples archivos semilla.
- **Generación de Archivos Base** — Generación automática de archivos base de Obsidian para resultados de búsqueda.
- **Análisis de Enlaces** — Recorrer enlaces de documentos y analizar conexiones.

---

## Resolución de Conflictos

- Los cambios locales que serían sobrescritos muestran un modal:
  - **Commit & Sync**
  - **Stash & Sync**
  - **Discard & Sync**
- Los conflictos de merge abren un modal de resolución con opciones de estrategia.
- Los cambios propuestos por la IA siempre se revisan mediante diff interactivo.

---

## Limitaciones

- No es en tiempo real — la sincronización es basada en Git y periódica.
- Las reservas de edición son cooperativas, no forzadas.
- Solo escritorio (móvil limitado por Git CLI).
- Archivos binarios grandes o repositorios enormes pueden reducir el rendimiento.
- Las funciones de IA requieren internet y claves de API válidas (excepto Ollama).
- Los servidores MCP requieren configuración y mantenimiento externo.

---

## Seguridad y Privacidad

- Tus notas permanecen **en tu repositorio** — sin servidores de terceros más allá de tu host Git.
- Los proveedores de IA procesan el contenido según sus políticas de privacidad.
- Ollama se ejecuta localmente y mantiene todos los datos en tu máquina.
- Los servidores MCP pueden tener sus propias implicaciones de privacidad — revisar su documentación.
- Evitar commitear secretos — usar `.gitignore`.
- El historial de chat de la IA, memoria y datos de planificación se almacenan localmente.
- Los flujos OAuth se manejan de forma segura con limpieza automática.

---

## Solución de Problemas

- Asegurarse de que Git esté instalado y en el PATH.
- Verificar URL remota y credenciales.
- Revisar claves de API y conectividad de los proveedores de IA.
- Para Ollama, asegurarse de que el servicio esté corriendo y los modelos disponibles.
- Para servidores MCP, verificar configuración y estado de conexión.
- Revisar la consola para errores de Git, IA o MCP.
- Limpiar datos del plugin si se enfrentan problemas persistentes.

---

## FAQ

**¿Por qué Git en lugar de sincronización en tiempo real?**  
Git es gratis, ubicuo y funciona offline. Este plugin lo hace práctico para equipos que ya usan Git.

**¿Dos personas pueden editar el mismo archivo?**  
Sí, pero el sistema de reservas reduce conflictos. Los conflictos aún pueden ocurrir y deben resolverse.

**¿Esto reemplaza servicios pagos de sincronización?**  
Para muchos equipos, sí. Para colaboración en tiempo real, un servicio dedicado puede ser mejor.

**¿Qué son los servidores MCP y los necesito?**  
Los servidores MCP extienden las capacidades de la IA con herramientas externas y datos. Son opcionales pero pueden mejorar mucho la funcionalidad para casos de uso específicos.

**¿Puedo usar múltiples proveedores de IA y servidores MCP?**  
Sí — configurar múltiples proveedores y servidores, luego seleccionar cuáles usar para cada conversación.

**¿Mis datos se envían a proveedores de IA?**  
Solo al usar proveedores en la nube. Ollama mantiene todo local. Los servidores MCP dependen de su implementación.

**¿Cómo funciona el sistema de memoria?**  
La IA extrae automáticamente hechos importantes, preferencias y decisiones de las conversaciones y los almacena localmente para referencia futura.

---

## Licencia

MIT © 2025 Luis Dourado
