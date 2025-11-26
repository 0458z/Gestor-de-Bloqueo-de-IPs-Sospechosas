Gestor de Bloqueo de IPs Sospechosas 

Este proyecto es un sistema distribuido de defensa perimetral diseñado para detectar, analizar y bloquear amenazas de red en tiempo real. Utiliza una arquitectura de microservicios con comunicación híbrida (REST y gRPC) y cuenta con integración de alertas vía Telegram y bloqueo físico mediante `iptables` en Linux.
PROYECTO FINAL PROGRAMACION EN RED
UNIVERSIDAD VERACRUZANA
LICIC
Características Principales

- **Arquitectura Distribuida:** Separación de responsabilidades en 3 servidores (Interfaz, Motor de Decisión, Almacenamiento).
- **Comunicación Híbrida:** Uso de HTTP/REST para clientes y gRPC para comunicación interna de alta velocidad.
- **Firewall de Aplicación (WAF):** Rechazo inmediato de conexiones para IPs en lista negra.
- **Bloqueo Físico (Linux):** Integración con `iptables` para bloquear el tráfico a nivel de red.
- **Alertas en Tiempo Real:** Notificaciones ricas (HTML) a Telegram con detalles del ataque.
- **Tokens de Seguridad:** Generación de tokens criptográficos únicos para desbloqueo seguro.
- **Alta Disponibilidad:** Cola de reintentos y respaldo local en caso de fallo del servidor de base de datos.
- **Interfaz Segura:** Implementación de HTTPS con certificados TLS.
- **Modo Oscuro:** Interfaces de administración y simulación con diseño moderno "Dark Mode".

Tecnologías Usadas

- **Runtime:** Node.js
- **Framework:** Express.js
- **Protocolos:** HTTP/1.1 (REST), HTTP/2 (gRPC)
- **Seguridad:** OpenSSL (Certificados Autofirmados), Crypto (Tokens)
- **Base de Datos:** Persistencia en archivos JSON (Simulación NoSQL)
- **Cliente HTTP:** Axios

Arquitectura del Sistema

| Componente | Archivo | Puerto | Función |
| :--- | :--- | :--- | :--- |
| **S1 (Interfaz)** | `s1_interfaz.js` | 3001 (HTTPS) | Gateway, WAF, Telegram Bot, Hosting Frontend. |
| **S2 (Motor)** | `s2_motor.js` | 50051 (gRPC) | Lógica de negocio. Decide si bloquear (SSH > 3, Web > 5). |
| **S3 (Storage)** | `s3_almacenamiento.js` | 3003 (HTTP) | Base de datos persistente (JSON). |

Prerrequisitos

- Node.js (v16 o superior)
- npm
- OpenSSL (para generar certificados)
- Entorno Linux (recomendado para funcionalidad de `iptables`)

Instalación

1.  **Clonar el repositorio:**
    ```bash
    git clone [https://github.com/0458z/Gestor-de-Bloqueo-de-IPs-Sospechosas.git](https://github.com/0458z/Gestor-de-Bloqueo-de-IPs-Sospechosas.git)
    cd Gestor-de-Bloqueo-de-IPs-Sospechosas
    ```

2.  **Instalar dependencias:**
    ```bash
    npm install
    ```

3.  **Generar certificados SSL (Obligatorio para S1):**
    ```bash
    openssl req -nodes -new -x509 -keyout server.key -out server.cert
    ```
    *(Presiona Enter a todas las preguntas)*.

Ejecución

Para que el sistema funcione correctamente, se deben iniciar los servidores en el siguiente orden estricto. Se recomienda usar 3 terminales distintas.

**Terminal 1 (Base de Datos):**
```bash
node s3_almacenamiento.js
Terminal 2 (Motor de Decisión):

Bash

node s2_motor.js
Terminal 3 (Interfaz y Firewall): Nota: Requiere sudo si deseas que el bloqueo de iptables funcione realmente.

Bash

sudo node s1_interfaz.js
 Uso del Sistema
1. Simulador de Tráfico
Accede a: https://TU_IP_LOCAL:3001/simulador.html

Permite enviar peticiones simuladas (Web o SSH).

Si superas el límite de intentos, el sistema te bloqueará.

2. Panel de Administración
Accede a: https://TU_IP_LOCAL:3001/admin.html

Token Maestro: ADMIN123

Permite ver la lista activa de IPs bloqueadas.

Permite desbloquear IPs usando el token recibido en Telegram o el maestro.

Permite agregar bloqueos manuales.

3. Notificaciones
Cuando ocurre un bloqueo, recibirás un mensaje en Telegram con un formato similar a este:

 ALERTA DE SEGURIDAD: SSH 
La IP 192.168.1.50 ha sido detectada y bloqueada.

Token de seguridad generado: A1F9C2

 Acción Requerida [Ir al Panel de Control]

Advertencia
Este proyecto ejecuta comandos del sistema (iptables). Úselo con precaución en entornos de producción. El código incluye una protección para evitar el auto-bloqueo de IPs locales (127.0.0.1 y 192.168.x.x).

 Licencia
Este proyecto es de código abierto y está disponible bajo la Licencia MIT.
