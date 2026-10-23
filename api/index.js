const fs = require('fs');
const path = require('path');
const { createClient } = require('@libsql/client');
const nodemailer = require('nodemailer');
const { OAuth2Client } = require('google-auth-library');

// ---------- Configuración ----------
// En Vercel, process.cwd() es la raíz del proyecto (donde están index.html y datapack/)
const ROOT = process.cwd();
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
const FALLBACK_MODEL = 'gemini-3.5-flash-lite';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// Prompt del sistema de CraftGPT
function buildSystemPrompt(datapackContent) {
    if (process.env.SYSTEM_PROMPT) return process.env.SYSTEM_PROMPT;
    return `
Eres una Inteligencia Artificial experta y especializada exclusivamente en Minecraft.
Tu objetivo es ayudar al usuario a crear:
1. Comandos avanzados.
2. Estructuras de Datapacks.
3. Código Java para Plugins de Paper y Spigot.
4. Texture Packs avanzados
Proporciona respuestas claras, código limpio y explicaciones breves.
Lee sobre estas fuentes y basa tus respuestas en ellas:
- Documentación oficial de Minecraft: https://minecraft.fandom.com/wiki/Minecraft_Wiki
- Documentación de Datapacks: https://minecraft.fandom.com/wiki/Data_Pack
- Puedes encontrar un Template de un datapack en la carpeta 'datapack' de este proyecto, en el README se explica todo.
- Documentación de Paper: https://papermc.io/
- Documentación de Spigot: https://www.spigotmc.org/
También que sepas que la actual versión es la 26.2, asi que siempre lee la wiki oficial para ver si hay cambios. No inventes información, si no sabes algo, dilo claramente.
Pregunta al usuario que versión de Minecraft está usando para adaptar las respuestas a esa versión. También va cambiando la sintaxis de los comandos, así que siempre busca la sintaxis correcta en la wiki.
Tambien te recomiendo leer en Reddit y en foros para poder enterarte de como son las cosas y soluciones.
Si quieres información de comandos de minecraft y los cambios de las versiones hay una web que crea comandos y más cosas: https://www.gamergeeks.net/apps/minecraft/
Te digo algunos canales que enseñan comandos, datapacks y funciones que puedes hacer en Minecrat: https://www.youtube.com/@Cl0udWolf, También puedes buscar en otros canales, y como creo que no puedes ver videos, puedes leer los comentarios y la descripción de los videos para ver si hay información útil.
Antes de enviar cualquier respuesta, busca en la wiki y en las fuentes que te proporcione sobre la pregunta del usuario.
Revisa en esta fuente la sintaxis del comando give: https://minecraft.wiki/w/Commands/give, para otros comandos mira las rutas de https://minecraft.wiki/w/Commands/
y ahí encontrarás la sintaxis de los comandos
Porcierto recuerda que para la 26.2 un ejemplo de give es este: /give @a netherite_sword[custom_name=[{"text":"Nombre","bold":true,"italic":false,"color":"yellow"}],enchantments={sharpness:5,unbreaking:3},unbreakable={}]
Verifica siempre los nombres exactos de los componentes (custom_name con array de texto, enchantments abreviados si aplica, y unbreakable={}).
Siempre antes de responder busca la sintaxis del comando y aunque a veces pienses que te la sabes revisala, te sueles equivocar agregandole cosas de otras versiones.
Para agregar encantamientos es asi: enchantments={sharpness:5,unbreaking:3} para la 26.2, no es {levels: eh.
El datapack que esta en la carpeta 'datapack' es un ejemplo, y cuando le hables al usuario recuerda que los que te hablan no soy yo, (tu creador)
Tampoco les menciones el shop.json, ni los mcfunction de las compras, solo cuentaselo cuando te diga que quiere crear una tienda con /dialog o cuando te nombre menus con /dialog
Para actualizar o crear modelos personalizados en Minecraft 1.21.4, sigue estas instrucciones clave: primero, abandona la antigua carpeta models/item/ y su sistema de overrides, ya que fue reemplazado por el nuevo sistema de "Definiciones de Modelo de Ítems", cuyos archivos JSON ahora deben ubicarse en assets/minecraft/items/. Segundo, el componente minecraft:custom_model_data ya no se limita a un solo número entero; ahora acepta listas de floats, strings, colors y flags (por ejemplo: /give @p minecraft:stick[minecraft:custom_model_data={strings:["mi_modelo"]}]). Tercero, para vincular estos datos a tu textura, debes usar la nueva estructura de nodos JSON dentro del archivo del ítem: utiliza minecraft:range_dispatch con threshold para evaluar valores numéricos (floats), o minecraft:select / minecraft:condition para evaluar cadenas de texto (strings) o banderas (flags), definiendo siempre un modelo fallback por si no se cumple la condición. Por último, ten en cuenta que este cambio es incompatible con versiones anteriores, por lo que deberás migrar tus resource packs antiguos utilizando herramientas de conversión automáticas; a cambio, obtendrás una flexibilidad total para cambiar modelos basados en encantamientos, dimensiones o estados del jugador sin las restricciones del sistema antiguo.
Para pasar tu configuración de 2D a 3D en la 1.21.4, en tu archivo de modelo (carpeta models/) debes eliminar el "parent": "item/generated" y las "textures" de capas, reemplazándolos por la definición de tus propios "elements" (cuboides con sus caras y coordenadas UV) o usando un padre 3D. A continuación, en tu archivo de definición del ítem (carpeta items/), debes establecer "gui_light": "side" para que el modelo reciba iluminación volumétrica en el inventario en lugar de la iluminación plana de los 2D. También es obligatorio que ajustes manualmente las propiedades de "display" (como gui, ground, fixed, head y las manos) dentro del archivo de modelo, ya que los modelos 3D no se escalan ni posicionan automáticamente como las texturas planas. Por último, si tu nuevo modelo 3D es voluminoso, añade "oversized_in_gui": true en el archivo de items/ para evitar que se recorte al renderizarse dentro de los bordes del slot del inventario.
La sintaxis de los textos cambio en la 1.19.4 a esta: /summon text_display ~ ~1 ~ {text:[{"text":"Texto de Ejemplo","color":"yellow"}]}

REGLAS SOBRE LA ESTRUCTURA OBLIGATORIA, NAMESPACES Y PACK FORMAT:
- Todo datapack requiere obligatoriamente:
1. El archivo \`pack.mcmeta\` en la raíz con su respectivo \`pack_format\` adaptado a la versión de Minecraft (consulta siempre la wiki oficial de Minecraft para obtener el número exacto de formato de paquete correspondiente a la versión).
2. La carpeta principal \`data/\`.
- El namespace (por ejemplo, \`gpt\`) NO es obligatorio; el usuario puede utilizar el namespace que quiera o prefiera para su proyecto.

FORMATO DE ARCHIVOS PARA DESCARGA:
- Cuando modifiques o crees archivos del datapack, indícalo obligatoriamente con el formato \`=== ARCHIVO: ruta/archivo.extension ===\` seguido del bloque de código correspondiente para que la interfaz pueda empaquetarlos y ofrecerlos en un botón de descarga automática.

ESTRUCTURA Y CONTENIDO ACTUAL DEL DATAPACK DEL USUARIO (Carpeta 'datapack'):

\`\`\`

${datapackContent}

\`\`\`

Adapta siempre los comandos, sintaxis y estructuras a la versión de Minecraft indicada.
`;
}

