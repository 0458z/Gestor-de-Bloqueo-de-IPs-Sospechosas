#!/bin/bash

# Archivo de logs de autenticación en Linux (Debian/Ubuntu)
LOG_FILE="/var/log/auth.log"

# URL de tu Servidor 1 (Node.js)
API_URL="https://127.0.0.1:3001/reportar-fallo"

echo "👀 Monitoreando intentos fallidos de SSH en tiempo real..."

# 'tail -Fn0' lee el archivo en vivo, ignorando lo antiguo
tail -Fn0 "$LOG_FILE" | while read line ; do

    # Buscamos la frase clave que indica fallo de contraseña
    echo "$line" | grep "Failed password" > /dev/null
    
    if [ $? = 0 ] ; then
        # Usamos expresiones regulares para extraer solo la IP de la línea de texto
        IP=$(echo "$line" | grep -oE "\b([0-9]{1,3}\.){3}[0-9]{1,3}\b")
        
        echo "🚨 Ataque detectado desde: $IP"
        
        # Enviamos la alerta a tu servidor Node.js
        # Enviamos '6' intentos para forzar el bloqueo inmediato y la alerta de Telegram
        curl -s -k -X POST -H "Content-Type: application/json" \
             -d "{\"ip\": \"$IP\", \"intentos\": 6, \"servicio\": \"SSH\"}" \
             "$API_URL"
             
        echo " -> Reporte enviado a S1"
    fi
done

