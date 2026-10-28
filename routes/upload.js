const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const DIR = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(DIR)) fs.mkdirSync(DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, f, cb) => cb(null, DIR),
  filename: (req, f, cb) => cb(null, Date.now() + '-raw-' + f.originalname.replace(/\s+/g, '_'))
});
const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, f, cb) => f.mimetype.startsWith('image/') ? cb(null, true) : cb(new Error('Solo imágenes'))
});

router.post('/', (req, res) => {
  upload.single('foto')(req, res, async err => {
    if (err) { console.error('UPLOAD multer:', err.message); return res.status(400).json({ error: 'Archivo inválido: ' + err.message }); }
    if (!req.file) return res.status(400).json({ error: 'Sin archivo' });
    const raw = req.file.path;
    const nombre = path.basename(raw).replace('-raw-', '-').replace(/\.\w+$/, '') + '.jpg';
    const out = path.join(DIR, nombre);
    try {
      await sharp(raw).rotate().resize(900, 900, { fit: 'inside' }).jpeg({ quality: 72 }).toFile(out);
      try { fs.unlinkSync(raw); } catch (e) {}
      return res.json({ url: '/uploads/' + nombre });
    } catch (e1) {
      // Si Sharp falla por cualquier razón, guardamos tu foto ORIGINAL sin bloquearte
      console.error('UPLOAD sharp falló, guardando original:', e1.message);
      try {
        const keep = path.basename(raw).replace('-raw-', '-');
        const outKeep = path.join(DIR, keep);
        fs.renameSync(raw, outKeep);
        return res.json({ url: '/uploads/' + keep });
      } catch (e2) {
        console.error('UPLOAD fallback falló:', e2.message);
        return res.status(500).json({ error: 'No se pudo guardar la foto' });
      }
    }
  });
});

module.exports = router;