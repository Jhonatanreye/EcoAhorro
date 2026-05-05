const admin = require("firebase-admin");
const serviceAccount = require("./clave.json");
const nodemailer = require("nodemailer");

// 🔐 Inicializar Firebase
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// 📧 Configurar correo
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "jhonatanisaac01@gmail.com",
    pass: "kpou mofo agsf qykk" // ⚠️ usa contraseña de aplicación
  }
});

// 🚨 Control para evitar spam
let alertaEnviada = false;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ⚡ CONFIGURACIÓN DE TARIFAS PICO (CFE - Sonora)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const HORARIO_PICO = { inicio: 14, fin: 18 };     // 2:00 PM – 6:00 PM
const HORA_PRE_ENFRIAMIENTO = 13;                  // 1:00 PM
const TEMP_PRE_ENFRIAMIENTO = 2.0;                 // °C (máximo frío)
const TEMP_NORMAL = 4.0;                           // °C objetivo normal
const TEMP_PICO_PERMITIDA = 5.5;                   // °C máxima tolerada en horario pico

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🔧 CONFIGURACIÓN DE MANTENIMIENTO PREDICTIVO
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const UMBRAL_INEFICIENCIA_PCT = 20;  // % de aumento de uso del motor que dispara alerta
const COSTO_KWH_MXN = 3.5;          // Costo aproximado por kWh en tarifa CFE Sonora
const POTENCIA_MOTOR_KW = 0.5;      // Potencia del motor del compresor en kW


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 📧 Función de correo (con HTML)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function enviarCorreo(temp) {
  try {
    await transporter.sendMail({
      from: "EcoAhorro 🚨 <jhonatanisaac01@gmail.com>",
      to: "jhonatanirs16@gmail.com",
      subject: "🚨 Alerta crítica - EcoAhorro",
      html: `
        <h2 style="color:red;">🚨 Alerta de Temperatura</h2>
        <p>Se detectó una temperatura fuera de rango:</p>
        <h1>${temp}°C</h1>
        <p>Revisa tu sistema de refrigeración inmediatamente.</p>
        <hr>
        <small>EcoAhorro System</small>
      `
    });
    console.log("📧 Correo de alerta enviado correctamente");
  } catch (error) {
    console.error("❌ Error enviando correo:", error);
  }
}

