// ============================================================
// SMARTFLOW COMMANDS v4.0 - Intérprete de Comandos Unificado
// Archivo: js/commands.js
// Compatible: SmartFlowCore v6.0+, SmartFlowPFD, SmartFlowDTI, SmartFlowIntegrity
// Novedades v4.0:
//   - Comandos PFD: create stream, info stream, list streams, balance masa
//   - Comandos DTI: create instrument, create loop, list instruments
//   - Comandos Integrity: validate all, project summary, autofix
//   - Comandos Export: export pcf, export mto, export json, export db
// ============================================================

const SmartFlowCommands = (function() {
    
    let _core = null;
    let _catalog = null;
    let _renderer = null;
    let _notifyUI = (msg, isErr) => console.log(msg);
    let _renderUI = () => {};
    let _voiceFn = null;

    // ================================================================
    //  DICCIONARIO DE INTENCIONES MULTILINGÜE
    // ================================================================
    const IntentDictionary = {
        'crear': 'create', 'nuevo': 'create', 'añadir': 'create', 'instalar': 'create', 'pon': 'create', 'crea': 'create',
        'create': 'create', 'add': 'create',
        'conectar': 'connect', 'unir': 'connect', 'enlazar': 'connect', 'link': 'connect', 'vincula': 'connect', 'junta': 'connect', 'une': 'connect',
        'connect': 'connect',
        'ruta': 'route', 'route': 'route',
        'eliminar': 'delete', 'borrar': 'delete', 'quitar': 'delete', 'suprimir': 'delete', 'quita': 'delete', 'elimina': 'delete', 'limpiar': 'delete',
        'delete': 'delete', 'remove': 'delete',
        'editar': 'edit', 'modificar': 'edit', 'cambiar': 'edit', 'ajustar': 'edit', 'cambia': 'edit',
        'edit': 'edit', 'update': 'edit', 'mover': 'move', 'move': 'move',
        'establecer': 'edit', 'diametro': 'edit',
        'listar': 'list', 'lista': 'list', 'list': 'list', 'inventory': 'list', 'showall': 'list',
        'auditar': 'audit', 'revisar': 'audit', 'verificar': 'audit', 'validar': 'audit', 'audita': 'audit', 'status': 'audit',
        'audit': 'audit', 'check': 'audit',
        'bom': 'bom', 'mto': 'bom', 'generar': 'bom', 'generate': 'bom',
        'ayuda': 'help', 'help': 'help', 'comandos': 'help', '?': 'help', 'h': 'help',
        'deshacer': 'undo', 'undo': 'undo',
        'rehacer': 'redo', 'redo': 'redo',
        'info': 'info', 'información': 'info', 'informacion': 'info', 'detalles': 'info', 'ver': 'info', 'describe': 'info',
        'tap': 'tap', 'derivar': 'tap',
        'split': 'split', 'dividir': 'split', 'romper': 'split',
        'punto': 'point', 'coordenadas': 'point', 'coordenada': 'point', 'posicion': 'point', 'ubicacion': 'point',
        'nodos': 'nodes', 'nodo': 'nodes', 'nodes': 'nodes',
        'rotar': 'rotate', 'girar': 'rotate', 'rotate': 'rotate',
        'duplicar': 'duplicate', 'copiar': 'duplicate', 'duplicate': 'duplicate', 'copy': 'duplicate',
        'alinear': 'align', 'align': 'align',
        'medir': 'measure', 'distancia': 'measure', 'measure': 'measure', 'distance': 'measure',
        'macro': 'macro', 'script': 'macro',
        'exportar': 'export', 'export': 'export',
        'importar': 'import', 'import': 'import',
        'vista': 'view', 'view': 'view', 'zoom': 'view', 'camara': 'view', 'cámara': 'view',
        'apoyar': 'place', 'posar': 'place', 'place': 'place', 'poner': 'place', 'colocar': 'place',
        'accesorios': 'accessories', 'accessories': 'accessories',
        'transicion': 'transition', 'transition': 'transition',
        'extender': 'extend', 'extend': 'extend',
        'optimizar': 'optimize', 'optimize': 'optimize',
        're-enrutar': 'reroute', 'reroute': 'reroute', 'recalcular': 'reroute',
        'proyecto': 'project', 'project': 'project',
        'validar': 'validate', 'validate': 'validate',
        'resumen': 'summary', 'summary': 'summary',
        'balance': 'balance', 'balance': 'balance'
    };

    function getIntent(word) {
        if (!word) return null;
        return IntentDictionary[word.toLowerCase()] || null;
    }

    function normalizeCommand(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts.length === 0) return cmd;
        if (parts.length >= 2 && parts[0].toLowerCase() === 'set' && parts[1].toLowerCase() === 'project') return cmd;
        const intent = getIntent(parts[0]);
        if (intent) { parts[0] = intent; return parts.join(' '); }
        return cmd;
    }

    // ================================================================
    //  DEFAULTS DEL PROYECTO
    // ================================================================
    let _projectDefaults = { material: 'PPR', spec: 'PPR_PN12_5' };

    function getProjectDefaultMaterial() { return _projectDefaults.material; }
    function getProjectDefaultSpec(material) {
        if (_projectDefaults.spec) return _projectDefaults.spec;
        const mat = (material || _projectDefaults.material || '').toUpperCase();
        if (mat.includes('PPR')) return 'PPR_PN12_5';
        if (mat.includes('HDPE') || mat.includes('PE100')) return 'HDPE_PE100';
        if (mat.includes('PVC') && !mat.includes('CPVC')) return 'PVC_SCH80';
        if (mat.includes('INOX') || mat.includes('SS')) return 'SS_150_RF';
        if (mat.includes('ACERO') || mat.includes('CARBONO') || mat.includes('CS')) return 'ACERO_150_RF';
        return 'PPR_PN12_5';
    }
    function setProjectDefaults(material, spec) {
        if (material) _projectDefaults.material = material;
        if (spec) _projectDefaults.spec = spec;
        notifyWithVoice("📐 Defaults: " + _projectDefaults.material + " / " + _projectDefaults.spec, false);
    }

    // ================================================================
    //  UTILIDADES (comunes)
    // ================================================================
    function extractCoords(str) {
        const m = str.match(/\((-?\d+\.?\d*)\s*,?\s*(-?\d+\.?\d*)\s*,?\s*(-?\d+\.?\d*)\)/);
        return m ? { x: parseFloat(m[1]), y: parseFloat(m[2]), z: parseFloat(m[3]) } : null;
    }

    function extractValue(parts, keys) {
        if (!Array.isArray(parts)) return null;
        for (let i = 0; i < parts.length; i++) {
            if (keys.includes(parts[i].toLowerCase()) && i + 1 < parts.length) {
                return parts[i + 1];
            }
        }
        return null;
    }

    function extractNamedParams(parts, startIndex) {
        const params = {};
        const keywords = ['material', 'spec', 'diameter', 'diametro', 'type', 'tipo', 'orient', 'direccion', 'via',
                          'fluid', 'fluido', 'flow', 'flujo', 'pressure', 'presion', 'temperature', 'temperatura',
                          'phase', 'fase', 'range', 'rango', 'signal', 'señal', 'service', 'servicio',
                          'sensor', 'controller', 'controlador', 'valve', 'valvula', 'setpoint', 'location'];
        const skipWords = ['to', 'from', 'at', 'in', 'on', 'by', 'with', 'and', 'route', 'ruta', 'via', 'as', 'like', 'auto'];
        
        for (let i = startIndex || 0; i < parts.length; i++) {
            const w = (parts[i] || '').toLowerCase();
            if (keywords.includes(w) && i + 1 < parts.length) {
                const next = parts[i + 1];
                if (next && !keywords.includes(next.toLowerCase()) && !skipWords.includes(next.toLowerCase())) {
                    const keyMap = {
                        'material': 'material', 'spec': 'spec', 'diameter': 'diameter', 'diametro': 'diameter',
                        'type': 'type', 'tipo': 'type',
                        'fluid': 'fluid', 'fluido': 'fluid',
                        'flow': 'flow', 'flujo': 'flow',
                        'pressure': 'pressure', 'presion': 'pressure',
                        'temperature': 'temperature', 'temperatura': 'temperature',
                        'phase': 'phase', 'fase': 'phase',
                        'range': 'range', 'rango': 'range',
                        'signal': 'signal', 'señal': 'signal',
                        'service': 'service', 'servicio': 'service',
                        'sensor': 'sensor', 'controller': 'controller', 'controlador': 'controller',
                        'valve': 'valve', 'valvula': 'valve',
                        'setpoint': 'setpoint', 'location': 'location'
                    };
                    const mappedKey = keyMap[w] || w;
                    if (['diameter', 'flow', 'pressure', 'temperature'].includes(mappedKey)) {
                        params[mappedKey] = parseFloat(next) || next;
                    } else if (mappedKey === 'material') {
                        params[mappedKey] = next.toUpperCase();
                    } else {
                        params[mappedKey] = next;
                    }
                    i++;
                }
            }
        }
        return params;
    }

    function extractWaypoints(parts, startIdx, endIdx) {
        const waypoints = [];
        for (let i = startIdx; i < (endIdx || parts.length); i++) {
            const m = parts[i].match(/\((-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\)/);
            if (m) waypoints.push({ x: parseFloat(m[1]), y: parseFloat(m[2]), z: parseFloat(m[3]) });
        }
        return waypoints;
    }

    function extractOrientation(parts) {
        const orientIdx = parts.indexOf('orient') !== -1 ? parts.indexOf('orient') : parts.indexOf('direccion');
        if (orientIdx !== -1 && orientIdx + 1 < parts.length) {
            const orientStr = parts.slice(orientIdx + 1).join('');
            const m = orientStr.match(/\((-?\d+\.?\d*),(-?\d+\.?\d*),(-?\d+\.?\d*)\)/);
            if (m) return { dx: parseFloat(m[1]), dy: parseFloat(m[2]), dz: parseFloat(m[3]) };
        }
        return null;
    }

    function extractBranchOrientation(parts, startIdx) {
        startIdx = startIdx || 0;
        for (let i = startIdx; i < parts.length; i++) {
            const w = (parts[i] || '').toLowerCase();
            if (w === 'orient' || w === 'direccion' || w === 'dirección' || w === 'branch') {
                if (i + 1 < parts.length) {
                    const orientStr = parts.slice(i + 1).join(' ');
                    const m = orientStr.match(/\((-?\d+\.?\d*)\s*,?\s*(-?\d+\.?\d*)\s*,?\s*(-?\d+\.?\d*)\)/);
                    if (m) return { dx: parseFloat(m[1]), dy: parseFloat(m[2]), dz: parseFloat(m[3]) };
                }
            }
            if (w === 'branchup' || w === 'branch_up' || w === 'up') return { dx: 0, dy: 1, dz: 0 };
            if (w === 'branchdown' || w === 'branch_down' || w === 'down') return { dx: 0, dy: -1, dz: 0 };
            if (w === 'branchnorth' || w === 'branch_north' || w === 'north') return { dx: 0, dy: 0, dz: -1 };
            if (w === 'branchsouth' || w === 'branch_south' || w === 'south') return { dx: 0, dy: 0, dz: 1 };
            if (w === 'brancheast' || w === 'branch_east' || w === 'east') return { dx: 1, dy: 0, dz: 0 };
            if (w === 'branchwest' || w === 'branch_west' || w === 'west') return { dx: -1, dy: 0, dz: 0 };
        }
        return null;
    }

    function resolveMaterialAndSpec(explicitParams, connectedObjects, defaults, options) {
        options = options || {};
        const inheritFromConnected = options.inheritFromConnected === true;
        const result = { material: null, spec: null };
        if (explicitParams.material) result.material = explicitParams.material;
        if (explicitParams.spec) result.spec = explicitParams.spec;
        if (!result.material && inheritFromConnected && connectedObjects && connectedObjects.length) {
            for (let i = 0; i < connectedObjects.length; i++) {
                if (connectedObjects[i] && connectedObjects[i].material) { result.material = connectedObjects[i].material; break; }
            }
        }
        if (!result.spec && inheritFromConnected && connectedObjects && connectedObjects.length) {
            for (let i = 0; i < connectedObjects.length; i++) {
                if (connectedObjects[i] && connectedObjects[i].spec) { result.spec = connectedObjects[i].spec; break; }
            }
        }
        if (!result.material) result.material = (defaults && defaults.material) || getProjectDefaultMaterial();
        if (!result.spec) result.spec = (defaults && defaults.spec) || getProjectDefaultSpec(result.material);
        return result;
    }

    function calculateBranchDirection(teePosition, targetPosition, waypoints) {
        let target = (waypoints && waypoints.length) ? waypoints[0] : targetPosition;
        if (!target) return { dx: 0, dy: 1, dz: 0 };
        const dx = target.x - teePosition.x, dy = target.y - teePosition.y, dz = target.z - teePosition.z;
        const len = Math.hypot(dx, dy, dz) || 1;
        return { dx: dx/len, dy: dy/len, dz: dz/len };
    }

    function getBasePosition(obj) {
        if (!obj) return { x: 0, y: 0, z: 0 };
        if (obj.posX !== undefined) return { x: obj.posX || 0, y: obj.posY || 0, z: obj.posZ || 0 };
        if (obj.pos && obj.pos.x !== undefined) return { x: obj.pos.x || 0, y: obj.pos.y || 0, z: obj.pos.z || 0 };
        const pts = _core ? _core.getLinePoints(obj) : (obj._cachedPoints || obj.points3D || obj.points || []);
        return pts.length > 0 ? { x: pts[0].x, y: pts[0].y, z: pts[0].z } : { x: 0, y: 0, z: 0 };
    }

    function getPoints(obj) {
        if (!obj) return [];
        if (_core) return _core.getLinePoints(obj) || [];
        return obj._cachedPoints || obj.points3D || obj.points || [];
    }

    function getPortPosition(tag, portId) {
        if (typeof SmartFlowRouter !== 'undefined' && SmartFlowRouter.getPortPosition) {
            return SmartFlowRouter.getPortPosition(_core ? _core.findObjectByTag(tag) : null, portId);
        }
        const obj = _core ? _core.findObjectByTag(tag) : null;
        if (!obj) return { x: 0, y: 0, z: 0 };
        const base = getBasePosition(obj);
        const puerto = obj.puertos && obj.puertos.find(p => p.id === portId);
        if (puerto) return { x: base.x + (puerto.relX || 0), y: base.y + (puerto.relY || 0), z: base.z + (puerto.relZ || 0) };
        return base;
    }

    function isParametricPortId(portId) {
        if (typeof SmartFlowRouter !== 'undefined' && SmartFlowRouter.isParametricPortId) {
            return SmartFlowRouter.isParametricPortId(portId);
        }
        if (portId === '0' || portId === '1' || portId === 0 || portId === 1) return false;
        const paramValue = parseFloat(portId);
        return !isNaN(paramValue) && paramValue > 0 && paramValue < 1;
    }

    function getPointAtParam(pts, param) {
        if (typeof SmartFlowRouter !== 'undefined' && SmartFlowRouter.getPointAtParam) {
            return SmartFlowRouter.getPointAtParam(pts, param);
        }
        if (!pts || pts.length < 2) return pts && pts[0] ? { x: pts[0].x, y: pts[0].y, z: pts[0].z } : null;
        let lengths = [], totalLen = 0;
        for (let i = 0; i < pts.length - 1; i++) {
            const d = Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y, pts[i+1].z - pts[i].z);
            lengths.push(d); totalLen += d;
        }
        if (totalLen === 0) return { x: pts[0].x, y: pts[0].y, z: pts[0].z };
        const targetDist = totalLen * Math.max(0, Math.min(1, param));
        let accumDist = 0;
        for (let j = 0; j < lengths.length; j++) {
            if (accumDist + lengths[j] >= targetDist || j === lengths.length - 1) {
                const segParam = lengths[j] > 0 ? (targetDist - accumDist) / lengths[j] : 0;
                return {
                    x: pts[j].x + (pts[j+1].x - pts[j].x) * Math.max(0, Math.min(1, segParam)),
                    y: pts[j].y + (pts[j+1].y - pts[j].y) * Math.max(0, Math.min(1, segParam)),
                    z: pts[j].z + (pts[j+1].z - pts[j].z) * Math.max(0, Math.min(1, segParam))
                };
            }
            accumDist += lengths[j];
        }
        return { x: pts[pts.length-1].x, y: pts[pts.length-1].y, z: pts[pts.length-1].z };
    }

    function calcularPuntoParametrico(lineObj, param) {
        const pts = getPoints(lineObj);
        if (pts.length < 2) return null;
        let totalLen = 0, lengths = [];
        for (let i = 0; i < pts.length - 1; i++) {
            const d = Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y, pts[i+1].z - pts[i].z);
            lengths.push(d); totalLen += d;
        }
        const target = totalLen * param;
        let accum = 0, segIdx = 0, t = 0;
        for (let i = 0; i < lengths.length; i++) {
            if (accum + lengths[i] >= target || i === lengths.length - 1) { segIdx = i; t = (target - accum) / (lengths[i] || 1); break; }
            accum += lengths[i];
        }
        const pA = pts[segIdx], pB = pts[segIdx + 1];
        return { x: pA.x + (pB.x - pA.x) * t, y: pA.y + (pB.y - pA.y) * t, z: pA.z + (pB.z - pA.z) * t, segIdx, t, totalLen, target };
    }

    function checkMaterialCompatibility(newLineMaterial, fromObj, toObj) {
        const warnings = [];
        if (fromObj && fromObj.material && fromObj.material.toUpperCase() !== newLineMaterial.toUpperCase())
            warnings.push("⚠️ Material diferente al origen: " + fromObj.material + " → " + newLineMaterial);
        if (toObj && toObj.material && toObj.material.toUpperCase() !== newLineMaterial.toUpperCase())
            warnings.push("⚠️ Material diferente al destino: " + toObj.material + " → " + newLineMaterial);
        return warnings;
    }

    function addComponentToLine(line, lineTag, compType, position) {
        let finalType = compType;
        const compDef = _catalog ? _catalog.getComponent(compType) : null;
        if (!compDef) {
            if (typeof SmartFlowRouter !== 'undefined' && SmartFlowRouter.findComponentInCatalog) {
                const found = SmartFlowRouter.findComponentInCatalog(compType, line.material || 'PPR', []);
                if (!found) { notifyWithVoice("⚠️ Componente no encontrado: " + compType, true); return false; }
                finalType = found;
            } else { notifyWithVoice("⚠️ Componente no encontrado: " + compType, true); return false; }
        }
        const existe = line.components && line.components.some(c => c.type && c.type.toUpperCase().indexOf(finalType.toUpperCase()) !== -1 && Math.abs((c.param || 0) - position) < 0.01);
        if (existe) { notifyWithVoice("⚠️ Ya existe " + finalType + " en pos " + position.toFixed(2), false); return false; }
        if (!line.components) line.components = [];
        line.components.push({ type: finalType, tag: finalType + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 4), param: position });
        return true;
    }

    const SPACING_RULES = {
        'VALVE': { spaceBefore: 150, spaceAfter: 150, category: 'inline' },
        'GATE_VALVE': { spaceBefore: 150, spaceAfter: 150, category: 'inline' },
        'GLOBE_VALVE': { spaceBefore: 180, spaceAfter: 150, category: 'inline' },
        'BALL_VALVE': { spaceBefore: 120, spaceAfter: 120, category: 'inline' },
        'BUTTERFLY_VALVE': { spaceBefore: 120, spaceAfter: 120, category: 'inline' },
        'CHECK_VALVE': { spaceBefore: 150, spaceAfter: 150, category: 'inline' },
        'STRAINER': { spaceBefore: 200, spaceAfter: 200, category: 'inline' },
        'FLANGE': { spaceBefore: 50, spaceAfter: 50, category: 'connection' },
        'WELD_NECK_FLANGE': { spaceBefore: 50, spaceAfter: 50, category: 'connection' },
        'SLIP_ON_FLANGE': { spaceBefore: 50, spaceAfter: 50, category: 'connection' },
        'BLIND_FLANGE': { spaceBefore: 30, spaceAfter: 0, category: 'connection' },
        'REDUCER': { spaceBefore: 100, spaceAfter: 80, category: 'transition' },
        'CONCENTRIC_REDUCER': { spaceBefore: 100, spaceAfter: 80, category: 'transition' },
        'ECCENTRIC_REDUCER': { spaceBefore: 100, spaceAfter: 80, category: 'transition' },
        'TEE_REDUCING': { spaceBefore: 120, spaceAfter: 100, category: 'branch' },
        'ELBOW': { spaceBefore: 80, spaceAfter: 80, category: 'directional' },
        'ELBOW_90_LR': { spaceBefore: 80, spaceAfter: 80, category: 'directional' },
        'ELBOW_90_SR': { spaceBefore: 60, spaceAfter: 60, category: 'directional' },
        'ELBOW_45': { spaceBefore: 60, spaceAfter: 60, category: 'directional' },
        'TEE': { spaceBefore: 120, spaceAfter: 120, category: 'branch' },
        'TEE_EQUAL': { spaceBefore: 120, spaceAfter: 120, category: 'branch' },
        'EXPANSION_JOINT': { spaceBefore: 250, spaceAfter: 250, category: 'expansion' },
        'PIPE_GUIDE': { spaceBefore: 50, spaceAfter: 50, category: 'support' },
        'CAP': { spaceBefore: 30, spaceAfter: 0, category: 'end' },
        'CROSS': { spaceBefore: 150, spaceAfter: 150, category: 'branch' },
        'PRESSURE_GAUGE': { spaceBefore: 60, spaceAfter: 0, category: 'instrument' },
        'TEMPERATURE_GAUGE': { spaceBefore: 60, spaceAfter: 0, category: 'instrument' },
        'FLOW_METER': { spaceBefore: 200, spaceAfter: 200, category: 'instrument' },
        'DEFAULT': { spaceBefore: 100, spaceAfter: 100, category: 'general' }
    };

    function getSpacingRules(componentType) {
        const typeUpper = (componentType || '').toUpperCase();
        if (SPACING_RULES[typeUpper]) return SPACING_RULES[typeUpper];
        for (let key in SPACING_RULES) {
            if (typeUpper.indexOf(key) !== -1 || key.indexOf(typeUpper) !== -1) return SPACING_RULES[key];
        }
        if (typeUpper.indexOf('VALVE') !== -1) return SPACING_RULES['VALVE'];
        if (typeUpper.indexOf('FLANGE') !== -1) return SPACING_RULES['FLANGE'];
        if (typeUpper.indexOf('REDUC') !== -1) return SPACING_RULES['REDUCER'];
        if (typeUpper.indexOf('ELBOW') !== -1) return SPACING_RULES['ELBOW'];
        if (typeUpper.indexOf('TEE') !== -1) return SPACING_RULES['TEE'];
        return SPACING_RULES['DEFAULT'];
    }

    function calculateAccessoryPositions(componentTypes, startPosition, totalLength, diameter) {
        const positions = [];
        let currentPos = startPosition;
        for (let i = 0; i < componentTypes.length; i++) {
            const compType = componentTypes[i];
            const rules = getSpacingRules(compType);
            let spaceBefore = rules.spaceBefore;
            if (diameter > 6) spaceBefore *= 1.5;
            if (diameter > 12) spaceBefore *= 2.0;
            if (i > 0) {
                const prevRules = getSpacingRules(componentTypes[i - 1]);
                if (prevRules.category === 'connection' && rules.category === 'inline') spaceBefore = Math.max(spaceBefore, 50);
                if (prevRules.category === 'inline' && rules.category === 'inline') spaceBefore *= 1.5;
            }
            const spaceParam = spaceBefore / totalLength;
            currentPos += spaceParam;
            if (currentPos > 0.99) currentPos = 0.99;
            positions.push({ type: compType, position: currentPos, spaceBeforeMM: spaceBefore, category: rules.category });
        }
        return positions;
    }

    function notifyWithVoice(message, isError) {
        isError = isError || false;
        if (typeof _notifyUI === 'function') _notifyUI(message, isError);
        const statusEl = document.getElementById('statusMsg');
        if (statusEl) { statusEl.innerText = message; statusEl.style.color = isError ? '#ef4444' : '#00f2ff'; }
        if (typeof _voiceFn === 'function') _voiceFn(message);
    }

    function saveStateBeforeMutation() {
        if (_core && _core._saveState) _core._saveState();
        else if (_core && _core.getDb) {
            const state = JSON.parse(JSON.stringify({ equipos: _core.getDb().equipos, lines: _core.getDb().lines }));
            if (!window._manualUndoStack) window._manualUndoStack = [];
            window._manualUndoStack.push(state);
        }
    }

    function runFittingInjection(line, fromObj, fromPortId, toObj, toPortId, diameter, material, spec) {
        if (typeof SmartFlowRouter !== 'undefined' && typeof SmartFlowRouter.ensureFittings === 'function') {
            return SmartFlowRouter.ensureFittings(line, fromObj, fromPortId, toObj, toPortId, diameter, material, spec);
        }
        return { added: [], message: '' };
    }

    // ================================================================
    //  COMANDOS PFD
    // ================================================================
    
    function parseCreateEquipoPFD(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'create' || parts[1] !== 'equipo') return false;
        const tipo = parts[2], tag = parts[3];
        if (!tipo || !tag) { notifyWithVoice('❌ Uso: create equipo TIPO TAG', true); return true; }
        if (typeof SmartFlowPFD !== 'undefined') { SmartFlowPFD.createEquipmentForPFD(tipo, tag, {}); return true; }
        if (_core) {
            const equipo = { tag: tag, tipo: tipo, posX: 0, posY: 0, posZ: 0, diametro: 1000, altura: 1500, puertos: [] };
            _core.addEquipment(equipo);
            notifyWithVoice('✅ Equipo lógico ' + tag + ' (' + tipo + ') creado', false);
            return true;
        }
        return false;
    }
    
    function parseCreateStream(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'create' || parts[1] !== 'stream') return false;
        const tag = parts[2];
        if (!tag) { notifyWithVoice('❌ Uso: create stream TAG from EQUIPO to EQUIPO fluid FLUIDO flow VALOR', true); return true; }
        const fromIdx = parts.indexOf('from') !== -1 ? parts.indexOf('from') : parts.indexOf('desde');
        const toIdx = parts.indexOf('to') !== -1 ? parts.indexOf('to') : parts.indexOf('a');
        if (fromIdx === -1 || toIdx === -1) { notifyWithVoice('❌ Especifique origen (from) y destino (to)', true); return true; }
        const namedParams = extractNamedParams(parts, toIdx + 2);
        const params = {
            tag: tag, from: parts[fromIdx + 1] || '', to: parts[toIdx + 1] || '',
            fluid: namedParams.fluid || 'WATER', flow: namedParams.flow || 0,
            pressure: namedParams.pressure || 0, temperature: namedParams.temperature || 25,
            phase: namedParams.phase || 'LIQUID', service: namedParams.service || '', density: namedParams.density || 1000
        };
        if (typeof SmartFlowPFD !== 'undefined') { SmartFlowPFD.createStream(params); return true; }
        notifyWithVoice('❌ Módulo PFD no disponible', true);
        return true;
    }
    
    function parseStreamInfo(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'info' || parts[1] !== 'stream') return false;
        const tag = parts[2];
        if (!tag) { notifyWithVoice('Uso: info stream TAG', true); return true; }
        if (typeof SmartFlowPFD !== 'undefined') { SmartFlowPFD.getStreamInfo(tag); return true; }
        return false;
    }
    
    function parseListStreams(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'list' || parts[1] !== 'streams') return false;
        const filter = parts[2] || null;
        if (typeof SmartFlowPFD !== 'undefined') { SmartFlowPFD.listStreams(filter); return true; }
        return false;
    }
    
    function parseLinkStream(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'link' || parts[1] !== 'stream') return false;
        const streamTag = parts[2];
        const toIdx = parts.indexOf('to');
        if (toIdx === -1 || !streamTag) return false;
        const lineTag = parts[toIdx + 1];
        if (typeof SmartFlowPFD !== 'undefined') { SmartFlowPFD.linkStreamToLine(streamTag, lineTag); return true; }
        return false;
    }
    
    function parseBalance(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'balance' || parts[1] !== 'masa') return false;
        const tag = parts[2];
        if (!tag) { notifyWithVoice('Uso: balance masa EQUIPO_TAG', true); return true; }
        if (typeof SmartFlowPFD !== 'undefined') { SmartFlowPFD.checkMassBalance(tag); return true; }
        return false;
    }

    // ================================================================
    //  COMANDOS DTI
    // ================================================================
    
    function parseCreateInstrument(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'create' || parts[1] !== 'instrument') return false;
        const tag = parts[2];
        if (!tag) { notifyWithVoice('❌ Uso: create instrument TAG type TIPO on LINEA at POS range RANGO', true); return true; }
        const typeIdx = parts.indexOf('type') !== -1 ? parts.indexOf('type') : parts.indexOf('tipo');
        const onIdx = parts.indexOf('on') !== -1 ? parts.indexOf('on') : parts.indexOf('en');
        const equipIdx = parts.indexOf('equipment') !== -1 ? parts.indexOf('equipment') : parts.indexOf('equipo');
        const atIdx = parts.indexOf('at') !== -1 ? parts.indexOf('at') : parts.indexOf('@');
        const namedParams = extractNamedParams(parts, 3);
        const params = { tag: tag };
        if (namedParams.type) params.type = namedParams.type.toUpperCase();
        if (typeIdx !== -1 && typeIdx + 1 < parts.length && !params.type) params.type = parts[typeIdx + 1].toUpperCase();
        if (onIdx !== -1 && onIdx + 1 < parts.length) params.lineTag = parts[onIdx + 1];
        if (equipIdx !== -1 && equipIdx + 1 < parts.length) params.equipmentTag = parts[equipIdx + 1];
        if (atIdx !== -1 && atIdx + 1 < parts.length) params.position = parseFloat(parts[atIdx + 1]);
        if (namedParams.range) params.range = namedParams.range;
        if (namedParams.signal) params.signal = namedParams.signal;
        if (namedParams.service) params.service = namedParams.service;
        if (namedParams.location) params.location = namedParams.location;
        if (typeof SmartFlowDTI !== 'undefined') { SmartFlowDTI.createInstrument(params); return true; }
        return false;
    }
    
    function parseCreateLoop(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'create' || parts[1] !== 'loop') return false;
        const tag = parts[2];
        if (!tag) { notifyWithVoice('❌ Uso: create loop TAG sensor X controller Y valve Z type TIPO', true); return true; }
        const namedParams = extractNamedParams(parts, 3);
        const params = { tag: tag };
        if (namedParams.sensor) params.sensor = namedParams.sensor;
        if (namedParams.controller) params.controller = namedParams.controller;
        if (namedParams.valve) params.valve = namedParams.valve;
        if (namedParams.type) params.type = namedParams.type.toUpperCase();
        if (namedParams.setpoint) params.setpoint = namedParams.setpoint;
        if (namedParams.range) params.range = namedParams.range;
        if (typeof SmartFlowDTI !== 'undefined') { SmartFlowDTI.createLoop(params); return true; }
        return false;
    }
    
    function parseInstrumentInfo(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'info' || parts[1] !== 'instrument') return false;
        const tag = parts[2];
        if (!tag) { notifyWithVoice('Uso: info instrument TAG', true); return true; }
        if (typeof SmartFlowDTI !== 'undefined') { SmartFlowDTI.getInstrumentInfo(tag); return true; }
        return false;
    }
    
    function parseListInstruments(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'list' || parts[1] !== 'instruments') return false;
        const filter = parts[2] || null;
        if (typeof SmartFlowDTI !== 'undefined') { SmartFlowDTI.listInstruments(filter); return true; }
        return false;
    }
    
    function parseListLoops(cmd) {
        const trimmed = cmd.trim().toLowerCase();
        if (trimmed === 'list loops' || trimmed === 'listar lazos') {
            if (typeof SmartFlowDTI !== 'undefined') { SmartFlowDTI.listLoops(); return true; }
        }
        return false;
    }
    
    function parseListInstrumentTypes(cmd) {
        const trimmed = cmd.trim().toLowerCase();
        if (trimmed === 'list instrument types' || trimmed === 'listar tipos instrumento') {
            if (typeof SmartFlowDTI !== 'undefined') { SmartFlowDTI.listInstrumentTypes(); return true; }
        }
        return false;
    }

    // ================================================================
    //  COMANDOS INTEGRITY
    // ================================================================
    
    function parseValidateAll(cmd) {
        const trimmed = cmd.trim().toLowerCase();
        if (trimmed === 'validate all' || trimmed === 'validar todo' || trimmed === 'validar proyecto') {
            if (typeof SmartFlowIntegrity !== 'undefined') { SmartFlowIntegrity.validateAll(); return true; }
        }
        return false;
    }
    
    function parseValidatePFD(cmd) {
        const trimmed = cmd.trim().toLowerCase();
        if (trimmed === 'validate pfd' || trimmed === 'validar pfd') {
            if (typeof SmartFlowPFD !== 'undefined') { SmartFlowPFD.validatePFD(); return true; }
        }
        return false;
    }
    
    function parseValidateDTI(cmd) {
        const trimmed = cmd.trim().toLowerCase();
        if (trimmed === 'validate dti' || trimmed === 'validar dti') {
            if (typeof SmartFlowDTI !== 'undefined') { SmartFlowDTI.validateDTI(); return true; }
        }
        return false;
    }
    
    function parseProjectSummary(cmd) {
        const trimmed = cmd.trim().toLowerCase();
        if (trimmed === 'project summary' || trimmed === 'resumen proyecto') {
            if (typeof SmartFlowIntegrity !== 'undefined') { SmartFlowIntegrity.quickSummary(); return true; }
        }
        return false;
    }
    
    function parseAutoFix(cmd) {
        const trimmed = cmd.trim().toLowerCase();
        if (trimmed === 'autofix' || trimmed === 'auto fix' || trimmed === 'auto corregir') {
            if (typeof SmartFlowIntegrity !== 'undefined') { SmartFlowIntegrity.autoFix(); return true; }
        }
        return false;
    }

    // ================================================================
    //  COMANDOS EXPORT / IMPORT
    // ================================================================
    
    function parseExportCommand(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'export' && parts[0] !== 'exportar') return false;
        const format = parts[1] ? parts[1].toLowerCase() : null;
        if (format === 'pcf') {
            if (typeof SmartFlowIO !== 'undefined') { SmartFlowIO.downloadPCF(); return true; }
            if (typeof SmartFlowRenderer !== 'undefined' && SmartFlowRenderer.exportPCF) { SmartFlowRenderer.exportPCF(); return true; }
            notifyWithVoice('❌ Exportación PCF no disponible', true); return true;
        }
        if (format === 'mto' || format === 'csv') {
            if (typeof SmartFlowIO !== 'undefined') { SmartFlowIO.downloadMTO(); return true; }
            generateBOM(); return true;
        }
        if (format === 'json') {
            if (typeof SmartFlowIO !== 'undefined') { SmartFlowIO.downloadJSON(); return true; }
            if (_core && _core.exportProject) {
                const json = _core.exportProject();
                const blob = new Blob([json], { type: 'application/json' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = 'SmartFlow_' + new Date().toISOString().slice(0,10) + '.json';
                a.click();
                notifyWithVoice("📁 Proyecto exportado", false);
            }
            return true;
        }
        if (format === 'db' || format === 'excel' || format === 'database') {
            if (typeof SmartFlowDBExport !== 'undefined') { SmartFlowDBExport.exportDatabase(); return true; }
            notifyWithVoice('❌ Módulo DB Export no disponible', true);
            return true;
        }
        notifyWithVoice("Formatos: export pcf | export mto | export json | export db", true);
        return true;
    }
    
    function parseImportCommand(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'import' && parts[0] !== 'importar') return false;
        const format = parts[1] ? parts[1].toLowerCase() : null;
        if (format === 'pcf') {
            if (typeof SmartFlowIO !== 'undefined') { SmartFlowIO.uploadAndImportPCF(); return true; }
            notifyWithVoice('❌ Módulo I/O no disponible', true); return true;
        }
        if (format === 'json') {
            if (typeof SmartFlowIO !== 'undefined') { SmartFlowIO.uploadAndImportJSON(); return true; }
            notifyWithVoice('❌ Módulo I/O no disponible', true); return true;
        }
        notifyWithVoice("Formatos: import pcf | import json", true);
        return true;
    }

    // ================================================================
    //  COMANDOS ISOMÉTRICO 3D (heredados v3.7)
    // ================================================================
    
    function parseCreate(cmd) {
        const parts = cmd.split(/\s+/);
        if (parts[0] !== 'create') return false;
        const tipo = parts[1]; const tag = parts[2];
        if (!tipo || !tag || parts[3] !== 'at') return false;
        let coordStr = '';
        for (let i = 4; i < parts.length; i++) { coordStr += parts[i]; if (parts[i].includes(')')) break; }
        const coords = coordStr.match(/\((-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\)/);
        if (!coords) return false;
        const x = parseFloat(coords[1]), y = parseFloat(coords[2]), z = parseFloat(coords[3]);
        const namedParams = extractNamedParams(parts, 5);
        let params = {};
        if (namedParams.diameter) params.diametro = namedParams.diameter;
        if (namedParams.material) params.material = namedParams.material;
        if (namedParams.spec) params.spec = namedParams.spec;
        if (namedParams.type) params.tipo = namedParams.type;
        for (let i = 5; i < parts.length; i++) {
            let key = parts[i];
            if (key === 'diam' || key === 'diametro') { if (params.diametro === undefined) params.diametro = parseFloat(parts[++i]); else i++; }
            else if (key === 'height' || key === 'altura') params.altura = parseFloat(parts[++i]);
            else if (key === 'largo') params.largo = parseFloat(parts[++i]);
            else if (key === 'ancho') params.ancho = parseFloat(parts[++i]);
            else if (key === 'diametro_succion' || key === 'succion') params.diametro_succion = parseFloat(parts[++i]);
            else if (key === 'diametro_descarga' || key === 'descarga') params.diametro_descarga = parseFloat(parts[++i]);
            else if (key === 'material') { if (params.material === undefined) params.material = parts[++i].toUpperCase(); else i++; }
            else if (key === 'spec') { if (params.spec === undefined) params.spec = parts[++i]; else i++; }
        }
        const equipoDef = _catalog.getEquipment(tipo);
        if (!equipoDef) { notifyWithVoice("Tipo de equipo desconocido: " + tipo, true); return true; }
        if (_core && _core.findObjectByTag(tag)) { notifyWithVoice("❌ Error: El tag " + tag + " ya existe", true); return true; }
        const equipo = _catalog.createEquipment(tipo, tag, x, y, z, params);
        if (equipo) { _core.addEquipment(equipo); if (_core.setSelected) _core.setSelected({ type: 'equipment', obj: equipo }); notifyWithVoice("✅ Equipo " + tag + " (" + (equipoDef.nombre || tipo) + ") creado en (" + x + "," + y + "," + z + ")", false); }
        return true;
    }

    function parseCreateLine(cmd) {
        const parts = cmd.split(/\s+/);
        if (parts[0] !== 'create' || parts[1] !== 'line') return false;
        const tag = parts[2];
        if (!tag) { notifyWithVoice("Error: Tag de línea requerido", true); return true; }
        if (_core && _core.findObjectByTag(tag)) { notifyWithVoice("❌ El tag " + tag + " ya existe", true); return true; }
        const namedParams = extractNamedParams(parts, 3);
        const resolved = resolveMaterialAndSpec(namedParams, [], null, { inheritFromConnected: false });
        let diameter = namedParams.diameter || 4, material = resolved.material, spec = resolved.spec;
        let points = [];
        let i = 3;
        while (i < parts.length) {
            if (parts[i] === 'route' || parts[i] === 'ruta') {
                i++;
                while (i < parts.length) {
                    const m = parts[i].match(/\((-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\)/);
                    if (m) { points.push({ x: parseFloat(m[1]), y: parseFloat(m[2]), z: parseFloat(m[3]) }); i++; }
                    else { const lower = (parts[i] || '').toLowerCase(); if (['material', 'spec', 'diameter', 'diametro'].indexOf(lower) !== -1) { i += 2; } else { i++; } }
                }
                break;
            }
            i++;
        }
        if (points.length < 2) { notifyWithVoice("Error: Se requieren al menos 2 puntos para la ruta", true); return true; }
        const nuevaLinea = { tag: tag, diameter: diameter, material: material, spec: spec, _cachedPoints: points, waypoints: points.slice(1, -1), components: [] };
        _core.addLine(nuevaLinea);
        const db = _core.getDb();
        const lineaRegistrada = db.lines.find(l => l.tag === tag) || nuevaLinea;
        const fittingInfo = runFittingInjection(lineaRegistrada, null, null, null, null, diameter, material, spec);
        if (_core.updateLine) _core.updateLine(tag, lineaRegistrada);
        if (_core.setSelected) _core.setSelected({ type: 'line', obj: lineaRegistrada });
        notifyWithVoice("✅ Línea " + tag + " creada: " + material + " " + diameter + "\" " + spec + (fittingInfo.message || ''), false);
        return true;
    }

    function parseConnect(cmd) {
        const parts = cmd.split(/\s+/);
        if (parts[0] !== 'connect' && parts[0] !== 'conectar') return false;
        const fromEquip = parts[1], fromNozzle = parts[2];
        if (parts[3] !== 'to' && parts[3] !== 'a') return false;
        const toEquip = parts[4];
        const viaIdx = parts.indexOf('via');
        let waypoints = [];
        if (viaIdx !== -1) {
            const endKeywords = ['to', 'a', 'diameter', 'diametro', 'material', 'spec', 'orient', 'direccion', 'branchup', 'branchdown', 'branchnorth', 'branchsouth', 'brancheast', 'branchwest', 'up', 'down', 'north', 'south', 'east', 'west'];
            let endIdx = parts.length;
            for (let i = viaIdx + 1; i < parts.length; i++) { if (endKeywords.includes(parts[i].toLowerCase())) { endIdx = i; break; } }
            waypoints = extractWaypoints(parts, viaIdx + 1, endIdx);
        }
        let toNozzleRaw = parts[5];
        const knownKeywords = ['material', 'spec', 'diameter', 'diametro', 'type', 'tipo', 'orient', 'direccion', 'via'];
        if (toNozzleRaw && knownKeywords.indexOf(toNozzleRaw.toLowerCase()) !== -1) toNozzleRaw = null;
        if (toNozzleRaw && toNozzleRaw.startsWith('(')) toNozzleRaw = null;
        let branchOrientation = extractOrientation(parts);
        if (!branchOrientation) branchOrientation = extractBranchOrientation(parts, 5);
        let paramsStartIndex = 5;
        if (toNozzleRaw) paramsStartIndex = 6;
        if (viaIdx !== -1 && viaIdx >= paramsStartIndex) {
            paramsStartIndex = viaIdx;
            let skipCount = 1;
            for (let i = viaIdx + 1; i < parts.length; i++) { if (parts[i].startsWith('(')) skipCount++; else break; }
            paramsStartIndex += skipCount;
        }
        const namedParams = extractNamedParams(parts, paramsStartIndex);
        if (!_core) { notifyWithVoice("Core no inicializado", true); return true; }
        const fromObj = _core.findObjectByTag(fromEquip);
        const toObj = _core.findObjectByTag(toEquip);
        if (!fromObj || !toObj) { notifyWithVoice("Objeto no encontrado", true); return true; }
        const resolved = resolveMaterialAndSpec(namedParams, [fromObj, toObj], null, { inheritFromConnected: false });
        let diameter = namedParams.diameter || 4, material = resolved.material, spec = resolved.spec;
        for (let i = paramsStartIndex; i < parts.length; i++) {
            if (parts[i] === 'diameter' || parts[i] === 'diametro') diameter = parseFloat(parts[++i]);
            else if (parts[i] === 'material') material = parts[++i].toUpperCase();
            else if (parts[i] === 'spec') spec = parts[++i];
        }
        const numPosFrom = parseFloat(fromNozzle);
        const isNumericFrom = !isNaN(numPosFrom) && isFinite(numPosFrom) && numPosFrom >= 0 && numPosFrom <= 1;
        const isFromLine = _core.getLinePoints(fromObj) ? true : false;
        const isToLine = _core.getLinePoints(toObj) ? true : false;
        const db = _core.getDb();
        let startPos = null, fromDiameter = 4;
        let effectiveFromNozzle = fromNozzle;
        if (isFromLine && isNumericFrom && numPosFrom > 0.01 && numPosFrom < 0.99) {
            const pts = _core.getLinePoints(fromObj);
            if (!pts || pts.length < 2) { notifyWithVoice("La línea origen no tiene geometría válida", true); return true; }
            let totalLen = 0, lengths = [];
            for (let i = 0; i < pts.length - 1; i++) { const d = Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y, pts[i+1].z - pts[i].z); lengths.push(d); totalLen += d; }
            const targetLen = totalLen * numPosFrom;
            let accum = 0, segIdx = 0, t = 0;
            for (let i = 0; i < lengths.length; i++) { if (accum + lengths[i] >= targetLen || i === lengths.length - 1) { segIdx = i; t = (targetLen - accum) / (lengths[i] || 1); break; } accum += lengths[i]; }
            const pA = pts[segIdx], pB = pts[segIdx + 1];
            startPos = { x: pA.x + (pB.x - pA.x) * t, y: pA.y + (pB.y - pA.y) * t, z: pA.z + (pB.z - pA.z) * t };
            fromDiameter = fromObj.diameter || 4;
        } else if (_core.getLinePoints(fromObj) && (fromNozzle === '0' || fromNozzle === '1')) {
            const pts = _core.getLinePoints(fromObj);
            if (pts && pts.length >= 2) startPos = fromNozzle === '0' ? { x: pts[0].x, y: pts[0].y, z: pts[0].z } : { x: pts[pts.length - 1].x, y: pts[pts.length - 1].y, z: pts[pts.length - 1].z };
            fromDiameter = fromObj.diameter || 4;
        } else {
            const nzFrom = fromObj.puertos && fromObj.puertos.find(n => n.id === fromNozzle);
            if (!nzFrom) { notifyWithVoice("Puerto origen '" + fromNozzle + "' no encontrado", true); return true; }
            fromDiameter = nzFrom.diametro || 4;
            if (typeof SmartFlowRouter !== 'undefined' && SmartFlowRouter.getPortPosition) startPos = SmartFlowRouter.getPortPosition(fromObj, fromNozzle);
            else { const basePos = getBasePosition(fromObj); startPos = { x: basePos.x + (nzFrom.relX || 0), y: basePos.y + (nzFrom.relY || 0), z: basePos.z + (nzFrom.relZ || 0) }; }
        }
        if (!startPos) { notifyWithVoice("No se pudo obtener la posición del puerto origen", true); return true; }
        let endPos = null, nuevoPuertoId = toNozzleRaw;
        let destBranchDirection = null;
        if (isToLine && (!toNozzleRaw || toNozzleRaw === '')) {
            const pts = _core.getLinePoints(toObj);
            if (!pts || pts.length < 2) { notifyWithVoice("La línea destino no tiene geometría", true); return true; }
            let minDist = Infinity, bestPoint = pts[0];
            for (let i = 0; i < pts.length - 1; i++) {
                const a = pts[i], b = pts[i+1];
                const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
                const ap = { x: startPos.x - a.x, y: startPos.y - a.y, z: startPos.z - a.z };
                const len2 = ab.x*ab.x + ab.y*ab.y + ab.z*ab.z;
                let t2 = len2 !== 0 ? Math.max(0, Math.min(1, (ap.x*ab.x + ap.y*ab.y + ap.z*ab.z) / len2)) : 0;
                const proj = { x: a.x + ab.x * t2, y: a.y + ab.y * t2, z: a.z + ab.z * t2 };
                const dist = Math.hypot(startPos.x - proj.x, startPos.y - proj.y, startPos.z - proj.z);
                if (dist < minDist) { minDist = dist; bestPoint = proj; }
            }
            endPos = bestPoint;
            destBranchDirection = calculateBranchDirection(endPos, startPos);
        } else if (isToLine && isParametricPortId(toNozzleRaw)) {
            const pts = _core.getLinePoints(toObj);
            if (!pts || pts.length < 2) { notifyWithVoice("Geometría inválida", true); return true; }
            const paramValue = parseFloat(toNozzleRaw);
            endPos = getPointAtParam(pts, paramValue);
            if (!endPos) { notifyWithVoice("No se pudo calcular punto en posición " + toNozzleRaw, true); return true; }
            destBranchDirection = calculateBranchDirection(endPos, startPos);
        } else if (isToLine && (toNozzleRaw === '0' || toNozzleRaw === '1')) {
            const pts = _core.getLinePoints(toObj);
            if (!pts || pts.length < 2) { notifyWithVoice("La línea destino no tiene geometría", true); return true; }
            endPos = toNozzleRaw === '0' ? { x: pts[0].x, y: pts[0].y, z: pts[0].z } : { x: pts[pts.length - 1].x, y: pts[pts.length - 1].y, z: pts[pts.length - 1].z };
        } else {
            if (!toObj.puertos) toObj.puertos = [];
            const nzTo = toObj.puertos && toObj.puertos.find(n => n.id === toNozzleRaw);
            if (!nzTo) { notifyWithVoice("Puerto destino '" + toNozzleRaw + "' no encontrado", true); return true; }
            if (typeof SmartFlowRouter !== 'undefined' && SmartFlowRouter.getPortPosition) endPos = SmartFlowRouter.getPortPosition(toObj, toNozzleRaw);
            else { const basePos = getBasePosition(toObj); endPos = { x: basePos.x + (nzTo.relX || 0), y: basePos.y + (nzTo.relY || 0), z: basePos.z + (nzTo.relZ || 0) }; }
        }
        if (!endPos) { notifyWithVoice("No se pudo determinar el punto de destino", true); return true; }
        let originBranchDirection = null;
        if (isFromLine && isNumericFrom && numPosFrom > 0.01 && numPosFrom < 0.99) {
            if (branchOrientation) { originBranchDirection = branchOrientation; const oLen = Math.hypot(originBranchDirection.dx, originBranchDirection.dy, originBranchDirection.dz); if (oLen > 0) { originBranchDirection.dx /= oLen; originBranchDirection.dy /= oLen; originBranchDirection.dz /= oLen; } }
            else { originBranchDirection = calculateBranchDirection(startPos, endPos, waypoints); }
        }
        if (isFromLine && isNumericFrom && numPosFrom > 0.01 && numPosFrom < 0.99) {
            if (typeof SmartFlowRouter !== 'undefined' && typeof SmartFlowRouter.insertarAccesorioEnLinea === 'function') {
                const nuevoPuertoIdTemp = SmartFlowRouter.insertarAccesorioEnLinea(fromEquip, startPos, diameter, true, originBranchDirection);
                if (nuevoPuertoIdTemp) effectiveFromNozzle = nuevoPuertoIdTemp;
                else { notifyWithVoice("No se pudo insertar TEE en la línea origen", true); return true; }
            }
        }
        if (isToLine && (isParametricPortId(toNozzleRaw) || !toNozzleRaw || toNozzleRaw === '')) {
            if (typeof SmartFlowRouter !== 'undefined' && typeof SmartFlowRouter.insertarAccesorioEnLinea === 'function') {
                const puertoIdTemp = SmartFlowRouter.insertarAccesorioEnLinea(toEquip, endPos, diameter, true, destBranchDirection);
                if (puertoIdTemp) nuevoPuertoId = puertoIdTemp;
                else { notifyWithVoice("No se pudo insertar el accesorio automáticamente", true); return true; }
            }
        }
        let newTag, counter = 1;
        const existingTags = new Set(db.lines.map(l => l.tag));
        do { newTag = 'L-' + counter; counter++; } while (existingTags.has(newTag) && counter < 10000);
        let linePoints = [startPos];
        if (waypoints.length > 0) { for (let w of waypoints) linePoints.push(w); }
        linePoints.push(endPos);
        const nuevaLinea = {
            tag: newTag, diameter: diameter, material: material, spec: spec,
            origin: { objType: isFromLine ? 'line' : 'equipment', equipTag: fromEquip, portId: effectiveFromNozzle },
            destination: { objType: isToLine ? 'line' : 'equipment', equipTag: toEquip, portId: nuevoPuertoId },
            waypoints: linePoints.slice(1, -1), _cachedPoints: linePoints.slice(), components: [],
            fittingInsertedAtOrigin: isFromLine && isNumericFrom && numPosFrom > 0.01 && numPosFrom < 0.99,
            fittingInsertedAtDestination: !isToLine
        };
        _core.addLine(nuevaLinea);
        const lineaRegistrada = _core.getDb().lines.find(l => l.tag === newTag) || nuevaLinea;
        const fittingInfo = runFittingInjection(lineaRegistrada, fromObj, effectiveFromNozzle, toObj, nuevoPuertoId, diameter, material, spec);
        if (_core.updateLine) _core.updateLine(newTag, lineaRegistrada);
        if (_core.setSelected) _core.setSelected({ type: 'line', obj: lineaRegistrada });
        const nzFrom = fromObj.puertos && fromObj.puertos.find(n => n.id === effectiveFromNozzle);
        if (nzFrom) nzFrom.connectedLine = newTag;
        const matWarnings = checkMaterialCompatibility(material, fromObj, toObj);
        const viaMsg = waypoints.length > 0 ? " vía " + waypoints.length + " waypoint(s)" : "";
        const orientMsg = branchOrientation ? " [orientación manual]" : " [orientación auto]";
        notifyWithVoice("✅ Conectado " + fromEquip + "." + effectiveFromNozzle + " a " + toEquip + "." + nuevoPuertoId + " | " + material + " " + diameter + "\" " + spec + viaMsg + orientMsg + (fittingInfo.message || '') + (matWarnings.length > 0 ? '\n' + matWarnings.join('\n') : ''), matWarnings.length > 0);
        return true;
    }

    function parseRoute(cmd) {
        const parts = cmd.split(/\s+/);
        if (parts[0] !== 'route' && parts[0] !== 'ruta') return false;
        let fromIdx = -1, toIdx = -1, viaIdx = -1;
        for (let i = 1; i < parts.length; i++) {
            const w = parts[i].toLowerCase();
            if ((w === 'from' || w === 'desde') && fromIdx === -1) fromIdx = i;
            if ((w === 'to' || w === 'a' || w === 'hasta') && toIdx === -1) toIdx = i;
            if (w === 'via' && viaIdx === -1) viaIdx = i;
        }
        if (fromIdx === -1 || toIdx === -1) { notifyWithVoice("Uso: route from [origen] [puerto] [via (x,y,z)...] to [destino] [puerto] [diameter X] [material X]", true); return true; }
        const fromEquip = parts[fromIdx + 1], fromNozzle = parts[fromIdx + 2], toEquip = parts[toIdx + 1];
        if (!fromEquip || !fromNozzle || !toEquip) { notifyWithVoice("❌ Faltan parámetros", true); return true; }
        let waypoints = [], toNozzle = null, paramsStartIdx;
        if (viaIdx !== -1 && viaIdx < toIdx) { waypoints = extractWaypoints(parts, viaIdx + 1, toIdx); paramsStartIdx = toIdx + 2; }
        else { paramsStartIdx = toIdx + 2; }
        if (paramsStartIdx < parts.length && ['material', 'spec', 'diameter', 'diametro', 'orient', 'direccion'].indexOf((parts[paramsStartIdx] || '').toLowerCase()) === -1) { toNozzle = parts[paramsStartIdx]; paramsStartIdx++; }
        const namedParams = extractNamedParams(parts, paramsStartIdx);
        const fromObj = _core ? _core.findObjectByTag(fromEquip) : null;
        const toObj = _core ? _core.findObjectByTag(toEquip) : null;
        const resolved = resolveMaterialAndSpec(namedParams, [fromObj, toObj].filter(Boolean), null, { inheritFromConnected: false });
        let diameter = namedParams.diameter || 3, material = resolved.material, spec = resolved.spec;
        for (let i = paramsStartIdx; i < parts.length; i++) {
            if (parts[i] === 'diameter' || parts[i] === 'diametro') diameter = parseFloat(parts[++i]);
            else if (parts[i] === 'material') material = parts[++i].toUpperCase();
            else if (parts[i] === 'spec') spec = parts[++i];
        }
        if (typeof SmartFlowRouter !== 'undefined') {
            if (waypoints.length > 0 && typeof SmartFlowRouter.routeWithWaypoints === 'function') SmartFlowRouter.routeWithWaypoints(fromEquip, fromNozzle, toEquip, toNozzle, waypoints, diameter, material, spec);
            else SmartFlowRouter.routeBetweenPorts(fromEquip, fromNozzle, toEquip, toNozzle, diameter, material, spec);
        } else { notifyWithVoice("Módulo Router no disponible.", true); }
        return true;
    }

    function parseTap(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'tap') return false;
        if (parts.length < 6 || parts[3] !== 'to') { notifyWithVoice("Uso: tap [Equipo] [Puerto] to [Línea] [Posición 0-1] [material X] [diameter X] [spec X] [orient (dx,dy,dz)]", true); return true; }
        const fromEquip = parts[1], fromNozzle = parts[2], toLine = parts[4];
        const pos = parseFloat(parts[5]);
        if (isNaN(pos) || pos < 0 || pos > 1) { notifyWithVoice("Posición debe ser 0-1", true); return true; }
        const namedParams = extractNamedParams(parts, 6);
        const branchOrientation = extractBranchOrientation(parts, 6);
        if (!_core) { notifyWithVoice("Core no inicializado", true); return true; }
        const fromObj = _core.findObjectByTag(fromEquip);
        if (!fromObj || !_core.getEquipos().includes(fromObj)) { notifyWithVoice('Equipo "' + fromEquip + '" no encontrado', true); return true; }
        const nzFrom = fromObj.puertos && fromObj.puertos.find(n => n.id === fromNozzle);
        if (!nzFrom) { notifyWithVoice('Puerto "' + fromNozzle + '" no encontrado', true); return true; }
        const toObj = _core.findObjectByTag(toLine);
        if (!toObj || !_core.getLines().includes(toObj) || !getPoints(toObj).length) { notifyWithVoice('Línea "' + toLine + '" no encontrada', true); return true; }
        const resolved = resolveMaterialAndSpec(namedParams, [fromObj, toObj], null, { inheritFromConnected: false });
        let diameter = namedParams.diameter || toObj.diameter || 4, material = resolved.material, spec = resolved.spec;
        for (let i = 6; i < parts.length; i++) {
            if (parts[i] === 'diameter' || parts[i] === 'diametro') diameter = parseFloat(parts[++i]);
            else if (parts[i] === 'material') material = parts[++i].toUpperCase();
            else if (parts[i] === 'spec') spec = parts[++i];
        }
        let startPos = null;
        if (typeof SmartFlowRouter !== 'undefined' && SmartFlowRouter.getPortPosition) startPos = SmartFlowRouter.getPortPosition(fromObj, fromNozzle);
        else startPos = { x: (fromObj.posX||0) + (nzFrom.relX||0), y: (fromObj.posY||0) + (nzFrom.relY||0), z: (fromObj.posZ||0) + (nzFrom.relZ||0) };
        if (!startPos) { notifyWithVoice("No se pudo obtener posición origen", true); return true; }
        if (typeof SmartFlowRouter === 'undefined' || typeof SmartFlowRouter.insertarAccesorioEnLinea !== 'function') { notifyWithVoice("Router no disponible", true); return true; }
        const resultado = calcularPuntoParametrico(toObj, pos);
        if (!resultado) { notifyWithVoice("No se pudo calcular punto de conexión", true); return true; }
        const puntoConexion = { x: resultado.x, y: resultado.y, z: resultado.z };
        const tapBranchDir = branchOrientation || calculateBranchDirection(puntoConexion, startPos);
        const puertoId = SmartFlowRouter.insertarAccesorioEnLinea(toLine, puntoConexion, diameter, true, tapBranchDir);
        if (!puertoId) { notifyWithVoice("No se pudo insertar el accesorio", true); return true; }
        const db = _core.getDb();
        let newTag, counter = 1;
        const existingTags = new Set(db.lines.map(l => l.tag));
        do { newTag = 'L-' + counter; counter++; } while (existingTags.has(newTag) && counter < 10000);
        const nuevaLinea = { tag: newTag, diameter: diameter, material: material, spec: spec, origin: { objType: 'equipment', equipTag: fromEquip, portId: fromNozzle }, destination: { objType: 'line', equipTag: toLine, portId: puertoId }, waypoints: [], _cachedPoints: [startPos, puntoConexion], components: [] };
        _core.addLine(nuevaLinea);
        const lineaRegistrada = db.lines.find(l => l.tag === newTag) || nuevaLinea;
        const fittingInfo = runFittingInjection(lineaRegistrada, fromObj, fromNozzle, toObj, puertoId, diameter, material, spec);
        if (_core.updateLine) _core.updateLine(newTag, lineaRegistrada);
        if (_core.setSelected) _core.setSelected({ type: 'line', obj: lineaRegistrada });
        nzFrom.connectedLine = newTag;
        const toObjUpd = _core.findObjectByTag(toLine);
        if (toObjUpd && toObjUpd.puertos) { const p = toObjUpd.puertos.find(p => p.id === puertoId); if (p) p.connectedLine = newTag; }
        notifyWithVoice("✅ Derivación: " + newTag + " (" + fromEquip + "." + fromNozzle + " → " + toLine + " @" + pos.toFixed(2) + ") | " + material + " " + diameter + "\" " + spec + (fittingInfo.message || ''), false);
        return true;
    }

    function parseDelete(cmd) {
        const parts = cmd.split(/\s+/);
        if (parts[0] !== 'delete' && parts[0] !== 'eliminar') return false;
        const type = parts[1] ? parts[1].toLowerCase() : null;
        const tag = parts[2];
        if (!type || !tag) { notifyWithVoice("❌ Uso: delete equipment [TAG] | delete line [TAG]", true); return true; }
        if (!_core) { notifyWithVoice("Core no inicializado", true); return true; }
        saveStateBeforeMutation();
        if (type === 'equipment' || type === 'equipo' || type === 'eq') {
            if (_core.removeEquipment) { _core.removeEquipment(tag); if (_renderUI) _renderUI(); }
            else {
                const db = _core.getDb();
                const equipo = _core.findObjectByTag(tag);
                if (!equipo || !_core.getEquipos().includes(equipo)) { notifyWithVoice("❌ Equipo \"" + tag + "\" no encontrado", true); return true; }
                const lineasConectadas = db.lines.filter(line => (line.origin && (line.origin.equipTag === tag || line.origin.objTag === tag)) || (line.destination && (line.destination.equipTag === tag || line.destination.objTag === tag)));
                lineasConectadas.forEach(linea => {
                    let otroExtremo = null;
                    if (linea.origin && (linea.origin.equipTag === tag || linea.origin.objTag === tag)) otroExtremo = linea.destination;
                    else if (linea.destination) otroExtremo = linea.origin;
                    if (otroExtremo && (otroExtremo.equipTag || otroExtremo.objTag)) {
                        let otroTag = otroExtremo.equipTag || otroExtremo.objTag;
                        let otroObj = _core.findObjectByTag(otroTag);
                        if (otroObj && otroObj.puertos) {
                            let puerto = otroObj.puertos.find(p => p.id === otroExtremo.portId);
                            if (puerto) { puerto.status = 'open'; puerto.flow = 'bi'; delete puerto.connectedTo; delete puerto.connectedLine; }
                        }
                    }
                });
                db.lines = db.lines.filter(line => lineasConectadas.indexOf(line) === -1);
                db.equipos = db.equipos.filter(e => e.tag !== tag);
                if (_core.rebuildIndexes) _core.rebuildIndexes();
                if (_core.syncPhysicalData) _core.syncPhysicalData();
                if (_renderUI) _renderUI();
                notifyWithVoice("✅ Equipo \"" + tag + "\" eliminado" + (lineasConectadas.length > 0 ? " + " + lineasConectadas.length + " línea(s)" : ""), false);
            }
            return true;
        }
        if (type === 'line' || type === 'línea' || type === 'linea' || type === 'pipe') {
            if (_core.removeLine) { _core.removeLine(tag); if (_renderUI) _renderUI(); }
            else {
                const db = _core.getDb();
                const linea = _core.findObjectByTag(tag);
                if (!linea || !_core.getLines().includes(linea)) { notifyWithVoice("❌ Línea \"" + tag + "\" no encontrada", true); return true; }
                if (linea.origin && (linea.origin.equipTag || linea.origin.objTag)) {
                    let origTag = linea.origin.equipTag || linea.origin.objTag;
                    let objOrigen = _core.findObjectByTag(origTag);
                    if (objOrigen && objOrigen.puertos) {
                        let puerto = objOrigen.puertos.find(p => p.id === linea.origin.portId);
                        if (puerto) { puerto.status = 'open'; puerto.flow = 'bi'; delete puerto.connectedTo; delete puerto.connectedLine; }
                    }
                }
                if (linea.destination && (linea.destination.equipTag || linea.destination.objTag)) {
                    let destTag = linea.destination.equipTag || linea.destination.objTag;
                    let objDestino = _core.findObjectByTag(destTag);
                    if (objDestino && objDestino.puertos) {
                        let puerto = objDestino.puertos.find(p => p.id === linea.destination.portId);
                        if (puerto) { puerto.status = 'open'; puerto.flow = 'bi'; delete puerto.connectedTo; delete puerto.connectedLine; }
                    }
                }
                db.lines = db.lines.filter(l => l.tag !== tag);
                if (_core.rebuildIndexes) _core.rebuildIndexes();
                if (_core.syncPhysicalData) _core.syncPhysicalData();
                if (_renderUI) _renderUI();
                notifyWithVoice("✅ Línea \"" + tag + "\" eliminada. Puertos liberados.", false);
            }
            return true;
        }
        const obj = _core.findObjectByTag(tag);
        if (!obj) { notifyWithVoice("❌ \"" + tag + "\" no encontrado", true); return true; }
        if (_core.getEquipos().includes(obj)) return parseDelete("delete equipment " + tag);
        else if (_core.getLines().includes(obj)) return parseDelete("delete line " + tag);
        notifyWithVoice("❌ No se pudo determinar el tipo de \"" + tag + "\". Use: delete equipment/line [TAG]", true);
        return true;
    }

    function parseSplit(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'split' && parts[0] !== 'dividir' && parts[0] !== 'romper') return false;
        const lineTag = parts[1];
        const coords = extractCoords(cmd);
        if (!lineTag || !coords) { notifyWithVoice("Uso: split [línea] at (x,y,z)", true); return true; }
        const type = extractValue(parts, ['type', 'tipo']) || 'TEE_EQUAL';
        saveStateBeforeMutation();
        const result = _core.splitLine(lineTag, coords, { type: type });
        if (result) { if (_core.setSelected) _core.setSelected({ type: 'COMPONENTE', obj: result.componente, parent: result.linea }); notifyWithVoice("✅ Línea " + lineTag + " dividida con " + type, false); }
        else { notifyWithVoice("Error: Punto fuera de la línea " + lineTag, true); }
        return true;
    }

    function parseMoveCommand(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'move' && parts[0] !== 'mover') return false;
        const tag = parts[1];
        if (!tag) { notifyWithVoice("Uso: move TAG to (x,y,z) | move TAG by (dx,dy,dz)", true); return true; }
        if (!_core) { notifyWithVoice("Core no inicializado", true); return true; }
        const obj = _core.findObjectByTag(tag);
        if (!obj) { notifyWithVoice(tag + " no encontrado", true); return true; }
        const mode = parts[2] ? parts[2].toLowerCase() : null;
        let coordStr = '';
        for (let i = 3; i < parts.length; i++) { coordStr += parts[i]; if (parts[i].includes(')')) break; }
        const m = coordStr.match(/\((-?\d+\.?\d*),(-?\d+\.?\d*),(-?\d+\.?\d*)\)/);
        if (!m) { notifyWithVoice("Formato: (x,y,z)", true); return true; }
        const vx = parseFloat(m[1]), vy = parseFloat(m[2]), vz = parseFloat(m[3]);
        saveStateBeforeMutation();
        if (obj.posX !== undefined) {
            if (mode === 'by' || mode === 'por') _core.updateEquipment(tag, { posX: (obj.posX || 0) + vx, posY: (obj.posY || 0) + vy, posZ: (obj.posZ || 0) + vz });
            else _core.updateEquipment(tag, { posX: vx, posY: vy, posZ: vz });
            notifyWithVoice("✅ " + tag + " movido a (" + vx + "," + vy + "," + vz + ")", false);
        } else {
            const pts = getPoints(obj);
            if (pts.length > 0) {
                let newPts;
                if (mode === 'by' || mode === 'por') newPts = pts.map(p => ({ x: p.x + vx, y: p.y + vy, z: p.z + vz }));
                else { const base = pts[0]; const dx = vx - base.x, dy = vy - base.y, dz = vz - base.z; newPts = pts.map(p => ({ x: p.x + dx, y: p.y + dy, z: p.z + dz })); }
                _core.updateLine(tag, { _cachedPoints: newPts });
                notifyWithVoice("✅ " + tag + " desplazado", false);
            }
        }
        if (_renderUI) _renderUI();
        return true;
    }

    function parseEditCommand(cmd) {
        const parts = cmd.split(/\s+/);
        if (parts[0] !== 'edit' && parts[0] !== 'editar') return false;
        saveStateBeforeMutation();
        if (parts[1] === 'equipment' || parts[1] === 'equipo') {
            const tag = parts[2], action = parts[3];
            if (action === 'move' || action === 'mover') {
                let coordStr = '';
                for (let i = 4; i < parts.length; i++) { coordStr += parts[i]; if (parts[i].includes(')')) break; }
                const m = coordStr.match(/\((-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\)/);
                if (m) { const x = parseFloat(m[1]), y = parseFloat(m[2]), z = parseFloat(m[3]); _core.updateEquipment(tag, { posX: x, posY: y, posZ: z }); notifyWithVoice("✅ Equipo " + tag + " movido a (" + x + "," + y + "," + z + ")", false); return true; }
            } else if (action === 'set' || action === 'establecer') {
                if (parts[4] === 'puerto') {
                    const puertoId = parts[5], subParam = parts[6];
                    if (subParam === 'diam' || subParam === 'diametro') { const nuevoDiam = parseFloat(parts[7]); if (!isNaN(nuevoDiam)) { _core.updatePuerto(tag, puertoId, { diametro: nuevoDiam }); notifyWithVoice("✅ Puerto " + puertoId + " diámetro " + nuevoDiam + "\"", false); return true; } }
                    else if (subParam === 'pos' || subParam === 'posicion') { let cs = ''; for (let i = 7; i < parts.length; i++) { cs += parts[i]; if (parts[i].includes(')')) break; } const m = cs.match(/\((-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\)/); if (m) { _core.updatePuerto(tag, puertoId, { pos: { x: parseFloat(m[1]), y: parseFloat(m[2]), z: parseFloat(m[3]) } }); notifyWithVoice("✅ Puerto " + puertoId + " posición actualizada", false); return true; } }
                    else if (subParam === 'dir' || subParam === 'direccion') { let cs = ''; for (let i = 7; i < parts.length; i++) { cs += parts[i]; if (parts[i].includes(')')) break; } const m = cs.match(/\((-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\)/); if (m) { _core.updatePuerto(tag, puertoId, { dir: { dx: parseFloat(m[1]), dy: parseFloat(m[2]), dz: parseFloat(m[3]) } }); notifyWithVoice("✅ Puerto " + puertoId + " dirección actualizada", false); return true; } }
                }
            }
        } else if (parts[1] === 'line' || parts[1] === 'línea') {
            const tag = parts[2], action = parts[3];
            if (action === 'set' || action === 'establecer') {
                const property = parts[4], value = parts[5];
                if (property === 'material') { _core.updateLine(tag, { material: value.toUpperCase() }); notifyWithVoice("✅ Línea " + tag + " material " + value.toUpperCase(), false); return true; }
                else if (property === 'diameter' || property === 'diametro') { const val = parseFloat(value); if (!isNaN(val)) { _core.updateLine(tag, { diameter: val }); notifyWithVoice("✅ Línea " + tag + " diámetro " + val + "\"", false); return true; } }
                else if (property === 'spec') { _core.updateLine(tag, { spec: value }); notifyWithVoice("✅ Línea " + tag + " spec " + value, false); return true; }
            } else if ((action === 'add' || action === 'añadir') && (parts[4] === 'component' || parts[4] === 'componente')) {
                const compType = parts[5];
                let position = 0.5;
                const atIdx = parts.indexOf('at') !== -1 ? parts.indexOf('at') : parts.indexOf('en');
                if (atIdx !== -1) position = parseFloat(parts[atIdx + 1]);
                const branchOrientation = extractBranchOrientation(parts, atIdx + 2);
                const line = _core.findObjectByTag(tag);
                if (line && _core.getLines().includes(line)) {
                    const compDef = _catalog.getComponent(compType);
                    if (!compDef) { notifyWithVoice("Componente desconocido: " + compType, true); return true; }
                    const comp = { type: compDef.tipo || compType, tag: compType + "-" + Date.now().toString().slice(-6), param: position };
                    if (!line.components) line.components = [];
                    const existe = line.components.some(c => c.type === comp.type && Math.abs((c.param || 0) - position) < 0.02);
                    if (existe) { notifyWithVoice("⚠️ Ya existe un componente similar en esa posición", false); return true; }
                    line.components.push(comp);
                    if (compDef.generarPuertos) {
                        const nuevosPuertos = compDef.generarPuertos(line, position, line.diameter, branchOrientation);
                        if (!line.puertos) line.puertos = [];
                        nuevosPuertos.forEach((p, idx) => { p.id = comp.tag + "_" + idx; if (branchOrientation && (p.id.includes('BRANCH') || p.label === 'Derivación' || idx === 2)) { p.orientacion = branchOrientation; p.dir = branchOrientation; p.vector = branchOrientation; } line.puertos.push(p); });
                    }
                    _core.updateLine(tag, { components: line.components, puertos: line.puertos });
                    notifyWithVoice("✅ " + (compDef.nombre || compType) + " añadido a " + tag + " en posición " + position.toFixed(2) + (branchOrientation ? " con orientación personalizada" : ""), false);
                    return true;
                }
            }
        }
        return false;
    }

    function parseInfo(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'info') return false;
        if (parts.length < 2) { notifyWithVoice("Uso: info line [TAG] | info equipment [TAG] | info component [TAG]", true); return true; }
        const type = parts[1].toLowerCase();
        const tag = parts[2];
        if (!tag) { notifyWithVoice("Especifique el tag del " + type, true); return true; }
        if (type === 'line' || type === 'línea' || type === 'linea') return infoLine(tag);
        if (type === 'equipment' || type === 'equipo') return infoEquipment(tag);
        if (type === 'component' || type === 'componente') return infoComponent(tag);
        notifyWithVoice("Tipo desconocido: " + type + ". Use line, equipment o component", true);
        return true;
    }

    function infoLine(tag) {
        if (!_core) { notifyWithVoice("Error: Core no inicializado", true); return true; }
        const line = _core.findObjectByTag(tag);
        if (!line || !_core.getLines().includes(line)) { notifyWithVoice("Línea " + tag + " no encontrada", true); return true; }
        const pts = getPoints(line);
        let totalLen = 0;
        for (let i = 0; i < pts.length - 1; i++) totalLen += Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y, pts[i+1].z - pts[i].z);
        let compInfo = '';
        if (line.components && line.components.length) {
            const sorted = line.components.slice().sort((a,b) => (a.param || 0) - (b.param || 0));
            compInfo = '\n🔩 Componentes (' + sorted.length + '):';
            sorted.forEach(c => compInfo += '\n   ' + (c.type || '?') + ' @' + (c.param ? c.param.toFixed(3) : '?') + ' [' + (c.tag || '') + ']');
        }
        const msg = "📋 Línea " + tag + " | ⌀" + (line.diameter || '?') + "\" | " + (line.material || 'N/D') + " | Spec: " + (line.spec || 'N/D') + " | Long: " + (totalLen/1000).toFixed(2) + "m | Componentes: " + (line.components ? line.components.length : 0) + compInfo;
        notifyWithVoice(msg, false);
        return true;
    }

    function infoEquipment(tag) {
        if (!_core) { notifyWithVoice("Error: Core no inicializado", true); return true; }
        const eq = _core.findObjectByTag(tag);
        if (!eq || !_core.getEquipos().includes(eq)) { notifyWithVoice("Equipo " + tag + " no encontrado", true); return true; }
        const tipo = eq.tipo || 'Desconocido';
        const material = eq.material || 'N/D';
        const spec = eq.spec || 'N/D';
        const pos = getBasePosition(eq);
        const altura = eq.altura || 0;
        const diametro = eq.diametro || 0;
        const baseElevation = pos.y - (altura / 2);
        const topElevation = pos.y + (altura / 2);
        let msg = '═══════════════════════════════════\n📋 ' + tag + ' — ' + getEquipmentTypeName(tipo) + '\n═══════════════════════════════════\n\n';
        msg += '📐 DIMENSIONES:\n';
        if (diametro > 0) msg += '   Diámetro: ' + diametro.toFixed(0) + ' mm\n';
        if (altura > 0) msg += '   Altura: ' + altura.toFixed(0) + ' mm\n';
        msg += '\n📏 ELEVACIONES:\n   Centro: ' + pos.y.toFixed(0) + ' mm\n   Base: EL ' + (baseElevation/1000 >= 0 ? '+' : '') + (baseElevation/1000).toFixed(3) + ' m\n   Tope: EL ' + (topElevation/1000 >= 0 ? '+' : '') + (topElevation/1000).toFixed(3) + ' m\n\n';
        msg += '🔩 ESPECIFICACIONES:\n   Material: ' + material + '\n   Spec: ' + spec + '\n\n';
        msg += '🔌 PUERTOS:\n';
        if (eq.puertos && eq.puertos.length) {
            eq.puertos.forEach(p => {
                const portElevation = pos.y + (p.relY || 0);
                const status = p.status === 'open' ? 'DISPONIBLE' : (p.connectedTo ? 'CONECTADO a ' + p.connectedTo.tag : 'CONECTADO');
                msg += '   ' + p.id + ': ⌀' + (p.diametro || '?') + '" | EL ' + (portElevation/1000 >= 0 ? '+' : '') + (portElevation/1000).toFixed(3) + 'm | ' + status + '\n';
            });
        } else msg += '   Sin puertos definidos\n';
        msg += '\n═══════════════════════════════════';
        notifyWithVoice(msg, false);
        return true;
    }

    function infoComponent(tag) {
        if (!_core) { notifyWithVoice("Error: Core no inicializado", true); return true; }
        let foundComp = null, foundLine = null;
        const lines = _core.getLines();
        for (let line of lines) {
            if (line.components) {
                const comp = line.components.find(c => c.tag === tag);
                if (comp) { foundComp = comp; foundLine = line; break; }
            }
        }
        if (!foundComp) { notifyWithVoice("Componente " + tag + " no encontrado", true); return true; }
        const msg = "📋 Componente " + tag + " | Tipo: " + foundComp.type + " | Línea: " + foundLine.tag + " | Posición: " + (foundComp.param ? foundComp.param.toFixed(2) : 'N/D');
        notifyWithVoice(msg, false);
        return true;
    }

    function getEquipmentTypeName(tipo) {
        const names = {
            'tanque_v': 'Tanque Vertical', 'tanque_h': 'Tanque Horizontal', 'bomba': 'Bomba Centrífuga', 'bomba_dosificacion': 'Bomba Dosificadora',
            'intercambiador': 'Intercambiador de Calor', 'condensador': 'Condensador', 'torre': 'Torre de Destilación', 'columna_fraccionadora': 'Columna Fraccionadora',
            'reactor': 'Reactor', 'reactor_encamisado': 'Reactor Encamisado', 'autoclave': 'Autoclave', 'caldera': 'Caldera',
            'compresor': 'Compresor', 'separador': 'Separador Bifásico', 'separador_trifasico': 'Separador Trifásico', 'plataforma': 'Plataforma Estructural',
            'antorcha': 'Antorcha (Flare)', 'filtro_prensa': 'Filtro Prensa', 'filtro_duplex': 'Filtro Dúplex', 'osmosis': 'Ósmosis Inversa',
            'centrifuga': 'Centrífuga', 'agitador': 'Agitador / Mezclador', 'molino': 'Molino', 'llenadora': 'Llenadora', 'skid_inyeccion': 'Skid Inyección Química'
        };
        return names[tipo] || tipo || 'Equipo';
    }

    function parseList(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'list' && parts[0] !== 'listar') return false;
        const sub = parts[1] ? parts[1].toLowerCase() : null;
        if (sub === 'equipos') { listEquipos(); return true; }
        if (sub === 'lineas' || sub === 'líneas') { listLineas(); return true; }
        if (sub === 'componentes') { const types = _catalog ? _catalog.listComponentTypes() : []; notifyWithVoice('🔩 Componentes: ' + types.sort().join(', '), false); return true; }
        if (sub === 'especificaciones') { const specs = _catalog ? _catalog.listSpecs() : []; notifyWithVoice('📋 Especificaciones: ' + specs.sort().join(', '), false); return true; }
        notifyWithVoice('Use: listar equipos | listar lineas | listar componentes | listar especificaciones');
        return true;
    }

    function listEquipos() { 
        const eqs = _core.getDb().equipos; 
        notifyWithVoice(eqs.length ? '📦 Equipos (' + eqs.length + '): ' + eqs.map(e => e.tag).join(', ') : 'No hay equipos'); 
    }
    
    function listLineas() { 
        const ls = _core.getDb().lines; 
        notifyWithVoice(ls.length ? '📏 Líneas (' + ls.length + '): ' + ls.map(l => l.tag + '(' + (l.diameter || '?') + '" ' + (l.material || '?') + ')').join(', ') : 'No hay líneas'); 
    }

    function parseNodes(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'nodes' && parts[0] !== 'nodos') return false;
        if (parts.length < 2) { notifyWithVoice('Uso: nodos TAG | nodos TAG free', true); return true; }
        const tag = parts[1];
        if (!_core) { notifyWithVoice("Error: Core no inicializado", true); return true; }
        const obj = _core.findObjectByTag(tag);
        if (!obj) { notifyWithVoice('❌ "' + tag + '" no encontrado', true); return true; }
        const isEquipment = obj.posX !== undefined || (obj.pos && obj.pos.x !== undefined);
        let msg = '═══════════════════════════════════\n🔌 NODOS DE ' + tag + '\n═══════════════════════════════════\n';
        if (isEquipment) {
            msg += 'Tipo: EQUIPO | Puertos: ' + (obj.puertos ? obj.puertos.length : 0) + '\n\n';
            let freeCount = 0, totalCount = 0;
            if (obj.puertos && obj.puertos.length) {
                obj.puertos.forEach(p => {
                    totalCount++;
                    const isFree = !p.connectedTo || p.status === 'open';
                    if (isFree) freeCount++;
                    const icon = isFree ? '🟢' : '🔴';
                    const posX = (obj.posX || 0) + (p.relX || 0);
                    const posY = (obj.posY || 0) + (p.relY || 0);
                    const posZ = (obj.posZ || 0) + (p.relZ || 0);
                    const fullName = tag + '.' + p.id;
                    msg += icon + ' ' + fullName + ': ⌀' + (p.diametro || '?') + '" | (' + posX.toFixed(0) + ', ' + posY.toFixed(0) + ', ' + posZ.toFixed(0) + ')';
                    if (isFree) msg += ' → DISPONIBLE';
                    else if (p.connectedTo) msg += ' → ' + (p.connectedTo.tag || 'Conectado');
                    msg += '\n';
                });
            } else msg += '⚠️ Sin puertos definidos\n';
            msg += '\n📊 Total: ' + totalCount + ' | 🟢 ' + freeCount + ' libres | 🔴 ' + (totalCount - freeCount) + ' conectados';
        } else {
            const pts = getPoints(obj);
            if (pts.length < 2) msg += '⚠️ Línea sin geometría\n';
            else {
                let totalLen = 0, lengths = [];
                for (let i = 0; i < pts.length - 1; i++) {
                    const d = Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y, pts[i+1].z - pts[i].z);
                    lengths.push(d); totalLen += d;
                }
                msg += 'Tipo: LÍNEA | Long: ' + (totalLen/1000).toFixed(2) + ' m | Componentes: ' + (obj.components ? obj.components.length : 0) + '\n\n';
                let freeCount = 0, totalCount = 0;
                totalCount++;
                const p0 = obj.puertos ? obj.puertos.find(p => p.id === '0') : null;
                const isFree0 = p0 ? (p0.status === 'open') : false;
                if (isFree0) freeCount++;
                const icon0 = isFree0 ? '🟢' : '🔴';
                msg += icon0 + ' ' + tag + '.0 (START): (' + pts[0].x.toFixed(0) + ', ' + pts[0].y.toFixed(0) + ', ' + pts[0].z.toFixed(0) + ')';
                if (isFree0) msg += ' → DISPONIBLE';
                else if (obj.origin) msg += ' → ' + (obj.origin.equipTag || '?') + ':' + (obj.origin.portId || '?');
                msg += '\n';
                if (obj.components && obj.puertos) {
                    const sortedComps = obj.components.slice().sort((a,b) => (a.param || 0) - (b.param || 0));
                    sortedComps.forEach(comp => {
                        const compType = (comp.type || '').toUpperCase();
                        const generaPuertos = compType.indexOf('TEE') !== -1 || compType.indexOf('CROSS') !== -1;
                        if (generaPuertos && obj.puertos) {
                            obj.puertos.forEach(p => {
                                if (p.id === '0' || p.id === '1') return;
                                if (p.id.indexOf('S1') !== -1 || p.id.indexOf('S2') !== -1) return;
                                totalCount++;
                                const isFree = !p.connectedTo || p.status === 'open';
                                if (isFree) freeCount++;
                                const icon = isFree ? '🟢' : '🔴';
                                const param = comp.param || 0.5;
                                const targetLen = totalLen * param;
                                let accum = 0, segIdx = 0, t = 0;
                                for (let j = 0; j < lengths.length; j++) {
                                    if (accum + lengths[j] >= targetLen || j === lengths.length - 1) { segIdx = j; t = (targetLen - accum) / (lengths[j] || 1); break; }
                                    accum += lengths[j];
                                }
                                const pA = pts[segIdx], pB = pts[segIdx + 1];
                                const portPoint = { x: pA.x + (pB.x - pA.x) * t + (p.relX || 0), y: pA.y + (pB.y - pA.y) * t + (p.relY || 0), z: pA.z + (pB.z - pA.z) * t + (p.relZ || 0) };
                                const fullName = tag + '.' + p.id;
                                msg += icon + ' ' + fullName + ' @' + (comp.param ? comp.param.toFixed(3) : '?') + ' | (' + portPoint.x.toFixed(0) + ', ' + portPoint.y.toFixed(0) + ', ' + portPoint.z.toFixed(0) + ')';
                                if (isFree) { msg += ' → DISPONIBLE'; if (p.diametro) msg += ' | ⌀' + p.diametro + '"'; }
                                else if (p.connectedTo) msg += ' → ' + (p.connectedTo.tag || 'Conectado');
                                msg += '\n';
                            });
                        }
                    });
                }
                totalCount++;
                const p1 = obj.puertos ? obj.puertos.find(p => p.id === '1') : null;
                const isFree1 = p1 ? (p1.status === 'open') : false;
                if (isFree1) freeCount++;
                const lastIdx = pts.length - 1;
                const icon1 = isFree1 ? '🟢' : '🔴';
                msg += icon1 + ' ' + tag + '.1 (END): (' + pts[lastIdx].x.toFixed(0) + ', ' + pts[lastIdx].y.toFixed(0) + ', ' + pts[lastIdx].z.toFixed(0) + ')';
                if (isFree1) msg += ' → DISPONIBLE';
                else if (obj.destination) msg += ' → ' + (obj.destination.equipTag || '?') + ':' + (obj.destination.portId || '?');
                msg += '\n';
                msg += '\n📊 Total: ' + totalCount + ' | 🟢 ' + freeCount + ' libres | 🔴 ' + (totalCount - freeCount) + ' conectados';
            }
        }
        msg += '\n═══════════════════════════════════';
        notifyWithVoice(msg, false);
        return true;
    }

    function parseBOM(cmd) { 
        const t = cmd.trim().toLowerCase(); 
        if (t === 'bom' || t === 'mto' || t === 'generate bom' || t === 'generar bom') { generateBOM(); return true; } 
        return false; 
    }
    
    function generateBOM() {
        if (typeof SmartFlowIO !== 'undefined' && SmartFlowIO.downloadMTO) { SmartFlowIO.downloadMTO(); return; }
        if (!_core) { notifyWithVoice("Error: Core no inicializado", true); return; }
        const db = _core.getDb(); const lines = db.lines || []; const equipos = db.equipos || []; let items = [];
        equipos.forEach(eq => { if (eq.tipo !== 'colector') items.push({ tipo: 'EQUIPO', tag: eq.tag, descripcion: (eq.tipo || 'Equipo') + ' ' + (eq.material || ''), cantidad: 1, unidad: 'Und' }); });
        const pipeMap = new Map();
        lines.forEach(line => {
            const pts = getPoints(line); if (!pts || pts.length < 2) return;
            let length = 0; for (let i = 0; i < pts.length - 1; i++) length += Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y, pts[i+1].z - pts[i].z);
            const lengthM = length / 1000; const key = (line.diameter || '?') + '"-' + (line.material || 'PPR') + '-' + (line.spec || 'STD');
            if (pipeMap.has(key)) pipeMap.get(key).length += lengthM;
            else pipeMap.set(key, { diametro: line.diameter, material: line.material || 'PPR', spec: line.spec || 'STD', length: lengthM });
        });
        pipeMap.forEach(data => items.push({ tipo: 'TUBERIA', tag: '', descripcion: 'Tubo ' + data.material + ' ' + data.diametro + '" ' + data.spec, cantidad: data.length.toFixed(2), unidad: 'm' }));
        const compMap = new Map();
        lines.forEach(line => { if (line.components) line.components.forEach(comp => { const key = (comp.type || '?') + '-' + (line.diameter || '?') + '"'; compMap.set(key, (compMap.get(key) || 0) + 1); }); });
        compMap.forEach((count, key) => { const parts = key.split('-'); items.push({ tipo: 'COMPONENTE', tag: '', descripcion: parts[0] + ' ' + parts[1], cantidad: count, unidad: 'Und' }); });
        let csv = 'Tipo,Tag,Descripción,Cantidad,Unidad\n';
        items.forEach(item => csv += item.tipo + ',' + item.tag + ',' + item.descripcion + ',' + item.cantidad + ',' + item.unidad + '\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = 'BOM_' + (window.currentProjectName || 'Proyecto') + '_' + Date.now() + '.csv'; a.click();
        notifyWithVoice('✅ BOM generado con ' + items.length + ' líneas.', false);
    }

    function parseAudit(cmd) { 
        const t = cmd.trim().toLowerCase(); 
        if (t === 'audit' || t === 'auditar') { if (_core && _core.auditModel) _core.auditModel(); else notifyWithVoice("Auditoría no disponible.", true); return true; } 
        return false; 
    }

    function parseSetProject(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'set' || parts[1] !== 'project') return false;
        if (parts[2] === 'defaults' || parts[2] === 'default') {
            notifyWithVoice("📐 Defaults del proyecto: Material=" + _projectDefaults.material + " | Spec=" + _projectDefaults.spec + "\nPara cambiar: set project material <MATERIAL> spec <SPEC>", false);
            return true;
        }
        let material = null, spec = null;
        for (let i = 2; i < parts.length; i++) {
            if (parts[i] === 'material' && i + 1 < parts.length) material = parts[++i].toUpperCase();
            else if (parts[i] === 'spec' && i + 1 < parts.length) spec = parts[++i];
        }
        if (material || spec) setProjectDefaults(material, spec);
        else notifyWithVoice("Uso: set project material <MATERIAL> spec <SPEC>", true);
        return true;
    }

    // ================================================================
    //  COMANDOS ADICIONALES (line from/to, extend, optimize, reroute)
    // ================================================================
    
    function parseLineFromTo(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'line' && parts[0] !== 'linea') return false;
        const tag = parts[1];
        if (!tag) return false;
        const fromIdx = parts.indexOf('from') !== -1 ? parts.indexOf('from') : parts.indexOf('desde');
        const toIdx = parts.indexOf('to') !== -1 ? parts.indexOf('to') : parts.indexOf('a');
        if (fromIdx === -1 || toIdx === -1) return false;
        if (fromIdx >= toIdx) return false;
        const fromEquip = parts[fromIdx + 1], fromNozzle = parts[fromIdx + 2], toEquip = parts[toIdx + 1];
        let toNozzle = parts[toIdx + 2];
        const keywords = ['material', 'spec', 'diameter', 'diametro', 'via', 'route', 'ruta', 'mode', 'orient', 'direccion'];
        if (toNozzle && keywords.indexOf(toNozzle.toLowerCase()) !== -1) toNozzle = null;
        if (!fromEquip || !fromNozzle || !toEquip) { notifyWithVoice("❌ Uso: line TAG from EQUIPO PUERTO to EQUIPO [PUERTO]", true); return true; }
        const viaIdx = parts.indexOf('via');
        let waypoints = [];
        if (viaIdx !== -1 && viaIdx < toIdx) waypoints = extractWaypoints(parts, viaIdx + 1, toIdx);
        const paramStartIdx = toIdx + (toNozzle ? 3 : 2);
        const namedParams = extractNamedParams(parts, paramStartIdx);
        if (!_core) { notifyWithVoice("Core no inicializado", true); return true; }
        if (_core.findObjectByTag(tag)) { notifyWithVoice("❌ El tag " + tag + " ya existe", true); return true; }
        const fromObj = _core.findObjectByTag(fromEquip), toObj = _core.findObjectByTag(toEquip);
        if (!fromObj || !toObj) { notifyWithVoice("❌ Origen/Destino no encontrado", true); return true; }
        const resolved = resolveMaterialAndSpec(namedParams, [fromObj, toObj], null, { inheritFromConnected: false });
        let diameter = namedParams.diameter || 4, material = resolved.material, spec = resolved.spec;
        for (let i = paramStartIdx; i < parts.length; i++) {
            if (parts[i] === 'diameter' || parts[i] === 'diametro') diameter = parseFloat(parts[++i]);
            else if (parts[i] === 'material') material = parts[++i].toUpperCase();
            else if (parts[i] === 'spec') spec = parts[++i];
        }
        if (!toNozzle) {
            const ptsTo = _core.getLinePoints(toObj) || toObj._cachedPoints;
            if (ptsTo && ptsTo.length >= 2) toNozzle = '';
            else if (toObj.puertos && toObj.puertos.length > 0) { const openPort = toObj.puertos.find(p => p.status === 'open'); toNozzle = openPort ? openPort.id : toObj.puertos[0].id; }
            else toNozzle = 'N1';
        }
        if (typeof SmartFlowRouter !== 'undefined') {
            let nuevaLinea;
            if (waypoints.length > 0) nuevaLinea = SmartFlowRouter.routeWithWaypoints(fromEquip, fromNozzle, toEquip, toNozzle, waypoints, diameter, material, spec);
            else nuevaLinea = SmartFlowRouter.routeBetweenPorts(fromEquip, fromNozzle, toEquip, toNozzle, diameter, material, spec);
            if (nuevaLinea && nuevaLinea.tag !== tag) {
                const oldTag = nuevaLinea.tag;
                _core.updateLine(oldTag, { tag: tag });
                if (_core.rebuildIndexes) _core.rebuildIndexes();
                if (fromObj && fromObj.puertos) { const pFrom = fromObj.puertos.find(p => p.id === fromNozzle); if (pFrom && pFrom.connectedLine === oldTag) pFrom.connectedLine = tag; }
                if (toObj && toObj.puertos) { const pTo = toObj.puertos.find(p => p.id === toNozzle); if (pTo && pTo.connectedLine === oldTag) pTo.connectedLine = tag; }
            }
            if (_core.setSelected) { const finalLine = _core.findObjectByTag(tag); if (finalLine) _core.setSelected({ type: 'line', obj: finalLine }); }
            if (_renderUI) _renderUI();
            notifyWithVoice("✅ Línea " + tag + ": " + fromEquip + ":" + fromNozzle + " → " + toEquip + ":" + (toNozzle || 'auto') + " | " + material + " " + diameter + "\" " + spec, false);
        } else { notifyWithVoice("Router no disponible", true); }
        return true;
    }

    function parseExtendLine(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'extend' || (parts[1] !== 'line' && parts[1] !== 'linea')) return false;
        const lineTag = parts[2];
        const toIdx = parts.indexOf('to') !== -1 ? parts.indexOf('to') : parts.indexOf('a');
        if (toIdx === -1) { notifyWithVoice("Uso: extend line TAG to EQUIPO PUERTO [via (x,y,z)...]", true); return true; }
        const targetTag = parts[toIdx + 1];
        let targetPort = parts[toIdx + 2];
        if (targetPort && ['via', 'material', 'spec', 'diameter'].indexOf(targetPort.toLowerCase()) !== -1) targetPort = null;
        if (!_core) { notifyWithVoice("Core no inicializado", true); return true; }
        const line = _core.findObjectByTag(lineTag);
        if (!line) { notifyWithVoice("❌ Línea " + lineTag + " no encontrada", true); return true; }
        const targetObj = _core.findObjectByTag(targetTag);
        if (!targetObj) { notifyWithVoice("❌ Destino " + targetTag + " no encontrado", true); return true; }
        const pts = _core.getLinePoints(line) || line._cachedPoints || line.points3D;
        if (!pts || pts.length < 2) { notifyWithVoice("❌ Línea sin geometría", true); return true; }
        const material = line.material || getProjectDefaultMaterial();
        const spec = line.spec || getProjectDefaultSpec(material);
        const diameter = line.diameter || 4;
        if (!targetPort && targetObj.puertos) { const openPort = targetObj.puertos.find(p => p.status === 'open'); targetPort = openPort ? openPort.id : targetObj.puertos[0].id; }
        if (!targetPort) targetPort = 'N1';
        let endPos = (typeof SmartFlowRouter !== 'undefined') ? SmartFlowRouter.getPortPosition(targetObj, targetPort) : getPortPosition(targetTag, targetPort);
        if (!endPos) { notifyWithVoice("❌ No se pudo obtener posición del destino", true); return true; }
        saveStateBeforeMutation();
        const newPoints = pts.slice();
        const viaIdx = parts.indexOf('via');
        if (viaIdx !== -1) { const wps = extractWaypoints(parts, viaIdx + 1, parts.length); for (let w of wps) newPoints.push({ x: w.x, y: w.y, z: w.z }); }
        newPoints.push({ x: endPos.x, y: endPos.y, z: endPos.z });
        _core.updateLine(lineTag, { _cachedPoints: newPoints, destination: { equipTag: targetTag, portId: targetPort } });
        if (typeof SmartFlowRouter !== 'undefined') { const updatedLine = _core.findObjectByTag(lineTag); if (updatedLine) SmartFlowRouter.ensureFittings(updatedLine, null, null, targetObj, targetPort, diameter, material, spec); }
        _core.syncPhysicalData();
        if (_renderUI) _renderUI();
        notifyWithVoice("✅ Línea " + lineTag + " extendida a " + targetTag + ":" + targetPort + " (+" + (newPoints.length - pts.length) + " punto(s))", false);
        return true;
    }

    function parseOptimizeRoute(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'optimize' || (parts[1] !== 'route' && parts[1] !== 'ruta')) return false;
        const lineTag = parts[2];
        if (!lineTag) { notifyWithVoice("Uso: optimize route TAG", true); return true; }
        if (!_core) { notifyWithVoice("Core no inicializado", true); return true; }
        const line = _core.findObjectByTag(lineTag);
        if (!line) { notifyWithVoice("❌ Línea " + lineTag + " no encontrada", true); return true; }
        const pts = _core.getLinePoints(line) || line._cachedPoints || line.points3D;
        if (!pts || pts.length < 3) { notifyWithVoice("✅ La línea ya está optimizada", true); return true; }
        const optimized = [pts[0]];
        let removedCount = 0;
        for (let i = 1; i < pts.length - 1; i++) {
            const prev = optimized[optimized.length - 1], curr = pts[i], next = pts[i + 1];
            const v1 = { x: curr.x - prev.x, y: curr.y - prev.y, z: curr.z - prev.z };
            const v2 = { x: next.x - curr.x, y: next.y - curr.y, z: next.z - curr.z };
            const len1 = Math.hypot(v1.x, v1.y, v1.z) || 1, len2 = Math.hypot(v2.x, v2.y, v2.z) || 1;
            const dot = (v1.x * v2.x + v1.y * v2.y + v1.z * v2.z) / (len1 * len2);
            const angle = Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI;
            if (angle > 5) optimized.push(curr); else removedCount++;
        }
        optimized.push(pts[pts.length - 1]);
        if (removedCount > 0) {
            saveStateBeforeMutation();
            _core.updateLine(lineTag, { _cachedPoints: optimized });
            _core.syncPhysicalData();
            if (_renderUI) _renderUI();
            notifyWithVoice("✅ Ruta optimizada: " + removedCount + " punto(s) eliminado(s) (" + pts.length + " → " + optimized.length + " puntos)");
        } else notifyWithVoice("✅ La ruta ya está optimizada.");
        return true;
    }

    function parseRerouteLine(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'reroute' || (parts[1] !== 'line' && parts[1] !== 'linea')) return false;
        const lineTag = parts[2];
        if (!lineTag) { notifyWithVoice("Uso: reroute line TAG [mode smart|orthogonal] [elevation N]", true); return true; }
        if (!_core) { notifyWithVoice("Core no inicializado", true); return true; }
        const line = _core.findObjectByTag(lineTag);
        if (!line) { notifyWithVoice("❌ Línea " + lineTag + " no encontrada", true); return true; }
        let mode = 'smart', elevation = null;
        for (let i = 3; i < parts.length; i++) {
            if (parts[i] === 'mode') mode = (parts[++i] || 'smart').toLowerCase();
            else if (parts[i] === 'elevation' || parts[i] === 'elevacion') elevation = parseFloat(parts[++i]);
        }
        const origin = line.origin, destination = line.destination;
        if (!origin || !destination) { notifyWithVoice("❌ La línea debe tener origen y destino definidos", true); return true; }
        const material = line.material || getProjectDefaultMaterial();
        const spec = line.spec || getProjectDefaultSpec(material);
        const diameter = line.diameter || 4;
        saveStateBeforeMutation();
        if (typeof SmartFlowRouter !== 'undefined') {
            const fromTag = origin.equipTag || origin.objTag, fromPort = origin.portId;
            const toTag = destination.equipTag || destination.objTag, toPort = destination.portId;
            _core.removeLine(lineTag);
            let nuevaLinea;
            if (elevation !== null) {
                const pts = _core.getLinePoints(line) || line._cachedPoints || [];
                const startPoint = pts[0] || { x: 0, y: 0, z: 0 };
                const endPoint = pts[pts.length - 1] || { x: 0, y: 0, z: 0 };
                const midPoint = { x: (startPoint.x + endPoint.x) / 2, y: elevation, z: (startPoint.z + endPoint.z) / 2 };
                nuevaLinea = SmartFlowRouter.routeWithWaypoints(fromTag, fromPort, toTag, toPort, [midPoint], diameter, material, spec);
            } else nuevaLinea = SmartFlowRouter.routeBetweenPorts(fromTag, fromPort, toTag, toPort, diameter, material, spec);
            if (nuevaLinea) { const oldTag = nuevaLinea.tag; _core.updateLine(oldTag, { tag: lineTag }); if (_core.rebuildIndexes) _core.rebuildIndexes(); }
            notifyWithVoice("✅ Línea " + lineTag + " re-enrutada (modo: " + mode + (elevation ? ", elevación: " + elevation + "mm" : "") + ")", false);
        } else notifyWithVoice("Router no disponible", true);
        if (_renderUI) _renderUI();
        return true;
    }

    // ================================================================
    //  HELP (incluye nuevos comandos)
    // ================================================================
    
    function parseHelp(cmd) {
        const lower = cmd.toLowerCase();
        if (lower !== 'help' && lower !== 'ayuda') return false;
        let ayuda = "═══════════════════════════════════════════════════════════\n";
        ayuda += "              SMARTFLOW PRO v4.0 - COMANDOS\n";
        ayuda += "═══════════════════════════════════════════════════════════\n\n";
        ayuda += "📊 DIAGRAMA DE FLUJO (PFD):\n";
        ayuda += "  create equipo TIPO TAG                  ← Crea equipo lógico\n";
        ayuda += "  create stream TAG from EQUIPO to EQUIPO fluid X flow Y\n";
        ayuda += "  info stream TAG | list streams [FILTRO]\n";
        ayuda += "  link stream TAG to LINEA               ← Vincular PFD→3D\n";
        ayuda += "  balance masa EQUIPO                    ← Balance de masa\n\n";
        ayuda += "🔧 DIAGRAMA TUBERÍA E INSTRUMENTACIÓN (DTI):\n";
        ayuda += "  create instrument TAG type TIPO on LINEA at POS range RANGO\n";
        ayuda += "  create loop TAG sensor X controller Y valve Z type TIPO\n";
        ayuda += "  info instrument TAG | list instruments [FILTRO]\n";
        ayuda += "  list loops | list instrument types\n\n";
        ayuda += "🧊 ISOMÉTRICO 3D:\n";
        ayuda += "  create [tipo] [tag] at (x,y,z) [diam X] [height X]\n";
        ayuda += "  connect [origen] [puerto] to [destino] [puerto] [diameter X]\n";
        ayuda += "  route from [origen] [puerto] via (x,y,z)... to [destino]\n";
        ayuda += "  tap [origen] [puerto] to [linea] [0.0-1.0]\n";
        ayuda += "  accessories [linea] add TIPO@pos | auto TIPO... at POS\n\n";
        ayuda += "🔍 VALIDACIÓN:\n";
        ayuda += "  validate all / validar proyecto         ← Validación completa\n";
        ayuda += "  validate pfd | validate dti             ← Validar por módulo\n";
        ayuda += "  project summary / resumen proyecto      ← Resumen rápido\n";
        ayuda += "  autofix                                  ← Auto-corregir\n\n";
        ayuda += "📁 EXPORTACIÓN:\n";
        ayuda += "  export pcf | export mto | export json | export db\n";
        ayuda += "  import pcf | import json\n\n";
        ayuda += "⚙️ GENERAL:\n";
        ayuda += "  set project material X spec Y | undo | redo | audit\n";
        ayuda += "  info line/equipment/component TAG | nodos TAG\n";
        ayuda += "  list equipos | list lineas | list streams\n";
        ayuda += "  macro save/run/list/delete NOMBRE\n";
        ayuda += "═══════════════════════════════════════════════════════════\n";
        notifyWithVoice(ayuda, false);
        return true;
    }

    // ================================================================
    //  EJECUCIÓN PRINCIPAL
    // ================================================================
    
    let _macros = new Map();
    window._commandHistory = window._commandHistory || [];

    function recordCommand(cmd) {
        if (cmd && !cmd.startsWith('//') && cmd.trim()) {
            window._commandHistory.push(cmd.trim());
            if (window._commandHistory.length > 200) window._commandHistory.shift();
        }
    }

    function executeCommand(cmd) {
        if (!cmd || cmd.startsWith('//')) return false;
        const normalized = normalizeCommand(cmd);
        const trimmed = normalized.trim();
        
        // Básicos
        if (trimmed === 'undo' || trimmed === 'deshacer') { if (_core) _core.undo(); recordCommand(cmd); return true; }
        if (trimmed === 'redo' || trimmed === 'rehacer') { if (_core) _core.redo(); recordCommand(cmd); return true; }
        
        // PFD
        if (parseCreateEquipoPFD(trimmed))   { recordCommand(cmd); return true; }
        if (parseCreateStream(trimmed))       { recordCommand(cmd); return true; }
        if (parseStreamInfo(trimmed))         { recordCommand(cmd); return true; }
        if (parseListStreams(trimmed))        { recordCommand(cmd); return true; }
        if (parseLinkStream(trimmed))         { recordCommand(cmd); return true; }
        if (parseBalance(trimmed))            { recordCommand(cmd); return true; }
        
        // DTI
        if (parseCreateInstrument(trimmed))   { recordCommand(cmd); return true; }
        if (parseCreateLoop(trimmed))         { recordCommand(cmd); return true; }
        if (parseInstrumentInfo(trimmed))     { recordCommand(cmd); return true; }
        if (parseListInstruments(trimmed))    { recordCommand(cmd); return true; }
        if (parseListLoops(trimmed))          { recordCommand(cmd); return true; }
        if (parseListInstrumentTypes(trimmed)){ recordCommand(cmd); return true; }
        
        // Integrity
        if (parseValidateAll(trimmed))        { recordCommand(cmd); return true; }
        if (parseValidatePFD(trimmed))        { recordCommand(cmd); return true; }
        if (parseValidateDTI(trimmed))        { recordCommand(cmd); return true; }
        if (parseProjectSummary(trimmed))     { recordCommand(cmd); return true; }
        if (parseAutoFix(trimmed))            { recordCommand(cmd); return true; }
        
        // Export/Import
        if (parseExportCommand(trimmed))      { recordCommand(cmd); return true; }
        if (parseImportCommand(trimmed))      { recordCommand(cmd); return true; }
        
        // Isométrico 3D
        if (parseLineFromTo(trimmed))         { recordCommand(cmd); return true; }
        if (parseExtendLine(trimmed))         { recordCommand(cmd); return true; }
        if (parseOptimizeRoute(trimmed))      { recordCommand(cmd); return true; }
        if (parseRerouteLine(trimmed))        { recordCommand(cmd); return true; }
        if (parseCreate(trimmed))             { recordCommand(cmd); return true; }
        if (parseCreateLine(trimmed))         { recordCommand(cmd); return true; }
        if (parseConnect(trimmed))            { recordCommand(cmd); return true; }
        if (parseRoute(trimmed))              { recordCommand(cmd); return true; }
        if (parseDelete(trimmed))             { recordCommand(cmd); return true; }
        if (parseTap(trimmed))                { recordCommand(cmd); return true; }
        if (parseSplit(trimmed))              { recordCommand(cmd); return true; }
        if (parseMoveCommand(trimmed))        { recordCommand(cmd); return true; }
        if (parseEditCommand(trimmed))        { recordCommand(cmd); return true; }
        if (parseInfo(trimmed))               { recordCommand(cmd); return true; }
        if (parseList(trimmed))               { recordCommand(cmd); return true; }
        if (parseNodes(trimmed))              { recordCommand(cmd); return true; }
        if (parseBOM(trimmed))                { recordCommand(cmd); return true; }
        if (parseAudit(trimmed))              { recordCommand(cmd); return true; }
        if (parseSetProject(trimmed))         { recordCommand(cmd); return true; }
        if (parseHelp(trimmed))               { recordCommand(cmd); return true; }
        
        return false;
    }

    function executeBatch(commandsText) {
        const lines = commandsText.split('\n');
        let executed = 0, failed = 0;
        for (let i = 0; i < lines.length; i++) {
            const trimmed = lines[i].trim();
            if (!trimmed || trimmed.startsWith('//')) continue;
            if (executeCommand(trimmed)) executed++;
            else { failed++; notifyWithVoice('No entendí: "' + trimmed.substring(0, 50) + '..."', true); }
        }
        if (executed + failed > 0) notifyWithVoice(executed + ' ejecutados, ' + failed + ' fallidos', failed > 0);
        return executed;
    }

    function init(coreInstance, catalogInstance, rendererInstance, notifyFn, renderFn, voiceFn) {
        _core = coreInstance;
        _catalog = catalogInstance;
        _renderer = rendererInstance;
        _notifyUI = notifyFn || _notifyUI;
        _renderUI = renderFn || _renderUI;
        _voiceFn = voiceFn || null;
    }

    // ================================================================
    //  API PÚBLICA
    // ================================================================
    return {
        init: init,
        executeCommand: executeCommand,
        executeBatch: executeBatch,
        getMacros: function() { return _macros; },
        getHistory: function() { return window._commandHistory || []; },
        clearHistory: function() { window._commandHistory = []; },
        setProjectDefaults: setProjectDefaults,
        getProjectDefaults: function() { return { material: _projectDefaults.material, spec: _projectDefaults.spec }; },
        IntentDictionary: IntentDictionary,
        notify: notifyWithVoice,
        runFittingInjection: runFittingInjection
    };
})();
