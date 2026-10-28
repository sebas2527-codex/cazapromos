const token=localStorage.getItem('token');
const rest=JSON.parse(localStorage.getItem('restaurante')||'null');
if(!token||!rest||rest.role!=='admin') window.location.href='/restaurante.html';
const H={'Content-Type':'application/json',Authorization:'Bearer '+token};

document.querySelectorAll('.tab').forEach(t=>t.addEventListener('click',()=>{
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('on'));
  document.querySelectorAll('.pane').forEach(x=>x.classList.remove('on'));
  t.classList.add('on');
  document.getElementById('p-'+t.dataset.t).classList.add('on');
  if(t.dataset.t==='ana'&&window.__map) setTimeout(()=>window.__map.invalidateSize(),100);
}));

const modal=document.getElementById('modal');
document.getElementById('cerrar').addEventListener('click',()=>modal.style.display='none');

function tarjeta(p){
  const d=Math.round((1-p.pricePromo/p.priceNormal)*100);
  return`<div class="card"><div class="cover">${p.image?`<img src="${p.image}">`:'<div class="nofoto">🍽️</div>'}<span class="badge">-${d}%</span></div>
    <div class="cuerpo"><h3>${p.title}</h3><div class="rest">🏪 ${p.restaurant?.name||''} · ${p.city} · ${p.category||''}</div>
    <div class="desc">${p.description||''}</div><div class="prices"><span class="old">$${p.priceNormal}</span><span class="new">$${p.pricePromo}</span></div></div></div>`;
}
function modalFoto(u){document.getElementById('modalCaja').innerHTML=`<img src="${u}" style="width:100%;border-radius:12px">`;modal.style.display='block';}
function veredictoIA(p){
  if(!p.aiVerdict) return '';
  const v=p.aiVerdict; const c=v.apto?'#4CAF50':v.apto===false?'#e57373':'#FFC107';
  return`<div style="color:${c};font-size:12px;margin-top:4px">🤖 IA: ${v.apto?'apta':v.apto===false?'NO publicar':'dudosa'} — ${(v.razones||[]).join(' · ')}</div>`;
}
function statsLine(p){ return`<div style="color:#888;font-size:11px;margin-top:3px">🖱️ ${p.clicks||0} clicks · ✅ Sí ${(p.siCount||0)} · 💬 No ${(p.noCount||0)} · 📍 ${(p.geo||[]).length} zonas</div>`; }

