const router=require('express').Router();
const Promo=require('../models/Promo');
router.post('/', async (req,res)=>{
  try{
    const {promoId,lat,lng,survey}=req.body;
    if(!promoId) return res.status(400).json({error:'promoId'});
    const update={$inc:{clicks:1}};
    if(survey==='si') update.$inc.siCount=1;
    if(survey==='no') update.$inc.noCount=1;
    if(lat!=null&&lng!=null) update.$push={geo:{$each:[{lat,lng}], $slice:-200}};
    await Promo.findByIdAndUpdate(promoId,update);
    res.json({ok:true});
  }catch(e){ res.json({ok:false}); }
});
module.exports=router;