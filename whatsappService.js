let listo = false;

function iniciar() {
  listo = false;
}

function estaListo() { return false; }

async function enviarWhatsapp(texto) { return false; }

async function enviarA(numero, texto) { return false; }

module.exports = { iniciar, enviarWhatsapp, enviarA, estaListo };