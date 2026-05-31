
// ============================================================
// SMARTFLOW RENDERER v5.1 - MOTOR 2.5D INDUSTRIAL (VERSIÓN GANADORA)
// Incluye: Texturas PBR, detalles en válvulas, instrumentos, soportes
// autoCenter: VERSIÓN CORREGIDA (calcula bounding box real)
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
    // CONFIGURACIÓN INDUSTRIAL - MATERIALES Y TEXTURAS
    // ================================================================
    const ISO_CONFIG = {
        MATERIALS: {
            'PPR': 'PP', 'CARBON_STEEL': 'CS', 'STAINLESS_STEEL': 'SS',
            'HDPE': 'PE', 'PVC': 'PV', 'CONCRETE': 'CO',
            'ALUMINUM': 'AL', 'WOOD': 'WD', 'FRP': 'FR'
        },
        COLORS: {
            'PP': '#10b981', 'CS': '#475569', 'SS': '#94a3b8',
            'PE': '#1e293b', 'PV': '#7c3aed', 'CO': '#9ca3af',
            'AL': '#d1d5db', 'WD': '#8b6914', 'FR': '#8b5cf6'
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
    // FUNCIONES DE PROYECCIÓN
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
        const R = (num >> 16) + amt;
        const G = ((num >> 8) & 0xFF) + amt;
        const B = (num & 0xFF) + amt;
        return "#" + (0x1000000 + (R < 255 ? (R < 0 ? 0 : R) : 255) * 0x10000 +
            (G < 255 ? (G < 0 ? 0 : G) : 255) * 0x100 + (B < 255 ? (B < 0 ? 0 : B) : 255)).toString(16).slice(1);
    }

    // ================================================================
    // UTILIDADES DE MATERIALES (PBR)
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

    function getMaterialGradient(ctx, p1, p2, materialType) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 0.1) {
            if (materialType === 'SS') return '#b2bec3';
            if (materialType === 'PP') return '#10b981';
            return '#2c3e50';
        }

        let colorPalette;
        const material = (materialType || '').toUpperCase();
        
        if (material.includes('CARBON_STEEL') || material.includes('CS')) {
            colorPalette = ['#2c3e50', '#7f8c8d', '#111111'];
        } else if (material.includes('STAINLESS') || material.includes('SS')) {
            colorPalette = ['#dfe6e9', '#b2bec3', '#636e72'];
        } else if (material.includes('PPR') || material.includes('PP')) {
            colorPalette = ['#10b981', '#34d399', '#064e3b'];
        } else if (material.includes('HDPE') || material.includes('PE')) {
            colorPalette = ['#3b82f6', '#60a5fa', '#1e3a8a'];
        } else if (material.includes('PVC')) {
            colorPalette = ['#0984e3', '#74b9ff', '#023e8a'];
        } else if (material.includes('CONCRETE')) {
            colorPalette = ['#9ca3af', '#cbd5e1', '#475569'];
        } else {
            colorPalette = ['#95a5a6', '#bdc3c7', '#7f8c8d'];
        }

        const nx = -dy / distance;
        const ny = dx / distance;
        const offsetX = nx * 6;
        const offsetY = ny * 6;

        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;

        const grad = ctx.createLinearGradient(
            midX - offsetX, midY - offsetY,
            midX + offsetX, midY + offsetY
        );

        grad.addColorStop(0, colorPalette[0]);
        grad.addColorStop(0.35, colorPalette[1]);
        grad.addColorStop(1, colorPalette[2]);

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
            'GATE_VALVE': 'GV', 'GLOBE_VALVE': 'GL', 'BUTTERFLY_VALVE': 'VB',
            'BALL_VALVE': 'BA', 'CHECK_VALVE': 'CK', 'DIAPHRAGM_VALVE': 'DV',
            'CONTROL_VALVE': 'CV', 'CONCENTRIC_REDUCER': 'RC', 'ECCENTRIC_REDUCER': 'RE',
            'WELD_NECK_FLANGE': 'FL', 'BLIND_FLANGE': 'FB', 'TEE_EQUAL': 'TE',
            'TEE_REDUCING': 'TR', 'ELBOW_90_LR': 'EL', 'ELBOW_45': 'E4',
            'PRESSURE_GAUGE': 'PG', 'TEMPERATURE_GAUGE': 'TG', 'FLOW_METER': 'FM',
            'PIPE_SHOE': 'SH', 'U_BOLT': 'UB', 'ANCHOR': 'AN', 'HANGER': 'HG'
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

    function getScheduleFactor(spec) {
        if (!spec) return 1.0;
        const upper = spec.toUpperCase();
        for (const [key, val] of Object.entries(ISO_CONFIG.PIPE_SCHEDULES)) {
            if (upper.includes(key)) return val;
        }
        return 1.0;
    }

    function getEquipmentDrawBox(eq) {
        const tipo = eq.tipo || '';
        if (tipo === 'tanque_v' || tipo === 'torre' || tipo === 'reactor' ||
            tipo === 'separador' || tipo === 'filtro_arena' || tipo === 'clarificador') {
            return { halfWidth: (eq.diametro || 1000) / 2, halfHeight: (eq.altura || 1500) / 2, halfDepth: (eq.diametro || 1000) / 2 };
        }
        if (tipo === 'tanque_h' || tipo === 'intercambiador') {
            return { halfWidth: (eq.largo || 4000) / 2, halfHeight: (eq.diametro || 1000) / 2, halfDepth: (eq.diametro || 1000) / 2 };
        }
        if (tipo === 'bomba' || tipo === 'bomba_centrifuga') {
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
        const db = _core.getDb();
        if (db && db.equipos) {
            for (const candidate of candidates) {
                const midPoint = {
                    x: (p1.x + p2.x) / 2 + candidate.dx,
                    y: (p1.y + p2.y) / 2 + candidate.dy,
                    z: (p1.z + p2.z) / 2 + candidate.dz
                };
                let collision = false;
                for (const eq of db.equipos) {
                    const box = getEquipmentDrawBox(eq);
                    const dx = Math.abs(midPoint.x - eq.posX);
                    const dz = Math.abs(midPoint.z - eq.posZ);
                    if (dx <= box.halfWidth + 1200 && dz <= box.halfDepth + 1200) {
                        collision = true;
                        break;
                    }
                }
                if (!collision) {
                    chosen = candidate;
                    break;
                }
            }
        }
        
        const dp1 = { x: p1.x + chosen.dx, y: p1.y + chosen.dy, z: p1.z + chosen.dz };
        const dp2 = { x: p2.x + chosen.dx, y: p2.y + chosen.dy, z: p2.z + chosen.dz };
        const pr1 = project(p1), pr2 = project(p2);
        const prD1 = project(dp1), prD2 = project(dp2);
        const dir3D = getSegmentDirection3D(p1, p2);
        
        _ctx.save();
        
        _ctx.beginPath();
        _ctx.setLineDash([3, 4]);
        _ctx.strokeStyle = '#64748b';
        _ctx.lineWidth = 0.8;
        _ctx.moveTo(pr1.x, pr1.y);
        _ctx.lineTo(prD1.x, prD1.y);
        _ctx.moveTo(pr2.x, pr2.y);
        _ctx.lineTo(prD2.x, prD2.y);
        _ctx.stroke();
        _ctx.setLineDash([]);
        
        _ctx.beginPath();
        _ctx.moveTo(prD1.x, prD1.y);
        _ctx.lineTo(prD2.x, prD2.y);
        _ctx.strokeStyle = '#00ffcc';
        _ctx.lineWidth = 1.2;
        _ctx.stroke();
        
        const midX = (prD1.x + prD2.x) / 2;
        const midY = (prD1.y + prD2.y) / 2;
        const dimText = formatDimensionText(realDist);
        
        _ctx.font = 'bold ' + Math.max(8, 11 * _cam.scale) + 'px monospace';
        _ctx.fillStyle = '#ffffff';
        _ctx.textAlign = 'center';
        _ctx.textBaseline = 'middle';
        
        if (dir3D === 'X') {
            _ctx.setTransform(1, 0.4, 0, 1, midX, midY - 5);
        } else if (dir3D === 'Z') {
            _ctx.setTransform(1, -0.4, 0, 1, midX, midY - 5);
        } else {
            _ctx.setTransform(1, 0, 0, 1, midX, midY - 5);
        }
        
        const textW = _ctx.measureText(dimText).width + 8;
        _ctx.fillStyle = 'rgba(10, 15, 30, 0.85)';
        _ctx.fillRect(-textW / 2, -10, textW, 16);
        _ctx.fillStyle = '#00ffcc';
        _ctx.fillText(dimText, 0, -2);
        
        _ctx.restore();
        _ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    // ================================================================
    // DIBUJO DE GRID Y ORIGEN
    // ================================================================
    function drawGrid(elevation) {
        elevation = elevation || 0;
        const step = 1000;
        const minX = -10000, maxX = 20000, minZ = -10000, maxZ = 20000;
        
        _ctx.beginPath();
        _ctx.strokeStyle = '#1e293b';
        _ctx.lineWidth = 1;
        _ctx.globalAlpha = 0.12;
        
        for (let x = minX; x <= maxX; x += step) {
            const p1 = project({ x, y: elevation, z: minZ });
            const p2 = project({ x, y: elevation, z: maxZ });
            _ctx.moveTo(p1.x, p1.y);
            _ctx.lineTo(p2.x, p2.y);
        }
        for (let z = minZ; z <= maxZ; z += step) {
            const p1 = project({ x: minX, y: elevation, z });
            const p2 = project({ x: maxX, y: elevation, z });
            _ctx.moveTo(p1.x, p1.y);
            _ctx.lineTo(p2.x, p2.y);
        }
        _ctx.stroke();
        _ctx.globalAlpha = 1.0;
    }

    function drawOrigin() {
        const o = project({ x: 0, y: _currentElevation, z: 0 });
        _ctx.beginPath();
        _ctx.moveTo(o.x - 25, o.y);
        _ctx.lineTo(o.x + 25, o.y);
        _ctx.moveTo(o.x, o.y - 25);
        _ctx.lineTo(o.x, o.y + 25);
        _ctx.strokeStyle = '#ff8888';
        _ctx.lineWidth = 2;
        _ctx.stroke();
        _ctx.fillStyle = '#ff8888';
        _ctx.font = 'bold 12px monospace';
        _ctx.fillText('ORIGEN (0, ' + (_currentElevation / 1000).toFixed(1) + 'm, 0)', o.x + 20, o.y - 10);
    }

    // ================================================================
    // DIBUJO DE EQUIPOS
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

    function drawEquipmentTag(anchor, tag, dir3D) {
        if (_cam.scale < 0.2) return;
        
        const boxW = 100, boxH = 24;
        let x = anchor.x - boxW / 2;
        let y = anchor.y - boxH - 10;
        
        x = Math.max(2, Math.min(x, _canvas.width - boxW - 2));
        y = Math.max(2, Math.min(y, _canvas.height - boxH - 2));
        
        _ctx.save();
        _ctx.setTransform(1, 0, 0, 1, 0, 0);
        
        _ctx.beginPath();
        _ctx.moveTo(anchor.x, anchor.y);
        _ctx.lineTo(x + boxW / 2, y + boxH);
        _ctx.strokeStyle = '#f59e0b';
        _ctx.lineWidth = 1.2;
        _ctx.stroke();
        
        _ctx.fillStyle = '#1e293b';
        _ctx.fillRect(x, y, boxW, boxH);
        _ctx.strokeStyle = '#f59e0b';
        _ctx.strokeRect(x, y, boxW, boxH);
        
        _ctx.fillStyle = '#fbbf24';
        _ctx.font = 'bold ' + Math.max(9, 11 * _cam.scale) + 'px monospace';
        _ctx.textAlign = 'center';
        _ctx.textBaseline = 'middle';
        _ctx.fillText(tag, x + boxW / 2, y + boxH / 2);
        
        _ctx.restore();
    }

    function drawTank(eq) {
        const p = project({ x: eq.posX, y: eq.posY, z: eq.posZ });
        const box = getEquipmentDrawBox(eq);
        const w = box.halfWidth * _cam.scale;
        const h = box.halfHeight * 2 * _cam.scale;
        const topY = p.y - h;
        const bottomY = p.y + h;
        const color = getMaterialColor(eq.spec, eq.material);

        _ctx.shadowColor = 'rgba(0,0,0,0.3)';
        _ctx.shadowBlur = 8 * _cam.scale;
        
        _ctx.beginPath();
        _ctx.ellipse(p.x, bottomY, w, w * 0.5, 0, 0, 2 * Math.PI);
        const grad = _ctx.createLinearGradient(p.x - w, 0, p.x + w, 0);
        grad.addColorStop(0, adjustColor(color, -30));
        grad.addColorStop(0.3, color);
        grad.addColorStop(0.7, adjustColor(color, 20));
        grad.addColorStop(1, adjustColor(color, -20));
        _ctx.fillStyle = grad;
        _ctx.fill();
        _ctx.strokeStyle = '#ffffff';
        _ctx.lineWidth = 1;
        _ctx.stroke();
        
        _ctx.fillStyle = adjustColor(color, -20);
        _ctx.fillRect(p.x - w, topY, w, h);
        _ctx.fillStyle = adjustColor(color, 10);
        _ctx.fillRect(p.x, topY, w, h);
        
        _ctx.beginPath();
        _ctx.ellipse(p.x, topY, w, w * 0.5, 0, 0, 2 * Math.PI);
        _ctx.fillStyle = adjustColor(color, 15);
        _ctx.fill();
        _ctx.stroke();
        
        // Anillos de refuerzo
        const numRings = Math.floor(h / 800);
        for (let i = 1; i <= numRings; i++) {
            const ringY = topY + (i * h / (numRings + 1));
            _ctx.beginPath();
            _ctx.ellipse(p.x, ringY, w + 2, (w + 2) * 0.5, 0, 0, 2 * Math.PI);
            _ctx.strokeStyle = adjustColor(color, 30);
            _ctx.lineWidth = 1.2;
            _ctx.stroke();
        }
        
        // Indicador de nivel
        if (eq.nivel && eq.nivel > 0) {
            const nivelY = bottomY - (eq.nivel / eq.altura) * h;
            _ctx.fillStyle = 'rgba(0, 242, 255, 0.12)';
            _ctx.fillRect(p.x - w + 2, nivelY, w - 2, bottomY - nivelY - 2);
            _ctx.strokeStyle = '#00f2ff';
            _ctx.lineWidth = 1;
            _ctx.setLineDash([4, 4]);
            _ctx.beginPath();
            _ctx.moveTo(p.x - w + 5, nivelY);
            _ctx.lineTo(p.x + w - 5, nivelY);
            _ctx.stroke();
            _ctx.setLineDash([]);
        }
        
        _ctx.shadowBlur = 0;

        const projCenter = project({ x: eq.posX, y: eq.posY + box.halfHeight * 1.2, z: eq.posZ });
        drawEquipmentTag(projCenter, eq.tag, 'Y');
        drawPuertos(eq);
    }

    function drawHorizontalTank(eq) {
        const p = project({ x: eq.posX, y: eq.posY, z: eq.posZ });
        const box = getEquipmentDrawBox(eq);
        const w = box.halfWidth * _cam.scale;
        const h = box.halfHeight * _cam.scale;
        const color = getMaterialColor(eq.spec, eq.material);

        _ctx.shadowBlur = 6 * _cam.scale;
        
        const grad = _ctx.createLinearGradient(p.x - w, p.y - h, p.x + w, p.y + h);
        grad.addColorStop(0, adjustColor(color, -20));
        grad.addColorStop(0.5, color);
        grad.addColorStop(1, adjustColor(color, -20));
        _ctx.fillStyle = grad;
        _ctx.fillRect(p.x - w, p.y - h, w * 2, h * 2);
        _ctx.strokeStyle = '#ffffff';
        _ctx.strokeRect(p.x - w, p.y - h, w * 2, h * 2);
        
        _ctx.beginPath();
        _ctx.ellipse(p.x - w, p.y, h, h * 0.6, 0, 0, 2 * Math.PI);
        _ctx.fillStyle = adjustColor(color, -10);
        _ctx.fill();
        _ctx.stroke();
        
        _ctx.beginPath();
        _ctx.ellipse(p.x + w, p.y, h, h * 0.6, 0, 0, 2 * Math.PI);
        _ctx.fillStyle = adjustColor(color, -10);
        _ctx.fill();
        _ctx.stroke();
        
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
        grad.addColorStop(0, adjustColor(color, 30));
        grad.addColorStop(0.6, color);
        grad.addColorStop(1, adjustColor(color, -30));
        _ctx.fillStyle = grad;
        _ctx.beginPath();
        _ctx.ellipse(p.x, p.y, rad, rad * 0.8, 0, 0, 2 * Math.PI);
        _ctx.fill();
        _ctx.strokeStyle = '#ffffff';
        _ctx.stroke();
        
        const motorRad = rad * 0.6;
        _ctx.fillStyle = adjustColor(color, -20);
        _ctx.beginPath();
        _ctx.ellipse(p.x, p.y - rad * 0.7, motorRad, motorRad * 0.7, 0, 0, 2 * Math.PI);
        _ctx.fill();
        _ctx.stroke();
        
        // Acople
        _ctx.fillStyle = '#888888';
        _ctx.fillRect(p.x - 3, p.y - rad * 0.4, 6, rad * 0.5);
        
        _ctx.beginPath();
        _ctx.moveTo(p.x, p.y);
        _ctx.lineTo(p.x, p.y - rad * 0.9);
        _ctx.strokeStyle = '#94a3b8';
        _ctx.lineWidth = 2;
        _ctx.stroke();
        
        _ctx.shadowBlur = 0;

        const projCenter = project({ x: eq.posX, y: eq.posY + rad * 0.5, z: eq.posZ });
        drawEquipmentTag(projCenter, eq.tag, 'Y');
        drawPuertos(eq);
    }

    function drawPlatform(eq) {
        const p = project({ x: eq.posX, y: eq.posY, z: eq.posZ });
        const box = getEquipmentDrawBox(eq);
        const w = box.halfWidth * _cam.scale;
        const d = box.halfDepth * _cam.scale;
        const h = box.halfHeight * 2 * _cam.scale;
        const topY = p.y - h;
        const color = getMaterialColor(eq.spec, eq.material);

        _ctx.fillStyle = 'rgba(0,0,0,0.2)';
        _ctx.beginPath();
        _ctx.moveTo(p.x - w + 3, topY + 3);
        _ctx.lineTo(p.x - w + d * 0.5 + 3, topY - d * 0.25 + 3);
        _ctx.lineTo(p.x + d * 0.5 + 3, topY - d * 0.25 + 3);
        _ctx.lineTo(p.x + w + 3, topY + 3);
        _ctx.lineTo(p.x + d * 0.5 + 3, topY + d * 0.25 + 3);
        _ctx.lineTo(p.x - w + d * 0.5 + 3, topY + d * 0.25 + 3);
        _ctx.closePath();
        _ctx.fill();

        const grad = _ctx.createLinearGradient(p.x - w, topY, p.x + w, topY);
        grad.addColorStop(0, adjustColor(color, -20));
        grad.addColorStop(0.3, color);
        grad.addColorStop(0.7, adjustColor(color, 15));
        grad.addColorStop(1, adjustColor(color, -20));
        _ctx.fillStyle = grad;
        _ctx.strokeStyle = adjustColor(color, -40);
        _ctx.lineWidth = 1.5;
        _ctx.beginPath();
        _ctx.moveTo(p.x - w, topY);
        _ctx.lineTo(p.x - w + d * 0.5, topY - d * 0.25);
        _ctx.lineTo(p.x + d * 0.5, topY - d * 0.25);
        _ctx.lineTo(p.x + w, topY);
        _ctx.lineTo(p.x + d * 0.5, topY + d * 0.25);
        _ctx.lineTo(p.x - w + d * 0.5, topY + d * 0.25);
        _ctx.closePath();
        _ctx.fill();
        _ctx.stroke();

        const projCenter = project({ x: eq.posX, y: topY - 30, z: eq.posZ });
        drawEquipmentTag(projCenter, eq.tag, 'Y');
    }

    function drawRectEquip(eq, defaultColor) {
        const p = project({ x: eq.posX, y: eq.posY, z: eq.posZ });
        const box = getEquipmentDrawBox(eq);
        const w = box.halfWidth * _cam.scale;
        const h = box.halfHeight * _cam.scale;
        const color = getMaterialColor(eq.spec, eq.material) || defaultColor || '#475569';

        _ctx.shadowBlur = 4 * _cam.scale;
        const grad = _ctx.createLinearGradient(p.x - w, p.y - h, p.x + w, p.y + h);
        grad.addColorStop(0, adjustColor(color, -20));
        grad.addColorStop(0.5, color);
        grad.addColorStop(1, adjustColor(color, -20));
        _ctx.fillStyle = grad;
        _ctx.fillRect(p.x - w, p.y - h, w * 2, h * 2);
        _ctx.strokeStyle = '#ffffff';
        _ctx.lineWidth = 1.2;
        _ctx.strokeRect(p.x - w, p.y - h, w * 2, h * 2);
        _ctx.shadowBlur = 0;

        const projCenter = project({ x: eq.posX, y: eq.posY + h * 0.5, z: eq.posZ });
        drawEquipmentTag(projCenter, eq.tag, 'Y');
        drawPuertos(eq);
    }

    function drawPuertos(obj) {
        if (!obj.puertos) return;
        
        const posBase = obj.posX !== undefined ? { x: obj.posX, y: obj.posY, z: obj.posZ }
            : (obj._cachedPoints && obj._cachedPoints.length > 0 ? obj._cachedPoints[0] : { x: 0, y: 0, z: 0 });
        
        obj.puertos.forEach(port => {
            const pos = { 
                x: posBase.x + (port.relX || 0), 
                y: posBase.y + (port.relY || 0), 
                z: posBase.z + (port.relZ || 0) 
            };
            const proj = project(pos);
            
            if (port.orientacion) {
                const dir = port.orientacion;
                const endPos = { x: pos.x + dir.dx * 200, y: pos.y + dir.dy * 200, z: pos.z + dir.dz * 200 };
                const projEnd = project(endPos);
                _ctx.beginPath();
                _ctx.moveTo(proj.x, proj.y);
                _ctx.lineTo(projEnd.x, projEnd.y);
                _ctx.strokeStyle = '#ffaa00';
                _ctx.lineWidth = 1.5;
                _ctx.stroke();
                
                const angle = Math.atan2(projEnd.y - proj.y, projEnd.x - proj.x);
                const arrowSize = 6;
                _ctx.beginPath();
                _ctx.moveTo(projEnd.x, projEnd.y);
                _ctx.lineTo(projEnd.x - arrowSize * Math.cos(angle - 0.4), projEnd.y - arrowSize * Math.sin(angle - 0.4));
                _ctx.lineTo(projEnd.x - arrowSize * Math.cos(angle + 0.4), projEnd.y - arrowSize * Math.sin(angle + 0.4));
                _ctx.closePath();
                _ctx.fillStyle = '#ffaa00';
                _ctx.fill();
            }
            
            _ctx.beginPath();
            _ctx.arc(proj.x, proj.y, 5 * _cam.scale + 2, 0, 2 * Math.PI);
            _ctx.fillStyle = port.connectedLine ? '#4ade80' : '#f59e0b';
            _ctx.fill();
            _ctx.strokeStyle = '#ffffff';
            _ctx.lineWidth = 1;
            _ctx.stroke();
            
            if (port.id && _cam.scale > 0.3) {
                const label = port.id + ' ' + (port.diametro || obj.diameter || 3) + '"';
                _ctx.font = 'bold ' + Math.max(8, 9 * _cam.scale) + 'px monospace';
                _ctx.fillStyle = '#ffffff';
                _ctx.fillText(label, proj.x + 10, proj.y - 6);
            }
        });
    }

    // ================================================================
    // DIBUJO DE TUBERÍAS
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
                    pts[0] = { 
                        x: posBase.x + (puerto.relX || 0), 
                        y: posBase.y + (puerto.relY || 0), 
                        z: posBase.z + (puerto.relZ || 0) 
                    };
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
                    pts[pts.length - 1] = { 
                        x: posBase.x + (puerto.relX || 0), 
                        y: posBase.y + (puerto.relY || 0), 
                        z: posBase.z + (puerto.relZ || 0) 
                    };
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
        const baseWidth = (line.diameter || 4) * _cam.scale * scheduleFactor;
        const mainWidth = Math.max(5, baseWidth);
        const matShort = getShortMaterial(line.material);
        
        const drawPath = function() {
            _ctx.beginPath();
            let first = project(pts[0]);
            _ctx.moveTo(first.x, first.y);
            for (let i = 1; i < pts.length; i++) {
                const p = project(pts[i]);
                _ctx.lineTo(p.x, p.y);
            }
        };

        const grad = getMaterialGradient(_ctx, pts[0], pts[pts.length - 1], matShort);

        _ctx.save();
        drawPath();
        _ctx.shadowColor = '#00000066';
        _ctx.shadowBlur = 12 * _cam.scale;
        _ctx.shadowOffsetX = 0;
        _ctx.shadowOffsetY = 6 * _cam.scale;
        _ctx.strokeStyle = '#00000044';
        _ctx.lineWidth = mainWidth + 8;
        _ctx.stroke();
        _ctx.restore();

        drawPath();
        _ctx.strokeStyle = '#0a0e17';
        _ctx.lineWidth = mainWidth + 4;
        _ctx.stroke();
        
        drawPath();
        _ctx.strokeStyle = '#1e293b';
        _ctx.lineWidth = mainWidth + 2;
        _ctx.stroke();
        
        drawPath();
        _ctx.strokeStyle = grad;
        _ctx.lineWidth = mainWidth;
        _ctx.stroke();
        
        drawPath();
        _ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        _ctx.lineWidth = mainWidth * 0.4;
        _ctx.stroke();
        
        drawPath();
        _ctx.strokeStyle = '#ffffff';
        _ctx.lineWidth = Math.max(1, mainWidth * 0.1);
        _ctx.globalAlpha = 0.85;
        _ctx.stroke();
        _ctx.globalAlpha = 1;

        // Soldaduras para tuberías metálicas
        if (!isPPR && _cam.scale > 0.15) {
            let accumDist = 0;
            for (let i = 0; i < pts.length - 1; i++) {
                const segLen = Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y, pts[i+1].z - pts[i].z);
                while (accumDist + segLen > 6000) {
                    const t = (6000 - accumDist) / segLen;
                    if (t > 0.05 && t < 0.95) {
                        const weldPos = {
                            x: pts[i].x + (pts[i+1].x - pts[i].x) * t,
                            y: pts[i].y + (pts[i+1].y - pts[i].y) * t,
                            z: pts[i].z + (pts[i+1].z - pts[i].z) * t
                        };
                        const projWeld = project(weldPos);
                        _ctx.fillStyle = '#fbbf24';
                        _ctx.beginPath();
                        _ctx.arc(projWeld.x, projWeld.y, mainWidth * 0.6, 0, Math.PI * 2);
                        _ctx.fill();
                        _ctx.fillStyle = '#ffffff';
                        _ctx.font = Math.max(6, mainWidth * 0.4) + 'px monospace';
                        _ctx.textAlign = 'center';
                        _ctx.fillText('W', projWeld.x, projWeld.y + 3);
                    }
                    accumDist -= 6000;
                }
                accumDist += segLen;
            }
        }

        // Dimensiones
        if (line.showDimensions !== false && _cam.scale > 0.15) {
            for (let i = 0; i < pts.length - 1; i++) {
                const dist = Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y, pts[i+1].z - pts[i].z);
                if (dist > 200) {
                    drawIsometricDimension(pts[i], pts[i+1]);
                }
            }
        }

        // Etiqueta de línea
        if (line.tag && pts.length >= 2 && _cam.scale > 0.15) {
            const midIdx = Math.floor(pts.length / 2);
            const midProj = project(pts[midIdx]);
            const label = line.tag + ' ' + line.diameter + '" ' + matShort;
            _ctx.font = 'bold ' + Math.max(9, 11 * _cam.scale) + 'px monospace';
            _ctx.fillStyle = '#00f2ff';
            _ctx.shadowBlur = 0;
            _ctx.fillText(label, midProj.x + 8, midProj.y - 8);
        }
        
        drawPuertos(line);
    }

    // ================================================================
    // SÍMBOLOS DE COMPONENTES (VÁLVULAS, INSTRUMENTOS, ETC.)
    // ================================================================
    function drawPipeComponents(line) {
        if (!_core) return;
        const pts = _core.getLinePoints(line);
        if (!pts || pts.length < 2 || !line.components) return;
        
        let lengths = [], totalLen = 0;
        for (let i = 0; i < pts.length - 1; i++) {
            let d = Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y, pts[i+1].z - pts[i].z);
            lengths.push(d);
            totalLen += d;
        }
        if (totalLen === 0) return;
        
        line.components.forEach(comp => {
            let targetLen = totalLen * Math.min(1, Math.max(0, comp.param || 0.5));
            let currentAccum = 0, p1, p2, t = 0;
            
            for (let i = 0; i < lengths.length; i++) {
                if (currentAccum + lengths[i] >= targetLen || i === lengths.length - 1) {
                    p1 = pts[i];
                    p2 = pts[i + 1];
                    let segLen = lengths[i];
                    t = segLen > 0 ? (targetLen - currentAccum) / segLen : 0;
                    t = Math.min(1, Math.max(0, t));
                    break;
                }
                currentAccum += lengths[i];
            }
            
            if (!p1 || !p2) return;
            
            const pos3D = {
                x: p1.x + (p2.x - p1.x) * t,
                y: p1.y + (p2.y - p1.y) * t,
                z: p1.z + (p2.z - p1.z) * t
            };
            const proj = project(pos3D);
            const dir3D = getSegmentDirection3D(p1, p2);
            
            drawSymbol(proj.x, proj.y, dir3D, comp);
            
            if (_cam.scale > 0.2) {
                const lbl = getComponentLabel(comp.type);
                _ctx.font = Math.max(7, 8 * _cam.scale) + 'px monospace';
                _ctx.fillStyle = '#ffffff';
                _ctx.shadowBlur = 0;
                _ctx.fillText(lbl, proj.x + 8, proj.y - 4);
            }
        });
    }

    function drawSymbol(x, y, dir3D, comp) {
        _ctx.save();
        const s = Math.max(10, 16 * _cam.scale);
        _ctx.lineWidth = 1.5;
        _ctx.strokeStyle = '#e2e8f0';
        _ctx.fillStyle = '#0f172a';
        
        if (dir3D === 'X') {
            _ctx.setTransform(1, 0.4, 0, 1, x, y);
        } else if (dir3D === 'Z') {
            _ctx.setTransform(1, -0.4, 0, 1, x, y);
        } else if (dir3D === 'Y') {
            _ctx.setTransform(0, 1, -0.8, 0, x, y);
        }
        
        const tipo = (comp.type || '').toUpperCase();

        // Válvula de mariposa
        if (tipo.includes('BUTTERFLY_VALVE')) {
            _ctx.beginPath();
            _ctx.ellipse(0, 0, s * 0.9, s * 0.35, 0, 0, Math.PI * 2);
            _ctx.fill();
            _ctx.stroke();
            _ctx.beginPath();
            _ctx.moveTo(0, -s * 0.4);
            _ctx.lineTo(0, -s * 1.6);
            _ctx.strokeStyle = '#ef4444';
            _ctx.lineWidth = 2;
            _ctx.stroke();
            _ctx.beginPath();
            _ctx.moveTo(-s * 0.7, -s * 1.6);
            _ctx.lineTo(s * 0.7, -s * 1.6);
            _ctx.stroke();
            _ctx.fillStyle = '#fbbf24';
            _ctx.beginPath();
            _ctx.arc(0, -s * 1.6, s * 0.2, 0, Math.PI * 2);
            _ctx.fill();
        }
        // Válvula de bola
        else if (tipo.includes('BALL_VALVE')) {
            const ballGrad = _ctx.createRadialGradient(-s * 0.1, -s * 0.1, s * 0.05, 0, 0, s * 0.65);
            ballGrad.addColorStop(0, '#ffffff');
            ballGrad.addColorStop(0.5, '#94a3b8');
            ballGrad.addColorStop(1, '#334155');
            _ctx.beginPath();
            _ctx.arc(0, 0, s * 0.65, 0, Math.PI * 2);
            _ctx.fillStyle = ballGrad;
            _ctx.fill();
            _ctx.stroke();
            _ctx.beginPath();
            _ctx.moveTo(-s * 0.8, -s * 0.45);
            _ctx.lineTo(-s * 0.8, s * 0.45);
            _ctx.lineTo(0, 0);
            _ctx.closePath();
            _ctx.moveTo(s * 0.8, -s * 0.45);
            _ctx.lineTo(s * 0.8, s * 0.45);
            _ctx.lineTo(0, 0);
            _ctx.closePath();
            _ctx.fillStyle = '#0f172a';
            _ctx.fill();
            _ctx.stroke();
            _ctx.beginPath();
            _ctx.moveTo(0, -s * 0.3);
            _ctx.lineTo(0, -s * 1.2);
            _ctx.lineTo(s * 0.6, -s * 1.2);
            _ctx.strokeStyle = '#f8fafc';
            _ctx.lineWidth = 1.8;
            _ctx.stroke();
        }
        // Válvula de compuerta
        else if (tipo.includes('GATE_VALVE')) {
            _ctx.beginPath();
            _ctx.moveTo(-s, -s * 0.6);
            _ctx.lineTo(s, s * 0.6);
            _ctx.lineTo(s, -s * 0.6);
            _ctx.lineTo(-s, s * 0.6);
            _ctx.closePath();
            _ctx.fillStyle = '#1e293b';
            _ctx.fill();
            _ctx.stroke();
            _ctx.beginPath();
            _ctx.moveTo(0, 0);
            _ctx.lineTo(0, -s * 1.4);
            _ctx.moveTo(-s * 0.5, -s * 1.4);
            _ctx.lineTo(s * 0.5, -s * 1.4);
            _ctx.stroke();
            _ctx.fillStyle = '#fbbf24';
            _ctx.beginPath();
            _ctx.arc(0, -s * 1.4, s * 0.22, 0, Math.PI * 2);
            _ctx.fill();
        }
        // Válvula de globo
        else if (tipo.includes('GLOBE_VALVE')) {
            _ctx.beginPath();
            _ctx.ellipse(0, 0, s * 0.85, s * 0.55, 0, 0, Math.PI * 2);
            _ctx.fillStyle = '#1e293b';
            _ctx.fill();
            _ctx.stroke();
            _ctx.beginPath();
            _ctx.moveTo(0, -s * 0.55);
            _ctx.lineTo(0, s * 0.55);
            _ctx.stroke();
            _ctx.fillStyle = '#334155';
            _ctx.fillRect(-s * 0.3, -s * 1.1, s * 0.6, s * 0.5);
            _ctx.strokeRect(-s * 0.3, -s * 1.1, s * 0.6, s * 0.5);
        }
        // Válvula check
        else if (tipo.includes('CHECK_VALVE')) {
            _ctx.strokeRect(-s, -s * 0.45, s * 2, s * 0.9);
            _ctx.fillStyle = '#4ade80';
            _ctx.beginPath();
            _ctx.moveTo(-s * 0.5, 0);
            _ctx.lineTo(s * 0.35, -s * 0.35);
            _ctx.lineTo(s * 0.35, s * 0.35);
            _ctx.closePath();
            _ctx.fill();
            _ctx.stroke();
            _ctx.setLineDash([2, 3]);
            _ctx.beginPath();
            _ctx.moveTo(-s, 0);
            _ctx.lineTo(-s * 0.5, 0);
            _ctx.stroke();
            _ctx.setLineDash([]);
        }
        // Reductor
        else if (tipo.includes('REDUCER') || tipo.includes('REDUCING')) {
            const reducGrad = _ctx.createLinearGradient(-s, 0, s, 0);
            reducGrad.addColorStop(0, '#475569');
            reducGrad.addColorStop(1, '#94a3b8');
            _ctx.beginPath();
            _ctx.moveTo(-s, -s * 0.5);
            _ctx.lineTo(s, -s * 0.8);
            _ctx.lineTo(s, s * 0.8);
            _ctx.lineTo(-s, s * 0.5);
            _ctx.closePath();
            _ctx.fillStyle = reducGrad;
            _ctx.fill();
            _ctx.stroke();
            if (tipo.includes('ECCENTRIC')) {
                _ctx.beginPath();
                _ctx.moveTo(-s, -s * 0.5);
                _ctx.lineTo(-s, s * 0.5);
                _ctx.strokeStyle = '#facc15';
                _ctx.lineWidth = 1.5;
                _ctx.stroke();
            }
        }
        // Tee
        else if (tipo.includes('TEE')) {
            _ctx.beginPath();
            _ctx.moveTo(-s * 0.9, 0);
            _ctx.lineTo(s * 0.9, 0);
            _ctx.moveTo(0, 0);
            _ctx.lineTo(0, -s * 1.3);
            _ctx.strokeStyle = '#f8fafc';
            _ctx.lineWidth = 2.5;
            _ctx.stroke();
            _ctx.fillStyle = '#fbbf24';
            _ctx.beginPath();
            _ctx.arc(0, 0, s * 0.3, 0, Math.PI * 2);
            _ctx.fill();
            _ctx.stroke();
            if (tipo.includes('REDUCING')) {
                _ctx.fillStyle = '#facc15';
                _ctx.beginPath();
                _ctx.arc(0, -s * 1.3, s * 0.25, 0, Math.PI * 2);
                _ctx.fill();
            }
        }
        // Codo 45
        else if (tipo.includes('ELBOW_45')) {
            _ctx.beginPath();
            _ctx.arc(0, 0, s, 0, Math.PI / 4);
            _ctx.strokeStyle = '#f8fafc';
            _ctx.lineWidth = 2.5;
            _ctx.stroke();
            _ctx.fillStyle = '#ffffff';
            _ctx.beginPath();
            _ctx.arc(0, 0, s * 0.18, 0, Math.PI * 2);
            _ctx.fill();
        }
        // Codo 90
        else if (tipo.includes('ELBOW_90')) {
            const r = s * 1.2;
            _ctx.beginPath();
            _ctx.arc(0, 0, r, 0, Math.PI / 2);
            _ctx.strokeStyle = '#f8fafc';
            _ctx.lineWidth = 2.5;
            _ctx.stroke();
            _ctx.fillStyle = '#ffffff';
            _ctx.beginPath();
            _ctx.arc(0, 0, s * 0.18, 0, Math.PI * 2);
            _ctx.fill();
        }
        // Tapón
        else if (tipo.includes('CAP')) {
            _ctx.beginPath();
            _ctx.arc(0, 0, s * 0.7, 0, Math.PI, true);
            _ctx.closePath();
            _ctx.fill();
            _ctx.stroke();
            _ctx.beginPath();
            _ctx.moveTo(-s * 0.7, 0);
            _ctx.lineTo(-s * 1.0, 0);
            _ctx.moveTo(s * 0.7, 0);
            _ctx.lineTo(s * 1.0, 0);
            _ctx.stroke();
        }
        // Unión universal
        else if (tipo.includes('UNION')) {
            _ctx.fillRect(-s * 0.7, -s * 0.7, s * 1.4, s * 1.4);
            _ctx.strokeRect(-s * 0.7, -s * 0.7, s * 1.4, s * 1.4);
            for (let i = -0.4; i <= 0.4; i += 0.3) {
                _ctx.beginPath();
                _ctx.moveTo(-s * 0.7, i * s);
                _ctx.lineTo(s * 0.7, i * s);
                _ctx.strokeStyle = '#334155';
                _ctx.stroke();
            }
        }
        // Brida
        else if (tipo.includes('FLANGE')) {
            _ctx.fillRect(-s * 0.35, -s * 0.9, s * 0.7, s * 1.8);
            _ctx.strokeRect(-s * 0.35, -s * 0.9, s * 0.7, s * 1.8);
            for (let py = -0.6; py <= 0.6; py += 0.4) {
                _ctx.beginPath();
                _ctx.arc(-s * 0.55, py * s, s * 0.08, 0, Math.PI * 2);
                _ctx.fillStyle = '#64748b';
                _ctx.fill();
                _ctx.beginPath();
                _ctx.arc(s * 0.55, py * s, s * 0.08, 0, Math.PI * 2);
                _ctx.fill();
            }
        }
        // Instrumento
        else if (tipo.includes('GAUGE') || tipo.includes('METER') || tipo.includes('INSTRUMENT')) {
            _ctx.beginPath();
            _ctx.arc(0, 0, s * 0.7, 0, Math.PI * 2);
            _ctx.fillStyle = '#f8fafc';
            _ctx.fill();
            _ctx.stroke();
            _ctx.fillStyle = '#0ea5e9';
            _ctx.font = 'bold ' + Math.max(8, s * 0.5) + 'px monospace';
            _ctx.textAlign = 'center';
            _ctx.textBaseline = 'middle';
            let label = '?';
            if (tipo.includes('PRESSURE')) label = 'PG';
            else if (tipo.includes('TEMPERATURE')) label = 'TG';
            else if (tipo.includes('FLOW')) label = 'FM';
            else if (tipo.includes('LEVEL')) label = 'LS';
            _ctx.fillText(label, 0, 0);
        }
        // Soporte / Accesorio
        else if (tipo.includes('SHOE') || tipo.includes('U_BOLT') || tipo.includes('GUIDE') || 
                 tipo.includes('ANCHOR') || tipo.includes('HANGER') || tipo.includes('CLAMP')) {
            _ctx.strokeStyle = '#64748b';
            _ctx.lineWidth = 1.2;
            _ctx.setLineDash([3, 3]);
            _ctx.beginPath();
            _ctx.moveTo(-s * 0.9, 0);
            _ctx.lineTo(s * 0.9, 0);
            if (tipo.includes('ANCHOR')) {
                _ctx.moveTo(-s * 0.6, -s * 0.5);
                _ctx.lineTo(-s * 0.6, s * 0.5);
                _ctx.moveTo(s * 0.6, -s * 0.5);
                _ctx.lineTo(s * 0.6, s * 0.5);
            }
            _ctx.stroke();
            _ctx.setLineDash([]);
        }
        // Genérico
        else {
            _ctx.fillRect(-s * 0.8, -s * 0.8, s * 1.6, s * 1.6);
            _ctx.strokeRect(-s * 0.8, -s * 0.8, s * 1.6, s * 1.6);
            const lbl = getComponentLabel(comp.type);
            _ctx.fillStyle = '#ffffff';
            _ctx.font = 'bold ' + Math.max(7, s * 0.65) + 'px Inter';
            _ctx.textAlign = 'center';
            _ctx.textBaseline = 'middle';
            _ctx.fillText(lbl, 0, 0);
        }
        
        _ctx.restore();
        _ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    // ================================================================
    // SELECCIÓN Y PICKING
    // ================================================================
    function pointToSegmentDistance(p, a, b) {
        const ax = p.x - a.x, ay = p.y - a.y;
        const bx = b.x - a.x, by = b.y - a.y;
        const dot = ax * bx + ay * by;
        const len2 = bx * bx + by * by;
        if (len2 === 0) return Math.hypot(ax, ay);
        let t = Math.max(0, Math.min(1, dot / len2));
        const projX = a.x + t * bx;
        const projY = a.y + t * by;
        return Math.hypot(p.x - projX, p.y - projY);
    }

    function isPointInBox(p, eq) {
        const box = getEquipmentDrawBox(eq);
        return Math.abs(p.x - eq.posX) <= box.halfWidth &&
               Math.abs(p.y - eq.posY) <= box.halfHeight &&
               Math.abs(p.z - eq.posZ) <= box.halfDepth;
    }

    function pickElement(mouseCanvas) {
        if (!_core) return null;
        const db = _core.getDb();
        const equipos = db ? db.equipos : [];
        const lines = db ? db.lines : [];
        const worldClick = inverseProject(mouseCanvas.x, mouseCanvas.y);
        
        for (let i = equipos.length - 1; i >= 0; i--) {
            const eq = equipos[i];
            if (isPointInBox(worldClick, eq)) {
                return { type: 'equipment', obj: eq };
            }
        }
        
        for (const line of lines) {
            const pts = _core.getLinePoints(line);
            if (!pts || pts.length < 2) continue;
            for (let i = 0; i < pts.length - 1; i++) {
                const proj1 = project(pts[i]);
                const proj2 = project(pts[i + 1]);
                if (pointToSegmentDistance(mouseCanvas, proj1, proj2) < 10) {
                    return { type: 'line', obj: line };
                }
            }
        }
        return null;
    }

    function pickPort(mouseX, mouseY) {
        if (!_core) return null;
        const db = _core.getDb();
        const allItems = [...(db.equipos || []), ...(db.lines || [])];
        
        for (const item of allItems) {
            if (!item.puertos) continue;
            const posBase = item.posX !== undefined ? { x: item.posX, y: item.posY, z: item.posZ }
                : (item._cachedPoints && item._cachedPoints[0] ? item._cachedPoints[0] : { x: 0, y: 0, z: 0 });
            
            for (const port of item.puertos) {
                const worldPos = {
                    x: posBase.x + (port.relX || 0),
                    y: posBase.y + (port.relY || 0),
                    z: posBase.z + (port.relZ || 0)
                };
                const screenPos = project(worldPos);
                if (Math.hypot(screenPos.x - mouseX, screenPos.y - mouseY) < SNAP_THRESHOLD) {
                    return { item, port, screenPos };
                }
            }
        }
        return null;
    }

    function pickComponent(mouseX, mouseY) {
        if (!_core) return null;
        const db = _core.getDb();
        let closest = null, closestDist = 20;
        for (const line of (db ? db.lines : [])) {
            if (!line.components) continue;
            for (const comp of line.components) {
                if (!comp._screenPos) continue;
                const dist = Math.hypot(comp._screenPos.x - mouseX, comp._screenPos.y - mouseY);
                if (dist < closestDist) {
                    closestDist = dist;
                    closest = comp;
                }
            }
        }
        return closest;
    }

    function drawSelection(element) {
        if (!element) return;
        _ctx.save();
        _ctx.strokeStyle = '#facc15';
        _ctx.lineWidth = 3;
        _ctx.shadowColor = '#facc15';
        _ctx.shadowBlur = 8;
        
        if (element.type === 'equipment') {
            const eq = element.obj;
            const p = project({ x: eq.posX, y: eq.posY, z: eq.posZ });
            const box = getEquipmentDrawBox(eq);
            const w = box.halfWidth * _cam.scale + 5;
            const h = box.halfHeight * _cam.scale + 5;
            _ctx.strokeRect(p.x - w, p.y - h, w * 2, h * 2);
        } else if (element.type === 'line') {
            const pts = _core.getLinePoints(element.obj);
            if (pts && pts.length >= 2) {
                _ctx.beginPath();
                pts.forEach((p, i) => {
                    const pr = project(p);
                    if (i === 0) _ctx.moveTo(pr.x, pr.y);
                    else _ctx.lineTo(pr.x, pr.y);
                });
                _ctx.stroke();
            }
        }
        
        _ctx.restore();
    }

    function drawTechnicalTooltip(ctx, comp, screenPos) {
        const compType = comp.type || '';
        const desc = getComponentLabel(compType);
        const material = comp.material || 'N/D';
        const boxW = 180, boxH = 55;
        const x = Math.min(screenPos.x + 25, _canvas.width - boxW - 10);
        const y = Math.max(screenPos.y - 60, 10);
        
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 1.5;
        ctx.fillRect(x, y, boxW, boxH);
        ctx.strokeRect(x, y, boxW, boxH);
        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 10px Inter';
        ctx.fillText(desc, x + 8, y + 16);
        ctx.fillStyle = '#e2e8f0';
        ctx.font = '9px Inter';
        ctx.fillText('Tag: ' + (comp.tag || 'N/A'), x + 8, y + 32);
        ctx.fillText('Mat: ' + material, x + 8, y + 46);
        ctx.restore();
    }

    // ================================================================
    // autoCenter - VERSIÓN CORREGIDA (calcula bounding box real)
    // ================================================================
    function autoCenter(options = {}) {
        if (!_canvas || !_core) return;
        
        const db = _core.getDb();
        const equipos = db?.equipos || [];
        const lines = db?.lines || [];
        
        if (equipos.length === 0 && lines.length === 0) {
            _cam = { scale: 0.5, panX: 0, panY: 0 };
            scheduleRender();
            return;
        }
        
        // Recolectar TODOS los puntos 3D
        let points = [];
        
        // 1. Puntos de equipos
        equipos.forEach(eq => {
            // Centro del equipo
            points.push({ x: eq.posX, y: eq.posY, z: eq.posZ });
            
            // Extremos según el tipo de equipo
            if (eq.tipo === 'tanque_v' || eq.tipo === 'torre' || eq.tipo === 'reactor') {
                const r = (eq.diametro || 1000) / 2;
                const h = (eq.altura || 1500) / 2;
                points.push({ x: eq.posX + r, y: eq.posY + h, z: eq.posZ });
                points.push({ x: eq.posX - r, y: eq.posY - h, z: eq.posZ });
                points.push({ x: eq.posX, y: eq.posY + h, z: eq.posZ + r });
                points.push({ x: eq.posX, y: eq.posY - h, z: eq.posZ - r });
            } else if (eq.tipo === 'tanque_h') {
                const r = (eq.diametro || 1000) / 2;
                const l = (eq.largo || 3000) / 2;
                points.push({ x: eq.posX + l, y: eq.posY, z: eq.posZ });
                points.push({ x: eq.posX - l, y: eq.posY, z: eq.posZ });
                points.push({ x: eq.posX, y: eq.posY + r, z: eq.posZ });
                points.push({ x: eq.posX, y: eq.posY - r, z: eq.posZ });
            } else if (eq.tipo === 'plataforma') {
                const l = (eq.largo || 6000) / 2;
                const a = (eq.ancho || 3000) / 2;
                const h = (eq.altura || 400) / 2;
                points.push({ x: eq.posX + l, y: eq.posY, z: eq.posZ });
                points.push({ x: eq.posX - l, y: eq.posY, z: eq.posZ });
                points.push({ x: eq.posX, y: eq.posY + h, z: eq.posZ + a });
                points.push({ x: eq.posX, y: eq.posY - h, z: eq.posZ - a });
            } else {
                // Equipo genérico
                const w = (eq.largo || eq.diametro || 1000) / 2;
                const h = (eq.altura || 1000) / 2;
                const d = (eq.ancho || eq.diametro || 1000) / 2;
                points.push({ x: eq.posX + w, y: eq.posY + h, z: eq.posZ + d });
                points.push({ x: eq.posX - w, y: eq.posY - h, z: eq.posZ - d });
            }
        });
        
        // 2. Puntos de líneas (tuberías)
        lines.forEach(line => {
            const pts = _core.getLinePoints(line);
            if (pts && pts.length > 0) {
                pts.forEach(p => points.push({ x: p.x, y: p.y, z: p.z }));
            }
        });
        
        if (points.length === 0) {
            points = [{ x: -2000, y: 0, z: -2000 }, { x: 2000, y: 2000, z: 2000 }];
        }
        
        // Calcular bounding box en coordenadas de pantalla
        let minX = Infinity, maxX = -Infinity;
        let minY = Infinity, maxY = -Infinity;
        
        points.forEach(p => {
            const proj = project(p);
            if (proj.x < minX) minX = proj.x;
            if (proj.x > maxX) maxX = proj.x;
            if (proj.y < minY) minY = proj.y;
            if (proj.y > maxY) maxY = proj.y;
        });
        
        // Margen proporcional (15%)
        const margin = (maxX - minX) * 0.15;
        const marginY = (maxY - minY) * 0.15;
        minX -= margin;
        maxX += margin;
        minY -= marginY;
        maxY += marginY;
        
        const worldW = maxX - minX;
        const worldH = maxY - minY;
        
        // Parámetros configurables
        const isMobile = /Mobi|Android/i.test(navigator.userAgent) || _canvas.width < 600;
        const padding = options.padding !== undefined ? options.padding : (isMobile ? 20 : 80);
        const minScale = options.minScale !== undefined ? options.minScale : (isMobile ? 0.08 : 0.15);
        const maxScale = options.maxScale !== undefined ? options.maxScale : (isMobile ? 0.9 : 1.5);
        
        // Calcular escala óptima
        let sc = Math.min(
            (_canvas.width - padding * 2) / worldW,
            (_canvas.height - padding * 2) / worldH,
            maxScale
        );
        sc = Math.max(minScale, isFinite(sc) ? sc : 0.3);
        
        // Calcular pan para centrar
        _cam.scale = sc;
        _cam.panX = (_canvas.width / 2) - ((minX + maxX) / 2);
        _cam.panY = (_canvas.height / 2) - ((minY + maxY) / 2);
        
        _cacheDirty = true;
        scheduleRender();
        
        console.log(`autoCenter: escala=${sc.toFixed(3)}, panX=${_cam.panX.toFixed(0)}, panY=${_cam.panY.toFixed(0)}`);
    }

    // ================================================================
    // CONTROL DE CÁMARA (ZOOM, PAN, RESIZE)
    // ================================================================
    function pan(dx, dy) {
        _cam.panX += dx;
        _cam.panY += dy;
        _cacheDirty = true;
        scheduleRender();
    }

    function zoom(delta, mouseX, mouseY) {
        const zoomFactor = delta > 0 ? 1.1 : 0.9;
        const newScale = _cam.scale * zoomFactor;
        const clampedScale = Math.min(Math.max(0.05, newScale), 1.8);
        
        if (mouseX !== undefined && mouseY !== undefined && clampedScale !== _cam.scale) {
            _cam.panX = mouseX - (mouseX - _cam.panX) * (clampedScale / _cam.scale);
            _cam.panY = mouseY - (mouseY - _cam.panY) * (clampedScale / _cam.scale);
        }
        
        _cam.scale = clampedScale;
        _cacheDirty = true;
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
        autoCenter();
    }

    function setElevation(level) {
        _currentElevation = level;
        scheduleRender();
    }

    // ================================================================
    // EXPORTACIONES (PDF, PCF)
    // ================================================================
    function exportPDF() {
        if (!_canvas) return;
        if (typeof window.jspdf === 'undefined') {
            _notifyUI("Error: jsPDF no disponible.", true);
            return;
        }
        
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'landscape' });
        const imgData = _canvas.toDataURL('image/png');
        doc.addImage(imgData, 'PNG', 10, 10, 277, 150);
        doc.setFontSize(16);
        doc.text("SmartFlow - Reporte Isométrico", 10, 175);
        doc.setFontSize(10);
        doc.text('Proyecto: ' + (window.currentProjectName || 'N/D') + ' | Fecha: ' + new Date().toLocaleString(), 10, 185);
        doc.save((window.currentProjectName || 'Proyecto') + '_Isometrico_' + Date.now() + '.pdf');
        _notifyUI("PDF generado correctamente.", false);
    }

    function exportPCF() {
        if (!_core) {
            _notifyUI("Error: Core no inicializado.", true);
            return;
        }
        
        const db = _core.getDb();
        const lines = db?.lines || [];
        
        if (lines.length === 0) {
            _notifyUI("No hay líneas para exportar.", true);
            return;
        }
        
        let pcfContent = "";
        
        lines.forEach(line => {
            const pts = _core.getLinePoints(line);
            if (!pts || pts.length < 2) return;
            const diamMM = (line.diameter || 4) * 25.4;
            
            pcfContent += "PIPE\n";
            pcfContent += "    ITEM-CODE " + line.tag + "\n";
            pcfContent += "    PIPING-SPEC " + (line.spec || 'STD') + "\n";
            pcfContent += "    MATERIAL " + (line.material || 'N/D') + "\n";
            pcfContent += "    DIAMETER " + diamMM + "\n";
            
            for (let i = 0; i < pts.length - 1; i++) {
                pcfContent += "    END-POINT " + pts[i].x.toFixed(2) + " " + pts[i].y.toFixed(2) + " " + pts[i].z.toFixed(2) + 
                              " " + pts[i+1].x.toFixed(2) + " " + pts[i+1].y.toFixed(2) + " " + pts[i+1].z.toFixed(2) + "\n";
            }
            pcfContent += "\n";
        });
        
        const blob = new Blob([pcfContent], { type: 'text/plain' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        const projectName = window.currentProjectName || 'Proyecto';
        a.download = projectName + '_PCF_' + Date.now() + '.pcf';
        a.click();
        _notifyUI("Archivo PCF exportado correctamente.", false);
    }

    // ================================================================
    // BOM (Lista de Materiales)
    // ================================================================
    function updateBOM() {
        _bomItems = [];
        if (!_core) return;
        
        const lines = _core.getLines();
        lines.forEach(line => {
            if (line.components) {
                line.components.forEach(comp => {
                    _bomItems.push({
                        index: _bomItems.length + 1,
                        desc: getComponentLabel(comp.type),
                        mat: getShortMaterial(line.material),
                        comp: comp
                    });
                });
            }
        });
    }

    function drawBOMTable() {
        if (_bomItems.length === 0) return;
        const x = 15, rowHeight = 18, headerHeight = 24, tableWidth = 260;
        const tableHeight = headerHeight + (_bomItems.length * rowHeight) + 10;
        const y = _canvas.height - tableHeight - 15;
        
        _ctx.save();
        _ctx.setTransform(1, 0, 0, 1, 0, 0);
        _ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
        _ctx.fillRect(x, y, tableWidth, tableHeight);
        _ctx.strokeStyle = '#0ea5e9';
        _ctx.lineWidth = 1.5;
        _ctx.strokeRect(x, y, tableWidth, tableHeight);
        _ctx.fillStyle = '#0ea5e9';
        _ctx.font = 'bold 10px "Segoe UI"';
        _ctx.fillText("ITEM", x + 12, y + 16);
        _ctx.fillText("DESCRIPCIÓN", x + 50, y + 16);
        _ctx.fillText("MAT", x + 220, y + 16);
        _ctx.beginPath();
        _ctx.moveTo(x + 10, y + 22);
        _ctx.lineTo(x + tableWidth - 10, y + 22);
        _ctx.strokeStyle = 'rgba(14, 165, 233, 0.3)';
        _ctx.stroke();
        
        _bomItems.forEach((item, i) => {
            const rowY = y + headerHeight + (i * rowHeight) + 12;
            _ctx.fillStyle = 'rgba(14, 165, 233, 0.15)';
            _ctx.beginPath();
            _ctx.arc(x + 20, rowY - 3, 8, 0, Math.PI * 2);
            _ctx.fill();
            _ctx.fillStyle = '#f8fafc';
            _ctx.font = 'bold 9px "Roboto Mono"';
            _ctx.textAlign = 'center';
            _ctx.fillText(item.index.toString(), x + 20, rowY);
            _ctx.textAlign = 'left';
            _ctx.font = '9px monospace';
            _ctx.fillStyle = '#e2e8f0';
            _ctx.fillText(item.desc.length > 24 ? item.desc.substring(0, 21) + '...' : item.desc, x + 50, rowY);
            _ctx.fillStyle = '#94a3b8';
            _ctx.fillText(item.mat, x + 220, rowY);
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
        
        const bgGrad = _ctx.createRadialGradient(_canvas.width / 2, _canvas.height / 2, _canvas.width * 0.1, 
                                                   _canvas.width / 2, _canvas.height / 2, _canvas.width * 0.9);
        bgGrad.addColorStop(0, '#0f172a');
        bgGrad.addColorStop(1, '#020617');
        _ctx.fillStyle = bgGrad;
        _ctx.fillRect(0, 0, _canvas.width, _canvas.height);
        
        drawGrid(_currentElevation);
        drawOrigin();
        
        if (!_core) return;
        const db = _core.getDb();
        if (!db) return;
        
        if (_cacheDirty) {
            _renderQueueCache = [];
            
            (db.equipos || []).forEach(eq => {
                const depth = eq.posX + eq.posZ + (eq.posY * 0.1);
                const type = eq.tipo === 'plataforma' ? 'PLATFORM' : 'EQUIPMENT';
                _renderQueueCache.push({ type, depth, data: eq });
            });
            
            (db.lines || []).forEach(line => {
                const pts = _core.getLinePoints(line);
                if (pts && pts.length >= 2) {
                    const avgDepth = pts.reduce((acc, p) => acc + (p.x + p.z), 0) / pts.length;
                    _renderQueueCache.push({ type: 'LINE', depth: avgDepth, data: line });
                }
            });
            
            _renderQueueCache.sort((a, b) => {
                const order = { 'PLATFORM': 0, 'EQUIPMENT': 1, 'LINE': 2 };
                const orderDiff = (order[a.type] || 1) - (order[b.type] || 1);
                if (orderDiff !== 0) return orderDiff;
                return a.depth - b.depth;
            });
            
            updateBOM();
            _cacheDirty = false;
        }
        
        _renderQueueCache.forEach(item => {
            if (item.type === 'EQUIPMENT') {
                const eq = item.data;
                const tipo = eq.tipo || '';
                
                if (tipo === 'tanque_v' || tipo === 'torre' || tipo === 'reactor' || tipo === 'separador') {
                    drawTank(eq);
                } else if (tipo === 'tanque_h' || tipo === 'intercambiador') {
                    drawHorizontalTank(eq);
                } else if (tipo === 'bomba' || tipo === 'bomba_centrifuga') {
                    drawBomba(eq);
                } else if (tipo === 'plataforma') {
                    drawPlatform(eq);
                } else {
                    drawRectEquip(eq, '#475569');
                }
            } else if (item.type === 'LINE') {
                drawPipeWithElbows(item.data);
                drawPipeComponents(item.data);
            }
        });
        
        const selected = _core.getSelected();
        if (selected) drawSelection(selected);
        
        if (_activeSnap) {
            _ctx.save();
            _ctx.beginPath();
            _ctx.strokeStyle = '#10b981';
            _ctx.lineWidth = 2;
            _ctx.arc(_activeSnap.screenPos.x, _activeSnap.screenPos.y, 10, 0, Math.PI * 2);
            _ctx.stroke();
            _ctx.fillStyle = '#10b981';
            _ctx.font = 'bold 11px Arial';
            _ctx.fillText(_activeSnap.item.tag + ':' + _activeSnap.port.id, 
                          _activeSnap.screenPos.x + 15, _activeSnap.screenPos.y - 10);
            _ctx.restore();
        }
        
        if (_hoveredComponent && _hoveredComponentScreenPos) {
            drawTechnicalTooltip(_ctx, _hoveredComponent, _hoveredComponentScreenPos);
        }
        
        if (_bomItems.length > 0 && _cam.scale > 0.15) {
            drawBOMTable();
        }
    }

    function scheduleRender() {
        if (!_renderScheduled) {
            _renderScheduled = true;
            requestAnimationFrame(function() { render(); });
        }
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
        
        window.addEventListener('resize', function() { resizeCanvas(); });
        window.addEventListener('orientationchange', function() { setTimeout(resizeCanvas, 100); });
        
        if (_core && _core.on) {
            _core.on('modelChanged', function() {
                _cacheDirty = true;
                scheduleRender();
            });
        }
        
        // Eventos del mouse
        _canvas.addEventListener('mousemove', function(e) {
            const rect = _canvas.getBoundingClientRect();
            const mX = e.clientX - rect.left;
            const mY = e.clientY - rect.top;
            const snapped = pickPort(mX, mY);
            
            if (snapped) {
                _activeSnap = snapped;
                _canvas.style.cursor = 'crosshair';
                _hoveredComponent = null;
            } else {
                _activeSnap = null;
                const hovered = pickComponent(mX, mY);
                if (hovered) {
                    _hoveredComponent = hovered;
                    _hoveredComponentScreenPos = { x: mX, y: mY };
                    _canvas.style.cursor = 'pointer';
                } else {
                    _hoveredComponent = null;
                    _canvas.style.cursor = pickElement({ x: mX, y: mY }) ? 'pointer' : 'default';
                }
            }
            scheduleRender();
        });
        
        _canvas.addEventListener('click', function(e) {
            const rect = _canvas.getBoundingClientRect();
            const mX = e.clientX - rect.left;
            const mY = e.clientY - rect.top;
            const picked = pickElement({ x: mX, y: mY });
            
            if (picked) {
                _core.setSelected({ obj: picked.obj, type: picked.type });
            } else {
                _core.setSelected(null);
            }
            scheduleRender();
        });
        
        _canvas.addEventListener('wheel', function(e) {
            e.preventDefault();
            const rect = _canvas.getBoundingClientRect();
            const mX = e.clientX - rect.left;
            const mY = e.clientY - rect.top;
            zoom(e.deltaY < 0 ? 1 : -1, mX, mY);
        });
        
        // Eventos táctiles
        let lastTouchDist = 0;
        let lastPanPos = null;
        
        _canvas.addEventListener('touchstart', function(e) {
            if (e.touches.length === 1) {
                lastPanPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
                const rect = _canvas.getBoundingClientRect();
                const mX = e.touches[0].clientX - rect.left;
                const mY = e.touches[0].clientY - rect.top;
                const hovered = pickComponent(mX, mY);
                if (hovered) {
                    _hoveredComponent = hovered;
                    _hoveredComponentScreenPos = { x: mX, y: mY };
                }
            } else if (e.touches.length === 2) {
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                lastTouchDist = Math.hypot(dx, dy);
            }
        });
        
        _canvas.addEventListener('touchmove', function(e) {
            e.preventDefault();
            if (e.touches.length === 1 && lastPanPos) {
                const dx = e.touches[0].clientX - lastPanPos.x;
                const dy = e.touches[0].clientY - lastPanPos.y;
                pan(dx, dy);
                lastPanPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            } else if (e.touches.length === 2 && lastTouchDist) {
                const dx = e.touches[0].clientX - e.touches[1].clientX;
                const dy = e.touches[0].clientY - e.touches[1].clientY;
                const dist = Math.hypot(dx, dy);
                const delta = dist - lastTouchDist;
                const rect = _canvas.getBoundingClientRect();
                const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
                const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
                zoom(delta > 0 ? 1 : -1, midX, midY);
                lastTouchDist = dist;
            }
        });
        
        _canvas.addEventListener('touchend', function() {
            lastTouchDist = 0;
            lastPanPos = null;
        });
        
        // Inicializar con autoCenter
        autoCenter();
        scheduleRender();
        
        console.log('✔ SmartFlowRenderer v5.1 - Motor 2.5D Nivel 2 (autoCenter corregido)');
        return true;
    }

    // ================================================================
    // API PÚBLICA
    // ================================================================
    const api = {
        init: init,
        render: scheduleRender,
        autoCenter: autoCenter,
        pan: pan,
        zoom: zoom,
        project: project,
        inverseProject: inverseProject,
        setElevation: setElevation,
        resizeCanvas: resizeCanvas,
        exportPDF: exportPDF,
        exportPCF: exportPCF,
        getCam: function() { return _cam; },
        pickElement: pickElement,
        getActiveSnap: function() { return _activeSnap; },
        getCanvas: function() { return _canvas; },
        toDataURL: function(format, quality) { 
            return _canvas ? _canvas.toDataURL(format, quality) : null; 
        }
    };

    if (typeof window !== 'undefined') {
        window.SmartFlowRenderer = api;
    }
    
    return api;
})();
