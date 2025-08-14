[🇺🇸 English Version](README.md) | [🇧🇷 Versão em Português (Brasil)](README.pt-BR.md)

## 📑 Índice

- [📑 Índice](#-índice)
- [Características Clave](#características-clave)
- [Cómo Funciona](#cómo-funciona)
- [Requisitos](#requisitos)
- [Instalación](#instalación)
- [Configuración](#configuración)
  - [Configuración de Git](#configuración-de-git)
  - [Configuración del Proveedor de IA](#configuración-del-proveedor-de-ia)
- [Flujo de Trabajo Típico](#flujo-de-trabajo-típico)
  - [Colaboración en Archivos](#colaboración-en-archivos)
  - [Trabajo con Documentos Asistido por IA](#trabajo-con-documentos-asistido-por-ia)
- [Funciones de IA](#funciones-de-ia)
  - [Modo Chat — Exploración Fluida](#modo-chat--exploración-fluida)
  - [Modo Edición — Edición Dirigida](#modo-edición--edición-dirigida)
  - [Proveedores de IA Soportados](#proveedores-de-ia-soportados)
- [Resolución de Conflictos](#resolución-de-conflictos)
- [Limitaciones](#limitaciones)
- [Seguridad y Privacidad](#seguridad-y-privacidad)
- [Solución de Problemas](#solución-de-problemas)
- [FAQ](#faq)
- [Licencia](#licencia)

---

Colaborá en notas Markdown con tu equipo usando **tu propio repositorio Git** como backend de sincronización — sin servicios pagos.  
Este plugin de Obsidian agrega funciones ligeras de colaboración sobre Git, incluyendo:

- Reservas de edición
- Commits automáticos
- Asistentes para resolver conflictos
- Asistente de documentos con IA
- Feed de actividad

Es **gratis**, **auditable** y funciona bien para equipos pequeños y medianos que ya usan Git.

---

## Características Clave

- **Sincronización basada en Git** — Funciona con GitHub, GitLab, Bitbucket o Git auto-hospedado.
- **Reservas de edición** — Evita sobrescrituras accidentales permitiendo “reservar” un archivo por tiempo limitado.
- **Commit automático** — Guarda y envía cambios tras un breve período de inactividad.
- **Asistente de documentos con IA** — Busca, resume y genera briefings de tus documentos, como un NotebookLM auto-actualizable.
- **Operaciones inteligentes de archivos** — La IA puede proponer ediciones, crear archivos y generar contenido.
- **Feed de actividad** — Muestra eventos recientes y reservas.
- **Indicador de estado** — Muestra sincronización, conflictos o errores.
- **Asistentes de conflictos** — Guías para resolver conflictos de merge.
- **Diseño responsivo** — Interfaz moderna adaptable.
- **Configuración flexible** — Elegí carpeta, repositorio remoto, proveedores de IA y más.

---

## Cómo Funciona

- Tu vault contiene una subcarpeta (ej.: `Team/Docs`) como raíz de los **Documentos del Equipo**.
- El plugin ejecuta comandos Git en esa carpeta: fetch, pull, push, add, commit.
- Las reservas se registran mediante commits vacíos (`[RESERVE] ruta - usuario - fecha`).
- Al guardar o quedar inactivo, el plugin hace commit y sincroniza.
- Si otro usuario reservó el archivo, recibirás una advertencia antes de editar.
- El asistente de IA puede buscar, leer y resumir documentos usando varios proveedores de IA.

---

## Requisitos

- **Obsidian Desktop** (requiere Git CLI — soporte móvil limitado).
- **Git instalado** y disponible en el PATH del sistema.
- **Repositorio Git remoto con permisos de escritura** (GitHub, GitLab, Bitbucket o auto-hospedado).
- **Opcional**: Claves de API para IA (OpenAI, Anthropic, Google u Ollama local).

---

## Instalación

**Recomendado (Fácil)**

1. Ir a la página **[Releases](./releases)**.
2. Descargar el `.zip` más reciente.
3. Extraerlo en:

```

.obsidian/plugins/team-docs-git-sync/

```

4. Reiniciar Obsidian y activar el plugin en **Configuración → Plugins de la Comunidad**.

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
4. Copiar o crear un symlink hacia:
   ```
   .obsidian/plugins/team-docs-git-sync/
   ```

---

## Configuración

Abrir la pestaña de configuración del plugin en Obsidian:

### Configuración de Git

- **Carpeta de Documentos del Equipo** — Ruta dentro de tu vault para los documentos compartidos (ej.: `Team/Docs`).
- **URL Remota de Git** — URL de tu repositorio.
- **Nombre / Email de Usuario** — Usado en commits y reservas.
- **Sincronizar al Iniciar** — Sincroniza automáticamente al abrir Obsidian.
- **Intervalo de Sincronización (min)** — Intervalo de sincronización periódica (0 para desactivar).
- **Subcarpeta de Adjuntos** — Donde se guardan las imágenes pegadas (ej.: `assets`).

### Configuración del Proveedor de IA

- **OpenAI** — Clave de API para modelos GPT (GPT‑5, GPT‑4o, GPT‑4o-mini, etc.).
- **Anthropic** — Clave de API para modelos Claude (Claude 3.5 Sonnet, Haiku, Opus).
- **Google** — Clave de API para modelos Gemini (Gemini 2.5 Pro, Gemini 1.5 Flash, etc.).
- **Ollama** — URL base y lista de modelos locales.
- **Configuraciones Avanzadas** — Temperatura, tokens máximos y otros parámetros.

---

## Flujo de Trabajo Típico

### Colaboración en Archivos

1. Abrir un archivo en la carpeta de Documentos del Equipo.
2. Comenzar a editar — el plugin reservará el archivo para vos.
3. La reserva se extiende automáticamente mientras editás.
4. Tras inactividad, los cambios se commitean automáticamente.
5. Usar el Indicador de Estado para sincronizar, verificar actualizaciones o abrir el feed de actividad.

### Trabajo con Documentos Asistido por IA

- Abrir la **Vista del Chatbot** desde la barra lateral o paleta de comandos.
- Seleccionar el proveedor y modelo de IA.
- Hacer preguntas, solicitar resúmenes o briefings de documentos.
- Usar `@nombre-de-archivo` para referenciar archivos específicos.
- Alternar entre **Modo Chat** (exploración fluida) y **Modo Edición** (edición dirigida) según la tarea.

---

## Funciones de IA

Ambos modos comparten las mismas herramientas de IA a través del **composer**, pero difieren en el enfoque:

### Modo Chat — Exploración Fluida

- Buscar y leer archivos relevantes para responder preguntas.
- Resumir y hacer briefing de secciones completas de tus documentos.
- Seguir enlaces entre notas para descubrir contexto relacionado que quizás no conocías.
- Recorrer la estructura de directorios para encontrar conexiones más profundas.
- Citas automáticas con enlaces clicables.
- Fijar archivos para enfocar la atención de la IA.

### Modo Edición — Edición Dirigida

- Elegir archivos específicos para editar, ahorrando tokens y tiempo.
- Solicitar creación o modificación de contenido para archivos seleccionados.
- La IA propone ediciones completas con revisión interactiva de diff.
- Crear nuevos archivos con contenido generado por IA.
- Editar las propuestas antes de aplicarlas.

### Proveedores de IA Soportados

- **OpenAI** — Todos los modelos baseados en texto.
- **Anthropic** — Todos los modelos baseados en texto.
- **Google** — Todos los modelos baseados en texto.
- **Ollama** — Modelos locales como Llama, Gemma y modelos personalizados.

---

## Resolución de Conflictos

- Cambios locales que serían sobrescritos muestran un modal con opciones:
  - **Commit & Sync**
  - **Stash & Sync**
  - **Discard & Sync**
- Los conflictos de merge abren un modal de resolución con estrategias.
- Los cambios propuestos por la IA siempre se revisan mediante diff interactivo.

---

## Limitaciones

- No es en tiempo real — la sincronización es basada en Git y periódica.
- Las reservas de edición son cooperativas, no forzadas.
- Solo escritorio (soporte móvil limitado por Git CLI).
- Archivos binarios grandes o repositorios enormes pueden reducir el rendimiento.
- Las funciones de IA requieren internet y claves de API válidas (excepto Ollama).

---

## Seguridad y Privacidad

- Tus notas permanecen **en tu repositorio** — sin servidores de terceros más allá de tu host Git.
- Los proveedores de IA procesan el contenido según sus políticas de privacidad.
- Ollama se ejecuta localmente y mantiene todos los datos en tu máquina.
- Evitá commitear secretos — usá `.gitignore`.
- El historial de chat de la IA se guarda localmente.

---

## Solución de Problemas

- Verificar que Git esté instalado y en el PATH.
- Confirmar la URL remota y credenciales.
- Revisar claves de API y conectividad de los proveedores de IA.
- Para Ollama, confirmar que el servicio esté corriendo y los modelos disponibles.
- Revisar la consola para errores de Git o IA.

---

## FAQ

**¿Por qué Git en lugar de sincronización en tiempo real?**  
Git es gratis, ubicuo y funciona offline. Este plugin lo hace práctico para equipos que ya usan Git.

**¿Dos personas pueden editar el mismo archivo?**  
Sí, pero el sistema de reservas reduce conflictos. Los conflictos aún pueden ocurrir y deben resolverse.

**¿Esto reemplaza servicios pagos de sincronización?**  
Para muchos equipos, sí. Para colaboración en tiempo real, un servicio dedicado puede ser mejor.

**¿Qué proveedor de IA debería elegir?**

- **GPT‑5** para uso general y rendimiento equilibrado.
- **Claude** para razonamiento complejo.
- **Gemini** para contextos muy largos.
- **Ollama** para privacidad y uso offline.

**¿Puedo usar varios proveedores de IA?**  
Sí — configurá varios y cambiá cuando quieras.

**¿Mis datos se envían a proveedores de IA?**  
Solo al usar proveedores en la nube. Ollama mantiene todo local.

---

## Licencia

MIT © 2025 Luis Dourado
