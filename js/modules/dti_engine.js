
// ============================================================
// SMARTFLOW DTI ENGINE v1.1 - Motor de Diagrama de Tuberías e Instrumentación
// Archivo: js/modules/dti_engine.js
// Dependencias: SmartFlowCore v6.0+, SmartFlowCatalog (opcional)
// Novedades v1.1:
//   - Validación de tipos de instrumentos contra catálogo
//   - Los instrumentos creados desde DTI se comparten con el modelo 3D
//   - Vinculación automática con líneas y equipos existentes
//   - Estándar ISA-5.1 completo
// ============================================================

const SmartFlowDTI = (function() {
    
    let _core = null;
    let _catalog = null;
    let _notify = (msg, isErr) => console.log(msg);
    
    // ================================================================
    //  ESTÁNDAR ISA-5.1: LETRAS DE IDENTIFICACIÓN
    // ================================================================
    const ISA_LETTERS = {
        'P': { variable: 'PRESSURE',      description: 'Presión' },
        'T': { variable: 'TEMPERATURE',   description: 'Temperatura' },
        'F': { variable: 'FLOW',          description: 'Flujo' },
        'L': { variable: 'LEVEL',         description: 'Nivel' },
        'D': { variable: 'DENSITY',       description: 'Densidad' },
        'A': { variable: 'ANALYSIS',      description: 'Análisis' },
        'V': { variable: 'VIBRATION',     description: 'Vibración' },
        'W': { variable: 'WEIGHT',        description: 'Peso' },
        'H': { variable: 'HAND',          description: 'Manual' },
        'S': { variable: 'SPEED',         description: 'Velocidad' },
        'C': { variable: 'CONDUCTIVITY',  description: 'Conductividad' },
        'Z': { variable: 'POSITION',      description: 'Posición' },
        'I': { function: 'INDICATOR',     description: 'Indicador' },
        'C': { function: 'CONTROLLER',    description: 'Controlador' },
        'T': { function: 'TRANSMITTER',   description: 'Transmisor' },
        'S': { function: 'SWITCH',        description: 'Switch' },
        'A': { function: 'ALARM',         description: 'Alarma' },
        'R': { function: 'RECORDER',      description: 'Registrador' },
        'E': { function: 'ELEMENT',       description: 'Elemento Primario' },
        'V': { function: 'VALVE',         description: 'Válvula' },
        'Y': { function: 'RELAY',         description: 'Relé/Convertidor' },
        'Q': { function: 'TOTALIZER',     description: 'Totalizador' }
    };
    
    // ================================================================
    //  TIPOS DE INSTRUMENTOS
    // ================================================================
    const INSTRUMENT_TYPES = {
        'PRESSURE_GAUGE':          { symbol: 'PG',  category: 'INDICATOR',    location: 'FIELD' },
        'PRESSURE_TRANSMITTER':    { symbol: 'PT',  category: 'TRANSMITTER',  location: 'FIELD' },
        'PRESSURE_SWITCH':         { symbol: 'PS',  category: 'SWITCH',       location: 'FIELD' },
        'PRESSURE_CONTROLLER':     { symbol: 'PIC', category: 'CONTROLLER',   location: 'PANEL' },
        'PRESSURE_SAFETY_VALVE':   { symbol: 'PSV', category: 'SAFETY',       location: 'FIELD' },
        'TEMPERATURE_GAUGE':       { symbol: 'TG',  category: 'INDICATOR',    location: 'FIELD' },
        'TEMPERATURE_TRANSMITTER': { symbol: 'TT',  category: 'TRANSMITTER',  location: 'FIELD' },
        'TEMPERATURE_SWITCH':      { symbol: 'TS',  category: 'SWITCH',       location: 'FIELD' },
        'TEMPERATURE_CONTROLLER':  { symbol: 'TIC', category: 'CONTROLLER',   location: 'PANEL' },
        'FLOW_METER':              { symbol: 'FG',  category: 'INDICATOR',    location: 'FIELD' },
        'FLOW_TRANSMITTER':        { symbol: 'FT',  category: 'TRANSMITTER',  location: 'FIELD' },
        'FLOW_SWITCH':             { symbol: 'FS',  category: 'SWITCH',       location: 'FIELD' },
        'FLOW_CONTROLLER':         { symbol: 'FIC', category: 'CONTROLLER',   location: 'PANEL' },
        'FLOW_TOTALIZER':          { symbol: 'FQ',  category: 'TOTALIZER',    location: 'PANEL' },
        'LEVEL_GAUGE':             { symbol: 'LG',  category: 'INDICATOR',    location: 'FIELD' },
        'LEVEL_TRANSMITTER':       { symbol: 'LT',  category: 'TRANSMITTER',  location: 'FIELD' },
        'LEVEL_SWITCH':            { symbol: 'LS',  category: 'SWITCH',       location: 'FIELD' },
        'LEVEL_CONTROLLER':        { symbol: 'LIC', category: 'CONTROLLER',   location: 'PANEL' },
        'LEVEL_SWITCH_RANA':       { symbol: 'LS',  category: 'SWITCH',       location: 'FIELD' },
        'ANALYSIS_TRANSMITTER':    { symbol: 'AT',  category: 'TRANSMITTER',  location: 'FIELD' },
        'PH_METER':                { symbol: 'AT',  category: 'TRANSMITTER',  location: 'FIELD' },
        'CONDUCTIVITY_METER':      { symbol: 'CT',  category: 'TRANSMITTER',  location: 'FIELD' },
        'CONTROL_VALVE':           { symbol: 'CV',  category: 'VALVE',        location: 'FIELD' },
        'ON_OFF_VALVE':            { symbol: 'XV',  category: 'VALVE',        location: 'FIELD' },
        'SAFETY_VALVE':            { symbol: 'SV',  category: 'SAFETY',       location: 'FIELD' },
        'ROTAMETER':               { symbol: 'RO',  category: 'INDICATOR',    location: 'FIELD' },
        'SIGHT_GLASS':             { symbol: 'SG',  category: 'INDICATOR',    location: 'FIELD' },
        'FLAME_ARRESTER':          { symbol: 'FA',  category: 'SAFETY',       location: 'FIELD' },
        'VACUUM_BREAKER':          { symbol: 'VB',  category: 'SAFETY',       location: 'FIELD' }
    };
    
    const LOOP_TYPES = {
        'FEEDBACK':       'Control por retroalimentación',
        'CASCADE':        'Control en cascada',
        'RATIO':          'Control de relación',
        'FEEDFORWARD':    'Control pre-alimentado',
        'SPLIT_RANGE':    'Control de rango partido',
        'ON_OFF':         'Control todo/nada',
        'SELECTOR':       'Control selector (máx/mín)'
    };
    
    // ================================================================
    //  VALIDACIÓN CONTRA CATÁLOGO
    // ================================================================
    
    function validateInstrumentType(type) {
        // Primero validar contra nuestro diccionario interno
        if (INSTRUMENT_TYPES[type]) {
            return { valid: true, source: 'internal', typeInfo: INSTRUMENT_TYPES[type] };
        }
        
        // Luego validar contra el catálogo
        if (_catalog && typeof _catalog.getComponent === 'function') {
            const catComp = _catalog.getComponent(type);
            if (catComp) {
                return { valid: true, source: 'catalog', typeInfo: catComp };
            }
        }
        
        // Sugerencias
        const sugerencias = Object.keys(INSTRUMENT_TYPES)
            .filter(k => k.includes(type.toUpperCase()) || type.toUpperCase().includes(k))
            .slice(0, 5);
        
        return { 
            valid: false, 
            msg: 'Tipo de instrumento desconocido: ' + type,
            sugerencias: sugerencias.length > 0 ? sugerencias : Object.keys(INSTRUMENT_TYPES).slice(0, 5)
        };
    }
    
    function validateComponentType(type) {
        if (_catalog && typeof _catalog.getComponent === 'function') {
            const catComp = _catalog.getComponent(type);
            if (!catComp) {
                const tipos = typeof _catalog.listComponentTypes === 'function' 
                    ? _catalog.listComponentTypes() 
                    : [];
                return { 
                    valid: false, 
                    msg: 'Componente no encontrado en catálogo: ' + type,
                    sugerencias: tipos.filter(t => t.includes(type.toUpperCase())).slice(0, 5)
                };
            }
            return { valid: true, catComp: catComp };
        }
        return { valid: true, msg: 'Catálogo no disponible - validación omitida' };
    }
    
    // ================================================================
    //  VALIDACIÓN DE TAGS ISA
    // ================================================================
    
    function validateISATag(tag) {
        const match = tag.match(/^([A-Z]+)-(\d+)$/);
        if (!match) {
            return { valid: false, msg: 'Formato inválido. Use: LETRAS-NÚMERO (ej: PIC-101)' };
        }
        
        const letters = match[1];
        const number = match[2];
        
        if (letters.length < 1 || letters.length > 4) {
            return { valid: false, msg: 'El código de letras debe tener 1-4 caracteres' };
        }
        
        const firstLetter = letters[0];
        if (!ISA_LETTERS[firstLetter] || !ISA_LETTERS[firstLetter].variable) {
            return { valid: false, msg: 'Primera letra inválida: ' + firstLetter };
        }
        
        return {
            valid: true,
            variable: ISA_LETTERS[firstLetter].variable,
            variableDesc: ISA_LETTERS[firstLetter].description,
            functions: letters.slice(1).split('').map(l => ISA_LETTERS[l]?.function || 'UNKNOWN'),
            number: parseInt(number)
        };
    }
    
    function inferInstrumentType(tag, defaultType) {
        const validation = validateISATag(tag);
        if (!validation.valid) return defaultType || 'PRESSURE_GAUGE';
        
        const functions = validation.functions;
        const variable = validation.variable;
        
        if (functions.includes('CONTROLLER')) return variable + '_CONTROLLER';
        if (functions.includes('TRANSMITTER')) return variable + '_TRANSMITTER';
        if (functions.includes('SWITCH')) return variable + '_SWITCH';
        if (functions.includes('INDICATOR')) {
            if (variable === 'FLOW') return 'FLOW_METER';
            if (variable === 'LEVEL') return 'LEVEL_GAUGE';
            return variable + '_GAUGE';
        }
        
        return variable + '_GAUGE';
    }
    
    // ================================================================
    //  CREACIÓN DE INSTRUMENTOS
    // ================================================================
    
    function createInstrument(params) {
        if (!_core) {
            _notify('❌ Error: Core no inicializado', true);
            return null;
        }
        
        if (!params.tag) {
            _notify('❌ Error: Tag de instrumento requerido', true);
            return null;
        }
        
        if (_core.getInstrumentByTag(params.tag)) {
            _notify('❌ Error: El instrumento ' + params.tag + ' ya existe', true);
            return null;
        }
        
        // Inferir tipo si no se especificó (basado en tag ISA)
        if (!params.type) {
            params.type = inferInstrumentType(params.tag, 'PRESSURE_GAUGE');
        }
        
        // Validar tipo contra diccionario interno y catálogo
        const typeValidation = validateInstrumentType(params.type);
        if (!typeValidation.valid) {
            _notify('❌ ' + typeValidation.msg, true);
            if (typeValidation.sugerencias && typeValidation.sugerencias.length > 0) {
                _notify('   Sugerencias: ' + typeValidation.sugerencias.join(', '), false);
            }
            return null;
        }
        
        // Validar que la línea existe si se especifica
        if (params.lineTag) {
            const line = _core.findObjectByTag(params.lineTag);
            if (!line || !_core.getLines().includes(line)) {
                _notify('⚠️ Línea ' + params.lineTag + ' no encontrada. El instrumento se creará sin vinculación a línea.', false);
            }
        }
        
        // Validar que el equipo existe si se especifica
        if (params.equipmentTag) {
            const eq = _core.findObjectByTag(params.equipmentTag);
            if (!eq || !_core.getEquipos().includes(eq)) {
                _notify('⚠️ Equipo ' + params.equipmentTag + ' no encontrado.', false);
            }
        }
        
        // Validar formato ISA
        const isaValidation = validateISATag(params.tag);
        
        const instrumentData = {
            tag: params.tag,
            type: params.type,
            lineTag: params.lineTag || '',
            equipmentTag: params.equipmentTag || '',
            position: params.position !== undefined ? params.position : 0.5,
            range: params.range || '',
            signal: params.signal || '4-20mA',
            service: params.service || '',
            location: params.location || (typeValidation.typeInfo?.location || 'FIELD'),
            loopTag: params.loopTag || '',
            isaVariable: isaValidation.valid ? isaValidation.variable : '',
            isaFunctions: isaValidation.valid ? isaValidation.functions : [],
            manufacturer: params.manufacturer || '',
            model: params.model || '',
            criticality: params.criticality || 'NORMAL',
            notes: params.notes || ''
        };
        
        const result = _core.addInstrument(instrumentData);
        
        if (result) {
            const lineInfo = params.lineTag ? ' en ' + params.lineTag : '';
            const equipInfo = params.equipmentTag ? ' en ' + params.equipmentTag : '';
            
            _notify('✅ Instrumento ' + params.tag + ' (' + params.type + ')' + lineInfo + equipInfo + 
                    ' | Rango: ' + (params.range || 'N/D') + ' | Señal: ' + instrumentData.signal);
            
            if (!isaValidation.valid) {
                _notify('⚠️ El tag ' + params.tag + ' no sigue ISA-5.1. ' + isaValidation.msg, false);
            }
        }
        
        return result ? _core.getInstrumentByTag(params.tag) : null;
    }
    
    // ================================================================
    //  CREACIÓN DE COMPONENTES EN LÍNEA (desde DTI)
    // ================================================================
    
    function addComponentToLine(lineTag, compType, position, params) {
        if (!_core) {
            _notify('❌ Error: Core no inicializado', true);
            return false;
        }
        
        // Validar componente contra catálogo
        const validation = validateComponentType(compType);
        if (!validation.valid) {
            _notify('❌ ' + validation.msg, true);
            if (validation.sugerencias && validation.sugerencias.length > 0) {
                _notify('   Sugerencias: ' + validation.sugerencias.join(', '), false);
            }
            return false;
        }
        
        const line = _core.findObjectByTag(lineTag);
        if (!line || !_core.getLines().includes(line)) {
            _notify('❌ Línea ' + lineTag + ' no encontrada', true);
            return false;
        }
        
        if (!line.components) line.components = [];
        
        // Verificar que no exista ya un componente en la misma posición
        const existe = line.components.some(function(c) {
            return c.type === compType && Math.abs((c.param || 0) - position) < 0.02;
        });
        
        if (existe) {
            _notify('⚠️ Ya existe un ' + compType + ' en la posición ' + position.toFixed(2), false);
            return false;
        }
        
        const component = {
            type: compType,
            tag: params.tag || (compType + '-' + Date.now().toString(36).slice(-6)),
            param: position,
            description: params.description || '',
            material: params.material || line.material || ''
        };
        
        line.components.push(component);
        _core.updateLine(lineTag, { components: line.components });
        _core.syncPhysicalData();
        
        _notify('✅ ' + compType + ' agregado a ' + lineTag + ' en posición ' + position.toFixed(2), false);
        return true;
    }
    
    // ================================================================
    //  CREACIÓN DE LAZOS DE CONTROL
    // ================================================================
    
    function createLoop(params) {
        if (!_core) {
            _notify('❌ Error: Core no inicializado', true);
            return null;
        }
        
        if (!params.tag) {
            _notify('❌ Error: Tag de lazo requerido', true);
            return null;
        }
        
        if (_core.getLoopByTag(params.tag)) {
            _notify('❌ Error: El lazo ' + params.tag + ' ya existe', true);
            return null;
        }
        
        // Validar que los instrumentos existen en la base de datos compartida
        const warnings = [];
        
        if (params.sensor) {
            const sensor = _core.getInstrumentByTag(params.sensor);
            if (!sensor) warnings.push('Sensor ' + params.sensor + ' no encontrado');
        }
        
        if (params.controller) {
            const controller = _core.getInstrumentByTag(params.controller);
            if (!controller) warnings.push('Controlador ' + params.controller + ' no encontrado');
        }
        
        if (params.valve) {
            const valve = _core.getInstrumentByTag(params.valve);
            if (!valve) warnings.push('Válvula ' + params.valve + ' no encontrada');
        }
        
        // Validar tipo de lazo
        if (params.type && !LOOP_TYPES[params.type]) {
            _notify('⚠️ Tipo de lazo desconocido: ' + params.type + '. Se usará FEEDBACK.', false);
            params.type = 'FEEDBACK';
        }
        
        const loopData = {
            tag: params.tag,
            sensor: params.sensor || '',
            controller: params.controller || '',
            valve: params.valve || '',
            type: params.type || 'FEEDBACK',
            description: params.description || LOOP_TYPES[params.type || 'FEEDBACK'] || '',
            setpoint: params.setpoint || '',
            range: params.range || '',
            output: params.output || '',
            notes: params.notes || ''
        };
        
        const result = _core.addLoop(loopData);
        
        if (result) {
            // Actualizar instrumentos con el tag del lazo
            if (params.sensor) _core.updateInstrument(params.sensor, { loopTag: params.tag });
            if (params.controller) _core.updateInstrument(params.controller, { loopTag: params.tag });
            if (params.valve) _core.updateInstrument(params.valve, { loopTag: params.tag });
            
            const loopDesc = LOOP_TYPES[loopData.type] || loopData.type;
            _notify('✅ Lazo ' + params.tag + ' (' + loopDesc + '): ' + 
                    (params.sensor || '?') + ' → ' + (params.controller || '?') + ' → ' + (params.valve || '?'));
            
            if (warnings.length > 0) {
                _notify('⚠️ Advertencias:\n' + warnings.join('\n'), false);
            }
        }
        
        return result ? _core.getLoopByTag(params.tag) : null;
    }
    
    // ================================================================
    //  CONSULTA DE INSTRUMENTOS Y LAZOS
    // ================================================================
    
    function getInstrumentInfo(tag) {
        const inst = _core.getInstrumentByTag(tag);
        if (!inst) {
            _notify('❌ Instrumento ' + tag + ' no encontrado', true);
            return null;
        }
        
        const typeInfo = INSTRUMENT_TYPES[inst.type] || {};
        const isa = validateISATag(tag);
        
        let msg = '═══════════════════════════════════\n';
        msg += '🔧 INSTRUMENTO: ' + tag + '\n';
        msg += '═══════════════════════════════════\n\n';
        msg += '📋 TIPO: ' + inst.type + '\n';
        msg += '📍 UBICACIÓN: ' + (inst.lineTag ? 'Línea ' + inst.lineTag : '') + 
                     (inst.equipmentTag ? ' Equipo ' + inst.equipmentTag : '') + '\n';
        msg += '📐 POSICIÓN: ' + (inst.position * 100).toFixed(0) + '% de la línea\n';
        msg += '📏 RANGO: ' + (inst.range || 'N/D') + '\n';
        msg += '⚡ SEÑAL: ' + inst.signal + '\n';
        
        if (isa.valid) {
            msg += '\n🏷️ ISA-5.1:\n';
            msg += '   Variable: ' + isa.variableDesc + ' (' + isa.variable + ')\n';
            msg += '   Funciones: ' + isa.functions.join(', ') + '\n';
        }
        
        if (inst.loopTag) {
            msg += '\n🔄 LAZO: ' + inst.loopTag + '\n';
            const loop = _core.getLoopByTag(inst.loopTag);
            if (loop) {
                msg += '   Configuración: ' + loop.sensor + ' → ' + loop.controller + ' → ' + loop.valve + '\n';
            }
        }
        
        msg += '═══════════════════════════════════';
        
        _notify(msg, false);
        return inst;
    }
    
    function listInstruments(filter) {
        const instruments = _core.getInstruments();
        if (instruments.length === 0) {
            _notify('📊 No hay instrumentos. Use: create instrument TAG type TIPO on LINEA', false);
            return [];
        }
        
        let filtered = instruments;
        if (filter) {
            const f = filter.toUpperCase();
            filtered = instruments.filter(i => 
                i.tag.toUpperCase().includes(f) ||
                i.type.toUpperCase().includes(f) ||
                (i.lineTag && i.lineTag.toUpperCase().includes(f)) ||
                (i.equipmentTag && i.equipmentTag.toUpperCase().includes(f)) ||
                (i.loopTag && i.loopTag.toUpperCase().includes(f))
            );
        }
        
        let msg = '🔧 INSTRUMENTOS (' + filtered.length + ')\n';
        msg += '══════════════════════════════════════════\n';
        
        const byType = {};
        filtered.forEach(i => {
            if (!byType[i.type]) byType[i.type] = [];
            byType[i.type].push(i);
        });
        
        for (const [type, items] of Object.entries(byType)) {
            msg += '\n📋 ' + type + ' (' + items.length + '):\n';
            items.forEach(i => {
                const linkedTo = i.lineTag || i.equipmentTag || 'sin vincular';
                const loopInfo = i.loopTag ? ' [Lazo: ' + i.loopTag + ']' : '';
                msg += '   • ' + i.tag + ': en ' + linkedTo + ' | Rango: ' + (i.range || 'N/D') + loopInfo + '\n';
            });
        }
        
        msg += '══════════════════════════════════════════';
        _notify(msg, false);
        return filtered;
    }
    
    function listLoops() {
        const loops = _core.getLoops();
        if (loops.length === 0) {
            _notify('🔄 No hay lazos definidos. Use: create loop TAG sensor X controller Y valve Z', false);
            return [];
        }
        
        let msg = '🔄 LAZOS DE CONTROL (' + loops.length + ')\n';
        msg += '══════════════════════════════════════════\n';
        
        loops.forEach(loop => {
            msg += '• ' + loop.tag + ' (' + (LOOP_TYPES[loop.type] || loop.type) + ')\n';
            msg += '   ' + (loop.sensor || '?') + ' → ' + (loop.controller || '?') + ' → ' + (loop.valve || '?') + '\n';
            if (loop.setpoint) msg += '   Setpoint: ' + loop.setpoint + '\n';
            if (loop.range) msg += '   Rango: ' + loop.range + '\n';
        });
        
        msg += '══════════════════════════════════════════';
        _notify(msg, false);
        return loops;
    }
    
    function listInstrumentTypes() {
        const tipos = Object.keys(INSTRUMENT_TYPES).sort();
        
        let msg = '📋 TIPOS DE INSTRUMENTOS DISPONIBLES (' + tipos.length + ')\n';
        msg += '══════════════════════════════════════════\n';
        
        const byCategory = {};
        tipos.forEach(t => {
            const cat = INSTRUMENT_TYPES[t].category;
            if (!byCategory[cat]) byCategory[cat] = [];
            byCategory[cat].push(t);
        });
        
        for (const [cat, items] of Object.entries(byCategory)) {
            msg += '\n📁 ' + cat + ' (' + items.length + '):\n';
            items.forEach(i => {
                msg += '   • ' + i + ' (' + INSTRUMENT_TYPES[i].symbol + ') - ' + INSTRUMENT_TYPES[i].location + '\n';
            });
        }
        
        msg += '══════════════════════════════════════════';
        _notify(msg, false);
        return tipos;
    }
    
    // ================================================================
    //  VALIDACIÓN DTI
    // ================================================================
    
    function validateDTI() {
        if (!_core) return { valid: true, issues: [] };
        
        const issues = [];
        const instruments = _core.getInstruments();
        const loops = _core.getLoops();
        const lines = _core.getLines();
        const equipos = _core.getEquipos();
        
        instruments.forEach(inst => {
            const isa = validateISATag(inst.tag);
            if (!isa.valid) {
                issues.push({ type: 'TAG_ISA_INVALIDO', instrument: inst.tag, msg: isa.msg });
            }
            
            if (!inst.lineTag && !inst.equipmentTag) {
                issues.push({ type: 'SIN_VINCULACION', instrument: inst.tag, msg: 'No vinculado a línea o equipo' });
            }
            
            if (inst.lineTag) {
                const line = _core.findObjectByTag(inst.lineTag);
                if (!line || !lines.includes(line)) {
                    issues.push({ type: 'LINEA_FALTANTE', instrument: inst.tag, msg: 'Línea ' + inst.lineTag + ' no existe' });
                }
            }
            
            if (inst.equipmentTag) {
                const eq = _core.findObjectByTag(inst.equipmentTag);
                if (!eq || !equipos.includes(eq)) {
                    issues.push({ type: 'EQUIPO_FALTANTE', instrument: inst.tag, msg: 'Equipo ' + inst.equipmentTag + ' no existe' });
                }
            }
            
            if (!inst.range) {
                issues.push({ type: 'RANGO_FALTANTE', instrument: inst.tag, msg: 'Rango no especificado' });
            }
            
            // Validar tipo contra catálogo
            const typeValidation = validateInstrumentType(inst.type);
            if (!typeValidation.valid) {
                issues.push({ type: 'TIPO_INVALIDO', instrument: inst.tag, msg: typeValidation.msg });
            }
        });
        
        loops.forEach(loop => {
            if (loop.sensor && !_core.getInstrumentByTag(loop.sensor)) {
                issues.push({ type: 'LAZO_SENSOR_FALTANTE', loop: loop.tag, msg: 'Sensor ' + loop.sensor + ' no existe' });
            }
            if (loop.controller && !_core.getInstrumentByTag(loop.controller)) {
                issues.push({ type: 'LAZO_CONTROLLER_FALTANTE', loop: loop.tag, msg: 'Controlador ' + loop.controller + ' no existe' });
            }
            if (loop.valve && !_core.getInstrumentByTag(loop.valve)) {
                issues.push({ type: 'LAZO_VALVE_FALTANTE', loop: loop.tag, msg: 'Válvula ' + loop.valve + ' no existe' });
            }
        });
        
        let report = '--- VALIDACIÓN DTI ---\n';
        if (issues.length === 0) {
            report += '✅ DTI íntegro.\n';
        } else {
            const byType = {};
            issues.forEach(i => {
                if (!byType[i.type]) byType[i.type] = [];
                byType[i.type].push(i);
            });
            for (const [type, items] of Object.entries(byType)) {
                report += '\n⚠️ ' + type + ' (' + items.length + '):\n';
                items.forEach(item => report += '   • ' + item.msg + '\n');
            }
        }
        report += '══════════════════════';
        
        _notify(report, issues.length > 0);
        return { valid: issues.length === 0, issues, report };
    }
    
    // ================================================================
    //  EXPORTACIÓN DATOS DTI
    // ================================================================
    
    function exportDTIData() {
        const instruments = _core.getInstruments();
        const loops = _core.getLoops();
        
        const instHeaders = [
            'TAG', 'TYPE', 'LINE_TAG', 'EQUIPMENT_TAG', 'POSITION',
            'RANGE', 'SIGNAL', 'LOCATION', 'LOOP_TAG',
            'ISA_VARIABLE', 'ISA_FUNCTIONS', 'CRITICALITY'
        ];
        const instRows = [instHeaders];
        instruments.forEach(i => {
            instRows.push([
                i.tag, i.type, i.lineTag || '', i.equipmentTag || '',
                i.position, i.range, i.signal, i.location, i.loopTag || '',
                i.isaVariable || '', (i.isaFunctions || []).join(','), i.criticality || 'NORMAL'
            ]);
        });
        
        const loopHeaders = ['TAG', 'TYPE', 'SENSOR', 'CONTROLLER', 'VALVE', 'SETPOINT', 'RANGE'];
        const loopRows = [loopHeaders];
        loops.forEach(l => {
            loopRows.push([l.tag, l.type, l.sensor, l.controller, l.valve, l.setpoint || '', l.range || '']);
        });
        
        return { instruments: instRows, loops: loopRows };
    }
    
    // ================================================================
    //  INICIALIZACIÓN
    // ================================================================
    
    function init(coreInstance, catalogInstance, notifyFn) {
        _core = coreInstance;
        _catalog = catalogInstance || null;
        _notify = notifyFn || _notify;
        console.log('SmartFlowDTI v1.1 inicializado | Tipos: ' + Object.keys(INSTRUMENT_TYPES).length + 
                    ' | Lazos: ' + Object.keys(LOOP_TYPES).length + 
                    ' | ISA-5.1: ✅ | Catálogo: ' + (_catalog ? '✅' : '⚠️ no disponible'));
    }
    
    // ================================================================
    //  API PÚBLICA
    // ================================================================
    
    return {
        init: init,
        createInstrument: createInstrument,
        addComponentToLine: addComponentToLine,
        createLoop: createLoop,
        getInstrumentInfo: getInstrumentInfo,
        listInstruments: listInstruments,
        listLoops: listLoops,
        listInstrumentTypes: listInstrumentTypes,
        validateDTI: validateDTI,
        validateISATag: validateISATag,
        inferInstrumentType: inferInstrumentType,
        validateInstrumentType: validateInstrumentType,
        validateComponentType: validateComponentType,
        exportDTIData: exportDTIData,
        INSTRUMENT_TYPES: INSTRUMENT_TYPES,
        LOOP_TYPES: LOOP_TYPES,
        ISA_LETTERS: ISA_LETTERS
    };
})();
