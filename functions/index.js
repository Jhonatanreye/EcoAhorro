const functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();

exports.validarTemperatura = functions.firestore
    .document("temperaturas/{id}")
    .onCreate(async (snap, context) => {
      const data = snap.data();
      const temp = data.valor;

      console.log("🌡 Temperatura recibida:", temp);

      let estado = "normal";

      if (temp > 8) {
        estado = "PELIGRO";
      } else if (temp < 2) {
        estado = "CONGELACION";
      }

      // Guardar resultado
      await admin.firestore().collection("alertas").add({
        temperatura: temp,
        estado: estado,
        fecha: new Date(),
      });

      console.log("🚨 Estado:", estado);
    });