// ---------- Utilidades HTTP ----------
function setCors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function sendJson(res, status, payload) {
    res.statusCode = status;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(payload));
}

// Envuelve un handler: CORS, método permitido y captura de errores
function withApi(method, handler) {
    return async (req, res) => {
        setCors(res);
        if (req.method === 'OPTIONS') {
            res.statusCode = 204;
            res.end();
            return;
        }
        if (req.method !== method) {
            sendJson(res, 405, { error: 'Método no permitido.' });
            return;
        }
        try {
            await handler(req, res);
        } catch (err) {
            console.error('Error en', req.url, err);
            if (!res.headersSent) {
                sendJson(res, 500, { error: err.message, respuesta: 'Error interno en el servidor: ' + err.message });
            }
        }
    };
}

// Vercel ya parsea el JSON en req.body; este helper también soporta el stream crudo
async function readBody(req) {
    if (req.body !== undefined && req.body !== null) {
        if (typeof req.body === 'string') return req.body ? JSON.parse(req.body) : {};
        return req.body;
    }
    let raw = '';
    for await (const chunk of req) raw += chunk;
    return raw ? JSON.parse(raw) : {};
}

// ---------- Base de datos (libSQL / Turso) ----------
// Vercel no permite escribir en el disco del proyecto. Usa Turso con
// TURSO_DATABASE_URL y TURSO_AUTH_TOKEN para datos persistentes.
// Sin esas variables usa /tmp, que se borra cuando la función se reinicia.
let dbPromise = null;

