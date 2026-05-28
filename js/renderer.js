
// ============================================================
// SMARTFLOW RENDERER v3.0 - Motor Isométrico 2.5D
// Archivo: js/renderer.js
// Mejoras: getEquipmentDrawBox unificado, AnnotationEngine direccional,
//          acotado 4 direcciones, radios de curvatura escalados,
//          100% equipos del catálogo, sin drawColector
// ============================================================

const SmartFlowRenderer = (function() {
    let _canvas = null;
    let _ctx = null;
    let _core = null;
    let _cam = { scale: 0.5, panX: 0, panY: 0 };
    let _currentElevation = 0;
    let _notifyUI = (msg, isErr) => console.log(msg);
    let _renderScheduled = false;
    let _cacheDirty = true;
    let _bomItems = [];
    let _allLinePoints = [];
    let _renderQueueCache = [];

    const COS30 = 0.86602540378;
    const SIN30 = 0.5;
    const SNAP_THRESHOLD = 15;
    let _activeSnap = null;
    let _hoveredComponent = null;
    let _hoveredComponentScreenPos = null;

    const ISO_CONFIG = {
        MATERIALS: { 'PPR': 'PP', 'CARBON_STEEL': 'CS', 'STAINLESS_STEEL': 'SS', 'POLIETILENO': 'PE', 'PVC': 'PV' },
        COLORS: { 'PP': '#10b981', 'CS': '#475569', 'SS': '#94a3b8', 'PE': '#1e293b', 'PV': '#7c3aed' }
    };

    // ============================================================
    // ANNOTATION ENGINE (Corregido: offsets direccionales)
    // ============================================================
    const AnnotationManager = {
        slots: [],
        occupiedBounds: [],
        minZoomForDetails: 0.3,
        minZoomForAll: 0.5,

        reset() {
            this.slots = [];
            this.occupiedBounds = [];
        },

        checkCollision(box) {
            for (const other of this.occupiedBounds) {
                if (!(box.x + box.w < other.x || box.x > other.x + other.w ||
                      box.y + box.h < other.y || box.y > other.y + other.h)) {
                    return true;
                }
            }
            return false;
        },

        getDirectionalOffsets(dir3D, w, h) {
            switch (dir3D) {
                case 'X': return [
                    { dx: 0, dy: -h - 10 }, { dx: 0, dy: h + 10 },
                    { dx: w + 15, dy: 0 }, { dx: -w - 15, dy: 0 }
                ];
                case 'Z': return [
                    { dx: w + 15, dy: 0 }, { dx: -w - 15, dy: 0 },
                    { dx: 0, dy: -h - 10 }, { dx: 0, dy: h + 10 }
                ];
                case 'Y': return [
                    { dx: -w - 15, dy: 0 }, { dx: w + 15, dy: 0 },
                    { dx: 0, dy: -h - 10 }, { dx: 0, dy: h + 10 }
                ];
            }
        },

        findBestPosition(preferredX, preferredY, w, h, dir3D, maxAttempts) {
            maxAttempts = maxAttempts || 8;
            const offsets = this.getDirectionalOffsets(dir3D, w, h);
            for (let i = 0; i < Math.min(maxAttempts, offsets.length); i++) {
                const candidate = {
                    x: preferredX + offsets[i].dx,
                    y: preferredY + offsets[i].dy,
                    w: w, h: h
                };
                if (!this.checkCollision(candidate)) {
                    return candidate;
                }
            }
            return { x: preferredX, y: preferredY, w: w, h: h };
        },

        register(anchor, dir3D, w, h, priority) {
            const best = this.findBestPosition(anchor.x, anchor.y, w, h, dir3D);
            best.priority = priority;
            this.occupiedBounds.push(best);
            this.slots.push(best);
            return best;
        },

        isVisible(priority) {
            if (priority <= 1) return true;
            if (_cam.scale < this.minZoomForDetails && priority > 1) return false;
            if (_cam.scale < this.minZoomForAll && priority >= 4) return false;
            return true;
        }
    };

    // ============================================================
    // PROYECCIÓN ISOMÉTRICA
    // ============================================================
    function project(p) {
        if (!p || p.x === undefined || p.y === undefined || p.z === undefined) return { x: 0, y: 0 };
        const x = (p.x - p.z) * COS30;
        const y = (p.x + p.z) * SIN30 - p.y;
        return { x: x * _cam.scale + _cam.panX, y: y * _cam.scale + _cam.panY };
    }

    function inverseProject(screenX, screenY, planeY) {
        planeY = planeY || _currentElevation;
        const X = (screenX - _cam.panX) / _cam.scale;
        const Y = (screenY - _cam.panY) / _cam.scale;
        const adjY = Y + (planeY * SIN30 * 2);
        const A = X / COS30;
        const B = adjY / SIN30;
        return { x: (A + B) / 2, y: planeY, z: (B - A) / 2 };
    }

    // ============================================================
    // UTILIDADES GRÁFICAS
    // ============================================================
    function adjustColor(color, percent) {
        const num = parseInt(color.replace("#",""), 16),
        amt = Math.round(2.55 * percent),
        R = (num >> 16) + amt, G = (num >> 8 & 0x00FF) + amt, B = (num & 0x0000FF) + amt;
        return "#" + (0x1000000 + (R<255?R<0?0:R:255)*0x10000 + (G<255?G<0?0:G:255)*0x100 + (B<255?B<0?0:B:255)).toString(16).slice(1);
    }

    function getMaterialGradient(ctx, p1, p2, material, diameter) {
        const proj1 = project(p1), proj2 = project(p2);
        const angle = Math.atan2(proj2.y - proj1.y, proj2.x - proj1.x) + Math.PI/2;
        const w = diameter * _cam.scale;
        const grad = ctx.createLinearGradient(
            proj1.x + Math.cos(angle)*w/2, proj1.y + Math.sin(angle)*w/2,
            proj1.x - Math.cos(angle)*w/2, proj1.y - Math.sin(angle)*w/2
        );
        const baseColor = ISO_CONFIG.COLORS[material] || '#94a3b8';
        if (material === 'PP') {
            grad.addColorStop(0, '#064e3b');
            grad.addColorStop(0.25, '#6ee7b7');
            grad.addColorStop(0.5, baseColor);
            grad.addColorStop(1, '#065f46');
        } else {
            grad.addColorStop(0, '#1a1a1a');
            grad.addColorStop(0.4, baseColor);
            grad.addColorStop(0.5, '#ffffffcc');
            grad.addColorStop(0.6, baseColor);
            grad.addColorStop(1, '#000000');
        }
        return grad;
    }

    function getShortMaterial(materialName) {
        const name = materialName ? materialName.toUpperCase() : '';
        return ISO_CONFIG.MATERIALS[name] || name.substring(0,2) || 'UN';
    }

    function formatDimensionText(dist) {
        if (dist < 1000) return Math.round(dist).toString();
        return (dist / 1000).toFixed(2) + "m";
    }

    function getComponentLabel(compType) {
        if (typeof SmartFlowCatalog !== 'undefined') {
            const catComp = SmartFlowCatalog.getComponent(compType);
            if (catComp && catComp.abbr) return catComp.abbr;
        }
        const fallback = {
            'GATE_VALVE':'GV','GLOBE_VALVE':'GL','BUTTERFLY_VALVE':'VB','BALL_VALVE':'BA',
            'CHECK_VALVE':'CK','DIAPHRAGM_VALVE':'DV','CONTROL_VALVE':'CV',
            'CONCENTRIC_REDUCER':'RC','ECCENTRIC_REDUCER':'RE',
            'WELD_NECK_FLANGE':'FL','SLIP_ON_FLANGE':'FL','BLIND_FLANGE':'FB','LAP_JOINT_FLANGE':'FL',
            'PRESSURE_GAUGE':'PG','TEMPERATURE_GAUGE':'TG','FLOW_METER':'FM',
            'TEE_EQUAL':'TE','TEE_REDUCING':'TR','CROSS':'CR','CAP':'CA',
            'ELBOW_90_LR':'EL','ELBOW_90_SR':'EL','ELBOW_45':'E4',
            'TRANSITION':'TR','UNION':'UN','BULKHEAD':'BH','Y_STRAINER':'YS',
            'LEVEL_SWITCH_RANA':'LS','PIPE_SHOE':'SH','U_BOLT':'UB','GUIDE':'GD','ANCHOR':'AN',
            'HANGER':'HG','PIPE_CLAMP':'PC','EXPANSION_JOINT':'EJ','FLEXIBLE_HOSE':'HO',
            'NIPPLE':'NI','STUB_END':'SE','CAMLOCK':'CM','QUICK_CONNECT':'QC',
            'STEAM_TRAP':'ST','SILENCER':'SI','FLAME_ARRESTER':'FA','VACUUM_BREAKER':'VB',
            'DRAIN_VALVE':'DV','AIR_RELEASE':'AR','SAMPLE_COOLER':'SC','SAMPLE_VALVE':'SV'
        };
        return fallback[compType] || (compType ? compType.substring(0,2) : '??');
    }

    function getSegmentDirection3D(p1, p2) {
        const dx = p2.x - p1.x, dy = p2.y - p1.y, dz = p2.z - p1.z;
        const absX = Math.abs(dx), absY = Math.abs(dy), absZ = Math.abs(dz);
        if (absY > absX && absY > absZ) return 'Y';
        return absX >= absZ ? 'X' : 'Z';
    }

    function getPipeOrientation(p1, p2) {
        const dx = Math.abs(p2.x - p1.x), dy = Math.abs(p2.y - p1.y), dz = Math.abs(p2.z - p1.z);
        return (dy > dx && dy > dz) ? 'vertical' : 'horizontal';
    }

    function getPointAtDistance(from, to, dist) {
        const d = Math.hypot(to.x-from.x, to.y-from.y, to.z-from.z);
        if (d === 0) return { ...from };
        const t = Math.min(dist/d, 0.5);
        return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t, z: from.z + (to.z - from.z) * t };
    }

    // ============================================================
    // CORREGIDO: Radio de curvatura escalado por cámara
    // ============================================================
    function getElbowRadius(diameter, isPPR) {
        const mmDiameter = diameter * 25.4;
        const baseRadius = isPPR ? mmDiameter * 0.8 : mmDiameter * 1.5;
        return Math.min(baseRadius, 350);
    }

    // ============================================================
    // CORREGIDO: Dimensiones normalizadas por tipo de equipo
    // ============================================================
    function getEquipmentDrawBox(eq) {
        switch (eq.tipo) {
            case 'tanque_v': case 'torre': case 'reactor':
            case 'desgasificador': case 'desmineralizador': case 'suavizador':
            case 'filtro_carbon': case 'filtro_arena': case 'clarificador':
            case 'columna_fraccionadora': case 'evaporador': case 'cristalizador':
            case 'absorbedor': case 'stripper': case 'reactor_encamisado':
            case 'autoclave': case 'agitador': case 'centrifuga_discos':
            case 'tanque_aseptico': case 'espesador': case 'separador': case 'antorcha':
                return { halfWidth: eq.diametro / 2, halfHeight: (eq.altura || 0) / 2, halfDepth: eq.diametro / 2 };
            case 'tanque_h': case 'separador_trifasico': case 'slug_catcher':
            case 'calentador_fuego_directo': case 'secador_rotativo':
            case 'centrifuga': case 'filtro_tambor': case 'molino':
                return { halfWidth: (eq.largo || 0) / 2, halfHeight: eq.diametro / 2, halfDepth: eq.diametro / 2 };
            case 'bomba': case 'bomba_dosificacion': case 'bomba_sumergible':
                return { halfWidth: 500, halfHeight: 500, halfDepth: 500 };
            case 'plataforma':
                return { halfWidth: (eq.largo || 6000) / 2, halfHeight: (eq.altura || 400) / 2, halfDepth: (eq.ancho || 3000) / 2 };
            default:
                return {
                    halfWidth: (eq.largo || eq.diametro || 1000) / 2,
                    halfHeight: (eq.altura || 1000) / 2,
                    halfDepth: (eq.ancho || eq.diametro || 1000) / 2
                };
        }
    }

    function isPointCollidingWithEquipment(point, margin) {
        margin = margin || 1500;
        if (!_core) return false;
        const db = _core.getDb(); if (!db || !db.equipos) return false;
        return db.equipos.some(function(eq) {
            const box = getEquipmentDrawBox(eq);
            const dx = Math.abs(point.x - eq.posX), dz = Math.abs(point.z - eq.posZ);
            return (dx <= box.halfWidth + margin && dz <= box.halfDepth + margin);
        });
    }

    function checkOffsetCollision(p1, p2, offset) {
        const midPoint = {
            x: (p1.x + p2.x) / 2 + offset.dx,
            y: (p1.y + p2.y) / 2 + offset.dy,
            z: (p1.z + p2.z) / 2 + offset.dz
        };
        return isPointCollidingWithEquipment(midPoint, 1200);
    }

    function lineHasAuditError(line) {
        if (!_core) return false;
        const db = _core.getDb();
        if (line.origin && line.origin.objTag) {
            const obj = _core.findObjectByTag(line.origin.objTag);
            const nz = obj && obj.puertos ? obj.puertos.find(function(p) { return p.id === line.origin.portId; }) : null;
            if (nz && nz.diametro !== line.diameter) return true;
        }
        if (line.destination && line.destination.objTag) {
            const obj = _core.findObjectByTag(line.destination.objTag);
            const nz = obj && obj.puertos ? obj.puertos.find(function(p) { return p.id === line.destination.portId; }) : null;
            if (nz && nz.diametro !== line.diameter) return true;
        }
        return false;
    }

    function resolvePipeEndpoints(line) {
        const rawPts = _core ? _core.getLinePoints(line) : (line._cachedPoints || line.points3D);
        if (!rawPts || rawPts.length < 2) return rawPts || [];
        const pts = rawPts.map(function(p) { return { x: p.x, y: p.y, z: p.z }; });

        if (line.origin && _core) {
            const obj = _core.findObjectByTag(line.origin.objTag);
            if (obj) {
                const puerto = obj.puertos ? obj.puertos.find(function(p) { return p.id === line.origin.portId; }) : null;
                if (puerto) {
                    const posBase = obj.posX !== undefined ? { x: obj.posX, y: obj.posY, z: obj.posZ } : (obj._cachedPoints && obj._cachedPoints[0] ? obj._cachedPoints[0] : { x: 0, y: 0, z: 0 });
                    pts[0] = {
                        x: posBase.x + (puerto.relX || (puerto.relPos ? puerto.relPos.x : 0) || 0),
                        y: posBase.y + (puerto.relY || (puerto.relPos ? puerto.relPos.y : 0) || 0),
                        z: posBase.z + (puerto.relZ || (puerto.relPos ? puerto.relPos.z : 0) || 0)
                    };
                }
            }
        }
        if (line.destination && _core) {
            const obj = _core.findObjectByTag(line.destination.objTag);
            if (obj) {
                const puerto = obj.puertos ? obj.puertos.find(function(p) { return p.id === line.destination.portId; }) : null;
                if (puerto) {
                    const posBase = obj.posX !== undefined ? { x: obj.posX, y: obj.posY, z: obj.posZ } : (obj._cachedPoints && obj._cachedPoints[0] ? obj._cachedPoints[0] : { x: 0, y: 0, z: 0 });
                    pts[pts.length - 1] = {
                        x: posBase.x + (puerto.relX || (puerto.relPos ? puerto.relPos.x : 0) || 0),
                        y: posBase.y + (puerto.relY || (puerto.relPos ? puerto.relPos.y : 0) || 0),
                        z: posBase.z + (puerto.relZ || (puerto.relPos ? puerto.relPos.z : 0) || 0)
                    };
                }
            }
        }
        return pts;
    }

    // ============================================================
    // DIBUJO DE GRILLA Y ORIGEN
    // ============================================================
    function drawGrid(elevation) {
        elevation = elevation || 0;
        const step = 1000;
        const minX = -10000, maxX = 20000, minZ = -10000, maxZ = 20000;
        _ctx.beginPath();
        _ctx.strokeStyle = '#1e293b';
        _ctx.lineWidth = 1;
        _ctx.globalAlpha = 0.15;
        for (let x = minX; x <= maxX; x += step) {
            const p1 = project({ x: x, y: elevation, z: minZ });
            const p2 = project({ x: x, y: elevation, z: maxZ });
            _ctx.moveTo(p1.x, p1.y); _ctx.lineTo(p2.x, p2.y);
        }
        for (let z = minZ; z <= maxZ; z += step) {
            const p1 = project({ x: minX, y: elevation, z: z });
            const p2 = project({ x: maxX, y: elevation, z: z });
            _ctx.moveTo(p1.x, p1.y); _ctx.lineTo(p2.x, p2.y);
        }
        _ctx.stroke();
        _ctx.globalAlpha = 1.0;
    }

    function drawOrigin() {
        const o = project({ x: 0, y: _currentElevation, z: 0 });
        _ctx.beginPath();
        _ctx.moveTo(o.x - 20, o.y); _ctx.lineTo(o.x + 20, o.y);
        _ctx.moveTo(o.x, o.y - 20); _ctx.lineTo(o.x, o.y + 20);
        _ctx.strokeStyle = '#ff8888'; _ctx.lineWidth = 2; _ctx.stroke();
        _ctx.fillStyle = '#ff8888'; _ctx.font = '14px monospace';
        _ctx.fillText('ORIGEN (0,' + (_currentElevation/1000) + 'm,0)', o.x + 15, o.y - 8);
    }

    // ============================================================
    // DIBUJO DE EQUIPOS
    // ============================================================
    function drawTank(eq) {
        const p = project({ x: eq.posX, y: eq.posY, z: eq.posZ });
        const box = getEquipmentDrawBox(eq);
        const w = box.halfWidth * _cam.scale;
        const h = box.halfHeight * 2 * _cam.scale;
        const topY = p.y - h/2;
        const bottomY = p.y + h/2;

        _ctx.beginPath(); _ctx.ellipse(p.x, bottomY, w, w*0.5, 0, 0, 2*Math.PI);
        const grad = _ctx.createLinearGradient(p.x - w, 0, p.x + w, 0);
        grad.addColorStop(0, '#1e40af'); grad.addColorStop(0.3, '#3b82f6');
        grad.addColorStop(0.7, '#60a5fa'); grad.addColorStop(1, '#1e40af');
        _ctx.fillStyle = grad; _ctx.fill(); _ctx.strokeStyle = '#fff'; _ctx.stroke();
        _ctx.fillStyle = '#1e40af'; _ctx.fillRect(p.x - w, topY, w, h);
        _ctx.fillStyle = '#3b82f6'; _ctx.fillRect(p.x, topY, w, h);
        _ctx.beginPath(); _ctx.ellipse(p.x, topY, w, w*0.5, 0, 0, 2*Math.PI);
        _ctx.fillStyle = '#60a5fa'; _ctx.fill(); _ctx.stroke();
        drawIsoText(eq.tag, p.x, topY - 10, 'XY');
        drawPuertos(eq);
        if (eq.accessories) eq.accessories.forEach(function(acc) { drawAccessory(acc, eq); });
    }

    function drawBomba(eq) {
        const p = project({ x: eq.posX, y: eq.posY, z: eq.posZ });
        const rad = 16 * _cam.scale;
        const grad = _ctx.createRadialGradient(p.x-3, p.y-3, 2, p.x, p.y, rad);
        grad.addColorStop(0, '#f39c12'); grad.addColorStop(1, '#b85c00');
        _ctx.fillStyle = grad; _ctx.beginPath(); _ctx.arc(p.x, p.y, rad, 0, 2*Math.PI); _ctx.fill();
        _ctx.strokeStyle = '#fff'; _ctx.stroke();
        _ctx.beginPath(); _ctx.moveTo(p.x-rad, p.y); _ctx.lineTo(p.x+rad, p.y); _ctx.stroke();
        drawIsoText(eq.tag, p.x + 20, p.y - 5, 'XY');
        drawPuertos(eq);
    }

    function drawCilindroHorizontal(eq) {
        const p = project({ x: eq.posX, y: eq.posY, z: eq.posZ });
        const box = getEquipmentDrawBox(eq);
        const w = box.halfWidth * _cam.scale;
        const h = box.halfDepth * _cam.scale;
        _ctx.fillStyle = '#2563eb'; _ctx.fillRect(p.x - w, p.y - h, w*2, h*2);
        _ctx.strokeStyle = 'white'; _ctx.strokeRect(p.x - w, p.y - h, w*2, h*2);
        _ctx.beginPath(); _ctx.ellipse(p.x - w, p.y, h, h*0.5, 0, 0, 2*Math.PI);
        _ctx.fillStyle = '#2563eb'; _ctx.fill(); _ctx.stroke();
        _ctx.beginPath(); _ctx.ellipse(p.x + w, p.y, h, h*0.5, 0, 0, 2*Math.PI);
        _ctx.fillStyle = '#2563eb'; _ctx.fill(); _ctx.stroke();
        drawIsoText(eq.tag, p.x, p.y - h - 5, 'XY');
        drawPuertos(eq);
    }

    function drawRectEquip(eq, color) {
        const p = project({ x: eq.posX, y: eq.posY, z: eq.posZ });
        const box = getEquipmentDrawBox(eq);
        const w = box.halfWidth * _cam.scale;
        const h = box.halfHeight * _cam.scale;
        _ctx.fillStyle = color; _ctx.fillRect(p.x-w, p.y-h, w*2, h*2);
        _ctx.strokeStyle = 'white'; _ctx.strokeRect(p.x-w, p.y-h, w*2, h*2);
        drawIsoText(eq.tag, p.x, p.y - h - 5, 'XY');
        drawPuertos(eq);
    }

    function drawPlataforma(eq) {
        const p = project({ x: eq.posX, y: eq.posY, z: eq.posZ });
        const box = getEquipmentDrawBox(eq);
        const w = box.halfWidth * _cam.scale;
        const d = box.halfDepth * _cam.scale;
        const h = box.halfHeight * 2 * _cam.scale;
        const material = (eq.material || '').toUpperCase();
        const esConcreto = material.includes('CONCRETO') || material.includes('CEMENTO');
        const topY = p.y - h;

        _ctx.fillStyle = 'rgba(0,0,0,0.15)';
        _ctx.beginPath();
        _ctx.moveTo(p.x - w + 2, topY + 2); _ctx.lineTo(p.x - w + d * 0.5 + 2, topY - d * 0.25 + 2);
        _ctx.lineTo(p.x + d * 0.5 + 2, topY - d * 0.25 + 2); _ctx.lineTo(p.x + w + 2, topY + 2);
        _ctx.lineTo(p.x + d * 0.5 + 2, topY + d * 0.25 + 2); _ctx.lineTo(p.x - w + d * 0.5 + 2, topY + d * 0.25 + 2);
        _ctx.closePath(); _ctx.fill();

        _ctx.fillStyle = esConcreto ? '#9ca3af' : '#6b7280';
        _ctx.strokeStyle = esConcreto ? '#6b7280' : '#4b5563'; _ctx.lineWidth = 1.5;
        _ctx.beginPath();
        _ctx.moveTo(p.x - w, topY); _ctx.lineTo(p.x - w + d * 0.5, topY - d * 0.25);
        _ctx.lineTo(p.x + d * 0.5, topY - d * 0.25); _ctx.lineTo(p.x + w, topY);
        _ctx.lineTo(p.x + d * 0.5, topY + d * 0.25); _ctx.lineTo(p.x - w + d * 0.5, topY + d * 0.25);
        _ctx.closePath(); _ctx.fill(); _ctx.stroke();

        _ctx.strokeStyle = esConcreto ? '#6b7280' : '#4b5563'; _ctx.lineWidth = 1.5;
        const patas = [
            { x: eq.posX - box.halfWidth, z: eq.posZ - box.halfDepth },
            { x: eq.posX + box.halfWidth, z: eq.posZ - box.halfDepth },
            { x: eq.posX + box.halfWidth, z: eq.posZ + box.halfDepth },
            { x: eq.posX - box.halfWidth, z: eq.posZ + box.halfDepth }
        ];
        patas.forEach(function(pta) {
            const top = project({ x: pta.x, y: eq.posY - (eq.altura || 400), z: pta.z });
            const bot = project({ x: pta.x, y: eq.posY, z: pta.z });
            _ctx.beginPath(); _ctx.moveTo(top.x, top.y); _ctx.lineTo(bot.x, bot.y); _ctx.stroke();
        });

        drawIsoText(eq.tag, p.x, topY - 25, 'XY');
    }

    function drawAccessory(acc, parentEq) {
        const pos = { x: parentEq.posX + (acc.relX || 0), y: parentEq.posY + (acc.relY || 0), z: parentEq.posZ + (acc.relZ || 0) };
        const proj = project(pos);
        _ctx.strokeStyle = '#64748b'; _ctx.lineWidth = 1; _ctx.setLineDash([4, 4]);
        _ctx.beginPath();
        if (acc.type === 'CAGED_LADDER') { _ctx.moveTo(proj.x, proj.y); _ctx.lineTo(proj.x, proj.y - 40 * _cam.scale); }
        _ctx.stroke(); _ctx.setLineDash([]);
    }

    function drawPuertos(obj) {
        if (!obj.puertos) return;
        const posBase = obj.posX !== undefined ? { x: obj.posX, y: obj.posY, z: obj.posZ } : (obj._cachedPoints && obj._cachedPoints.length > 0 ? obj._cachedPoints[0] : { x: 0, y: 0, z: 0 });
        obj.puertos.forEach(function(nz) {
            const pos = { x: posBase.x + (nz.relX || (nz.relPos ? nz.relPos.x : 0) || 0), y: posBase.y + (nz.relY || (nz.relPos ? nz.relPos.y : 0) || 0), z: posBase.z + (nz.relZ || (nz.relPos ? nz.relPos.z : 0) || 0) };
            const proj = project(pos);
            if (nz.orientacion) {
                const dir = nz.orientacion;
                const endPos = { x: pos.x + dir.dx * 250, y: pos.y + dir.dy * 250, z: pos.z + dir.dz * 250 };
                const projEnd = project(endPos);
                _ctx.beginPath(); _ctx.moveTo(proj.x, proj.y); _ctx.lineTo(projEnd.x, projEnd.y);
                _ctx.strokeStyle = '#ffaa00'; _ctx.lineWidth = 2; _ctx.stroke();
                const angle = Math.atan2(projEnd.y - proj.y, projEnd.x - proj.x);
                const arrowSize = 8;
                _ctx.beginPath();
                _ctx.moveTo(projEnd.x, projEnd.y);
                _ctx.lineTo(projEnd.x - arrowSize * Math.cos(angle - 0.5), projEnd.y - arrowSize * Math.sin(angle - 0.5));
                _ctx.lineTo(projEnd.x - arrowSize * Math.cos(angle + 0.5), projEnd.y - arrowSize * Math.sin(angle + 0.5));
                _ctx.closePath(); _ctx.fillStyle = '#ffaa00'; _ctx.fill();
            }
            _ctx.beginPath(); _ctx.arc(proj.x, proj.y, 6, 0, 2*Math.PI);
            _ctx.fillStyle = nz.connectedLine ? '#4ade80' : '#ff8800'; _ctx.fill();
            _ctx.strokeStyle = '#fff'; _ctx.lineWidth = 1; _ctx.stroke();
            drawIsoText(nz.id + ' ' + (nz.diametro || obj.diameter || 3) + '"', proj.x - 12, proj.y - 6, 'XY');
        });
    }

    function drawIsoText(text, x, y, plane) {
        if (!text) return;
        plane = plane || 'XY';
        _ctx.save();
        _ctx.font = 'bold ' + Math.max(12, 14 * _cam.scale) + 'px \'Segoe UI\', monospace';
        _ctx.textAlign = 'center'; _ctx.textBaseline = 'bottom';
        if (plane === 'XY') { _ctx.setTransform(1, 0.5, 0, 1, x, y); }
        else if (plane === 'ZY') { _ctx.setTransform(1, -0.5, 0, 1, x, y); }
        else { _ctx.setTransform(1, -0.5, 1, 0.5, x, y); }
        const tw = _ctx.measureText(text).width;
        _ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
        _ctx.fillRect(-tw/2 - 6, -16, tw + 12, 20);
        _ctx.strokeStyle = 'rgba(51, 65, 85, 0.5)'; _ctx.lineWidth = 1;
        _ctx.strokeRect(-tw/2 - 6, -16, tw + 12, 20);
        if (_cam.scale < 0.3) { _ctx.globalAlpha = 0.12; }
        else if (_cam.scale < 0.7) { _ctx.globalAlpha = 0.18 + (_cam.scale - 0.3) * 1.3; }
        else { _ctx.globalAlpha = 0.65; }
        _ctx.fillStyle = '#ffffff';
        _ctx.fillText(text, 0, 0);
        _ctx.globalAlpha = 1.0;
        _ctx.restore(); _ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    function drawFlowArrow(p1, p2) {
        if (!p1 || !p2) return;
        const proj1 = project(p1), proj2 = project(p2);
        const angle = Math.atan2(proj2.y - proj1.y, proj2.x - proj1.x);
        const midX = (proj1.x + proj2.x) / 2, midY = (proj1.y + proj2.y) / 2;
        _ctx.save(); _ctx.translate(midX, midY); _ctx.rotate(angle);
        const arrowSize = 12 * _cam.scale;
        _ctx.beginPath();
        _ctx.moveTo(-arrowSize, -arrowSize/2); _ctx.lineTo(0, 0); _ctx.lineTo(-arrowSize, arrowSize/2);
        _ctx.fillStyle = '#00f2ff'; _ctx.shadowColor = '#00f2ff'; _ctx.shadowBlur = 8;
        _ctx.fill(); _ctx.shadowBlur = 0; _ctx.restore();
    }

    // ============================================================
    // DIBUJO DE TUBERÍAS CON CODOS AUTOMÁTICOS
    // ============================================================
    function drawPipeWithElbows(line) {
        const pts = resolvePipeEndpoints(line);
        if (!pts || pts.length < 2) return;

        const isPPR = line.material === 'PPR' || (line.spec && line.spec.includes('PPR'));
        const radio = getElbowRadius(line.diameter, isPPR);
        const baseWidth = (line.diameter || 4) * _cam.scale;
        const mainWidth = Math.max(6, baseWidth);
        _ctx.lineCap = 'round'; _ctx.lineJoin = 'round';
        const hasAuditError = lineHasAuditError(line);
        const matShort = getShortMaterial(line.material);
        const lineLabel = line.service ? line.diameter + '"-' + line.service : line.diameter + '"-' + matShort;

        const drawPath = function() {
            _ctx.beginPath();
            let first = project(pts[0]); _ctx.moveTo(first.x, first.y);
            for (let i = 1; i < pts.length - 1; i++) {
                const pPrev = pts[i-1], pCurr = pts[i], pNext = pts[i+1];
                if (pCurr.isControlPoint && i + 1 < pts.length) {
                    const cp = project(pCurr), nextP = project(pts[i+1]);
                    _ctx.quadraticCurveTo(cp.x, cp.y, nextP.x, nextP.y); i++;
                } else {
                    const pIn = getPointAtDistance(pCurr, pPrev, radio), pOut = getPointAtDistance(pCurr, pNext, radio);
                    const projIn = project(pIn), projOut = project(pOut), projCurr = project(pCurr);
                    _ctx.lineTo(projIn.x, projIn.y); _ctx.quadraticCurveTo(projCurr.x, projCurr.y, projOut.x, projOut.y);
                }
            }
            _ctx.lineTo(project(pts[pts.length-1]).x, project(pts[pts.length-1]).y);
        };

        const grad = getMaterialGradient(_ctx, pts[0], pts[pts.length-1], matShort, mainWidth*2);

        _ctx.save(); drawPath();
        _ctx.shadowColor = '#00000066'; _ctx.shadowBlur = 14 * _cam.scale;
        _ctx.shadowOffsetX = 0; _ctx.shadowOffsetY = 8 * _cam.scale;
        _ctx.strokeStyle = '#00000044'; _ctx.lineWidth = mainWidth + 10; _ctx.stroke(); _ctx.restore();

        drawPath(); _ctx.strokeStyle = '#0a0e17'; _ctx.lineWidth = mainWidth + 4; _ctx.stroke();
        drawPath(); _ctx.strokeStyle = '#1e293b'; _ctx.lineWidth = mainWidth + 2; _ctx.stroke();
        drawPath(); _ctx.strokeStyle = grad; _ctx.lineWidth = mainWidth; _ctx.stroke();
        drawPath(); _ctx.strokeStyle = 'rgba(255,255,255,0.25)'; _ctx.lineWidth = mainWidth * 0.45; _ctx.stroke();
        drawPath(); _ctx.strokeStyle = '#ffffff'; _ctx.lineWidth = Math.max(1.2, mainWidth * 0.12); _ctx.globalAlpha = 0.85; _ctx.stroke(); _ctx.globalAlpha = 1.0;

        if (isPPR && line.components && line.components.length > 0) {
            line.components.forEach(function(comp) {
                if (comp.param === undefined || comp.param === null) return;
                let targetLen = 0;
                for (let i = 0; i < pts.length - 1; i++) targetLen += Math.hypot(pts[i+1].x-pts[i].x, pts[i+1].y-pts[i].y, pts[i+1].z-pts[i].z);
                if (targetLen === 0) return;
                const compPos = getPointAtDistance(pts[0], pts[pts.length-1], targetLen * comp.param);
                if (!compPos) return;
                const projComp = project(compPos);
                _ctx.beginPath(); _ctx.arc(projComp.x, projComp.y, mainWidth * 0.9, 0, Math.PI*2);
                _ctx.fillStyle = '#065f46'; _ctx.fill(); _ctx.strokeStyle = '#034028'; _ctx.lineWidth = 1.5; _ctx.stroke();
            });
        }

        if (hasAuditError && pts.length >= 2) {
            const midIndex = Math.floor(pts.length / 2);
            const alertPt = pts[midIndex];
            const projAlert = project(alertPt);
            _ctx.save(); _ctx.translate(projAlert.x, projAlert.y - 30*_cam.scale);
            _ctx.font = 'bold ' + Math.max(16,20*_cam.scale) + 'px "Segoe UI"'; _ctx.textAlign = 'center'; _ctx.textBaseline = 'middle';
            _ctx.shadowColor = '#ef4444'; _ctx.shadowBlur = 10; _ctx.fillStyle = '#ef4444';
            _ctx.fillText('⚠', 0, 0); _ctx.shadowBlur = 0; _ctx.restore();
        }

        const isSelected = _core && _core.getSelected() && _core.getSelected().obj === line;
        if (line.showDimensions !== false && !isSelected && AnnotationManager.isVisible(1)) {
            const puntosReales = pts.filter(function(p) { return !p.isControlPoint; });
            for (let i = 0; i < puntosReales.length - 1; i++) {
                const p1 = puntosReales[i], p2 = puntosReales[i+1];
                if (Math.hypot(p2.x-p1.x, p2.y-p1.y, p2.z-p1.z) > 100) drawIsometricDimension(p1, p2);
            }
        }

        if (pts.length >= 2) drawFlowArrow(pts[0], pts[pts.length-1]);
        if (lineLabel && pts.length >= 2 && AnnotationManager.isVisible(3)) {
            const midPt = getPointAtDistance(pts[0], pts[pts.length-1], Math.hypot(pts[pts.length-1].x-pts[0].x, pts[pts.length-1].y-pts[0].y, pts[pts.length-1].z-pts[0].z)/2);
            const projMid = project(midPt);
            const plane = Math.abs(pts[1].x-pts[0].x) > Math.abs(pts[1].z-pts[0].z) ? 'XY' : 'ZY';
            drawIsoText(lineLabel, projMid.x, projMid.y - 25*_cam.scale, plane);
        }
        if (line.puertos) drawPuertos(line);
    }

    function drawPipeComponents(line) {
        if (!_core) return;
        const pts = _core.getLinePoints(line);
        if (!pts || pts.length < 2 || !line.components) return;
        let lengths = [], totalLen = 0;
        for (let i = 0; i < pts.length - 1; i++) {
            let d = Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y, pts[i+1].z - pts[i].z);
            lengths.push(d); totalLen += d;
        }
        if (totalLen === 0) return;
        line.components.forEach(function(comp, idx) {
            let targetLen = totalLen * Math.min(1, Math.max(0, comp.param || 0.5));
            let currentAccum = 0, p1, p2, t = 0;
            for (let i = 0; i < lengths.length; i++) {
                if (currentAccum + lengths[i] >= targetLen || i === lengths.length - 1) {
                    p1 = pts[i]; p2 = pts[i+1];
                    let segLen = lengths[i]; t = segLen > 0 ? (targetLen - currentAccum) / segLen : 0;
                    t = Math.min(1, Math.max(0, t)); break;
                }
                currentAccum += lengths[i];
            }
            if (!p1 || !p2) return;
            const pos3D = { x: p1.x + (p2.x-p1.x)*t, y: p1.y + (p2.y-p1.y)*t, z: p1.z + (p2.z-p1.z)*t };
            const proj = project(pos3D);
            const dir3D = getSegmentDirection3D(p1, p2);
            const isHovered = _hoveredComponent && _hoveredComponent.comp === comp;
            _ctx.save();
            if (isHovered) { _ctx.shadowColor = '#fbbf24'; _ctx.shadowBlur = 18; _ctx.globalAlpha = 1.0; }
            else { _ctx.shadowColor = 'transparent'; _ctx.shadowBlur = 0; _ctx.globalAlpha = 0.55; }
            drawSymbol(proj.x, proj.y, dir3D, comp);
            _ctx.restore();
            comp._screenPos = proj;
            if (AnnotationManager.isVisible(3)) {
                const globalIndex = _bomItems.length + 1;
                drawComponentTag(proj, globalIndex, comp.type, dir3D);
                comp._bomIndex = globalIndex;
                _bomItems.push({ index: globalIndex, desc: getComponentLabel(comp.type), mat: getShortMaterial(line.material), comp: comp });
            }
        });
    }

    function drawSymbol(x, y, dir3D, comp) {
        _ctx.save();
        const s = Math.max(10, 16 * _cam.scale);
        _ctx.lineWidth = 1.8; _ctx.strokeStyle = '#e2e8f0'; _ctx.fillStyle = '#0f172a';
        if (dir3D === 'X') { _ctx.setTransform(1, 0.5, 0, 1, x, y); }
        else if (dir3D === 'Z') { _ctx.setTransform(1, -0.5, 0, 1, x, y); }
        else if (dir3D === 'Y') { _ctx.setTransform(0, 1, -1, 0, x, y); }

        switch (comp.type) {
            case 'BUTTERFLY_VALVE':
                _ctx.beginPath(); _ctx.ellipse(0, 0, s*0.9, s*0.3, 0, 0, Math.PI*2); _ctx.fill(); _ctx.stroke();
                _ctx.beginPath(); _ctx.moveTo(0,0); _ctx.lineTo(0, -s*1.6); _ctx.strokeStyle = '#ef4444'; _ctx.lineWidth = 2.5; _ctx.stroke();
                _ctx.beginPath(); _ctx.moveTo(-s*0.8, -s*1.6); _ctx.lineTo(s*0.8, -s*1.6); _ctx.stroke();
                _ctx.fillStyle = '#fbbf24'; _ctx.beginPath(); _ctx.arc(0, -s*1.6, 3, 0, Math.PI*2); _ctx.fill();
                break;
            case 'BALL_VALVE': case 'VALVE_BALL':
                const ballGrad = _ctx.createRadialGradient(-s*0.15, -s*0.15, s*0.05, 0, 0, s*0.65);
                ballGrad.addColorStop(0, '#ffffff'); ballGrad.addColorStop(0.6, '#94a3b8'); ballGrad.addColorStop(1, '#1e293b');
                _ctx.beginPath(); _ctx.arc(0, 0, s*0.65, 0, Math.PI*2); _ctx.fillStyle = ballGrad; _ctx.fill(); _ctx.stroke();
                _ctx.beginPath(); _ctx.moveTo(-s, -s*0.55); _ctx.lineTo(-s, s*0.55); _ctx.lineTo(0, 0); _ctx.closePath();
                _ctx.moveTo(s, -s*0.55); _ctx.lineTo(s, s*0.55); _ctx.lineTo(0, 0); _ctx.closePath();
                _ctx.fillStyle = '#1e293b'; _ctx.fill(); _ctx.stroke();
                _ctx.beginPath(); _ctx.moveTo(0, -s*0.35); _ctx.lineTo(0, -s*1.3); _ctx.lineTo(s*0.7, -s*1.3);
                _ctx.strokeStyle = '#f8fafc'; _ctx.lineWidth = 2; _ctx.stroke();
                break;
            case 'GATE_VALVE':
                _ctx.beginPath(); _ctx.moveTo(-s, -s*0.6); _ctx.lineTo(s, s*0.6); _ctx.lineTo(s, -s*0.6); _ctx.lineTo(-s, s*0.6); _ctx.closePath();
                _ctx.fill(); _ctx.stroke();
                _ctx.beginPath(); _ctx.moveTo(0, 0); _ctx.lineTo(0, -s*1.4); _ctx.moveTo(-s*0.6, -s*1.4); _ctx.lineTo(s*0.6, -s*1.4); _ctx.stroke();
                _ctx.fillStyle = '#fbbf24'; _ctx.beginPath(); _ctx.arc(0, -s*1.4, 3.5, 0, Math.PI*2); _ctx.fill();
                break;
            case 'GLOBE_VALVE':
                _ctx.beginPath(); _ctx.ellipse(0, 0, s*0.9, s*0.55, 0, 0, Math.PI*2); _ctx.fill(); _ctx.stroke();
                _ctx.beginPath(); _ctx.moveTo(0, -s*0.55); _ctx.lineTo(0, s*0.55); _ctx.strokeStyle = '#e2e8f0'; _ctx.stroke();
                _ctx.fillStyle = '#1e293b'; _ctx.fillRect(-s*0.35, -s*1.2, s*0.7, s*0.55); _ctx.strokeRect(-s*0.35, -s*1.2, s*0.7, s*0.55);
                _ctx.beginPath(); _ctx.moveTo(-s*0.2, -s*1.2); _ctx.lineTo(s*0.2, -s*1.2); _ctx.stroke();
                break;
            case 'CHECK_VALVE':
                _ctx.strokeRect(-s, -s*0.45, s*2, s*0.9);
                _ctx.fillStyle = '#4ade80'; _ctx.beginPath();
                _ctx.moveTo(-s*0.5, 0); _ctx.lineTo(s*0.3, -s*0.3); _ctx.lineTo(s*0.3, s*0.3); _ctx.closePath();
                _ctx.fill(); _ctx.stroke();
                _ctx.setLineDash([2,2]); _ctx.beginPath(); _ctx.moveTo(-s, 0); _ctx.lineTo(-s*0.5, 0); _ctx.stroke(); _ctx.setLineDash([]);
                break;
            case 'CONCENTRIC_REDUCER': case 'ECCENTRIC_REDUCER':
                const reducGrad = _ctx.createLinearGradient(-s, 0, s, 0);
                reducGrad.addColorStop(0, '#475569'); reducGrad.addColorStop(1, '#94a3b8');
                _ctx.beginPath(); _ctx.moveTo(-s, -s*0.5); _ctx.lineTo(s, -s*0.8); _ctx.lineTo(s, s*0.8); _ctx.lineTo(-s, s*0.5); _ctx.closePath();
                _ctx.fillStyle = reducGrad; _ctx.fill(); _ctx.stroke();
                if (comp.type === 'ECCENTRIC_REDUCER') { _ctx.beginPath(); _ctx.moveTo(-s, -s*0.5); _ctx.lineTo(-s, s*0.5); _ctx.strokeStyle = '#facc15'; _ctx.lineWidth = 2; _ctx.stroke(); }
                break;
            case 'WELD_NECK_FLANGE':
                _ctx.fillRect(-s*0.3, -s*0.9, s*0.6, s*1.8); _ctx.strokeRect(-s*0.3, -s*0.9, s*0.6, s*1.8);
                for (let py = -0.7; py <= 0.7; py += 0.45) { _ctx.beginPath(); _ctx.arc(-s*0.5, py*s, 1.5, 0, Math.PI*2); _ctx.fillStyle = '#64748b'; _ctx.fill(); _ctx.beginPath(); _ctx.arc(s*0.5, py*s, 1.5, 0, Math.PI*2); _ctx.fill(); }
                break;
            case 'SLIP_ON_FLANGE': case 'BLIND_FLANGE': case 'LAP_JOINT_FLANGE':
                _ctx.beginPath(); _ctx.moveTo(-s*0.4, -s); _ctx.lineTo(-s*0.4, s); _ctx.moveTo(s*0.4, -s); _ctx.lineTo(s*0.4, s); _ctx.lineWidth = 1; _ctx.stroke();
                _ctx.fillRect(-s*0.7, -s*0.9, s*1.4, s*1.8); _ctx.strokeRect(-s*0.7, -s*0.9, s*1.4, s*1.8);
                if (comp.type === 'BLIND_FLANGE') { _ctx.beginPath(); _ctx.moveTo(-s*0.5,-s*0.7); _ctx.lineTo(s*0.5,s*0.7); _ctx.moveTo(s*0.5,-s*0.7); _ctx.lineTo(-s*0.5,s*0.7); _ctx.stroke(); }
                break;
            case 'TEE_EQUAL': case 'TEE_REDUCING': case 'TEE_PPR':
                _ctx.beginPath(); _ctx.moveTo(-s*0.9, 0); _ctx.lineTo(s*0.9, 0); _ctx.moveTo(0, 0); _ctx.lineTo(0, -s*1.3);
                _ctx.strokeStyle = '#f8fafc'; _ctx.lineWidth = 2.5; _ctx.stroke();
                _ctx.fillStyle = '#fbbf24'; _ctx.beginPath(); _ctx.arc(0, 0, s*0.3, 0, Math.PI*2); _ctx.fill(); _ctx.stroke();
                if (comp.type === 'TEE_REDUCING') { _ctx.fillStyle = '#facc15'; _ctx.beginPath(); _ctx.arc(0, -s*1.3, s*0.25, 0, Math.PI*2); _ctx.fill(); }
                break;
            case 'ELBOW_45': case 'ELBOW_45_PPR':
                _ctx.beginPath(); _ctx.arc(0, 0, s, 0, Math.PI/4); _ctx.strokeStyle = '#f8fafc'; _ctx.lineWidth = 2.5; _ctx.stroke();
                _ctx.beginPath(); _ctx.arc(0, 0, s, 0, Math.PI/4); _ctx.strokeStyle = '#ffffff'; _ctx.lineWidth = 0.8; _ctx.globalAlpha = 0.5; _ctx.stroke(); _ctx.globalAlpha = 1;
                _ctx.fillStyle = '#ffffff'; _ctx.beginPath(); _ctx.arc(0, 0, 3, 0, Math.PI*2); _ctx.fill();
                break;
            case 'ELBOW_90_LR': case 'ELBOW_90_SR': case 'ELBOW_90_PPR': case 'CODO_90_ACERO_3IN':
                const r = comp.type === 'ELBOW_90_LR' ? s*1.3 : s*0.8;
                _ctx.beginPath(); _ctx.arc(0, 0, r, 0, Math.PI/2); _ctx.strokeStyle = '#f8fafc'; _ctx.lineWidth = 2.5; _ctx.stroke();
                _ctx.beginPath(); _ctx.arc(0, 0, r, 0, Math.PI/2); _ctx.strokeStyle = '#ffffff'; _ctx.lineWidth = 0.8; _ctx.globalAlpha = 0.5; _ctx.stroke(); _ctx.globalAlpha = 1;
                _ctx.fillStyle = '#ffffff'; _ctx.beginPath(); _ctx.arc(0, 0, 3, 0, Math.PI*2); _ctx.fill();
                break;
            case 'CAP':
                _ctx.beginPath(); _ctx.arc(0, 0, s*0.7, 0, Math.PI, true); _ctx.closePath(); _ctx.fill(); _ctx.stroke();
                _ctx.beginPath(); _ctx.moveTo(-s*0.7, 0); _ctx.lineTo(-s*1.1, 0); _ctx.moveTo(s*0.7, 0); _ctx.lineTo(s*1.1, 0); _ctx.stroke();
                break;
            case 'UNION': case 'UNION_ACERO':
                _ctx.fillRect(-s*0.7, -s*0.7, s*1.4, s*1.4); _ctx.strokeRect(-s*0.7, -s*0.7, s*1.4, s*1.4);
                for (let i = -0.5; i <= 0.5; i += 0.25) { _ctx.beginPath(); _ctx.moveTo(-s*0.7, i*s); _ctx.lineTo(s*0.7, i*s); _ctx.strokeStyle = '#334155'; _ctx.lineWidth = 1; _ctx.stroke(); }
                break;
            case 'BULKHEAD':
                _ctx.beginPath(); _ctx.moveTo(-s*0.25, -s*1.3); _ctx.lineTo(-s*0.25, s*1.3); _ctx.lineWidth = 5; _ctx.strokeStyle = '#94a3b8'; _ctx.stroke();
                _ctx.lineWidth = 1.8; _ctx.strokeStyle = '#e2e8f0'; _ctx.strokeRect(-s*1.1, -s*0.6, s*2.2, s*1.2);
                break;
            case 'TRANSITION': case 'ADAPTADOR_MACHO_PPR_3IN': case 'ADAPTADOR_HEMBRA_PPR_3IN':
                _ctx.beginPath(); _ctx.moveTo(-s, -s*0.6); _ctx.lineTo(s*0.2, -s*0.8); _ctx.lineTo(s*0.2, s*0.8); _ctx.lineTo(-s, s*0.6); _ctx.closePath();
                _ctx.fillStyle = '#1e293b'; _ctx.fill(); _ctx.stroke();
                _ctx.beginPath(); _ctx.moveTo(s*0.2, -s*0.6); _ctx.lineTo(s*0.9, -s*0.6); _ctx.lineTo(s*0.9, s*0.6); _ctx.lineTo(s*0.2, s*0.6);
                _ctx.fillStyle = '#475569'; _ctx.fill(); _ctx.stroke();
                break;
            case 'NIPPLE':
                _ctx.fillRect(-s*0.9, -s*0.45, s*1.8, s*0.9); _ctx.strokeRect(-s*0.9, -s*0.45, s*1.8, s*0.9);
                for (let i = -0.3; i <= 0.3; i += 0.2) { _ctx.beginPath(); _ctx.moveTo(-s*0.9, i*s); _ctx.lineTo(s*0.9, i*s); _ctx.strokeStyle = '#475569'; _ctx.lineWidth = 1; _ctx.stroke(); }
                break;
            case 'EXPANSION_JOINT':
                _ctx.fillRect(-s*0.8, -s*0.7, s*1.6, s*1.4); _ctx.strokeRect(-s*0.8, -s*0.7, s*1.6, s*1.4);
                for (let i = -0.55; i <= 0.55; i += 0.35) { _ctx.beginPath(); _ctx.moveTo(-s*0.8, i*s); _ctx.lineTo(s*0.8, i*s); _ctx.strokeStyle = '#fbbf24'; _ctx.lineWidth = 1; _ctx.stroke(); }
                break;
            case 'Y_STRAINER':
                _ctx.beginPath(); _ctx.moveTo(-s, 0); _ctx.lineTo(0, -s*0.9); _ctx.lineTo(s, 0); _ctx.lineTo(0, s*0.4); _ctx.closePath();
                _ctx.fill(); _ctx.stroke();
                _ctx.beginPath(); _ctx.moveTo(-s, 0); _ctx.lineTo(s, 0); _ctx.strokeStyle = '#4ade80'; _ctx.lineWidth = 2; _ctx.stroke();
                break;
            case 'PIPE_SHOE': case 'U_BOLT': case 'GUIDE': case 'ANCHOR': case 'HANGER': case 'PIPE_CLAMP': case 'SPRING_HANGER':
                _ctx.strokeStyle = '#64748b'; _ctx.lineWidth = 1.2; _ctx.setLineDash([3, 3]);
                _ctx.beginPath(); _ctx.moveTo(-s*0.9, 0); _ctx.lineTo(s*0.9, 0);
                if (comp.type === 'ANCHOR') { _ctx.moveTo(-s*0.6, -s*0.5); _ctx.lineTo(-s*0.6, s*0.5); _ctx.moveTo(s*0.6, -s*0.5); _ctx.lineTo(s*0.6, s*0.5); }
                _ctx.stroke(); _ctx.setLineDash([]);
                break;
            default:
                _ctx.fillRect(-s*0.8, -s*0.8, s*1.6, s*1.6); _ctx.strokeRect(-s*0.8, -s*0.8, s*1.6, s*1.6);
                const lbl = getComponentLabel(comp.type);
                _ctx.fillStyle = '#ffffff'; _ctx.font = 'bold ' + Math.max(8, s*0.7) + 'px Inter'; _ctx.textAlign = 'center'; _ctx.textBaseline = 'middle';
                _ctx.fillText(lbl, 0, 0);
        }
        _ctx.restore(); _ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    function drawComponentTag(proj2d, index, compType, dir3D) {
        const tagText = '' + index;
        const leaderX = proj2d.x + 25, leaderY = proj2d.y - 25;
        _ctx.save(); _ctx.setTransform(1, 0, 0, 1, 0, 0);
        _ctx.strokeStyle = '#94a3b8'; _ctx.lineWidth = 0.8;
        _ctx.beginPath(); _ctx.moveTo(proj2d.x, proj2d.y); _ctx.lineTo(leaderX, leaderY); _ctx.stroke();
        _ctx.fillStyle = '#0f172a'; _ctx.strokeStyle = '#38bdf8'; _ctx.lineWidth = 1;
        const boxW = 22, boxH = 14;
        _ctx.fillRect(leaderX - boxW/2, leaderY - boxH/2, boxW, boxH); _ctx.strokeRect(leaderX - boxW/2, leaderY - boxH/2, boxW, boxH);
        _ctx.fillStyle = '#ffffff'; _ctx.font = 'bold 8px Inter'; _ctx.textAlign = 'center'; _ctx.textBaseline = 'middle';
        _ctx.fillText(tagText, leaderX, leaderY);
        _ctx.restore(); _ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    // ============================================================
    // DIMENSIONES ISOMÉTRICAS (Corregido: 4 direcciones)
    // ============================================================
    function drawIsometricDimension(p1, p2) {
        const realDist = Math.hypot(p2.x - p1.x, p2.y - p1.y, p2.z - p1.z);
        if (realDist < 50) return;
        const orientation = getPipeOrientation(p1, p2);
        const finalOffset = Math.max(600, Math.min(3000, realDist * 0.4));
        const candidates = orientation === 'horizontal'
            ? [{ dx: 0, dy: -finalOffset, dz: 0 }, { dx: 0, dy: finalOffset, dz: 0 }, { dx: finalOffset, dy: 0, dz: 0 }, { dx: -finalOffset, dy: 0, dz: 0 }]
            : [{ dx: finalOffset, dy: 0, dz: 0 }, { dx: -finalOffset, dy: 0, dz: 0 }, { dx: 0, dy: -finalOffset, dz: 0 }, { dx: 0, dy: finalOffset, dz: 0 }];
        let chosen = candidates[0];
        for (let i = 0; i < candidates.length; i++) {
            if (!checkOffsetCollision(p1, p2, candidates[i])) { chosen = candidates[i]; break; }
        }
        const dp1 = { x: p1.x+chosen.dx, y: p1.y+chosen.dy, z: p1.z+chosen.dz };
        const dp2 = { x: p2.x+chosen.dx, y: p2.y+chosen.dy, z: p2.z+chosen.dz };
        const pr1 = project(p1), pr2 = project(p2), prD1 = project(dp1), prD2 = project(dp2);
        const dir3D = getSegmentDirection3D(p1, p2);

        _ctx.save();
        _ctx.beginPath(); _ctx.setLineDash([4,4]); _ctx.strokeStyle = '#64748b'; _ctx.lineWidth = 1;
        _ctx.moveTo(pr1.x, pr1.y); _ctx.lineTo(prD1.x, prD1.y);
        _ctx.moveTo(pr2.x, pr2.y); _ctx.lineTo(prD2.x, prD2.y); _ctx.stroke(); _ctx.setLineDash([]);
        _ctx.beginPath(); _ctx.moveTo(prD1.x, prD1.y); _ctx.lineTo(prD2.x, prD2.y);
        _ctx.strokeStyle = '#00ffcc'; _ctx.lineWidth = 1.5; _ctx.stroke();
        _ctx.strokeStyle = '#00ffcc'; _ctx.lineWidth = 1.5;
        _ctx.beginPath(); _ctx.moveTo(prD1.x - 4, prD1.y + 4); _ctx.lineTo(prD1.x + 4, prD1.y - 4); _ctx.stroke();
        _ctx.beginPath(); _ctx.moveTo(prD2.x - 4, prD2.y + 4); _ctx.lineTo(prD2.x + 4, prD2.y - 4); _ctx.stroke();
        const midX = (prD1.x + prD2.x) / 2, midY = (prD1.y + prD2.y) / 2;
        _ctx.font = 'bold ' + Math.max(10, 12 * _cam.scale) + 'px "Courier New", monospace';
        _ctx.fillStyle = '#ffffff'; _ctx.textAlign = 'center'; _ctx.textBaseline = 'middle';
        if (dir3D === 'X') { _ctx.setTransform(1, 0.5, 0, 1, midX, midY - 5); }
        else if (dir3D === 'Z') { _ctx.setTransform(1, -0.5, 0, 1, midX, midY - 5); }
        else { _ctx.setTransform(1, 0, 0, 1, midX, midY - 5); }
        _ctx.fillText(formatDimensionText(realDist), 0, 0);
        _ctx.restore(); _ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    function drawEquipmentTag(projectedCenter, tag) {
        if (!AnnotationManager.isVisible(2)) return;
        const box = AnnotationManager.register(projectedCenter, 'Y', 90, 24, 2);
        _ctx.save(); _ctx.setTransform(1, 0, 0, 1, 0, 0);
        _ctx.strokeStyle = '#f59e0b'; _ctx.lineWidth = 1.5;
        _ctx.beginPath(); _ctx.moveTo(projectedCenter.x, projectedCenter.y); _ctx.lineTo(box.x, box.y + 12); _ctx.lineTo(box.x - 20, box.y + 12); _ctx.stroke();
        _ctx.fillStyle = '#1e293b'; _ctx.fillRect(box.x, box.y, box.w, box.h); _ctx.strokeRect(box.x, box.y, box.w, box.h);
        _ctx.fillStyle = '#ffffff'; _ctx.font = 'bold 11px "Courier New"'; _ctx.textAlign = 'center'; _ctx.textBaseline = 'middle';
        _ctx.fillText(tag, box.x + box.w/2, box.y + 12);
        _ctx.restore(); _ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    // ============================================================
    // SELECCIÓN Y PICKING
    // ============================================================
    function pointToSegmentDistance(p, a, b) {
        const ax = p.x - a.x, ay = p.y - a.y, bx = b.x - a.x, by = b.y - a.y;
        const dot = ax * bx + ay * by, len2 = bx * bx + by * by;
        if (len2 === 0) return Math.hypot(ax, ay);
        let t = Math.max(0, Math.min(1, dot / len2));
        const projX = a.x + t * bx, projY = a.y + t * by;
        return Math.hypot(p.x - projX, p.y - projY);
    }

    function isPointInCylinder(p, eq) {
        const dx = p.x - eq.posX, dz = p.z - eq.posZ;
        const radius = eq.diametro / 2;
        if (dx*dx + dz*dz > radius*radius) return false;
        const halfH = (eq.altura || 0) / 2;
        return p.y >= eq.posY - halfH && p.y <= eq.posY + halfH;
    }

    function isPointInHorizontalCylinder(p, eq) {
        const dx = p.x - eq.posX;
        const halfL = (eq.largo || 0) / 2;
        if (Math.abs(dx) > halfL) return false;
        const dy = p.y - eq.posY, dz = p.z - eq.posZ;
        const radius = eq.diametro / 2;
        return dy*dy + dz*dz <= radius*radius;
    }

    function isPointInBox(p, eq) {
        const box = getEquipmentDrawBox(eq);
        return Math.abs(p.x - eq.posX) <= box.halfWidth && Math.abs(p.y - eq.posY) <= box.halfHeight && Math.abs(p.z - eq.posZ) <= box.halfDepth;
    }

    function pickElement(mouseCanvas) {
        if (!_core) return null;
        const db = _core.getDb(); const equipos = db ? db.equipos : []; const lines = db ? db.lines : [];
        const worldClick = inverseProject(mouseCanvas.x, mouseCanvas.y);
        for (let i = equipos.length - 1; i >= 0; i--) {
            const eq = equipos[i]; let inside = false;
            if (eq.tipo === 'tanque_v' || eq.tipo === 'torre' || eq.tipo === 'reactor' || eq.tipo === 'desgasificador' || eq.tipo === 'desmineralizador' || eq.tipo === 'suavizador' || eq.tipo === 'filtro_carbon' || eq.tipo === 'filtro_arena' || eq.tipo === 'clarificador' || eq.tipo === 'columna_fraccionadora' || eq.tipo === 'evaporador' || eq.tipo === 'cristalizador' || eq.tipo === 'absorbedor' || eq.tipo === 'stripper' || eq.tipo === 'reactor_encamisado' || eq.tipo === 'autoclave' || eq.tipo === 'agitador' || eq.tipo === 'centrifuga_discos' || eq.tipo === 'tanque_aseptico' || eq.tipo === 'espesador' || eq.tipo === 'separador' || eq.tipo === 'antorcha') {
                inside = isPointInCylinder(worldClick, eq);
            } else if (eq.tipo === 'tanque_h' || eq.tipo === 'separador_trifasico' || eq.tipo === 'slug_catcher' || eq.tipo === 'calentador_fuego_directo' || eq.tipo === 'secador_rotativo' || eq.tipo === 'centrifuga' || eq.tipo === 'filtro_tambor' || eq.tipo === 'molino') {
                inside = isPointInHorizontalCylinder(worldClick, eq);
            } else {
                inside = isPointInBox(worldClick, eq);
            }
            if (inside) return { type: 'equipment', obj: eq };
        }
        for (let line of lines) {
            const pts = _core.getLinePoints(line); if (!pts || pts.length < 2) continue;
            for (let i = 0; i < pts.length - 1; i++) {
                const p1 = pts[i], p2 = pts[i+1]; const proj1 = project(p1), proj2 = project(p2);
                if (pointToSegmentDistance(mouseCanvas, proj1, proj2) < 12) return { type: 'line', obj: line };
            }
        }
        return null;
    }

    function pickComponent(mouseX, mouseY) {
        if (!_core) return null;
        const db = _core.getDb();
        let closest = null, closestDist = 18;
        for (const line of (db ? db.lines : [])) {
            if (!line.components) continue;
            for (const comp of line.components) {
                if (!comp._screenPos) continue;
                const dist = Math.hypot(comp._screenPos.x - mouseX, comp._screenPos.y - mouseY);
                if (dist < closestDist) { closestDist = dist; closest = comp; }
            }
        }
        return closest;
    }

    function pickPort(mouseX, mouseY) {
        const db = _core.getDb();
        for (const item of [...(db.equipos||[]), ...(db.lines||[])]) {
            if (!item.puertos) continue;
            for (const port of item.puertos) {
                const worldPos = { x: (item.posX||0)+(port.relX||0), y: (item.posY||0)+(port.relY||0), z: (item.posZ||0)+(port.relZ||0) };
                const screenPos = project(worldPos);
                if (Math.hypot(screenPos.x-mouseX, screenPos.y-mouseY) < SNAP_THRESHOLD) return { item, port, screenPos };
            }
        }
        return null;
    }

    // ============================================================
    // RENDER PRINCIPAL
    // ============================================================
    function render() {
        if (!_ctx || !_canvas) return;
        _renderScheduled = false;
        _ctx.clearRect(0, 0, _canvas.width, _canvas.height);
        const bgGrad = _ctx.createRadialGradient(_canvas.width/2, _canvas.height/2, _canvas.width*0.1, _canvas.width/2, _canvas.height/2, _canvas.width*0.9);
        bgGrad.addColorStop(0, '#0f172a'); bgGrad.addColorStop(1, '#020617');
        _ctx.fillStyle = bgGrad; _ctx.fillRect(0, 0, _canvas.width, _canvas.height);
        drawGrid(_currentElevation); drawOrigin();
        if (!_core) return;
        const db = _core.getDb(); if (!db) return;

        if (_cacheDirty) {
            _renderQueueCache = [];
            (db.equipos||[]).forEach(function(eq) { _renderQueueCache.push({ type: eq.tipo === 'plataforma' ? 'PLATFORM' : 'EQUIPMENT', depth: eq.posX+eq.posZ+(eq.posY*0.1), data: eq }); });
            (db.lines||[]).forEach(function(line) {
                const pts = _core.getLinePoints(line);
                if (pts && pts.length >= 2) {
                    const avgDepth = pts.reduce(function(acc,p) { return acc+(p.x+p.z); }, 0)/pts.length;
                    _renderQueueCache.push({ type:'LINE', depth: avgDepth, data: line });
                }
            });
            _renderQueueCache.sort(function(a, b) {
                const order = { 'PLATFORM': 0, 'EQUIPMENT': 1, 'LINE': 2 };
                const typeA = a.data && a.data.tipo === 'plataforma' ? 'PLATFORM' : a.type;
                const typeB = b.data && b.data.tipo === 'plataforma' ? 'PLATFORM' : b.type;
                const orderDiff = (order[typeA] || 1) - (order[typeB] || 1);
                if (orderDiff !== 0) return orderDiff;
                return a.depth - b.depth;
            });
            _cacheDirty = false;
        }

        AnnotationManager.reset();
        _bomItems = [];

        _renderQueueCache.forEach(function(item) {
            if (item.type==='EQUIPMENT') {
                const eq=item.data;
                switch(eq.tipo) {
                    case 'tanque_v':case 'torre':case 'reactor':case 'desgasificador':case 'desmineralizador':case 'suavizador':case 'filtro_carbon':case 'filtro_arena':case 'clarificador':case 'columna_fraccionadora':case 'evaporador':case 'cristalizador':case 'absorbedor':case 'stripper':case 'reactor_encamisado':case 'autoclave':case 'agitador':case 'centrifuga_discos':case 'tanque_aseptico':case 'espesador':case 'separador':case 'antorcha':drawTank(eq);break;
                    case 'bomba':case 'bomba_dosificacion':case 'bomba_sumergible':drawBomba(eq);break;
                    case 'tanque_h':case 'separador_trifasico':case 'slug_catcher':case 'calentador_fuego_directo':case 'secador_rotativo':case 'centrifuga':case 'filtro_tambor':case 'molino':drawCilindroHorizontal(eq);break;
                    case 'plataforma':drawPlataforma(eq);break;
                    default:drawRectEquip(eq,'#475569');
                }
                if (eq.tag && eq.tipo !== 'plataforma') {
                    const projCenter = project({ x: eq.posX, y: eq.posY, z: eq.posZ });
                    drawEquipmentTag(projCenter, eq.tag);
                }
            } else if (item.type==='LINE') {
                drawPipeWithElbows(item.data);
                drawPipeComponents(item.data);
            }
        });

        const selected = _core.getSelected();
        if (selected) drawSelection(selected);
        if (_activeSnap) {
            _ctx.save(); _ctx.beginPath(); _ctx.strokeStyle='#10b981'; _ctx.lineWidth=2;
            _ctx.arc(_activeSnap.screenPos.x,_activeSnap.screenPos.y,8,0,Math.PI*2); _ctx.stroke();
            _ctx.fillStyle='#10b981'; _ctx.font='bold 12px Arial';
            _ctx.fillText(_activeSnap.item.tag + ':' + _activeSnap.port.id + ' (' + _activeSnap.port.diametro + '")',_activeSnap.screenPos.x+12,_activeSnap.screenPos.y-12);
            _ctx.restore();
        }
        if (_hoveredComponent && _hoveredComponentScreenPos) drawTechnicalTooltip(_ctx, _hoveredComponent, _hoveredComponentScreenPos);
    }

    function drawSelection(element) {
        if (!element) return;
        _ctx.save();
        _ctx.strokeStyle = '#facc15'; _ctx.lineWidth = 4; _ctx.shadowColor = '#facc15'; _ctx.shadowBlur = 10;
        if (element.type === 'equipment') {
            const eq = element.obj;
            if (eq.tipo === 'tanque_v' || eq.tipo === 'torre' || eq.tipo === 'reactor') {
                const p = project({ x: eq.posX, y: eq.posY, z: eq.posZ }); const w = (eq.diametro/2)*_cam.scale+5, h = eq.altura*_cam.scale;
                _ctx.beginPath(); _ctx.ellipse(p.x, p.y-h/2, w, (w+5)*0.5, 0, 0, 2*Math.PI); _ctx.stroke();
                _ctx.beginPath(); _ctx.ellipse(p.x, p.y+h/2, w, (w+5)*0.5, 0, 0, 2*Math.PI); _ctx.stroke();
            } else {
                const p = project({ x: eq.posX, y: eq.posY, z: eq.posZ });
                const box = getEquipmentDrawBox(eq);
                const w = box.halfWidth*_cam.scale+5, h = box.halfHeight*_cam.scale+5;
                _ctx.strokeRect(p.x-w, p.y-h, w*2, h*2);
            }
        } else if (element.type === 'line') {
            const pts = _core.getLinePoints(element.obj);
            if (pts && pts.length >= 2) { _ctx.beginPath(); pts.forEach(function(p,i) { const pr = project(p); i===0 ? _ctx.moveTo(pr.x,pr.y) : _ctx.lineTo(pr.x,pr.y); }); _ctx.stroke(); }
        }
        _ctx.restore();
    }

    function drawTechnicalTooltip(ctx, comp, screenPos) {
        const catalogComp = typeof SmartFlowCatalog !== 'undefined' ? SmartFlowCatalog.getComponent(comp.type) : null;
        const desc = catalogComp ? catalogComp.nombre : (comp.type || 'Componente');
        const material = catalogComp ? catalogComp.material : (comp.material || 'N/D');
        const abbr = getComponentLabel(comp.type);
        const boxW = 210, boxH = 80;
        const x = Math.min(screenPos.x + 30, _canvas.width - boxW - 10);
        const y = Math.max(screenPos.y - 60, 10);
        ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.95)'; ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2;
        if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, boxW, boxH, 8); ctx.fill(); ctx.stroke(); }
        else { ctx.fillRect(x, y, boxW, boxH); ctx.strokeRect(x, y, boxW, boxH); }
        ctx.fillStyle = '#fbbf24'; ctx.font = 'bold 12px Inter'; ctx.fillText(abbr + ' — ' + desc, x + 12, y + 22);
        ctx.fillStyle = '#e2e8f0'; ctx.font = '10px Inter'; ctx.fillText('Material: ' + material, x + 12, y + 42);
        ctx.fillText('Tag: ' + (comp.tag || 'N/A'), x + 12, y + 58);
        ctx.restore();
    }

    // ============================================================
    // CONTROL DE CÁMARA
    // ============================================================
    function autoCenter(options) {
        if (!_canvas || !_core) return;
        options = options || {};
        const db = _core.getDb();
        const equipos = db ? db.equipos : [];
        const lines = db ? db.lines : [];
        const isMobile = /Mobi|Android/i.test(navigator.userAgent) || _canvas.width < 600;
        const padding = options.padding !== undefined ? options.padding : (isMobile ? 20 : 80);
        const minScale = options.minScale !== undefined ? options.minScale : (isMobile ? 0.06 : 0.12);
        const maxScale = options.maxScale !== undefined ? options.maxScale : (isMobile ? 0.5 : 0.6);

        let points = [];
        equipos.forEach(function(eq) {
            const r = (eq.diametro / 2) || 500;
            points.push({ x: eq.posX, y: eq.posY, z: eq.posZ });
            points.push({ x: eq.posX + r, y: eq.posY, z: eq.posZ + r });
            points.push({ x: eq.posX - r, y: eq.posY, z: eq.posZ - r });
        });
        lines.forEach(function(line) {
            const pts = _core.getLinePoints(line);
            if (pts) pts.forEach(function(p) { points.push(p); });
        });
        if (points.length === 0) points = [{ x: -2000, y: 0, z: -2000 }, { x: 2000, y: 2000, z: 2000 }];

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        points.forEach(function(p) {
            const rx = (p.x - p.z) * COS30, ry = (p.x + p.z) * SIN30 - p.y;
            if (rx < minX) minX = rx; if (rx > maxX) maxX = rx;
            if (ry < minY) minY = ry; if (ry > maxY) maxY = ry;
        });
        const margin = (maxX - minX) * 0.15, marginY = (maxY - minY) * 0.15;
        minX -= margin; maxX += margin; minY -= marginY; maxY += marginY;
        const worldW = maxX - minX, worldH = maxY - minY;
        let sc = Math.min((_canvas.width - padding * 2) / worldW, (_canvas.height - padding * 2) / worldH, maxScale);
        sc = Math.max(minScale, sc); sc = isFinite(sc) ? sc : 0.3;
        _cam.scale = sc;
        _cam.panX = _canvas.width / 2 - ((minX + maxX) / 2) * sc;
        _cam.panY = _canvas.height / 2 - ((minY + maxY) / 2) * sc;
        _cacheDirty = true; scheduleRender();
    }

    function pan(dx, dy) { _cam.panX += dx; _cam.panY += dy; _cacheDirty = true; scheduleRender(); }

    function zoom(delta, mouseX, mouseY) {
        const zoomFactor = delta > 0 ? 1.1 : 0.9;
        const newScale = _cam.scale * zoomFactor;
        const clampedScale = Math.min(Math.max(0.05, newScale), 1.5);
        if (mouseX !== undefined && mouseY !== undefined && clampedScale !== _cam.scale) {
            _cam.panX = mouseX - (mouseX - _cam.panX) * (clampedScale / _cam.scale);
            _cam.panY = mouseY - (mouseY - _cam.panY) * (clampedScale / _cam.scale);
        }
        _cam.scale = clampedScale;
        _cacheDirty = true; scheduleRender();
    }

    function scheduleRender() {
        if (!_renderScheduled) { _renderScheduled = true; requestAnimationFrame(function() { render(); }); }
    }

    // ============================================================
    // INICIALIZACIÓN
    // ============================================================
    function init(canvasElement, coreInstance, notifyFn) {
        _canvas = canvasElement;
        _ctx = _canvas.getContext('2d');
        _core = coreInstance;
        _notifyUI = notifyFn || (function(msg, isErr) { console.log(msg); });
        _currentElevation = 0;
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        window.addEventListener('orientationchange', function() { setTimeout(resizeCanvas, 100); });
        if (_core && _core.on) {
            _core.on('modelChanged', function() { _cacheDirty = true; scheduleRender(); });
        }
        _canvas.addEventListener('mousemove', function(e) {
            const rect = _canvas.getBoundingClientRect();
            const mX = e.clientX - rect.left, mY = e.clientY - rect.top;
            const snapped = pickPort(mX, mY);
            if (snapped) { _activeSnap = snapped; _canvas.style.cursor = 'crosshair'; _hoveredComponent = null; _hoveredComponentScreenPos = null; }
            else {
                _activeSnap = null;
                const hovered = pickComponent(mX, mY);
                if (hovered) { _hoveredComponent = { comp: hovered }; _hoveredComponentScreenPos = hovered._screenPos || {x:mX, y:mY}; _canvas.style.cursor = 'pointer'; }
                else { _hoveredComponent = null; _hoveredComponentScreenPos = null; _canvas.style.cursor = pickElement({x:mX,y:mY}) ? 'pointer' : 'default'; }
            }
            scheduleRender();
        });
        _canvas.addEventListener('wheel', function(e) {
            e.preventDefault();
            const rect = _canvas.getBoundingClientRect();
            zoom(e.deltaY < 0 ? 1 : -1, e.clientX - rect.left, e.clientY - rect.top);
        });
        const isMobile = /Mobi|Android/i.test(navigator.userAgent) || _canvas.width < 600;
        autoCenter(isMobile ? { padding: 20, minScale: 0.06, maxScale: 0.5 } : {});
        scheduleRender();
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
            _ctx.scale(dpr, dpr);
        }
        _cacheDirty = true;
        const isMobile = /Mobi|Android/i.test(navigator.userAgent) || _canvas.width < 600;
        autoCenter(isMobile ? { padding: 20, minScale: 0.06, maxScale: 0.5 } : {});
    }

    function setElevation(level) { _currentElevation = level; scheduleRender(); }

    // ============================================================
    // API PÚBLICA
    // ============================================================
    return {
        init: init,
        render: scheduleRender,
        autoCenter: autoCenter,
        pan: pan,
        zoom: zoom,
        project: project,
        inverseProject: inverseProject,
        setElevation: setElevation,
        resizeCanvas: resizeCanvas,
        pickElement: pickElement,
        getActiveSnap: function() { return _activeSnap; },
        getCam: function() { return _cam; }
    };
})();
