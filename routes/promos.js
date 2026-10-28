const router = require('express').Router();
const fs = require('fs'); const path = require('path');
const { body, validationResult } = require('express-validator');
const Promo = require('../models/Promo');
const Restaurant = require('../models/Restaurant');
const auth = require('../middleware/auth');
const { aplicarMarco } = require('../utils/marco');
const { iniciar, enviarWhatsapp } = require('../whatsappService');
iniciar();

const POP = 'name lat lng sector verified fundador horarioAtencion';

async function avisarWhatsApp(t){ const tok=process.env.WHATSAPP_TOKEN,ph=process.env.WHATSAPP_PHONE_ID; if(!tok||!ph)return; try{ await fetch(`https://graph.facebook.com/v19.0/${ph}/messages`,{method:'POST',headers:{Authorization:'Bearer '+tok,'Content-Type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',to:'593998537802',type:'text',text:{body:t}})});}catch(e){} }
async function avisarTelegram(t){ const tok=process.env.TELEGRAM_TOKEN,ch=process.env.TELEGRAM_CHAT_ID; if(!tok||!ch)return; try{ await fetch(`https://api.telegram.org/bot${tok}/sendMessage`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({chat_id:ch,text:t})});}catch(e){} }

async function revisionIA(promo){
  try{
    let img=null;
    if(promo.image){ const r=path.join(__dirname,'..','public',promo.image); if(fs.existsSync(r)) img=fs.readFileSync(r).toString('base64'); }
    const prompt=`Revisador JAMA. Tipo "${promo.tipo}". Título "${promo.title}". Descripción "${promo.description||''}". Precio $${promo.priceNormal}-> $${promo.pricePromo}. ${img?'Ves la foto.':''} Verifica: comida real que coincida, sin insultos, precio promo menor o igual si es plato, ortografía. Responde SOLO JSON {"apto":true/false,"razones":["..."],"correcciones":{"title":"...","description":"..."}}`;
    if(process.env.GROQ_API_KEY){
      const content=[{type:'text',text:prompt}];
      if(img) content.push({type:'image_url',image_url:{url:`data:image/jpeg;base64,${img}`}});
      const r=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{Authorization:'Bearer '+process.env.GROQ_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({model:process.env.GROQ_MODEL||'qwen/qwen3.8-27b',messages:[{role:'user',content}],max_tokens:300})});
      const d=await r.json();
      const txt=(d.choices?.[0]?.message?.content||'').replace(/```json|```/g,'');
      try{ return JSON.parse(txt); }catch(e){ return {apto:null,razones:[txt]}; }
    }
    const r=await fetch('http://localhost:11434/api/generate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({model:'qwen2.5vl:7b',prompt,images:img?[img]:undefined,stream:false})});
    const d=await r.json();
    try{ return JSON.parse(d.response); }catch(e){ return {apto:null,razones:[d.response]}; }
  }catch(e){ return null; }
}

const GROSERIAS=['tonto','tonta','chepa','qk','ano','cum','pija','zorra','zorro','pene','verga','culo','mierda','carajo','puta','puto','marico','semen','chucha','concha','huevon','malparido','gonorrea','asqueroso','hijueputa','guevon','boludo','imbecil','idiota','pendejo','cabron','mamahuevo','conchademadre','carechimba','pirobo','pajero','mamon','lameculos','culero','ahuevado','estupido','cara de verga','caradeverga','putamadre','puta madre'];
const RE_GROSERIAS=new RegExp('\\b('+GROSERIAS.join('|')+')\\b','i');

function conEstado(p){
  const promo=p.toObject?p.toObject():p;
  const [oh,om]=String(promo.openTime||'00:00').split(':').map(Number);
  const [ch,cm]=String(promo.closeTime||'23:59').split(':').map(Number);
  const mins=new Date().getHours()*60+new Date().getMinutes();
  promo.openNow=mins>=oh*60+om&&mins<=ch*60+cm;
  return promo;
}

router.get('/cities', async (req,res,next)=>{ try{ const cs=await Restaurant.distinct('city'); res.json({cities:(cs||[]).filter(Boolean).sort()}); }catch(err){next(err);} });

