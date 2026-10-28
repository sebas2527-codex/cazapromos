require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');

const app = express();
app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://unpkg.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://unpkg.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
      imgSrc: ["'self'", "data:", "blob:", "https://tile.openstreetmap.org", "https://a.tile.openstreetmap.org", "https://b.tile.openstreetmap.org", "https://c.tile.openstreetmap.org", "https://a.basemaps.cartocdn.com", "https://b.basemaps.cartocdn.com", "https://c.basemaps.cartocdn.com"],
      connectSrc: ["'self'", "https://tile.openstreetmap.org", "https://api.groq.com", "https://nominatim.openstreetmap.org"]
    }
  }
}));
app.use(cors({ origin: (process.env.CLIENT_ORIGIN || 'http://localhost:5500').split(','), credentials: true }));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 1000, validate: false }));
app.use(mongoSanitize());
app.use(express.json({ limit: '10kb' }));
app.use(express.static('public'));
app.get('/api/health', (req, res) => res.json({ ok: true, app: 'CazaPromos API' }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/promos/track', require('./routes/track'));
app.use('/api/promos', require('./routes/promos'));
app.use('/api/coupons', require('./routes/coupons'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/ai', require('./routes/ai'));
app.use((err, req, res, next) => { console.error(err.message); res.status(500).json({ error: 'Error interno del servidor' }); });

const PORT = process.env.PORT || 5000;
mongoose.connect(process.env.MONGO_URI)
  .then(() => app.listen(PORT, () => console.log(`✅ API CazaPromos corriendo en puerto ${PORT}`)))
  .catch(err => { console.error('❌ Error conectando a MongoDB:', err.message); process.exit(1); });