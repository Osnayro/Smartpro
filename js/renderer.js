
// ============================================================
// SMARTFLOW RENDERER v4.1 - Motor Isométrico 2.5D
// Integración completa con SmartFlowCatalog v4.1
// Mejoras: 100% equipos, instrumentos, materiales estructurales
// Sistema de anotaciones profesional, cotas inteligentes
// autoCenter híbrido (precisión + filtro + preferHorizontal)
// ============================================================

const SmartFlowRenderer = (function() {
    let _canvas = null;
    let _ctx = null;
    let _core = null;
    let _catalog = null;
    let _cam = { scale: 0.5, panX: 0, panY: 0 };
    let _currentElevation = 0;
    let _notifyUI = (msg, isErr) => console.log(msg);
    let _renderScheduled = false;
    let _cacheDirty = true;
    let _bomItems = [];
    let _renderQueueCache = [];

    const COS30 = 0.86602540378;
    const SIN30 = 0.5;
    const SNAP_THRESHOLD = 15;
    let _activeSnap = null;
    let _hoveredComponent = null;
    let _hoveredComponentScreenPos = null;

    // ================================================================
    // CONFIGURACIÓN INDUSTRIAL v4.1 - Materiales completos
    // ================================================================
    const ISO_CONFIG = {
        MATERIALS: {
            'PPR': 'PP', 'PP': 'PP', 'POLIPROPILENO': 'PP',
            'HDPE': 'PE', 'PE100': 'PE', 'POLIETILENO': 'PE',
            'PVC': 'PV', 'CPVC': 'PV', 'PVDF': 'PV',
            'CARBON_STEEL': 'CS', 'ACERO_CARBONO': 'CS', 'CS': 'CS',
            'STAINLESS_STEEL': 'SS', 'ACERO_INOXIDABLE': 'SS', 'SS304': 'SS', 'SS316': 'SS',
            'DUPLEX': 'DX', 'HASTELLOY': 'HY', 'ALLOY20': 'A2',
            'ALUMINIO': 'AL', 'ALUMINUM': 'AL',
            'FRP': 'FR', 'PTFE': 'PT', 'RUBBER': 'RB',
            'CONCRETO': 'CO', 'CONCRETE': 'CO', 'HORMIGON': 'CO',
            'MADERA': 'WD', 'WOOD': 'WD', 'GLASS': 'GL'
        },
        COLORS: {
            'PP': '#10b981', 'CS': '#475569', 'SS': '#94a3b8',
            'PE': '#1e293b', 'PV': '#7c3aed', 'CP': '#fb923c',
            'FR': '#8b5cf6', 'PT': '#a78bfa', 'RB': '#ec4899',
            'CO': '#9ca3af', 'WD': '#8b6914', 'GL': '#aaddff',
            'DX': '#0ea5e9', 'HY': '#f59e0b', 'A2': '#fbbf24', 'AL': '#d1d5db'
        },
        PIPE_SCHEDULES: {
            'SCH40': 1.0, 'SCH80': 1.25, 'SCH160': 1.5,
            'STD': 1.0, 'XS': 1.25, 'XXS': 1.5
        },
        INSULATION_COLORS: {
            'HOT': '#ff4444', 'COLD': '#4488ff', 'PERSONNEL': '#44ff44', 'NONE': null
        }
    };

    // ================================================================
    // SISTEMA DE ANOTACIONES PROFESIONAL v2.0
    // ================================================================
    const AnnotationManager = {
        slots: [],
        occupiedBounds: [],
        minZoomForDetails: 0.25,
        minZoomForAll: 0.4,

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
                    { dx: 0, dy: -h - 8 }, { dx: 0, dy: h + 8 },
                    { dx: w + 15, dy: -h/2 }, { dx: -w - 15, dy: -h/2 }
                ];
                case 'Z': return [
                    { dx: w + 15, dy: -h/2 }, { dx: -w - 15, dy: -h/2 },
                    { dx: 0, dy: -h - 8 }, { dx: 0, dy: h + 8 }
                ];
                default: return [
                    { dx: 0, dy: -h - 8 }, { dx: 0, dy: h + 8 },
                    { dx: w + 15, dy: 0 }, { dx: -w - 15, dy: 0 }
                ];
            }
        },

        findBestPosition(preferredX, preferredY, w, h, dir3D, maxAttempts) {
            maxAttempts = maxAttempts || 6;
            const offsets = this.getDirectionalOffsets(dir3D, w, h);
            for (let i = 0; i < Math.min(maxAttempts, offsets.length); i++) {
                const candidate = { x: preferredX + offsets[i].dx, y: preferredY + offsets[i].dy, w, h };
                if (!this.checkCollision(candidate)) return candidate;
            }
            for (let angle = 0; angle < 360; angle += 45) {
                const rad = angle * Math.PI / 180;
                const candidate = { x: preferredX + Math.cos(rad) * 25, y: preferredY + Math.sin(rad) * 25, w, h };
                if (!this.checkCollision(candidate)) return candidate;
            }
            return { x: preferredX, y: preferredY, w, h };
        },

        register(anchor, dir3D, w, h, priority) {
            const best = this.findBestPosition(anchor.x, anchor.y, w, h, dir3D);
            best.priority = priority || 2;
            this.occupiedBounds.push(best);
            this.slots.push(best);
            return best;
        },

        isVisible(priority) {
            if (priority <= 1) return true;
            if (_cam.scale < this.minZoomForDetails && priority > 1) return false;
            if (_cam.scale < this.minZoomForAll && priority >= 3) return false;
            return true;
        }
    };

    // ================================================================
    // PROYECCIÓN ISOMÉTRICA
    // ================================================================
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

    function adjustColor(color, percent) {
        if (!color || !color.startsWith('#')) return color;
        const num = parseInt(color.replace("#", ""), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) + amt, G = ((num >> 8) & 0xFF) + amt, B = (num & 0xFF) + amt;
        return "#" + (0x1000000 + (R < 255 ? (R < 0 ? 0 : R) : 255) * 0x10000 +
            (G < 255 ? (G < 0 ? 0 : G) : 255) * 0x100 + (B < 255 ? (B < 0 ? 0 : B) : 255)).toString(16).slice(1);
    }

    // ================================================================
    // UTILIDADES GRÁFICAS
    // ================================================================
    function getMaterialColor(specCode, materialName) {
        if (_catalog && specCode) {
            const spec = _catalog.getSpec(specCode);
            if (spec && spec.color) {
                return '#' + spec.color.toString(16).padStart(6, '0');
            }
        }
        const mat = materialName ? materialName.toUpperCase() : '';
        for (const [key, color] of Object.entries(ISO_CONFIG.COLORS)) {
            if (mat.includes(key)) return color;
        }
        return ISO_CONFIG.COLORS.CS || '#475569';
    }

    function getMaterialGradient(ctx, p1, p2, material, diameter) {
        const proj1 = project(p1), proj2 = project(p2);
        const angle = Math.atan2(proj2.y - proj1.y, proj2.x - proj1.x) + Math.PI / 2;
        const w = diameter * _cam.scale;
        const grad = ctx.createLinearGradient(
            proj1.x + Math.cos(angle) * w / 2, proj1.y + Math.sin(angle) * w / 2,
            proj1.x - Math.cos(angle) * w / 2, proj1.y - Math.sin(angle) * w / 2
        );
        const baseColor = ISO_CONFIG.COLORS[material] || '#94a3b8';
        if (material === 'PP') {
            grad.addColorStop(0, '#064e3b'); grad.addColorStop(0.2, '#6ee7b7');
            grad.addColorStop(0.5, baseColor); grad.addColorStop(0.8, '#34d399');
            grad.addColorStop(1, '#065f46');
        } else if (material === 'SS' || material === 'DX') {
            grad.addColorStop(0, '#1a1a1a'); grad.addColorStop(0.25, '#c0c0c0');
            grad.addColorStop(0.5, '#ffffff'); grad.addColorStop(0.75, '#c0c0c0');
            grad.addColorStop(1, '#1a1a1a');
        } else {
            grad.addColorStop(0, '#1a1a1a'); grad.addColorStop(0.3, adjustColor(baseColor, -30));
            grad.addColorStop(0.5, '#ffffffcc'); grad.addColorStop(0.7, adjustColor(baseColor, 20));
            grad.addColorStop(1, '#000000');
        }
        return grad;
    }

    function getShortMaterial(materialName) {
        const name = materialName ? materialName.toUpperCase() : '';
        for (const [key, abbr] of Object.entries(ISO_CONFIG.MATERIALS)) {
            if (name.includes(key)) return abbr;
        }
        return name.substring(0, 2) || 'UN';
    }

    function formatDimensionText(dist) {
        if (dist < 1000) return Math.round(dist).toString() + ' mm';
        return (dist / 1000).toFixed(2) + ' m';
    }

    function getComponentLabel(compType) {
        if (_catalog) {
            const comp = _catalog.getComponent(compType);
            if (comp && comp.abbr) return comp.abbr;
        }
        const fallback = {
            'GATE_VALVE': 'GV', 'GLOBE_VALVE': 'GL', 'BUTTERFLY_VALVE': 'VB', 'BALL_VALVE': 'BA',
            'CHECK_VALVE': 'CK', 'DIAPHRAGM_VALVE': 'DV', 'CONTROL_VALVE': 'CV',
            'CONCENTRIC_REDUCER': 'RC', 'ECCENTRIC_REDUCER': 'RE',
            'WELD_NECK_FLANGE': 'FL', 'SLIP_ON_FLANGE': 'FL', 'BLIND_FLANGE': 'FB', 'LAP_JOINT_FLANGE': 'FL',
            'PRESSURE_GAUGE': 'PG', 'TEMPERATURE_GAUGE': 'TG', 'FLOW_METER': 'FM',
            'TEE_EQUAL': 'TE', 'TEE_REDUCING': 'TR', 'CROSS': 'CR', 'CAP': 'CA',
            'ELBOW_90_LR': 'EL', 'ELBOW_90_SR': 'EL', 'ELBOW_45': 'E4',
            'TRANSITION': 'TR', 'UNION': 'UN', 'BULKHEAD': 'BH', 'Y_STRAINER': 'YS',
            'LEVEL_SWITCH_RANA': 'LS', 'PIPE_SHOE': 'SH', 'U_BOLT': 'UB', 'GUIDE': 'GD', 'ANCHOR': 'AN',
            'HANGER': 'HG', 'PIPE_CLAMP': 'PC', 'EXPANSION_JOINT': 'EJ', 'FLEXIBLE_HOSE': 'HO',
            'NIPPLE': 'NI', 'STUB_END': 'SE', 'CAMLOCK': 'CM', 'QUICK_CONNECT': 'QC',
            'STEAM_TRAP': 'ST', 'SILENCER': 'SI', 'FLAME_ARRESTER': 'FA', 'VACUUM_BREAKER': 'VB',
            'DRAIN_VALVE': 'DV', 'AIR_RELEASE': 'AR', 'SAMPLE_COOLER': 'SC', 'SAMPLE_VALVE': 'SV',
            'PLUG_VALVE': 'PV', 'CHOKE_VALVE': 'CH', 'CRYOGENIC_VALVE': 'CV', 'ASEPTIC_VALVE': 'AV'
        };
        return fallback[compType] || (compType ? compType.substring(0, 2) : '??');
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
        const d = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z);
        if (d === 0) return { ...from };
        const t = Math.min(dist / d, 0.5);
        return { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t, z: from.z + (to.z - from.z) * t };
    }

    function getElbowRadius(diameter, isPPR) {
        const mmDiameter = diameter * 25.4;
        const baseRadius = isPPR ? mmDiameter * 0.8 : mmDiameter * 1.5;
        return Math.min(baseRadius, 350);
    }

    function getScheduleFactor(spec) {
        if (!spec) return 1.0;
        const upper = spec.toUpperCase();
        for (const [key, val] of Object.entries(ISO_CONFIG.PIPE_SCHEDULES)) {
            if (upper.includes(key)) return val;
        }
        return 1.0;
    }

    // ================================================================
    // DIMENSIONES DE EQUIPOS NORMALIZADAS (CORREGIDO)
    // ================================================================
    function getEquipmentDrawBox(eq) {
        const tipo = eq.tipo || '';
        if (['tanque_v', 'torre', 'reactor', 'desgasificador', 'desmineralizador',
             'suavizador', 'filtro_carbon', 'filtro_arena', 'clarificador',
             'columna_fraccionadora', 'evaporador', 'cristalizador', 'absorbedor',
             'stripper', 'reactor_encamisado', 'autoclave', 'agitador',
             'centrifuga_discos', 'tanque_aseptico', 'espesador', 'separador',
             'antorcha'].includes(tipo)) {
            return { halfWidth: (eq.diametro || 1000) / 2, halfHeight: (eq.altura || 1500) / 2, halfDepth: (eq.diametro || 1000) / 2 };
        }
        if (['tanque_h', 'separador_trifasico', 'slug_catcher', 'calentador_fuego_directo',
             'secador_rotativo', 'centrifuga', 'filtro_tambor', 'molino'].includes(tipo)) {
            return { halfWidth: (eq.largo || 4000) / 2, halfHeight: (eq.diametro || 1000) / 2, halfDepth: (eq.diametro || 1000) / 2 };
        }
        if (['bomba', 'bomba_dosificacion', 'bomba_sumergible', 'homogeneizador_ap'].includes(tipo)) {
            return { halfWidth: 400, halfHeight: 400, halfDepth: 400 };
        }
        if (tipo === 'plataforma') {
            return { halfWidth: (eq.largo || 6000) / 2, halfHeight: (eq.altura || 400) / 2, halfDepth: (eq.ancho || 3000) / 2 };
        }
        return {
            halfWidth: (eq.largo || eq.diametro || 1000) / 2,
            halfHeight: (eq.altura || 1000) / 2,
            halfDepth: (eq.ancho || eq.diametro || 1000) / 2
        };
    }

    function isPointCollidingWithEquipment(point, margin = 1500) {
        if (!_core) return false;
        const db = _core.getDb();
        if (!db || !db.equipos) return false;
        return db.equipos.some(eq => {
            const box = getEquipmentDrawBox(eq);
            const dx = Math.abs(point.x - eq.posX), dz = Math.abs(point.z - eq.posZ);
            return dx <= box.halfWidth + margin && dz <= box.halfDepth + margin;
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

    // ================================================================
    // DIBUJO DE GRID Y ORIGEN
    // ================================================================
    function drawGrid(elevation = 0) {
        const step = 1000, minX = -10000, maxX = 20000, minZ = -10000, maxZ = 20000;
        _ctx.beginPath(); _ctx.strokeStyle = '#1e293b'; _ctx.lineWidth = 1; _ctx.globalAlpha = 0.12;
        for (let x = minX; x <= maxX; x += step) {
            const p1 = project({ x, y: elevation, z: minZ }), p2 = project({ x, y: elevation, z: maxZ });
            _ctx.moveTo(p1.x, p1.y); _ctx.lineTo(p2.x, p2.y);
        }
        for (let z = minZ; z <= maxZ; z += step) {
            const p1 = project({ x: minX, y: elevation, z }), p2 = project({ x: maxX, y: elevation, z });
            _ctx.moveTo(p1.x, p1.y); _ctx.lineTo(p2.x, p2.y);
        }
        _ctx.stroke();
        _ctx.globalAlpha = 1.0;
    }

    function drawOrigin() {
        const o = project({ x: 0, y: _currentElevation, z: 0 });
        _ctx.beginPath();
        _ctx.moveTo(o.x - 25, o.y); _ctx.lineTo(o.x + 25, o.y);
        _ctx.moveTo(o.x, o.y - 25); _ctx.lineTo(o.x, o.y + 25);
        _ctx.strokeStyle = '#ff8888'; _ctx.lineWidth = 2; _ctx.stroke();
        _ctx.fillStyle = '#ff8888'; _ctx.font = 'bold 12px monospace';
        _ctx.fillText('ORIGEN (0, ' + (_currentElevation / 1000).toFixed(1) + 'm, 0)', o.x + 20, o.y - 10);
    }

    // ================================================================
    // DIBUJO DE EQUIPOS - 100% COBERTURA
    // ================================================================
    function getSpecColor(eq) {
        if (eq.spec && _catalog) {
            const spec = _catalog.getSpec(eq.spec);
            if (spec && spec.color) return '#' + spec.color.toString(16).padStart(6, '0');
        }
        switch (eq.tipo) {
            case 'tanque_v': case 'torre': case 'reactor': return '#2563eb';
            case 'tanque_h': return '#1d4ed8';
            case 'bomba': return '#f39c12';
            default: return '#475569';
        }
    }

    function drawTank(eq) {
        const p = project({ x: eq.posX, y: eq.posY, z: eq.posZ });
        const box = getEquipmentDrawBox(eq);
        const w = box.halfWidth * _cam.scale;
        const h = box.halfHeight * 2 * _cam.scale;
        const topY = p.y - h, bottomY = p.y + h;
        const color = getMaterialColor(eq.spec, eq.material);

        _ctx.shadowColor = 'rgba(0,0,0,0.3)'; _ctx.shadowBlur = 8 * _cam.scale;
        _ctx.beginPath(); _ctx.ellipse(p.x, bottomY, w, w * 0.5, 0, 0, 2 * Math.PI);
        const grad = _ctx.createLinearGradient(p.x - w, 0, p.x + w, 0);
        grad.addColorStop(0, adjustColor(color, -30)); grad.addColorStop(0.3, color);
        grad.addColorStop(0.7, adjustColor(color, 20)); grad.addColorStop(1, adjustColor(color, -20));
        _ctx.fillStyle = grad; _ctx.fill(); _ctx.strokeStyle = '#ffffff'; _ctx.lineWidth = 1; _ctx.stroke();
        _ctx.fillStyle = adjustColor(color, -20); _ctx.fillRect(p.x - w, topY, w, h);
        _ctx.fillStyle = adjustColor(color, 10); _ctx.fillRect(p.x, topY, w, h);
        _ctx.beginPath(); _ctx.ellipse(p.x, topY, w, w * 0.5, 0, 0, 2 * Math.PI);
        _ctx.fillStyle = adjustColor(color, 15); _ctx.fill(); _ctx.stroke();
        _ctx.shadowBlur = 0;

        const projCenter = project({ x: eq.posX, y: eq.posY + box.halfHeight * 1.2, z: eq.posZ });
        drawEquipmentTag(projCenter, eq.tag, 'Y');
        drawPuertos(eq);
        if (eq.accessories) eq.accessories.forEach(acc => drawAccessory(acc, eq));
    }

    function drawHorizontalTank(eq) {
        const p = project({ x: eq.posX, y: eq.posY, z: eq.posZ });
        const box = getEquipmentDrawBox(eq);
        const w = box.halfWidth * _cam.scale, h = box.halfHeight * _cam.scale;
        const color = getMaterialColor(eq.spec, eq.material);

        _ctx.shadowBlur = 6 * _cam.scale;
        const grad = _ctx.createLinearGradient(p.x - w, p.y - h, p.x + w, p.y + h);
        grad.addColorStop(0, adjustColor(color, -20)); grad.addColorStop(0.5, color);
        grad.addColorStop(1, adjustColor(color, -20));
        _ctx.fillStyle = grad; _ctx.fillRect(p.x - w, p.y - h, w * 2, h * 2);
        _ctx.strokeStyle = '#ffffff'; _ctx.strokeRect(p.x - w, p.y - h, w * 2, h * 2);
        _ctx.beginPath(); _ctx.ellipse(p.x - w, p.y, h, h * 0.6, 0, 0, 2 * Math.PI);
        _ctx.fillStyle = adjustColor(color, -10); _ctx.fill(); _ctx.stroke();
        _ctx.beginPath(); _ctx.ellipse(p.x + w, p.y, h, h * 0.6, 0, 0, 2 * Math.PI);
        _ctx.fillStyle = adjustColor(color, -10); _ctx.fill(); _ctx.stroke();
        _ctx.shadowBlur = 0;

        const projCenter = project({ x: eq.posX, y: eq.posY + h * 0.8, z: eq.posZ });
        drawEquipmentTag(projCenter, eq.tag, 'Z');
        drawPuertos(eq);
    }

    function drawBomba(eq) {
        const p = project({ x: eq.posX, y: eq.posY, z: eq.posZ });
        const rad = 20 * _cam.scale;
        const color = getMaterialColor(eq.spec, eq.material);

        _ctx.shadowBlur = 5 * _cam.scale;
        const grad = _ctx.createRadialGradient(p.x - 5, p.y - 5, 2, p.x, p.y, rad);
        grad.addColorStop(0, adjustColor(color, 30)); grad.addColorStop(0.6, color);
        grad.addColorStop(1, adjustColor(color, -30));
        _ctx.fillStyle = grad; _ctx.beginPath();
        _ctx.ellipse(p.x, p.y, rad, rad * 0.8, 0, 0, 2 * Math.PI); _ctx.fill();
        _ctx.strokeStyle = '#ffffff'; _ctx.stroke();
        const motorRad = rad * 0.6;
        _ctx.fillStyle = adjustColor(color, -20); _ctx.beginPath();
        _ctx.ellipse(p.x, p.y - rad * 0.7, motorRad, motorRad * 0.7, 0, 0, 2 * Math.PI); _ctx.fill(); _ctx.stroke();
        _ctx.beginPath(); _ctx.moveTo(p.x, p.y); _ctx.lineTo(p.x, p.y - rad * 0.9);
        _ctx.strokeStyle = '#94a3b8'; _ctx.lineWidth = 2; _ctx.stroke();
        _ctx.shadowBlur = 0;

        const projCenter = project({ x: eq.posX, y: eq.posY + rad * 0.5, z: eq.posZ });
        drawEquipmentTag(projCenter, eq.tag, 'Y');
        drawPuertos(eq);
    }

    function drawPlatform(eq) {
        const p = project({ x: eq.posX, y: eq.posY, z: eq.posZ });
        const box = getEquipmentDrawBox(eq);
        const w = box.halfWidth * _cam.scale, d = box.halfDepth * _cam.scale, h = box.halfHeight * 2 * _cam.scale;
        const material = (eq.material || '').toUpperCase();
        const esConcreto = material.includes('CONCRETO') || material.includes('CEMENTO') || material.includes('HORMIGON');
        const esAluminio = material.includes('ALUMINIO') || material.includes('ALUMINUM');
        const esMadera = material.includes('MADERA') || material.includes('WOOD');
        const topY = p.y - h;

        _ctx.fillStyle = 'rgba(0,0,0,0.2)';
        _ctx.beginPath();
        _ctx.moveTo(p.x - w + 3, topY + 3); _ctx.lineTo(p.x - w + d * 0.5 + 3, topY - d * 0.25 + 3);
        _ctx.lineTo(p.x + d * 0.5 + 3, topY - d * 0.25 + 3); _ctx.lineTo(p.x + w + 3, topY + 3);
        _ctx.lineTo(p.x + d * 0.5 + 3, topY + d * 0.25 + 3); _ctx.lineTo(p.x - w + d * 0.5 + 3, topY + d * 0.25 + 3);
        _ctx.closePath(); _ctx.fill();

        let color;
        if (esConcreto) color = ISO_CONFIG.COLORS.CO || '#9ca3af';
        else if (esAluminio) color = ISO_CONFIG.COLORS.AL || '#d1d5db';
        else if (esMadera) color = ISO_CONFIG.COLORS.WD || '#8b6914';
        else color = '#6b7280';

        const grad = _ctx.createLinearGradient(p.x - w, topY, p.x + w, topY);
        grad.addColorStop(0, adjustColor(color, -20)); grad.addColorStop(0.3, color);
        grad.addColorStop(0.7, adjustColor(color, 15)); grad.addColorStop(1, adjustColor(color, -20));
        _ctx.fillStyle = grad; _ctx.strokeStyle = adjustColor(color, -40); _ctx.lineWidth = 1.5;
        _ctx.beginPath();
        _ctx.moveTo(p.x - w, topY); _ctx.lineTo(p.x - w + d * 0.5, topY - d * 0.25);
        _ctx.lineTo(p.x + d * 0.5, topY - d * 0.25); _ctx.lineTo(p.x + w, topY);
        _ctx.lineTo(p.x + d * 0.5, topY + d * 0.25); _ctx.lineTo(p.x - w + d * 0.5, topY + d * 0.25);
        _ctx.closePath(); _ctx.fill(); _ctx.stroke();

        _ctx.strokeStyle = adjustColor(color, -30); _ctx.lineWidth = 3;
        const patas = [
            { x: eq.posX - box.halfWidth, z: eq.posZ - box.halfDepth },
            { x: eq.posX + box.halfWidth, z: eq.posZ - box.halfDepth },
            { x: eq.posX + box.halfWidth, z: eq.posZ + box.halfDepth },
            { x: eq.posX - box.halfWidth, z: eq.posZ + box.halfDepth }
        ];
        patas.forEach(pta => {
            const top = project({ x: pta.x, y: eq.posY - h, z: pta.z }), bot = project({ x: pta.x, y: eq.posY, z: pta.z });
            _ctx.beginPath(); _ctx.moveTo(top.x, top.y); _ctx.lineTo(bot.x, bot.y); _ctx.stroke();
        });

        if (eq.baranda !== false && !esConcreto) {
            _ctx.strokeStyle = esAluminio ? '#94a3b8' : '#4b5563'; _ctx.lineWidth = 1;
            const esquinas = [
                { x: eq.posX - box.halfWidth, z: eq.posZ - box.halfDepth },
                { x: eq.posX + box.halfWidth, z: eq.posZ - box.halfDepth },
                { x: eq.posX + box.halfWidth, z: eq.posZ + box.halfDepth },
                { x: eq.posX - box.halfWidth, z: eq.posZ + box.halfDepth }
            ];
            for (let i = 0; i < esquinas.length; i++) {
                const a = esquinas[i], b = esquinas[(i + 1) % esquinas.length];
                const projA = project({ x: a.x, y: eq.posY - h + 150, z: a.z });
                const projB = project({ x: b.x, y: eq.posY - h + 150, z: b.z });
                _ctx.beginPath(); _ctx.moveTo(projA.x, projA.y); _ctx.lineTo(projB.x, projB.y); _ctx.stroke();
            }
        }

        const projCenter = project({ x: eq.posX, y: topY - 30, z: eq.posZ });
        drawEquipmentTag(projCenter, eq.tag, 'Y');
    }

    function drawRectEquip(eq, defaultColor) {
        const p = project({ x: eq.posX, y: eq.posY, z: eq.posZ });
        const box = getEquipmentDrawBox(eq);
        const w = box.halfWidth * _cam.scale, h = box.halfHeight * _cam.scale;
        const color = getMaterialColor(eq.spec, eq.material) || defaultColor || '#475569';

        _ctx.shadowBlur = 4 * _cam.scale;
        const grad = _ctx.createLinearGradient(p.x - w, p.y - h, p.x + w, p.y + h);
        grad.addColorStop(0, adjustColor(color, -20)); grad.addColorStop(0.5, color);
        grad.addColorStop(1, adjustColor(color, -20));
        _ctx.fillStyle = grad; _ctx.fillRect(p.x - w, p.y - h, w * 2, h * 2);
        _ctx.strokeStyle = '#ffffff'; _ctx.lineWidth = 1.2; _ctx.strokeRect(p.x - w, p.y - h, w * 2, h * 2);
        _ctx.shadowBlur = 0;

        const projCenter = project({ x: eq.posX, y: eq.posY + h * 0.5, z: eq.posZ });
        drawEquipmentTag(projCenter, eq.tag, 'Y');
        drawPuertos(eq);
    }

    function drawAccessory(acc, parentEq) {
        const pos = { x: parentEq.posX + (acc.relX || 0), y: parentEq.posY + (acc.relY || 0), z: parentEq.posZ + (acc.relZ || 0) };
        const proj = project(pos);
        _ctx.save(); _ctx.strokeStyle = '#64748b'; _ctx.lineWidth = 1; _ctx.setLineDash([4, 4]);
        if (acc.type === 'CAGED_LADDER') {
            _ctx.beginPath(); _ctx.moveTo(proj.x, proj.y); _ctx.lineTo(proj.x, proj.y - 40 * _cam.scale); _ctx.stroke();
            for (let i = 0; i < 4; i++) {
                const y = proj.y - (i * 12 * _cam.scale);
                _ctx.beginPath(); _ctx.moveTo(proj.x - 10, y); _ctx.lineTo(proj.x + 10, y); _ctx.stroke();
            }
        }
        _ctx.setLineDash([]); _ctx.restore();
    }

    function drawEquipmentTag(anchor, tag, dir3D) {
        if (!AnnotationManager.isVisible(2)) return;
        const w = 100, h = 24;
        const box = AnnotationManager.register(anchor, dir3D, w, h, 2);
        _ctx.save(); _ctx.setTransform(1, 0, 0, 1, 0, 0);
        _ctx.beginPath(); _ctx.moveTo(anchor.x, anchor.y); _ctx.lineTo(box.x + 10, box.y + h / 2);
        _ctx.lineTo(box.x - 10, box.y + h / 2); _ctx.strokeStyle = '#f59e0b'; _ctx.lineWidth = 1.2; _ctx.stroke();
        const bgGrad = _ctx.createLinearGradient(box.x, box.y, box.x + w, box.y + h);
        bgGrad.addColorStop(0, '#1e293b'); bgGrad.addColorStop(1, '#0f172a');
        _ctx.fillStyle = bgGrad; _ctx.fillRect(box.x, box.y, w, h);
        _ctx.strokeStyle = '#f59e0b'; _ctx.lineWidth = 1; _ctx.strokeRect(box.x, box.y, w, h);
        _ctx.fillStyle = '#fbbf24'; _ctx.font = 'bold ' + Math.max(9, 11 * _cam.scale) + 'px \'Courier New\'';
        _ctx.textAlign = 'center'; _ctx.textBaseline = 'middle';
        _ctx.fillText(tag, box.x + w / 2, box.y + h / 2);
        _ctx.restore();
    }

    function drawPuertos(obj) {
        if (!obj.puertos) return;
        const posBase = obj.posX !== undefined ? { x: obj.posX, y: obj.posY, z: obj.posZ }
            : (obj._cachedPoints && obj._cachedPoints.length > 0 ? obj._cachedPoints[0] : { x: 0, y: 0, z: 0 });
        obj.puertos.forEach(port => {
            const pos = { x: posBase.x + (port.relX || 0), y: posBase.y + (port.relY || 0), z: posBase.z + (port.relZ || 0) };
            const proj = project(pos);
            if (port.orientacion) {
                const dir = port.orientacion;
                const endPos = { x: pos.x + dir.dx * 200, y: pos.y + dir.dy * 200, z: pos.z + dir.dz * 200 };
                const projEnd = project(endPos);
                _ctx.beginPath(); _ctx.moveTo(proj.x, proj.y); _ctx.lineTo(projEnd.x, projEnd.y);
                _ctx.strokeStyle = '#ffaa00'; _ctx.lineWidth = 1.5; _ctx.stroke();
                const angle = Math.atan2(projEnd.y - proj.y, projEnd.x - proj.x), arrowSize = 6;
                _ctx.beginPath();
                _ctx.moveTo(projEnd.x, projEnd.y);
                _ctx.lineTo(projEnd.x - arrowSize * Math.cos(angle - 0.4), projEnd.y - arrowSize * Math.sin(angle - 0.4));
                _ctx.lineTo(projEnd.x - arrowSize * Math.cos(angle + 0.4), projEnd.y - arrowSize * Math.sin(angle + 0.4));
                _ctx.closePath(); _ctx.fillStyle = '#ffaa00'; _ctx.fill();
            }
            _ctx.beginPath(); _ctx.arc(proj.x, proj.y, 5 * _cam.scale + 2, 0, 2 * Math.PI);
            _ctx.fillStyle = port.connectedLine ? '#4ade80' : '#f59e0b'; _ctx.fill();
            _ctx.strokeStyle = '#ffffff'; _ctx.lineWidth = 1; _ctx.stroke();
            if (port.id && _cam.scale > 0.3) {
                drawNozzleTag(proj, port, obj);
            }
        });
    }

    function drawNozzleTag(proj2D, nozzle, parentEq) {
        if (!AnnotationManager.isVisible(2)) return;
        const diam = nozzle.diametro || parentEq.diametro || '?';
        const elevation = nozzle.elevation || (parentEq.posY + (nozzle.relY || 0));
        const label = nozzle.id + ' ' + diam + '" – EL ' + (elevation / 1000).toFixed(2) + 'm';
        const w = 130, h = 18;
        const box = AnnotationManager.register(proj2D, 'Z', w, h, 2);
        _ctx.save(); _ctx.setTransform(1, 0, 0, 1, 0, 0);
        _ctx.beginPath(); _ctx.moveTo(proj2D.x, proj2D.y); _ctx.lineTo(box.x + 5, box.y + h / 2);
        _ctx.strokeStyle = '#f59e0b'; _ctx.lineWidth = 0.8; _ctx.stroke();
        _ctx.fillStyle = '#1e293b'; _ctx.fillRect(box.x, box.y, w, h);
        _ctx.strokeStyle = '#f59e0b'; _ctx.strokeRect(box.x, box.y, w, h);
        _ctx.fillStyle = '#e2e8f0'; _ctx.font = Math.max(8, 9 * _cam.scale) + 'px \'Courier New\'';
        _ctx.textAlign = 'center'; _ctx.textBaseline = 'middle';
        _ctx.fillText(label, box.x + w / 2, box.y + h / 2);
        _ctx.restore();
    }

    function drawComponentTag(proj2d, index, compType, dir3D) {
        if (!AnnotationManager.isVisible(3)) return;
        const w = 28, h = 16;
        const box = AnnotationManager.register(proj2d, dir3D, w, h, 3);
        _ctx.save(); _ctx.setTransform(1, 0, 0, 1, 0, 0);
        _ctx.beginPath(); _ctx.moveTo(proj2d.x, proj2d.y); _ctx.lineTo(box.x + w / 2, box.y + h / 2);
        _ctx.strokeStyle = '#94a3b8'; _ctx.lineWidth = 0.8; _ctx.stroke();
        _ctx.fillStyle = '#0ea5e9'; _ctx.beginPath();
        _ctx.arc(box.x + w / 2, box.y + h / 2, h / 2, 0, Math.PI * 2); _ctx.fill();
        _ctx.strokeStyle = '#ffffff'; _ctx.lineWidth = 1; _ctx.stroke();
        _ctx.fillStyle = '#ffffff'; _ctx.font = 'bold ' + Math.max(8, 10 * _cam.scale) + 'px \'Courier New\'';
        _ctx.textAlign = 'center'; _ctx.textBaseline = 'middle';
        _ctx.fillText(index.toString(), box.x + w / 2, box.y + h / 2);
        _ctx.restore();
    }

    // ================================================================
    // DIBUJO DE TUBERÍAS CON CODOS AUTOMÁTICOS
    // ================================================================
    function resolvePipeEndpoints(line) {
        const rawPts = _core ? _core.getLinePoints(line) : (line._cachedPoints || line.points3D);
        if (!rawPts || rawPts.length < 2) return rawPts || [];
        const pts = rawPts.map(p => ({ x: p.x, y: p.y, z: p.z }));
        if (line.origin && _core) {
            const obj = _core.findObjectByTag(line.origin.objTag);
            if (obj) {
                const puerto = obj.puertos ? obj.puertos.find(p => p.id === line.origin.portId) : null;
                if (puerto) {
                    const posBase = obj.posX !== undefined ? { x: obj.posX, y: obj.posY, z: obj.posZ }
                        : (obj._cachedPoints && obj._cachedPoints[0] ? obj._cachedPoints[0] : { x: 0, y: 0, z: 0 });
                    pts[0] = { x: posBase.x + (puerto.relX || 0), y: posBase.y + (puerto.relY || 0), z: posBase.z + (puerto.relZ || 0) };
                }
            }
        }
        if (line.destination && _core) {
            const obj = _core.findObjectByTag(line.destination.objTag);
            if (obj) {
                const puerto = obj.puertos ? obj.puertos.find(p => p.id === line.destination.portId) : null;
                if (puerto) {
                    const posBase = obj.posX !== undefined ? { x: obj.posX, y: obj.posY, z: obj.posZ }
                        : (obj._cachedPoints && obj._cachedPoints[0] ? obj._cachedPoints[0] : { x: 0, y: 0, z: 0 });
                    pts[pts.length - 1] = { x: posBase.x + (puerto.relX || 0), y: posBase.y + (puerto.relY || 0), z: posBase.z + (puerto.relZ || 0) };
                }
            }
        }
        return pts;
    }

    function drawPipeWithElbows(line) {
        const pts = resolvePipeEndpoints(line);
        if (!pts || pts.length < 2) return;
        const isPPR = line.material === 'PPR' || (line.spec && line.spec.includes('PPR'));
        const scheduleFactor = getScheduleFactor(line.spec);
        const radioBase = isPPR ? (line.diameter * 25.4 * 0.8) : (line.diameter * 25.4 * 1.5 * scheduleFactor);
        const radio = Math.min(radioBase, 350);
        const baseWidth = (line.diameter || 4) * _cam.scale * scheduleFactor;
        const mainWidth = Math.max(5, baseWidth);
        _ctx.lineCap = 'round'; _ctx.lineJoin = 'round';
        const hasAuditError = lineHasAuditError(line);
        const matShort = getShortMaterial(line.material);
        const lineLabel = line.service ? line.diameter + '"-' + line.service : line.diameter + '"-' + matShort;

        const drawPath = () => {
            _ctx.beginPath(); let first = project(pts[0]); _ctx.moveTo(first.x, first.y);
            for (let i = 1; i < pts.length - 1; i++) {
                const pPrev = pts[i - 1], pCurr = pts[i], pNext = pts[i + 1];
                if (pCurr.isControlPoint && i + 1 < pts.length) {
                    const cp = project(pCurr), nextP = project(pts[i + 1]);
                    _ctx.quadraticCurveTo(cp.x, cp.y, nextP.x, nextP.y); i++;
                } else {
                    const pIn = getPointAtDistance(pCurr, pPrev, radio), pOut = getPointAtDistance(pCurr, pNext, radio);
                    const projIn = project(pIn), projOut = project(pOut), projCurr = project(pCurr);
                    _ctx.lineTo(projIn.x, projIn.y); _ctx.quadraticCurveTo(projCurr.x, projCurr.y, projOut.x, projOut.y);
                }
            }
            _ctx.lineTo(project(pts[pts.length - 1]).x, project(pts[pts.length - 1]).y);
        };

        const color = getMaterialColor(line.spec, line.material);
        const grad = getMaterialGradient(_ctx, pts[0], pts[pts.length - 1], matShort, mainWidth * 2);

        _ctx.save(); drawPath();
        _ctx.shadowColor = '#00000066'; _ctx.shadowBlur = 12 * _cam.scale;
        _ctx.shadowOffsetX = 0; _ctx.shadowOffsetY = 6 * _cam.scale;
        _ctx.strokeStyle = '#00000044'; _ctx.lineWidth = mainWidth + 8; _ctx.stroke(); _ctx.restore();

        drawPath(); _ctx.strokeStyle = '#0a0e17'; _ctx.lineWidth = mainWidth + 4; _ctx.stroke();
        drawPath(); _ctx.strokeStyle = '#1e293b'; _ctx.lineWidth = mainWidth + 2; _ctx.stroke();
        drawPath(); _ctx.strokeStyle = grad; _ctx.lineWidth = mainWidth; _ctx.stroke();
        drawPath(); _ctx.strokeStyle = 'rgba(255,255,255,0.2)'; _ctx.lineWidth = mainWidth * 0.4; _ctx.stroke();
        drawPath(); _ctx.strokeStyle = '#ffffff'; _ctx.lineWidth = Math.max(1, mainWidth * 0.1); _ctx.globalAlpha = 0.85; _ctx.stroke(); _ctx.globalAlpha = 1;

        if (hasAuditError && pts.length >= 2) {
            const midIndex = Math.floor(pts.length / 2), alertPt = pts[midIndex], projAlert = project(alertPt);
            _ctx.save(); _ctx.translate(projAlert.x, projAlert.y - 30 * _cam.scale);
            _ctx.font = 'bold ' + Math.max(16, 20 * _cam.scale) + 'px "Segoe UI"'; _ctx.textAlign = 'center'; _ctx.textBaseline = 'middle';
            _ctx.shadowColor = '#ef4444'; _ctx.shadowBlur = 10; _ctx.fillStyle = '#ef4444'; _ctx.fillText('⚠', 0, 0);
            _ctx.shadowBlur = 0; _ctx.restore();
        }

        const isSelected = _core && _core.getSelected() && _core.getSelected().obj === line;
        if (line.showDimensions !== false && !isSelected && AnnotationManager.isVisible(1)) {
            const puntosReales = pts.filter(p => !p.isControlPoint);
            for (let i = 0; i < puntosReales.length - 1; i++) {
                const p1 = puntosReales[i], p2 = puntosReales[i + 1];
                if (Math.hypot(p2.x - p1.x, p2.y - p1.y, p2.z - p1.z) > 100) drawIsometricDimension(p1, p2);
            }
        }

        if (pts.length >= 2) drawFlowArrow(pts[0], pts[pts.length - 1]);
        if (lineLabel && pts.length >= 2 && AnnotationManager.isVisible(3)) {
            const midPt = getPointAtDistance(pts[0], pts[pts.length - 1],
                Math.hypot(pts[pts.length - 1].x - pts[0].x, pts[pts.length - 1].y - pts[0].y, pts[pts.length - 1].z - pts[0].z) / 2);
            const projMid = project(midPt);
            const plane = Math.abs(pts[1].x - pts[0].x) > Math.abs(pts[1].z - pts[0].z) ? 'XY' : 'ZY';
            drawIsoText(lineLabel, projMid.x, projMid.y - 20 * _cam.scale, plane);
        }
        drawPuertos(line);
    }

    function drawIsoText(text, x, y, plane) {
        if (!text) return;
        plane = plane || 'XY';
        _ctx.save();
        _ctx.font = 'bold ' + Math.max(10, 13 * _cam.scale) + 'px \'Segoe UI\', monospace';
        _ctx.textAlign = 'center'; _ctx.textBaseline = 'bottom';
        if (plane === 'XY') _ctx.setTransform(1, 0.4, 0, 1, x, y);
        else if (plane === 'ZY') _ctx.setTransform(1, -0.4, 0, 1, x, y);
        else _ctx.setTransform(1, -0.3, 1, 0.3, x, y);
        const tw = _ctx.measureText(text).width, padding = 8;
        _ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        _ctx.fillRect(-tw / 2 - padding, -18, tw + padding * 2, 22);
        _ctx.strokeStyle = 'rgba(51, 65, 85, 0.6)';
        _ctx.strokeRect(-tw / 2 - padding, -18, tw + padding * 2, 22);
        _ctx.fillStyle = '#fbbf24';
        _ctx.fillText(text, 0, -4);
        _ctx.restore();
        _ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    function drawFlowArrow(p1, p2) {
        if (!p1 || !p2) return;
        const proj1 = project(p1), proj2 = project(p2);
        const angle = Math.atan2(proj2.y - proj1.y, proj2.x - proj1.x);
        const midX = (proj1.x + proj2.x) / 2, midY = (proj1.y + proj2.y) / 2;
        _ctx.save(); _ctx.translate(midX, midY); _ctx.rotate(angle);
        const arrowSize = 10 * _cam.scale;
        _ctx.beginPath(); _ctx.moveTo(-arrowSize, -arrowSize / 2); _ctx.lineTo(0, 0); _ctx.lineTo(-arrowSize, arrowSize / 2);
        _ctx.fillStyle = '#00f2ff'; _ctx.shadowColor = '#00f2ff'; _ctx.shadowBlur = 6;
        _ctx.fill(); _ctx.shadowBlur = 0; _ctx.restore();
    }

    // ================================================================
    // COTAS Y DIMENSIONES
    // ================================================================
    function drawIsometricDimension(p1, p2) {
        const realDist = Math.hypot(p2.x - p1.x, p2.y - p1.y, p2.z - p1.z);
        if (realDist < 100) return;
        const orientation = getPipeOrientation(p1, p2);
        const dynamicOffset = Math.max(400, Math.min(2500, realDist * 0.35));
        const candidates = orientation === 'horizontal'
            ? [{ dx: 0, dy: -dynamicOffset, dz: 0 }, { dx: 0, dy: dynamicOffset, dz: 0 },
               { dx: dynamicOffset, dy: 0, dz: 0 }, { dx: -dynamicOffset, dy: 0, dz: 0 }]
            : [{ dx: dynamicOffset, dy: 0, dz: 0 }, { dx: -dynamicOffset, dy: 0, dz: 0 },
               { dx: 0, dy: -dynamicOffset, dz: 0 }, { dx: 0, dy: dynamicOffset, dz: 0 }];
        let chosen = candidates[0];
        for (const candidate of candidates) { if (!checkOffsetCollision(p1, p2, candidate)) { chosen = candidate; break; } }
        const dp1 = { x: p1.x + chosen.dx, y: p1.y + chosen.dy, z: p1.z + chosen.dz };
        const dp2 = { x: p2.x + chosen.dx, y: p2.y + chosen.dy, z: p2.z + chosen.dz };
        const pr1 = project(p1), pr2 = project(p2), prD1 = project(dp1), prD2 = project(dp2);
        const dir3D = getSegmentDirection3D(p1, p2);
        _ctx.save();
        _ctx.beginPath(); _ctx.setLineDash([3, 4]); _ctx.strokeStyle = '#64748b'; _ctx.lineWidth = 0.8;
        _ctx.moveTo(pr1.x, pr1.y); _ctx.lineTo(prD1.x, prD1.y);
        _ctx.moveTo(pr2.x, pr2.y); _ctx.lineTo(prD2.x, prD2.y); _ctx.stroke(); _ctx.setLineDash([]);
        _ctx.beginPath(); _ctx.moveTo(prD1.x, prD1.y); _ctx.lineTo(prD2.x, prD2.y);
        _ctx.strokeStyle = '#00ffcc'; _ctx.lineWidth = 1.2; _ctx.stroke();
        const midX = (prD1.x + prD2.x) / 2, midY = (prD1.y + prD2.y) / 2;
        _ctx.font = 'bold ' + Math.max(8, 11 * _cam.scale) + 'px \'Courier New\'';
        _ctx.fillStyle = '#ffffff'; _ctx.textAlign = 'center'; _ctx.textBaseline = 'middle';
        if (dir3D === 'X') _ctx.setTransform(1, 0.4, 0, 1, midX, midY - 5);
        else if (dir3D === 'Z') _ctx.setTransform(1, -0.4, 0, 1, midX, midY - 5);
        else _ctx.setTransform(1, 0, 0, 1, midX, midY - 5);
        _ctx.fillText(formatDimensionText(realDist), 0, 0);
        _ctx.restore(); _ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    // ================================================================
    // SÍMBOLOS DE COMPONENTES
    // ================================================================
    function drawPipeComponents(line) {
        if (!_core) return;
        const pts = _core.getLinePoints(line);
        if (!pts || pts.length < 2 || !line.components) return;
        let lengths = [], totalLen = 0;
        for (let i = 0; i < pts.length - 1; i++) { const d = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y, pts[i + 1].z - pts[i].z); lengths.push(d); totalLen += d; }
        if (totalLen === 0) return;
        line.components.forEach(comp => {
            const targetLen = totalLen * Math.min(1, Math.max(0, comp.param || 0.5));
            let currentAccum = 0, p1, p2, t = 0;
            for (let i = 0; i < lengths.length; i++) {
                if (currentAccum + lengths[i] >= targetLen || i === lengths.length - 1) { p1 = pts[i]; p2 = pts[i + 1]; const segLen = lengths[i]; t = segLen > 0 ? (targetLen - currentAccum) / segLen : 0; t = Math.min(1, Math.max(0, t)); break; }
                currentAccum += lengths[i];
            }
            if (!p1 || !p2) return;
            const pos3D = { x: p1.x + (p2.x - p1.x) * t, y: p1.y + (p2.y - p1.y) * t, z: p1.z + (p2.z - p1.z) * t };
            const proj = project(pos3D), dir3D = getSegmentDirection3D(p1, p2);
            const isHovered = _hoveredComponent === comp;
            _ctx.save();
            if (isHovered) { _ctx.shadowColor = '#fbbf24'; _ctx.shadowBlur = 15; _ctx.globalAlpha = 1; }
            else { _ctx.shadowColor = 'transparent'; _ctx.globalAlpha = 0.6; }
            drawSymbol(proj.x, proj.y, dir3D, comp);
            _ctx.restore();
            comp._screenPos = proj;
            if (AnnotationManager.isVisible(3)) {
                const globalIndex = _bomItems.length + 1;
                drawComponentTag(proj, globalIndex, comp.type, dir3D);
                comp._bomIndex = globalIndex;
                _bomItems.push({ index: globalIndex, desc: getComponentLabel(comp.type), mat: getShortMaterial(line.material), comp });
            }
        });
    }

    function drawSymbol(x, y, dir3D, comp) {
        _ctx.save();
        const s = Math.max(10, 16 * _cam.scale);
        _ctx.lineWidth = 1.5; _ctx.strokeStyle = '#e2e8f0'; _ctx.fillStyle = '#0f172a';
        if (dir3D === 'X') _ctx.setTransform(1, 0.4, 0, 1, x, y);
        else if (dir3D === 'Z') _ctx.setTransform(1, -0.4, 0, 1, x, y);
        else if (dir3D === 'Y') _ctx.setTransform(0, 1, -0.8, 0, x, y);
        const tipo = (comp.type || '').toUpperCase();

        if (tipo.includes('BUTTERFLY_VALVE')) {
            _ctx.beginPath(); _ctx.ellipse(0, 0, s * 0.9, s * 0.35, 0, 0, Math.PI * 2); _ctx.fill(); _ctx.stroke();
            _ctx.beginPath(); _ctx.moveTo(0, -s * 0.4); _ctx.lineTo(0, -s * 1.6); _ctx.strokeStyle = '#ef4444'; _ctx.lineWidth = 2; _ctx.stroke();
            _ctx.beginPath(); _ctx.moveTo(-s * 0.7, -s * 1.6); _ctx.lineTo(s * 0.7, -s * 1.6); _ctx.stroke();
            _ctx.fillStyle = '#fbbf24'; _ctx.beginPath(); _ctx.arc(0, -s * 1.6, s * 0.2, 0, Math.PI * 2); _ctx.fill();
        } else if (tipo.includes('BALL_VALVE') || tipo.includes('VALVE_BALL')) {
            const ballGrad = _ctx.createRadialGradient(-s * 0.1, -s * 0.1, s * 0.05, 0, 0, s * 0.65);
            ballGrad.addColorStop(0, '#ffffff'); ballGrad.addColorStop(0.5, '#94a3b8'); ballGrad.addColorStop(1, '#334155');
            _ctx.beginPath(); _ctx.arc(0, 0, s * 0.65, 0, Math.PI * 2); _ctx.fillStyle = ballGrad; _ctx.fill(); _ctx.stroke();
            _ctx.beginPath(); _ctx.moveTo(-s * 0.8, -s * 0.45); _ctx.lineTo(-s * 0.8, s * 0.45); _ctx.lineTo(0, 0); _ctx.closePath();
            _ctx.moveTo(s * 0.8, -s * 0.45); _ctx.lineTo(s * 0.8, s * 0.45); _ctx.lineTo(0, 0); _ctx.closePath();
            _ctx.fillStyle = '#0f172a'; _ctx.fill(); _ctx.stroke();
            _ctx.beginPath(); _ctx.moveTo(0, -s * 0.3); _ctx.lineTo(0, -s * 1.2); _ctx.lineTo(s * 0.6, -s * 1.2);
            _ctx.strokeStyle = '#f8fafc'; _ctx.lineWidth = 1.8; _ctx.stroke();
        } else if (tipo.includes('GATE_VALVE')) {
            _ctx.beginPath(); _ctx.moveTo(-s, -s * 0.6); _ctx.lineTo(s, s * 0.6); _ctx.lineTo(s, -s * 0.6); _ctx.lineTo(-s, s * 0.6); _ctx.closePath();
            _ctx.fillStyle = '#1e293b'; _ctx.fill(); _ctx.stroke();
            _ctx.beginPath(); _ctx.moveTo(0, 0); _ctx.lineTo(0, -s * 1.4); _ctx.moveTo(-s * 0.5, -s * 1.4); _ctx.lineTo(s * 0.5, -s * 1.4); _ctx.stroke();
            _ctx.fillStyle = '#fbbf24'; _ctx.beginPath(); _ctx.arc(0, -s * 1.4, s * 0.22, 0, Math.PI * 2); _ctx.fill();
        } else if (tipo.includes('GLOBE_VALVE')) {
            _ctx.beginPath(); _ctx.ellipse(0, 0, s * 0.85, s * 0.55, 0, 0, Math.PI * 2); _ctx.fillStyle = '#1e293b'; _ctx.fill(); _ctx.stroke();
            _ctx.beginPath(); _ctx.moveTo(0, -s * 0.55); _ctx.lineTo(0, s * 0.55); _ctx.stroke();
            _ctx.fillStyle = '#334155'; _ctx.fillRect(-s * 0.3, -s * 1.1, s * 0.6, s * 0.5); _ctx.strokeRect(-s * 0.3, -s * 1.1, s * 0.6, s * 0.5);
        } else if (tipo.includes('CHECK_VALVE')) {
            _ctx.strokeRect(-s, -s * 0.45, s * 2, s * 0.9);
            _ctx.fillStyle = '#4ade80'; _ctx.beginPath();
            _ctx.moveTo(-s * 0.5, 0); _ctx.lineTo(s * 0.35, -s * 0.35); _ctx.lineTo(s * 0.35, s * 0.35); _ctx.closePath(); _ctx.fill(); _ctx.stroke();
            _ctx.setLineDash([2, 3]); _ctx.beginPath(); _ctx.moveTo(-s, 0); _ctx.lineTo(-s * 0.5, 0); _ctx.stroke(); _ctx.setLineDash([]);
        } else if (tipo.includes('CONCENTRIC_REDUCER') || tipo.includes('ECCENTRIC_REDUCER')) {
            const reducGrad = _ctx.createLinearGradient(-s, 0, s, 0);
            reducGrad.addColorStop(0, '#475569'); reducGrad.addColorStop(1, '#94a3b8');
            _ctx.beginPath(); _ctx.moveTo(-s, -s * 0.5); _ctx.lineTo(s, -s * 0.8); _ctx.lineTo(s, s * 0.8); _ctx.lineTo(-s, s * 0.5); _ctx.closePath();
            _ctx.fillStyle = reducGrad; _ctx.fill(); _ctx.stroke();
            if (tipo.includes('ECCENTRIC')) { _ctx.beginPath(); _ctx.moveTo(-s, -s * 0.5); _ctx.lineTo(-s, s * 0.5); _ctx.strokeStyle = '#facc15'; _ctx.lineWidth = 1.5; _ctx.stroke(); }
        } else if (tipo.includes('WELD_NECK_FLANGE') || tipo.includes('SLIP_ON_FLANGE')) {
            _ctx.fillRect(-s * 0.35, -s * 0.9, s * 0.7, s * 1.8); _ctx.strokeRect(-s * 0.35, -s * 0.9, s * 0.7, s * 1.8);
            for (let py = -0.6; py <= 0.6; py += 0.4) { _ctx.beginPath(); _ctx.arc(-s * 0.55, py * s, s * 0.08, 0, Math.PI * 2); _ctx.fillStyle = '#64748b'; _ctx.fill(); _ctx.beginPath(); _ctx.arc(s * 0.55, py * s, s * 0.08, 0, Math.PI * 2); _ctx.fill(); }
        } else if (tipo.includes('BLIND_FLANGE')) {
            _ctx.fillRect(-s * 0.7, -s * 0.9, s * 1.4, s * 1.8); _ctx.strokeRect(-s * 0.7, -s * 0.9, s * 1.4, s * 1.8);
            _ctx.beginPath(); _ctx.moveTo(-s * 0.5, -s * 0.5); _ctx.lineTo(s * 0.5, s * 0.5); _ctx.moveTo(s * 0.5, -s * 0.5); _ctx.lineTo(-s * 0.5, s * 0.5); _ctx.stroke();
        } else if (tipo.includes('TEE_EQUAL') || tipo.includes('TEE_REDUCING') || tipo.includes('TEE_PPR')) {
            _ctx.beginPath(); _ctx.moveTo(-s * 0.9, 0); _ctx.lineTo(s * 0.9, 0); _ctx.moveTo(0, 0); _ctx.lineTo(0, -s * 1.3);
            _ctx.strokeStyle = '#f8fafc'; _ctx.lineWidth = 2.5; _ctx.stroke();
            _ctx.fillStyle = '#fbbf24'; _ctx.beginPath(); _ctx.arc(0, 0, s * 0.3, 0, Math.PI * 2); _ctx.fill(); _ctx.stroke();
            if (tipo.includes('TEE_REDUCING')) { _ctx.fillStyle = '#facc15'; _ctx.beginPath(); _ctx.arc(0, -s * 1.3, s * 0.25, 0, Math.PI * 2); _ctx.fill(); }
        } else if (tipo.includes('ELBOW_45') || tipo.includes('CODO_45')) {
            _ctx.beginPath(); _ctx.arc(0, 0, s, 0, Math.PI / 4); _ctx.strokeStyle = '#f8fafc'; _ctx.lineWidth = 2.5; _ctx.stroke();
            _ctx.fillStyle = '#ffffff'; _ctx.beginPath(); _ctx.arc(0, 0, s * 0.18, 0, Math.PI * 2); _ctx.fill();
        } else if (tipo.includes('ELBOW_90') || tipo.includes('CODO_90') || tipo.includes('ELBOW_90_PPR')) {
            const r = tipo.includes('LR') ? s * 1.3 : s * 0.9;
            _ctx.beginPath(); _ctx.arc(0, 0, r, 0, Math.PI / 2); _ctx.strokeStyle = '#f8fafc'; _ctx.lineWidth = 2.5; _ctx.stroke();
            _ctx.fillStyle = '#ffffff'; _ctx.beginPath(); _ctx.arc(0, 0, s * 0.18, 0, Math.PI * 2); _ctx.fill();
        } else if (tipo.includes('CAP') || tipo.includes('TAPON')) {
            _ctx.beginPath(); _ctx.arc(0, 0, s * 0.7, 0, Math.PI, true); _ctx.closePath(); _ctx.fill(); _ctx.stroke();
            _ctx.beginPath(); _ctx.moveTo(-s * 0.7, 0); _ctx.lineTo(-s * 1.0, 0); _ctx.moveTo(s * 0.7, 0); _ctx.lineTo(s * 1.0, 0); _ctx.stroke();
        } else if (tipo.includes('UNION') || tipo.includes('UNION_ACERO')) {
            _ctx.fillRect(-s * 0.7, -s * 0.7, s * 1.4, s * 1.4); _ctx.strokeRect(-s * 0.7, -s * 0.7, s * 1.4, s * 1.4);
            for (let i = -0.4; i <= 0.4; i += 0.3) { _ctx.beginPath(); _ctx.moveTo(-s * 0.7, i * s); _ctx.lineTo(s * 0.7, i * s); _ctx.strokeStyle = '#334155'; _ctx.stroke(); }
        } else if (tipo.includes('BULKHEAD')) {
            _ctx.beginPath(); _ctx.moveTo(-s * 0.25, -s * 1.2); _ctx.lineTo(-s * 0.25, s * 1.2); _ctx.lineWidth = 4; _ctx.strokeStyle = '#94a3b8'; _ctx.stroke();
            _ctx.lineWidth = 1.5; _ctx.strokeStyle = '#e2e8f0'; _ctx.strokeRect(-s * 1.0, -s * 0.6, s * 2.0, s * 1.2);
        } else if (tipo.includes('TRANSITION') || tipo.includes('ADAPTADOR')) {
            _ctx.beginPath(); _ctx.moveTo(-s, -s * 0.6); _ctx.lineTo(s * 0.2, -s * 0.8); _ctx.lineTo(s * 0.2, s * 0.8); _ctx.lineTo(-s, s * 0.6); _ctx.closePath();
            _ctx.fillStyle = '#1e293b'; _ctx.fill(); _ctx.stroke();
            _ctx.beginPath(); _ctx.moveTo(s * 0.2, -s * 0.6); _ctx.lineTo(s * 0.9, -s * 0.6); _ctx.lineTo(s * 0.9, s * 0.6); _ctx.lineTo(s * 0.2, s * 0.6);
            _ctx.fillStyle = '#475569'; _ctx.fill(); _ctx.stroke();
        } else if (tipo.includes('NIPPLE')) {
            _ctx.fillRect(-s * 0.9, -s * 0.4, s * 1.8, s * 0.8); _ctx.strokeRect(-s * 0.9, -s * 0.4, s * 1.8, s * 0.8);
            for (let i = -0.2; i <= 0.2; i += 0.2) { _ctx.beginPath(); _ctx.moveTo(-s * 0.9, i * s); _ctx.lineTo(s * 0.9, i * s); _ctx.strokeStyle = '#475569'; _ctx.stroke(); }
        } else if (tipo.includes('EXPANSION_JOINT')) {
            _ctx.fillRect(-s * 0.8, -s * 0.7, s * 1.6, s * 1.4); _ctx.strokeRect(-s * 0.8, -s * 0.7, s * 1.6, s * 1.4);
            for (let i = -0.5; i <= 0.5; i += 0.35) { _ctx.beginPath(); _ctx.moveTo(-s * 0.8, i * s); _ctx.lineTo(s * 0.8, i * s); _ctx.strokeStyle = '#fbbf24'; _ctx.stroke(); }
        } else if (tipo.includes('Y_STRAINER')) {
            _ctx.beginPath(); _ctx.moveTo(-s, 0); _ctx.lineTo(0, -s * 0.9); _ctx.lineTo(s, 0); _ctx.lineTo(0, s * 0.5); _ctx.closePath();
            _ctx.fill(); _ctx.stroke();
            _ctx.beginPath(); _ctx.moveTo(-s, 0); _ctx.lineTo(s, 0); _ctx.strokeStyle = '#4ade80'; _ctx.lineWidth = 2; _ctx.stroke();
        } else if (tipo.includes('PIPE_SHOE') || tipo.includes('U_BOLT') || tipo.includes('GUIDE') || tipo.includes('ANCHOR') || tipo.includes('HANGER') || tipo.includes('PIPE_CLAMP') || tipo.includes('SPRING_HANGER')) {
            _ctx.strokeStyle = '#64748b'; _ctx.lineWidth = 1.2; _ctx.setLineDash([3, 3]);
            _ctx.beginPath(); _ctx.moveTo(-s * 0.9, 0); _ctx.lineTo(s * 0.9, 0);
            if (tipo.includes('ANCHOR')) { _ctx.moveTo(-s * 0.6, -s * 0.5); _ctx.lineTo(-s * 0.6, s * 0.5); _ctx.moveTo(s * 0.6, -s * 0.5); _ctx.lineTo(s * 0.6, s * 0.5); }
            _ctx.stroke(); _ctx.setLineDash([]);
        } else if (tipo.includes('STEAM_TRAP')) {
            _ctx.fillRect(-s * 0.6, -s * 0.5, s * 1.2, s * 1.0); _ctx.strokeRect(-s * 0.6, -s * 0.5, s * 1.2, s * 1.0);
            _ctx.fillStyle = '#f59e0b'; _ctx.beginPath();
            _ctx.moveTo(0, -s * 0.3); _ctx.lineTo(-s * 0.3, s * 0.2); _ctx.lineTo(s * 0.3, s * 0.2); _ctx.closePath(); _ctx.fill();
        } else if (tipo.includes('FLEXIBLE_HOSE') || tipo.includes('MANGUERA')) {
            const hoseMat = tipo.includes('METALLIC') ? '#94a3b8' : '#22c55e';
            _ctx.fillStyle = hoseMat; _ctx.fillRect(-s * 0.8, -s * 0.4, s * 1.6, s * 0.8); _ctx.strokeRect(-s * 0.8, -s * 0.4, s * 1.6, s * 0.8);
            for (let i = 0; i < 4; i++) { _ctx.beginPath(); _ctx.moveTo(-s * 0.7 + i * s * 0.5, -s * 0.45); _ctx.lineTo(-s * 0.7 + i * s * 0.5 + s * 0.2, s * 0.45); _ctx.stroke(); }
        } else {
            _ctx.fillRect(-s * 0.8, -s * 0.8, s * 1.6, s * 1.6); _ctx.strokeRect(-s * 0.8, -s * 0.8, s * 1.6, s * 1.6);
            const lbl = getComponentLabel(comp.type);
            _ctx.fillStyle = '#ffffff'; _ctx.font = 'bold ' + Math.max(7, s * 0.65) + 'px Inter'; _ctx.textAlign = 'center'; _ctx.textBaseline = 'middle';
            _ctx.fillText(lbl, 0, 0);
        }
        _ctx.restore(); _ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    // ================================================================
    // SELECCIÓN Y PICKING
    // ================================================================
    function pointToSegmentDistance(p, a, b) {
        const ax = p.x - a.x, ay = p.y - a.y, bx = b.x - a.x, by = b.y - a.y;
        const dot = ax * bx + ay * by, len2 = bx * bx + by * by;
        if (len2 === 0) return Math.hypot(ax, ay);
        let t = Math.max(0, Math.min(1, dot / len2));
        const projX = a.x + t * bx, projY = a.y + t * by;
        return Math.hypot(p.x - projX, p.y - projY);
    }

    function isPointInCylinder(p, eq) { const dx = p.x - eq.posX, dz = p.z - eq.posZ; const radius = eq.diametro / 2; if (dx * dx + dz * dz > radius * radius) return false; const halfH = eq.altura / 2; return p.y >= eq.posY - halfH && p.y <= eq.posY + halfH; }
    function isPointInHorizontalCylinder(p, eq) { const dx = p.x - eq.posX; const halfL = eq.largo / 2; if (Math.abs(dx) > halfL) return false; const dy = p.y - eq.posY, dz = p.z - eq.posZ; const radius = eq.diametro / 2; return dy * dy + dz * dz <= radius * radius; }
    function isPointInBox(p, eq) { const box = getEquipmentDrawBox(eq); return Math.abs(p.x - eq.posX) <= box.halfWidth && Math.abs(p.y - eq.posY) <= box.halfHeight && Math.abs(p.z - eq.posZ) <= box.halfDepth; }

    function pickElement(mouseCanvas) {
        if (!_core) return null;
        const db = _core.getDb(); const equipos = db ? db.equipos : []; const lines = db ? db.lines : [];
        const worldClick = inverseProject(mouseCanvas.x, mouseCanvas.y);
        for (let i = equipos.length - 1; i >= 0; i--) {
            const eq = equipos[i]; let inside = false;
            const tipo = eq.tipo || '';
            if (['tanque_v', 'torre', 'reactor', 'desgasificador', 'desmineralizador', 'suavizador', 'filtro_carbon', 'filtro_arena', 'clarificador', 'columna_fraccionadora', 'evaporador', 'cristalizador', 'absorbedor', 'stripper', 'reactor_encamisado', 'autoclave', 'agitador', 'centrifuga_discos', 'tanque_aseptico', 'espesador', 'separador', 'antorcha'].includes(tipo)) inside = isPointInCylinder(worldClick, eq);
            else if (['tanque_h', 'separador_trifasico', 'slug_catcher', 'calentador_fuego_directo', 'secador_rotativo', 'centrifuga', 'filtro_tambor', 'molino'].includes(tipo)) inside = isPointInHorizontalCylinder(worldClick, eq);
            else inside = isPointInBox(worldClick, eq);
            if (inside) return { type: 'equipment', obj: eq };
        }
        for (const line of lines) {
            const pts = _core.getLinePoints(line); if (!pts || pts.length < 2) continue;
            for (let i = 0; i < pts.length - 1; i++) {
                if (pointToSegmentDistance(mouseCanvas, project(pts[i]), project(pts[i + 1])) < 10) return { type: 'line', obj: line };
            }
        }
        return null;
    }

    function pickComponent(mouseX, mouseY) {
        if (!_core) return null;
        const db = _core.getDb(); let closest = null, closestDist = 20;
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
        for (const item of [...(db.equipos || []), ...(db.lines || [])]) {
            if (!item.puertos) continue;
            for (const port of item.puertos) {
                const worldPos = { x: (item.posX || 0) + (port.relX || 0), y: (item.posY || 0) + (port.relY || 0), z: (item.posZ || 0) + (port.relZ || 0) };
                const screenPos = project(worldPos);
                if (Math.hypot(screenPos.x - mouseX, screenPos.y - mouseY) < SNAP_THRESHOLD) return { item, port, screenPos };
            }
        }
        return null;
    }

    function drawSelection(element) {
        if (!element) return;
        _ctx.save(); _ctx.strokeStyle = '#facc15'; _ctx.lineWidth = 3; _ctx.shadowColor = '#facc15'; _ctx.shadowBlur = 8;
        if (element.type === 'equipment') {
            const eq = element.obj, p = project({ x: eq.posX, y: eq.posY, z: eq.posZ });
            const box = getEquipmentDrawBox(eq), w = box.halfWidth * _cam.scale + 5, h = box.halfHeight * _cam.scale + 5;
            if (['tanque_v', 'torre', 'reactor'].includes(eq.tipo)) {
                _ctx.beginPath(); _ctx.ellipse(p.x, p.y - h, w, w * 0.5, 0, 0, 2 * Math.PI); _ctx.stroke();
                _ctx.beginPath(); _ctx.ellipse(p.x, p.y + h, w, w * 0.5, 0, 0, 2 * Math.PI); _ctx.stroke();
            } else _ctx.strokeRect(p.x - w, p.y - h, w * 2, h * 2);
        } else if (element.type === 'line') {
            const pts = _core.getLinePoints(element.obj);
            if (pts && pts.length >= 2) { _ctx.beginPath(); pts.forEach((p, i) => { const pr = project(p); i === 0 ? _ctx.moveTo(pr.x, pr.y) : _ctx.lineTo(pr.x, pr.y); }); _ctx.stroke(); }
        }
        _ctx.restore();
        drawPortMarkers(element.obj);
    }

    function drawPortMarkers(item) {
        if (!item || !item.puertos) return;
        const basePos = item.posX !== undefined ? { x: item.posX, y: item.posY, z: item.posZ } : (item._cachedPoints?.[0] || { x: 0, y: 0, z: 0 });
        item.puertos.forEach(port => {
            const worldPos = { x: basePos.x + (port.relX || 0), y: basePos.y + (port.relY || 0), z: basePos.z + (port.relZ || 0) };
            const screenPos = project(worldPos);
            _ctx.beginPath(); _ctx.fillStyle = port.status === 'open' ? '#10b981' : '#64748b';
            _ctx.arc(screenPos.x, screenPos.y, 6 * _cam.scale, 0, Math.PI * 2); _ctx.fill();
            _ctx.strokeStyle = '#ffffff'; _ctx.lineWidth = 1.5; _ctx.stroke();
        });
    }

    function drawTechnicalTooltip(ctx, comp, screenPos) {
        const compType = comp.type || '', desc = comp.nombre || compType, abbr = getComponentLabel(compType);
        const material = comp.material || 'N/D', spec = comp.spec || '';
        const boxW = 210, boxH = 75;
        const x = Math.min(screenPos.x + 25, _canvas.width - boxW - 10), y = Math.max(screenPos.y - 70, 10);
        ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.95)'; ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 1.5;
        ctx.fillRect(x, y, boxW, boxH); ctx.strokeRect(x, y, boxW, boxH);
        ctx.fillStyle = '#fbbf24'; ctx.font = 'bold 11px Inter'; ctx.fillText(abbr + ' — ' + desc, x + 10, y + 20);
        ctx.fillStyle = '#e2e8f0'; ctx.font = '9px Inter'; ctx.fillText('Material: ' + material, x + 10, y + 38);
        ctx.fillText('Tag: ' + (comp.tag || 'N/A'), x + 10, y + 52);
        if (spec) { ctx.fillStyle = '#94a3b8'; ctx.fillText('Spec: ' + spec, x + 10, y + 66); }
        ctx.restore();
    }

    function drawBOMTable() {
        if (_bomItems.length === 0) return;
        const x = 15, rowHeight = 18, headerHeight = 24, tableWidth = 260;
        const tableHeight = headerHeight + (_bomItems.length * rowHeight) + 10;
        const y = _canvas.height - tableHeight - 15;
        _ctx.save(); _ctx.setTransform(1, 0, 0, 1, 0, 0);
        _ctx.fillStyle = 'rgba(15, 23, 42, 0.92)'; _ctx.fillRect(x, y, tableWidth, tableHeight);
        _ctx.strokeStyle = '#0ea5e9'; _ctx.lineWidth = 1.5; _ctx.strokeRect(x, y, tableWidth, tableHeight);
        _ctx.fillStyle = '#0ea5e9'; _ctx.font = 'bold 10px "Segoe UI"'; _ctx.fillText("ITEM", x + 12, y + 16); _ctx.fillText("DESCRIPCIÓN", x + 50, y + 16); _ctx.fillText("MAT", x + 220, y + 16);
        _ctx.beginPath(); _ctx.moveTo(x + 10, y + 22); _ctx.lineTo(x + tableWidth - 10, y + 22); _ctx.strokeStyle = 'rgba(14, 165, 233, 0.3)'; _ctx.stroke();
        _bomItems.forEach((item, i) => {
            const rowY = y + headerHeight + (i * rowHeight) + 12;
            _ctx.fillStyle = 'rgba(14, 165, 233, 0.15)'; _ctx.beginPath(); _ctx.arc(x + 20, rowY - 3, 8, 0, Math.PI * 2); _ctx.fill();
            _ctx.fillStyle = '#f8fafc'; _ctx.font = 'bold 9px "Roboto Mono"'; _ctx.textAlign = 'center'; _ctx.fillText(item.index.toString(), x + 20, rowY);
            _ctx.textAlign = 'left'; _ctx.font = '9px monospace'; _ctx.fillStyle = '#e2e8f0'; _ctx.fillText(item.desc.length > 24 ? item.desc.substring(0, 21) + '...' : item.desc, x + 50, rowY);
            _ctx.fillStyle = '#94a3b8'; _ctx.fillText(item.mat, x + 220, rowY);
        });
        _ctx.restore();
    }

    // ================================================================
    // RENDER PRINCIPAL
    // ================================================================
    function render() {
        if (!_ctx || !_canvas) return;
        _renderScheduled = false;
        _ctx.clearRect(0, 0, _canvas.width, _canvas.height);
        const bgGrad = _ctx.createRadialGradient(_canvas.width / 2, _canvas.height / 2, _canvas.width * 0.1, _canvas.width / 2, _canvas.height / 2, _canvas.width * 0.9);
        bgGrad.addColorStop(0, '#0f172a'); bgGrad.addColorStop(1, '#020617');
        _ctx.fillStyle = bgGrad; _ctx.fillRect(0, 0, _canvas.width, _canvas.height);
        drawGrid(_currentElevation); drawOrigin();
        if (!_core) return;
        const db = _core.getDb(); if (!db) return;

        if (_cacheDirty) {
            _renderQueueCache = [];
            (db.equipos || []).forEach(eq => { const depth = eq.posX + eq.posZ + (eq.posY * 0.1); const type = eq.tipo === 'plataforma' ? 'PLATFORM' : 'EQUIPMENT'; _renderQueueCache.push({ type, depth, data: eq }); });
            (db.lines || []).forEach(line => { const pts = _core.getLinePoints(line); if (pts && pts.length >= 2) { const avgDepth = pts.reduce((acc, p) => acc + (p.x + p.z), 0) / pts.length; _renderQueueCache.push({ type: 'LINE', depth: avgDepth, data: line }); } });
            _renderQueueCache.sort((a, b) => { const order = { 'PLATFORM': 0, 'EQUIPMENT': 1, 'LINE': 2 }; const typeA = a.type, typeB = b.type; const orderDiff = (order[typeA] || 1) - (order[typeB] || 1); if (orderDiff !== 0) return orderDiff; return a.depth - b.depth; });
            _cacheDirty = false;
        }

        AnnotationManager.reset(); _bomItems = [];
        _renderQueueCache.forEach(item => {
            if (item.type === 'EQUIPMENT') {
                const eq = item.data, tipo = eq.tipo || '';
                if (['tanque_v', 'torre', 'reactor', 'desgasificador', 'desmineralizador', 'suavizador', 'filtro_carbon', 'filtro_arena', 'clarificador', 'columna_fraccionadora', 'evaporador', 'cristalizador', 'absorbedor', 'stripper', 'reactor_encamisado', 'autoclave', 'agitador', 'centrifuga_discos', 'tanque_aseptico', 'espesador', 'separador', 'antorcha'].includes(tipo)) drawTank(eq);
                else if (['tanque_h', 'separador_trifasico', 'slug_catcher', 'calentador_fuego_directo', 'secador_rotativo', 'centrifuga', 'filtro_tambor', 'molino'].includes(tipo)) drawHorizontalTank(eq);
                else if (['bomba', 'bomba_dosificacion', 'bomba_sumergible', 'homogeneizador_ap'].includes(tipo)) drawBomba(eq);
                else if (tipo === 'plataforma') drawPlatform(eq);
                else drawRectEquip(eq, '#475569');
                if (eq.puertos) eq.puertos.forEach(p => { if (p.elevation !== undefined || p.status === 'open') { const worldPos = { x: eq.posX + (p.relX || 0), y: eq.posY + (p.relY || 0), z: eq.posZ + (p.relZ || 0) }; drawNozzleTag(project(worldPos), p, eq); } });
            } else if (item.type === 'LINE') { drawPipeWithElbows(item.data); drawPipeComponents(item.data); }
        });

        const selected = _core.getSelected();
        if (selected) drawSelection(selected);
        if (_activeSnap) { _ctx.save(); _ctx.beginPath(); _ctx.strokeStyle = '#10b981'; _ctx.lineWidth = 2; _ctx.arc(_activeSnap.screenPos.x, _activeSnap.screenPos.y, 10, 0, Math.PI * 2); _ctx.stroke(); _ctx.fillStyle = '#10b981'; _ctx.font = 'bold 11px Arial'; _ctx.fillText(_activeSnap.item.tag + ':' + _activeSnap.port.id + ' (' + (_activeSnap.port.diametro || '?') + '")', _activeSnap.screenPos.x + 15, _activeSnap.screenPos.y - 10); _ctx.restore(); }
        if (_hoveredComponent && _hoveredComponentScreenPos) drawTechnicalTooltip(_ctx, _hoveredComponent, _hoveredComponentScreenPos);
        drawBOMTable();
    }

    function scheduleRender() { if (!_renderScheduled) { _renderScheduled = true; requestAnimationFrame(() => render()); } }

    function lineHasAuditError(line) {
        if (!_core) return false;
        if (line.origin && line.origin.objTag) { const obj = _core.findObjectByTag(line.origin.objTag); const nz = obj?.puertos?.find(p => p.id === line.origin.portId); if (nz && nz.diametro !== line.diameter) return true; }
        if (line.destination && line.destination.objTag) { const obj = _core.findObjectByTag(line.destination.objTag); const nz = obj?.puertos?.find(p => p.id === line.destination.portId); if (nz && nz.diametro !== line.diameter) return true; }
        return false;
    }

    // ================================================================
    // CONTROL DE CÁMARA - autoCenter HÍBRIDO (CORREGIDO)
    // ================================================================
    function autoCenter(options = {}) {
        if (!_canvas || !_core) return;
        const db = _core.getDb();
        const equipos = db?.equipos || [];
        const lines = db?.lines || [];
        const isMobile = /Mobi|Android/i.test(navigator.userAgent) || _canvas.width < 600;
        const padding = options.padding !== undefined ? options.padding : (isMobile ? 20 : 80);
        const minScale = options.minScale !== undefined ? options.minScale : (isMobile ? 0.06 : 0.12);
        const maxScale = options.maxScale !== undefined ? options.maxScale : (isMobile ? 0.5 : 0.7);
        const preferHorizontal = options.preferHorizontal !== undefined ? options.preferHorizontal : true;

        let points = [];

        // Usar getEquipmentDrawBox para puntos precisos
        equipos.forEach(eq => {
            const box = getEquipmentDrawBox(eq);
            points.push({ x: eq.posX + box.halfWidth, y: eq.posY + box.halfHeight, z: eq.posZ + box.halfDepth });
            points.push({ x: eq.posX - box.halfWidth, y: eq.posY - box.halfHeight, z: eq.posZ - box.halfDepth });
            points.push({ x: eq.posX + box.halfWidth, y: eq.posY - box.halfHeight, z: eq.posZ });
            points.push({ x: eq.posX, y: eq.posY + box.halfHeight, z: eq.posZ + box.halfDepth });
        });

        // Calcular centroide para filtrar líneas lejanas
        let centroid = { x: 0, y: 0, z: 0 };
        if (equipos.length > 0) {
            equipos.forEach(eq => { centroid.x += eq.posX; centroid.y += eq.posY; centroid.z += eq.posZ; });
            centroid.x /= equipos.length; centroid.y /= equipos.length; centroid.z /= equipos.length;
        }

        // Filtrar líneas lejanas (>15000mm del centroide)
        lines.forEach(line => {
            const pts = _core.getLinePoints(line);
            if (!pts) return;
            pts.forEach(p => {
                if (equipos.length === 0) points.push(p);
                else {
                    const dist = Math.hypot(p.x - centroid.x, p.y - centroid.y, p.z - centroid.z);
                    if (dist < 15000) points.push(p);
                }
            });
        });

        if (points.length === 0) points = [{ x: -2000, y: 0, z: -2000 }, { x: 2000, y: 2000, z: 2000 }];

        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        points.forEach(p => {
            const rx = (p.x - p.z) * COS30;
            const ry = (p.x + p.z) * SIN30 - p.y;
            if (rx < minX) minX = rx;
            if (rx > maxX) maxX = rx;
            if (ry < minY) minY = ry;
            if (ry > maxY) maxY = ry;
        });

        const margin = (maxX - minX) * 0.12;
        const marginY = (maxY - minY) * 0.12;
        minX -= margin; maxX += margin;
        minY -= marginY; maxY += marginY;

        const worldW = maxX - minX;
        const worldH = maxY - minY;

        let sc = Math.min((_canvas.width - padding * 2) / worldW, (_canvas.height - padding * 2) / worldH, maxScale);
        if (preferHorizontal && worldW > worldH) {
            sc = Math.min((_canvas.width - padding * 2) / worldW, maxScale);
        }
        sc = Math.max(minScale, sc);
        sc = isFinite(sc) ? sc : 0.3;

        _cam.scale = sc;
        _cam.panX = _canvas.width / 2 - ((minX + maxX) / 2) * sc;
        _cam.panY = _canvas.height / 2 - ((minY + maxY) / 2) * sc;

        if (_canvas.height > _canvas.width && isMobile) {
            _cam.panY -= _canvas.height * 0.08;
        }

        _cacheDirty = true;
        scheduleRender();
    }

    function pan(dx, dy) { _cam.panX += dx; _cam.panY += dy; _cacheDirty = true; scheduleRender(); }

    function zoom(delta, mouseX, mouseY) {
        const zoomFactor = delta > 0 ? 1.1 : 0.9, newScale = _cam.scale * zoomFactor;
        const clampedScale = Math.min(Math.max(0.05, newScale), 1.8);
        if (mouseX !== undefined && mouseY !== undefined && clampedScale !== _cam.scale) {
            _cam.panX = mouseX - (mouseX - _cam.panX) * (clampedScale / _cam.scale);
            _cam.panY = mouseY - (mouseY - _cam.panY) * (clampedScale / _cam.scale);
        }
        _cam.scale = clampedScale; _cacheDirty = true; scheduleRender();
    }

    function resizeCanvas() {
        if (!_canvas) return;
        const container = _canvas.parentElement, dpr = window.devicePixelRatio || 1;
        if (container) { _canvas.width = container.clientWidth * dpr; _canvas.height = container.clientHeight * dpr; _canvas.style.width = container.clientWidth + 'px'; _canvas.style.height = container.clientHeight + 'px'; _ctx.scale(dpr, dpr); }
        _cacheDirty = true;
        const isMobile = /Mobi|Android/i.test(navigator.userAgent) || _canvas.width < 600;
        autoCenter(isMobile ? { padding: 20, minScale: 0.06, maxScale: 0.5 } : {});
    }

    function setElevation(level) { _currentElevation = level; scheduleRender(); }

    // ================================================================
    // EXPORTACIONES
    // ================================================================
    function exportPDF() {
        if (!_canvas) return;
        if (typeof window.jspdf === 'undefined') { _notifyUI("Error: jsPDF no disponible.", true); return; }
        const { jsPDF } = window.jspdf; const doc = new jsPDF({ orientation: 'landscape' });
        const imgData = _canvas.toDataURL('image/png'); doc.addImage(imgData, 'PNG', 10, 10, 277, 150);
        doc.setFontSize(16); doc.text("SmartFlow - Reporte Isométrico", 10, 175);
        doc.setFontSize(10); doc.text('Proyecto: ' + (window.currentProjectName || 'N/D') + ' | Fecha: ' + new Date().toLocaleString(), 10, 185);
        doc.save((window.currentProjectName || 'Proyecto') + '_Isometrico_' + Date.now() + '.pdf');
        _notifyUI("PDF generado correctamente.", false);
    }

    function exportPCF() {
        if (!_core) { _notifyUI("Error: Core no inicializado.", true); return; }
        const db = _core.getDb(); const lines = db?.lines || [];
        if (lines.length === 0) { _notifyUI("No hay líneas para exportar.", true); return; }
        let pcfContent = "";
        db.equipos?.forEach(eq => { if (!eq.puertos) return; eq.puertos.forEach(nz => { const pos = { x: eq.posX + (nz.relX || 0), y: eq.posY + (nz.relY || 0), z: eq.posZ + (nz.relZ || 0) }; const dir = nz.orientacion || { dx: 0, dy: 0, dz: 1 }; pcfContent += 'NOZZLE\n    COMPONENT-IDENTIFIER ' + eq.tag + '-' + nz.id + '\n    END-POINT           ' + pos.x.toFixed(2) + ' ' + pos.y.toFixed(2) + ' ' + pos.z.toFixed(2) + '  ' + (nz.diametro * 25.4).toFixed(2) + '\n    DIRECTION           ' + dir.dx.toFixed(3) + ' ' + dir.dy.toFixed(3) + ' ' + dir.dz.toFixed(3) + '\n    SKEY                NOZZ\n    ITEM-DESCRIPTION    Boquilla ' + nz.id + ' ' + nz.diametro + '"\n\n'; }); });
        lines.forEach(line => { const pts = _core.getLinePoints(line); if (!pts || pts.length < 2) return; const diamMM = (line.diameter || 4) * 25.4; pcfContent += generatePCFHeader(line) + "\n";
            for (let i = 0; i < pts.length - 1; i++) { const p1 = pts[i], p2 = pts[i + 1]; if (!p1.isControlPoint && !p2.isControlPoint) { const dirVec = { dx: p2.x - p1.x, dy: p2.y - p1.y, dz: p2.z - p1.z }; const len = Math.hypot(dirVec.dx, dirVec.dy, dirVec.dz) || 1; const dir = { dx: dirVec.dx / len, dy: dirVec.dy / len, dz: dirVec.dz / len }; pcfContent += "PIPE\n    END-POINT           " + p1.x.toFixed(2) + " " + p1.y.toFixed(2) + " " + p1.z.toFixed(2) + "  " + diamMM.toFixed(2) + "\n    END-POINT           " + p2.x.toFixed(2) + " " + p2.y.toFixed(2) + " " + p2.z.toFixed(2) + "  " + diamMM.toFixed(2) + "\n    ENTRY               " + dir.dx.toFixed(3) + " " + dir.dy.toFixed(3) + " " + dir.dz.toFixed(3) + "\n    EXIT                " + dir.dx.toFixed(3) + " " + dir.dy.toFixed(3) + " " + dir.dz.toFixed(3) + "\n    ITEM-CODE           PIPE-" + (line.material || 'PPR') + "-" + line.diameter + "IN\n    SKEY                PIPE\n    FABRICATION-ITEM\n"; } }
            if (line.components && line.components.length > 0) { line.components.forEach(comp => { const pos = calculateComponentPosition(line, comp.param || 0.5); if (pos) pcfContent += formatComponentPCF(comp, pos, diamMM, pos.dir) + "\n"; }); }
            pcfContent += "\n";
        });
        const blob = new Blob([pcfContent], { type: 'text/plain' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        const projectName = window.currentProjectName || 'Proyecto'; const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        a.download = projectName + '_PCF_' + timestamp + '.pcf'; a.click();
        _notifyUI("Archivo PCF exportado correctamente.", false);
    }

    const skeyMap = {
        'GATE_VALVE': 'VAGF', 'GLOBE_VALVE': 'VGLF', 'BUTTERFLY_VALVE': 'VBAF', 'BALL_VALVE': 'VBAL',
        'VALVE_BALL': 'VBAL', 'CHECK_VALVE': 'VCFF', 'DIAPHRAGM_VALVE': 'VDIA', 'CONTROL_VALVE': 'VCON',
        'PRESSURE_RELIEF': 'VPRV', 'SAFETY_VALVE': 'VSFT', 'WELD_NECK_FLANGE': 'FLWN', 'SLIP_ON_FLANGE': 'FLSO',
        'BLIND_FLANGE': 'FLBL', 'LAP_JOINT_FLANGE': 'FLLJ', 'ELBOW_90_LR': 'ELBW', 'ELBOW_90_SR': 'ELBS',
        'ELBOW_45': 'ELL4', 'CONCENTRIC_REDUCER': 'RECN', 'ECCENTRIC_REDUCER': 'REEC', 'TEE_EQUAL': 'TEE',
        'TEE_REDUCING': 'TEER', 'CROSS': 'CROS', 'CAP': 'CAPF', 'PIPE_SHOE': 'SHOE', 'U_BOLT': 'UBOL',
        'GUIDE': 'GUID', 'ANCHOR': 'ANCH', 'TRANSITION': 'TRAN', 'UNION': 'UNIO', 'BULKHEAD': 'BULK',
        'Y_STRAINER': 'STRY', 'PRESSURE_GAUGE': 'INPG', 'TEMPERATURE_GAUGE': 'INTG', 'FLOW_METER': 'INFM',
        'LEVEL_SWITCH_RANA': 'INSLS', 'PLUG_VALVE': 'VAPL', 'CHOKE_VALVE': 'VACH', 'CRYOGENIC_VALVE': 'VACR'
    };

    function calculateComponentPosition(line, param) {
        const pts = _core ? _core.getLinePoints(line) : (line._cachedPoints || line.points3D);
        if (!pts || pts.length < 2) return null;
        let lengths = [], totalLen = 0;
        for (let i = 0; i < pts.length - 1; i++) { let d = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y, pts[i + 1].z - pts[i].z); lengths.push(d); totalLen += d; }
        if (totalLen === 0) return null;
        const targetLen = totalLen * param; let currentAccum = 0, segIndex = 0, t = 0;
        for (let i = 0; i < lengths.length; i++) { if (currentAccum + lengths[i] >= targetLen || i === lengths.length - 1) { segIndex = i; let segLen = lengths[i]; if (segLen > 0) t = (targetLen - currentAccum) / segLen; else t = 0; t = Math.min(1, Math.max(0, t)); break; } currentAccum += lengths[i]; }
        const p1 = pts[segIndex], p2 = pts[segIndex + 1];
        const compPos = { x: p1.x + (p2.x - p1.x) * t, y: p1.y + (p2.y - p1.y) * t, z: p1.z + (p2.z - p1.z) * t };
        const dirVec = { dx: p2.x - p1.x, dy: p2.y - p1.y, dz: p2.z - p1.z }; const len = Math.hypot(dirVec.dx, dirVec.dy, dirVec.dz) || 1;
        return { p1: compPos, p2: compPos, dir: { dx: dirVec.dx / len, dy: dirVec.dy / len, dz: dirVec.dz / len } };
    }

    function generatePCFHeader(line) {
        const db = _core.getDb(); const projectName = window.currentProjectName || db?.projectName || 'ACQ-PROJECT';
        return ['ISOGEN-FILES PCF.STYLE', 'UNITS-BORMM             MM', 'UNITS-COOR              MM', 'UNITS-WEIGHT            KG', 'PIPELINE-REFERENCE      ' + line.tag, 'REVISION                ' + (line.revision || '0'), 'PROJECT-IDENTIFIER      ' + projectName, 'ATTRIBUTE1              ' + (line.service || 'PROCESS'), 'ATTRIBUTE2              ' + (line.spec || 'UNSPECIFIED'), 'END-POSITION-CHECK      OFF'].join('\n');
    }

    function formatComponentPCF(comp, pos, diameterMM, dirVec) {
        const skey = skeyMap[comp.type] || 'MISC';
        let lines = [comp.type, '    END-POINT           ' + pos.p1.x.toFixed(2) + ' ' + pos.p1.y.toFixed(2) + ' ' + pos.p1.z.toFixed(2) + '  ' + diameterMM.toFixed(2), '    END-POINT           ' + pos.p2.x.toFixed(2) + ' ' + pos.p2.y.toFixed(2) + ' ' + pos.p2.z.toFixed(2) + '  ' + diameterMM.toFixed(2), '    SKEY                ' + skey, '    ITEM-CODE           ' + (comp.itemCode || comp.type), '    ITEM-DESCRIPTION    ' + (comp.description || comp.nombre || comp.type)];
        if (dirVec) { lines.push('    ENTRY               ' + dirVec.dx.toFixed(3) + ' ' + dirVec.dy.toFixed(3) + ' ' + dirVec.dz.toFixed(3)); lines.push('    EXIT                ' + dirVec.dx.toFixed(3) + ' ' + dirVec.dy.toFixed(3) + ' ' + dirVec.dz.toFixed(3)); }
        lines.push('    FABRICATION-ITEM'); return lines.join('\n');
    }

    // ================================================================
    // INICIALIZACIÓN
    // ================================================================
    function init(canvasElement, coreInstance, catalogInstance, notifyFn) {
        _canvas = canvasElement;
        _ctx = _canvas.getContext('2d');
        _core = coreInstance;
        _catalog = catalogInstance || (typeof SmartFlowCatalog !== 'undefined' ? SmartFlowCatalog : null);
        _notifyUI = notifyFn || ((msg, isErr) => console.log(msg));
        _currentElevation = 0;
        resizeCanvas();
        window.addEventListener('resize', resizeCanvas);
        window.addEventListener('orientationchange', () => setTimeout(resizeCanvas, 100));
        if (_core && _core.on) { _core.on('modelChanged', () => { _cacheDirty = true; scheduleRender(); }); }
        _canvas.addEventListener('mousemove', (e) => {
            const rect = _canvas.getBoundingClientRect(), mX = e.clientX - rect.left, mY = e.clientY - rect.top;
            const snapped = pickPort(mX, mY);
            if (snapped) { _activeSnap = snapped; _canvas.style.cursor = 'crosshair'; _hoveredComponent = null; _hoveredComponentScreenPos = null; }
            else { _activeSnap = null; const hovered = pickComponent(mX, mY); if (hovered) { _hoveredComponent = hovered; _hoveredComponentScreenPos = hovered._screenPos || { x: mX, y: mY }; _canvas.style.cursor = 'pointer'; } else { _hoveredComponent = null; _hoveredComponentScreenPos = null; _canvas.style.cursor = pickElement({ x: mX, y: mY }) ? 'pointer' : 'default'; } }
            scheduleRender();
        });
        _canvas.addEventListener('wheel', (e) => { e.preventDefault(); const rect = _canvas.getBoundingClientRect(); zoom(e.deltaY < 0 ? 1 : -1, e.clientX - rect.left, e.clientY - rect.top); });
        let lastTouchDist = 0;
        _canvas.addEventListener('touchmove', (e) => { if (e.touches.length === 2) { const dx = e.touches[0].clientX - e.touches[1].clientX, dy = e.touches[0].clientY - e.touches[1].clientY, dist = Math.hypot(dx, dy); if (lastTouchDist) { const delta = dist - lastTouchDist, midX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - _canvas.getBoundingClientRect().left, midY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - _canvas.getBoundingClientRect().top; zoom(delta > 0 ? 1 : -1, midX, midY); } lastTouchDist = dist; e.preventDefault(); } });
        _canvas.addEventListener('touchend', () => { lastTouchDist = 0; });
        const isMobile = /Mobi|Android/i.test(navigator.userAgent) || _canvas.width < 600;
        autoCenter(isMobile ? { padding: 20, minScale: 0.06, maxScale: 0.5 } : {});
        scheduleRender();
        console.log('✔ SmartFlowRenderer v4.1 - autoCenter híbrido');
    }

    // ================================================================
    // API PÚBLICA
    // ================================================================
    const api = {
        init, render: scheduleRender, autoCenter, pan, zoom,
        project, inverseProject, setElevation, resizeCanvas,
        exportPDF, exportPCF, getCam: () => _cam, pickElement,
        getActiveSnap: () => _activeSnap, calculateComponentPosition,
        getCanvas: () => _canvas, getBOMItems: () => _bomItems,
        toDataURL: (format, quality) => _canvas ? _canvas.toDataURL(format, quality) : null
    };

    if (typeof window !== 'undefined') window.SmartFlowRenderer = api;
    return api;
})();
