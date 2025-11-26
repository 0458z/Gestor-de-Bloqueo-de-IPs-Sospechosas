const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const axios = require('axios');

// --- CORRECCIÓN AQUÍ: keepCase: true ---
const definicionPaquete = protoLoader.loadSync('./protocolo.proto', {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
});
const protoDecision = grpc.loadPackageDefinition(definicionPaquete);
const URL_S3 = 'http://localhost:3003/lista-bloqueo';

let colaPendiente = [];

const decidirBloqueo = async (llamada, callback) => {
    // Ahora sí leerá las variables correctamente
    const { direccion_ip, intentos, tipo_servicio } = llamada.request;
    
    console.log(`Analizando tráfico ${tipo_servicio} desde ${direccion_ip} con ${intentos} intentos`);

    let limitePermitido = (tipo_servicio === 'SSH') ? 3 : 5;

    if (intentos > limitePermitido) {
        try {
            await axios.post(URL_S3, { ip: direccion_ip });
            callback(null, { 
                debe_bloquear: true, 
                razon: `Peligro ${tipo_servicio}: Superó el límite de ${limitePermitido}` 
            });
        } catch (error) {
            console.error("Fallo en conexión S3. Guardando en cola de reintento.");
            colaPendiente.push(direccion_ip);
            callback(null, { 
                debe_bloquear: true, 
                razon: "Bloqueo preventivo (S3 no disponible - Respaldo Local)" 
            });
        }
    } else {
        callback(null, { debe_bloquear: false, razon: "Tráfico dentro de parámetros normales" });
    }
};

setInterval(async () => {
    if (colaPendiente.length > 0) {
        console.log(`Sincronizando ${colaPendiente.length} registros...`);
        const copiaCola = [...colaPendiente];
        
        for (const ip of copiaCola) {
            try {
                await axios.post(URL_S3, { ip });
                colaPendiente = colaPendiente.filter(i => i !== ip);
            } catch (e) { break; }
        }
    }
}, 30000);

const servidor = new grpc.Server();
servidor.addService(protoDecision.ServicioDecision.service, { DecidirBloqueo: decidirBloqueo });
servidor.bindAsync('0.0.0.0:50051', grpc.ServerCredentials.createInsecure(), () => {
    console.log('✅ Servidor 2 (Motor de Decisión) corriendo en puerto 50051');
    servidor.start();
});
