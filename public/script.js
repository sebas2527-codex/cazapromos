let promosCache=[], catActiva='todas', userPos=null, modoGPS=false, ticker=null, repintar=null, ciudadSel='guayaquil';

const EMOJIS={hamburguesas:'🍔',pizza:'🍕',alitas:'🍗',platos_fuertes:'🍛',sopas:'',sushi:'🍣',fideos:'🍝',mariscos:'🦐',postres:'🍰',bebidas:'🥤',otros:'🍽️'};
const CATS=['hamburguesas','pizza','alitas','platos_fuertes','sopas','sushi','fideos','mariscos','postres','bebidas','otros'];

const PAISES = ['EC', 'CO', 'MX', 'PE', 'AR', 'CL', 'US', 'ES', 'UY', 'BO', 'VE', 'BR', 'PY', 'CA', 'PT', 'FR', 'IT', 'DE', 'GB', 'CR', 'PA', 'DO', 'GT', 'HN', 'SV', 'NI'];

function getFlag(code) {
  try {
    return String.fromCodePoint(...[...code.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65));
  } catch (e) {
    return '🌎';
  }
}

const I18N={
  es:{search:'🔍 Busca locales, combos y platos',geo:'📍 Promos a menos de 9 km de ti',contact:'¿Contactar a',code:'🎟️ Tu código',show:'Muéstralo en el local para usar tu promo.',visit:'️ Si el local no responde, ¡no dudes en visitarlo! Revisa si está abierto, presenta tu código y mira su ubicación en el mapa. 🗺️',openwa:'Abrir WhatsApp 📲',yes:'Sí, continuar',cancel:'Cancelar',bought:'¿Concretaste la compra?',yesb:'Sí, compré',nob:'No',empty:c=>`Aún no llegamos con nuestras promos hasta ${c}. 🏹<br>¡Comparte la app y enséñasela al restaurante que te gustaría tener aquí!`},
  en:{search:'🔍 Search places, combos and dishes',geo:'📍 Promos within 9 km of you',contact:'Contact',code:'🎟️ Your code',show:'Show it at the place to use your promo.',visit:'️ If the place doesn\'t reply, visit them! Check if open, show your code and see their location on the map. 🗺️',openwa:'Open WhatsApp 📲',yes:'Yes, continue',cancel:'Cancel',bought:'Did you complete the purchase?',yesb:'Yes, I bought',nob:'No',empty:c=>`We haven't reached ${c} yet. 🏹<br>Share the app with the restaurant you'd love here!`}
};

function T(k){const l=langActual();return (I18N[l]&&I18N[l][k])||I18N.es[k];}
function emoji(c){return EMOJIS[c]||'🍽️';}
function cap(s){return String(s||'').replace(/\w\S*/g,t=>t[0].toUpperCase()+t.substr(1).toLowerCase());}
function deviceId(){let d=localStorage.getItem('cazap_device');if(!d){d=(crypto.randomUUID?crypto.randomUUID():'d'+Date.now()+Math.random().toString(16).slice(2));localStorage.setItem('cazap_device',d);}return d;}
function paisActual(){return localStorage.getItem('cazap_country')||'EC';}
function langActual(){return localStorage.getItem('cazap_lang')||'es';}
function distKm(a,b,c,d){const R=6371,t=x=>x*Math.PI/180;const dLa=t(c-a),dLo=t(d-b);const h=Math.sin(dLa/2)**2+Math.cos(t(a))*Math.cos(t(c))*Math.sin(dLo/2)**2;return 2*R*Math.asin(Math.sqrt(h));}
function dhms(ms){if(ms<=0)return'00h 00m 00s';const d=Math.floor(ms/86400000),h=Math.floor(ms%86400000/3600000),m=Math.floor(ms%3600000/60000),s=Math.floor(ms%60000/1000);return d>0?`${d}d ${String(h).padStart(2,'0')}h ${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`:`${String(h).padStart(2,'0')}h ${String(m).padStart(2,'0')}m ${String(s).padStart(2,'0')}s`;}
function count(t,p){return`<span class="estado count" data-until="${t}" data-prefix="${p}"></span>`;}
function todayAt(h,m){const d=new Date();d.setHours(h,m,0,0);return d.getTime();}
function estaFinalizada(p){return p.validUntil&&new Date(p.validUntil).getTime()<=Date.now();}

