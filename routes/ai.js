const router = require('express').Router();
const fs = require('fs'); const path = require('path');
const Promo = require('../models/Promo');
const auth = require('../middleware/auth');

const CATS = ['hamburguesas','pizza','alitas','platos_fuertes','sopas','sushi','fideos','mariscos','postres','bebidas','otros'];

async function llamarIA(prompt, img) {
  if (process.env.GROQ_API_KEY) {
    const content = [{ type: 'text', text: prompt }];
    if (img) content.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${img}` } });
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', { method: 'POST', headers: { Authorization: 'Bearer ' + process.env.GROQ_API_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: process.env.GROQ_MODEL || 'qwen/qwen3.8-27b', messages: [{ role: 'user', content }], max_tokens: 300 }) });
    const d = await r.json();
    return (d.choices?.[0]?.message?.content || '').replace(/```json|```/g, '');
  }
  const r = await fetch('http://localhost:11434/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: 'qwen2.5vl:7b', prompt, images: img ? [img] : undefined, stream: false }) });
  const d = await r.json();
  return d.response;
}

router.post('/review', auth, async (req, res, next) => {
  try {
    const promo = await Promo.findById(req.body.promoId);
    if (!promo) return res.status(404).json({ error: 'No encontrada' });
    let img = null;
    if (promo.image) { const r = path.join(__dirname, '..', 'public', promo.image); if (fs.existsSync(r)) img = fs.readFileSync(r).toString('base64'); }
    const prompt = `Revisador CazaPromos. Título "${promo.title}". Descripción "${promo.description||''}". Precio $${promo.priceNormal}-> $${promo.pricePromo}. ${img?'Ves la foto.':''} Verifica: comida real que coincida, sin insultos, precio promo menor, ortografía. Responde SOLO JSON {"apto":true/false,"razones":["..."]}`;
    const txt = await llamarIA(prompt, img);
    let v; try { v = JSON.parse(txt); } catch (e) { v = { apto: null, razones: [txt] }; }
    promo.aiVerdict = v; await promo.save();
    res.json({ verdict: v });
  } catch (err) { next(err); }
});

router.post('/suggest', auth, async (req, res, next) => {
  try {
    const { title, description, category, foto } = req.body;
    const prompt = `Asistente de CazaPromos. Categorías VÁLIDAS (solo estas): ${CATS.join(', ')}.
Datos del plato: Título "${title||''}". Descripción "${description||''}". Categoría actual "${category||''}". ${foto?'Ves la foto.':''}
Tareas:
1) Si el título tiene error de ortografía, sugiere el correcto (tituloSugerido).
2) Recomienda la MEJOR categoría de la lista VÁLIDA para este plato. Si el plato NO encaja en ninguna categoría específica (ej: salchipapa, comida mixta), recomienda "otros" y en categoriaMsg explica en UNA frase corta: "No hay categoría específica para este plato, por eso va en Otros para no confundir al cliente."
3) Si hay foto, di si corresponde al plato (fotoOk / fotoMsg).
Responde SOLO JSON: {"tituloSugerido":"... o null","categoriaSugerida":"... o null","categoriaMsg":"... o null","fotoOk":true/false,"fotoMsg":"..."}`;
    const txt = await llamarIA(prompt, foto || null);
    let v; try { v = JSON.parse(txt); } catch (e) { v = { tituloSugerido: null, categoriaSugerida: null, categoriaMsg: null, fotoOk: null, fotoMsg: txt }; }
    res.json(v);
  } catch (err) { next(err); }
});

module.exports = router;