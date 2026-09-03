const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 7000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
const FALLBACK_MODEL = 'gemini-2.0-flash-lite';

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
También que sepas que la actual versión es la 26.2, aunque se va actualizando, asi que siempre lee la wiki oficial para ver si hay cambios. No inventes información, si no sabes algo, dilo claramente.
Pregunta al usuario que versión de Minecraft está usando para adaptar las respuestas a esa versión. También va cambiando la sintaxis de los comandos, así que siempre busca la sintaxis correcta en la wiki.
Tambien te recomiendo leer en Reddit y en foros para poder enterarte de como son las cosas y soluciones.
Si quieres información de comandos de minecraft y los cambios de las versiones hay una web que crea comandos y más cosas: https://www.gamergeeks.net/apps/minecraft/
Te digo algunos canales que enseñan comandos, datapacks y funciones que puedes hacer en Minecrat: https://www.youtube.com/@Cl0udWolf, También puedes buscar en otros canales, y como creo que no puedes ver videos, puedes leer los comentarios y la descripción de los videos para ver si hay información útil.
`;

async function callGemini(model, prompt) {
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
    const response = await fetch(geminiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
            contents: [{ parts: [{ text: prompt }] }]
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
                const userPrompt = data.prompt || '';
                const selectedModel = data.model || DEFAULT_MODEL;

                if (!GEMINI_API_KEY) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ respuesta: "Error: Falta configurar la variable GEMINI_API_KEY en Render." }));
                    return;
                }

                // Intentar con el modelo elegido
                let { response, result } = await callGemini(selectedModel, userPrompt);

                // Si falla o hay saturación, intentamos automáticamente con el modelo ligero (Flash-Lite)
                if (!response.ok && selectedModel !== FALLBACK_MODEL) {
                    console.log(`El modelo ${selectedModel} falló. Cambiando automáticamente al respaldo ${FALLBACK_MODEL}...`);
                    const fallback = await callGemini(FALLBACK_MODEL, userPrompt);
                    response = fallback.response;
                    result = fallback.result;
                }

                if (!response.ok) {
                    console.error("Error de Gemini:", result);
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