function estadoHtml(p){
  const now=Date.now();
  const vf=p.validFrom?new Date(p.validFrom).getTime():0;
  const vu=p.validUntil?new Date(p.validUntil).getTime():null;
  if(vu&&vu<=now)return`<span class="estado">⌛ Finalizada</span>`;
  if(vf>now)return count(vf,'⏳ Habilitada en ');
  const[oh,om]=String(p.openTime||'00:00').split(':').map(Number);
  const[ch,cm]=String(p.closeTime||'23:59').split(':').map(Number);
  if(oh===0&&om===0&&ch===23&&cm===59)return count(vu||now,'🟢 Vigente hasta ');
  const mins=new Date().getHours()*60+new Date().getMinutes();
  if(mins<oh*60+om)return count(todayAt(oh,om),'⏳ Habilitada en ');
  if(mins<=ch*60+cm)return count(todayAt(ch,cm),' Vigente hasta ');
  if(vu&&vu>now)return count(todayAt(oh,om)+86400000,'⏳ Habilitada en ');
  return`<span class="estado">⌛ Finalizada</span>`;
}

function startTicker(){
  if(ticker)clearInterval(ticker);
  ticker=setInterval(()=>{document.querySelectorAll('.count').forEach(el=>{const ms=+el.dataset.until-Date.now();el.textContent=(el.dataset.prefix||'')+dhms(ms);});},1000);
  if(repintar)clearInterval(repintar);
  repintar=setInterval(()=>pintar(),60000);
}

function card(p){
  const d=Math.round((1-p.pricePromo/p.priceNormal)*100);
  const msg=encodeURIComponent(`Hola ${p.restaurant?.name||''}! Vi "${p.title}" en CazaPromos y quiero usarla `);
  const km=p._dist!=null?` · ${p._dist.toFixed(1)} km`:'';
  const r=p.restaurant||{};
  const zona=(r.sector||r.direccion||'');
  const zonaHtml=zona?`<a href="/mapa.html?lat=${r.lat||''}&lng=${r.lng||''}" style="color:#6B4F3A;font-size:12px;text-decoration:underline">📍 ${cap(zona)}${km}</a>`:(km?`<span style="color:#6B4F3A;font-size:12px">📍 ${km}</span>`:'');
  const activa=p.openNow&&!estaFinalizada(p);
  const wa=activa?`<a class="wa" data-id="${p._id}" data-wa="https://wa.me/${p.whatsapp}?text=${msg}" data-local="${(r.name||'el local').replace(/"/g,'')}" data-title="${p.title.replace(/"/g,'')}" href="https://wa.me/${p.whatsapp}?text=${msg}">Quiero esta promo </a>`:`<span class="wa off">⏳ Espera el cronómetro</span>`;
  return`<div class="card" data-card="${p._id}">
    <div class="cover">${p.image?`<img src="${p.image}" onerror="this.outerHTML='<div class=nofoto>🍽️</div>'" class="zoomable" data-full="${p.image}">`:'<div class="nofoto">🍽️</div>'}<span class="badge">-${d}%</span>${estadoHtml(p)}</div>
    <div class="cuerpo"><h3>${p.title}</h3><div class="rest">${emoji(p.category)} ${p.category.replace('_',' ')} · ${cap(p.city)}</div>
    ${zonaHtml}<div class="desc">${p.description||''}</div><div class="prices"><span class="old">$${p.priceNormal}</span><span class="new">$${p.pricePromo}</span></div>${wa}</div></div>`;
}

function overlay(html){
  const ov=document.createElement('div');
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.88);display:flex;align-items:center;justify-content:center;z-index:998;padding:20px;backdrop-filter:blur(4px);';
  ov.innerHTML=`<div style="background:#fff;color:#1F2A2E;border-radius:16px;padding:24px;max-width:340px;width:100%;text-align:center;box-shadow:0 20px 40px rgba(0,0,0,.25);border-top:6px solid #22A06B;">${html}</div>`;
  document.body.appendChild(ov);
  return ov;
}