async function enviarCorreoMantenimiento(porcentajeAumento, costoExtra) {
  try {
    await transporter.sendMail({
      from: "EcoAhorro ⚙️ <jhonatanisaac01@gmail.com>",
      to: "correo_cliente@gmail.com",
      subject: "⚙️ Aviso de Mantenimiento Predictivo - EcoAhorro",
      html: `
        <h2 style="color:orange;">⚙️ Mantenimiento Predictivo</h2>
        <p>Se detectó un aumento de <strong>${porcentajeAumento.toFixed(1)}%</strong>
           en el tiempo de uso del motor para mantener la misma temperatura.</p>
        <p>Posible causa: <strong>condensador sucio</strong> u obstrucción en el sistema.</p>
        <h3 style="color:red;">💸 Costo extra estimado: $${costoExtra.toFixed(0)} MXN/mes</h3>
        <p><em>Recomendación: Solicite limpieza del equipo para recuperar eficiencia.</em></p>
        <hr>
        <small>EcoAhorro System – Mantenimiento Predictivo</small>
      `
    });
    console.log("📧 Correo de mantenimiento enviado correctamente");
  } catch (error) {
    console.error("❌ Error enviando correo de mantenimiento:", error);
  }
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ⚡ A. PEAK SHAVING – Determinar setpoint según hora
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Evalúa la hora actual y determina el modo de operación:
 *   - "pre-enfriamiento": bajar temp al máximo antes del pico
 *   - "pico":            tolerar temp ligeramente más alta para no encender compresor
 *   - "normal":          operación estándar
 *
 * @returns {{ modo: string, setpoint: number, mensaje: string }}
 */
function evaluarPeakShaving() {
  const hora = new Date().getHours();

  if (hora === HORA_PRE_ENFRIAMIENTO) {
    return {
      modo: "pre-enfriamiento",
      setpoint: TEMP_PRE_ENFRIAMIENTO,
      mensaje: `⚡ PRE-ENFRIAMIENTO: bajando a ${TEMP_PRE_ENFRIAMIENTO}°C antes del horario pico.`
    };
  }

  if (hora >= HORARIO_PICO.inicio && hora < HORARIO_PICO.fin) {
    return {
      modo: "pico",
      setpoint: TEMP_PICO_PERMITIDA,
      mensaje: `💡 HORARIO PICO CFE: tolerando hasta ${TEMP_PICO_PERMITIDA}°C para evitar arranque de compresor.`
    };
  }

  return {
    modo: "normal",
    setpoint: TEMP_NORMAL,
    mensaje: `✅ Operación normal. Setpoint: ${TEMP_NORMAL}°C`
  };
}

/**
 * Guarda en Firestore la señal de control generada por Peak Shaving.
 */
async function registrarSeñalPeakShaving(peakInfo) {
  try {
    await db.collection("señales_control").add({
      sensorId: "REFRI_01",
      modo: peakInfo.modo,
      setpoint: peakInfo.setpoint,
      timestamp: new Date()
    });
    console.log(`📡 Señal Peak Shaving registrada → Modo: ${peakInfo.modo}, Setpoint: ${peakInfo.setpoint}°C`);
  } catch (error) {
    console.error("❌ Error registrando señal Peak Shaving:", error);
  }
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🔧 B. MANTENIMIENTO PREDICTIVO
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * Calcula el porcentaje de tiempo que el motor estuvo encendido
 * dentro de un arreglo de lecturas de Firestore.
 *
 * @param {Array} lecturas - Documentos de Firestore con campo `estadoMotor` (boolean)
 * @returns {number} Porcentaje 0–100
 */
function calcularUsoMotorPct(lecturas) {
  if (!lecturas.length) return 0;
  const encendidas = lecturas.filter(l => l.estadoMotor === true).length;
  return (encendidas / lecturas.length) * 100;
}

/**
 * Consulta Firestore, compara uso del motor hoy vs hace 30 días
 * y alerta si aumentó más del umbral configurado.
 */
async function analizarMantenimientoPredictivo() {
  try {
    const ahora = new Date();

    // Ventana "hoy": últimas 24 horas
    const haceUnDia = new Date(ahora.getTime() - 24 * 60 * 60 * 1000);

    // Ventana "hace un mes": 24 horas centradas en 30 días atrás
    const haceUnMesFin = new Date(ahora.getTime() - 29 * 24 * 60 * 60 * 1000);
    const haceUnMesInicio = new Date(ahora.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [snapHoy, snapMes] = await Promise.all([
      db.collection("lecturas")
        .where("sensorId", "==", "REFRI_01")
        .where("timestamp", ">=", haceUnDia)
        .where("timestamp", "<=", ahora)
        .get(),

      db.collection("lecturas")
        .where("sensorId", "==", "REFRI_01")
        .where("timestamp", ">=", haceUnMesInicio)
        .where("timestamp", "<=", haceUnMesFin)
        .get()
    ]);

    const lecturasHoy = snapHoy.docs.map(d => d.data());
    const lecturasMes = snapMes.docs.map(d => d.data());

    if (!lecturasMes.length) {
      console.log("ℹ️ Mantenimiento predictivo: sin datos históricos suficientes (< 30 días).");
      return;
    }

    const usoHoy = calcularUsoMotorPct(lecturasHoy);
    const usoMes = calcularUsoMotorPct(lecturasMes);
    const aumentoPct = usoMes > 0 ? ((usoHoy - usoMes) / usoMes) * 100 : 0;

    console.log(`🔧 Uso motor HOY: ${usoHoy.toFixed(1)}% | HACE 1 MES: ${usoMes.toFixed(1)}% | Δ: ${aumentoPct.toFixed(1)}%`);

    if (aumentoPct >= UMBRAL_INEFICIENCIA_PCT) {
      // Estimar costo extra mensual
      // Horas extra de motor = (diferencia en %) * 24h * 30 días
      const horasExtraMes = ((usoHoy - usoMes) / 100) * 24 * 30;
      const costoExtraMXN = horasExtraMes * POTENCIA_MOTOR_KW * COSTO_KWH_MXN;

      const mensaje = `⚠️ MANTENIMIENTO: motor usa ${aumentoPct.toFixed(1)}% más tiempo. Costo extra estimado: $${costoExtraMXN.toFixed(0)} MXN/mes. Limpie el condensador.`;
      console.warn(mensaje);

      // Guardar reporte en Firestore
      await db.collection("reportes_mantenimiento").add({
        sensorId: "REFRI_01",
        usoMotorHoy: usoHoy,
        usoMotorMesAnterior: usoMes,
        aumentoPorcentaje: aumentoPct,
        costoExtraMXN,
        mensaje,
        timestamp: new Date()
      });

      // Enviar correo de alerta de mantenimiento
      await enviarCorreoMantenimiento(aumentoPct, costoExtraMXN);
    }

  } catch (error) {
    console.error("❌ Error en análisis de mantenimiento predictivo:", error);
  }
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 📡 Enviar lectura a Firebase + toda la lógica
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function enviarLectura(temp) {
  let proximoEnvio = 300000; // 5 min por defecto

  try {
    // ── Peak Shaving: determinar modo actual ──────────────
    const peakInfo = evaluarPeakShaving();
    console.log(peakInfo.mensaje);

    // Guardar la señal de control en Firestore
    await registrarSeñalPeakShaving(peakInfo);

    // ── Guardar lectura del sensor ────────────────────────
    const ref = await db.collection("lecturas").add({
      sensorId: "REFRI_01",
      temperatura: temp,
      estadoMotor: temp > TEMP_NORMAL,
      modoPeakShaving: peakInfo.modo,
      setpointActual: peakInfo.setpoint,
      timestamp: new Date()
    });

    console.log(
      `✅ [${new Date().toLocaleTimeString()}] Lectura: ${temp}°C | Motor: ${temp > TEMP_NORMAL ? "ENCENDIDO" : "APAGADO"} (ID: ${ref.id})`
    );

    // ── Modo inteligente de frecuencia ────────────────────
    const esCritico = temp > 4.5;
    proximoEnvio = esCritico ? 30000 : 300000;

    if (esCritico) {
      console.warn("⚠️ MODO CRÍTICO: enviando cada 30 segundos");
    }

    // ── Alerta de temperatura por correo ──────────────────
    if (temp > 5 && !alertaEnviada) {
      alertaEnviada = true;
      await enviarCorreo(temp);
    }
    if (temp <= 5) {
      alertaEnviada = false;
    }

  } catch (error) {
    console.error("❌ Error de conexión:", error);
    proximoEnvio = 10000;
  }

  setTimeout(simularSensor, proximoEnvio);
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🌡️ Simulación de sensor
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function simularSensor() {
  const tempSimulada = parseFloat(
    (Math.random() * (7 - 2) + 2).toFixed(1)
  );
  enviarLectura(tempSimulada);
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🚀 Iniciar sistema
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
console.log("🚀 Sistema EcoAhorro iniciado...");

// Arrancar ciclo de lectura de sensor
simularSensor();

// Análisis de mantenimiento predictivo: corre una vez al día (cada 24 h)
analizarMantenimientoPredictivo();
setInterval(analizarMantenimientoPredictivo, 24 * 60 * 60 * 1000);