/**
 * Orquestração principal da Web App
 * MODIFICADO EM: 20/04/2026 por Antigravity AI
 */

let map;
let layers = {
    segments: L.layerGroup(),
    gaps: L.layerGroup(),
    stops: L.layerGroup()
};

// Configuração Inicial
function initMap() {
    map = L.map('map', {
        zoomControl: false
    }).setView([-22.9068, -43.1729], 12); // Rio de Janeiro default

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    layers.segments.addTo(map);
    layers.gaps.addTo(map);
    layers.stops.addTo(map);
}

const OVERPASS_MIRRORS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://lz4.overpass-api.de/api/interpreter',
    'https://z.overpass-api.de/api/interpreter'
];

// Utilitário de fetch com fallback para múltiplos mirrors
async function fetchWithFallback(query) {
    if (window.location.protocol === 'file:') {
        console.warn('Atenção: Rodar via protocolo file:// pode causar bloqueios de CORS em alguns navegadores. Recomenda-se usar um servidor local.');
    }

    for (const mirror of OVERPASS_MIRRORS) {
        try {
            console.log(`Tentando mirror Overpass: ${new URL(mirror).hostname}`);
            const url = `${mirror}?data=${encodeURIComponent(query)}`;
            const response = await fetch(url);
            if (response.ok) return await response.json();
            console.warn(`Mirror ${mirror} retornou erro ${response.status}`);
        } catch (err) {
            console.warn(`Falha de rede no mirror ${mirror}. Tentando próximo...`);
        }
    }
    throw new Error('Não foi possível conectar a nenhum servidor Overpass. Verifique sua conexão ou tente novamente mais tarde.');
}

// Busca de dados via Overpass
async function fetchRelationData(id) {
    const query = `[out:json][timeout:25];
        relation(${id});
        (._;>>;);
        out body;`;
    
    try {
        return await fetchWithFallback(query);
    } catch (err) {
        alert('Erro ao buscar dados: ' + err.message);
        return null;
    }
}

// Processamento do JSON do Overpass para o formato do Analyzer
function processOverpassData(data) {
    const nodes = {};
    const ways = {};
    const relations = [];

    data.elements.forEach(el => {
        if (el.type === 'node') nodes[el.id] = { id: el.id, lat: el.lat, lon: el.lon, tags: el.tags || {} };
        else if (el.type === 'way') ways[el.id] = { id: el.id, nodes: el.nodes, tags: el.tags || {} };
        else if (el.type === 'relation') relations.push(el);
    });

    const mainRel = relations[0]; // Assume que o primeiro é o principal
    if (!mainRel) return null;

    // Extrair vias na ordem definida na relação
    const relationWays = mainRel.members
        .filter(m => m.type === 'way')
        .map(m => {
            const way = ways[m.ref];
            if (!way) return null;
            return way.nodes.map(nodeId => nodes[nodeId]).filter(n => !!n);
        })
        .filter(w => !!w && w.length > 0);

    // Extrair paradas
    const stops = mainRel.members
        .filter(m => m.type === 'node' && (m.role === 'stop' || m.role === 'platform'))
        .map(m => nodes[m.ref])
        .filter(n => !!n);

    return { ways: relationWays, stops, tags: mainRel.tags };
}

