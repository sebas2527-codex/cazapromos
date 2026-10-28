const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const Restaurant = require('../models/Restaurant');
const auth = require('../middleware/auth');
const { enviarA, estaListo } = require('../whatsappService');

const codes = new Map();
const PLANES = {
  '1sem_sin': { precio: 4, dias: 7 },  '1sem_con': { precio: 6, dias: 7 },
  '2sem_sin': { precio: 8, dias: 14 }, '2sem_con': { precio: 12, dias: 14 },
  '3sem_sin': { precio: 14, dias: 21 },'3sem_con': { precio: 17, dias: 21 },
  'mes_sin':  { precio: 18, dias: 30 },'mes_con':  { precio: 23, dias: 30 }
};
function firmar(user){ return jwt.sign({ id:user._id, role:user.role }, process.env.JWT_SECRET, { expiresIn:'7d' }); }
function datos(r){ return { id:r._id,name:r.name,email:r.email,whatsapp:r.whatsapp,city:r.city,plan:r.plan,planPrecio:r.planPrecio,planDias:r.planDias,planExpiresAt:r.planExpiresAt,paid:r.paid,freeUsed:r.freeUsed,fundador:r.fundador,horarioAtencion:r.horarioAtencion,fechasCustom:r.fechasCustom,role:r.role,sector:r.sector,direccion:r.direccion,verified:r.verified }; }

router.post('/sendcode', async (req, res) => {
  const whats = String(req.body.whatsapp || '').replace(/\D/g, '');
  if (whats.length < 8) return res.status(400).json({ error: 'WhatsApp inválido. Escribe tu número real después del +593.' });
  if (!estaListo()) return res.status(503).json({ error: 'Verificación por WhatsApp desactivada por ahora. Crea tu cuenta y te verificamos manualmente.' });
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const sent = await enviarA(whats, `🔐 Tu código JAMA es: ${code}. No lo compartas.`);
  if (!sent) return res.status(400).json({ error: 'No se pudo enviar a ese número. Verifica que exista y tenga WhatsApp.' });
  codes.set(whats, { code, exp: Date.now() + 5 * 60000 });
  res.json({ ok: true });
});

router.post('/register',
  body('email').isEmail().normalizeEmail(), body('password').isLength({ min: 8 }),
  body('name').trim().isLength({ min: 2 }), body('whatsapp').trim().isLength({ min: 8 }),
  body('city').trim().isLength({ min: 2 }),
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
      const { name, email, password, whatsapp, city, lat, lng, sector, direccion, horarioAtencion, code, cedula, ruc, instagram } = req.body;
      const whatsDig = String(whatsapp).replace(/\D/g, '');
      const stored = codes.get(whatsDig);
      if (stored) {
        if (!code || code !== stored.code) return res.status(400).json({ error: 'Código incorrecto. Pide uno nuevo.' });
        if (Date.now() > stored.exp) return res.status(400).json({ error: 'Código expirado. Pide uno nuevo.' });
        codes.delete(whatsDig);
      }
      const existe = await Restaurant.findOne({ email });
      if (existe) return res.status(409).json({ error: 'El correo ya está registrado. Usa otro o entra con tu cuenta.' });
      const total = await Restaurant.countDocuments({ role: 'restaurant' });
      const passwordHash = await bcrypt.hash(password, 12);
      const role = email === process.env.ADMIN_EMAIL ? 'admin' : 'restaurant';
      const doc = { name, email, passwordHash, whatsapp: whatsDig, city, role,
        fundador: (role === 'restaurant' && total < 10),
        horarioAtencion: horarioAtencion || '',
        lat: lat||null, lng: lng||null, sector: sector||'', direccion: direccion||'',
        cedula: cedula||'', ruc: ruc||'', instagram: instagram||'' };
      if (lat && lng) doc.location = { type: 'Point', coordinates: [lng, lat] };
      const restaurant = await Restaurant.create(doc);
      res.status(201).json({ token: firmar(restaurant), restaurant: datos(restaurant) });
    } catch (err) { next(err); }
  });

router.post('/login',
  body('email').isEmail().normalizeEmail(), body('password').isString(),
  async (req, res, next) => {
    try {
      const { email, password } = req.body;
      const restaurant = await Restaurant.findOne({ email });
      if (!restaurant) return res.status(401).json({ error: 'Credenciales inválidas' });
      const ok = await bcrypt.compare(password, restaurant.passwordHash);
      if (!ok) return res.status(401).json({ error: 'Credenciales inválidas' });
      res.json({ token: firmar(restaurant), restaurant: datos(restaurant) });
    } catch (err) { next(err); }
  });

router.get('/me', auth, async (req, res, next) => {
  try { const r = await Restaurant.findById(req.user.id); if (!r) return res.status(404).json({ error: 'No existe' }); res.json({ restaurant: datos(r) }); }
  catch (err) { next(err); }
});

router.put('/profile', auth, async (req, res, next) => {
  try {
    const r = await Restaurant.findById(req.user.id);
    const { horarioAtencion, direccion, sector, instagram } = req.body;
    if (horarioAtencion !== undefined) r.horarioAtencion = horarioAtencion;
    if (direccion !== undefined) r.direccion = direccion;
    if (sector !== undefined) r.sector = sector;
    if (instagram !== undefined) r.instagram = instagram;
    await r.save(); res.json({ restaurant: datos(r) });
  } catch (err) { next(err); }
});

router.put('/plan', auth, async (req, res, next) => {
  try {
    const r = await Restaurant.findById(req.user.id);
    const { plan, diasCustom, fechasCustom, free } = req.body;
    let precio, dias, expiresCustom = null;
    if (PLANES[plan]) { precio = PLANES[plan].precio; dias = PLANES[plan].dias; r.diasCustom = []; r.fechasCustom = []; }
    else if (plan === 'custom' && Array.isArray(diasCustom) && diasCustom.length) {
      const fin = diasCustom.filter(d => d === 0 || d === 6).length;
      const sem = diasCustom.length - fin;
      precio = +(sem * 4 + fin * 2.4).toFixed(2);
      r.diasCustom = diasCustom; r.fechasCustom = fechasCustom || [];
      const f = (r.fechasCustom || []).slice().sort();
      if (f.length) { expiresCustom = new Date(f[f.length-1] + 'T23:59:59'); dias = Math.max(1, Math.ceil((expiresCustom - new Date()) / 86400000)); } else dias = 7;
    } else return res.status(400).json({ error: 'Plan inválido' });
    r.plan = plan; r.planDias = dias;
    if (free && !r.freeUsed) { r.freeUsed = true; r.planPrecio = 0; r.paid = true; r.planExpiresAt = expiresCustom || new Date(Date.now() + dias * 86400000); }
    else { r.planPrecio = precio; r.paid = false; r.planExpiresAt = null; }
    await r.save(); res.json({ restaurant: datos(r) });
  } catch (err) { next(err); }
});

module.exports = router;