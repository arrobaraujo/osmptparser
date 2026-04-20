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

// Busca de dados via Overpass
async function fetchRelationData(id) {
    const query = `[out:json][timeout:25];
        relation(${id});
        (._;>>;);
        out body;`;
    
    const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`;
    
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Falha ao buscar dados do Overpass');
        return await response.ok ? response.json() : null;
    } catch (err) {
        console.error(err);
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

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    initMap();
});
