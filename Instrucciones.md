# 🌡️ EcoAhorro — Sistema de Monitoreo Inteligente de Refrigeración

Sistema IoT para monitorear temperaturas de refrigeradores comerciales en tiempo real, con estrategias de ahorro energético adaptadas a las tarifas CFE de Sonora, México.

---

## 📋 Tabla de Contenidos

1. [¿Qué hace este proyecto?](#qué-hace-este-proyecto)
2. [Arquitectura del sistema](#arquitectura-del-sistema)
3. [Requisitos previos](#requisitos-previos)
4. [Paso 1 — Crear cuenta en Firebase](#paso-1--crear-cuenta-en-firebase)
5. [Paso 2 — Configurar Firestore](#paso-2--configurar-firestore)
6. [Paso 3 — Instalar Node.js y dependencias](#paso-3--instalar-nodejs-y-dependencias)
7. [Paso 4 — Configurar el proyecto](#paso-4--configurar-el-proyecto)
8. [Paso 5 — Configurar el correo](#paso-5--configurar-el-correo)
9. [Paso 6 — Crear los índices en Firestore](#paso-6--crear-los-índices-en-firestore)
10. [Paso 7 — Ejecutar el sensor](#paso-7--ejecutar-el-sensor)
11. [Paso 8 — Abrir el dashboard](#paso-8--abrir-el-dashboard)
12. [Cómo funciona el ahorro energético](#cómo-funciona-el-ahorro-energético)
13. [Estructura de archivos](#estructura-de-archivos)
14. [Solución de problemas](#solución-de-problemas)

---

## ¿Qué hace este proyecto?

EcoAhorro conecta un sensor de temperatura a Firebase y aplica inteligencia para reducir el consumo eléctrico:

- **Monitoreo en tiempo real** — lee la temperatura del refrigerador cada 5 minutos (o cada 30 segundos en modo crítico)
- **Alertas por correo** — envía un email cuando la temperatura supera 5°C
- **Peak Shaving** — pre-enfría el equipo antes del horario pico de CFE (2–6 PM) para evitar arrancar el compresor cuando la luz es más cara
- **Mantenimiento predictivo** — detecta si el motor trabaja más de lo normal y estima cuánto dinero extra se está gastando
- **Dashboard web** — visualiza todo en tiempo real desde el navegador

---

## Arquitectura del sistema

```
[Sensor / Simulador]
        │
        ▼
  sensor.js (Node.js)
        │
        ├──► Firestore (colección: lecturas)
        │
        ├──► Firestore (colección: señales_control)
        │
        ├──► Firestore (colección: reportes_mantenimiento)
        │
        └──► Gmail (alertas de temperatura y mantenimiento)
                          │
                          ▼
                   dashboard.html
               (tiempo real vía onSnapshot)
```

---

## Requisitos previos

| Herramienta | Versión mínima | Descarga |
|-------------|---------------|----------|
| Node.js | 18 o superior | https://nodejs.org |
| npm | incluido con Node | — |
| Cuenta Google | — | https://accounts.google.com |
| Navegador | Chrome o Edge | — |

---

## Paso 1 — Crear cuenta en Firebase

1. Ve a [https://console.firebase.google.com](https://console.firebase.google.com)
2. Inicia sesión con tu cuenta de Google
3. Haz clic en **"Agregar proyecto"**
4. Nombre del proyecto: `ecoahorro` (o el que prefieras)
5. Desactiva Google Analytics (no es necesario) → **Crear proyecto**
6. Espera a que se cree y haz clic en **Continuar**

---

## Paso 2 — Configurar Firestore

### 2.1 Activar la base de datos

1. En el menú izquierdo de Firebase, haz clic en **Firestore Database**
2. Clic en **"Crear base de datos"**
3. Selecciona **"Iniciar en modo de prueba"** → Siguiente
4. Elige la región: `nam5 (us-central)` → **Listo**

### 2.2 Obtener la clave de servicio (para el sensor)

1. En Firebase, ve a ⚙️ **Configuración del proyecto** → pestaña **"Cuentas de servicio"**
2. Haz clic en **"Generar nueva clave privada"**
3. Se descargará un archivo `.json` — renómbralo a `clave.json`
4. Colócalo en la carpeta del proyecto

### 2.3 Obtener la API Key (para el dashboard)

1. En ⚙️ **Configuración del proyecto** → pestaña **"General"**
2. Baja hasta **"Tus apps"** → haz clic en **"</> Web"**
3. Registra la app con cualquier nombre
4. Copia el objeto `firebaseConfig` que aparece — necesitarás el valor de `apiKey`

---

## Paso 3 — Instalar Node.js y dependencias

### 3.1 Instalar Node.js

Descarga el instalador desde [https://nodejs.org](https://nodejs.org) y sigue los pasos. Verifica la instalación:

```bash
node --version
npm --version
```

### 3.2 Crear la carpeta del proyecto

```bash
mkdir ecoahorro
cd ecoahorro
npm init -y
```

### 3.3 Instalar las dependencias

```bash
npm install firebase-admin nodemailer
```

---

## Paso 4 — Configurar el proyecto

### 4.1 Estructura de archivos a crear

```
ecoahorro/
├── sensor.js        ← lógica del sensor
├── dashboard.html   ← interfaz web
├── clave.json       ← clave de Firebase (NO subir a GitHub)
└── package.json     ← generado automáticamente
```

### 4.2 Configurar sensor.js

Abre `sensor.js` y verifica que el ID de tu proyecto esté correcto. No necesitas cambiar nada más si usaste `clave.json` como nombre de la clave.

```javascript
// Esta línea en sensor.js ya apunta a tu clave:
const serviceAccount = require("./clave.json");
```

---

## Paso 5 — Configurar el correo

El sistema usa Gmail para enviar alertas. Para que funcione necesitas una **contraseña de aplicación** (no tu contraseña normal de Gmail).

### 5.1 Activar verificación en 2 pasos

1. Ve a [https://myaccount.google.com/security](https://myaccount.google.com/security)
2. Activa **"Verificación en 2 pasos"** si no la tienes

### 5.2 Crear contraseña de aplicación

1. En la misma página de seguridad, busca **"Contraseñas de aplicaciones"**
2. Selecciona app: **"Correo"** / Dispositivo: **"Otro"** → escribe `EcoAhorro`
3. Haz clic en **Generar**
4. Copia la contraseña de 16 caracteres que aparece (con espacios)

### 5.3 Actualizar sensor.js

```javascript
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "TU_CORREO@gmail.com",        // 👈 tu correo
    pass: "xxxx xxxx xxxx xxxx"         // 👈 contraseña de aplicación
  }
});
```

También cambia el destinatario:

```javascript
to: "correo_del_cliente@gmail.com",    // 👈 a quién se envía la alerta
```

---

## Paso 6 — Crear los índices en Firestore

El sistema necesita dos índices para funcionar correctamente.

### Índice 1 — colección `lecturas`

1. Ve a [https://console.firebase.google.com](https://console.firebase.google.com)
2. Selecciona tu proyecto → **Firestore Database** → pestaña **"Índices"**
3. Haz clic en **"Agregar índice"**
4. Configura así:

| Campo | Orden |
|-------|-------|
| `sensorId` | Ascendente |
| `timestamp` | Ascendente |

5. Alcance: **Colección** → nombre: `lecturas` → **Crear**

> ⏳ El índice tarda ~2 minutos en compilarse. Espera a que el estado cambie a ✅.

### Índice 2 — colección `señales_control` (opcional)

Si quieres consultar señales por sensor y fecha en el futuro, crea el mismo índice para la colección `señales_control`.

---

## Paso 7 — Ejecutar el sensor

Una vez que todo esté configurado, corre el sistema:

```bash
node sensor.js
```

Deberías ver en la terminal:

```
🚀 Sistema EcoAhorro iniciado...
✅ Operación normal. Setpoint: 4.0°C
📡 Señal Peak Shaving registrada → Modo: normal, Setpoint: 4.0°C
🔧 Uso motor HOY: 0.0% | HACE 1 MES: 0.0% | Δ: 0.0%
ℹ️ Mantenimiento predictivo: sin datos históricos suficientes (< 30 días).
✅ [10:30:00 a.m.] Lectura: 3.8°C | Motor: APAGADO (ID: xxxxx)
```

### Modos de operación automáticos por hora

| Hora | Modo | Setpoint | ¿Por qué? |
|------|------|----------|-----------|
| 1:00 PM | Pre-enfriamiento | 2.0°C | Acumula frío antes del pico |
| 2:00–6:00 PM | Pico CFE | 5.5°C | Evita arrancar el compresor |
| Resto del día | Normal | 4.0°C | Operación estándar |

---

## Paso 8 — Abrir el dashboard

### 8.1 Editar dashboard.html

Abre `dashboard.html` con el Bloc de notas y busca esta línea:

```javascript
apiKey: "TU_API_KEY",
```

Reemplaza `TU_API_KEY` con la API Key que copiaste en el Paso 2.3.

### 8.2 Abrir en el navegador

**Opción A — Doble clic (más simple):**
Abre `dashboard.html` directamente con Chrome o Edge.

**Opción B — Servidor local (si hay errores de CORS):**

```bash
npx serve .
```

Luego abre en Chrome: `http://localhost:3000/dashboard.html`

### 8.3 Ver en tiempo real

Con el dashboard abierto y `node sensor.js` corriendo en la terminal, la temperatura se actualizará automáticamente cada vez que llegue una nueva lectura.

---

## Cómo funciona el ahorro energético

### ⚡ Peak Shaving

La tarifa de CFE en Sonora es más cara entre las 2:00 PM y 6:00 PM en verano. EcoAhorro:

1. A la **1:00 PM** baja el setpoint a 2°C para enfriar al máximo
2. De **2:00 a 6:00 PM** permite que la temperatura suba hasta 5.5°C
3. El compresor no necesita arrancar porque el refrigerador ya está muy frío
4. Se evita el consumo eléctrico en las horas más caras

### 🔧 Mantenimiento Predictivo

Un condensador sucio hace que el motor trabaje más tiempo para mantener la misma temperatura. El sistema:

1. Mide cada día el % de tiempo que el motor estuvo encendido
2. Compara ese dato con el mismo período hace 30 días
3. Si el uso aumentó 20% o más, envía un correo con el diagnóstico:

```
⚠️ MANTENIMIENTO: motor usa 25% más tiempo.
Costo extra estimado: $210 MXN/mes.
Limpie el condensador.
```

> 💡 El análisis de mantenimiento corre automáticamente una vez al día y necesita al menos 30 días de datos históricos para hacer comparaciones.

---

## Estructura de archivos

```
ecoahorro/
│
├── sensor.js              ← Sistema principal
│   ├── Peak Shaving       (evaluarPeakShaving)
│   ├── Mantenimiento      (analizarMantenimientoPredictivo)
│   ├── Alertas correo     (enviarCorreo, enviarCorreoMantenimiento)
│   └── Simulador sensor   (simularSensor)
│
├── dashboard.html         ← Interfaz web en tiempo real
│   ├── Temperatura hero   (grande, con color dinámico)
│   ├── Estado del motor   (ENCENDIDO/APAGADO)
│   ├── Modo Peak Shaving  (actualización automática por hora)
│   └── Gráfica histórica  (últimas 10 lecturas)
│
├── clave.json             ← ⚠️ Clave privada Firebase (NO compartir)
└── package.json
```

### Colecciones en Firestore

| Colección | ¿Qué guarda? |
|-----------|-------------|
| `lecturas` | Temperatura, estado del motor, modo Peak Shaving |
| `señales_control` | Señales generadas por Peak Shaving (modo, setpoint) |
| `reportes_mantenimiento` | Alertas de ineficiencia del motor con costo estimado |

---

## Solución de problemas

### ❌ Error: "The query requires an index"
El índice de Firestore no está creado. Sigue el Paso 6 de esta guía.

### ❌ Error: "Cannot find module './clave.json'"
El archivo `clave.json` no está en la misma carpeta que `sensor.js`. Muévelo ahí.

### ❌ El correo no se envía
Verifica que estás usando una **contraseña de aplicación** de Gmail (no tu contraseña normal). Sigue el Paso 5.

### ❌ El dashboard no carga datos
Asegúrate de que `apiKey` en `dashboard.html` sea la correcta. Ábrelo con Chrome (no Firefox). Si ves errores de CORS, usa `npx serve .`

### ❌ "sin datos históricos suficientes"
Es normal durante el primer mes. El mantenimiento predictivo necesita 30 días de lecturas para hacer comparaciones.

---

## Variables de configuración

Para personalizar el sistema, modifica estas constantes al inicio de `sensor.js`:

```javascript
const HORARIO_PICO = { inicio: 14, fin: 18 };  // Horario pico CFE
const HORA_PRE_ENFRIAMIENTO = 13;               // Hora de pre-enfriamiento
const TEMP_PRE_ENFRIAMIENTO = 2.0;             // °C mínima en pre-enfriamiento
const TEMP_NORMAL = 4.0;                        // °C objetivo normal
const TEMP_PICO_PERMITIDA = 5.5;               // °C máxima en horario pico
const UMBRAL_INEFICIENCIA_PCT = 20;            // % de aumento para alerta
const COSTO_KWH_MXN = 3.5;                    // Costo del kWh en tu tarifa CFE
const POTENCIA_MOTOR_KW = 0.5;                // Potencia del compresor en kW
```

---

*EcoAhorro — Desarrollado para negocios en Sonora, México*