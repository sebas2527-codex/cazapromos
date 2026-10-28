require('dotenv').config();
const mongoose = require('mongoose');
const Promo = require('./models/Promo');
const Coupon = require('./models/Coupon');

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const p = await Promo.deleteMany({});
  const c = await Coupon.deleteMany({});
  console.log(`🧹 Promos borradas: ${p.deletedCount} · Cupones borrados: ${c.deletedCount}`);
  console.log('Listo. Puedes subir promos nuevas desde cero.');
  process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });