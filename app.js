/**
 * PH FloodWatch - COMPLETED STABLE VERSION
 */
const OWM_API_KEY = '5dedfd0e06ad393a96e3d41382bca3eb';
let map = null, marker = null, heatmapLayer = null, myChart = null;
let currentLayer = 'precipitation_new';

const damRegistry = [
    { name: 'Angat Dam', lat: 14.9317, lon: 121.1575, threshold: 500 },
    { name: 'Ipo Dam', lat: 14.8850, lon: 121.1444, threshold: 100 },
    { name: 'Bustos Dam', lat: 14.9575, lon: 120.9122, threshold: 150 },
    { name: 'La Mesa Dam', lat: 14.7125, lon: 121.0764, threshold: 80 },
    { name: 'Pantabangan Dam', lat: 15.7833, lon: 121.1500, threshold: 600 },
    { name: 'Magat Dam', lat: 16.8203, lon: 121.4503, threshold: 800 },
    { name: 'San Roque Dam', lat: 16.1472, lon: 120.6833, threshold: 700 },
    { name: 'Ambuklao Dam', lat: 16.4167, lon: 120.7500, threshold: 400 },
    { name: 'Binga Dam', lat: 16.3833, lon: 120.6833, threshold: 350 },
    { name: 'Caliraya Dam', lat: 14.2833, lon: 121.5167, threshold: 120 },
    { name: 'Lumot Dam', lat: 14.3541, lon: 121.5471, threshold: 50 },
    { name: 'Quintana Dam', lat: 14.2714, lon: 120.8756, threshold: 30 },
    { name: 'Molino Dam', lat: 14.4144, lon: 120.9744, threshold: 25 },
    { name: 'Wawa Dam', lat: 14.7314, lon: 121.1917, threshold: 60 },
    { name: 'Masiway Dam', lat: 15.8014, lon: 121.1189, threshold: 100 },
    { name: 'Malinao Dam', lat: 9.7717, lon: 124.2819, threshold: 45 },
    { name: 'Bayawan Dam', lat: 9.4217, lon: 122.8219, threshold: 40 },
    { name: 'Jalaur Dam', lat: 11.0214, lon: 122.5317, threshold: 120 },
    { name: 'Agus IV (Balo-i)', lat: 8.1214, lon: 124.2117, threshold: 300 },
    { name: 'Agus VI (Maria Cristina)', lat: 8.1814, lon: 124.1917, threshold: 250 },
    { name: 'Pulangi IV', lat: 7.8214, lon: 125.0417, threshold: 450 },
    { name: 'Mainit Dam', lat: 9.4814, lon: 125.5217, threshold: 80 }
];

function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))); 
}

// NEW: Adjust Opacity function
function adjustOpacity(val) {
    const opacity = val / 100;
    document.getElementById('opacity-val').innerText = val + "%";
    if (heatmapLayer) {
        heatmapLayer.setOpacity(opacity);
    }
}

async function fetchAddressInfo(lat, lon) {
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`, {
            headers: { 'User-Agent': 'PHFloodWatch/1.0' }
        });
        const data = await res.json();
        const addr = data.address || {};
        
        const mainLoc = addr.city || addr.town || addr.suburb || addr.province || "Philippines";
        const subLoc = `${addr.province || ''} ${addr.region || ''}`.trim() || "Local Station";

        document.getElementById('current-location-name').innerText = mainLoc;
        document.getElementById('sub-location').innerText = subLoc;
    } catch (e) { 
        console.warn("Geocoding service busy/blocked"); 
    }
}

/**
 * PH FloodWatch - UPDATED WITH LOADING STATES
 */

// Helper to toggle loading UI
function toggleLoading(isLoading) {
    const elements = ['river-discharge', 'rain-value', 'temp-value', 'current-location-name'];
    elements.forEach(id => {
        const el = document.getElementById(id);
        if (isLoading) {
            el.classList.add('loading-shimmer');
        } else {
            el.classList.remove('loading-shimmer');
        }
    });
}
async function updateMonitoring(lat, lon) {
    toggleLoading(true); // START LOADING
    try {
        const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=precipitation,temperature_2m,weather_code&timezone=auto`);
        const weatherData = await weatherRes.json();
        
        const rain = weatherData.current?.precipitation ?? 0;
        document.getElementById('rain-value').innerText = rain.toFixed(2) + "mm";
        document.getElementById('rain-status').innerText = rain > 0 ? "Precipitation Detected" : "No Active Rain";

        const temp = weatherData.current?.temperature_2m ?? 0;
        document.getElementById('temp-value').innerText = Math.round(temp) + "°C";

        const code = weatherData.current?.weather_code ?? 0;
        updateWeatherUI(code);

        const floodRes = await fetch(`https://flood-api.open-meteo.com/v1/flood?latitude=${lat}&longitude=${lon}&daily=river_discharge&forecast_days=1`);
        const floodData = await floodRes.json();
        const discharge = floodData.daily?.river_discharge?.[0] ?? 0;
        document.getElementById('river-discharge').innerText = discharge.toFixed(2);

    } catch (e) {
        console.error("Monitoring fetch failed", e);
    } finally {
        toggleLoading(false); // STOP LOADING
    }
}

function updateWeatherUI(code) {
    const iconEl = document.getElementById('weather-icon');
    const descEl = document.getElementById('weather-desc');
    
    if (code === 0) {
        iconEl.innerHTML = '<i class="fas fa-sun text-yellow-400"></i>';
        descEl.innerText = "Clear Sky";
    } else if (code >= 1 && code <= 3) {
        iconEl.innerHTML = '<i class="fas fa-cloud-sun text-slate-400"></i>';
        descEl.innerText = "Partly Cloudy";
    } else if (code >= 51 && code <= 67) {
        iconEl.innerHTML = '<i class="fas fa-cloud-rain text-blue-400"></i>';
        descEl.innerText = "Rainy";
    } else if (code >= 95) {
        iconEl.innerHTML = '<i class="fas fa-cloud-bolt text-purple-400"></i>';
        descEl.innerText = "Thunderstorm";
    } else {
        iconEl.innerHTML = '<i class="fas fa-cloud text-slate-500"></i>';
        descEl.innerText = "Cloudy";
    }
}

