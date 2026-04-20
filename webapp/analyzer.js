/**
 * Motor de análise para relações OSM - Porte da lógica Rust (osmptparser)
 * MODIFICADO EM: 20/04/2026 por Antigravity AI
 */

const Analyzer = {
    /**
     * Calcula a distância Haversine entre dois pontos em metros
     */
    haversine: (lat1, lon1, lat2, lon2) => {
        const R = 6371000; // Raio da Terra em metros
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    },

    /**
     * Tenta juntar segmentos de vias que compartilham exatamente o mesmo nó
     */
    joinWays: (ways) => {
        if (ways.length === 0) return [];
        
        let joined = [ [...ways[0]] ];
        let remaining = ways.slice(1);

        let changed = true;
        while (changed) {
            changed = false;
            for (let i = 0; i < remaining.length; i++) {
                const currentWay = remaining[i];
                const lastJoined = joined[joined.length - 1];
                
                const lastNode = lastJoined[lastJoined.length - 1];
                const firstNode = currentWay[0];
                const lastNodeOfCurrent = currentWay[currentWay.length - 1];
                const firstNodeOfJoined = lastJoined[0];

                // Caso 1: Fim do anterior coincide com Início do atual
                if (lastNode.id === firstNode.id) {
                    lastJoined.push(...currentWay.slice(1));
                    remaining.splice(i, 1);
                    changed = true;
                    break;
                }
                // Caso 2: Fim do anterior coincide com Fim do atual (precisa reverter atual)
                else if (lastNode.id === lastNodeOfCurrent.id) {
                    const reversed = [...currentWay].reverse();
                    lastJoined.push(...reversed.slice(1));
                    remaining.splice(i, 1);
                    changed = true;
                    break;
                }
                // Caso 3: Início do anterior coincide com Início do atual (precisa reverter anterior)
                else if (firstNodeOfJoined.id === firstNode.id) {
                   lastJoined.reverse();
                   lastJoined.push(...currentWay.slice(1));
                   remaining.splice(i, 1);
                   changed = true;
                   break;
                }
                // Caso 4: Início do anterior coincide com Fim do atual (precisa reverter ambos ou apenas adicionar)
                else if (firstNodeOfJoined.id === lastNodeOfCurrent.id) {
                    lastJoined.reverse();
                    const reversed = [...currentWay].reverse();
                    lastJoined.push(...reversed.slice(1));
                    remaining.splice(i, 1);
                    changed = true;
                    break;
                }
            }
            
            // Se não conseguiu dar join no último, mas ainda há vias, movemos para o próximo "segmento"
            if (!changed && remaining.length > 0) {
                joined.push([...remaining[0]]);
                remaining.splice(0, 1);
                changed = true;
            }
        }

        return joined;
    },

    /**
     * Analisa as vias e detecta GAPs baseados na tolerância
     */
    analyze: (ways, tolerance) => {
        // Primeiro passo: Agrupar o que for perfeitamente contíguo
        const continuousSegments = Analyzer.joinWays(ways);
        
        const results = {
            segments: continuousSegments, // Cada segmento é uma array de nós
            gaps: [],
            totalDistance: 0
        };

        // Calcular distância total
        continuousSegments.forEach(seg => {
            for (let i = 0; i < seg.length - 1; i++) {
                results.totalDistance += Analyzer.haversine(
                    seg[i].lat, seg[i].lon, 
                    seg[i+1].lat, seg[i+1].lon
                );
            }
        });

        // Detectar Gaps entre os segmentos resultantes
        for (let i = 0; i < continuousSegments.length - 1; i++) {
            const seg1 = continuousSegments[i];
            const seg2 = continuousSegments[i+1];
            
            const p1 = seg1[seg1.length - 1];
            const p2 = seg2[0];
            
            const dist = Analyzer.haversine(p1.lat, p1.lon, p2.lat, p2.lon);
            
            if (dist > 0.1) { // Só reporta se não for o mesmo ponto (margem de erro float)
                results.gaps.push({
                    from: p1,
                    to: p2,
                    distance: dist,
                    isBroken: dist > tolerance
                });
            }
        }

        return results;
    }
};
