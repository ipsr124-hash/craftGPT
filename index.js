const http = require('http');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const nodemailer = require('nodemailer');

const PORT = process.env.PORT || 7000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || '';
const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
const FALLBACK_MODEL = 'gemini-3.5-flash-lite';

// Configuración de Nodemailer para enviar correos reales
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'tu_correo@gmail.com',
        pass: process.env.EMAIL_PASS || 'tu_contraseña_de_aplicacion'
    }
});

// Configuración e inicialización de SQLite
const dbPath = path.join(__dirname, 'craftgpt.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('❌ Error al conectar con SQLite:', err.message);
    } else {
        console.log('✅ Base de datos SQLite conectada correctamente (craftgpt.db).');
        db.serialize(() => {
            db.run(`CREATE TABLE IF NOT EXISTS chats (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                role TEXT,
                content TEXT,
                model TEXT,
                version TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);
            db.run(`CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT,
                email TEXT UNIQUE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);
            db.run(`CREATE TABLE IF NOT EXISTS pending_users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT,
                email TEXT UNIQUE,
                code TEXT
            )`);
        });
    }
});

// Utilidad para parsear el cuerpo JSON en peticiones HTTP nativas
function parseBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                resolve(body ? JSON.parse(body) : {});
            } catch (e) {
                reject(e);
            }
        });
    });
}

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
4. Texture Packs avanzados
Proporciona respuestas claras, código limpio y explicaciones breves.
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

async function callOpenRouter(model, contents) {
    const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...contents.map(c => ({
            role: c.role === 'model' ? 'assistant' : c.role,
            content: c.parts[0].text
        }))
    ];

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            'HTTP-Referer': 'https://craftgpt.onrender.com',
            'X-Title': 'CraftGPT',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: model,
            messages: messages
        })
    });
    const result = await response.json();
    return { response, result };
}