router.get('/', async (req,res,next)=>{
  try{
    if(req.query.preview){ const one=await Promo.findById(req.query.preview).populate('restaurant',POP); return res.json({promos:one?[conEstado(one)]:[]}); }
    const now=new Date();
    const baneados=(await Restaurant.find({banned:true}).select('_id')).map(r=>r._id);
    const filter={ active:true, validFrom:{$lte:now}, days:now.getDay(), restaurant:{$nin:baneados},
      $and:[{$or:[{validUntil:null},{validUntil:{$gte:now}}]},{ $or:[{status:'approved'},{status:{$exists:false}}]}]};
    if(req.query.city) filter.city=req.query.city.toLowerCase();
    const promos=await Promo.find(filter).sort({createdAt:-1}).limit(100).populate('restaurant',POP);
    res.json({promos:promos.map(conEstado)});
  }catch(err){next(err);}
});

router.get('/mine', auth, async (req,res,next)=>{ try{ res.json({promos:await Promo.find({restaurant:req.user.id}).sort({createdAt:-1})}); }catch(err){next(err);} });

router.post('/', auth, body('title').trim().isLength({min:3}), body('priceNormal').isNumeric(), body('pricePromo').isNumeric(), body('whatsapp').trim().isLength({min:8}), body('city').trim().isLength({min:2}),
  async (req,res,next)=>{
    try{
      const errors=validationResult(req); if(!errors.isEmpty()) return res.status(400).json({errors:errors.array()});
      const texto=((req.body.title||'')+' '+(req.body.description||'')).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
      if(RE_GROSERIAS.test(texto)) return res.status(400).json({error:'Revisa el lenguaje de tu publicación 😉'});
      const {title,description,category,tipo,motivo,priceNormal,pricePromo,image,whatsapp,city,weekendsOnly,validFrom,validUntil,openTime,closeTime,days}=req.body;
      const pn=Math.max(0,Number(priceNormal)), pp=Math.max(0,Number(pricePromo));
      if(tipo!=='plato' && pp>=pn) return res.status(400).json({error:'El precio promo debe ser MENOR al normal 😉'});
      const promo=await Promo.create({restaurant:req.user.id,tipo:tipo||'promo',title,description,category:category||'otros',motivo:motivo||'',priceNormal:pn,pricePromo:pp,image,whatsapp,city,weekendsOnly,validFrom,validUntil,openTime,closeTime,days});
      if(promo.image){ try{ const d=Math.round((1-promo.pricePromo/promo.priceNormal)*100); if(d>0){ const nueva=await aplicarMarco(promo.image,d); if(nueva!==promo.image) promo.image=nueva; } }catch(e){} }
      promo.aiVerdict=await revisionIA(promo); await promo.save();
      const dueno=await Restaurant.findById(req.user.id).select('name');
      const aviso=`🆕 JAMA: nueva publicación pendiente "${promo.title}" (${promo.tipo}) de ${dueno?dueno.name:'un local'}. Revisa tu panel.`;
      avisarWhatsApp(aviso); avisarTelegram(aviso); enviarWhatsapp(aviso);
      res.status(201).json({promo});
    }catch(err){next(err);}
  });

router.put('/:id', auth, async (req,res,next)=>{
  try{
    const promo=await Promo.findById(req.params.id); if(!promo) return res.status(404).json({error:'No encontrada'});
    if(promo.restaurant.toString()!==req.user.id&&req.user.role!=='admin') return res.status(403).json({error:'No autorizado'});
    const fields=['title','description','category','tipo','motivo','priceNormal','pricePromo','image','whatsapp','city','active','weekendsOnly','validFrom','validUntil','openTime','closeTime','days','status'];
    fields.forEach(f=>{ if(req.body[f]!==undefined) promo[f]=req.body[f]; });
    await promo.save();
    if(req.body.status==='pending'){ promo.aiVerdict=await revisionIA(promo); await promo.save(); }
    res.json({promo});
  }catch(err){next(err);}
});

router.delete('/:id', auth, async (req,res,next)=>{
  try{
    const promo=await Promo.findById(req.params.id); if(!promo) return res.status(404).json({error:'No encontrada'});
    if(promo.restaurant.toString()!==req.user.id&&req.user.role!=='admin') return res.status(403).json({error:'No autorizado'});
    await promo.deleteOne(); res.json({ok:true});
  }catch(err){next(err);}
});

module.exports=router;