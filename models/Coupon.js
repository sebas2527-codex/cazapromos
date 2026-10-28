const mongoose = require('mongoose');
const couponSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  promo: { type: mongoose.Schema.Types.ObjectId, ref: 'Promo', required: true },
  restaurant: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true },
  deviceId: { type: String, required: true, index: true },
  status: { type: String, enum: ['generado','vendido','comprado','no_compro'], default: 'generado' }
}, { timestamps: true });
couponSchema.index({ createdAt: 1 });
module.exports = mongoose.model('Coupon', couponSchema);