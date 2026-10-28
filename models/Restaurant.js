const mongoose = require('mongoose');
const restaurantSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  whatsapp: { type: String, required: true },
  city: { type: String, required: true, lowercase: true },
  role: { type: String, enum: ['restaurant', 'admin'], default: 'restaurant' },
  plan: { type: String, default: '' },
  planPrecio: { type: Number, default: 0 },
  planDias: { type: Number, default: 0 },
  planExpiresAt: { type: Date, default: null },
  paid: { type: Boolean, default: false },
  freeUsed: { type: Boolean, default: false },
  fundador: { type: Boolean, default: false },
  horarioAtencion: { type: String, default: '' },
  diasCustom: { type: [Number], default: [] },
  fechasCustom: { type: [String], default: [] },
  banned: { type: Boolean, default: false },
  verified: { type: Boolean, default: false },
  lat: { type: Number, default: null },
  lng: { type: Number, default: null },
  sector: { type: String, default: '' },
  direccion: { type: String, default: '' },
  location: { type: { type: String, enum: ['Point'] }, coordinates: { type: [Number] } },
  cedula: { type: String, default: '' },
  ruc: { type: String, default: '' },
  instagram: { type: String, default: '' }
}, { timestamps: true });
restaurantSchema.index({ location: '2dsphere' });
restaurantSchema.index({ city: 1 });
module.exports = mongoose.model('Restaurant', restaurantSchema);