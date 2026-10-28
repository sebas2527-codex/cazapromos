const token=localStorage.getItem('token');
const rest0=JSON.parse(localStorage.getItem('restaurante')||'null');
if(!token||!rest0) window.location.href='/restaurante.html';
document.getElementById('hola').textContent='Hola, '+(rest0.name||'');
const BANCO={banco:'Banco Pichincha',tipo:'Cuenta de ahorro transaccional',numero:'2213801186',nombre:'Daniel Sebastian Campuzano Felix',cedula:'0958566598'};
const MI_WHATS='593998537802';
const PLANES=[{id:'1sem_sin',nombre:'1 semana (Lu–Vi)',precio:4},{id:'1sem_con',nombre:'1 semana con finde',precio:6},{id:'2sem_sin',nombre:'2 semanas (Lu–Vi)',precio:8},{id:'2sem_con',nombre:'2 semanas con finde',precio:12},{id:'3sem_sin',nombre:'3 semanas (Lu–Vi)',precio:14},{id:'3sem_con',nombre:'3 semanas con finde',precio:17},{id:'mes_sin',nombre:'1 mes (Lu–Vi)',precio:18},{id:'mes_con',nombre:'1 mes con finde',precio:23}];
const MESES=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
const DIALBL=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
let editandoId=null,me=null,planIdx=2,modoCustom=false,viendoSelector=false,hoyOk=true,fotoB64=null,iaTimer=null;
let selDates=new Set(),calOffset=0;

