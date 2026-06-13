// ============================================================
// SMARTFLOW PFD RENDERER v1.1 - Renderizado de Diagrama de Flujo
// Archivo: js/modules/pfd_renderer.js
// Dependencias: SmartFlowCore v6.0+, SmartFlowPFD v1.1+
// Características:
//   - Layout automático de equipos (izquierda → derecha)
//   - Ruteo ortogonal de corrientes (solo horizontal/vertical)
//   - Saltos/puentes en cruces de líneas no conectadas (ISO 10628)
//   - Etiquetas de corriente (fluido, caudal, presión, temperatura)
//   - Símbolos estándar ISO 10628
//   - Colores por tipo de fluido
//   - Leyenda automática
// ============================================================

const SmartFlowPFDRenderer = (function() {
    
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
        spacingX: 280,
        spacingY: 200,
        equipmentSize: 60,
        marginTop: 70,
        marginLeft: 100,
        gridSize: 20,
        jumpSize: 12,
        arrowSize: 10
    };
    
    // ================================================================
    //  COLORES POR TIPO DE FLUIDO
    // ================================================================
    const FLUID_COLORS = {
        'WATER':           '#3b82f6',
        'STEAM':           '#ef4444',
        'CONDENSATE':      '#f59e0b',
        'AIR':             '#94a3b8',
        'NITROGEN':        '#8b5cf6',
        'NATURAL_GAS':     '#f97316',
        'CRUDE_OIL':       '#1e293b',
        'DIESEL':          '#92400e',
        'GASOLINE':        '#ea580c',
        'ETHANOL':         '#a855f7',
        'METHANOL':        '#7c3aed',
        'PROCESS_WATER':   '#06b6d4',
        'COOLING_WATER':   '#0ea5e9',
        'CHILLED_WATER':   '#2563eb',
        'HOT_OIL':         '#dc2626',
        'THERMAL_FLUID':   '#b91c1c',
        'BRINE':           '#0891b2',
        'GLYCOL':          '#4f46e5',
        'LUBE_OIL':        '#854d0e',
        'STEAM_COND':      '#fbbf24',
        'AMMONIA':         '#84cc16',
        'CHLORINE':        '#65a30d',
        'H2SO4':           '#ca8a04',
        'NAOH':            '#eab308',
        'HCL':             '#a3e635',
        'DEFAULT':         '#64748b'
    };
    
    // ================================================================
    //  ESTADO INTERNO
    // ================================================================
    let _equipmentPositions = {};
    let _streamRoutes = [];
    let _crossings = [];
    
    // ================================================================
    //  ALGORITMO DE LAYOUT AUTOMÁTICO
    // ================================================================
    
    function calculateLayout() {
        const streams = _core.getStreams();
        const equipos = _core.getEquipos();
        
        _equipmentPositions = {};
        _streamRoutes = [];
        _crossings = [];
        
        if (equipos.length === 0) return;
        
        // Construir grafo de conexiones
        const graph = new Map();
        const inDegree = new Map();
        
        equipos.forEach(eq => {
            graph.set(eq.tag, { from: [], to: [] });
            inDegree.set(eq.tag, 0);
        });
        
        streams.forEach(s => {
            if (s.from && graph.has(s.from)) {
                graph.get(s.from).to.push(s);
            }
            if (s.to && graph.has(s.to)) {
                graph.get(s.to).from.push(s);
                inDegree.set(s.to, (inDegree.get(s.to) || 0) + 1);
            }
        });
        
        // Ordenamiento topológico
        const colMap = new Map();
        const columns = [];
        
        const sources = equipos
            .filter(eq => (inDegree.get(eq.tag) || 0) === 0)
            .map(eq => eq.tag);
        
        const queue = sources.map(tag => ({ tag, col: 0 }));
        
        while (queue.length > 0) {
            const { tag, col } = queue.shift();
            if (colMap.has(tag)) continue;
            
            colMap.set(tag, col);
            if (!columns[col]) columns[col] = [];
            columns[col].push(tag);
            
            const node = graph.get(tag);
            if (node) {
                node.to.forEach(s => {
                    if (s.to && !colMap.has(s.to)) {
                        queue.push({ tag: s.to, col: col + 1 });
                    }
                });
            }
        }
        
        // Equipos no conectados
        equipos.forEach(eq => {
            if (!colMap.has(eq.tag)) {
                const col = columns.length;
                colMap.set(eq.tag, col);
                if (!columns[col]) columns[col] = [];
                columns[col].push(eq.tag);
            }
        });
        
        // Asignar posiciones
        const posMap = {};
        
        columns.forEach((colTags, colIndex) => {
            const totalHeight = colTags.length * LAYOUT.spacingY;
            const startY = LAYOUT.startY + Math.max(0, (LAYOUT.spacingY * 4 - totalHeight) / 2);
            
            colTags.forEach((tag, rowIndex) => {
                posMap[tag] = {
                    x: LAYOUT.startX + colIndex * LAYOUT.spacingX,
                    y: Math.max(LAYOUT.startY, startY + rowIndex * LAYOUT.spacingY)
                };
            });
        });
        
        _equipmentPositions = posMap;
        
        // Calcular rutas ortogonales
        _streamRoutes = streams.map(s => {
            if (!s.from || !s.to) return null;
            const fromPos = posMap[s.from];
            const toPos = posMap[s.to];
            if (!fromPos || !toPos) return null;
            return calculateOrthogonalRoute(s, fromPos, toPos);
        }).filter(r => r !== null);
        
        // Detectar cruces
        _crossings = detectCrossings(_streamRoutes);
    }
    
    // ================================================================
    //  ALGORITMO DE RUTEO ORTOGONAL
    // ================================================================
    
    function calculateOrthogonalRoute(stream, fromPos, toPos) {
        const fromX = fromPos.x + LAYOUT.equipmentSize / 2;
        const fromY = fromPos.y;
        const toX = toPos.x - LAYOUT.equipmentSize / 2;
        const toY = toPos.y;
        
        const points = [];
        
        // Punto de salida
        points.push({ x: fromX, y: fromY });
        
        // Punto de llegada
        const endPoint = { x: toX, y: toY };
        
        // Si están alineados horizontalmente → línea recta
        if (Math.abs(fromY - toY) < 10) {
            points.push(endPoint);
        } else {
            // Ruta ortogonal: H + V + H
            const midX = (fromX + toX) / 2;
            points.push({ x: midX, y: fromY });
            points.push({ x: midX, y: toY });
            points.push(endPoint);
        }
        
        // Snap a grilla
        const snappedPoints = points.map(p => ({
            x: Math.round(p.x / LAYOUT.gridSize) * LAYOUT.gridSize,
            y: Math.round(p.y / LAYOUT.gridSize) * LAYOUT.gridSize
        }));
        
        return {
            stream: stream,
            points: snappedPoints,
            color: FLUID_COLORS[stream.fluid] || FLUID_COLORS['DEFAULT']
        };
    }
    
    // ================================================================
    //  DETECCIÓN DE CRUCES
    // ================================================================
    
    function detectCrossings(routes) {
        const crossings = [];
        
        for (let i = 0; i < routes.length; i++) {
            for (let j = i + 1; j < routes.length; j++) {
                const routeA = routes[i];
                const routeB = routes[j];
                if (!routeA || !routeB) continue;
                
                // No detectar cruces entre la misma ruta
                if (routeA.stream.tag === routeB.stream.tag) continue;
                
                for (let a = 0; a < routeA.points.length - 1; a++) {
                    for (let b = 0; b < routeB.points.length - 1; b++) {
                        const intersection = lineIntersection(
                            routeA.points[a], routeA.points[a + 1],
                            routeB.points[b], routeB.points[b + 1]
                        );
                        
                        if (intersection) {
                            crossings.push({
                                routeA: routeA,
                                routeB: routeB,
                                point: intersection,
                                segA: a,
                                segB: b
                            });
                        }
                    }
                }
            }
        }
        
        return crossings;
    }
    
    function lineIntersection(p1, p2, p3, p4) {
        const d1x = p2.x - p1.x;
        const d1y = p2.y - p1.y;
        const d2x = p4.x - p3.x;
        const d2y = p4.y - p3.y;
        
        const denominator = d1x * d2y - d1y * d2x;
        if (Math.abs(denominator) < 0.001) return null;
        
        const t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / denominator;
        const u = ((p3.x - p1.x) * d1y - (p3.y - p1.y) * d1x) / denominator;
        
        if (t > 0.05 && t < 0.95 && u > 0.05 && u < 0.95) {
            return {
                x: p1.x + t * d1x,
                y: p1.y + t * d1y
            };
        }
        
        return null;
    }
    
    function getSegmentDirection(p1, p2) {
        return Math.abs(p2.y - p1.y) < Math.abs(p2.x - p1.x) ? 'HORIZONTAL' : 'VERTICAL';
    }
    
    // ================================================================
    //  DIBUJO DE EQUIPOS
    // ================================================================
    
    function drawEquipment(ctx, eq) {
        const pos = _equipmentPositions[eq.tag];
        if (!pos) return;
        
        const x = pos.x;
        const y = pos.y;
        const s = LAYOUT.equipmentSize / 2;
        
        ctx.save();
        
        switch (eq.tipo) {
            case 'tanque_v':
            case 'torre':
            case 'reactor':
            case 'reactor_encamisado':
            case 'autoclave':
            case 'caldera':
                ctx.beginPath();
                ctx.arc(x, y, s, 0, Math.PI * 2);
                ctx.fillStyle = '#e8f4f8';
                ctx.fill();
                ctx.strokeStyle = '#1e40af';
                ctx.lineWidth = 2.5;
                ctx.stroke();
                break;
                
            case 'bomba':
            case 'bomba_dosificacion':
            case 'bomba_z':
                ctx.beginPath();
                ctx.arc(x, y, s * 0.8, 0, Math.PI * 2);
                ctx.fillStyle = '#fef3c7';
                ctx.fill();
                ctx.strokeStyle = '#d97706';
                ctx.lineWidth = 2.5;
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(x + s * 0.55, y);
                ctx.lineTo(x - s * 0.25, y - s * 0.45);
                ctx.lineTo(x - s * 0.25, y + s * 0.45);
                ctx.closePath();
                ctx.fillStyle = '#d97706';
                ctx.fill();
                break;
                
            case 'intercambiador':
            case 'condensador':
                ctx.beginPath();
                ctx.arc(x, y, s, 0, Math.PI * 2);
                ctx.fillStyle = '#fce7f3';
                ctx.fill();
                ctx.strokeStyle = '#be185d';
                ctx.lineWidth = 2.5;
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(x - s * 0.6, y - s * 0.6);
                ctx.lineTo(x + s * 0.6, y + s * 0.6);
                ctx.moveTo(x + s * 0.6, y - s * 0.6);
                ctx.lineTo(x - s * 0.6, y + s * 0.6);
                ctx.strokeStyle = '#be185d';
                ctx.lineWidth = 1.5;
                ctx.stroke();
                break;
                
            case 'tanque_h':
            case 'separador':
            case 'separador_trifasico':
            case 'filtro_prensa':
            case 'filtro_duplex':
                ctx.beginPath();
                ctx.ellipse(x, y, s * 1.3, s * 0.65, 0, 0, Math.PI * 2);
                ctx.fillStyle = '#dbeafe';
                ctx.fill();
                ctx.strokeStyle = '#2563eb';
                ctx.lineWidth = 2.5;
                ctx.stroke();
                break;
                
            case 'compresor':
                ctx.beginPath();
                ctx.arc(x, y, s, 0, Math.PI * 2);
                ctx.fillStyle = '#fee2e2';
                ctx.fill();
                ctx.strokeStyle = '#dc2626';
                ctx.lineWidth = 2.5;
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(x + s * 0.5, y - s * 0.3);
                ctx.lineTo(x + s * 0.9, y);
                ctx.lineTo(x + s * 0.5, y + s * 0.3);
                ctx.strokeStyle = '#dc2626';
                ctx.lineWidth = 2;
                ctx.stroke();
                break;
                
            case 'columna_fraccionadora':
                ctx.beginPath();
                ctx.ellipse(x, y, s * 0.6, s * 2, 0, 0, Math.PI * 2);
                ctx.fillStyle = '#e8f4f8';
                ctx.fill();
                ctx.strokeStyle = '#1e40af';
                ctx.lineWidth = 2.5;
                ctx.stroke();
                break;
                
            case 'agitador':
            case 'molino':
            case 'centrifuga':
                ctx.beginPath();
                ctx.arc(x, y, s, 0, Math.PI * 2);
                ctx.fillStyle = '#f1f5f9';
                ctx.fill();
                ctx.strokeStyle = '#475569';
                ctx.lineWidth = 2.5;
                ctx.stroke();
                break;
                
            case 'skid_inyeccion':
            case 'llenadora':
            case 'osmosis':
                ctx.fillStyle = '#e2e8f0';
                ctx.fillRect(x - s * 0.9, y - s * 0.6, s * 1.8, s * 1.2);
                ctx.strokeStyle = '#475569';
                ctx.lineWidth = 2.5;
                ctx.strokeRect(x - s * 0.9, y - s * 0.6, s * 1.8, s * 1.2);
                break;
                
            default:
                ctx.fillStyle = '#f8fafc';
                ctx.fillRect(x - s * 0.7, y - s * 0.5, s * 1.4, s * 1.0);
                ctx.strokeStyle = '#64748b';
                ctx.lineWidth = 2.5;
                ctx.strokeRect(x - s * 0.7, y - s * 0.5, s * 1.4, s * 1.0);
        }
        
        // Tag del equipo
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 11px Segoe UI';
        ctx.textAlign = 'center';
        ctx.fillText(eq.tag, x, y + s + 16);
        
        // Tipo de equipo
        ctx.fillStyle = '#64748b';
        ctx.font = '8px Segoe UI';
        ctx.fillText(getEquipmentLabel(eq.tipo), x, y + s + 30);
        
        ctx.restore();
    }
    
    function getEquipmentLabel(tipo) {
        const labels = {
            'tanque_v': 'Tanque Vertical',
            'tanque_h': 'Tanque Horizontal',
            'bomba': 'Bomba Centrífuga',
            'intercambiador': 'Intercambiador',
            'torre': 'Torre',
            'reactor': 'Reactor',
            'compresor': 'Compresor',
            'separador': 'Separador',
            'caldera': 'Caldera',
            'columna_fraccionadora': 'Columna'
        };
        return labels[tipo] || tipo || '';
    }
    
    // ================================================================
    //  DIBUJO DE CORRIENTES CON SALTOS
    // ================================================================
    
    function drawStreamWithJumps(ctx, route, jumpSegments) {
        if (!route || route.points.length < 2) return;
        
        const { points, color } = route;
        
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        for (let i = 0; i < points.length - 1; i++) {
            const segKey = route.stream.tag + '_' + i;
            
            // Si este segmento tiene salto, lo saltamos
            if (jumpSegments.has(segKey)) continue;
            
            ctx.beginPath();
            ctx.moveTo(points[i].x, points[i].y);
            ctx.lineTo(points[i + 1].x, points[i + 1].y);
            ctx.stroke();
        }
        
        ctx.restore();
    }
    
    function drawStreamLabels(ctx, route) {
        if (!route || route.points.length < 2) return;
        
        const { stream, points, color } = route;
        
        ctx.save();
        
        // Tag en el primer segmento (arriba de la línea)
        const firstMidX = (points[0].x + points[1].x) / 2;
        const firstMidY = points[0].y - 10;
        
        ctx.fillStyle = color;
        ctx.font = 'bold 10px Segoe UI';
        ctx.textAlign = 'center';
        ctx.fillText(stream.tag, firstMidX, firstMidY);
        
        // Condiciones en segmento vertical o en línea recta
        if (points.length >= 3) {
            const labelX = points[1].x + 10;
            const labelY = (points[1].y + points[2].y) / 2;
            
            ctx.fillStyle = '#1e293b';
            ctx.font = '8px Segoe UI';
            ctx.textAlign = 'left';
            
            const lines = [
                (stream.fluid || 'N/D'),
                formatValue(stream.flow, stream.flowUnit || 'm³/h'),
                formatValue(stream.pressure, stream.pressureUnit || 'bar'),
                formatValue(stream.temperature, stream.temperatureUnit || '°C')
            ];
            
            const startY2 = labelY - (lines.length * 11) / 2;
            lines.forEach((line, idx) => {
                ctx.fillText(line, labelX, startY2 + idx * 11 + 8);
            });
        } else if (points.length === 2) {
            const cx = (points[0].x + points[1].x) / 2;
            const cy = points[0].y - 10;
            
            ctx.fillStyle = '#1e293b';
            ctx.font = '8px Segoe UI';
            ctx.textAlign = 'center';
            ctx.fillText(
                stream.fluid + ' ' + formatValue(stream.flow, stream.flowUnit || 'm³/h'),
                cx, cy
            );
        }
        
        ctx.restore();
    }
    
    function formatValue(value, unit) {
        if (value === undefined || value === null || value === 0) return 'N/D';
        return value + ' ' + unit;
    }
    
    // ================================================================
    //  DIBUJO DE SALTOS (JUMPS)
    // ================================================================
    
    function drawJump(ctx, crossing) {
        const { point, routeA, routeB, segA, segB } = crossing;
        
        const segADir = getSegmentDirection(routeA.points[segA], routeA.points[segA + 1]);
        const segBDir = getSegmentDirection(routeB.points[segB], routeB.points[segB + 1]);
        
        // La línea horizontal es la que salta
        let jumpingRoute, jumpingSeg;
        
        if (segADir === 'HORIZONTAL') {
            jumpingRoute = routeA;
            jumpingSeg = segA;
        } else if (segBDir === 'HORIZONTAL') {
            jumpingRoute = routeB;
            jumpingSeg = segB;
        } else {
            // Ambas verticales: la primera salta
            jumpingRoute = routeA;
            jumpingSeg = segA;
        }
        
        const p1 = jumpingRoute.points[jumpingSeg];
        const p2 = jumpingRoute.points[jumpingSeg + 1];
        const isHorizontal = Math.abs(p2.y - p1.y) < Math.abs(p2.x - p1.x);
        const gapSize = LAYOUT.jumpSize;
        
        ctx.save();
        
        if (isHorizontal) {
            const jumpX = point.x;
            const jumpY = point.y;
            
            // Línea antes del salto
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(jumpX - gapSize, jumpY);
            ctx.strokeStyle = jumpingRoute.color;
            ctx.lineWidth = 2.5;
            ctx.stroke();
            
            // Arco del salto (semicírculo hacia arriba)
            ctx.beginPath();
            ctx.arc(jumpX, jumpY - gapSize, gapSize, 0, Math.PI, false);
            ctx.strokeStyle = jumpingRoute.color;
            ctx.lineWidth = 2.5;
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            ctx.stroke();
            
            // Línea después del salto
            ctx.beginPath();
            ctx.moveTo(jumpX + gapSize, jumpY);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = jumpingRoute.color;
            ctx.lineWidth = 2.5;
            ctx.stroke();
        } else {
            const jumpX = point.x;
            const jumpY = point.y;
            
            // Línea antes del salto
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(jumpX, jumpY - gapSize);
            ctx.strokeStyle = jumpingRoute.color;
            ctx.lineWidth = 2.5;
            ctx.stroke();
            
            // Arco del salto (semicírculo hacia la derecha)
            ctx.beginPath();
            ctx.arc(jumpX + gapSize, jumpY, gapSize, -Math.PI / 2, Math.PI / 2, false);
            ctx.strokeStyle = jumpingRoute.color;
            ctx.lineWidth = 2.5;
            ctx.fillStyle = '#ffffff';
            ctx.fill();
            ctx.stroke();
            
            // Línea después del salto
            ctx.beginPath();
            ctx.moveTo(jumpX, jumpY + gapSize);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = jumpingRoute.color;
            ctx.lineWidth = 2.5;
            ctx.stroke();
        }
        
        ctx.restore();
    }
    
    // ================================================================
    //  DIBUJO DE FLECHAS
    // ================================================================
    
    function drawArrow(ctx, from, to, color) {
        const angle = Math.atan2(to.y - from.y, to.x - from.x);
        const arrowSize = LAYOUT.arrowSize;
        
        ctx.beginPath();
        ctx.moveTo(to.x, to.y);
        ctx.lineTo(
            to.x - arrowSize * Math.cos(angle - 0.5),
            to.y - arrowSize * Math.sin(angle - 0.5)
        );
        ctx.lineTo(
            to.x - arrowSize * Math.cos(angle + 0.5),
            to.y - arrowSize * Math.sin(angle + 0.5)
        );
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
    }
    
    // ================================================================
    //  LEYENDA
    // ================================================================
    
    function drawLegend(ctx) {
        const streams = _core.getStreams();
        if (streams.length === 0) return;
        
        const fluidTypes = [...new Set(streams.map(s => s.fluid).filter(f => f))];
        if (fluidTypes.length === 0) return;
        
        const x = 15;
        let y = 80;
        
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 9px Segoe UI';
        ctx.fillText('LEYENDA', x, y);
        y += 14;
        
        fluidTypes.slice(0, 10).forEach(fluid => {
            const color = FLUID_COLORS[fluid] || FLUID_COLORS['DEFAULT'];
            
            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + 30, y);
            ctx.strokeStyle = color;
            ctx.lineWidth = 2.5;
            ctx.stroke();
            
            ctx.fillStyle = '#334155';
            ctx.font = '8px Segoe UI';
            ctx.textAlign = 'left';
            ctx.fillText(fluid, x + 36, y + 3);
            
            y += 14;
        });
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
        _ctx.fillStyle = '#ffffff';
        _ctx.fillRect(0, 0, displayWidth, displayHeight);
        
        // Título
        _ctx.fillStyle = '#0f172a';
        _ctx.font = 'bold 15px Segoe UI';
        _ctx.textAlign = 'left';
        _ctx.fillText('DIAGRAMA DE FLUJO DE PROCESO (PFD)', 20, 28);
        
        _ctx.fillStyle = '#64748b';
        _ctx.font = '8px Segoe UI';
        _ctx.fillText('ISO 10628 | Unidades: SI | Ruteo: Ortogonal', 20, 42);
        
        // Calcular layout
        calculateLayout();
        
        if (Object.keys(_equipmentPositions).length === 0) {
            _ctx.fillStyle = '#94a3b8';
            _ctx.font = '13px Segoe UI';
            _ctx.textAlign = 'center';
            _ctx.fillText('Sin equipos para mostrar', displayWidth / 2, displayHeight / 2);
            _ctx.fillText('Use: create equipo TIPO TAG', displayWidth / 2, displayHeight / 2 + 24);
            return;
        }
        
        // Mapa de segmentos que tienen salto
        const jumpSegments = new Set();
        _crossings.forEach(crossing => {
            const segADir = getSegmentDirection(
                crossing.routeA.points[crossing.segA],
                crossing.routeA.points[crossing.segA + 1]
            );
            const segBDir = getSegmentDirection(
                crossing.routeB.points[crossing.segB],
                crossing.routeB.points[crossing.segB + 1]
            );
            
            if (segADir === 'HORIZONTAL') {
                jumpSegments.add(crossing.routeA.stream.tag + '_' + crossing.segA);
            } else if (segBDir === 'HORIZONTAL') {
                jumpSegments.add(crossing.routeB.stream.tag + '_' + crossing.segB);
            } else {
                jumpSegments.add(crossing.routeA.stream.tag + '_' + crossing.segA);
            }
        });
        
        // PASO 1: Dibujar líneas principales
        _streamRoutes.forEach(route => {
            drawStreamWithJumps(_ctx, route, jumpSegments);
        });
        
        // PASO 2: Dibujar saltos
        _crossings.forEach(crossing => {
            drawJump(_ctx, crossing);
        });
        
        // PASO 3: Flechas en extremos
        _streamRoutes.forEach(route => {
            if (route.points.length >= 2) {
                const last = route.points[route.points.length - 1];
                const prev = route.points[route.points.length - 2];
                drawArrow(_ctx, prev, last, route.color);
            }
        });
        
        // PASO 4: Etiquetas
        _streamRoutes.forEach(route => {
            drawStreamLabels(_ctx, route);
        });
        
        // PASO 5: Equipos encima
        const equipos = _core.getEquipos();
        equipos.forEach(eq => drawEquipment(_ctx, eq));
        
        // PASO 6: Leyenda
        drawLegend(_ctx);
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
        console.log('SmartFlowPFDRenderer v1.1 inicializado | Ruteo: Ortogonal | Saltos: ✅');
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
        getStreamRoutes: function() { return _streamRoutes; },
        getCrossings: function() { return _crossings; }
    };
})();
