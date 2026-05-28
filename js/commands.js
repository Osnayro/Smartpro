
// ============================================================
// SMARTFLOW COMMANDS v2.5 - Intérprete de Comandos Unificado
// Archivo: js/commands.js
// ============================================================

const SmartFlowCommands = (function() {
    
    let _core = null;
    let _catalog = null;
    let _renderer = null;
    let _notifyUI = (msg, isErr) => console.log(msg);
    let _renderUI = () => {};
    let _voiceFn = null;

    const IntentDictionary = {
        'crear': 'create', 'nuevo': 'create', 'añadir': 'create', 'instalar': 'create', 'pon': 'create', 'crea': 'create',
        'create': 'create', 'add': 'create',
        'conectar': 'connect', 'unir': 'connect', 'enlazar': 'connect', 'link': 'connect', 'vincula': 'connect', 'junta': 'connect', 'une': 'connect',
        'connect': 'connect',
        'ruta': 'route', 'route': 'route',
        'eliminar': 'delete', 'borrar': 'delete', 'quitar': 'delete', 'suprimir': 'delete', 'quita': 'delete', 'elimina': 'delete', 'limpiar': 'delete',
        'delete': 'delete', 'remove': 'delete',
        'editar': 'edit', 'modificar': 'edit', 'cambiar': 'edit', 'ajustar': 'edit', 'cambia': 'edit',
        'edit': 'edit', 'set': 'edit', 'update': 'edit', 'mover': 'move', 'move': 'move',
        'establecer': 'edit', 'spec': 'edit', 'diametro': 'edit',
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
        'vista': 'view', 'view': 'view', 'zoom': 'view', 'camara': 'view', 'cámara': 'view',
        'apoyar': 'place', 'posar': 'place', 'place': 'place', 'poner': 'place', 'colocar': 'place'
    };

    function getIntent(word) {
        if (!word) return null;
        return IntentDictionary[word.toLowerCase()] || null;
    }

    function normalizeCommand(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts.length === 0) return cmd;
        const intent = getIntent(parts[0]);
        if (intent) { parts[0] = intent; return parts.join(' '); }
        return cmd;
    }

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

    function getPortDirectionLocal(obj, portId) {
        if (!obj) return { dx: 1, dy: 0, dz: 0 };
        if (typeof SmartFlowRouter !== 'undefined' && SmartFlowRouter.getPortDirection) {
            const d = SmartFlowRouter.getPortDirection(obj, portId);
            return { dx: d.x, dy: d.y, dz: d.z };
        }
        const puerto = obj.puertos ? obj.puertos.find(function(p) { return p.id === portId; }) : null;
        if (puerto) {
            const ori = puerto.orientacion || puerto.dir || puerto.normal;
            if (ori) return { dx: ori.x || ori.dx || 1, dy: ori.y || ori.dy || 0, dz: ori.z || ori.dz || 0 };
        }
        const pts = getPoints(obj);
        if (pts && pts.length >= 2) {
            let pA = pts[0], pB = pts[1];
            if (portId === '1' || portId === String(pts.length - 1)) { pA = pts[pts.length - 2]; pB = pts[pts.length - 1]; }
            const dx = pB.x - pA.x, dy = pB.y - pA.y, dz = pB.z - pA.z;
            const len = Math.hypot(dx, dy, dz) || 1;
            return { dx: dx/len, dy: dy/len, dz: dz/len };
        }
        return { dx: 1, dy: 0, dz: 0 };
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
        return { x: pA.x + (pB.x - pA.x) * t, y: pA.y + (pB.y - pA.y) * t, z: pA.z + (pB.z - pA.z) * t,
                 segIdx, t, totalLen, target };
    }

    function notifyWithVoice(message, isError) {
        isError = isError || false;
        if (typeof _notifyUI === 'function') _notifyUI(message, isError);
        const statusEl = document.getElementById('statusMsg');
        if (statusEl) {
            statusEl.innerText = message;
            statusEl.style.color = isError ? '#ef4444' : '#00f2ff';
        }
        if (typeof _voiceFn === 'function') { _voiceFn(message); }
    }

    function runFittingInjection(line, fromObj, fromPortId, toObj, toPortId, diameter, material) {
        if (typeof SmartFlowRouter !== 'undefined' && typeof SmartFlowRouter.ensureFittings === 'function') {
            return SmartFlowRouter.ensureFittings(line, fromObj, fromPortId, toObj, toPortId, diameter, material);
        }
        return { added: [], message: ' | ⚠️ Router no disponible para inyección' };
    }

    // ================================================================
    // COMANDOS ORIGINALES (SIN MODIFICAR)
    // ================================================================

    function parseCreate(cmd) {
        const parts = cmd.split(/\s+/);
        if (parts[0] !== 'create') return false;
        const tipo = parts[1]; const tag = parts[2];
        if (parts[3] !== 'at') return false;
        let coordStr = '';
        for (let i = 4; i < parts.length; i++) { coordStr += parts[i]; if (parts[i].includes(')')) break; }
        const coords = coordStr.match(/\((-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\)/);
        if (!coords) return false;
        const x = parseFloat(coords[1]), y = parseFloat(coords[2]), z = parseFloat(coords[3]);
        let params = {};
        for (let i = 5; i < parts.length; i++) {
            let key = parts[i];
            if (key === 'diam' || key === 'diametro') params.diametro = parseFloat(parts[++i]);
            else if (key === 'height' || key === 'altura') params.altura = parseFloat(parts[++i]);
            else if (key === 'largo') params.largo = parseFloat(parts[++i]);
            else if (key === 'material') params.material = parts[++i].toUpperCase();
            else if (key === 'spec') params.spec = parts[++i];
        }
        const equipoDef = _catalog.getEquipment(tipo);
        if (!equipoDef) { notifyWithVoice('Tipo de equipo desconocido: ' + tipo, true); return true; }
        const equipo = _catalog.createEquipment(tipo, tag, x, y, z, params);
        if (equipo) {
            _core.addEquipment(equipo);
            if (_core.setSelected) _core.setSelected({ type: 'equipment', obj: equipo });
            notifyWithVoice('Equipo ' + tag + ' (' + equipoDef.nombre + ') creado', false);
        }
        return true;
    }

    function parseCreateLine(cmd) {
        const parts = cmd.split(/\s+/);
        if (parts[0] !== 'create' || parts[1] !== 'line') return false;
        const tag = parts[2];
        let diameter = 4, material = 'PPR', spec = 'PPR_PN12_5', points = [], i = 3;
        while (i < parts.length) {
            if (parts[i] === 'diameter' || parts[i] === 'diametro') diameter = parseFloat(parts[++i]);
            else if (parts[i] === 'material') material = parts[++i].toUpperCase();
            else if (parts[i] === 'spec') spec = parts[++i];
            else if (parts[i] === 'route' || parts[i] === 'ruta') {
                i++;
                while (i < parts.length) {
                    const coordStr = parts[i];
                    const m = coordStr.match(/\((-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)\)/);
                    if (m) points.push({ x: parseFloat(m[1]), y: parseFloat(m[2]), z: parseFloat(m[3]) });
                    else break;
                    i++;
                }
                continue;
            }
            i++;
        }
        if (points.length < 2) { notifyWithVoice("Error: Se requieren al menos 2 puntos", true); return true; }
        const nuevaLinea = { tag, diameter, material, spec, _cachedPoints: points, waypoints: points.slice(1, -1), components: [] };
        _core.addLine(nuevaLinea);
        const db = _core.getDb();
        const lineaRegistrada = db.lines.find(function(l) { return l.tag === tag; }) || nuevaLinea;
        const fittingInfo = runFittingInjection(lineaRegistrada, null, null, null, null, diameter, material);
        if (_core.updateLine) { _core.updateLine(tag, lineaRegistrada); }
        if (_core.setSelected) _core.setSelected({ type: 'line', obj: lineaRegistrada });
        notifyWithVoice('Línea ' + tag + ' creada' + fittingInfo.message, false);
        return true;
    }

    function parseConnect(cmd) {
        const parts = cmd.split(/\s+/);
        if (parts[0] !== 'connect' && parts[0] !== 'conectar') return false;
        if (typeof SmartFlowRouter !== 'undefined') {
            SmartFlowRouter.routeBetweenPorts(parts[1], parts[2], parts[4], parts[5]);
        }
        return true;
    }

    function parseDelete(cmd) {
        const parts = cmd.split(/\s+/);
        if (parts[0] !== 'delete' && parts[0] !== 'eliminar') return false;
        const type = parts[1], tag = parts[2];
        if (type === 'equipment' || type === 'equipo') {
            const db = _core.getDb();
            const index = db.equipos.findIndex(function(e) { return e.tag === tag; });
            if (index === -1) { notifyWithVoice('Equipo ' + tag + ' no encontrado', true); return true; }
            db.equipos.splice(index, 1);
            notifyWithVoice('Equipo ' + tag + ' eliminado', false);
            return true;
        } else if (type === 'line' || type === 'línea') {
            const db = _core.getDb();
            const index = db.lines.findIndex(function(l) { return l.tag === tag; });
            if (index === -1) { notifyWithVoice('Línea ' + tag + ' no encontrada', true); return true; }
            db.lines.splice(index, 1);
            notifyWithVoice('Línea ' + tag + ' eliminada', false);
            return true;
        }
        return false;
    }

    function parseList(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'list' && parts[0] !== 'listar') return false;
        const sub = parts[1] ? parts[1].toLowerCase() : '';
        if (sub === 'equipos') { const eqs = _core.getDb().equipos; notifyWithVoice(eqs.length ? 'Equipos (' + eqs.length + '): ' + eqs.map(function(e){return e.tag}).join(', ') : 'No hay equipos'); return true; }
        if (sub === 'lineas' || sub === 'líneas') { const ls = _core.getDb().lines; notifyWithVoice(ls.length ? 'Líneas (' + ls.length + '): ' + ls.map(function(l){return l.tag + '(' + l.diameter + '" ' + (l.material||'?') + ')'}).join(', ') : 'No hay líneas'); return true; }
        return true;
    }

    function parseBOM(cmd) { const t = cmd.trim().toLowerCase(); if (t === 'bom' || t === 'mto') { generateBOM(); return true; } return false; }
    
    function generateBOM() {
        if (!_core) { notifyWithVoice("Error: Core no inicializado", true); return; }
        const db = _core.getDb(); const lines = db.lines || []; const equipos = db.equipos || []; let items = [];
        equipos.forEach(function(eq) { items.push({ tipo: 'EQUIPO', tag: eq.tag, descripcion: eq.tipo + ' ' + (eq.material || ''), cantidad: 1, unidad: 'Und' }); });
        const pipeMap = new Map();
        lines.forEach(function(line) {
            const pts = getPoints(line); if (!pts || pts.length < 2) return;
            let length = 0; for (let i = 0; i < pts.length - 1; i++) length += Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y, pts[i+1].z - pts[i].z);
            const lengthM = length / 1000; const key = line.diameter + '"-' + (line.material || 'PPR') + '-' + (line.spec || 'STD');
            if (pipeMap.has(key)) pipeMap.get(key).length += lengthM;
            else pipeMap.set(key, { diametro: line.diameter, material: line.material || 'PPR', spec: line.spec || 'STD', length: lengthM });
        });
        for (const [key, data] of pipeMap.entries()) items.push({ tipo: 'TUBERIA', tag: '', descripcion: 'Tubo ' + data.material + ' ' + data.diametro + '" ' + data.spec, cantidad: data.length.toFixed(2), unidad: 'm' });
        let csv = 'Tipo,Tag,Descripción,Cantidad,Unidad\n';
        items.forEach(function(item) { csv += item.tipo + ',' + item.tag + ',' + item.descripcion + ',' + item.cantidad + ',' + item.unidad + '\n'; });
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
        a.download = 'BOM_' + (window.currentProjectName || 'Proyecto') + '_' + Date.now() + '.csv'; a.click();
        notifyWithVoice('BOM generado con ' + items.length + ' líneas.', false);
    }

    function parseAudit(cmd) { const t = cmd.trim().toLowerCase(); if (t === 'audit' || t === 'auditar') { if (_core && _core.auditModel) _core.auditModel(); return true; } return false; }

    function parseHelp(cmd) {
        const lower = cmd.toLowerCase(); if (lower !== 'help' && lower !== 'ayuda') return false;
        let ayuda = "══════════════════════════════════════\n";
        ayuda += "       SMARTFLOW PRO - COMANDOS\n";
        ayuda += "══════════════════════════════════════\n\n";
        ayuda += "CREACIÓN:\n  create [tipo] [tag] at (x,y,z)\n  create line [tag] route (x,y,z)...\n\n";
        ayuda += "CONEXIÓN:\n  connect [origen] [puerto] to [destino] [puerto o 0-1]\n\n";
        ayuda += "INFO:\n  info line/equipment/component [TAG]\n  listar equipos | listar lineas\n  coordenadas de [TAG]\n  nodos [TAG]\n\n";
        ayuda += "OTROS: bom | audit | tap | split | undo | redo | help\n";
        ayuda += "══════════════════════════════════════\n";
        notifyWithVoice(ayuda, false); return true;
    }

    function parseTap(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'tap') return false;
        if (parts.length < 6 || parts[3] !== 'to') { notifyWithVoice("Uso: tap [Equipo] [Puerto] to [Línea] [Posición 0-1]", true); return true; }
        const fromEquip = parts[1], fromNozzle = parts[2], toLine = parts[4];
        const pos = parseFloat(parts[5]);
        if (isNaN(pos) || pos < 0 || pos > 1) { notifyWithVoice("Posición debe ser 0-1", true); return true; }
        let diameter = 4, material = 'PPR', spec = 'PPR_PN12_5';
        for (let i = 6; i < parts.length; i++) {
            if (parts[i] === 'diameter' || parts[i] === 'diametro') diameter = parseFloat(parts[++i]);
            else if (parts[i] === 'material') material = parts[++i].toUpperCase();
            else if (parts[i] === 'spec') spec = parts[++i];
        }
        if (!_core) { notifyWithVoice("Core no inicializado", true); return true; }
        const fromObj = _core.findObjectByTag(fromEquip);
        if (!fromObj || !_core.getEquipos().includes(fromObj)) { notifyWithVoice('Equipo "' + fromEquip + '" no encontrado', true); return true; }
        const nzFrom = fromObj.puertos ? fromObj.puertos.find(function(n) { return n.id === fromNozzle; }) : null;
        if (!nzFrom) { notifyWithVoice('Puerto "' + fromNozzle + '" no encontrado', true); return true; }
        let startPos = null;
        if (typeof SmartFlowRouter !== 'undefined' && SmartFlowRouter.getPortPosition) startPos = SmartFlowRouter.getPortPosition(fromObj, fromNozzle);
        else startPos = { x: (fromObj.posX||0) + (nzFrom.relX||0), y: (fromObj.posY||0) + (nzFrom.relY||0), z: (fromObj.posZ||0) + (nzFrom.relZ||0) };
        if (!startPos) { notifyWithVoice("No se pudo obtener posición origen", true); return true; }
        const toObj = _core.findObjectByTag(toLine);
        if (!toObj || !_core.getLines().includes(toObj) || !getPoints(toObj).length) { notifyWithVoice('Línea "' + toLine + '" no encontrada', true); return true; }
        if (typeof SmartFlowRouter === 'undefined' || typeof SmartFlowRouter.insertarAccesorioEnLinea !== 'function') { notifyWithVoice("Router no disponible", true); return true; }
        const resultado = calcularPuntoParametrico(toObj, pos);
        if (!resultado) { notifyWithVoice("No se pudo calcular punto de conexión", true); return true; }
        const puntoConexion = { x: resultado.x, y: resultado.y, z: resultado.z };
        const puertoId = SmartFlowRouter.insertarAccesorioEnLinea(toLine, puntoConexion, diameter, true);
        if (!puertoId) { notifyWithVoice("No se pudo insertar el accesorio", true); return true; }
        const newTag = 'L-' + ((_core.getDb().lines ? _core.getDb().lines.length : 0) + 1);
        const nuevaLinea = { 
            tag: newTag, diameter, material, spec, 
            origin: { objType: 'equipment', equipTag: fromEquip, portId: fromNozzle }, 
            destination: { objType: 'line', equipTag: toLine, portId: puertoId }, 
            waypoints: [], _cachedPoints: [startPos, puntoConexion], components: []
        };
        _core.addLine(nuevaLinea);
        const lineaRegistrada = _core.getDb().lines.find(function(l) { return l.tag === newTag; }) || nuevaLinea;
        const fittingInfo = runFittingInjection(lineaRegistrada, fromObj, fromNozzle, toObj, puertoId, diameter, material);
        if (_core.updateLine) { _core.updateLine(newTag, lineaRegistrada); }
        if (_core.setSelected) _core.setSelected({ type: 'line', obj: lineaRegistrada });
        nzFrom.connectedLine = newTag;
        const toObjUpd = _core.findObjectByTag(toLine);
        if (toObjUpd && toObjUpd.puertos) { const p = toObjUpd.puertos.find(function(p) { return p.id === puertoId; }); if (p) p.connectedLine = newTag; }
        notifyWithVoice('✅ Derivación: ' + newTag + ' (' + fromEquip + '.' + fromNozzle + ' → ' + toLine + ' @' + pos.toFixed(2) + ')' + fittingInfo.message, false);
        return true;
    }

    function parseSplit(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'split' && parts[0] !== 'dividir' && parts[0] !== 'romper') return false;
        const lineTag = parts[1];
        const coords = extractCoords(cmd);
        if (!lineTag || !coords) { notifyWithVoice("Uso: split [línea] at (x,y,z)", true); return true; }
        const type = extractValue(parts, ['type', 'tipo']) || 'TEE_EQUAL';
        const result = _core.splitLine(lineTag, coords, { type });
        if (result) {
            if (_core.setSelected) _core.setSelected({ type: 'COMPONENTE', obj: result.componente, parent: result.linea });
            notifyWithVoice('✅ Línea ' + lineTag + ' dividida con ' + type, false);
        } else {
            notifyWithVoice('Error: Punto fuera de la línea ' + lineTag, true);
        }
        return true;
    }

    function parsePoint(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'point' && parts[0] !== 'coordenadas') return false;
        try {
            let tag = null, subCommand = null, subId = null;
            if (parts.length >= 3 && parts[1] && parts[1].toLowerCase() === 'de') {
                tag = parts[2];
                if (parts.length >= 5) { subCommand = parts[3] ? parts[3].toLowerCase() : null; subId = parts[4]; }
            } else if (parts.length >= 2) {
                let ref = parts[1];
                const atIdx = ref.indexOf('@');
                if (atIdx > 0) {
                    tag = ref.substring(0, atIdx);
                    subId = ref.substring(atIdx + 1);
                    const numVal = parseFloat(subId);
                    if (!isNaN(numVal) && numVal >= 0 && numVal <= 1) subCommand = 'param';
                    else subCommand = 'puerto';
                } else { tag = ref; }
            }
            if (!tag || !_core) return false;
            const obj = _core.findObjectByTag(tag);
            if (!obj) { notifyWithVoice('❌ "' + tag + '" no encontrado', true); return true; }
            const basePos = getBasePosition(obj);
            let response = '📍 ' + tag + ' → (X=' + basePos.x.toFixed(0) + ', Y=' + basePos.y.toFixed(0) + ', Z=' + basePos.z.toFixed(0) + ')';
            if (subCommand === 'param' && subId) {
                const coords = calcularPuntoParametrico(obj, parseFloat(subId));
                if (coords) response += ' @' + subId + ': (' + coords.x.toFixed(0) + ',' + coords.y.toFixed(0) + ',' + coords.z.toFixed(0) + ')';
            }
            notifyWithVoice(response, false);
            return true;
        } catch (e) { notifyWithVoice('❌ Error: ' + e.message, true); return true; }
    }

    function parseNodes(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'nodes' && parts[0] !== 'nodos') return false;
        if (parts.length < 2) { notifyWithVoice('Uso: nodos TAG', true); return true; }
        if (!_core) return false;
        const obj = _core.findObjectByTag(parts[1]);
        if (!obj) { notifyWithVoice(parts[1] + ' no encontrado', true); return true; }
        let nodes = [];
        if (obj.posX !== undefined) {
            nodes = (obj.puertos || []).map(function(p) { return p.id + ' ⌀' + (p.diametro || '?') + '" ' + p.status; });
        } else {
            nodes = ['START (P0)', 'END (P' + (getPoints(obj).length - 1) + ')'];
        }
        notifyWithVoice('🔌 Nodos de ' + parts[1] + ': ' + nodes.join(' | '), false);
        return true;
    }

    function parseInfo(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'info') return false;
        if (parts.length < 2) { notifyWithVoice("Uso: info line [TAG] | info equipment [TAG]", true); return true; }
        const type = parts[1].toLowerCase();
        const tag = parts[2];
        if (!tag) { notifyWithVoice('Especifique el tag del ' + type, true); return true; }
        if (!_core) return false;
        const obj = _core.findObjectByTag(tag);
        if (!obj) { notifyWithVoice('"' + tag + '" no encontrado', true); return true; }
        if (type === 'line' || type === 'línea') {
            const pts = getPoints(obj);
            let totalLen = 0;
            for (let i = 0; i < pts.length - 1; i++) totalLen += Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y, pts[i+1].z - pts[i].z);
            notifyWithVoice('📋 Línea ' + tag + ' | ⌀' + (obj.diameter || '?') + '" | ' + (obj.material || 'N/D') + ' | Puntos: ' + pts.length + ' | Long: ' + (totalLen/1000).toFixed(2) + 'm', false);
        } else if (type === 'equipment' || type === 'equipo') {
            const pos = getBasePosition(obj);
            notifyWithVoice('📋 Equipo ' + tag + ' | Tipo: ' + (obj.tipo || 'Desconocido') + ' | Material: ' + (obj.material || 'N/D') + ' | Pos: (' + pos.x.toFixed(0) + ',' + pos.y.toFixed(0) + ',' + pos.z.toFixed(0) + ')', false);
        }
        return true;
    }

    function parseMoveCommand(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'move' && parts[0] !== 'mover') return false;
        if (!_core) return false;
        const tag = parts[1];
        if (!tag) { notifyWithVoice("Uso: move TAG to (x,y,z) | move TAG by (dx,dy,dz)", true); return true; }
        const obj = _core.findObjectByTag(tag);
        if (!obj) { notifyWithVoice(tag + " no encontrado", true); return true; }
        const mode = parts[2] ? parts[2].toLowerCase() : '';
        let coordStr = '';
        for (let i = 3; i < parts.length; i++) { coordStr += parts[i]; if (parts[i].includes(')')) break; }
        const m = coordStr.match(/\((-?\d+\.?\d*),(-?\d+\.?\d*),(-?\d+\.?\d*)\)/);
        if (!m) { notifyWithVoice("Formato: (x,y,z)", true); return true; }
        const vx = parseFloat(m[1]), vy = parseFloat(m[2]), vz = parseFloat(m[3]);
        if (obj.posX !== undefined) {
            if (mode === 'by' || mode === 'por') {
                _core.updateEquipment(tag, { posX: (obj.posX || 0) + vx, posY: (obj.posY || 0) + vy, posZ: (obj.posZ || 0) + vz });
            } else {
                _core.updateEquipment(tag, { posX: vx, posY: vy, posZ: vz });
            }
            notifyWithVoice('✅ ' + tag + ' movido', false);
        }
        return true;
    }

    // ================================================================
    // EJECUCIÓN PRINCIPAL
    // ================================================================

    function executeCommand(cmd) {
        if (!cmd || cmd.startsWith('//')) return false;
        const normalized = normalizeCommand(cmd);
        const trimmed = normalized.trim();
        
        if (trimmed === 'undo' || trimmed === 'deshacer') { if (_core) _core.undo(); return true; }
        if (trimmed === 'redo' || trimmed === 'rehacer') { if (_core) _core.redo(); return true; }
        
        if (parseCreateLine(trimmed)) return true;
        if (parseCreate(trimmed)) return true;
        if (parseConnect(trimmed)) return true;
        if (parseTap(trimmed)) return true;
        if (parseSplit(trimmed)) return true;
        if (parseMoveCommand(trimmed)) return true;
        if (parseDelete(trimmed)) return true;
        if (parsePoint(trimmed)) return true;
        if (parseNodes(trimmed)) return true;
        if (parseInfo(trimmed)) return true;
        if (parseList(trimmed)) return true;
        if (parseBOM(trimmed)) return true;
        if (parseAudit(trimmed)) return true;
        if (parseHelp(trimmed)) return true;
        
        return false;
    }

    function executeBatch(commandsText) {
        const lines = commandsText.split('\n');
        let executed = 0, failed = 0;
        for (let raw of lines) {
            const trimmed = raw.trim();
            if (!trimmed || trimmed.startsWith('//')) continue;
            if (executeCommand(trimmed)) executed++;
            else { failed++; notifyWithVoice('No entendí: "' + trimmed.substring(0, 50) + '..."', true); }
        }
        if (executed + failed > 0) notifyWithVoice(executed + ' comandos ejecutados, ' + failed + ' fallidos', failed > 0);
        return executed;
    }

    function init(coreInstance, catalogInstance, rendererInstance, notifyFn, renderFn, voiceFn) {
        _core = coreInstance;
        _catalog = catalogInstance;
        _renderer = rendererInstance;
        _notifyUI = notifyFn;
        _renderUI = renderFn;
        _voiceFn = voiceFn || null;
    }

    return {
        init: init,
        executeCommand: executeCommand,
        executeBatch: executeBatch
    };
})();
