const jwt = require('jsonwebtoken');
module.exports = function (req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Sin token' });
  try { req.user = jwt.verify(token, process.env.JWT_SECRET); next(); }
  catch (e) { return res.status(401).json({ error: 'Token inválido' }); }
};