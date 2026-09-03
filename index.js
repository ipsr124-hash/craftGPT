const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 7000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
const FALLBACK_MODEL = 'gemini-3.5-flash-lite';

function readDatapackFolder(dir, baseDir = dir) {
    let structureText = "";
    try {
        if (!fs.existsSync(dir)) return "No se encontró la carpeta 'datapack' en el proyecto.";
        const list = fs.readdirSync(dir);
        list.forEach(file => {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);
            if (stat && stat.isDirectory()) {
                structureText += readDatapackFolder(filePath, baseDir);
            } else {
                if (['.mcfunction', '.json', '.mcmeta', '.txt'].includes(path.extname(file))) {
                    const relativePath = path.relative(baseDir, filePath);
                    const content = fs.readFileSync(filePath, 'utf8');
                    structureText += `\n=== ARCHIVO: ${relativePath} ===\n${content}\n`;
                }
            }
        });
    } catch (e) {
        structureText = "Error al leer la carpeta del datapack: " + e.message;
    }
    return structureText;
}

const datapackPath = path.join(__dirname, 'datapack');
const datapackContent = readDatapackFolder(datapackPath);

const SYSTEM_PROMPT = process.env.SYSTEM_PROMPT || `
Eres una Inteligencia Artificial experta y especializada exclusivamente en Minecraft.
Tu objetivo es ayudar al usuario a crear:
1. Comandos avanzados.
2. Estructuras de Datapacks.
3. Código Java para Plugins de Paper y Spigot.
Proporciona respuestas claras, código limpio y explicaciones breves.
Lee sobre estas fuentes y basa tus respuestas en ellas:
- Documentación oficial de Minecraft: https://minecraft.fandom.com/wiki/Minecraft_Wiki
- Documentación de Datapacks: https://minecraft.fandom.com/wiki/Data_Pack
- Documentación de Paper: https://papermc.io/
- Documentación de Spigot: https://www.spigotmc.org/
También que sepas que la actual versión es la 26.2, asi que siempre lee la wiki oficial para ver si hay cambios. No inventes información, si no sabes algo, dilo claramente.
Pregunta al usuario que versión de Minecraft está usando para adaptar las respuestas a esa versión. También va cambiando la sintaxis de los comandos, así que siempre busca la sintaxis correcta en la wiki.
Tambien te recomiendo leer en Reddit y en foros para poder enterarte de como son las cosas y soluciones.
Si quieres información de comandos de minecraft y los cambios de las versiones hay una web que crea comandos y más cosas: https://www.gamergeeks.net/apps/minecraft/
Te digo algunos canales que enseñan comandos, datapacks y funciones que puedes hacer en Minecrat: https://www.youtube.com/@Cl0udWolf, También puedes buscar en otros canales, y como creo que no puedes ver videos, puedes leer los comentarios y la descripción de los videos para ver si hay información útil.
Antes de enviar cualquier respuesta, busca en la wiki y en las fuentes que te proporcione sobre la pregunta del usuario.
Revisa en esta fuente la sintaxis del comando give: https://minecraft.wiki/w/Commands/give, para otros comandos mira las rutas de https://minecraft.wiki/w/Commands/
y ahí encontrarás la sintaxis de los comandos.
Porcierto recuerda que para la 26.2 un ejemplo de give es este: /give @a netherite_sword[custom_name=[{"text":"Nombre","bold":true,"italic":false,"color":"yellow"}],enchantments={sharpness:5,unbreaking:3},unbreakable={}]
Verifica siempre los nombres exactos de los componentes (custom_name con array de texto, enchantments abreviados si aplica, y unbreakable={}).
Siempre antes de responder busca la sintaxis del comando y aunque a veces pienses que te la sabes revisala, te sueles equivocar agregandole cosas de otras versiones.
Para agregar encantamientos es asi: enchantments={sharpness:5,unbreaking:3} para la 26.2, no es {levels: eh.

REGLA CLAVE PARA SISTEMAS DE TIENDA Y MENÚS CON /dialog:
- Cuando el usuario te pida un sistema de tienda o menú interactivo utilizando el comando /dialog, debes tomar la estructura base del datapack actual, crear una copia lógica y modificarla por completo adaptándola a lo que pida el usuario.
- El menú visual se configura en \`shop.json\` (dentro de la ruta de diálogos), cuyos botones interactúan mediante triggers que llaman directamente a los archivos de funciones individuales ubicados en la carpeta de funciones del datapack.
- Si el usuario pide una tienda: cada función de compra procesa la validación del dinero del usuario mediante scoreboards (como \`dinero\`), ejecuta el descuento del saldo y entrega el objeto correspondiente con \`@s\` o \`@p\`.
- Si el usuario pide un menú simple (en vez de una tienda): funciona exactamente igual a nivel estructural (con /dialog, triggers y funciones), pero SIN dinero, es decir, sin validaciones de scoreboards ni cobros, ejecutando directamente la acción solicitada por el usuario.
- Para cambiar opciones, precios o modificar elementos, indica qué ajustar tanto en el archivo de diálogo como en los archivos de funciones correspondientes.

FORMATO DE ARCHIVOS PARA DESCARGA:
- Cuando modifiques o crees archivos del datapack, indícalo obligatoriamente con el formato \`=== ARCHIVO: ruta/archivo.extension ===\` seguido del bloque de código correspondiente para que la interfaz pueda empaquetarlos y ofrecerlos en un botón de descarga automática.

ESTRUCTURA Y CONTENIDO ACTUAL DEL DATAPACK DEL USUARIO (Carpeta 'datapack'):
\`\`\`
${datapackContent}
\`\`\`

Adapta siempre los comandos, sintaxis y estructuras a la versión de Minecraft indicada.
`;

