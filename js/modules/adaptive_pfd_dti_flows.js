
// ============================================================
// SMARTFLOW ADAPTIVE FLOWS - PFD + DTI
// Archivo: js/modules/adaptive_pfd_dti_flows.js
// Extiende AdaptiveCommandSystem con flujos para PFD y DTI
// ============================================================

(function() {
    
    if (typeof AdaptiveCommandSystem === 'undefined') {
        console.warn('AdaptiveCommandSystem no disponible');
        return;
    }
    
    // ================================================================
    //  FUNCIONES AUXILIARES
    // ================================================================
    
    function getEquiposList() {
        if (typeof SmartFlowCore === 'undefined') return [];
        return SmartFlowCore.getEquipos().map(function(e) {
            return { 
                value: e.tag, 
                label: e.tag + ' (' + (e.tipo || '?') + ')', 
                icon: '📦',
                description: e.tipo || 'Equipo'
            };
        });
    }
    
    function getLineasList() {
        if (typeof SmartFlowCore === 'undefined') return [];
        return SmartFlowCore.getLines().map(function(l) {
            return { 
                value: l.tag, 
                label: l.tag + ' ' + (l.diameter || '?') + '" ' + (l.spec || '') + ' ' + (l.material || ''), 
                icon: '📏',
                description: (l.diameter || '?') + '" ' + (l.spec || 'STD')
            };
        });
    }
    
    function getPuertosAbiertos(equipoTag) {
        if (typeof SmartFlowCore === 'undefined') return [];
        var eq = SmartFlowCore.findObjectByTag(equipoTag);
        if (!eq || !eq.puertos) return [];
        return eq.puertos.filter(function(p) { return p.status === 'open' || !p.connectedTo; }).map(function(p) {
            return {
                value: p.id,
                label: p.id + ' ⌀' + (p.diametro || '?') + '" ' + (p.status === 'open' ? '🟢' : ''),
                icon: '🔌',
                description: 'Diámetro: ' + (p.diametro || '?') + '" | Status: ' + (p.status || 'open'),
                status: p.status
            };
        });
    }
    
    // ================================================================
    //  PLANTILLA: CREAR EQUIPO LÓGICO (PFD)
    // ================================================================
    
    function createEquipoFlow(tipo, nombre, icono) {
        return {
            name: nombre,
            icon: icono,
            steps: [
                {
                    type: 'text',
                    title: '① Tag del equipo',
                    placeholder: 'Ej: TK-101',
                    fieldId: 'tag',
                    description: 'Identificador único del equipo'
                },
                {
                    type: 'select',
                    title: '② Material',
                    fieldId: 'material',
                    options: [
                        { value: 'PPR', label: 'PPR' },
                        { value: 'ACERO_CARBONO', label: 'Acero al Carbono' },
                        { value: 'ACERO_INOXIDABLE', label: 'Acero Inoxidable' },
                        { value: 'HDPE', label: 'HDPE' },
                        { value: 'PVC', label: 'PVC' }
                    ]
                },
                {
                    type: 'info',
                    message: '✅ El equipo se creará como equipo lógico en el PFD.\nPodrá posicionarlo con coordenadas 3D en el módulo ISO.',
                    isFinal: true,
                    buildCommand: function(value, selections) {
                        var tag = selections.tag || (tipo.substring(0,2).toUpperCase() + '-001');
                        var cmd = 'create equipo ' + tipo + ' ' + tag;
                        if (selections.material) cmd += ' material ' + selections.material;
                        return cmd;
                    }
                }
            ]
        };
    }
    
    // ================================================================
    //  FLUJOS PFD
    // ================================================================
    
    AdaptiveCommandSystem.COMMAND_FLOWS['create_equipo_tanque_v'] = createEquipoFlow('tanque_v', 'Tanque Vertical', '🛢️');
    AdaptiveCommandSystem.COMMAND_FLOWS['create_equipo_bomba'] = createEquipoFlow('bomba', 'Bomba Centrífuga', '⚙️');
    AdaptiveCommandSystem.COMMAND_FLOWS['create_equipo_intercambiador'] = createEquipoFlow('intercambiador', 'Intercambiador de Calor', '🔥');
    AdaptiveCommandSystem.COMMAND_FLOWS['create_equipo_tanque_h'] = createEquipoFlow('tanque_h', 'Tanque Horizontal', '🛢️');
    AdaptiveCommandSystem.COMMAND_FLOWS['create_equipo_reactor'] = createEquipoFlow('reactor', 'Reactor', '⚗️');
    AdaptiveCommandSystem.COMMAND_FLOWS['create_equipo_torre'] = createEquipoFlow('torre', 'Torre de Destilación', '🗼');
    AdaptiveCommandSystem.COMMAND_FLOWS['create_equipo_compresor'] = createEquipoFlow('compresor', 'Compresor', '💨');
    AdaptiveCommandSystem.COMMAND_FLOWS['create_equipo_separador'] = createEquipoFlow('separador', 'Separador Bifásico', '🔻');
    
    // ================================================================
    //  FLUJO: CREAR CORRIENTE (PFD)
    // ================================================================
    
    AdaptiveCommandSystem.COMMAND_FLOWS['create_stream'] = {
        name: 'Nueva Corriente de Proceso',
        icon: '➡️',
        steps: [
            {
                type: 'text',
                title: '① Tag de la corriente',
                placeholder: 'Ej: S1',
                fieldId: 'tag',
                description: 'Identificador de la corriente (ej: S1, S2, S3)'
            },
            {
                type: 'dynamicSelect',
                title: '② Equipo Origen (From)',
                fieldId: 'from',
                description: 'Seleccione el equipo de donde sale la corriente',
                resolver: function() {
                    var equipos = getEquiposList();
                    if (equipos.length === 0) {
                        return { options: [{ value: '', label: '⚠️ No hay equipos creados. Use "Crear Equipo" primero', icon: '⚠️' }], searchable: false };
                    }
                    return { options: equipos, searchable: true };
                }
            },
            {
                type: 'dynamicSelect',
                title: '③ Equipo Destino (To)',
                fieldId: 'to',
                description: 'Seleccione el equipo a donde llega la corriente',
                resolver: function(selections) {
                    var equipos = getEquiposList().filter(function(e) { return e.value !== selections.from; });
                    if (equipos.length === 0) {
                        return { options: [{ value: '', label: '⚠️ Solo hay un equipo. Cree más equipos.', icon: '⚠️' }], searchable: false };
                    }
                    return { options: equipos, searchable: true };
                }
            },
            {
                type: 'select',
                title: '④ Fluido',
                fieldId: 'fluid',
                options: [
                    { value: 'WATER', label: '💧 WATER - Agua' },
                    { value: 'STEAM', label: '💨 STEAM - Vapor' },
                    { value: 'CONDENSATE', label: '💧 CONDENSATE - Condensado' },
                    { value: 'AIR', label: '🌬️ AIR - Aire Comprimido' },
                    { value: 'NITROGEN', label: '🧪 NITROGEN - Nitrógeno' },
                    { value: 'OXYGEN', label: '🧪 OXYGEN - Oxígeno' },
                    { value: 'NATURAL_GAS', label: '🔥 NATURAL_GAS - Gas Natural' },
                    { value: 'CRUDE_OIL', label: '🛢️ CRUDE_OIL - Petróleo Crudo' },
                    { value: 'DIESEL', label: '⛽ DIESEL' },
                    { value: 'GASOLINE', label: '⛽ GASOLINE' },
                    { value: 'ETHANOL', label: '🧪 ETHANOL' },
                    { value: 'PROCESS_WATER', label: '💧 PROCESS_WATER - Agua de Proceso' },
                    { value: 'COOLING_WATER', label: '❄️ COOLING_WATER - Agua de Enfriamiento' },
                    { value: 'CHILLED_WATER', label: '🧊 CHILLED_WATER - Agua Helada' },
                    { value: 'HOT_OIL', label: '🔥 HOT_OIL - Aceite Térmico' },
                    { value: 'THERMAL_FLUID', label: '🔥 THERMAL_FLUID - Fluido Térmico' },
                    { value: 'GLYCOL', label: '🧪 GLYCOL' },
                    { value: 'BRINE', label: '🧂 BRINE - Salmuera' },
                    { value: 'LUBE_OIL', label: '🛢️ LUBE_OIL - Aceite Lubricante' }
                ]
            },
            {
                type: 'number',
                title: '⑤ Caudal',
                fieldId: 'flow',
                default: 50,
                min: 0,
                max: 10000,
                step: 1,
                description: 'Caudal volumétrico (m³/h)'
            },
            {
                type: 'number',
                title: '⑥ Presión',
                fieldId: 'pressure',
                default: 2,
                min: 0,
                max: 500,
                step: 0.5,
                description: 'Presión de operación (bar)'
            },
            {
                type: 'number',
                title: '⑦ Temperatura',
                fieldId: 'temperature',
                default: 25,
                min: -50,
                max: 500,
                step: 1,
                description: 'Temperatura de operación (°C)'
            },
            {
                type: 'select',
                title: '⑧ Fase',
                fieldId: 'phase',
                options: [
                    { value: 'LIQUID', label: '💧 LÍQUIDO' },
                    { value: 'GAS', label: '💨 GAS' },
                    { value: 'TWO_PHASE', label: '🌫️ DOS FASES' },
                    { value: 'SOLID', label: '🧱 SÓLIDO' },
                    { value: 'SLURRY', label: '💧🧱 LODO' }
                ]
            },
            {
                type: 'text',
                title: '⑨ Servicio (opcional)',
                placeholder: 'Ej: PROCESS, COOLING, HEATING',
                fieldId: 'service',
                description: 'Descripción del servicio'
            },
            {
                type: 'confirm',
                message: '¿Crear la corriente con estos parámetros?',
                isFinal: true,
                buildCommand: function(value, selections) {
                    var parts = ['create stream', selections.tag || 'S1'];
                    if (selections.from) parts.push('from ' + selections.from);
                    if (selections.to) parts.push('to ' + selections.to);
                    if (selections.fluid) parts.push('fluid ' + selections.fluid);
                    if (selections.flow) parts.push('flow ' + selections.flow);
                    if (selections.pressure) parts.push('pressure ' + selections.pressure);
                    if (selections.temperature) parts.push('temperature ' + selections.temperature);
                    if (selections.phase) parts.push('phase ' + selections.phase);
                    if (selections.service) parts.push('service ' + selections.service);
                    return parts.join(' ');
                }
            }
        ]
    };
    
    // ================================================================
    //  FLUJO: BALANCE DE MASA (PFD)
    // ================================================================
    
    AdaptiveCommandSystem.COMMAND_FLOWS['balance_masa'] = {
        name: 'Balance de Masa',
        icon: '⚖️',
        steps: [
            {
                type: 'dynamicSelect',
                title: 'Seleccione el equipo',
                fieldId: 'equipo',
                description: 'Equipo para verificar balance de masa',
                resolver: function() {
                    var equipos = getEquiposList();
                    if (equipos.length === 0) {
                        return { options: [{ value: '', label: '⚠️ No hay equipos', icon: '⚠️' }], searchable: false };
                    }
                    return { options: equipos, searchable: true };
                }
            },
            {
                type: 'confirm',
                message: '¿Verificar balance de masa?',
                isFinal: true,
                buildCommand: function(value, selections) {
                    return 'balance masa ' + (selections.equipo || 'TK-001');
                }
            }
        ]
    };
    
    // ================================================================
    //  FLUJOS DTI - INSTRUMENTOS
    // ================================================================
    
    function buildInstrumentFlow(typeDefault, tagDefault, rangeDefault, nombre, icono) {
        return {
            name: nombre,
            icon: icono,
            steps: [
                {
                    type: 'text',
                    title: '① Tag del instrumento (ISA-5.1)',
                    placeholder: 'Ej: ' + (tagDefault || 'PI-101'),
                    fieldId: 'tag',
                    description: 'Formato estándar: LETRAS-NÚMERO. Ej: PIC-101 (Presión+Indicador+Controlador)'
                },
                {
                    type: 'dynamicSelect',
                    title: '② Línea donde se instala',
                    fieldId: 'line',
                    description: 'Seleccione la línea de tubería',
                    resolver: function() {
                        var lineas = getLineasList();
                        if (lineas.length === 0) {
                            return { options: [{ value: '', label: '⚠️ No hay líneas. Créelas primero en el módulo ISO 3D.', icon: '⚠️' }], searchable: false };
                        }
                        return { options: lineas, searchable: true };
                    }
                },
                {
                    type: 'slider',
                    title: '③ Posición en la línea',
                    fieldId: 'position',
                    min: 0,
                    max: 1,
                    step: 0.01,
                    default: 0.5,
                    description: '0 = inicio de la línea | 0.5 = mitad | 1 = final'
                },
                {
                    type: 'text',
                    title: '④ Rango de medición',
                    placeholder: 'Ej: ' + (rangeDefault || '0-10 bar'),
                    fieldId: 'range',
                    description: 'Rango de operación del instrumento'
                },
                {
                    type: 'select',
                    title: '⑤ Señal',
                    fieldId: 'signal',
                    options: [
                        { value: '4-20mA', label: '4-20 mA (Analógica)' },
                        { value: '0-10V', label: '0-10 V (Analógica)' },
                        { value: 'HART', label: 'HART (Digital sobre analógica)' },
                        { value: 'FIELDBUS', label: 'FIELDBUS (Digital)' },
                        { value: 'PROFIBUS', label: 'PROFIBUS PA' }
                    ]
                },
                {
                    type: 'select',
                    title: '⑥ Ubicación',
                    fieldId: 'location',
                    options: [
                        { value: 'FIELD', label: '🏭 Campo (FIELD)' },
                        { value: 'PANEL', label: '📋 Panel Local (PANEL)' },
                        { value: 'CONTROL_ROOM', label: '🖥️ Sala de Control (CONTROL_ROOM)' }
                    ]
                },
                {
                    type: 'confirm',
                    message: '¿Crear el instrumento con estos parámetros?',
                    isFinal: true,
                    buildCommand: function(value, selections) {
                        var parts = ['create instrument', selections.tag || tagDefault];
                        parts.push('type ' + (typeDefault || 'PRESSURE_GAUGE'));
                        if (selections.line) parts.push('on ' + selections.line);
                        if (selections.position !== undefined) parts.push('at ' + selections.position);
                        if (selections.range) parts.push('range ' + selections.range);
                        if (selections.signal && selections.signal !== '4-20mA') parts.push('signal ' + selections.signal);
                        if (selections.location && selections.location !== 'FIELD') parts.push('location ' + selections.location);
                        return parts.join(' ');
                    }
                }
            ]
        };
    }
    
    // Instrumentos de Campo
    AdaptiveCommandSystem.COMMAND_FLOWS['create_instrument_pg'] = buildInstrumentFlow('PRESSURE_GAUGE', 'PI-101', '0-10 bar', 'Manómetro (PG)', '📟');
    AdaptiveCommandSystem.COMMAND_FLOWS['create_instrument_tg'] = buildInstrumentFlow('TEMPERATURE_GAUGE', 'TI-101', '0-100 °C', 'Termómetro (TG)', '🌡️');
    AdaptiveCommandSystem.COMMAND_FLOWS['create_instrument_pt'] = buildInstrumentFlow('PRESSURE_TRANSMITTER', 'PT-101', '0-16 bar', 'Transmisor de Presión (PT)', '📡');
    AdaptiveCommandSystem.COMMAND_FLOWS['create_instrument_ft'] = buildInstrumentFlow('FLOW_TRANSMITTER', 'FT-101', '0-100 m³/h', 'Transmisor de Flujo (FT)', '📡');
    AdaptiveCommandSystem.COMMAND_FLOWS['create_instrument_tt'] = buildInstrumentFlow('TEMPERATURE_TRANSMITTER', 'TT-101', '0-200 °C', 'Transmisor de Temperatura (TT)', '📡');
    AdaptiveCommandSystem.COMMAND_FLOWS['create_instrument_lt'] = buildInstrumentFlow('LEVEL_TRANSMITTER', 'LT-101', '0-5 m', 'Transmisor de Nivel (LT)', '📡');
    
    // Switch de Nivel (simplificado)
    AdaptiveCommandSystem.COMMAND_FLOWS['create_instrument_ls'] = {
        name: 'Switch de Nivel (LS)',
        icon: '📏',
        steps: [
            { type: 'text', title: '① Tag', placeholder: 'Ej: LS-101', fieldId: 'tag' },
            {
                type: 'dynamicSelect', title: '② Línea', fieldId: 'line',
                resolver: function() {
                    var l = getLineasList();
                    return { options: l.length > 0 ? l : [{ value: '', label: '⚠️ Sin líneas', icon: '⚠️' }], searchable: true };
                }
            },
            { type: 'slider', title: '③ Posición', fieldId: 'position', min: 0, max: 1, step: 0.01, default: 0.8 },
            { type: 'confirm', message: '¿Crear switch de nivel?', isFinal: true,
              buildCommand: function(v, s) { return 'create instrument ' + (s.tag||'LS-101') + ' type LEVEL_SWITCH on ' + (s.line||'L-1') + ' at ' + (s.position||0.8); } }
        ]
    };
    
    // Válvula de Control
    AdaptiveCommandSystem.COMMAND_FLOWS['create_instrument_cv'] = {
        name: 'Válvula de Control (CV)',
        icon: '🔧',
        steps: [
            { type: 'text', title: '① Tag', placeholder: 'Ej: LV-101', fieldId: 'tag' },
            {
                type: 'dynamicSelect', title: '② Línea', fieldId: 'line',
                resolver: function() {
                    var l = getLineasList();
                    return { options: l.length > 0 ? l : [{ value: '', label: '⚠️ Sin líneas', icon: '⚠️' }], searchable: true };
                }
            },
            { type: 'slider', title: '③ Posición', fieldId: 'position', min: 0, max: 1, step: 0.01, default: 0.5 },
            { type: 'text', title: '④ Tamaño (pulgadas)', placeholder: 'Ej: 4', fieldId: 'size', description: 'Opcional - deje vacío para heredar de la línea' },
            { type: 'confirm', message: '¿Crear válvula de control?', isFinal: true,
              buildCommand: function(v, s) { 
                  var cmd = 'create instrument ' + (s.tag||'LV-101') + ' type CONTROL_VALVE on ' + (s.line||'L-1') + ' at ' + (s.position||0.5);
                  if (s.size) cmd += ' diameter ' + s.size;
                  return cmd;
              } }
        ]
    };
    
    // Instrumentos de Panel
    AdaptiveCommandSystem.COMMAND_FLOWS['create_instrument_pic'] = buildInstrumentFlow('PRESSURE_CONTROLLER', 'PIC-101', '0-10 bar', 'Controlador PID Presión (PIC)', '🎛️');
    AdaptiveCommandSystem.COMMAND_FLOWS['create_instrument_fic'] = buildInstrumentFlow('FLOW_CONTROLLER', 'FIC-101', '0-100 m³/h', 'Controlador PID Flujo (FIC)', '🎛️');
    AdaptiveCommandSystem.COMMAND_FLOWS['create_instrument_tic'] = buildInstrumentFlow('TEMPERATURE_CONTROLLER', 'TIC-101', '0-300 °C', 'Controlador PID Temperatura (TIC)', '🎛️');
    AdaptiveCommandSystem.COMMAND_FLOWS['create_instrument_lic'] = buildInstrumentFlow('LEVEL_CONTROLLER', 'LIC-101', '0-5 m', 'Controlador PID Nivel (LIC)', '🎛️');
    
    // ================================================================
    //  FLUJO: CREAR LAZO DE CONTROL (DTI)
    // ================================================================
    
    AdaptiveCommandSystem.COMMAND_FLOWS['create_loop'] = {
        name: 'Nuevo Lazo de Control',
        icon: '🔁',
        steps: [
            {
                type: 'text',
                title: '① Tag del lazo',
                placeholder: 'Ej: LIC-101',
                fieldId: 'tag',
                description: 'Identificador del lazo de control (ej: LIC-101, FIC-201)'
            },
            {
                type: 'text',
                title: '② Sensor / Transmisor',
                placeholder: 'Ej: LT-101',
                fieldId: 'sensor',
                description: 'Tag del instrumento sensor (debe existir)'
            },
            {
                type: 'text',
                title: '③ Controlador',
                placeholder: 'Ej: LIC-101',
                fieldId: 'controller',
                description: 'Tag del controlador (debe existir)'
            },
            {
                type: 'text',
                title: '④ Válvula de Control',
                placeholder: 'Ej: LV-101',
                fieldId: 'valve',
                description: 'Tag de la válvula de control (debe existir)'
            },
            {
                type: 'select',
                title: '⑤ Tipo de Lazo',
                fieldId: 'loopType',
                options: [
                    { value: 'FEEDBACK', label: '🔁 FEEDBACK - Control por Retroalimentación' },
                    { value: 'CASCADE', label: '🔗 CASCADE - Control en Cascada' },
                    { value: 'RATIO', label: '⚖️ RATIO - Control de Relación' },
                    { value: 'FEEDFORWARD', label: '➡️ FEEDFORWARD - Control Pre-alimentado' },
                    { value: 'SPLIT_RANGE', label: '🔀 SPLIT_RANGE - Rango Partido' },
                    { value: 'ON_OFF', label: '🔛 ON_OFF - Control Todo/Nada' },
                    { value: 'SELECTOR', label: '🔍 SELECTOR - Control Selector' }
                ]
            },
            {
                type: 'text',
                title: '⑥ Setpoint (opcional)',
                placeholder: 'Ej: 5 bar',
                fieldId: 'setpoint',
                description: 'Valor de consigna del lazo'
            },
            {
                type: 'confirm',
                message: '¿Crear el lazo de control?',
                isFinal: true,
                buildCommand: function(value, selections) {
                    var parts = ['create loop', selections.tag || 'LIC-101'];
                    if (selections.sensor) parts.push('sensor ' + selections.sensor);
                    if (selections.controller) parts.push('controller ' + selections.controller);
                    if (selections.valve) parts.push('valve ' + selections.valve);
                    if (selections.loopType) parts.push('type ' + selections.loopType);
                    if (selections.setpoint) parts.push('setpoint ' + selections.setpoint);
                    return parts.join(' ');
                }
            }
        ]
    };
    
    // ================================================================
    //  COMANDOS DIRECTOS (sin flujo, ejecución inmediata)
    // ================================================================
    
    var directCommands = {
        // PFD
        'list_streams': { command: 'list streams', icon: '📋', name: 'Listar Corrientes', category: 'pfd_query' },
        'list_equipos': { command: 'list equipos', icon: '📦', name: 'Listar Equipos', category: 'pfd_query' },
        'validate_pfd': { command: 'validate pfd', icon: '🔍', name: 'Validar PFD', category: 'pfd_query' },
        'autolink': { command: 'autolink', icon: '🔗', name: 'Auto-Vincular PFD↔3D', category: 'pfd_query' },
        
        // DTI
        'list_instruments': { command: 'list instruments', icon: '📋', name: 'Listar Instrumentos', category: 'dti_query' },
        'list_loops': { command: 'list loops', icon: '🔄', name: 'Listar Lazos', category: 'dti_query' },
        'list_instrument_types': { command: 'list instrument types', icon: '📁', name: 'Tipos de Instrumentos', category: 'dti_query' },
        'validate_dti': { command: 'validate dti', icon: '🔍', name: 'Validar DTI', category: 'dti_query' },
        
        // Global
        'validate_all': { command: 'validate all', icon: '🔍', name: 'Validar Todo (PFD↔DTI↔3D)', category: 'utility' },
        'project_summary': { command: 'project summary', icon: '📋', name: 'Resumen del Proyecto', category: 'utility' },
        'autofix': { command: 'autofix', icon: '🔧', name: 'Auto-Corregir Issues', category: 'utility' },
        'export_db': { command: 'export db', icon: '🗄️', name: 'Exportar DB Excel', category: 'utility' },
        'export_pcf': { command: 'export pcf', icon: '📥', name: 'Exportar PCF', category: 'utility' },
        'export_mto': { command: 'export mto', icon: '📊', name: 'Exportar MTO', category: 'utility' }
    };
    
    // Registrar en DIRECT_COMMANDS
    Object.keys(directCommands).forEach(function(key) {
        AdaptiveCommandSystem.DIRECT_COMMANDS[key] = directCommands[key];
    });
    
    console.log('✅ Adaptive PFD/DTI Flows v1.0 cargados');
    console.log('   📊 PFD: 8 equipos + 1 stream + 1 balance = 10 flujos');
    console.log('   🔧 DTI: 11 instrumentos + 1 loop = 12 flujos');
    console.log('   🌐 Global: 6 comandos directos');
    
})();
