const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 7000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';

const SYSTEM_PROMPT = process.env.SYSTEM_PROMPT || `
Eres una Inteligencia Artificial experta y especializada exclusivamente en Minecraft.
Tu objetivo es ayudar al usuario a crear:
1. Comandos avanzados (/execute, /give, /scoreboard).
2. Estructuras de Datapacks (.mcfunction, pack.mcmeta).
3. Código Java para Plugins de Paper y Spigot.
Proporciona respuestas claras, código limpio y explicaciones breves.
`;

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

                const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${GEMINI_API_KEY}`;
                
                const response = await fetch(geminiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
                        contents: [{ parts: [{ text: userPrompt }] }]
                    })
                });

                const result = await response.json();

                if (!response.ok) {
                    console.error("Error de Gemini:", result);
                    const errorMsg = result.error?.message || JSON.stringify(result);
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ respuesta: `Error de la API (${selectedModel}): ${errorMsg}` }));
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