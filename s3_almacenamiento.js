const express = require('express');
const fs = require('fs'); // Uso esta librería para manipular archivos del sistema
const app = express();
const PUERTO = 3003;
const ARCHIVO_BD = 'base_datos.json';

app.use(express.json());

// Variable en memoria que sincronizo con el archivo
let ipsBloqueadas = [];

// Al iniciar, verifico si ya tengo una base de datos guardada para cargarla
if (fs.existsSync(ARCHIVO_BD)) {
    const datos = fs.readFileSync(ARCHIVO_BD);
    ipsBloqueadas = JSON.parse(datos);
    console.log(`Base de datos cargada. Registros actuales: ${ipsBloqueadas.length}`);
} else {
    console.log("Iniciando con base de datos nueva.");
}

// Creé esta función auxiliar para guardar los cambios en disco cada vez que modifico la lista
function guardarCambios() {
    fs.writeFileSync(ARCHIVO_BD, JSON.stringify(ipsBloqueadas, null, 2));
}

// Endpoint de salud para verificar que el servidor está activo
app.get('/salud', (req, res) => {
    res.status(200).json({ estado: 'ACTIVO', fecha: Date.now() });
});

// Endpoint para consultar la lista completa (usado por S1)
app.get('/lista-bloqueo', (req, res) => {
    res.json(ipsBloqueadas);
});

// Endpoint para agregar una IP. Aquí valido que no exista duplicidad antes de guardar.
app.post('/lista-bloqueo', (req, res) => {
    const { ip } = req.body;
    if (!ipsBloqueadas.includes(ip)) {
        ipsBloqueadas.push(ip);
        guardarCambios(); // Persisto el dato
        console.log(`IP agregada a lista negra: ${ip}`);
    }
    res.status(201).json({ estado: 'Bloqueada', ip });
});

// Endpoint para eliminar una IP. Actualizo el archivo inmediatamente.
app.delete('/lista-bloqueo/:ip', (req, res) => {
    const { ip } = req.params;
    const longitudInicial = ipsBloqueadas.length;
    ipsBloqueadas = ipsBloqueadas.filter(ipBloqueada => ipBloqueada !== ip);
    
    if (ipsBloqueadas.length !== longitudInicial) {
        guardarCambios();
        console.log(`IP eliminada de lista negra: ${ip}`);
    }
    res.json({ estado: 'Eliminada' });
});

app.listen(PUERTO, () => console.log(`Servidor 3 (Almacenamiento) corriendo en puerto ${PUERTO}`));