function getDb() {
    if (!dbPromise) {
        dbPromise = (async () => {
            const db = createClient({
                url: process.env.TURSO_DATABASE_URL || 'file:/tmp/craftgpt.db',
                authToken: process.env.TURSO_AUTH_TOKEN || undefined
            });
            await db.batch([
                `CREATE TABLE IF NOT EXISTS chats (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    role TEXT,
                    content TEXT,
                    model TEXT,
                    version TEXT,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`,
                `CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT,
                    email TEXT UNIQUE,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )`,
                `CREATE TABLE IF NOT EXISTS pending_users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT,
                    email TEXT UNIQUE,
                    code TEXT
                )`
            ], 'write');
            return db;
        })().catch(err => {
            dbPromise = null; // permitir reintentar en la siguiente petición
            throw err;
        });
    }
    return dbPromise;
}

// ---------- Correo ----------
let transporter = null;
function getTransporter() {
    if (!transporter) {
        transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
        });
    }
    return transporter;
}

// ---------- Datapack y prompt del sistema ----------
function readDatapackFolder(dir, baseDir = dir) {
    let structureText = '';
    try {
        if (!fs.existsSync(dir)) return "No se encontró la carpeta 'datapack' en el proyecto.";
        for (const file of fs.readdirSync(dir)) {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);
            if (stat.isDirectory()) {
                structureText += readDatapackFolder(filePath, baseDir);
            } else if (['.mcfunction', '.json', '.mcmeta', '.txt'].includes(path.extname(file))) {
                const relativePath = path.relative(baseDir, filePath);
                const content = fs.readFileSync(filePath, 'utf8');
                structureText += `\n=== ARCHIVO: ${relativePath} ===\n${content}\n`;
            }
        }
    } catch (e) {
        structureText = 'Error al leer la carpeta del datapack: ' + e.message;
    }
    return structureText;
}

let systemPromptCache = null;
function getSystemPrompt() {
    if (systemPromptCache === null) {
        systemPromptCache = buildSystemPrompt(readDatapackFolder(path.join(ROOT, 'datapack')));
    }
    return systemPromptCache;
}

// ---------- Llamadas a modelos ----------
function extractGeminiText(result) {
    const parts = result?.candidates?.[0]?.content?.parts || [];
    return parts.filter(p => p.text && !p.thought).map(p => p.text).join('');
}

async function callGemini(model, contents) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            system_instruction: { parts: [{ text: getSystemPrompt() }] },
            contents
        })
    });
    const result = await response.json();
    return { response, result };
}

async function callOpenRouter(model, contents) {
    const messages = [
        { role: 'system', content: getSystemPrompt() },
        ...contents.map(c => ({
            role: c.role === 'model' ? 'assistant' : c.role,
            content: c.parts[0].text
        }))
    ];
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            'HTTP-Referer': process.env.PUBLIC_URL || 'https://craftgpt.vercel.app',
            'X-Title': 'CraftGPT',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ model, messages })
    });
    const result = await response.json();
    return { response, result };
}

// ---------- Handlers ----------
function homeHandler(req, res) {
    try {
        const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/html; charset=UTF-8');
        res.end(html.replace('__GOOGLE_CLIENT_ID__', GOOGLE_CLIENT_ID));
    } catch (e) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/plain');
        res.end('index.html no encontrado');
    }
}

function pingHandler(req, res) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain');
    res.end('ok');
}

const registerHandler = withApi('POST', async (req, res) => {
    let body;
    try { body = await readBody(req); } catch (e) { return sendJson(res, 400, { error: 'Petición inválida.' }); }
    const { username, email } = body;
    if (!email) return sendJson(res, 400, { error: 'El correo es obligatorio.' });

    const db = await getDb();
    const existing = await db.execute({ sql: 'SELECT id FROM users WHERE email = ?', args: [email] });
    if (existing.rows.length) {
        return sendJson(res, 400, { error: 'Este correo electrónico ya está registrado.' });
    }

    const code = Math.floor(1000 + Math.random() * 9000).toString();
    const finalUsername = username || email.split('@')[0];
    await db.execute({
        sql: 'INSERT OR REPLACE INTO pending_users (username, email, code) VALUES (?, ?, ?)',
        args: [finalUsername, email, code]
    });

    try {
        await getTransporter().sendMail({
            from: process.env.EMAIL_USER || 'CraftGPT <soporte@craftgpt.com>',
            to: email,
            subject: 'Código de confirmación para CraftGPT',
            text: `Hola ${finalUsername},\n\nTu código de confirmación de 4 dígitos es: ${code}\n\nIngrésalo en la aplicación para completar tu registro.`
        });
        return sendJson(res, 200, { success: true, message: 'Correo de confirmación enviado exitosamente.' });
    } catch (mailErr) {
        console.error('Error al enviar correo SMTP:', mailErr);
        // Solo para pruebas: ALLOW_DEBUG_CODE=true devuelve el código en la respuesta.
        // No lo actives en producción, porque cualquiera podría registrarse sin tener el correo.
        if (process.env.ALLOW_DEBUG_CODE === 'true') {
            return sendJson(res, 200, { success: true, message: 'No se pudo enviar el correo, usa este código de prueba.', debugCode: code });
        }
        return sendJson(res, 502, { error: 'No se pudo enviar el correo de confirmación. Intenta de nuevo más tarde.' });
    }
});

const verifyCodeHandler = withApi('POST', async (req, res) => {
    let body;
    try { body = await readBody(req); } catch (e) { return sendJson(res, 400, { error: 'Petición inválida.' }); }
    const { email, code } = body;

    const db = await getDb();
    const pending = await db.execute({
        sql: 'SELECT username FROM pending_users WHERE email = ? AND code = ?',
        args: [email, code]
    });
    if (!pending.rows.length) {
        return sendJson(res, 400, { error: 'Código de verificación incorrecto.' });
    }

    const username = pending.rows[0].username;
    await db.execute({ sql: 'INSERT OR IGNORE INTO users (username, email) VALUES (?, ?)', args: [username, email] });
    await db.execute({ sql: 'DELETE FROM pending_users WHERE email = ?', args: [email] });

    return sendJson(res, 200, {
        success: true,
        user: { username, email },
        message: 'Cuenta creada y verificada con éxito.'
    });
});

const loginHandler = withApi('POST', async (req, res) => {
    let body;
    try { body = await readBody(req); } catch (e) { return sendJson(res, 400, { error: 'Petición inválida.' }); }
    const db = await getDb();
    const result = await db.execute({ sql: 'SELECT username, email FROM users WHERE email = ?', args: [body.email] });
    if (!result.rows.length) {
        return sendJson(res, 404, { error: 'El correo no está registrado. Crea una cuenta primero.' });
    }
    const row = result.rows[0];
    return sendJson(res, 200, {
        success: true,
        user: { username: row.username, email: row.email },
        message: 'Sesión iniciada correctamente.'
    });
});

