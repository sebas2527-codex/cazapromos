const mongoose = require('mongoose');
const auditSchema = new mongoose.Schema({
  accion: { type: String },
  detalle: { type: String },
  admin: { type: String },
  fecha: { type: Date, default: Date.now }
}, { timestamps: true });
module.exports = mongoose.model('Audit', auditSchema);