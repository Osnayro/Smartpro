// ============================================================
// SMARTFLOW DTI RENDERER v1.0 - Renderizado de Diagrama de Tuberías e Instrumentación
// Archivo: js/modules/dti_renderer.js
// Dependencias: SmartFlowCore v6.0+, SmartFlowDTI v1.1+
// Características:
//   - Layout automático basado en líneas 3D existentes
//   - Ruteo ortogonal de tuberías (solo horizontal/vertical)
//   - Saltos/puentes en cruces de líneas no conectadas (ISA-5.1)
//   - Símbolos de instrumentos estándar ISA-5.1
//   - Válvulas de control con actuador y señal
//   - Lazos de control con líneas de señal (eléctrica, neumática)
//   - Tags de instrumentos con burbuja ISA
//   - Equipos con boquillas visibles
// ============================================================

const SmartFlowDTIRenderer = (function() {
    
    let _core = null;
    let _canvas = null;
    let _ctx = null;
    let _notify = (msg) => console.log(msg);
    
    // ================================================================
    //  CONFIGURACIÓN DE LAYOUT
    // ================================================================
    const LAYOUT = {
        startX: 120,
        startY: 120,
        spacingX: 250,
        spacingY: 180,
        equipmentSize: 50,
        nozzleSize: 6,
        instrumentSize: 20,
        valveSize: 18,
        marginTop: 70,
        marginLeft: 100,
        gridSize: 20,
        jumpSize: 10
    };
    
    // ================================================================
    //  COLORES ISA-5.1
    // ================================================================
    const ISA_COLORS = {
        'PIPE':           '#1e293b',
        'SIGNAL_ELECTRIC': '#e11d48',
        'SIGNAL_PNEUMATIC': '#2563eb',
        'SIGNAL_HYDRAULIC': '#d97706',
        'SIGNAL_DIGITAL':  '#7c3aed',
        'INSTRUMENT_FIELD': '#ffffff',
        'INSTRUMENT_PANEL': '#fef3c7',
        'VALVE':          '#0f172a',
        'CONTROL_VALVE':  '#1e293b',
        'TAG_TEXT':       '#0f172a',
        'NOZZLE':         '#f59e0b',
        'EQUIPMENT_BORDER':'#1e293b'
    };
    
    let _equipmentPositions = {};
    let _lineRoutes = [];
    let _instrumentPositions = {};
    let _signalRoutes = [];
    let _crossings = [];
    
    // ================================================================
    //  ALGORITMO DE LAYOUT PARA DTI
    // ================================================================
    
    function calculateLayout() {
        const lines = _core.getLines();
        const equipos = _core.getEquipos();
        const instruments = _core.getInstruments();
        const loops = _core.getLoops();
        
        _equipmentPositions = {};
        _lineRoutes = [];
        _instrumentPositions = {};
        _signalRoutes = [];
        _crossings = [];
        
        if (lines.length === 0 && equipos.length === 0) return;
        
        // 1. Posicionar equipos conectados por líneas
        const connectedEquipos = new Set();
        const colMap = new Map();
        const columns = [];
        
        lines.forEach(line => {
            const from = line.origin ? (line.origin.equipTag || line.origin.objTag) : '';
            const to = line.destination ? (line.destination.equipTag || line.destination.objTag) : '';
            if (from) connectedEquipos.add(from);
            if (to) connectedEquipos.add(to);
        });
        
        // BFS para ordenar equipos
        const sources = equipos
            .filter(eq => connectedEquipos.has(eq.tag) && 
                   !lines.some(l => (l.destination && (l.destination.equipTag || l.destination.objTag) === eq.tag)))
            .map(eq => eq.tag);
        
        const queue = sources.length > 0 ? 
            sources.map(tag => ({ tag, col: 0 })) : 
            [...connectedEquipos].map(tag => ({ tag, col: 0 }));
        
        while (queue.length > 0) {
            const { tag, col } = queue.shift();
            if (colMap.has(tag)) continue;
            colMap.set(tag, col);
            if (!columns[col]) columns[col] = [];
            columns[col].push(tag);
            
            lines.filter(l => (l.origin && (l.origin.equipTag || l.origin.objTag) === tag))
                 .forEach(l => {
                     const dest = l.destination ? (l.destination.equipTag || l.destination.objTag) : '';
                     if (dest && !colMap.has(dest)) queue.push({ tag: dest, col: col + 1 });
                 });
        }
        
        const posMap = {};
        columns.forEach((colTags, colIndex) => {
            colTags.forEach((tag, rowIndex) => {
                posMap[tag] = {
                    x: LAYOUT.startX + colIndex * LAYOUT.spacingX,
                    y: LAYOUT.startY + rowIndex * LAYOUT.spacingY
                };
            });
        });
        
        // Equipos no conectados
        let unconnectedCol = columns.length;
        let unconnectedRow = 0;
        equipos.forEach(eq => {
            if (!colMap.has(eq.tag)) {
                if (!columns[unconnectedCol]) columns[unconnectedCol] = [];
                colMap.set(eq.tag, unconnectedCol);
                posMap[eq.tag] = {
                    x: LAYOUT.startX + unconnectedCol * LAYOUT.spacingX,
                    y: LAYOUT.startY + unconnectedRow * LAYOUT.spacingY
                };
                unconnectedRow++;
                if (unconnectedRow >= 4) { unconnectedRow = 0; unconnectedCol++; }
            }
        });
        
        _equipmentPositions = posMap;
        
        // 2. Calcular rutas de líneas (tuberías)
        _lineRoutes = lines.map(line => {
            const fromTag = line.origin ? (line.origin.equipTag || line.origin.objTag) : '';
            const toTag = line.destination ? (line.destination.equipTag || line.destination.objTag) : '';
            const fromPos = posMap[fromTag];
            const toPos = posMap[toTag];
            if (!fromPos || !toPos) return null;
            return calculateLineRoute(line, fromPos, toPos);
        }).filter(r => r !== null);
        
        // 3. Posicionar instrumentos en sus líneas
        instruments.forEach(inst => {
            if (!inst.lineTag) return;
            const lineRoute = _lineRoutes.find(r => r && r.line.tag === inst.lineTag);
            if (!lineRoute) return;
            
            const pos = getPointOnRoute(lineRoute.points, inst.position || 0.5);
            if (pos) {
                _instrumentPositions[inst.tag] = {
                    x: pos.x,
                    y: pos.y - LAYOUT.instrumentSize * 2,
                    instrument: inst,
                    lineRoute: lineRoute
                };
            }
        });
        
        // 4. Calcular rutas de señales (lazos de control)
        _signalRoutes = loops.map(loop => {
            const sensorInst = instruments.find(i => i.tag === loop.sensor);
            const valveInst = instruments.find(i => i.tag === loop.valve);
            if (!sensorInst || !valveInst) return null;
            
            const sensorPos = _instrumentPositions[loop.sensor];
            const valvePos = _instrumentPositions[loop.valve];
            if (!sensorPos || !valvePos) return null;
            
            return {
                loop: loop,
                points: calculateSignalRoute(sensorPos, valvePos, _lineRoutes),
                type: loop.type || 'FEEDBACK'
            };
        }).filter(r => r !== null);
        
        // 5. Detectar cruces
        _crossings = detectCrossings(_lineRoutes);
    }
    
    function calculateLineRoute(line, fromPos, toPos) {
        const fromX = fromPos.x + LAYOUT.equipmentSize / 2;
        const fromY = fromPos.y;
        const toX = toPos.x - LAYOUT.equipmentSize / 2;
        const toY = toPos.y;
        
        const points = [{ x: fromX, y: fromY }];
        
        if (Math.abs(fromY - toY) < 10) {
            points.push({ x: toX, y: toY });
        } else {
            const midX = (fromX + toX) / 2;
            points.push({ x: midX, y: fromY });
            points.push({ x: midX, y: toY });
            points.push({ x: toX, y: toY });
        }
        
        return {
            line: line,
            points: points.map(p => ({
                x: Math.round(p.x / LAYOUT.gridSize) * LAYOUT.gridSize,
                y: Math.round(p.y / LAYOUT.gridSize) * LAYOUT.gridSize
            }))
        };
    }
    
    function calculateSignalRoute(sensorPos, valvePos, lineRoutes) {
        const points = [
            { x: sensorPos.x, y: sensorPos.y }
        ];
        
        // Ruta ortogonal con desvío
        const midY = (sensorPos.y + valvePos.y) / 2;
        const offsetX = 60;
        
        points.push({ x: sensorPos.x + offsetX, y: sensorPos.y });
        points.push({ x: sensorPos.x + offsetX, y: midY });
        points.push({ x: valvePos.x + offsetX, y: midY });
        points.push({ x: valvePos.x + offsetX, y: valvePos.y });
        points.push({ x: valvePos.x, y: valvePos.y });
        
        return points.map(p => ({
            x: Math.round(p.x / LAYOUT.gridSize) * LAYOUT.gridSize,
            y: Math.round(p.y / LAYOUT.gridSize) * LAYOUT.gridSize
        }));
    }
    
    function getPointOnRoute(points, param) {
        if (!points || points.length < 2) return null;
        let totalLen = 0;
        const lengths = [];
        for (let i = 0; i < points.length - 1; i++) {
            const d = Math.hypot(points[i+1].x - points[i].x, points[i+1].y - points[i].y);
            lengths.push(d);
            totalLen += d;
        }
        const target = totalLen * Math.max(0, Math.min(1, param));
        let accum = 0;
        for (let i = 0; i < lengths.length; i++) {
            if (accum + lengths[i] >= target || i === lengths.length - 1) {
                const t = lengths[i] > 0 ? (target - accum) / lengths[i] : 0;
                return {
                    x: points[i].x + (points[i+1].x - points[i].x) * t,
                    y: points[i].y + (points[i+1].y - points[i].y) * t
                };
            }
            accum += lengths[i];
        }
        return points[points.length - 1];
    }
    
    function detectCrossings(routes) {
        const crossings = [];
        for (let i = 0; i < routes.length; i++) {
            for (let j = i + 1; j < routes.length; j++) {
                const rA = routes[i], rB = routes[j];
                if (!rA || !rB) continue;
                for (let a = 0; a < rA.points.length - 1; a++) {
                    for (let b = 0; b < rB.points.length - 1; b++) {
                        const intersection = lineIntersection(
                            rA.points[a], rA.points[a+1],
                            rB.points[b], rB.points[b+1]
                        );
                        if (intersection) {
                            crossings.push({
                                routeA: rA, routeB: rB,
                                point: intersection, segA: a, segB: b
                            });
                        }
                    }
                }
            }
        }
        return crossings;
    }
    
    function lineIntersection(p1, p2, p3, p4) {
        const d1x = p2.x - p1.x, d1y = p2.y - p1.y;
        const d2x = p4.x - p3.x, d2y = p4.y - p3.y;
        const den = d1x * d2y - d1y * d2x;
        if (Math.abs(den) < 0.001) return null;
        const t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / den;
        const u = ((p3.x - p1.x) * d1y - (p3.y - p1.y) * d1x) / den;
        if (t > 0.05 && t < 0.95 && u > 0.05 && u < 0.95) {
            return { x: p1.x + t * d1x, y: p1.y + t * d1y };
        }
        return null;
    }
    
    function getSegmentDirection(p1, p2) {
        return Math.abs(p2.y - p1.y) < Math.abs(p2.x - p1.x) ? 'HORIZONTAL' : 'VERTICAL';
    }
    
    // ================================================================
    //  DIBUJO DE EQUIPOS DTI
    // ================================================================
    
    function drawEquipmentDTI(ctx, eq) {
        const pos = _equipmentPositions[eq.tag];
        if (!pos) return;
        
        const x = pos.x, y = pos.y, s = LAYOUT.equipmentSize / 2;
        
        ctx.save();
        
        // Sombra
        ctx.fillStyle = 'rgba(0,0,0,0.08)';
        ctx.beginPath();
        ctx.arc(x + 2, y + 2, s, 0, Math.PI * 2);
        ctx.fill();
        
        // Cuerpo
        const gradient = ctx.createRadialGradient(x - s*0.3, y - s*0.3, s*0.1, x, y, s);
        gradient.addColorStop(0, '#ffffff');
        gradient.addColorStop(1, '#e2e8f0');
        
        ctx.beginPath();
        ctx.arc(x, y, s, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
        ctx.strokeStyle = ISA_COLORS['EQUIPMENT_BORDER'];
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Tag
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 10px Segoe UI';
        ctx.textAlign = 'center';
        ctx.fillText(eq.tag, x, y + s + 14);
        
        // Boquillas
        if (eq.puertos) {
            eq.puertos.forEach(nozzle => {
                const nx = x + (nozzle.relX || 0) / (eq.diametro || 1000) * s;
                const ny = y + (nozzle.relY || 0) / (eq.altura || 1000) * s;
                
                ctx.beginPath();
                ctx.arc(nx, ny, LAYOUT.nozzleSize, 0, Math.PI * 2);
                ctx.fillStyle = ISA_COLORS['NOZZLE'];
                ctx.fill();
                ctx.strokeStyle = '#92400e';
                ctx.lineWidth = 1;
                ctx.stroke();
                
                // Tag de boquilla
                ctx.fillStyle = '#92400e';
                ctx.font = '6px Segoe UI';
                ctx.textAlign = 'center';
                ctx.fillText(nozzle.id, nx, ny - 10);
            });
        }
        
        ctx.restore();
    }
    
    // ================================================================
    //  DIBUJO DE TUBERÍAS
    // ================================================================
    
    function drawLineRoute(ctx, route, jumpSegments) {
        if (!route || route.points.length < 2) return;
        
        const { line, points } = route;
        
        ctx.save();
        ctx.strokeStyle = ISA_COLORS['PIPE'];
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        
        for (let i = 0; i < points.length - 1; i++) {
            const segKey = line.tag + '_' + i;
            if (jumpSegments.has(segKey)) continue;
            
            ctx.beginPath();
            ctx.moveTo(points[i].x, points[i].y);
            ctx.lineTo(points[i + 1].x, points[i + 1].y);
            ctx.stroke();
        }
        
        // Etiqueta de línea
        const midPt = getPointOnRoute(points, 0.5);
        if (midPt) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(midPt.x - 30, midPt.y - 9, 60, 16);
            ctx.strokeStyle = ISA_COLORS['PIPE'];
            ctx.lineWidth = 1;
            ctx.strokeRect(midPt.x - 30, midPt.y - 9, 60, 16);
            ctx.fillStyle = '#1e293b';
            ctx.font = 'bold 9px Segoe UI';
            ctx.textAlign = 'center';
            ctx.fillText(line.tag, midPt.x, midPt.y + 3);
            if (line.diameter) {
                ctx.font = '7px Segoe UI';
                ctx.fillText(line.diameter + '" ' + (line.spec || ''), midPt.x, midPt.y - 7);
            }
        }
        
        ctx.restore();
    }
    
    // ================================================================
    //  DIBUJO DE SALTOS
    // ================================================================
    
    function drawJump(ctx, crossing) {
        const { point, routeA, routeB, segA, segB } = crossing;
        const segADir = getSegmentDirection(routeA.points[segA], routeA.points[segA+1]);
        const segBDir = getSegmentDirection(routeB.points[segB], routeB.points[segB+1]);
        
        let jumpingRoute, jumpingSeg;
        if (segADir === 'HORIZONTAL') { jumpingRoute = routeA; jumpingSeg = segA; }
        else if (segBDir === 'HORIZONTAL') { jumpingRoute = routeB; jumpingSeg = segB; }
        else { jumpingRoute = routeA; jumpingSeg = segA; }
        
        const p1 = jumpingRoute.points[jumpingSeg];
        const p2 = jumpingRoute.points[jumpingSeg + 1];
        const isHorizontal = Math.abs(p2.y - p1.y) < Math.abs(p2.x - p1.x);
        const gap = LAYOUT.jumpSize;
        
        ctx.save();
        ctx.strokeStyle = ISA_COLORS['PIPE'];
        ctx.lineWidth = 3;
        
        if (isHorizontal) {
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(point.x - gap, point.y);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(point.x, point.y - gap, gap, 0, Math.PI, false);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(point.x + gap, point.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
        } else {
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(point.x, point.y - gap);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(point.x + gap, point.y, gap, -Math.PI/2, Math.PI/2, false);
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(point.x, point.y + gap);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
        }
        
        ctx.restore();
    }
    
    // ================================================================
    //  DIBUJO DE INSTRUMENTOS (ISA-5.1)
    // ================================================================
    
    function drawInstrument(ctx, pos) {
        if (!pos) return;
        
        const { x, y, instrument } = pos;
        const size = LAYOUT.instrumentSize;
        
        ctx.save();
        
        // Línea de conexión a la tubería
        ctx.beginPath();
        ctx.setLineDash([2, 2]);
        ctx.moveTo(x, y + size);
        const lineY = pos.lineRoute ? getPointOnRoute(pos.lineRoute.points, instrument.position || 0.5) : null;
        ctx.lineTo(x, lineY ? lineY.y : y + size * 3);
        ctx.strokeStyle = '#64748b';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Burbuja del instrumento
        const isPanel = instrument.location === 'PANEL' || instrument.location === 'CONTROL_ROOM';
        
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fillStyle = isPanel ? ISA_COLORS['INSTRUMENT_PANEL'] : '#ffffff';
        ctx.fill();
        ctx.strokeStyle = '#1e293b';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        
        // Línea horizontal si es panel
        if (isPanel) {
            ctx.beginPath();
            ctx.moveTo(x - size * 0.8, y);
            ctx.lineTo(x + size * 0.8, y);
            ctx.strokeStyle = '#1e293b';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
        
        // Tag del instrumento
        ctx.fillStyle = ISA_COLORS['TAG_TEXT'];
        ctx.font = 'bold 8px Segoe UI';
        ctx.textAlign = 'center';
        ctx.fillText(instrument.tag, x, y - size - 4);
        
        // Tipo dentro de la burbuja
        const typeAbbr = getInstrumentAbbr(instrument.type);
        ctx.fillStyle = '#1e293b';
        ctx.font = 'bold 7px Segoe UI';
        ctx.fillText(typeAbbr, x, y + 3);
        
        // Rango
        if (instrument.range) {
            ctx.fillStyle = '#64748b';
            ctx.font = '6px Segoe UI';
            ctx.fillText(instrument.range, x, y + size + 12);
        }
        
        ctx.restore();
    }
    
    function getInstrumentAbbr(type) {
        const abbr = {
            'PRESSURE_GAUGE': 'PG', 'PRESSURE_TRANSMITTER': 'PT',
            'TEMPERATURE_GAUGE': 'TG', 'TEMPERATURE_TRANSMITTER': 'TT',
            'FLOW_METER': 'FG', 'FLOW_TRANSMITTER': 'FT',
            'LEVEL_GAUGE': 'LG', 'LEVEL_TRANSMITTER': 'LT',
            'LEVEL_SWITCH': 'LS', 'LEVEL_CONTROLLER': 'LIC',
            'PRESSURE_CONTROLLER': 'PIC', 'FLOW_CONTROLLER': 'FIC',
            'CONTROL_VALVE': 'CV', 'SAFETY_VALVE': 'SV',
            'ROTAMETER': 'RO', 'SIGHT_GLASS': 'SG'
        };
        return abbr[type] || type.substring(0, 3);
    }
    
    // ================================================================
    //  DIBUJO DE SEÑALES DE CONTROL
    // ================================================================
    
    function drawSignalRoute(ctx, route) {
        if (!route || route.points.length < 2) return;
        
        ctx.save();
        
        // Línea de señal eléctrica (punteada)
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = ISA_COLORS['SIGNAL_ELECTRIC'];
        ctx.lineWidth = 1.5;
        
        ctx.beginPath();
        ctx.moveTo(route.points[0].x, route.points[0].y);
        for (let i = 1; i < route.points.length; i++) {
            ctx.lineTo(route.points[i].x, route.points[i].y);
        }
        ctx.stroke();
        
        ctx.setLineDash([]);
        
        // Etiqueta del lazo
        const midPt = getPointOnRoute(route.points, 0.5);
        if (midPt && route.loop) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(midPt.x - 20, midPt.y - 7, 40, 12);
            ctx.fillStyle = ISA_COLORS['SIGNAL_ELECTRIC'];
            ctx.font = 'bold 7px Segoe UI';
            ctx.textAlign = 'center';
            ctx.fillText(route.loop.tag, midPt.x, midPt.y + 4);
        }
        
        ctx.restore();
    }
    
    // ================================================================
    //  RENDERIZADO PRINCIPAL
    // ================================================================
    
    function render() {
        if (!_ctx || !_canvas || !_core) return;
        
        const dpr = window.devicePixelRatio || 1;
        const displayWidth = _canvas.width / dpr;
        const displayHeight = _canvas.height / dpr;
        
        _ctx.clearRect(0, 0, displayWidth, displayHeight);
        
        // Fondo
        _ctx.fillStyle = '#fafbfc';
        _ctx.fillRect(0, 0, displayWidth, displayHeight);
        
        // Título
        _ctx.fillStyle = '#0f172a';
        _ctx.font = 'bold 15px Segoe UI';
        _ctx.textAlign = 'left';
        _ctx.fillText('DIAGRAMA DE TUBERÍAS E INSTRUMENTACIÓN (DTI)', 20, 28);
        
        _ctx.fillStyle = '#64748b';
        _ctx.font = '8px Segoe UI';
        _ctx.fillText('ISA-5.1 | Ruteo: Ortogonal | Señales: Eléctricas', 20, 42);
        
        calculateLayout();
        
        if (Object.keys(_equipmentPositions).length === 0) {
            _ctx.fillStyle = '#94a3b8';
            _ctx.font = '13px Segoe UI';
            _ctx.textAlign = 'center';
            _ctx.fillText('Sin equipos ni líneas para mostrar', displayWidth / 2, displayHeight / 2);
            _ctx.fillText('Use comandos 3D: create equipo | connect | create instrument', displayWidth / 2, displayHeight / 2 + 24);
            return;
        }
        
        // Mapa de segmentos con salto
        const jumpSegments = new Set();
        _crossings.forEach(c => {
            const dirA = getSegmentDirection(c.routeA.points[c.segA], c.routeA.points[c.segA+1]);
            const dirB = getSegmentDirection(c.routeB.points[c.segB], c.routeB.points[c.segB+1]);
            if (dirA === 'HORIZONTAL') jumpSegments.add(c.routeA.line.tag + '_' + c.segA);
            else if (dirB === 'HORIZONTAL') jumpSegments.add(c.routeB.line.tag + '_' + c.segB);
            else jumpSegments.add(c.routeA.line.tag + '_' + c.segA);
        });
        
        // PASO 1: Tuberías
        _lineRoutes.forEach(route => drawLineRoute(_ctx, route, jumpSegments));
        
        // PASO 2: Saltos
        _crossings.forEach(c => drawJump(_ctx, c));
        
        // PASO 3: Señales de control
        _signalRoutes.forEach(route => drawSignalRoute(_ctx, route));
        
        // PASO 4: Instrumentos
        Object.values(_instrumentPositions).forEach(pos => drawInstrument(_ctx, pos));
        
        // PASO 5: Equipos
        const equipos = _core.getEquipos();
        equipos.forEach(eq => drawEquipmentDTI(_ctx, eq));
        
        // Leyenda
        drawDTILegend(_ctx);
    }
    
    function drawDTILegend(ctx) {
        const x = 15, y = 80;
        
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 9px Segoe UI';
        ctx.fillText('LEYENDA ISA-5.1', x, y);
        
        const items = [
            { label: 'Tubería de proceso', style: ISA_COLORS['PIPE'], dash: [], width: 3, y: y + 16 },
            { label: 'Señal eléctrica', style: ISA_COLORS['SIGNAL_ELECTRIC'], dash: [5, 4], width: 1.5, y: y + 30 },
            { label: 'Instrumento campo', style: '#1e293b', dash: [], width: 1.5, y: y + 44 },
            { label: 'Instrumento panel', style: '#d97706', dash: [], width: 1.5, y: y + 58 }
        ];
        
        items.forEach(item => {
            ctx.beginPath();
            ctx.setLineDash(item.dash);
            ctx.moveTo(x, item.y);
            ctx.lineTo(x + 35, item.y);
            ctx.strokeStyle = item.style;
            ctx.lineWidth = item.width;
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.fillStyle = '#334155';
            ctx.font = '8px Segoe UI';
            ctx.textAlign = 'left';
            ctx.fillText(item.label, x + 42, item.y + 3);
        });
    }
    
    // ================================================================
    //  INICIALIZACIÓN
    // ================================================================
    
    function init(canvasElement, coreInstance, notifyFn) {
        _canvas = canvasElement;
        _core = coreInstance;
        _notify = notifyFn || _notify;
        
        if (_canvas) {
            _ctx = _canvas.getContext('2d');
            resizeCanvas();
        }
        
        window.addEventListener('resize', function() {
            resizeCanvas();
            setTimeout(render, 50);
        });
        
        if (_core && _core.on) {
            _core.on('modelChanged', function() {
                setTimeout(render, 100);
            });
        }
        
        setTimeout(render, 300);
        console.log('SmartFlowDTIRenderer v1.0 inicializado | ISA-5.1 | Ruteo: Ortogonal');
    }
    
    function resizeCanvas() {
        if (!_canvas) return;
        const container = _canvas.parentElement;
        const dpr = window.devicePixelRatio || 1;
        if (container) {
            _canvas.width = container.clientWidth * dpr;
            _canvas.height = container.clientHeight * dpr;
            _canvas.style.width = container.clientWidth + 'px';
            _canvas.style.height = container.clientHeight + 'px';
            _ctx = _canvas.getContext('2d');
            _ctx.scale(dpr, dpr);
        }
    }
    
    // ================================================================
    //  API PÚBLICA
    // ================================================================
    
    return {
        init: init,
        render: render,
        resizeCanvas: resizeCanvas,
        calculateLayout: calculateLayout,
        getEquipmentPositions: function() { return _equipmentPositions; },
        getLineRoutes: function() { return _lineRoutes; },
        getInstrumentPositions: function() { return _instrumentPositions; },
        getSignalRoutes: function() { return _signalRoutes; }
    };
})();

