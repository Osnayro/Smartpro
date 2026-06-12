
// ============================================================
// SMARTFLOW DTI ENGINE v1.0 - Motor de Diagrama de Tuberías e Instrumentación
// Archivo: js/modules/dti_engine.js
// Dependencias: SmartFlowCore v6.0+
// ============================================================
// 
// Gestiona:
//   - Instrumentos de proceso (transmisores, switches, indicadores, válvulas de control)
//   - Lazos de control (PID, On/Off, Cascade, Ratio)
//   - Vinculación DTI ↔ Líneas 3D ↔ Equipos
//   - Validación de integridad DTI contra PFD y modelo 3D
//   - Tags estándar ISA-5.1
//
// ============================================================

const SmartFlowDTI = (function() {
    
    let _core = null;
    let _notify = (msg, isErr) => console.log(msg);
    
    // ================================================================
    //  ESTÁNDAR ISA-5.1: LETRAS DE IDENTIFICACIÓN
    // ================================================================
    const ISA_LETTERS = {
        // Primera letra (Variable medida)
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
        // Segunda/tercera letra (Función)
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
        // Presión
        'PRESSURE_GAUGE':          { symbol: 'PG',  category: 'INDICATOR',    location: 'FIELD' },
        'PRESSURE_TRANSMITTER':    { symbol: 'PT',  category: 'TRANSMITTER',  location: 'FIELD' },
        'PRESSURE_SWITCH':         { symbol: 'PS',  category: 'SWITCH',       location: 'FIELD' },
        'PRESSURE_CONTROLLER':     { symbol: 'PIC', category: 'CONTROLLER',   location: 'PANEL' },
        'PRESSURE_SAFETY_VALVE':   { symbol: 'PSV', category: 'SAFETY',       location: 'FIELD' },
        // Temperatura
        'TEMPERATURE_GAUGE':       { symbol: 'TG',  category: 'INDICATOR',    location: 'FIELD' },
        'TEMPERATURE_TRANSMITTER': { symbol: 'TT',  category: 'TRANSMITTER',  location: 'FIELD' },
        'TEMPERATURE_SWITCH':      { symbol: 'TS',  category: 'SWITCH',       location: 'FIELD' },
        'TEMPERATURE_CONTROLLER':  { symbol: 'TIC', category: 'CONTROLLER',   location: 'PANEL' },
        // Flujo
        'FLOW_METER':              { symbol: 'FG',  category: 'INDICATOR',    location: 'FIELD' },
        'FLOW_TRANSMITTER':        { symbol: 'FT',  category: 'TRANSMITTER',  location: 'FIELD' },
        'FLOW_SWITCH':             { symbol: 'FS',  category: 'SWITCH',       location: 'FIELD' },
        'FLOW_CONTROLLER':         { symbol: 'FIC', category: 'CONTROLLER',   location: 'PANEL' },
        'FLOW_TOTALIZER':          { symbol: 'FQ',  category: 'TOTALIZER',    location: 'PANEL' },
        // Nivel
        'LEVEL_GAUGE':             { symbol: 'LG',  category: 'INDICATOR',    location: 'FIELD' },
        'LEVEL_TRANSMITTER':       { symbol: 'LT',  category: 'TRANSMITTER',  location: 'FIELD' },
        'LEVEL_SWITCH':            { symbol: 'LS',  category: 'SWITCH',       location: 'FIELD' },
        'LEVEL_CONTROLLER':        { symbol: 'LIC', category: 'CONTROLLER',   location: 'PANEL' },
        'LEVEL_SWITCH_RANA':       { symbol: 'LS',  category: 'SWITCH',       location: 'FIELD' },
        // Análisis
        'ANALYSIS_TRANSMITTER':    { symbol: 'AT',  category: 'TRANSMITTER',  location: 'FIELD' },
        'PH_METER':                { symbol: 'AT',  category: 'TRANSMITTER',  location: 'FIELD' },
        'CONDUCTIVITY_METER':      { symbol: 'CT',  category: 'TRANSMITTER',  location: 'FIELD' },
        // Válvulas
        'CONTROL_VALVE':           { symbol: 'CV',  category: 'VALVE',        location: 'FIELD' },
        'ON_OFF_VALVE':            { symbol: 'XV',  category: 'VALVE',        location: 'FIELD' },
        'SAFETY_VALVE':            { symbol: 'SV',  category: 'SAFETY',       location: 'FIELD' },
        // Especiales
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
    //  VALIDACIÓN DE TAGS ISA
    // ================================================================
    
    /**
     * Valida que un tag de instrumento siga el estándar ISA-5.1
     * Ejemplo: PIC-101 = Presión + Indicador + Controlador + Número
     */
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
        
        // Validar primera letra (variable medida)
        const firstLetter = letters[0];
        if (!ISA_LETTERS[firstLetter] || !ISA_LETTERS[firstLetter].variable) {
            return { valid: false, msg: 'Primera letra inválida: ' + firstLetter + ' (debe ser variable medida: P, T, F, L, etc.)' };
        }
        
        return {
            valid: true,
            variable: ISA_LETTERS[firstLetter].variable,
            variableDesc: ISA_LETTERS[firstLetter].description,
            functions: letters.slice(1).split('').map(l => ISA_LETTERS[l]?.function || 'UNKNOWN'),
            number: parseInt(number)
        };
    }
    
    /**
     * Genera automáticamente el tipo de instrumento basado en el tag ISA
     */
    function inferInstrumentType(tag, defaultType) {
        const validation = validateISATag(tag);
        if (!validation.valid) return defaultType || 'PRESSURE_GAUGE';
        
        const functions = validation.functions;
        const variable = validation.variable;
        
        // Si es controlador
        if (functions.includes('CONTROLLER')) {
            return variable + '_CONTROLLER';
        }
        
        // Si es transmisor
        if (functions.includes('TRANSMITTER')) {
            return variable + '_TRANSMITTER';
        }
        
        // Si es switch
        if (functions.includes('SWITCH')) {
            return variable + '_SWITCH';
        }
        
        // Si es indicador
        if (functions.includes('INDICATOR')) {
            if (variable === 'FLOW') return 'FLOW_METER';
            if (variable === 'LEVEL') return 'LEVEL_GAUGE';
            return variable + '_GAUGE';
        }
        
        // Por defecto
        return variable + '_GAUGE';
    }
    
    // ================================================================
    //  CREACIÓN DE INSTRUMENTOS
    // ================================================================
    
    /**
     * Crea un nuevo instrumento
     * @param {Object} params - Parámetros del instrumento
     * @returns {Object|null}
     */
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
        
        // Validar formato ISA
        const isaValidation = validateISATag(params.tag);
        
        // Inferir tipo si no se especificó
        if (!params.type) {
            params.type = inferInstrumentType(params.tag, 'PRESSURE_GAUGE');
        }
        
        // Validar que la línea existe si se especifica
        if (params.lineTag) {
            const line = _core.findObjectByTag(params.lineTag);
            if (!line || !_core.getLines().includes(line)) {
                _notify('⚠️ Línea ' + params.lineTag + ' no encontrada. El instrumento se creará sin vinculación.', false);
            }
        }
        
        // Validar que el equipo existe si se especifica
        if (params.equipmentTag) {
            const eq = _core.findObjectByTag(params.equipmentTag);
            if (!eq || !_core.getEquipos().includes(eq)) {
                _notify('⚠️ Equipo ' + params.equipmentTag + ' no encontrado.', false);
            }
        }
        
        const instrumentData = {
            tag: params.tag,
            type: params.type,
            lineTag: params.lineTag || '',
            equipmentTag: params.equipmentTag || '',
            position: params.position !== undefined ? params.position : 0.5,
            range: params.range || '',
            signal: params.signal || '4-20mA',
            service: params.service || '',
            location: params.location || 'FIELD',
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
            const typeInfo = INSTRUMENT_TYPES[params.type] || {};
            const lineInfo = params.lineTag ? ' en ' + params.lineTag : '';
            const equipInfo = params.equipmentTag ? ' en ' + params.equipmentTag : '';
            
            _notify('✅ Instrumento ' + params.tag + ' (' + params.type + ')' + lineInfo + equipInfo + 
                    ' | Rango: ' + (params.range || 'N/D') + ' | Señal: ' + instrumentData.signal);
            
            if (!isaValidation.valid) {
                _notify('⚠️ El tag ' + params.tag + ' no sigue el estándar ISA-5.1. ' + isaValidation.msg, false);
            }
        }
        
        return result ? _core.getInstrumentByTag(params.tag) : null;
    }
    
    // ================================================================
    //  CREACIÓN DE LAZOS DE CONTROL
    // ================================================================
    
    /**
     * Crea un lazo de control
     * @param {Object} params - Parámetros del lazo
     * @returns {Object|null}
     */
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
        
        // Validar que los instrumentos existen
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
            _notify('📊 No hay instrumentos definidos. Use: create instrument TAG type TIPO on LINEA', false);
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
        
        // Agrupar por tipo
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
        
        // Validar instrumentos
        instruments.forEach(inst => {
            // Verificar formato ISA
            const isa = validateISATag(inst.tag);
            if (!isa.valid) {
                issues.push({
                    type: 'TAG_ISA_INVALIDO',
                    instrument: inst.tag,
                    msg: isa.msg
                });
            }
            
            // Verificar vinculación
            if (!inst.lineTag && !inst.equipmentTag) {
                issues.push({
                    type: 'SIN_VINCULACION',
                    instrument: inst.tag,
                    msg: 'Instrumento no vinculado a ninguna línea o equipo'
                });
            }
            
            // Verificar que la línea existe
            if (inst.lineTag) {
                const line = _core.findObjectByTag(inst.lineTag);
                if (!line || !lines.includes(line)) {
                    issues.push({
                        type: 'LINEA_FALTANTE',
                        instrument: inst.tag,
                        msg: 'Línea ' + inst.lineTag + ' no existe'
                    });
                }
            }
            
            // Verificar que el equipo existe
            if (inst.equipmentTag) {
                const eq = _core.findObjectByTag(inst.equipmentTag);
                if (!eq || !equipos.includes(eq)) {
                    issues.push({
                        type: 'EQUIPO_FALTANTE',
                        instrument: inst.tag,
                        msg: 'Equipo ' + inst.equipmentTag + ' no existe'
                    });
                }
            }
            
            // Verificar rango
            if (!inst.range) {
                issues.push({
                    type: 'RANGO_FALTANTE',
                    instrument: inst.tag,
                    msg: 'Rango no especificado'
                });
            }
        });
        
        // Validar lazos
        loops.forEach(loop => {
            if (loop.sensor && !_core.getInstrumentByTag(loop.sensor)) {
                issues.push({
                    type: 'LAZO_SENSOR_FALTANTE',
                    loop: loop.tag,
                    msg: 'Sensor ' + loop.sensor + ' no existe'
                });
            }
            if (loop.controller && !_core.getInstrumentByTag(loop.controller)) {
                issues.push({
                    type: 'LAZO_CONTROLLER_FALTANTE',
                    loop: loop.tag,
                    msg: 'Controlador ' + loop.controller + ' no existe'
                });
            }
            if (loop.valve && !_core.getInstrumentByTag(loop.valve)) {
                issues.push({
                    type: 'LAZO_VALVE_FALTANTE',
                    loop: loop.tag,
                    msg: 'Válvula ' + loop.valve + ' no existe'
                });
            }
        });
        
        // Reporte
        let report = '--- VALIDACIÓN DTI ---\n';
        if (issues.length === 0) {
            report += '✅ DTI íntegro. Todos los instrumentos y lazos son válidos.\n';
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
        
        // Instrumentos
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
        
        // Lazos
        const loopHeaders = ['TAG', 'TYPE', 'SENSOR', 'CONTROLLER', 'VALVE', 'SETPOINT', 'RANGE'];
        const loopRows = [loopHeaders];
        
        loops.forEach(l => {
            loopRows.push([
                l.tag, l.type, l.sensor, l.controller, l.valve, l.setpoint || '', l.range || ''
            ]);
        });
        
        return { instruments: instRows, loops: loopRows };
    }
    
    // ================================================================
    //  INICIALIZACIÓN
    // ================================================================
    
    function init(coreInstance, notifyFn) {
        _core = coreInstance;
        _notify = notifyFn || _notify;
        console.log('SmartFlowDTI v1.0 inicializado | Tipos: ' + Object.keys(INSTRUMENT_TYPES).length + 
                    ' | Lazos: ' + Object.keys(LOOP_TYPES).length + ' | ISA-5.1: ✅');
    }
    
    // ================================================================
    //  API PÚBLICA
    // ================================================================
    
    return {
        init: init,
        createInstrument: createInstrument,
        createLoop: createLoop,
        getInstrumentInfo: getInstrumentInfo,
        listInstruments: listInstruments,
        listLoops: listLoops,
        validateDTI: validateDTI,
        validateISATag: validateISATag,
        inferInstrumentType: inferInstrumentType,
        exportDTIData: exportDTIData,
        INSTRUMENT_TYPES: INSTRUMENT_TYPES,
        LOOP_TYPES: LOOP_TYPES,
        ISA_LETTERS: ISA_LETTERS
    };
})();
```

---

Comandos para commands.js

```javascript
// ================================================================
//  COMANDOS DTI (Agregar en commands.js)
// ================================================================

