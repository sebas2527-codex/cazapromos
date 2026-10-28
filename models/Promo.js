const mongoose = require('mongoose');
const promoSchema = new mongoose.Schema({
  restaurant: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true },
  tipo: { type: String, enum: ['promo', 'combo', 'plato'], default: 'promo' },
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  category: { type: String, default: 'otros' },
  motivo: { type: String, default: '' },
  priceNormal: { type: Number, required: true },
  pricePromo: { type: Number, required: true },
  image: { type: String, default: '' },
  whatsapp: { type: String, required: true },
  city: { type: String, required: true, lowercase: true },
  validFrom: { type: Date, default: Date.now },
  validUntil: { type: Date, default: null },
  openTime: { type: String, default: '00:00' },
  closeTime: { type: String, default: '23:59' },
  days: { type: [Number], default: [0, 1, 2, 3, 4, 5, 6] },
  weekendsOnly: { type: Boolean, default: false },
  active: { type: Boolean, default: true },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  rejectReason: { type: String, default: '' },
  aiVerdict: { type: mongoose.Schema.Types.Mixed, default: null },
  clicks: { type: Number, default: 0 },
  siCount: { type: Number, default: 0 },
  noCount: { type: Number, default: 0 },
  geo: { type: [mongoose.Schema.Types.Mixed], default: [] }
}, { timestamps: true });
promoSchema.index({ city: 1, status: 1, active: 1 });
promoSchema.index({ days: 1 });
module.exports = mongoose.model('Promo', promoSchema);