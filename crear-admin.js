require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Restaurant = require('./models/Restaurant');

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  const hash = await bcrypt.hash('jamapay2026', 12);
  let r = await Restaurant.findOne({ email: 'cazayapadejamas@gmail.com' });
  if (!r) {
    r = new Restaurant({ name: 'JAMAPAY Jefe', email: 'cazayapadejamas@gmail.com', whatsapp: '593999999999', city: 'guayaquil' });
  }
  r.passwordHash = hash;
  r.role = 'admin';
  await r.save();
  console.log('LISTO: cuenta admin creada/actualizada');
  process.exit(0);
}
main();