function parseCreateInstrument(cmd) {
    const parts = cmd.trim().split(/\s+/);
    if (parts[0] !== 'create' || parts[1] !== 'instrument') return false;
    
    // "create instrument PI-101 type PRESSURE_GAUGE on L-1 at 0.3 range 0-10"
    const tag = parts[2];
    if (!tag) { notifyWithVoice('❌ Uso: create instrument TAG type TIPO on LINEA [at POS] [range RANGO]', true); return true; }
    
    const typeIdx = parts.indexOf('type') !== -1 ? parts.indexOf('type') : parts.indexOf('tipo');
    const onIdx = parts.indexOf('on') !== -1 ? parts.indexOf('on') : parts.indexOf('en');
    const equipIdx = parts.indexOf('equipment') !== -1 ? parts.indexOf('equipment') : parts.indexOf('equipo');
    const atIdx = parts.indexOf('at') !== -1 ? parts.indexOf('at') : parts.indexOf('@');
    const rangeIdx = parts.indexOf('range') !== -1 ? parts.indexOf('range') : parts.indexOf('rango');
    
    const params = { tag: tag };
    
    if (typeIdx !== -1 && typeIdx + 1 < parts.length) {
        params.type = parts[typeIdx + 1].toUpperCase();
    }
    
    if (onIdx !== -1 && onIdx + 1 < parts.length) {
        params.lineTag = parts[onIdx + 1];
    }
    
    if (equipIdx !== -1 && equipIdx + 1 < parts.length) {
        params.equipmentTag = parts[equipIdx + 1];
    }
    
    if (atIdx !== -1 && atIdx + 1 < parts.length) {
        params.position = parseFloat(parts[atIdx + 1]);
    }
    
    if (rangeIdx !== -1 && rangeIdx + 1 < parts.length) {
        params.range = parts[rangeIdx + 1];
    }
    
    // Auto-detectar tipo basado en tag ISA
    if (!params.type && typeof SmartFlowDTI !== 'undefined') {
        params.type = SmartFlowDTI.inferInstrumentType(tag);
    }
    
    if (typeof SmartFlowDTI !== 'undefined') {
        SmartFlowDTI.createInstrument(params);
        return true;
    }
    
    return false;
}