const googleAuthHandler = withApi('POST', async (req, res) => {
    let body;
    try { body = await readBody(req); } catch (e) { return sendJson(res, 400, { error: 'Petición inválida.' }); }
    const { idToken } = body;

    if (!idToken) return sendJson(res, 400, { error: 'Falta el token de Google.' });
    if (!GOOGLE_CLIENT_ID) {
        return sendJson(res, 500, { error: 'Google Sign-In no está configurado. Falta la variable GOOGLE_CLIENT_ID.' });
    }

    let payload;
    try {
        const ticket = await googleClient.verifyIdToken({ idToken, audience: GOOGLE_CLIENT_ID });
        payload = ticket.getPayload();
    } catch (verifyErr) {
        return sendJson(res, 401, { error: 'Token de Google inválido o expirado.' });
    }

    if (!payload || !payload.email || !payload.email_verified) {
        return sendJson(res, 400, { error: 'No se pudo verificar el correo de la cuenta de Google.' });
    }

    const email = payload.email;
    const finalUsername = payload.name || email.split('@')[0];
    const db = await getDb();

    const existing = await db.execute({ sql: 'SELECT username, email FROM users WHERE email = ?', args: [email] });
    if (existing.rows.length) {
        const row = existing.rows[0];
        return sendJson(res, 200, {
            success: true,
            user: { username: row.username, email: row.email },
            message: 'Autenticación con Google exitosa.'
        });
    }

    await db.execute({ sql: 'INSERT INTO users (username, email) VALUES (?, ?)', args: [finalUsername, email] });
    return sendJson(res, 200, {
        success: true,
        user: { username: finalUsername, email },
        message: 'Cuenta creada con Google exitosamente.'
    });
});

const chatHandler = withApi('POST', async (req, res) => {
    const data = await readBody(req);
    let contents = data.contents || [];
    const selectedModel = data.model || DEFAULT_MODEL;
    const mcVersion = data.version || '26.2';

    const db = await getDb();

    const userOriginalText = contents.length > 0 ? contents[contents.length - 1].parts[0].text : '';
    if (userOriginalText) {
        await db.execute({
            sql: 'INSERT INTO chats (role, content, model, version) VALUES (?, ?, ?, ?)',
            args: ['user', userOriginalText, selectedModel, mcVersion]
        });
    }

    if (contents.length > 0) {
        contents = contents.map((msg, index) => {
            if (index === contents.length - 1 && msg.role === 'user') {
                return {
                    role: 'user',
                    parts: [{ text: `[Versión de Minecraft objetivo: ${mcVersion}]\n${msg.parts[0].text}` }]
                };
            }
            return msg;
        });
    }

    const isOpenRouter = selectedModel.includes('/') || selectedModel.includes(':free');
    let replyText = 'Sin respuesta del modelo.';

    if (isOpenRouter) {
        if (!OPENROUTER_API_KEY) {
            return sendJson(res, 500, { respuesta: 'Error: Falta configurar la variable OPENROUTER_API_KEY.' });
        }
        const { result } = await callOpenRouter(selectedModel, contents);
        if (result.choices && result.choices[0]?.message?.content) {
            replyText = result.choices[0].message.content;
        } else if (result.error) {
            replyText = `Error de OpenRouter: ${result.error.message || JSON.stringify(result.error)}`;
        }
    } else {
        if (!GEMINI_API_KEY) {
            return sendJson(res, 500, { respuesta: 'Error: Falta configurar la variable GEMINI_API_KEY.' });
        }
        let { response, result } = await callGemini(selectedModel, contents);
        if (!response.ok && selectedModel !== FALLBACK_MODEL) {
            ({ response, result } = await callGemini(FALLBACK_MODEL, contents));
        }
        if (!response.ok) {
            replyText = `Error de la API: ${result.error?.message || JSON.stringify(result)}`;
        } else {
            replyText = extractGeminiText(result) || replyText;
        }
    }

    await db.execute({
        sql: 'INSERT INTO chats (role, content, model, version) VALUES (?, ?, ?, ?)',
        args: ['assistant', replyText, selectedModel, mcVersion]
    });

    return sendJson(res, 200, { respuesta: replyText });
});

// ---------- Router ----------
// Vercel reescribe /api/* hacia este archivo (ver vercel.json) y pasa la ruta en req.query.route.
const ROUTES = {
    home: homeHandler,
    ping: pingHandler,
    register: registerHandler,
    'verify-code': verifyCodeHandler,
    login: loginHandler,
    'google-auth': googleAuthHandler,
    chat: chatHandler
};

module.exports = (req, res) => {
    const pathname = (req.url || '/').split('?')[0];
    const name = (req.query && req.query.route) ||
        pathname.replace(/^\/api\/?/, '').replace(/\/+$/, '') ||
        'home';
    const handler = ROUTES[name];
    if (!handler) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'text/plain');
        res.end('No encontrado');
        return;
    }
    return handler(req, res);
};