async function updateDamData(userLat, userLon) {
    const statusLabel = document.getElementById('last-update');
    // Using the spinner in the status label
    statusLabel.innerHTML = '<span class="loader"></span> SYNCING...';
    
    try {
        const sortedDams = damRegistry.map(dam => ({
            ...dam,
            distance: calculateDistance(userLat, userLon, dam.lat, dam.lon)
        })).sort((a, b) => a.distance - b.distance);

        const damPromises = sortedDams.map(async (dam) => {
            try {
                const res = await fetch(`https://flood-api.open-meteo.com/v1/flood?latitude=${dam.lat}&longitude=${dam.lon}&daily=river_discharge&forecast_days=1`);
                const data = await res.json();
                const val = data.daily?.river_discharge?.[0] ?? 0;
                return { name: dam.name, val: val, dist: dam.distance.toFixed(1), stress: (val / dam.threshold) * 100 };
            } catch (err) { return { name: dam.name, val: 0, dist: dam.distance.toFixed(1), stress: 0 }; }
        });

        const results = await Promise.all(damPromises);
        refreshDamChart(results);
        statusLabel.innerText = "SYSTEM ACTIVE";
    } catch (e) { 
        statusLabel.innerText = "SYNC ERROR"; 
    }
}

function refreshDamChart(results) {
    if (!myChart) return;
    myChart.data.labels = results.map(r => `${r.name} (${r.dist}km)`);
    myChart.data.datasets[0].data = results.map(r => r.val);
    myChart.data.datasets[0].backgroundColor = results.map(r => r.stress > 80 ? '#ef4444' : (r.stress > 50 ? '#f59e0b' : '#3b82f6'));
    myChart.update();
}

async function searchLocation() {
    const query = document.getElementById('city-search').value;
    if (!query) return;
    try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1&countrycodes=ph`);
        const data = await res.json();
        if (data.length > 0) {
            const nLat = parseFloat(data[0].lat);
            const nLon = parseFloat(data[0].lon);
            map.setView([nLat, nLon], 13);
            if (marker) marker.setLatLng([nLat, nLon]);
            
            fetchAddressInfo(nLat, nLon);
            updateMonitoring(nLat, nLon);
            updateDamData(nLat, nLon);
        }
    } catch (e) { console.error("Search error", e); }
}

function initMap(lat, lon) {
    if (map) return;
    map = L.map('map', { zoomControl: false }).setView([lat, lon], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    updateWeatherLayer();
    marker = L.marker([lat, lon]).addTo(map);
}

function switchWeather(type, btn) {
    currentLayer = type;
    document.querySelectorAll('.btn-layer').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    updateWeatherLayer();
}

function updateWeatherLayer() {
    if (heatmapLayer) map.removeLayer(heatmapLayer);
    // Get current value from slider
    const currentOpacity = document.getElementById('opacity-slider').value / 100;
    heatmapLayer = L.tileLayer(`https://tile.openweathermap.org/map/${currentLayer}/{z}/{x}/{y}.png?appid=${OWM_API_KEY}`, { 
        opacity: currentOpacity 
    }).addTo(map);
}

function initDamChart() {
    const ctx = document.getElementById('damChart').getContext('2d');
    myChart = new Chart(ctx, {
        type: 'bar',
        data: { 
            labels: [], 
            datasets: [{ 
                label: 'm³/s', 
                data: [], 
                backgroundColor: '#3b82f6',
                barPercentage: 0.8,
                categoryPercentage: 0.9 
            }] 
        },
        options: { 
            indexAxis: 'y', 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { legend: { display: false } },
            scales: { 
                x: { 
                    beginAtZero: true,
                    grid: { color: 'rgba(255, 255, 255, 0.05)' },
                    ticks: { color: '#64748b', font: { size: 10 } }
                }, 
                y: { 
                    grid: { display: false },
                    ticks: { 
                        font: { size: 11 }, 
                        color: '#94a3b8',
                        autoSkip: false 
                    } 
                } 
            },
            layout: {
                padding: { top: 8, bottom: 8 }
            }
        }
    });
}

window.onload = () => {
    initDamChart();
    navigator.geolocation.getCurrentPosition(async (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        initMap(lat, lon);
        fetchAddressInfo(lat, lon);
        updateMonitoring(lat, lon);
        updateDamData(lat, lon);
    }, () => {
        const dLat = 14.5995, dLon = 120.9842; 
        initMap(dLat, dLon);
        fetchAddressInfo(dLat, dLon);
        updateMonitoring(dLat, dLon);
        updateDamData(dLat, dLon);
    });
};

async function locateMe() {
    const statusLabel = document.getElementById('last-update');
    statusLabel.innerHTML = '<span class="loader"></span> LOCATING...';

    if (!navigator.geolocation) {
        alert("Geolocation is not supported");
        return;
    }

    navigator.geolocation.getCurrentPosition(async (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        map.setView([lat, lon], 14);
        if (marker) marker.setLatLng([lat, lon]);

        await Promise.all([
            fetchAddressInfo(lat, lon),
            updateMonitoring(lat, lon),
            updateDamData(lat, lon)
        ]);
        
        statusLabel.innerText = "GPS SYNCED";
    }, (err) => {
        statusLabel.innerText = "GPS ERROR";
    }, {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
    });
}