async function callGemini(model, contents) {
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
    const response = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents: contents
        })
    });
    const result = await response.json();
    return { response, result };
}

const server = http.createServer(async (req, res) => {
    if (req.url === '/ping' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('ok');
        return;
    }

    if (req.url === '/api/chat' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', async () => {
            try {
                const data = JSON.parse(body);
                let contents = data.contents || [];
                const selectedModel = data.model || DEFAULT_MODEL;
                const mcVersion = data.version || '1.21.x';

                if (!GEMINI_API_KEY) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ respuesta: "Error: Falta configurar la variable GEMINI_API_KEY en Render." }));
                    return;
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

                let { response, result } = await callGemini(selectedModel, contents);

                if (!response.ok && selectedModel !== FALLBACK_MODEL) {
                    const fallback = await callGemini(FALLBACK_MODEL, contents);
                    response = fallback.response;
                    result = fallback.result;
                }

                if (!response.ok) {
                    const errorMsg = result.error?.message || JSON.stringify(result);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ respuesta: `Error de la API: ${errorMsg}` }));
                    return;
                }

                let replyText = "Sin respuesta del modelo.";
                if (result.candidates && result.candidates[0]?.content?.parts?.[0]?.text) {
                    replyText = result.candidates[0].content.parts[0].text;
                }

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ respuesta: replyText }));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ respuesta: "Error interno en el servidor: " + err.message }));
            }
        });
        return;
    }

    if (req.url === '/' && req.method === 'GET') {
        const htmlPath = path.join(__dirname, 'index.html');
        fs.readFile(htmlPath, 'utf8', (err, data) => {
            if (err) {
                res.writeHead(404, { 'Content-Type': 'text/plain' });
                res.end('index.html no encontrado');
            } else {
                res.writeHead(200, { 'Content-Type': 'text/html; charset=UTF-8' });
                res.end(data);
            }
        });
        return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('No encontrado');
});

server.listen(PORT, () => {
    console.log(`Servidor Node.js corriendo en el puerto ${PORT}`);
});