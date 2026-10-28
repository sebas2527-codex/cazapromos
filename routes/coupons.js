const router = require('express').Router();
const Coupon = require('../models/Coupon');
const Promo = require('../models/Promo');
const auth = require('../middleware/auth');

function genCode() { return Math.random().toString(36).replace(/[^a-z0-9]/gi, '').slice(0, 6).toUpperCase(); }

router.post('/', async (req, res, next) => {
  try {
    const { promoId, deviceId } = req.body;
    if (!promoId || !deviceId) return res.status(400).json({ error: 'Faltan datos' });
    const promo = await Promo.findById(promoId);
    if (!promo) return res.status(404).json({ error: 'Promo no existe' });
    let code = genCode();
    while (await Coupon.findOne({ code })) code = genCode();
    const coupon = await Coupon.create({ code, promo: promo._id, restaurant: promo.restaurant, deviceId, status: 'generado' });
    res.status(201).json({ code, id: coupon._id });
  } catch (err) { next(err); }
});

router.get('/mine', async (req, res, next) => {
  try {
    const { deviceId } = req.query;
    const limite = new Date(Date.now() - 12 * 3600000);
    const cups = await Coupon.find({ deviceId, status: 'generado', createdAt: { $lte: limite } }).populate('promo', 'title').limit(5);
    res.json({ coupons: cups.map(c => ({ id: c._id, title: c.promo?.title || 'una promo', code: c.code })) });
  } catch (err) { next(err); }
});

// Lista de ventas/leads del restaurante
router.get('/list', auth, async (req, res, next) => {
  try {
    const cups = await Coupon.find({ restaurant: req.user.id }).sort({ createdAt: -1 }).limit(30).populate('promo', 'title');
    res.json({ coupons: cups.map(c => ({ id: c._id, code: c.code, status: c.status, title: c.promo?.title || '', fecha: c.createdAt })) });
  } catch (err) { next(err); }
});

// El restaurante marca desde la lista: compra o solo información
router.post('/:id/mark', auth, async (req, res, next) => {
  try {
    const { result } = req.body; // 'compra' | 'info'
    const c = await Coupon.findOne({ _id: req.params.id, restaurant: req.user.id });
    if (!c) return res.status(404).json({ error: 'No encontrado' });
    c.status = result === 'compra' ? 'vendido' : 'no_compro';
    await c.save(); res.json({ coupon: c });
  } catch (err) { next(err); }
});

router.post('/:id/confirm', async (req, res, next) => {
  try {
    const { deviceId, bought } = req.body;
    const c = await Coupon.findOne({ _id: req.params.id, deviceId });
    if (!c) return res.status(404).json({ error: 'No encontrado' });
    c.status = bought ? 'comprado' : 'no_compro';
    await c.save(); res.json({ coupon: c });
  } catch (err) { next(err); }
});

router.post('/redeem', auth, async (req, res, next) => {
  try {
    const { code } = req.body;
    const c = await Coupon.findOne({ code: String(code || '').toUpperCase(), restaurant: req.user.id }).populate('promo', 'title');
    if (!c) return res.status(404).json({ error: 'Código no válido para tu local' });
    c.status = 'vendido'; await c.save();
    res.json({ ok: true, title: c.promo?.title });
  } catch (err) { next(err); }
});

router.get('/stats', auth, async (req, res, next) => {
  try {
    const agg = await Coupon.aggregate([{ $match: { restaurant: req.user.id } }, { $group: { _id: '$status', n: { $sum: 1 } } }]);
    const out = { generado: 0, vendido: 0, comprado: 0, no_compro: 0 };
    agg.forEach(a => { out[a._id] = a.n; });
    res.json({ stats: out });
  } catch (err) { next(err); }
});

module.exports = router;