// Renderização no Mapa
function renderResults(analysis, stops) {
    layers.segments.clearLayers();
    layers.gaps.clearLayers();
    layers.stops.clearLayers();

    const resultsList = document.getElementById('results-list');
    resultsList.innerHTML = '';

    // 1. Renderizar Vias
    analysis.segments.forEach((seg, idx) => {
        const latlngs = seg.map(n => [n.lat, n.lon]);
        L.polyline(latlngs, {
            color: '#3b82f6',
            weight: 4,
            opacity: 0.8,
            lineJoin: 'round'
        }).addTo(layers.segments);
    });

    // 2. Renderizar Gaps
    analysis.gaps.forEach((gap, idx) => {
        const color = gap.isBroken ? '#f43f5e' : '#fbbf24';
        const weight = gap.isBroken ? 3 : 2;
        const dashArray = gap.isBroken ? '10, 10' : '5, 5';

        // Linha do Gap
        L.polyline([[gap.from.lat, gap.from.lon], [gap.to.lat, gap.to.lon]], {
            color: color,
            weight: weight,
            dashArray: dashArray,
            opacity: 0.9
        }).addTo(layers.gaps);

        // Marcadores de alerta
        const marker = L.circleMarker([gap.from.lat, gap.from.lon], {
            radius: 6,
            color: color,
            fillColor: color,
            fillOpacity: 1
        }).addTo(layers.gaps);
        
        marker.bindPopup(`<b>Gap #${idx + 1}</b><br>Distância: ${gap.distance.toFixed(2)}m<br>${gap.isBroken ? '⚠️ QUEBRADO' : 'ℹ️ Tolerável'}`);

        // Adicionar na lista lateral
        const item = document.createElement('div');
        item.className = 'gap-item';
        if (!gap.isBroken) item.style.border = '1px solid rgba(251, 191, 36, 0.3)';
        if (!gap.isBroken) item.style.background = 'rgba(251, 191, 36, 0.05)';
        
        item.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span style="font-weight:600; font-size:0.9rem;">Gap #${idx + 1}</span>
                <span style="font-size:0.75rem; color: ${color}">${gap.distance.toFixed(1)}m</span>
            </div>
            <p style="font-size:0.75rem; color: #94a3b8; margin-top:0.25rem;">
                Entre nó ${gap.from.id} e ${gap.to.id}
            </p>
        `;
        item.onclick = () => map.flyTo([gap.from.lat, gap.from.lon], 18);
        resultsList.appendChild(item);
    });

    // 3. Renderizar Paradas (opcional, visualização leve)
    stops.forEach(s => {
        L.circleMarker([s.lat, s.lon], {
            radius: 3,
            color: '#10b981',
            fillOpacity: 0.5
        }).addTo(layers.stops);
    });

    if (analysis.segments.length > 0) {
        const allCoords = analysis.segments.flat().map(n => [n.lat, n.lon]);
        map.fitBounds(L.latLngBounds(allCoords), { padding: [50, 50] });
    }

    // Atualizar Stats
    document.getElementById('stats').style.display = 'grid';
    document.getElementById('stat-dist').innerText = (analysis.totalDistance / 1000).toFixed(2) + ' km';
    const brokenCount = analysis.gaps.filter(g => g.isBroken).length;
    document.getElementById('stat-gaps').innerText = brokenCount;
    
    // Altera a cor do card de stats baseado no status
    const gapCard = document.getElementById('stat-gaps').parentElement;
    if (brokenCount > 0) {
        document.getElementById('stat-gaps').style.color = 'var(--accent)';
    } else if (analysis.gaps.length > 0) {
        document.getElementById('stat-gaps').style.color = '#fbbf24'; // Warning color
    } else {
        document.getElementById('stat-gaps').style.color = 'var(--success)';
    }
    
    // Botão JOSM
    const relId = document.getElementById('rel-id').value;
    const josmBtn = document.getElementById('josm-btn');
    josmBtn.style.display = 'flex';
    josmBtn.onclick = () => {
        const bounds = map.getBounds();
        const url = `http://127.0.0.1:8111/load_and_zoom?left=${bounds.getWest()}&right=${bounds.getEast()}&top=${bounds.getNorth()}&bottom=${bounds.getSouth()}&select=relation${relId}`;
        fetch(url).catch(e => alert('JOSM não detectado. Certifique-se de que o JOSM está aberto com Controle Remoto ativado.'));
    };
}

let allRoutes = []; // Global para armazenar as rotas encontradas na descoberta

// Busca de rotas em uma área (Cidade)
async function fetchRoutesInArea(cityName) {
    const query = `[out:json][timeout:60];
        area[name="${cityName}"]->.searchArea;
        (
          relation(area.searchArea)["type"="route"]["route"~"bus|tram|train|subway|light_rail|monorail|trolleybus"];
        );
        out tags;`;
    
    try {
        const data = await fetchWithFallback(query);
        return data.elements.map(el => ({
            id: el.id,
            name: el.tags.name || 'Sem nome',
            ref: el.tags.ref || el.tags.route_ref || '',
            route: el.tags.route || 'bus',
            operator: el.tags.operator || ''
        }));
    } catch (err) {
        alert('Erro ao buscar rotas: ' + err.message);
        return [];
    }
}

// Renderizar lista de descoberta filtrada
function renderDiscoveryList(filter = '') {
    const list = document.getElementById('routes-list');
    list.innerHTML = '';
    
    const filtered = allRoutes.filter(r => 
        r.name.toLowerCase().includes(filter.toLowerCase()) || 
        r.ref.toLowerCase().includes(filter.toLowerCase()) ||
        r.id.toString().includes(filter)
    );

    if (filtered.length === 0) {
        list.innerHTML = '<p class="subtitle" style="padding: 1rem; text-align: center;">Nenhuma rota encontrada</p>';
        return;
    }

    filtered.slice(0, 100).forEach(route => { // Limitar a 100 para performance
        const item = document.createElement('div');
        item.className = 'route-item';
        item.innerHTML = `
            <div class="route-info">
                <span class="route-name">${route.name}</span>
                <span class="route-ref">${route.ref}</span>
            </div>
            <div class="route-meta">${route.route.toUpperCase()} • ${route.operator} • ID: ${route.id}</div>
        `;
        item.onclick = () => {
            document.getElementById('rel-id').value = route.id;
            document.getElementById('discovery-results').style.display = 'none';
            document.getElementById('analyze-btn').click();
        };
        list.appendChild(item);
    });
}

// Ação do Botão Analisar
document.getElementById('analyze-btn').addEventListener('click', async () => {
    const id = document.getElementById('rel-id').value;
    const tolerance = parseFloat(document.getElementById('gap-tolerance').value);
    
    const btn = document.getElementById('analyze-btn');
    const originalContent = btn.innerHTML;
    btn.innerHTML = '<div class="loader"></div> Analisando...';
    btn.disabled = true;

    const data = await fetchRelationData(id);
    if (data) {
        const processed = processOverpassData(data);
        if (processed) {
            const results = Analyzer.analyze(processed.ways, tolerance);
            renderResults(results, processed.stops);
        } else {
            alert('Relação não encontrada ou sem vias válidas.');
        }
    }

    btn.innerHTML = originalContent;
    btn.disabled = false;
});

// Eventos de Descoberta
document.getElementById('find-routes-btn').addEventListener('click', async () => {
    const city = document.getElementById('city-search').value;
    if (!city) return alert('Digite o nome de uma cidade');

    const btn = document.getElementById('find-routes-btn');
    const originalContent = btn.innerHTML;
    btn.innerHTML = '<div class="loader" style="width:14px; height:14px;"></div>';
    btn.disabled = true;

    allRoutes = await fetchRoutesInArea(city);
    if (allRoutes.length > 0) {
        document.getElementById('discovery-results').style.display = 'flex';
        renderDiscoveryList();
    } else {
        alert('Nenhuma rota encontrada para esta área.');
    }

    btn.innerHTML = originalContent;
    btn.disabled = false;
});

document.getElementById('city-search').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') document.getElementById('find-routes-btn').click();
});

document.getElementById('route-filter').addEventListener('input', (e) => {
    renderDiscoveryList(e.target.value);
});

document.getElementById('close-discovery').addEventListener('click', () => {
    document.getElementById('discovery-results').style.display = 'none';
});

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    initMap();
    lucide.createIcons();
});
