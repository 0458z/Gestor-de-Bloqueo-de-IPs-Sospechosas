const express = require('express');
const https = require('https');
const fs = require('fs');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const axios = require('axios');
const path = require('path');
const cors = require('cors');
const crypto = require('crypto');
const { exec } = require('child_process'); // Importé esto para ejecutar comandos de terminal (iptables)

const app = express();
const PUERTO = 3001;

// CREDENCIALES
// Aquí coloqué mis datos reales de Telegram
const TELEGRAM_TOKEN = '8524426178:AAGWkmHT4eW03cLjeqSCSwGlsggMfvSpDhE'; 
const TELEGRAM_CHAT_ID = '5268491936'; 

app.use(express.json());
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

// Carga de certificados para habilitar HTTPS
const opcionesHttps = {
    key: fs.readFileSync('server.key'),
    cert: fs.readFileSync('server.cert')
};

// Configuración de gRPC
// Utilicé keepCase: true para evitar que gRPC cambie los nombres de mis variables
const definicionPaquete = protoLoader.loadSync('./protocolo.proto', {
    keepCase: true, longs: String, enums: String, defaults: true, oneofs: true
});
const protoDecision = grpc.loadPackageDefinition(definicionPaquete);
const clienteS2 = new protoDecision.ServicioDecision('localhost:50051', grpc.credentials.createInsecure());

// Almacenamiento temporal en memoria para los tokens de seguridad y el anti-spam
const tokensActivos = {}; 
const ultimasAlertas = {};

// --- FUNCIONES DE FIREWALL REAL (IPTABLES) ---

function bloquearEnLinux(ip) {
    // Implementé esta seguridad para no bloquear mi propia red local durante las pruebas
    if (ip === '127.0.0.1' || ip.startsWith('192.168.')) {
        console.log(`[PROTECCION] No se bloqueara la IP local ${ip} en iptables para evitar perder acceso.`);
        return;
    }
    // Ejecuto el comando de Linux para rechazar paquetes de esta IP
    exec(`iptables -I INPUT -s ${ip} -j DROP`, (err) => {
        if (!err) console.log(`[IPTABLES] IP ${ip} bloqueada totalmente del sistema operativo.`);
    });
}

function desbloquearEnLinux(ip) {
    // Ejecuto el comando para borrar la regla de bloqueo
    exec(`iptables -D INPUT -s ${ip} -j DROP`, (err) => {
        if (!err) console.log(`[IPTABLES] IP ${ip} liberada a nivel de red.`);
        else console.log(`[INFO] No habia regla de iptables para ${ip} o ya fue borrada.`);
    });
}

// --- TELEGRAM ---

async function enviarAlertaTelegram(ip, servicio, tokenUnico) {
    const ahora = Date.now();
    // Verifico si ya envié una alerta a esta IP en el último minuto para evitar spam
    if (ultimasAlertas[ip] && (ahora - ultimasAlertas[ip] < 60000)) return;
    ultimasAlertas[ip] = ahora;

    // Defino la etiqueta de texto según la gravedad (SSH es crítico)
    const etiqueta = servicio === 'SSH' ? '[CRITICO]' : '[ALERTA]';
    const urlPanel = "https://localhost:3001/admin.html"; 

    // Construyo el mensaje usando HTML sin emojis
    const mensaje = `
<b>${etiqueta} SEGURIDAD: ${servicio}</b>
----------------------------------
La IP <b>${ip}</b> ha sido detectada y bloqueada.

Token de seguridad generado:
<code>${tokenUnico}</code>

<b>Accion Requerida</b>
<a href="${urlPanel}">Ir al Panel de Control</a>
    `;
    
    try {
        await axios.post(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
            chat_id: TELEGRAM_CHAT_ID, text: mensaje, parse_mode: 'HTML'
        });
        console.log(`[TELEGRAM] Notificacion enviada para la IP ${ip}`);
    } catch (e) {
        console.error("[ERROR TELEGRAM]", e.message);
    }
}

async function verificarBloqueoPrevio(ip) {
    try {
        // Consulto al Servidor 3 si la IP ya existe en la base de datos
        const respuesta = await axios.get('http://localhost:3003/lista-bloqueo');
        return respuesta.data.includes(ip);
    } catch (error) { return false; }
}

// --- RUTAS ---

app.post('/reportar-fallo', async (req, res) => {
    const { ip, intentos, servicio } = req.body;

    // 1. Verificación WAF
    const bloqueadoPreviamente = await verificarBloqueoPrevio(ip);
    if (bloqueadoPreviamente) {
        return res.status(403).json({ bloqueado: true, razon: "IP en lista negra (WAF)." });
    }

    // 2. Consulta a S2 (Motor de Decisión)
    clienteS2.DecidirBloqueo({ direccion_ip: ip, intentos, tipo_servicio: servicio }, (err, respuesta) => {
        if (err) return res.status(500).json({ error: "Error RPC" });
        
        if (respuesta.debe_bloquear) {
            const tokenUnico = crypto.randomBytes(3).toString('hex').toUpperCase();
            tokensActivos[ip] = tokenUnico;
            
            enviarAlertaTelegram(ip, servicio, tokenUnico);
            
            // Aplico el bloqueo real en el sistema operativo
            bloquearEnLinux(ip);
        }
        
        res.json({ ip, bloqueado: respuesta.debe_bloquear, razon: respuesta.razon });
    });
});

app.get('/admin/lista', async (req, res) => {
    try { 
        const r = await axios.get('http://localhost:3003/lista-bloqueo'); 
        res.json(r.data); 
    } catch(e) { res.json([]); }
});

app.post('/admin/bloquear', async (req, res) => {
    const { ip, token } = req.body;
    if (token !== "ADMIN123") return res.status(403).json({ error: "Credencial invalida" });
    try {
        await axios.post('http://localhost:3003/lista-bloqueo', { ip });
        
        // Aplico el bloqueo manual en el sistema operativo
        bloquearEnLinux(ip);
        
        res.json({ estado: "OK" });
    } catch (e) { res.status(500).json({ error: "Error S3" }); }
});

app.delete('/admin/desbloquear', async (req, res) => {
    const { ip, token } = req.body;
    const esTokenDinamico = tokensActivos[ip] && tokensActivos[ip] === token;
    const esTokenMaestro = token === "ADMIN123";

    if (!esTokenDinamico && !esTokenMaestro) {
        return res.status(403).json({ error: "Token incorrecto" });
    }

    try { 
        await axios.delete(`http://localhost:3003/lista-bloqueo/${ip}`);
        if (esTokenDinamico) delete tokensActivos[ip];
        
        // Retiro el bloqueo del sistema operativo
        desbloquearEnLinux(ip);
        
        res.json({ estado: "OK" }); 
    } catch(e) { res.status(500).json({ error: "Error S3" }); }
});

app.get('/salud', (req, res) => res.json({ estado: 'OK' }));

// Inicio el servidor escuchando en todas las interfaces de red
https.createServer(opcionesHttps, app).listen(PUERTO, '0.0.0.0', () => {
    console.log(`[S1] Servidor activo en puerto ${PUERTO}`);
});