let mapa=null;
async function cargar(){
  const dp=await(await fetch('/api/admin/pending',{headers:H})).json();
  const box=document.getElementById('pendientes');
  box.innerHTML=dp.promos.length?dp.promos.map(p=>`
    <div class="item">${p.image?`<img class="mini" src="${p.image}" data-foto="${p.image}">`:''}
      <div class="info"><b>${p.title}</b> · $${p.priceNormal} → $${p.pricePromo}<br><small>${p.restaurant?.name||''} · ${p.city} · ${p.category||'sin categoría'}</small>${veredictoIA(p)}</div>
      <div><button class="ver" data-id="${p._id}">👁</button><button class="ok" data-id="${p._id}" data-st="approved">✅</button><button class="no" data-id="${p._id}" data-st="rejected">❌</button></div>
    </div>`).join(''):'<p>No hay pendientes 🎉</p>';
  box.querySelectorAll('.ok,.no').forEach(b=>b.addEventListener('click',async()=>{
    const body={status:b.dataset.st};
    if(b.dataset.st==='rejected') body.rejectReason=prompt('¿Por qué la rechazas? (le llegará al restaurante)')||'Revisa tu promo';
    await fetch('/api/admin/promo/'+b.dataset.id,{method:'PUT',headers:H,body:JSON.stringify(body)});
    cargar();
  }));
  box.querySelectorAll('.ver').forEach(b=>b.addEventListener('click',()=>{const p=dp.promos.find(x=>x._id===b.dataset.id);document.getElementById('modalCaja').innerHTML=tarjeta(p);modal.style.display='block';}));
  box.querySelectorAll('.mini').forEach(i=>i.addEventListener('click',()=>modalFoto(i.dataset.foto)));

  const da=await(await fetch('/api/promos',{headers:H})).json();
  const pub=document.getElementById('publicadas');
  pub.innerHTML=da.promos.length?da.promos.map(p=>`
    <div class="item">${p.image?`<img class="mini" src="${p.image}" data-foto="${p.image}">`:''}
      <div class="info"><b>${p.title}</b> · $${p.priceNormal} → $${p.pricePromo}<br><small>${p.restaurant?.name||''} · ${p.city} · ${p.category||''}</small>${statsLine(p)}</div>
      <div><button class="ver" data-id="${p._id}">👁</button><button class="gris" data-id="${p._id}">⬇ Bajar</button></div>
    </div>`).join(''):'<p>Nada publicado.</p>';
  pub.querySelectorAll('.gris').forEach(b=>b.addEventListener('click',async()=>{await fetch('/api/admin/promo/'+b.dataset.id,{method:'PUT',headers:H,body:JSON.stringify({status:'pending'})});cargar();}));
  pub.querySelectorAll('.ver').forEach(b=>b.addEventListener('click',()=>{const p=da.promos.find(x=>x._id===b.dataset.id);document.getElementById('modalCaja').innerHTML=tarjeta(p);modal.style.display='block';}));
  pub.querySelectorAll('.mini').forEach(i=>i.addEventListener('click',()=>modalFoto(i.dataset.foto)));

  const dr=await(await fetch('/api/admin/restaurants',{headers:H})).json();
  const loc=document.getElementById('locales');
  loc.innerHTML=dr.restaurants.map(r=>`
    <div class="item"><div class="info"><b>${r.name}</b>${r.banned?'<span style="color:#e57373"> · BANEADO</span>':''}${r.verified?'<span style="color:#4CAF50"> · ✔ Verificado</span>':''}<br><small>${r.email} · ${r.city} · ${r.whatsapp}</small>
    ${r.cedula||r.ruc||r.instagram||r.direccion?`<div style="color:#aaa;font-size:11px;margin-top:4px">${r.cedula?'🆔 CI: '+r.cedula+' · ':''}${r.ruc?'RUC: '+r.ruc+' · ':''}${r.instagram?'IG: '+r.instagram+' · ':''}${r.direccion?'📍 '+r.direccion:''}</div>`:''}</div>
      <div><button class="ver" data-key="${r._id}" data-name="${r.name}">🔑</button>
      <button class="gris" data-ban="${r._id}" data-banned="${r.banned?0:1}">${r.banned?'🔓 Desbanear':'🚫 Banear'}</button>
      <button class="gris" data-ver="${r._id}" data-verified="${r.verified?0:1}">${r.verified?'❌ Quitar ✔':'✔ Verificar'}</button>
      <button class="${r.paid?'ok':'no'}" data-id="${r._id}" data-paid="${r.paid?0:1}">${r.paid?'💰 Pagado':'📴 Sin pagar'}</button></div>
    </div>`).join('');
  loc.querySelectorAll('button[data-key]').forEach(b=>b.addEventListener('click',async()=>{
    const np=prompt('Nueva contraseña para '+b.dataset.name+':');
    if(!np||np.length<8) return alert('Mínimo 8');
    await fetch('/api/admin/restaurant/'+b.dataset.key,{method:'PUT',headers:H,body:JSON.stringify({newPassword:np})});
    alert('Contraseña cambiada.');
  }));
  loc.querySelectorAll('button[data-id]').forEach(b=>b.addEventListener('click',async()=>{await fetch('/api/admin/restaurant/'+b.dataset.id,{method:'PUT',headers:H,body:JSON.stringify({paid:b.dataset.paid==='1'})});cargar();}));
  loc.querySelectorAll('button[data-ban]').forEach(b=>b.addEventListener('click',async()=>{
    const banear=b.dataset.banned==='1';
    if(banear&&!confirm('¿Banear este local? Sus promos dejarán de mostrarse.')) return;
    await fetch('/api/admin/restaurant/'+b.dataset.ban,{method:'PUT',headers:H,body:JSON.stringify({banned:banear})});
    cargar();
  }));
  loc.querySelectorAll('button[data-ver]').forEach(b=>b.addEventListener('click',async()=>{await fetch('/api/admin/restaurant/'+b.dataset.ver,{method:'PUT',headers:H,body:JSON.stringify({verified:b.dataset.verified==='1'})});cargar();}));

  const todas=da.promos;
  const totalClicks=todas.reduce((s,p)=>s+(p.clicks||0),0);
  const totalSi=todas.reduce((s,p)=>s+(p.siCount||0),0);
  const totalNo=todas.reduce((s,p)=>s+(p.noCount||0),0);
  const totalZonas=todas.reduce((s,p)=>s+(p.geo||[]).length,0);
  const top=[...todas].sort((a,b)=>(b.clicks||0)-(a.clicks||0)).slice(0,5);
  document.getElementById('stats').innerHTML=`
    <div class="stat"><b>${totalClicks}</b>Clicks totales</div>
    <div class="stat"><b>${totalSi}</b>✅ Sí compraron</div>
    <div class="stat"><b>${totalNo}</b>💬 Solo preguntaron</div>
    <div class="stat"><b>${totalZonas}</b>Zonas registradas</div>
    <div class="stat"><b>${totalSi+totalNo?Math.round(totalSi/(totalSi+totalNo)*100):0}%</b>Conversión</div>`;
  document.getElementById('listaTop').innerHTML=top.length?`<h2>🏆 Top 5 promos</h2>`+top.map(p=>`<div class="item"><div class="info"><b>${p.title}</b><br><small>${p.restaurant?.name||''} · 🖱️ ${p.clicks||0} · ✅ ${p.siCount||0} · 💬 ${p.noCount||0}</small></div></div>`).join(''):'';

  if(!mapa){ mapa=L.map('mapa').setView([-2.17,-79.92],12); L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OSM'}).addTo(mapa); window.__map=mapa; }
  setTimeout(()=>mapa.invalidateSize(),100);
  mapa.eachLayer(l=>{ if(l instanceof L.CircleMarker) mapa.removeLayer(l); });
  todas.forEach(p=>(p.geo||[]).forEach(g=>{ L.circleMarker([g.lat,g.lng],{radius:7,color:'#FFC107',fillColor:'#FFC107',fillOpacity:0.6}).addTo(mapa).bindPopup(`<b>${p.title}</b><br>${p.restaurant?.name||''}`); }));

  const la=await(await fetch('/api/admin/audit',{headers:H})).json();
  document.getElementById('logList').innerHTML=la.audits.length?la.audits.map(a=>`
    <div class="item"><div class="info"><b>${a.accion}</b> · ${a.detalle}<br><small>${new Date(a.fecha).toLocaleString()}</small></div></div>`).join(''):'<p>Sin actividad aún.</p>';
}
cargar();
setInterval(()=>{ cargar(); }, 8000);