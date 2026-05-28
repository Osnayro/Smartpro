
// ============================================================
// SMARTFLOW COMMANDS v3.0 - Intérprete de Comandos Unificado
// Archivo: js/commands.js
// Mejoras: Nuevo comando branch, notifyWithVoice usa servicios
// ============================================================

const SmartFlowCommands = (function() {
    
    let _core = null;
    let _catalog = null;
    let _renderer = null;
    let _notifyUI = (msg, isErr) => console.log(msg);
    let _renderUI = () => {};
    let _voiceFn = null;

    // ================================================================
    // DICCIONARIO DE INTENCIONES MULTILINGÜE
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
        'branch': 'branch', 'ramificar': 'branch', 'derivacion': 'branch',
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

    // ================================================================
    // UTILIDADES
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
            if (portId === '1' || portId === String(pts.length - 1)) {
                pA = pts[pts.length - 2]; pB = pts[pts.length - 1];
            }
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
                 segIdx: segIdx, t: t, totalLen: totalLen, target: target };
    }

    function notifyWithVoice(message, isError) {
        isError = isError || false;
        if (typeof _notifyUI === 'function') _notifyUI(message, isError);
        
        // Usar servicios unificados si están disponibles
        if (typeof NotificationService !== 'undefined') {
            NotificationService.notify(message, { isError: isError, voice: isError, statusBar: true });
        } else {
            const statusEl = document.getElementById('statusMsg');
            if (statusEl) {
                statusEl.innerText = message;
                statusEl.style.color = isError ? '#ef4444' : '#00f2ff';
            }
        }
        
        if (typeof _voiceFn === 'function') { _voiceFn(message); }
        else if (typeof VoiceService !== 'undefined') { VoiceService.speak(message); }
    }

    function saveStateBeforeMutation() {
        if (_core && _core._saveState) {
            _core._saveState();
        }
    }

    function getPortPosition(tag, portId) {
        const obj = _core ? _core.findObjectByTag(tag) : null;
        if (!obj) return { x: 0, y: 0, z: 0 };
        const base = getBasePosition(obj);
        const puerto = obj.puertos ? obj.puertos.find(function(p) { return p.id === portId; }) : null;
        if (puerto) {
            return {
                x: base.x + (puerto.relX || 0),
                y: base.y + (puerto.relY || 0),
                z: base.z + (puerto.relZ || 0)
            };
        }
        return base;
    }

    function getEquipmentTypeName(tipo) {
        const names = {
            'tanque_v': 'Tanque Vertical', 'tanque_h': 'Tanque Horizontal',
            'bomba': 'Bomba Centrífuga', 'bomba_dosificacion': 'Bomba Dosificadora',
            'intercambiador': 'Intercambiador de Calor', 'condensador': 'Condensador',
            'torre': 'Torre de Destilación', 'columna_fraccionadora': 'Columna Fraccionadora',
            'reactor': 'Reactor', 'reactor_encamisado': 'Reactor Encamisado',
            'caldera': 'Caldera', 'compresor': 'Compresor',
            'separador': 'Separador', 'clarificador': 'Clarificador',
            'plataforma': 'Plataforma Estructural'
        };
        return names[tipo] || tipo || 'Equipo';
    }

    function runFittingInjection(line, fromObj, fromPortId, toObj, toPortId, diameter, material) {
        if (typeof SmartFlowRouter !== 'undefined' && typeof SmartFlowRouter.ensureFittings === 'function') {
            return SmartFlowRouter.ensureFittings(line, fromObj, fromPortId, toObj, toPortId, diameter, material);
        }
        return { added: [], message: ' | ⚠️ Router no disponible para inyección' };
    }

    // ================================================================
    // NUEVO COMANDO: BRANCH
    // ================================================================
    function parseBranch(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'branch' && parts[0] !== 'ramificar' && parts[0] !== 'derivacion') return false;
        
        if (parts.length < 6 || parts[3] !== 'from' || parts[5] !== 'at') {
            notifyWithVoice('Uso: branch [origen] [puerto] from [línea] at [0.0-1.0] [diameter X] [material X] [spec X]', true);
            return true;
        }

        const fromEquip = parts[1];
        const fromPort = parts[2];
        const toLine = parts[4];
        const param = parseFloat(parts[6]);

        if (isNaN(param) || param < 0 || param > 1) {
            notifyWithVoice('Posición debe ser 0-1', true);
            return true;
        }

        let diameter = 4, material = 'PPR', spec = 'PPR_PN12_5';
        for (let i = 7; i < parts.length; i++) {
            if (parts[i] === 'diameter' || parts[i] === 'diametro') diameter = parseFloat(parts[++i]);
            else if (parts[i] === 'material') material = parts[++i].toUpperCase();
            else if (parts[i] === 'spec') spec = parts[++i];
        }

        return parseBranchInternal(fromEquip, fromPort, toLine, param, diameter, material, spec);
    }

    function parseBranchInternal(fromEquip, fromPort, toLine, param, diameter, material, spec) {
        if (!_core) { notifyWithVoice('Core no inicializado', true); return false; }

        const fromObj = _core.findObjectByTag(fromEquip);
        const toObj = _core.findObjectByTag(toLine);

        if (!fromObj || !toObj) {
            notifyWithVoice('Objeto no encontrado', true);
            return true;
        }

        // 1. Calcular punto de inserción
        const puntoConexion = calcularPuntoParametrico(toObj, param);
        if (!puntoConexion) {
            notifyWithVoice('No se pudo calcular punto de conexión', true);
            return true;
        }

        // 2. Insertar TEE en la línea destino
        let puertoId = null;
        
        // Usar el nuevo método del Core si existe
        if (_core.injectFittingAtPoint) {
            const result = _core.injectFittingAtPoint(toLine, puntoConexion, {
                type: 'TEE_EQUAL',
                diameter: diameter,
                material: material
            });
            if (result) puertoId = result.branchPortId;
        }
        
        // Fallback al Router
        if (!puertoId && typeof SmartFlowRouter !== 'undefined') {
            puertoId = SmartFlowRouter.insertarAccesorioEnLinea(toLine, puntoConexion, diameter, true);
        }

        if (!puertoId) {
            notifyWithVoice('No se pudo insertar el accesorio', true);
            return true;
        }

        // 3. Obtener posición del puerto origen
        let startPos = null;
        if (typeof SmartFlowRouter !== 'undefined') {
            startPos = SmartFlowRouter.getPortPosition(fromObj, fromPort);
        }
        if (!startPos) {
            const nzFrom = fromObj.puertos ? fromObj.puertos.find(function(n) { return n.id === fromPort; }) : null;
            if (nzFrom) {
                const basePos = getBasePosition(fromObj);
                startPos = { x: basePos.x + (nzFrom.relX || 0), y: basePos.y + (nzFrom.relY || 0), z: basePos.z + (nzFrom.relZ || 0) };
            }
        }
        if (!startPos) {
            notifyWithVoice('No se pudo obtener posición origen', true);
            return true;
        }

        // 4. Crear la nueva línea
        const newTag = 'L-' + ((_core.getLines() ? _core.getLines().length : 0) + 1);
        const nuevaLinea = {
            tag: newTag, diameter: diameter, material: material, spec: spec,
            origin: { objType: 'equipment', equipTag: fromEquip, portId: fromPort },
            destination: { objType: 'line', equipTag: toLine, portId: puertoId },
            waypoints: [], _cachedPoints: [startPos, puntoConexion], components: []
        };

        _core.addLine(nuevaLinea);
        const db = _core.getDb();
        const lineaRegistrada = db.lines.find(function(l) { return l.tag === newTag; }) || nuevaLinea;
        const fittingInfo = runFittingInjection(lineaRegistrada, fromObj, fromPort, toObj, puertoId, diameter, material);

        if (_core.updateLine) { _core.updateLine(newTag, lineaRegistrada); }
        if (_core.setSelected) _core.setSelected({ type: 'line', obj: lineaRegistrada });

        // Actualizar puertos conectados
        const nzFrom = fromObj.puertos ? fromObj.puertos.find(function(p) { return p.id === fromPort; }) : null;
        if (nzFrom) nzFrom.connectedLine = newTag;

        const toObjUpd = _core.findObjectByTag(toLine);
        if (toObjUpd && toObjUpd.puertos) {
            const p = toObjUpd.puertos.find(function(p) { return p.id === puertoId; });
            if (p) p.connectedLine = newTag;
        }

        notifyWithVoice('✅ Derivación: ' + newTag + ' (' + fromEquip + '.' + fromPort + ' → ' + toLine + ' @' + param.toFixed(2) + ')' + fittingInfo.message, false);
        return true;
    }

    // ================================================================
    // COMANDOS ORIGINALES (se mantienen igual)
    // ================================================================

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
                const dotIdx = ref.indexOf('.');
                const atIdx = ref.indexOf('@');
                if (atIdx > 0) {
                    tag = ref.substring(0, atIdx);
                    subId = ref.substring(atIdx + 1);
                    const numVal = parseFloat(subId);
                    if (!isNaN(numVal) && numVal >= 0 && numVal <= 1) subCommand = 'param';
                    else if (subId.toUpperCase() === 'START' || subId === '0') { subCommand = 'punto'; subId = '0'; }
                    else if (subId.toUpperCase() === 'END' || subId === '1') { subCommand = 'punto'; subId = 'end'; }
                    else subCommand = 'puerto';
                } else if (dotIdx > 0) {
                    tag = ref.substring(0, dotIdx);
                    subId = ref.substring(dotIdx + 1);
                    subCommand = 'puerto';
                } else { tag = ref; }
            } else { notifyWithVoice('Uso: coordenadas de TAG [puerto|punto ID]', true); return true; }
            if (!tag) { notifyWithVoice('❌ Tag no especificado', true); return true; }
            if (!_core) { notifyWithVoice("Error: Core no inicializado", true); return true; }
            const obj = _core.findObjectByTag(tag);
            if (!obj) { notifyWithVoice('❌ "' + tag + '" no encontrado', true); return true; }
            const basePos = getBasePosition(obj);
            const isEq = obj.posX !== undefined || (obj.pos && obj.pos.x !== undefined);
            let response = '📍 ' + tag;
            if (!subCommand) {
                if (isEq) {
                    response += ' → (X=' + basePos.x.toFixed(0) + ', Y=' + basePos.y.toFixed(0) + ', Z=' + basePos.z.toFixed(0) + ')';
                    if (obj.diametro) response += ' | ⌀' + obj.diametro + 'mm';
                    if (obj.altura) response += ' | H=' + obj.altura + 'mm';
                }
                notifyWithVoice(response, false);
                return true;
            }
            if (subCommand === 'param' && subId) {
                const coords = calcularPuntoParametrico(obj, parseFloat(subId));
                if (!coords) { notifyWithVoice('⚠️ ' + tag + ' sin geometría', true); return true; }
                response += ' @' + subId + ': (' + coords.x.toFixed(0) + ',' + coords.y.toFixed(0) + ',' + coords.z.toFixed(0) + ')';
                notifyWithVoice(response, false);
                return true;
            }
            notifyWithVoice('Comando no reconocido', true);
            return true;
        } catch (e) { notifyWithVoice('❌ Error: ' + e.message, true); return true; }
    }

    function parseNodes(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'nodes' && parts[0] !== 'nodos') return false;
        if (parts.length < 2) { notifyWithVoice('Uso: nodos TAG', true); return true; }
        const tag = parts[1];
        if (!_core) { notifyWithVoice("Error: Core no inicializado", true); return true; }
        const obj = _core.findObjectByTag(tag);
        if (!obj) { notifyWithVoice(tag + ' no encontrado', true); return true; }
        let nodes = [];
        if (obj.posX !== undefined || (obj.pos && obj.pos.x !== undefined)) {
            nodes = (obj.puertos || []).map(function(p) { return p.id + ' ⌀' + (p.diametro || '?') + '" ' + p.status; });
        } else {
            nodes = ['START (P0)', 'END (P' + (getPoints(obj).length - 1) + ')'];
        }
        notifyWithVoice('🔌 Nodos de ' + tag + ': ' + nodes.join(' | '), false);
        return true;
    }

    function parseInfo(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'info') return false;
        if (parts.length < 2) { notifyWithVoice("Uso: info line [TAG] | info equipment [TAG] | info component [TAG]", true); return true; }
        const type = parts[1].toLowerCase();
        const tag = parts[2];
        if (!tag) { notifyWithVoice('Especifique el tag del ' + type, true); return true; }
        if (!_core) return false;
        const obj = _core.findObjectByTag(tag);
        if (!obj) { notifyWithVoice('"' + tag + '" no encontrado', true); return true; }
        
        if (type === 'line' || type === 'línea' || type === 'linea') {
            const line = obj;
            const pts = getPoints(line);
            let totalLen = 0;
            for (let i = 0; i < pts.length - 1; i++) totalLen += Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y, pts[i+1].z - pts[i].z);
            notifyWithVoice('📋 Línea ' + tag + ' | ⌀' + (line.diameter || '?') + '" | ' + (line.material || 'N/D') + ' | Spec: ' + (line.spec || 'N/D') + ' | Puntos: ' + pts.length + ' | Long: ' + (totalLen/1000).toFixed(2) + 'm | Componentes: ' + (line.components ? line.components.length : 0), false);
        } else if (type === 'equipment' || type === 'equipo') {
            const eq = obj;
            const pos = getBasePosition(eq);
            notifyWithVoice('📋 Equipo ' + tag + ' | Tipo: ' + (eq.tipo || 'Desconocido') + ' | Material: ' + (eq.material || 'N/D') + ' | Pos: (' + pos.x.toFixed(0) + ',' + pos.y.toFixed(0) + ',' + pos.z.toFixed(0) + ') | ⌀' + (eq.diametro || 'N/D') + ' H=' + (eq.altura || 'N/D'), false);
        } else if (type === 'component' || type === 'componente') {
            notifyWithVoice('📋 Componente ' + tag + ' | Tipo: ' + (obj.type || 'N/D'), false);
        }
        return true;
    }

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
            else if (key === 'ancho') params.ancho = parseFloat(parts[++i]);
            else if (key === 'material') params.material = parts[++i].toUpperCase();
            else if (key === 'spec') params.spec = parts[++i];
            else if (key === 'baranda') params.baranda = parts[++i].toLowerCase() === 'true' || parts[++i] === 'si';
        }
        if (!_catalog) return false;
        const equipoDef = _catalog.getEquipment(tipo);
        if (!equipoDef) { notifyWithVoice('Tipo de equipo desconocido: ' + tipo, true); return true; }
        const equipo = _catalog.createEquipment(tipo, tag, x, y, z, params);
        if (equipo) {
            _core.addEquipment(equipo);
            if (_core.setSelected) _core.setSelected({ type: 'equipment', obj: equipo });
            notifyWithVoice('✅ Equipo ' + tag + ' (' + equipoDef.nombre + ') creado en (' + x + ',' + y + ',' + z + ')', false);
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
        const nuevaLinea = { tag: tag, diameter: diameter, material: material, spec: spec, _cachedPoints: points, waypoints: points.slice(1, -1), components: [] };
        _core.addLine(nuevaLinea);
        const db = _core.getDb();
        const lineaRegistrada = db.lines.find(function(l) { return l.tag === tag; }) || nuevaLinea;
        const fittingInfo = runFittingInjection(lineaRegistrada, null, null, null, null, diameter, material);
        if (_core.updateLine) { _core.updateLine(tag, lineaRegistrada); }
        if (_core.setSelected) _core.setSelected({ type: 'line', obj: lineaRegistrada });
        notifyWithVoice('✅ Línea ' + tag + ' creada' + fittingInfo.message, false);
        return true;
    }

    function parseConnect(cmd) {
        const parts = cmd.split(/\s+/);
        if (parts[0] !== 'connect' && parts[0] !== 'conectar') return false;
        
        // Si es conexión a punto intermedio → usar branch
        const toNozzleRaw = parts[5];
        const numPos = parseFloat(toNozzleRaw);
        if (!isNaN(numPos) && numPos > 0 && numPos < 1) {
            const fromEquip = parts[1], fromNozzle = parts[2], toLine = parts[4];
            let diameter = 4, material = 'PPR', spec = 'PPR_PN12_5';
            for (let i = 6; i < parts.length; i++) {
                if (parts[i] === 'diameter' || parts[i] === 'diametro') diameter = parseFloat(parts[++i]);
                else if (parts[i] === 'material') material = parts[++i].toUpperCase();
                else if (parts[i] === 'spec') spec = parts[++i];
            }
            return parseBranchInternal(fromEquip, fromNozzle, toLine, numPos, diameter, material, spec);
        }
        
        // Conexión normal
        if (typeof SmartFlowRouter !== 'undefined') {
            SmartFlowRouter.routeBetweenPorts(parts[1], parts[2], parts[4], toNozzleRaw);
        }
        return true;
    }

    function parseDelete(cmd) {
        const parts = cmd.split(/\s+/);
        if (parts[0] !== 'delete' && parts[0] !== 'eliminar') return false;
        const type = parts[1], tag = parts[2];
        saveStateBeforeMutation();
        if (type === 'equipment' || type === 'equipo') {
            const db = _core.getDb();
            const index = db.equipos.findIndex(function(e) { return e.tag === tag; });
            if (index === -1) { notifyWithVoice('Equipo ' + tag + ' no encontrado', true); return true; }
            db.equipos.splice(index, 1);
            notifyWithVoice('✅ Equipo ' + tag + ' eliminado', false);
            return true;
        } else if (type === 'line' || type === 'línea') {
            const db = _core.getDb();
            const index = db.lines.findIndex(function(l) { return l.tag === tag; });
            if (index === -1) { notifyWithVoice('Línea ' + tag + ' no encontrada', true); return true; }
            db.lines.splice(index, 1);
            notifyWithVoice('✅ Línea ' + tag + ' eliminada', false);
            return true;
        }
        return false;
    }

    function listEquipos() { const eqs = _core.getDb().equipos; notifyWithVoice(eqs.length ? '📦 Equipos (' + eqs.length + '): ' + eqs.map(function(e){return e.tag}).join(', ') : 'No hay equipos'); }
    function listLineas() { const ls = _core.getDb().lines; notifyWithVoice(ls.length ? '📏 Líneas (' + ls.length + '): ' + ls.map(function(l){return l.tag + '(' + l.diameter + '" ' + (l.material||'?') + ')'}).join(', ') : 'No hay líneas'); }
    
    function parseList(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'list' && parts[0] !== 'listar') return false;
        const sub = parts[1] ? parts[1].toLowerCase() : '';
        if (sub === 'equipos') { listEquipos(); return true; }
        if (sub === 'lineas' || sub === 'líneas') { listLineas(); return true; }
        notifyWithVoice('Use: listar equipos | listar lineas');
        return true;
    }

    function parseBOM(cmd) { 
        const t = cmd.trim().toLowerCase(); 
        if (t === 'bom' || t === 'mto' || t === 'generate bom' || t === 'generar bom') { 
            generateBOM(); 
            return true; 
        } 
        return false; 
    }
    
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
        notifyWithVoice('✅ BOM generado con ' + items.length + ' líneas.', false);
    }

    function parseAudit(cmd) { const t = cmd.trim().toLowerCase(); if (t === 'audit' || t === 'auditar') { if (_core && _core.auditModel) _core.auditModel(); else notifyWithVoice("Auditoría no disponible.", true); return true; } return false; }

    function parseHelp(cmd) {
        const lower = cmd.toLowerCase(); if (lower !== 'help' && lower !== 'ayuda') return false;
        let ayuda = "══════════════════════════════════════\n";
        ayuda += "       SMARTFLOW PRO v3.0 - COMANDOS\n";
        ayuda += "══════════════════════════════════════\n\n";
        ayuda += "🏗️ CREACIÓN:\n";
        ayuda += "  create [tipo] [tag] at (x,y,z)\n";
        ayuda += "  create line [tag] route (x,y,z)...\n\n";
        ayuda += "🔗 CONEXIÓN:\n";
        ayuda += "  connect [origen] [puerto] to [destino] [puerto]\n";
        ayuda += "  🆕 branch [origen] [puerto] from [línea] at [0-1]\n";
        ayuda += "  route from [origen] [puerto] to [destino] [puerto]\n\n";
        ayuda += "📊 CONSULTAS:\n";
        ayuda += "  info line|equipment [tag]\n";
        ayuda += "  point de [tag] | point [tag]@[0-1]\n";
        ayuda += "  nodes [tag]\n";
        ayuda += "  list equipos | lineas\n\n";
        ayuda += "✏️ EDICIÓN:\n";
        ayuda += "  move [tag] to (x,y,z) | by (dx,dy,dz)\n";
        ayuda += "  delete equipment|line [tag]\n\n";
        ayuda += "🔄 undo | redo | bom | audit | help\n";
        ayuda += "══════════════════════════════════════\n";
        notifyWithVoice(ayuda, false); return true;
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
        saveStateBeforeMutation();
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

    function parseTap(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'tap') return false;
        if (parts.length < 6 || parts[3] !== 'to') {
            notifyWithVoice('Uso: tap [Equipo] [Puerto] to [Línea] [Posición 0-1]', true);
            return true;
        }
        return parseBranchInternal(parts[1], parts[2], parts[4], parseFloat(parts[5]), 4, 'PPR', 'PPR_PN12_5');
    }

    function parseSplit(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'split' && parts[0] !== 'dividir' && parts[0] !== 'romper') return false;
        if (!_core) return false;
        const lineTag = parts[1];
        const coords = extractCoords(cmd);
        if (!lineTag || !coords) { notifyWithVoice("Uso: split [línea] at (x,y,z)", true); return true; }
        const type = extractValue(parts, ['type', 'tipo']) || 'TEE_EQUAL';
        const result = _core.splitLine(lineTag, coords, { type: type });
        if (result) {
            notifyWithVoice('✅ Línea ' + lineTag + ' dividida con ' + type, false);
        } else {
            notifyWithVoice('Error: Punto fuera de la línea ' + lineTag, true);
        }
        return true;
    }

    let _macros = new Map();
    window._commandHistory = window._commandHistory || [];

    function recordCommand(cmd) {
        if (cmd && !cmd.startsWith('//') && cmd.trim()) {
            window._commandHistory.push(cmd.trim());
            if (window._commandHistory.length > 200) { window._commandHistory.shift(); }
        }
    }

    function parseMacro(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'macro' && parts[0] !== 'script') return false;
        const action = parts[1] ? parts[1].toLowerCase() : '';
        const name = parts[2];
        if (action === 'save' || action === 'guardar') {
            if (!name) { notifyWithVoice("Uso: macro save NOMBRE", true); return true; }
            _macros.set(name, [...window._commandHistory]);
            notifyWithVoice('💾 Macro "' + name + '" guardada (' + _macros.get(name).length + ' comandos)', false);
            return true;
        }
        if (action === 'run' || action === 'ejecutar') {
            if (!name || !_macros.has(name)) { notifyWithVoice('Macro "' + name + '" no encontrada. Use macro list.', true); return true; }
            const commands = _macros.get(name);
            let count = 0;
            commands.forEach(function(c) { if (executeCommand(c)) count++; });
            notifyWithVoice('▶️ Macro "' + name + '": ' + count + '/' + commands.length + ' comandos ejecutados', false);
            return true;
        }
        if (action === 'list' || action === 'lista') {
            if (_macros.size === 0) { notifyWithVoice("No hay macros guardadas.", false); }
            else {
                let msg = "📋 Macros guardadas:\n";
                for (const [n, cmds] of _macros) { msg += '  • ' + n + ' (' + cmds.length + ' comandos)\n'; }
                notifyWithVoice(msg, false);
            }
            return true;
        }
        if (action === 'delete' || action === 'eliminar') {
            if (_macros.delete(name)) { notifyWithVoice('🗑️ Macro "' + name + '" eliminada', false); }
            else { notifyWithVoice('Macro "' + name + '" no encontrada', true); }
            return true;
        }
        return true;
    }

    function parseExportCommand(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'export' && parts[0] !== 'exportar') return false;
        const format = parts[1] ? parts[1].toLowerCase() : '';
        if (format === 'json') {
            if (_core && _core.exportProject) {
                const json = _core.exportProject();
                const blob = new Blob([json], { type: 'application/json' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = 'SmartFlow_' + new Date().toISOString().slice(0,10) + '.json';
                a.click();
                notifyWithVoice("📁 Proyecto exportado como JSON", false);
            }
            return true;
        }
        if (format === 'csv') { generateBOM(); return true; }
        return true;
    }

    function parsePlace(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'place' && parts[0] !== 'apoyar' && parts[0] !== 'posar' && parts[0] !== 'poner' && parts[0] !== 'colocar') return false;
        if (!_core) return false;
        const tag = parts[1];
        const onIdx = parts.indexOf('on') !== -1 ? parts.indexOf('on') : parts.indexOf('sobre');
        if (onIdx === -1 || onIdx + 1 >= parts.length) { notifyWithVoice('Uso: place EQUIPO on SUPERFICIE | place EQUIPO on ground', true); return true; }
        const superficieTag = parts[onIdx + 1];
        const equipo = _core.findObjectByTag(tag);
        if (!equipo || equipo.posX === undefined) { notifyWithVoice('❌ Equipo "' + tag + '" no encontrado', true); return true; }
        let superficieY = 0;
        if (superficieTag.toLowerCase() !== 'ground' && superficieTag.toLowerCase() !== 'suelo') {
            const superficie = _core.findObjectByTag(superficieTag);
            if (!superficie) { notifyWithVoice('❌ Superficie "' + superficieTag + '" no encontrada', true); return true; }
            const alturaSuperficie = superficie.altura || 0;
            superficieY = (superficie.posY || 0) + (alturaSuperficie / 2);
        }
        const alturaEquipo = equipo.altura || 0;
        const nuevoPosY = superficieY + (alturaEquipo / 2);
        _core.updateEquipment(tag, { posY: nuevoPosY });
        notifyWithVoice('✅ ' + tag + ' apoyado. Base EL ' + (superficieY/1000).toFixed(3) + 'm', false);
        return true;
    }

    // ================================================================
    // EJECUCIÓN PRINCIPAL
    // ================================================================

    function executeCommand(cmd) {
        if (!cmd || cmd.startsWith('//')) return false;
        const normalized = normalizeCommand(cmd);
        const trimmed = normalized.trim();
        
        if (trimmed === 'undo' || trimmed === 'deshacer') { if (_core) _core.undo(); recordCommand(cmd); return true; }
        if (trimmed === 'redo' || trimmed === 'rehacer') { if (_core) _core.redo(); recordCommand(cmd); return true; }
        
        if (parseBranch(trimmed)) { recordCommand(cmd); return true; }
        if (parseCreateLine(trimmed)) { recordCommand(cmd); return true; }
        if (parseCreate(trimmed)) { recordCommand(cmd); return true; }
        if (parseConnect(trimmed)) { recordCommand(cmd); return true; }
        if (parseTap(trimmed)) { recordCommand(cmd); return true; }
        if (parseSplit(trimmed)) { recordCommand(cmd); return true; }
        if (parseMoveCommand(trimmed)) { recordCommand(cmd); return true; }
        if (parsePlace(trimmed)) { recordCommand(cmd); return true; }
        if (parseDelete(trimmed)) { recordCommand(cmd); return true; }
        if (parseMeasure(trimmed)) { recordCommand(cmd); return true; }
        if (parsePoint(trimmed)) { recordCommand(cmd); return true; }
        if (parseNodes(trimmed)) { recordCommand(cmd); return true; }
        if (parseInfo(trimmed)) { recordCommand(cmd); return true; }
        if (parseList(trimmed)) { recordCommand(cmd); return true; }
        if (parseViewCommand(trimmed)) { recordCommand(cmd); return true; }
        if (parseBOM(trimmed)) { recordCommand(cmd); return true; }
        if (parseAudit(trimmed)) { recordCommand(cmd); return true; }
        if (parseMacro(trimmed)) { recordCommand(cmd); return true; }
        if (parseExportCommand(trimmed)) { recordCommand(cmd); return true; }
        if (parseHelp(trimmed)) { recordCommand(cmd); return true; }
        
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

    // ═══ Comandos de vista, medida, rotate, duplicate, align ═══
    function parseViewCommand(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'view' && parts[0] !== 'vista' && parts[0] !== 'zoom' && parts[0] !== 'camara' && parts[0] !== 'cámara') return false;
        const sub = parts[1] ? parts[1].toLowerCase() : '';
        if (sub === 'top' || sub === 'planta') { if (_renderer && _renderer.setView) _renderer.setView('top'); notifyWithVoice("🔭 Vista: Planta (TOP)", false); return true; }
        if (sub === 'front' || sub === 'frente') { if (_renderer && _renderer.setView) _renderer.setView('front'); notifyWithVoice("🔭 Vista: Frontal", false); return true; }
        if (sub === 'iso' || sub === 'isometrico' || sub === 'isométrico') { if (_renderer && _renderer.setView) _renderer.setView('iso'); notifyWithVoice("🔭 Vista: Isométrica", false); return true; }
        if (sub === 'extents' || sub === 'todo' || sub === 'fit' || sub === 'extender') { if (_renderer && _renderer.zoomToFit) _renderer.zoomToFit(); notifyWithVoice("🔭 Zoom: Extender", false); return true; }
        return true;
    }

    function parseMeasure(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'measure' && parts[0] !== 'medir' && parts[0] !== 'distancia' && parts[0] !== 'distance') return false;
        if (!_core) return false;
        let tag1, tag2, port1 = null, port2 = null;
        if (parts[1] === 'between' || parts[1] === 'entre') {
            tag1 = parts[2];
            const andIdx = parts.indexOf('and') !== -1 ? parts.indexOf('and') : parts.indexOf('y');
            if (andIdx === -1) return false;
            tag2 = parts[andIdx + 1];
        } else {
            tag1 = parts[1];
            const toIdx = parts.indexOf('to') !== -1 ? parts.indexOf('to') : parts.indexOf('a');
            if (toIdx === -1) return false;
            tag2 = parts[toIdx + 1];
        }
        if (tag1 && tag1.includes(':')) { var s1 = tag1.split(':'); tag1 = s1[0]; port1 = s1[1]; }
        if (tag2 && tag2.includes(':')) { var s2 = tag2.split(':'); tag2 = s2[0]; port2 = s2[1]; }
        const obj1 = _core.findObjectByTag(tag1);
        const obj2 = _core.findObjectByTag(tag2);
        if (!obj1 || !obj2) { notifyWithVoice("Objeto(s) no encontrado(s)", true); return true; }
        const pos1 = port1 ? getPortPosition(tag1, port1) : getBasePosition(obj1);
        const pos2 = port2 ? getPortPosition(tag2, port2) : getBasePosition(obj2);
        const dx = pos2.x - pos1.x, dy = pos2.y - pos1.y, dz = pos2.z - pos1.z;
        const dist = Math.hypot(dx, dy, dz);
        const distH = Math.hypot(dx, dz);
        notifyWithVoice('📏 Distancia ' + tag1 + ' → ' + tag2 + ':\n  3D: ' + (dist/1000).toFixed(3) + ' m\n  Horizontal: ' + (distH/1000).toFixed(3) + ' m\n  ΔX: ' + dx.toFixed(0) + ' mm | ΔY: ' + dy.toFixed(0) + ' mm | ΔZ: ' + dz.toFixed(0) + ' mm', false);
        return true;
    }

    function parseRotate(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'rotate' && parts[0] !== 'rotar' && parts[0] !== 'girar') return false;
        if (!_core) return false;
        const tag = parts[1];
        let angle = parseFloat(parts[2]) || 0;
        let axis = 'Y';
        const aroundIdx = parts.indexOf('around') !== -1 ? parts.indexOf('around') : parts.indexOf('eje');
        if (aroundIdx !== -1 && aroundIdx + 1 < parts.length) axis = parts[aroundIdx + 1].toUpperCase();
        const obj = _core.findObjectByTag(tag);
        if (!obj) { notifyWithVoice(tag + ' no encontrado', true); return true; }
        saveStateBeforeMutation();
        if (obj.posX !== undefined) {
            notifyWithVoice('✅ ' + tag + ' rotado ' + angle + '°', false);
        } else {
            const pts = getPoints(obj);
            if (pts.length > 0) {
                const rad = angle * Math.PI / 180;
                const cos = Math.cos(rad), sin = Math.sin(rad);
                let cx = 0, cy = 0, cz = 0;
                pts.forEach(function(p) { cx += p.x; cy += p.y; cz += p.z; });
                cx /= pts.length; cy /= pts.length; cz /= pts.length;
                const newPts = pts.map(function(p) {
                    const rx = p.x - cx, ry = p.y - cy, rz = p.z - cz;
                    if (axis === 'Y') return { x: cx + rx * cos - rz * sin, y: p.y, z: cz + rx * sin + rz * cos };
                    if (axis === 'Z') return { x: cx + rx * cos - ry * sin, y: cy + rx * sin + ry * cos, z: p.z };
                    return p;
                });
                _core.updateLine(tag, { _cachedPoints: newPts });
                notifyWithVoice('✅ ' + tag + ' rotado ' + angle + '°', false);
            }
        }
        return true;
    }

    function parseDuplicate(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'duplicate' && parts[0] !== 'duplicar' && parts[0] !== 'copy' && parts[0] !== 'copiar') return false;
        if (!_core) return false;
        const tag = parts[1];
        const asIdx = parts.indexOf('as') !== -1 ? parts.indexOf('as') : parts.indexOf('como');
        const newTag = asIdx !== -1 ? parts[asIdx + 1] : tag + '-COPY';
        let offsetX = 2000, offsetY = 0, offsetZ = 0;
        const offsetIdx = parts.indexOf('offset') !== -1 ? parts.indexOf('offset') : parts.indexOf('desplazar');
        if (offsetIdx !== -1) {
            const coordStr = parts.slice(offsetIdx + 1).join('');
            const m = coordStr.match(/\((-?\d+\.?\d*),(-?\d+\.?\d*),(-?\d+\.?\d*)\)/);
            if (m) { offsetX = parseFloat(m[1]); offsetY = parseFloat(m[2]); offsetZ = parseFloat(m[3]); }
        }
        const original = _core.findObjectByTag(tag);
        if (!original) { notifyWithVoice(tag + ' no encontrado', true); return true; }
        saveStateBeforeMutation();
        if (original.posX !== undefined) {
            const clone = JSON.parse(JSON.stringify(original));
            clone.tag = newTag;
            clone.posX = (clone.posX || 0) + offsetX;
            clone.posY = (clone.posY || 0) + offsetY;
            clone.posZ = (clone.posZ || 0) + offsetZ;
            _core.addEquipment(clone);
        } else {
            const clone = JSON.parse(JSON.stringify(original));
            clone.tag = newTag;
            const pts = getPoints(original);
            if (pts.length > 0) {
                clone._cachedPoints = pts.map(function(p) { return { x: p.x + offsetX, y: p.y + offsetY, z: p.z + offsetZ }; });
            }
            _core.addLine(clone);
        }
        notifyWithVoice('✅ Duplicado: ' + tag + ' → ' + newTag, false);
        return true;
    }

    function parseAlign(cmd) {
        const parts = cmd.trim().split(/\s+/);
        if (parts[0] !== 'align' && parts[0] !== 'alinear') return false;
        if (!_core) return false;
        const tags = [];
        let axis = 'Y';
        let i = 1;
        while (i < parts.length && parts[i] !== 'on' && parts[i] !== 'en') { tags.push(parts[i]); i++; }
        if (i < parts.length && (parts[i] === 'on' || parts[i] === 'en')) axis = (parts[i + 1] || 'Y').toUpperCase();
        if (tags.length < 2) { notifyWithVoice("Uso: align TAG1 TAG2 on X|Y|Z", true); return true; }
        const refObj = _core.findObjectByTag(tags[0]);
        if (!refObj || refObj.posX === undefined) { notifyWithVoice(tags[0] + ' no es un equipo válido', true); return true; }
        const refValue = axis === 'X' ? refObj.posX : axis === 'Y' ? refObj.posY : refObj.posZ;
        saveStateBeforeMutation();
        let count = 0;
        for (let j = 1; j < tags.length; j++) {
            const obj = _core.findObjectByTag(tags[j]);
            if (!obj || obj.posX === undefined) continue;
            const update = {};
            if (axis === 'X') update.posX = refValue;
            else if (axis === 'Y') update.posY = refValue;
            else update.posZ = refValue;
            _core.updateEquipment(tags[j], update);
            count++;
        }
        notifyWithVoice('✅ ' + count + ' equipos alineados al eje ' + axis, false);
        return true;
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
        executeBatch: executeBatch,
        getMacros: function() { return _macros; },
        getHistory: function() { return window._commandHistory || []; },
        clearHistory: function() { window._commandHistory = []; }
    };
})();