document.addEventListener('click',async e=>{
  const a=e.target.closest('.wa[data-id]');if(!a)return;e.preventDefault();
  const id=a.dataset.id,waUrl=a.dataset.wa,local=a.dataset.local,title=a.dataset.title;
  const ov=overlay(`<h3 style="color:#0B7C84;font-family:'Baloo 2',sans-serif;font-size:20px;">${T('contact')} ${local}?</h3><p style="margin:10px 0;font-size:14px;">por la promo <b>${title}</b></p>
    <button id="si" style="background:#0E9BA4;color:#fff;border:none;border-radius:10px;padding:12px 18px;margin:4px;font-weight:700;cursor:pointer;">${T('yes')}</button>
    <button id="no" style="background:#ddd;color:#333;border:none;border-radius:10px;padding:12px 18px;margin:4px;font-weight:700;cursor:pointer;">${T('cancel')}</button>`);
  ov.querySelector('#no').onclick=()=>ov.remove();
  ov.querySelector('#si').onclick=async()=>{
    ov.remove();let code='';
    try{const r=await fetch('/api/coupons',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({promoId:id,deviceId:deviceId()})});const d=await r.json();code=d.code||'';}catch(e){}
    const enviar=(la,ln)=>fetch('/api/promos/track',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({promoId:id,lat:la,lng:ln,deviceId:deviceId()})}).catch(()=>{});
    if(modoGPS&&userPos)enviar(userPos.lat,userPos.lng);else if(navigator.geolocation)navigator.geolocation.getCurrentPosition(pos=>enviar(pos.coords.latitude,pos.coords.longitude),()=>enviar());else enviar();
    
    const ov2=overlay(`
      <h3 style="color:#0B7C84;font-family:'Baloo 2',sans-serif;font-size:22px;">${T('code')}</h3>
      <div style="font-size:32px;font-weight:900;letter-spacing:3px;color:#0E9BA4;margin:16px 0;font-family:'Baloo 2',sans-serif;">${code||'----'}</div>
      <p style="font-size:14px;color:#666;font-weight:600;">${T('show')}</p>
      <div style="background:#FFF8E1;border-left:4px solid #F59E0B;padding:14px;border-radius:8px;text-align:left;font-size:13px;color:#92400E;line-height:1.5;margin:16px 0;font-weight:600;">
        ${T('visit')}
      </div>
      <a id="go" href="${waUrl}" target="_blank" style="display:block;background:linear-gradient(90deg,#25D366,#128C7E);color:#fff;text-decoration:none;border-radius:10px;padding:14px;margin-top:12px;font-weight:800;font-size:16px;">${T('openwa')}</a>
    `);
    ov2.querySelector('#go').onclick=()=>setTimeout(()=>ov2.remove(),300);
    localStorage.setItem('cazap_last',JSON.stringify({id,t:Date.now()}));
  };
});

function pintarChips(){
  const box=document.getElementById('chips');
  if(!box)return;
  box.innerHTML=`<button class="chip ${catActiva==='todas'?'on':''}" data-c="todas">🍽️ Todas</button>`+CATS.map(c=>`<button class="chip ${catActiva===c?'on':''}" data-c="${c}">${emoji(c)} ${c.replace('_',' ')}</button>`).join('');
  box.querySelectorAll('.chip').forEach(b=>b.addEventListener('click',()=>{catActiva=b.dataset.c;pintarChips();pintar();}));
}