function parseCreateLoop(cmd) {
    const parts = cmd.trim().split(/\s+/);
    if (parts[0] !== 'create' || parts[1] !== 'loop') return false;
    
    // "create loop LIC-101 sensor LT-101 controller LIC-101 valve LV-101 type FEEDBACK"
    const tag = parts[2];
    if (!tag) { notifyWithVoice('❌ Uso: create loop TAG sensor X controller Y valve Z [type TIPO]', true); return true; }
    
    const params = { tag: tag };
    
    for (let i = 3; i < parts.length; i++) {
        const key = parts[i].toLowerCase();
        if (key === 'sensor') params.sensor = parts[++i];
        else if (key === 'controller' || key === 'controlador') params.controller = parts[++i];
        else if (key === 'valve' || key === 'valvula') params.valve = parts[++i];
        else if (key === 'type' || key === 'tipo') params.type = parts[++i]?.toUpperCase();
        else if (key === 'setpoint') params.setpoint = parts[++i];
        else if (key === 'range' || key === 'rango') params.range = parts[++i];
    }
    
    if (typeof SmartFlowDTI !== 'undefined') {
        SmartFlowDTI.createLoop(params);
        return true;
    }
    
    return false;
}

function parseInstrumentInfo(cmd) {
    const parts = cmd.trim().split(/\s+/);
    if (parts[0] !== 'info' || parts[1] !== 'instrument') return false;
    const tag = parts[2];
    if (!tag) { notifyWithVoice('Uso: info instrument TAG', true); return true; }
    if (typeof SmartFlowDTI !== 'undefined') {
        SmartFlowDTI.getInstrumentInfo(tag);
        return true;
    }
    return false;
}

