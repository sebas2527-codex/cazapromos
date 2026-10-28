// public/mapa.js
// Stack: Leaflet (BSD-2-Clause), OpenStreetMap (ODbL)

let map;
let userMarker;
let restaurantMarkers = [];

// Inicializar mapa
function initMap() {
    // Coordenadas por defecto (Guayaquil)
    map = L.map('map').setView([-2.170998, -79.922359], 13);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
    }).addTo(map);

    // Cargar promos de la ciudad seleccionada
    loadCityPromos();
}

function getUserLocation() {
    if (!navigator.geolocation) {
        alert("Tu navegador no soporta geolocalización.");
        return;
    }

    const btn = document.getElementById('btnUbicacion');
    const nota = document.getElementById('notaMapa');
    btn.textContent = "⏳ Buscando...";
    nota.textContent = "Obteniendo tu ubicación GPS...";

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const { latitude, longitude } = position.coords;
            
            if (userMarker) map.removeLayer(userMarker);

            // Icono personalizado verde para el usuario
            const userIcon = L.divIcon({
                className: 'custom-div-icon',
                html: "<div style='background-color:#22A06B; width:16px; height:16px; border-radius:50%; border:3px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3);'></div>",
                iconSize: [20, 20],
                iconAnchor: [10, 10]
            });

            userMarker = L.marker([latitude, longitude], { icon: userIcon }).addTo(map)
                .bindPopup("<b>Estás aquí</b>").openPopup();

            map.setView([latitude, longitude], 14);
            btn.textContent = "📍 Mi Ubicación";
            nota.textContent = "Mostrando locales cercanos a tu ubicación.";
            
            // Recargar promos con la ubicación del usuario para calcular distancias
            loadCityPromos(latitude, longitude);
        },
        (error) => {
            console.error("Error de geolocalización:", error);
            nota.textContent = "⚠️ No se pudo obtener el GPS. Mostrando locales de la ciudad.";
            btn.textContent = "📍 Mi Ubicación";
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
}

async function loadCityPromos(userLat = null, userLng = null) {
    // Limpiar marcadores anteriores
    restaurantMarkers.forEach(marker => map.removeLayer(marker));
    restaurantMarkers = [];

    // CORRECCIÓN: Usar las mismas claves que script.js (cazap_city, no cazap_last_city)
    const lastCity = localStorage.getItem('cazap_city') || 'guayaquil';
    const lastCountry = (localStorage.getItem('cazap_country') || 'EC').toUpperCase();

    try {
        const response = await fetch(`/api/promos?city=${encodeURIComponent(lastCity)}&country=${lastCountry}`);
        const data = await response.json();
        
        // CORRECCIÓN FATAL: El backend devuelve { promos: [...] }, no un array directo
        const promos = data.promos || data || [];

        if (!promos || promos.length === 0) {
            document.getElementById('notaMapa').textContent = `Aún no hay locales registrados en ${lastCity}. ¡Sé el primero!`;
            return;
        }

        const bounds = L.latLngBounds();

        promos.forEach(promo => {
            // CORRECCIÓN: Ser tolerante a 'restaurant' o 'restaurante' según cómo lo devuelva el backend
            const r = promo.restaurant || promo.restaurante || {};
            
            if (r.lat && r.lng) {
                const lat = parseFloat(r.lat);
                const lng = parseFloat(r.lng);

                let distanciaTxt = "";
                if (userLat && userLng) {
                    const R = 6371; 
                    const dLat = (lat - userLat) * Math.PI / 180;
                    const dLon = (lng - userLng) * Math.PI / 180;
                    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                              Math.cos(userLat * Math.PI / 180) * Math.cos(lat * Math.PI / 180) *
                              Math.sin(dLon/2) * Math.sin(dLon/2);
                    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                    const distancia = R * c;
                    
                    if (distancia <= 15) {
                        distanciaTxt = `<br><span style="color:#22A06B;font-weight:700;">📍 A ${distancia.toFixed(1)} km de ti</span>`;
                    }
                }

                // Icono turquesa para el local
                const localIcon = L.divIcon({
                    className: 'custom-div-icon',
                    html: `<div style='background-color:#0E9BA4; width:28px; height:28px; border-radius:50% 50% 50% 0; transform: rotate(-45deg); border:2px solid white; box-shadow: 0 2px 5px rgba(0,0,0,0.3); display:flex; align-items:center; justify-content:center;'>
                             <span style='transform: rotate(45deg); color:white; font-size:14px;'>🍔</span>
                           </div>`,
                    iconSize: [28, 28],
                    iconAnchor: [14, 28]
                });

                const marker = L.marker([lat, lng], { icon: localIcon }).addTo(map);
                
                const nombreLocal = r.nombre || r.name || 'Restaurante';
                const tituloPromo = promo.title || 'Promoción';
                
                const popupContent = `
                    <div style="text-align:center; min-width:160px; font-family:'Nunito',sans-serif;">
                        <b style="color:#0E9BA4; font-size:16px;">${nombreLocal}</b><br>
                        <span style="font-size:14px; color:#333;">${tituloPromo}</span>
                        ${distanciaTxt}
                        <br><br>
                        <a href="/promos.html" style="background:#0E9BA4; color:white; padding:6px 12px; text-decoration:none; border-radius:6px; font-size:13px; font-weight:700;">Ver en el inicio</a>
                    </div>
                `;
                
                marker.bindPopup(popupContent);
                restaurantMarkers.push(marker);
                bounds.extend([lat, lng]);
            }
        });

        // Ajustar el mapa para que se vean todos los marcadores
        if (restaurantMarkers.length > 0) {
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
            document.getElementById('notaMapa').textContent = `Se encontraron ${restaurantMarkers.length} locales en ${lastCity}.`;
        }

    } catch (error) {
        console.error("Error cargando promos para el mapa:", error);
        document.getElementById('notaMapa').textContent = "Error al cargar los locales. Revisa tu conexión.";
    }
}

// Iniciar al cargar
document.addEventListener('DOMContentLoaded', initMap);