function precioFechas(a){return +a.reduce((s,d)=>{const g=new Date(d+'T12:00:00').getDay();return s+(g===0||g===6?2.4:4);},0).toFixed(2);}
function nombrePlan(id){const p=PLANES.find(x=>x.id===id);return p?p.nombre:(id==='custom'?'Días sueltos':id);}
function fkey(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function fechasBonitas(a){if(!a||!a.length)return'';return a.map(f=>{const d=new Date(f+'T12:00:00');return`${DIALBL[d.getDay()]}(${d.getDate()})`;}).join(' / ');}

function injectSched(){
  if(document.getElementById('schedBox'))return;
  const div=document.createElement('div');div.id='schedBox';
  div.innerHTML=`
    <label>¿Cuándo empieza?</label>
    <select id="schStart"><option value="ahora">Ahora mismo</option><option value="prog">Programar fecha/hora</option></select>
    <input type="datetime-local" id="vFrom" style="display:none;margin-top:6px">
    <label>¿Cuánto dura?</label>
    <select id="schDur"><option value="plan">Hasta el fin de mi plan</option><option value="custom">Hasta una fecha/hora que elija</option></select>
    <input type="datetime-local" id="vUntil" style="display:none;margin-top:6px">
    <label>Horario por día</label>
    <select id="schHours"><option value="24">Todo el día (24 h)</option><option value="range">Solo ciertas horas</option></select>
    <p id="horasHelp" style="color:#aaa;font-size:12px;margin-top:6px">La promo se mostrará las 24 h de cada día activo.</p>`;
  const form=document.getElementById('form');
  form.insertBefore(div, document.getElementById('btnCrear'));
  const horasRow=document.getElementById('horasRow');
  const help=document.getElementById('horasHelp');
  const sync=()=>{
    const range=document.getElementById('schHours').value==='range';
    horasRow.style.display=range?'flex':'none';
    help.textContent=range?`La promo se mostrará cada día activo de ${document.getElementById('abre').value} a ${document.getElementById('cierra').value}.`:'La promo se mostrará las 24 h de cada día activo.';
  };
  document.getElementById('schStart').onchange=e=>document.getElementById('vFrom').style.display=e.target.value==='prog'?'block':'none';
  document.getElementById('schDur').onchange=e=>document.getElementById('vUntil').style.display=e.target.value==='custom'?'block':'none';
  document.getElementById('schHours').onchange=sync;
  document.getElementById('abre').onchange=sync;
  document.getElementById('cierra').onchange=sync;
  sync();
}

function renderCal(caja){
  const hoy=new Date();const max=new Date();max.setDate(max.getDate()+31);
  const y=hoy.getFullYear(),m=hoy.getMonth()+calOffset;
  const first=new Date(y,m,1).getDay(),dim=new Date(y,m+1,0).getDate();
  let html=`<div style="display:flex;justify-content:space-between;align-items:center;margin:6px 0"><button id="calPrev" style="width:auto;background:#333;color:#fff"${calOffset===0?' disabled':''}>◀</button><b style="color:#eee">${MESES[m]} ${y}</b><button id="calNext" style="width:auto;background:#333;color:#fff"${calOffset>=1?' disabled':''}>▶</button></div><div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px">${['Do','Lu','Ma','Mi','Ju','Vi','Sá'].map(d=>`<span style="color:#888;font-size:11px;text-align:center">${d}</span>`).join('')}`;
  for(let i=0;i<first;i++)html+='<span></span>';
  for(let d=1;d<=dim;d++){
    const date=new Date(y,m,d);const key=fkey(date);
    const disabled=date<new Date(hoy.toDateString())||date>max;
    const on=selDates.has(key);
    html+=`<button type="button" class="caldia" data-d="${key}"${disabled?' disabled':''} style="padding:10px 0;border-radius:8px;border:none;cursor:${disabled?'not-allowed':'pointer'};opacity:${disabled&&!on?'.35':'1'};background:${on?'#0E9BA4':'#26262c'};color:${on?'#fff':'#eee'};font-weight:${on?'900':'400'}">${d}</button>`;
  }
  html+='</div>';
  const cont=caja.querySelector('#calBox');if(cont)cont.innerHTML=html;
  caja.querySelector('#calPrev').onclick=()=>{calOffset=0;renderCal(caja);};
  caja.querySelector('#calNext').onclick=()=>{calOffset=1;renderCal(caja);};
  caja.querySelectorAll('.caldia').forEach(b=>b.onclick=()=>{if(b.disabled)return;const k=b.dataset.d;selDates.has(k)?selDates.delete(k):selDates.add(k);renderCal(caja);actualizarPrecio();});
}

async function planBox(){
  me=(await(await fetch('/api/auth/me',{headers:{Authorization:'Bearer '+token}})).json()).restaurant;
  const caja=document.getElementById('cajaPlan');
  if(me.role==='admin'){caja.innerHTML='<h2>🕵️ Modo jefe</h2><p style="color:#aaa">Tú no pagas plan.</p>';hoyOk=true;return true;}
  const activa=me.paid&&me.planExpiresAt&&new Date(me.planExpiresAt)>new Date();
  if(activa&&!viendoSelector){
    hoyOk=true;
    if(me.plan==='custom'&&me.fechasCustom&&me.fechasCustom.length){hoyOk=me.fechasCustom.includes(fkey(new Date()));}
    const detalle=(me.plan==='custom'&&me.fechasCustom&&me.fechasCustom.length)?`<p style="color:#aaa;font-size:13px;margin-top:6px">📅 Días activos: <b style="color:#eee">${fechasBonitas(me.fechasCustom)}</b></p>`:'';
    caja.innerHTML=`<h2>💳 Tu plan</h2><p style="color:#4CAF50">✅ ${nombrePlan(me.plan)} — activo hasta el ${new Date(me.planExpiresAt).toLocaleDateString()}</p>${detalle}${!hoyOk?'<p style="color:#FFC107;font-size:13px">⚠️ Hoy no es tu día activo.</p>':''}<button id="btnCambiarAct" style="background:#333;color:#ccc">↩ Cambiar de plan</button>`;
    document.getElementById('btnCambiarAct').onclick=()=>{viendoSelector=true;planBox();};
    return hoyOk;
  }
  if(me.freeUsed&&me.plan&&!me.paid&&!viendoSelector){
    const txt=`Hola CazaPromos! Soy ${me.name}. Acabo de transferir $${me.planPrecio} por mi plan. Adjunto recibo.`;
    caja.innerHTML=`<h2>💳 Tu plan</h2><p style="color:#FFC107">⏳ ${nombrePlan(me.plan)} — $${me.planPrecio}. Transfiere y manda recibo:</p><p style="color:#aaa;margin-top:8px"><b>${BANCO.banco}</b> · ${BANCO.tipo}<br>N° <b style="color:#4CAF50">${BANCO.numero}</b><br>${BANCO.nombre} · CI ${BANCO.cedula}</p><button id="btnCopiar" style="background:#555;color:#fff">📋 Copiar datos</button><button id="btnRecibo" style="background:#25D366;color:#fff">📲 Ya transferí, mandar recibo</button><button id="btnCambiar" style="background:#333;color:#ccc">↩ Cambiar de plan</button>`;
    document.getElementById('btnCopiar').onclick=()=>{navigator.clipboard.writeText(`${BANCO.banco} ${BANCO.tipo} N° ${BANCO.numero} ${BANCO.nombre} CI ${BANCO.cedula}`);document.getElementById('btnCopiar').textContent='✅ Copiado!';};
    document.getElementById('btnRecibo').onclick=()=>window.open(`https://wa.me/${MI_WHATS}?text=${encodeURIComponent(txt)}`,'_blank');
    document.getElementById('btnCambiar').onclick=()=>{viendoSelector=true;refresh();};
    return false;
  }
  const p=PLANES[planIdx];
  caja.innerHTML=`<h2>💳 Elige tu plan</h2>${!me.freeUsed?'<p style="color:#4CAF50;text-align:center">🎁 ¡Local nuevo! Tu PRIMER plan es GRATIS.</p>':''}
    <div style="display:flex;align-items:center;gap:10px;justify-content:center;margin:10px 0"><button id="fPrev" style="width:auto;background:#333;color:#fff">◀</button><div style="flex:1;text-align:center"><b style="color:#eee">${modoCustom?'Días sueltos':p.nombre}</b><br><span id="precioVista"></span></div><button id="fNext" style="width:auto;background:#333;color:#fff">▶</button></div>
    <label style="color:#eee;display:block;text-align:center"><input type="checkbox" id="chkCustom"${modoCustom?' checked':''}> Armar mis días sueltos ($4 semana / $2.40 finde)</label>
    <div id="calBox" style="display:${modoCustom?'block':'none'};margin:8px 0"></div>
    <button id="btnPlan">${me.freeUsed?'Elegir este plan 💳':'🎁 Activar plan GRATIS (primera vez)'}</button>`;
  const actualizarPrecio=()=>{
    const base=modoCustom?precioFechas([...selDates]):p.precio;
    document.getElementById('precioVista').innerHTML=me.freeUsed?`<span style="color:#4CAF50;font-size:22px;font-weight:900">$${base}</span>`:`<span style="color:#999;text-decoration:line-through;font-size:16px">$${base}</span> <span style="color:#4CAF50;font-size:20px;font-weight:900">$0 🎁</span> <small style="color:#999">primera vez</small>`;
  };
  document.getElementById('fPrev').onclick=()=>{planIdx=(planIdx-1+PLANES.length)%PLANES.length;planBox();};
  document.getElementById('fNext').onclick=()=>{planIdx=(planIdx+1)%PLANES.length;planBox();};
  document.getElementById('chkCustom').onchange=e=>{modoCustom=e.target.checked;planBox();};
  if(modoCustom)renderCal(caja);
  actualizarPrecio();
  document.getElementById('btnPlan').onclick=async()=>{
    let body;
    if(modoCustom){
      if(!selDates.size)return alert('Toca días en el calendario');
      const fechas=[...selDates].sort();
      body={plan:'custom',diasCustom:[...new Set(fechas.map(d=>new Date(d+'T12:00:00').getDay()))],fechasCustom:fechas};
    } else body={plan:PLANES[planIdx].id};
    if(!me.freeUsed)body.free=true;
    await fetch('/api/auth/plan',{method:'PUT',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(body)});
    viendoSelector=false;refresh();
  };
  return false;
}

function limpiarForm(){editandoId=null;['title','desc','pn','pp'].forEach(id=>document.getElementById(id).value='');document.getElementById('foto').value='';fotoB64=null;['hintTitle','hintDesc','hintCat','hintFoto'].forEach(id=>{const e=document.getElementById(id);e.textContent='';e.className='hint';});document.getElementById('btnCrear').textContent='Enviar a revisión 📨';document.getElementById('msg').textContent='';validar();window.scrollTo(0,0);}
function camposVacios(){const v=[];if(!document.getElementById('title').value.trim())v.push('Título');if(!document.getElementById('pn').value)v.push('Precio normal');if(!document.getElementById('pp').value)v.push('Precio promo');if(!document.getElementById('foto').files[0]&&!editandoId)v.push('Imagen del plato');return v;}
function validar(){
  const vac=camposVacios();const btn=document.getElementById('btnCrear');
  if(vac.length){btn.disabled=true;btn.textContent='🔒 Completa: '+vac.join(', ');}
  else if(!hoyOk){btn.disabled=true;btn.textContent='⚠️ Hoy no es tu día activo';}
  else{btn.disabled=false;btn.textContent=editandoId?'Guardar cambios y reenviar ✏️':'Enviar a revisión 📨';}
}
['title','desc','pn','pp'].forEach(id=>document.getElementById(id).addEventListener('input',()=>{validar();pedirSugerencia();}));
document.getElementById('cat').addEventListener('change',()=>{validar();pedirSugerencia();});
document.getElementById('foto').addEventListener('change',e=>{const f=e.target.files[0];if(f){const r=new FileReader();r.onload=()=>{fotoB64=String(r.result).split(',')[1];pedirSugerencia();};r.readAsDataURL(f);}validar();});
function setHint(id,t,c){const e=document.getElementById(id);e.textContent=t||'';e.className='hint '+(c||'');}
function pedirSugerencia(){
  clearTimeout(iaTimer);
  iaTimer=setTimeout(async()=>{
    const title=document.getElementById('title').value,desc=document.getElementById('desc').value,cat=document.getElementById('cat').value;
    if(!title&&!desc&&!fotoB64)return;
    try{
      const r=await fetch('/api/ai/suggest',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({title,description:desc,category:cat,foto:fotoB64})});
      const v=await r.json();
      if(v.tituloSugerido)setHint('hintTitle',`✏️ ¿Quisiste decir "${v.tituloSugerido}"?`,'warn');else setHint('hintTitle','','');
      if(v.categoriaSugerida&&v.categoriaSugerida!==cat){
        setHint('hintCat',`💡 Va mejor en "${v.categoriaSugerida}".${v.categoriaMsg?' '+v.categoriaMsg:''}`, 'warn');
      } else setHint('hintCat','','');
      if(v.fotoOk===true)setHint('hintFoto','📸 Foto aprobada ✅','ok');
      else if(v.fotoOk===false)setHint('hintFoto','📸 '+(v.fotoMsg||'La foto no va con tu plato.'),'err');
      else setHint('hintFoto','','');
    }catch(e){}
  },1200);
}
function etiqueta(p){
  if(p.status==='pending')return'<span class="st-pending">⏳ Pendiente</span>';
  if(p.status==='rejected')return`<span class="st-rejected">❌ Rechazada</span><br><small style="color:#e57373">Motivo: ${p.rejectReason||'Revisa tu promo'}</small>`;
  return'<span class="st-approved">✅ Publicada</span>';
}
async function mias(){
  if(editandoId)return;
  const res=await fetch('/api/promos/mine',{headers:{Authorization:'Bearer '+token}});
  const data=await res.json();
  const lista=document.getElementById('lista');
  if(!data.promos.length){lista.innerHTML='<p>Aún no tienes promos.</p>';return;}
  lista.innerHTML=data.promos.map(p=>`<div class="item"><div><b>${p.title}</b> · $${p.priceNormal} → $${p.pricePromo}<br>${etiqueta(p)}</div>
    <div style="display:flex;gap:6px;flex-direction:column">
      ${p.status==='approved'?`<a class="verCliente" data-id="${p._id}" style="background:#2196F3;color:#fff;padding:8px 12px;border-radius:6px;text-decoration:none;text-align:center">👁 Ver como cliente</a>`:''}
      ${p.status==='rejected'?`<button data-id="${p._id}" style="width:auto">✏️ Corregir</button>`:''}
    </div></div>`).join('');
  lista.querySelectorAll('button[data-id]').forEach(b=>b.addEventListener('click',()=>{const p=data.promos.find(x=>x._id===b.dataset.id);editandoId=p._id;document.getElementById('title').value=p.title;document.getElementById('desc').value=p.description||'';document.getElementById('pn').value=p.priceNormal;document.getElementById('pp').value=p.pricePromo;document.getElementById('btnCrear').textContent='Guardar cambios y reenviar ✏️';validar();window.scrollTo(0,0);}));
  lista.querySelectorAll('.verCliente').forEach(a=>a.addEventListener('click',()=>{window.open('/promos.html?preview='+a.dataset.id,'_blank');}));
}
async function cupones(){
  const st=await(await fetch('/api/coupons/stats',{headers:{Authorization:'Bearer '+token}})).json();
  const s=st.stats||{};const usadas=(s.vendido||0)+(s.comprado||0);
  document.getElementById('cupStats').innerHTML=`🎉 <b>${usadas}</b> ventas concretadas · ⏳ ${s.generado||0} consultas en curso`;
  const lr=await(await fetch('/api/coupons/list',{headers:{Authorization:'Bearer '+token}})).json();
  const pendientes=(lr.coupons||[]).filter(c=>c.status==='generado');
  const box=document.getElementById('leadsList');
  box.innerHTML=pendientes.length?pendientes.map(c=>`
    <div class="lead"><b>${c.title||'Promo'}</b> · código <b>${c.code}</b><small>¿Hubo compra o el cliente solo pidió información?</small>
      <div class="btns"><button data-id="${c.id}" data-r="compra" style="background:#22A06B">✅ Hubo compra</button><button data-id="${c.id}" data-r="info" style="background:#555">💬 Solo información</button></div>
    </div>`).join(''):'<p style="color:#888;font-size:13px">Aún no hay consultas de clientes.</p>';
  box.querySelectorAll('button[data-id]').forEach(b=>b.addEventListener('click',async()=>{
    await fetch(`/api/coupons/${b.dataset.id}/mark`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({result:b.dataset.r})});
    cupones();
  }));
}
document.getElementById('btnRedimir').addEventListener('click',async()=>{
  const code=document.getElementById('cupCode').value.trim();
  const msg=document.getElementById('cupMsg');
  if(!code)return msg.textContent='Escribe el código.';
  const r=await fetch('/api/coupons/redeem',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({code})});
  const d=await r.json();
  if(!r.ok)return msg.textContent=d.error||'Código no válido.';
  msg.textContent=`✅ Marcado como vendido: ${d.title||''}`;
  document.getElementById('cupCode').value='';cupones();
});
document.getElementById('btnCrear').addEventListener('click',async()=>{
  const msg=document.getElementById('msg');msg.textContent='Enviando...';
  const file=document.getElementById('foto').files[0];let url='';
  if(file){const fd=new FormData();fd.append('foto',file);const up=await fetch('/api/upload',{method:'POST',headers:{Authorization:'Bearer '+token},body:fd});if(!up.ok){msg.textContent='Error al subir la foto';return;}url=(await up.json()).url;}
  const cuerpo={title:document.getElementById('title').value,description:document.getElementById('desc').value,category:document.getElementById('cat').value,priceNormal:Math.max(0,Number(document.getElementById('pn').value)||0),pricePromo:Math.max(0,Number(document.getElementById('pp').value)||0),whatsapp:rest0.whatsapp,city:rest0.city};
  const schStart=document.getElementById('schStart').value;
  const schDur=document.getElementById('schDur').value;
  const schHours=document.getElementById('schHours').value;
  if(schStart==='prog'&&document.getElementById('vFrom').value)cuerpo.validFrom=new Date(document.getElementById('vFrom').value).toISOString();
  if(schDur==='custom'&&document.getElementById('vUntil').value)cuerpo.validUntil=new Date(document.getElementById('vUntil').value).toISOString();
  else if(me&&me.planExpiresAt)cuerpo.validUntil=new Date(me.planExpiresAt).toISOString();
  if(schHours==='24'){cuerpo.openTime='00:00';cuerpo.closeTime='23:59';}
  else{cuerpo.openTime=document.getElementById('abre').value;cuerpo.closeTime=document.getElementById('cierra').value;}
  if(url)cuerpo.image=url;
  let res;
  if(editandoId){cuerpo.status='pending';res=await fetch('/api/promos/'+editandoId,{method:'PUT',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(cuerpo)});}
  else res=await fetch('/api/promos',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(cuerpo)});
  if(!res.ok){const e=await res.json().catch(()=>({}));msg.textContent=e.error||'No se pudo enviar, intenta de nuevo';return;}
  msg.textContent=editandoId?'✅ Corregida y reenviada':'✅ Promo en revisión';
  limpiarForm();mias();
});
async function refresh(){injectSched();const ok=await planBox();document.getElementById('btnCrear').disabled=!ok;document.getElementById('notaPlan').style.display=ok?'none':'block';validar();mias();cupones();}
refresh();
setInterval(()=>{mias();cupones();},8000);