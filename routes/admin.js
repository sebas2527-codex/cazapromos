const router=require('express').Router();
const bcrypt=require('bcryptjs');
const Promo=require('../models/Promo');
const Restaurant=require('../models/Restaurant');
const Audit=require('../models/Audit');
const auth=require('../middleware/auth');
const {enviarA}=require('../whatsappService');

router.use(auth,(req,res,next)=>{ if(req.user.role!=='admin') return res.status(403).json({error:'Solo admin'}); next(); });

function log(accion,detalle,admin){ Audit.create({accion,detalle,admin}).catch(()=>{}); }

router.get('/audit',async(req,res,next)=>{ try{ res.json({audits:await Audit.find().sort({createdAt:-1}).limit(50)}); }catch(err){next(err);} });

router.get('/pending',async(req,res,next)=>{ try{ res.json({promos:await Promo.find({status:'pending'}).sort({createdAt:-1}).populate('restaurant','name')}); }catch(err){next(err);} });

router.put('/promo/:id',async(req,res,next)=>{
  try{
    const {status,rejectReason}=req.body;
    if(!['approved','rejected','pending'].includes(status)) return res.status(400).json({error:'Status inválido'});
    const promo=await Promo.findById(req.params.id).populate('restaurant','name whatsapp');
    if(!promo) return res.status(404).json({error:'No encontrada'});
    const motivo=rejectReason||'Revisa tu promo';
    promo.status=status;
    promo.rejectReason=status==='rejected'?motivo:'';
    await promo.save();
    log(status==='approved'?'APROBÓ':status==='rejected'?'RECHAZÓ':'BAJÓ',`Promo "${promo.title}"`,req.user.id);
    if(status==='rejected'&&promo.restaurant?.whatsapp) enviarA(promo.restaurant.whatsapp,`❌ CazaPromos: tu promo "${promo.title}" fue rechazada. Motivo: ${motivo}. Corrígela y reenvíala.`);
    if(status==='approved'&&promo.restaurant?.whatsapp) enviarA(promo.restaurant.whatsapp,`✅ CazaPromos: tu promo "${promo.title}" fue APROBADA y ya está publicada!`);
    res.json({promo});
  }catch(err){next(err);}
});

router.get('/restaurants',async(req,res,next)=>{ try{ res.json({restaurants:await Restaurant.find().select('name email whatsapp city paid sector banned verified cedula ruc instagram direccion').sort({createdAt:-1})}); }catch(err){next(err);} });

router.put('/restaurant/:id',async(req,res,next)=>{
  try{
    const {paid,newPassword,banned,verified}=req.body;
    const r=await Restaurant.findById(req.params.id);
    if(!r) return res.status(404).json({error:'No encontrado'});
    if(newPassword){ r.passwordHash=await bcrypt.hash(newPassword,12); log('RESET CLAVE',`Local ${r.name}`,req.user.id); }
    if(banned!==undefined){ r.banned=!!banned; log(banned?'BANEÓ':'DESBANEÓ',`Local ${r.name}`,req.user.id); }
    if(verified!==undefined){ r.verified=!!verified; log(verified?'VERIFICÓ':'QUITÓ ✔',`Local ${r.name}`,req.user.id); }
    if(paid!==undefined){
      r.paid=!!paid;
      if(paid&&r.planDias) r.planExpiresAt=new Date(Date.now()+r.planDias*86400000);
      if(!paid) r.planExpiresAt=null;
      log(paid?'MARCÓ PAGADO':'MARCÓ NO PAGADO',`Local ${r.name}`,req.user.id);
    }
    await r.save(); res.json({restaurant:r});
  }catch(err){next(err);}
});

module.exports=router;