function pintar(){
  const grid=document.getElementById('grid');
  if(!grid)return;
  const promos=catActiva==='todas'?promosCache:promosCache.filter(p=>p.category===catActiva);
  if(!promos.length){grid.innerHTML=`<p class="vacio">${T('empty')(cap(ciudadSel))}</p>`;return;}
  const grupos={};promos.forEach(p=>{const k=(p.restaurant&&p.restaurant.name)||'Otros';(grupos[k]=grupos[k]||[]).push(p);});
  grid.innerHTML=Object.keys(grupos).map(k=>`<section class="seccion"><h2> ${k}</h2><div class="filas">${grupos[k].map(card).join('')}</div></section>`).join('');
  document.querySelectorAll('.zoomable').forEach(img=>{img.style.cursor='zoom-in';img.addEventListener('click',()=>{const ov=document.createElement('div');ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.9);display:flex;align-items:center;justify-content:center;z-index:999;padding:20px;cursor:zoom-out';ov.innerHTML=`<img src="${img.dataset.full}" style="max-width:100%;max-height:100%;border-radius:12px">`;ov.addEventListener('click',()=>ov.remove());document.body.appendChild(ov);});});
  startTicker();
}

async function retrospectivo(){
  try{
    const r=await fetch('/api/coupons/mine?deviceId='+deviceId());
    const d=await r.json();
    for(const c of(d.coupons||[])){
      await new Promise(res=>{
        const ov=overlay(`<h3 style="color:#0B7C84;font-family:'Baloo 2',sans-serif;">👀 ${T('bought')}</h3><p style="margin:8px 0"><b>${c.title}</b></p><button id="si" style="background:#22A06B;color:#fff;border:none;border-radius:10px;padding:12px 18px;margin:4px;font-weight:700;cursor:pointer;">${T('yesb')}</button><button id="no" style="background:#ddd;color:#333;border:none;border-radius:10px;padding:12px 18px;margin:4px;font-weight:700;cursor:pointer;">${T('nob')}</button>`);
        const done=b=>{fetch(`/api/coupons/${c.id}/confirm`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({deviceId:deviceId(),bought:b})}).catch(()=>{});ov.remove();res();};
        ov.querySelector('#si').onclick=()=>done(true);
        ov.querySelector('#no').onclick=()=>done(false);
      });
    }
  }catch(e){}
}

async function cargar(){
  const res=await fetch('/api/promos?city='+encodeURIComponent(ciudadSel));
  const data=await res.json();
  promosCache=data.promos||[];
  if(modoGPS&&userPos){
    promosCache=promosCache.map(p=>{const r=p.restaurant||{};p._dist=(r.lat&&r.lng)?distKm(userPos.lat,userPos.lng,r.lat,r.lng):null;return p;}).filter(p=>p._dist===null||p._dist<=9).sort((a,b)=>(a._dist??99)-(b._dist??99));
    document.getElementById('gpsNota').textContent=T('geo');
  } else {
    document.getElementById('gpsNota').textContent='';
  }
  pintarChips();
  pintar();
}

async function abrirModalCiudad(){
  const m=document.getElementById('modalCiudad');
  m.style.display='flex';
  const sel=document.getElementById('selPaisModal');
  sel.innerHTML = PAISES.map(p => 
    `<option value="${p}" ${p === paisActual() ? 'selected' : ''}>${getFlag(p)} ${p}</option>`
  ).join('');
  await pintarCiudades();
  sel.onchange = async () => {
    localStorage.setItem('cazap_country', sel.value);
    // SOLO UNA abreviatura con bandera: 🇪 EC
    document.getElementById('btnCiudad').textContent = getFlag(sel.value) + ' ' + sel.value;
    await pintarCiudades();
  };
}

async function pintarCiudades(){
  try {
    const r = await fetch('/api/promos/cities');
    const d = await r.json();
    const cities = d.cities || [];
    document.getElementById('listaCiudades').innerHTML = cities.length > 0 
      ? cities.map(c => `<div class="op${c.toLowerCase() === ciudadSel ? ' on' : ''}" data-c="${c}">📍 ${cap(c)}</div>`).join('')
      : '<p style="color:#999;text-align:center;padding:8px;font-size:13px;">Escribe tu ciudad arriba o usa el GPS.</p>';
    document.getElementById('listaCiudades').querySelectorAll('.op').forEach(o => {
      o.onclick = () => {
        ciudadSel = o.dataset.c.toLowerCase();
        localStorage.setItem('cazap_city', ciudadSel);
        document.getElementById('inpCiudad').value = cap(ciudadSel);
        document.getElementById('modalCiudad').style.display = 'none';
        cargar();
      };
    });
  } catch (e) {
    document.getElementById('listaCiudades').innerHTML = '<p style="color:#999;text-align:center;padding:8px;font-size:13px;">Escribe tu ciudad manualmente.</p>';
  }
}

document.getElementById('btnCiudad').addEventListener('click', abrirModalCiudad);
document.getElementById('opCerrar').onclick = () => document.getElementById('modalCiudad').style.display = 'none';

document.getElementById('inpCiudad').addEventListener('change', e => {
  const v = e.target.value.trim();
  if (v) {
    ciudadSel = v.toLowerCase();
    localStorage.setItem('cazap_city', ciudadSel);
    document.getElementById('modalCiudad').style.display = 'none';
    cargar();
  }
});

document.getElementById('opUbi').onclick = () => {
  document.getElementById('modalCiudad').style.display = 'none';
  activarGeo(true);
};

function activarGeo(forzar){
  const pref = localStorage.getItem('cazap_geo');
  if (!forzar && pref === 'no') { modoGPS = false; cargar(); return; }
  if (!navigator.geolocation) { modoGPS = false; cargar(); return; }
  document.getElementById('gpsNota').textContent = '📡 Obteniendo ubicación...';
  navigator.geolocation.getCurrentPosition(
    pos => {
      userPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      modoGPS = true;
      localStorage.setItem('cazap_geo', 'si');
      document.getElementById('gpsNota').textContent = '';
      cargar();
    },
    () => {
      modoGPS = false;
      localStorage.setItem('cazap_geo', 'no');
      document.getElementById('gpsNota').textContent = '⚠️ No se pudo obtener el GPS.';
      setTimeout(() => { document.getElementById('gpsNota').textContent = ''; }, 3000);
      cargar();
    },
    { enableHighAccuracy: true, timeout: 8000 }
  );
}

document.getElementById('geoToggle').addEventListener('change', e => {
  if (e.target.checked) {
    localStorage.setItem('cazap_geo', 'si');
    activarGeo(true);
  } else {
    localStorage.setItem('cazap_geo', 'no');
    modoGPS = false;
    document.getElementById('gpsNota').textContent = '';
    cargar();
  }
});

(function init(){
  const s = document.querySelector('.search');
  if (s) s.textContent = T('search');
  // AQUÍ se pone la bandera + abreviatura UNA SOLA VEZ: 🇪🇨 EC
  document.getElementById('btnCiudad').textContent = getFlag(paisActual()) + ' ' + paisActual();
  const pref = localStorage.getItem('cazap_geo');
  document.getElementById('geoToggle').checked = (pref === 'si');
  const ciudadGuardada = localStorage.getItem('cazap_city');
  if (ciudadGuardada) {
    ciudadSel = ciudadGuardada;
    document.getElementById('inpCiudad').value = cap(ciudadSel);
  }
  if (pref === 'si') {
    activarGeo(false);
  } else {
    cargar();
  }
})();