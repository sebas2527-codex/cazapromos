const msg=document.getElementById('msg');
const loginForm=document.getElementById('loginForm');
const regForm=document.getElementById('regForm');
const linkSwap=document.getElementById('linkSwap');
const sub=document.getElementById('sub');
let mapaReg=null,markerReg=null;
const pinIcon=L.divIcon({className:'',html:'<div style="width:18px;height:18px;background:#0E9BA4;border:3px solid #fff;border-radius:50%;box-shadow:0 0 6px rgba(0,0,0,.4)"></div>',iconSize:[18,18],iconAnchor:[9,9]});
function titleCase(s){return String(s||'').replace(/\w\S*/g,t=>t[0].toUpperCase()+t.substr(1).toLowerCase());}
function ojo(b,i){document.getElementById(b).addEventListener('click',()=>{const p=document.getElementById(i);p.type=p.type==='password'?'text':'password';});}
ojo('ojo','lpass'); ojo('ojo2','rpass');
linkSwap.addEventListener('click',()=>{
  const ml=loginForm.style.display!=='none';
  loginForm.style.display=ml?'none':'block'; regForm.style.display=ml?'block':'none';
  linkSwap.textContent=ml?'¿Ya tienes cuenta? Entra':'¿No tienes cuenta? Crea una';
  sub.textContent=ml?'Crea la cuenta de tu local':'Entra a tu panel'; msg.textContent='';
});
function pintar(t,ok){msg.textContent=t;msg.className=ok?'ok':'err';}
function whatsFull(){return document.getElementById('rpais').value+document.getElementById('rwhats').value.replace(/\D/g,'');}
function fmtNum(v){const d=v.replace(/\D/g,'').slice(0,9);return d.replace(/(\d{2})(\d{0,3})(\d{0,4})/,(m,a,b,c)=>[a,b,c].filter(Boolean).join(' ')).trim();}
document.getElementById('rwhats').addEventListener('input',e=>{e.target.value=fmtNum(e.target.value);});

function mostrarMapa(lat,lng){
  document.getElementById('mapaReg').style.display='block';
  if(!mapaReg){
    mapaReg=L.map('mapaReg').setView([lat,lng],17);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap'}).addTo(mapaReg);
    markerReg=L.marker([lat,lng],{draggable:true,icon:pinIcon}).addTo(mapaReg);
    markerReg.on('dragend',()=>{const p=markerReg.getLatLng();document.getElementById('rlat').value=p.lat;document.getElementById('rlng').value=p.lng;document.getElementById('ubiMsg').textContent='📍 Ubicación corregida por ti ✔';});
  } else { mapaReg.setView([lat,lng],17); markerReg.setLatLng([lat,lng]); }
  setTimeout(()=>mapaReg.invalidateSize(),100);
}
document.getElementById('btnCode').addEventListener('click',async()=>{
  pintar('Enviando código...',true);
  const res=await fetch('/api/auth/sendcode',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({whatsapp:whatsFull()})});
  const d=await res.json();
  if(!res.ok) return pintar(d.error||'No se pudo enviar',false);
  document.getElementById('codeWrap').style.display='block';
  pintar('📨 Código enviado a tu WhatsApp.',true);
});
document.getElementById('btnUbi').addEventListener('click',()=>{
  const m=document.getElementById('ubiMsg');
  if(!navigator.geolocation){m.textContent='Tu navegador no soporta GPS';return;}
  m.textContent='Obteniendo ubicación...';
  navigator.geolocation.getCurrentPosition(async pos=>{
    const lat=pos.coords.latitude,lng=pos.coords.longitude;
    document.getElementById('rlat').value=lat;document.getElementById('rlng').value=lng;
    mostrarMapa(lat,lng);
    try{
      const r=await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`);
      const d=await r.json();const a=d.address||{};
      // CIUDAD = categoriza (Guayaquil, Quito, Daule...). SECTOR/ZONA = para el mapa y la promo.
      const ciudad=(a.city||a.town||a.village||a.municipality||a.county||'');
      const sector=(a.suburb||a.neighbourhood||a.quarter||a.city_district||'');
      const calle=(a.road||'')+(a.house_number?' '+a.house_number:'');
      document.getElementById('rsector').value=sector;
      if(calle) document.getElementById('rdireccion').value=calle;
      if(ciudad) document.getElementById('rcity').value=titleCase(ciudad);
      m.textContent='📍 Ciudad: '+titleCase(ciudad)+' · Zona: '+titleCase(sector)+(calle?' ('+calle+')':'')+' — arrastra el pin si hace falta';
    }catch(e){m.textContent='📍 Ubicación guardada (arrastra el pin)';}
  },()=>{m.textContent='No se pudo obtener GPS; escribe tu ciudad y dirección y arrastra el pin.';});
});
document.getElementById('btnLogin').addEventListener('click',async()=>{
  const res=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:document.getElementById('lemail').value,password:document.getElementById('lpass').value})});
  const data=await res.json();
  if(!res.ok) return pintar(data.error||'Credenciales inválidas',false);
  localStorage.setItem('token',data.token);localStorage.setItem('restaurante',JSON.stringify(data.restaurant));
  window.location.href=data.restaurant.role==='admin'?'/admin.html':'/panel.html';
});
document.getElementById('btnReg').addEventListener('click',async()=>{
  const res=await fetch('/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
    name:document.getElementById('rname').value,email:document.getElementById('remail').value,
    whatsapp:whatsFull(),city:document.getElementById('rcity').value,password:document.getElementById('rpass').value,
    code:document.getElementById('rcode').value,
    lat:Number(document.getElementById('rlat').value)||null,lng:Number(document.getElementById('rlng').value)||null,
    sector:document.getElementById('rsector').value,direccion:document.getElementById('rdireccion').value,
    cedula:document.getElementById('rcedula').value,ruc:document.getElementById('rruc').value,instagram:document.getElementById('rinstagram').value
  })});
  const data=await res.json();
  if(!res.ok) return pintar(data.error||'Revisa los datos',false);
  regForm.style.display='none';loginForm.style.display='block';
  linkSwap.textContent='¿Ya tienes cuenta? Entra';sub.textContent='Entra a tu panel';
  document.getElementById('lemail').value=document.getElementById('remail').value;
  pintar('✅ Cuenta creada y verificada! Entra con tu correo y clave.',true);
});