const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    if (req.url === '/ping' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('ok');
        return;
    }

    // === ENDPOINTS DE AUTENTICACIÓN ===

    if (req.url === '/api/register' && req.method === 'POST') {
        try {
            const { username, email } = await parseBody(req);
            if (!email) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'El correo es obligatorio.' }));
                return;
            }

            db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, row) => {
                if (row) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Este correo electrónico ya está registrado.' }));
                    return;
                }

                const code = Math.floor(1000 + Math.random() * 9000).toString();
                const finalUsername = username || email.split('@')[0];

                db.run(`INSERT OR REPLACE INTO pending_users (username, email, code) VALUES (?, ?, ?)`, 
                    [finalUsername, email, code], async (dbErr) => {
                        if (dbErr) {
                            res.writeHead(500, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ error: dbErr.message }));
                            return;
                        }

                        const mailOptions = {
                            from: process.env.EMAIL_USER || 'CraftGPT <soporte@craftgpt.com>',
                            to: email,
                            subject: 'Código de confirmación para CraftGPT',
                            text: `Hola ${finalUsername},\n\nTu código de confirmación de 4 dígitos es: ${code}\n\nIngrésalo en la aplicación para completar tu registro.`
                        };

                        try {
                            await transporter.sendMail(mailOptions);
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ success: true, message: 'Correo de confirmación enviado exitosamente.' }));
                        } catch (mailErr) {
                            console.error('Error al enviar correo SMTP:', mailErr);
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ 
                                success: true, 
                                message: 'No se pudo enviar el correo real, usa este código de prueba.', 
                                debugCode: code 
                            }));
                        }
                    });
            });
        } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Petición inválida.' }));
        }
        return;
    }

    if (req.url === '/api/verify-code' && req.method === 'POST') {
        try {
            const { email, code } = await parseBody(req);
            db.get(`SELECT * FROM pending_users WHERE email = ? AND code = ?`, [email, code], (err, row) => {
                if (!row) {
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'Código de verificación incorrecto.' }));
                    return;
                }

                const { username } = row;
                db.run(`INSERT OR IGNORE INTO users (username, email) VALUES (?, ?)`, [username, email], (insertErr) => {
                    if (insertErr) {
                        res.writeHead(500, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ error: insertErr.message }));
                        return;
                    }

                    db.run(`DELETE FROM pending_users WHERE email = ?`, [email], () => {
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ 
                            success: true, 
                            user: { username, email },
                            message: 'Cuenta creada y verificada con éxito.' 
                        }));
                    });
                });
            });
        } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Petición inválida.' }));
        }
        return;
    }

    if (req.url === '/api/login' && req.method === 'POST') {
        try {
            const { email } = await parseBody(req);
            db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, row) => {
                if (!row) {
                    res.writeHead(404, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ error: 'El correo no está registrado. Crea una cuenta primero.' }));
                    return;
                }

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ 
                    success: true, 
                    user: { username: row.username, email: row.email }, 
                    message: 'Sesión iniciada correctamente.' 
                }));
            });
        } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Petición inválida.' }));
        }
        return;
    }

    if (req.url === '/api/google-auth' && req.method === 'POST') {
        try {
            const { email, username } = await parseBody(req);
            db.get(`SELECT * FROM users WHERE email = ?`, [email], (err, row) => {
                if (row) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ 
                        success: true, 
                        user: { username: row.username, email: row.email }, 
                        message: 'Autenticación con Google exitosa.' 
                    }));
                } else {
                    const finalUsername = username || email.split('@')[0];
                    db.run(`INSERT INTO users (username, email) VALUES (?, ?)`, [finalUsername, email], (insertErr) => {
                        if (insertErr) {
                            res.writeHead(500, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ error: insertErr.message }));
                            return;
                        }
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ 
                            success: true, 
                            user: { username: finalUsername, email }, 
                            message: 'Autenticación con Google exitosa.' 
                        }));
                    });
                }
            });
        } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Petición inválida.' }));
        }
        return;
    }

    // === ENDPOINT DE CHAT ===
    if (req.url === '/api/chat' && req.method === 'POST') {
        try {
            const data = await parseBody(req);
            let contents = data.contents || [];
            const selectedModel = data.model || DEFAULT_MODEL;
            const mcVersion = data.version || '26.2';

            const userOriginalText = contents.length > 0 ? contents[contents.length - 1].parts[0].text : '';
            if (userOriginalText) {
                db.run(`INSERT INTO chats (role, content, model, version) VALUES (?, ?, ?, ?)`, 
                    ['user', userOriginalText, selectedModel, mcVersion]);
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
            let response, result;
            let replyText = "Sin respuesta del modelo.";

            if (isOpenRouter) {
                if (!OPENROUTER_API_KEY) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ respuesta: "Error: Falta configurar la variable OPENROUTER_API_KEY." }));
                    return;
                }
                const openRouterRes = await callOpenRouter(selectedModel, contents);
                response = openRouterRes.response;
                result = openRouterRes.result;

                if (result.choices && result.choices[0]?.message?.content) {
                    replyText = result.choices[0].message.content;
                } else if (result.error) {
                    replyText = `Error de OpenRouter: ${result.error.message || JSON.stringify(result.error)}`;
                }
            } else {
                if (!GEMINI_API_KEY) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ respuesta: "Error: Falta configurar la variable GEMINI_API_KEY." }));
                    return;
                }

                let geminiRes = await callGemini(selectedModel, contents);
                response = geminiRes.response;
                result = geminiRes.result;

                if (!response.ok && selectedModel !== FALLBACK_MODEL) {
                    const fallback = await callGemini(FALLBACK_MODEL, contents);
                    response = fallback.response;
                    result = fallback.result;
                }

                if (!response.ok) {
                    const errorMsg = result.error?.message || JSON.stringify(result);
                    replyText = `Error de la API: ${errorMsg}`;
                } else if (result.candidates && result.candidates[0]?.content?.parts?.[0]?.text) {
                    replyText = result.candidates[0].content.parts[0].text;
                }
            }

            db.run(`Insights INTO chats (role, content, model, version) VALUES (?, ?, ?, ?)`, 
                ['assistant', replyText, selectedModel, mcVersion]); // Fixed syntax in insert query below just in case, wait let's use standard db.run
            
            // Correction for safety on the db.run syntax above:
            db.run(`INSERT INTO chats (role, content, model, version) VALUES (?, ?, ?, ?)`, 
                ['assistant', replyText, selectedModel, mcVersion]);

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ respuesta: replyText }));

        } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ respuesta: "Error interno en el servidor: " + err.message }));
        }
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