function parseListInstruments(cmd) {
    const parts = cmd.trim().split(/\s+/);
    if (parts[0] !== 'list' || parts[1] !== 'instruments') return false;
    const filter = parts[2] || null;
    if (typeof SmartFlowDTI !== 'undefined') {
        SmartFlowDTI.listInstruments(filter);
        return true;
    }
    return false;
}

function parseListLoops(cmd) {
    const trimmed = cmd.trim().toLowerCase();
    if (trimmed === 'list loops' || trimmed === 'listar lazos') {
        if (typeof SmartFlowDTI !== 'undefined') {
            SmartFlowDTI.listLoops();
            return true;
        }
    }
    return false;
}

function parseValidateDTI(cmd) {
    const trimmed = cmd.trim().toLowerCase();
    if (trimmed === 'validate dti' || trimmed === 'validar dti') {
        if (typeof SmartFlowDTI !== 'undefined') {
            SmartFlowDTI.validateDTI();
            return true;
        }
    }
    return false;
}
```

---

Registro en executeCommand()

```javascript
// ===== COMANDOS DTI =====
if (parseCreateInstrument(trimmed)) { recordCommand(cmd); return true; }
if (parseCreateLoop(trimmed))       { recordCommand(cmd); return true; }
if (parseInstrumentInfo(trimmed))   { recordCommand(cmd); return true; }
if (parseListInstruments(trimmed))  { recordCommand(cmd); return true; }
if (parseListLoops(trimmed))        { recordCommand(cmd); return true; }
if (parseValidateDTI(trimmed))      { recordCommand(cmd); return true; }
