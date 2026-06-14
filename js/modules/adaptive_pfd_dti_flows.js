
(function() {
    
    if (typeof AdaptiveCommandSystem === 'undefined') {
        console.error('AdaptiveCommandSystem no disponible');
        return;
    }
    
    function getEquiposList() {
        if (typeof SmartFlowCore === 'undefined') return [{ value: '', label: 'Core no disponible', icon: '⚠️' }];
        var eqs = SmartFlowCore.getEquipos();
        if (!eqs || eqs.length === 0) return [{ value: '', label: 'No hay equipos. Créelos con: create equipo TIPO TAG', icon: '⚠️' }];
        return eqs.map(function(e) {
            return { value: e.tag, label: e.tag + ' (' + (e.tipo || '?') + ')', icon: '📦', description: e.tipo || 'Equipo' };
        });
    }
    
    function getLineasList() {
        if (typeof SmartFlowCore === 'undefined') return [{ value: '', label: 'Core no disponible', icon: '⚠️' }];
        var ls = SmartFlowCore.getLines();
        if (!ls || ls.length === 0) return [{ value: '', label: 'No hay líneas. Créelas en ISO primero.', icon: '⚠️' }];
        return ls.map(function(l) {
            return { value: l.tag, label: l.tag + ' ' + (l.diameter||'?') + '" ' + (l.spec||''), icon: '📏', description: (l.diameter||'?') + '" ' + (l.spec||'STD') };
        });
    }
    
    function getPuertosAbiertos(equipoTag) {
        if (typeof SmartFlowCore === 'undefined') return [];
        var eq = SmartFlowCore.findObjectByTag(equipoTag);
        if (!eq || !eq.puertos) return [];
        return eq.puertos.filter(function(p) { return p.status === 'open' || !p.connectedTo; }).map(function(p) {
            return { value: p.id, label: p.id + ' ⌀' + (p.diametro || '?') + '" 🟢', icon: '🔌', description: '⌀' + (p.diametro || '?') + '" | Disponible', status: 'open' };
        });
    }

    AdaptiveCommandSystem.COMMAND_FLOWS['create_stream'] = {
        name: 'Nueva Corriente de Proceso', icon: '➡️',
        steps: [
            { type: 'text', title: '① Tag de la corriente', placeholder: 'Ej: S1', fieldId: 'tag' },
            { type: 'select', title: '② Equipo Origen (From)', fieldId: 'from', options: function() { return getEquiposList(); } },
            { type: 'select', title: '③ Equipo Destino (To)', fieldId: 'to',
                options: function(sel, st) { var eqs = getEquiposList(); if (!st || !st.from) return eqs; return eqs.filter(function(e) { return e.value !== st.from; }); }
            },
            { type: 'select', title: '④ Fluido', fieldId: 'fluid',
                options: [
                    { value: 'WATER', label: '💧 WATER' }, { value: 'STEAM', label: '💨 STEAM' },
                    { value: 'CONDENSATE', label: '💧 CONDENSATE' }, { value: 'AIR', label: '🌬️ AIR' },
                    { value: 'NITROGEN', label: '🧪 NITROGEN' }, { value: 'NATURAL_GAS', label: '🔥 NATURAL GAS' },
                    { value: 'CRUDE_OIL', label: '🛢️ CRUDE OIL' }, { value: 'DIESEL', label: '⛽ DIESEL' },
                    { value: 'GASOLINE', label: '⛽ GASOLINE' }, { value: 'ETHANOL', label: '🧪 ETHANOL' },
                    { value: 'PROCESS_WATER', label: '💧 PROCESS WATER' }, { value: 'COOLING_WATER', label: '❄️ COOLING WATER' },
                    { value: 'CHILLED_WATER', label: '🧊 CHILLED WATER' }, { value: 'HOT_OIL', label: '🔥 HOT OIL' },
                    { value: 'THERMAL_FLUID', label: '🔥 THERMAL FLUID' }, { value: 'GLYCOL', label: '🧪 GLYCOL' },
                    { value: 'BRINE', label: '🧂 BRINE' }, { value: 'LUBE_OIL', label: '🛢️ LUBE OIL' }
                ]
            },
            { type: 'number', title: '⑤ Caudal (m³/h)', fieldId: 'flow', default: 50, min: 0, step: 1 },
            { type: 'number', title: '⑥ Presión (bar)', fieldId: 'pressure', default: 2, min: 0, step: 0.5 },
            { type: 'number', title: '⑦ Temperatura (°C)', fieldId: 'temperature', default: 25, min: -50, max: 500, step: 1 },
            { type: 'select', title: '⑧ Fase', fieldId: 'phase',
                options: [{ value: 'LIQUID', label: '💧 LÍQUIDO' }, { value: 'GAS', label: '💨 GAS' }, { value: 'TWO_PHASE', label: '🌫️ DOS FASES' }, { value: 'SOLID', label: '🧱 SÓLIDO' }, { value: 'SLURRY', label: '💧🧱 LODO' }]
            },
            { type: 'text', title: '⑨ Servicio (opcional)', placeholder: 'Ej: PROCESS, COOLING', fieldId: 'service' },
            { type: 'confirm', message: '¿Crear la corriente con estos parámetros?', isFinal: true,
                buildCommand: function(v, st) {
                    var parts = ['create stream', st.tag || 'S1'];
                    if (st.from) parts.push('from ' + st.from);
                    if (st.to) parts.push('to ' + st.to);
                    if (st.fluid) parts.push('fluid ' + st.fluid);
                    if (st.flow) parts.push('flow ' + st.flow);
                    if (st.pressure) parts.push('pressure ' + st.pressure);
                    if (st.temperature) parts.push('temperature ' + st.temperature);
                    if (st.phase) parts.push('phase ' + st.phase);
                    if (st.service) parts.push('service ' + st.service);
                    return parts.join(' ');
                }
            }
        ]
    };

    function crearFlujoEquipo(tipo, nombre, icono) {
        var id = 'create_equipo_' + tipo;
        AdaptiveCommandSystem.COMMAND_FLOWS[id] = {
            name: nombre, icon: icono,
            steps: [
                { type: 'text', title: '① Tag del equipo', placeholder: 'Ej: TK-101', fieldId: 'tag' },
                { type: 'select', title: '② Material', fieldId: 'material',
                    options: function() { return AdaptiveCommandSystem.getMaterialOptions(); }
                },
                { type: 'info', message: '✅ El equipo se creará como equipo lógico en el PFD.\nPodrá posicionarlo en 3D desde el módulo ISO.', isFinal: true,
                    buildCommand: function(v, st) {
                        var cmd = 'create equipo ' + tipo + ' ' + (st.tag || 'EQ-001');
                        if (st.material) cmd += ' material ' + st.material;
                        return cmd;
                    }
                }
            ]
        };
    }

    var equiposPFD = [
        { tipo: 'tanque_v', nombre: 'Tanque Vertical', icono: '🛢️' },
        { tipo: 'bomba', nombre: 'Bomba Centrífuga', icono: '⚙️' },
        { tipo: 'intercambiador', nombre: 'Intercambiador de Calor', icono: '🔥' },
        { tipo: 'tanque_h', nombre: 'Tanque Horizontal', icono: '🛢️' },
        { tipo: 'reactor', nombre: 'Reactor', icono: '⚗️' },
        { tipo: 'torre', nombre: 'Torre de Destilación', icono: '🗼' },
        { tipo: 'compresor', nombre: 'Compresor', icono: '💨' },
        { tipo: 'separador', nombre: 'Separador Bifásico', icono: '🔻' }
    ];

    equiposPFD.forEach(function(eq) { crearFlujoEquipo(eq.tipo, eq.nombre, eq.icono); });

    AdaptiveCommandSystem.COMMAND_FLOWS['balance_masa'] = {
        name: 'Balance de Masa', icon: '⚖️',
        steps: [
            { type: 'select', title: 'Seleccione el equipo', fieldId: 'equipo', options: function() { return getEquiposList(); } },
            { type: 'confirm', message: '¿Verificar balance de masa?', isFinal: true,
                buildCommand: function(v, st) { return 'balance masa ' + (st.equipo || 'TK-001'); }
            }
        ]
    };

    function crearFlujoInstrumento(typeDefault, tagDefault, rangeDefault, nombre, icono) {
        var id = 'create_instrument_' + typeDefault.toLowerCase().replace(/_/g, '_').substring(0, 20);
        AdaptiveCommandSystem.COMMAND_FLOWS[id] = {
            name: nombre, icon: icono,
            steps: [
                { type: 'text', title: '① Tag ISA-5.1', placeholder: 'Ej: ' + tagDefault, fieldId: 'tag' },
                { type: 'select', title: '② Línea', fieldId: 'line', options: function() { return getLineasList(); } },
                { type: 'slider', title: '③ Posición en la línea', fieldId: 'position', min: 0, max: 1, step: 0.01, default: 0.5 },
                { type: 'text', title: '④ Rango', placeholder: 'Ej: ' + rangeDefault, fieldId: 'range' },
                { type: 'select', title: '⑤ Señal', fieldId: 'signal',
                    options: [{ value: '4-20mA', label: '4-20 mA' }, { value: '0-10V', label: '0-10 V' }, { value: 'HART', label: 'HART' }, { value: 'FIELDBUS', label: 'FIELDBUS' }]
                },
                { type: 'select', title: '⑥ Ubicación', fieldId: 'location',
                    options: [{ value: 'FIELD', label: '🏭 Campo' }, { value: 'PANEL', label: '📋 Panel Local' }, { value: 'CONTROL_ROOM', label: '🖥️ Sala de Control' }]
                },
                { type: 'confirm', message: '¿Crear el instrumento?', isFinal: true,
                    buildCommand: function(v, st) {
                        var parts = ['create instrument', st.tag || tagDefault, 'type', typeDefault];
                        if (st.line) parts.push('on ' + st.line);
                        if (st.position !== undefined) parts.push('at ' + st.position);
                        if (st.range) parts.push('range ' + st.range);
                        if (st.signal && st.signal !== '4-20mA') parts.push('signal ' + st.signal);
                        if (st.location && st.location !== 'FIELD') parts.push('location ' + st.location);
                        return parts.join(' ');
                    }
                }
            ]
        };
    }

    var instrumentos = [
        { type: 'PRESSURE_GAUGE', tag: 'PI-101', range: '0-10 bar', nombre: 'Manómetro (PG)', icono: '📟' },
        { type: 'TEMPERATURE_GAUGE', tag: 'TI-101', range: '0-100 °C', nombre: 'Termómetro (TG)', icono: '🌡️' },
        { type: 'PRESSURE_TRANSMITTER', tag: 'PT-101', range: '0-16 bar', nombre: 'Transmisor Presión (PT)', icono: '📡' },
        { type: 'FLOW_TRANSMITTER', tag: 'FT-101', range: '0-100 m³/h', nombre: 'Transmisor Flujo (FT)', icono: '📡' },
        { type: 'LEVEL_SWITCH', tag: 'LS-101', range: '', nombre: 'Switch Nivel (LS)', icono: '📏' },
        { type: 'CONTROL_VALVE', tag: 'LV-101', range: '', nombre: 'Válvula Control (CV)', icono: '🔧' },
        { type: 'PRESSURE_CONTROLLER', tag: 'PIC-101', range: '0-10 bar', nombre: 'Controlador Presión (PIC)', icono: '🎛️' },
        { type: 'FLOW_CONTROLLER', tag: 'FIC-101', range: '0-100 m³/h', nombre: 'Controlador Flujo (FIC)', icono: '🎛️' }
    ];

    instrumentos.forEach(function(inst) { crearFlujoInstrumento(inst.type, inst.tag, inst.range, inst.nombre, inst.icono); });

    AdaptiveCommandSystem.COMMAND_FLOWS['create_loop'] = {
        name: 'Nuevo Lazo de Control', icon: '🔁',
        steps: [
            { type: 'text', title: '① Tag del lazo', placeholder: 'Ej: LIC-101', fieldId: 'tag' },
            { type: 'text', title: '② Sensor / Transmisor', placeholder: 'Ej: LT-101', fieldId: 'sensor' },
            { type: 'text', title: '③ Controlador', placeholder: 'Ej: LIC-101', fieldId: 'controller' },
            { type: 'text', title: '④ Válvula de Control', placeholder: 'Ej: LV-101', fieldId: 'valve' },
            { type: 'select', title: '⑤ Tipo de Lazo', fieldId: 'loopType',
                options: [
                    { value: 'FEEDBACK', label: '🔁 FEEDBACK' }, { value: 'CASCADE', label: '🔗 CASCADE' },
                    { value: 'RATIO', label: '⚖️ RATIO' }, { value: 'FEEDFORWARD', label: '➡️ FEEDFORWARD' },
                    { value: 'SPLIT_RANGE', label: '🔀 SPLIT RANGE' }, { value: 'ON_OFF', label: '🔛 ON/OFF' }
                ]
            },
            { type: 'text', title: '⑥ Setpoint (opcional)', placeholder: 'Ej: 5 bar', fieldId: 'setpoint' },
            { type: 'confirm', message: '¿Crear el lazo de control?', isFinal: true,
                buildCommand: function(v, st) {
                    var parts = ['create loop', st.tag || 'LIC-101'];
                    if (st.sensor) parts.push('sensor ' + st.sensor);
                    if (st.controller) parts.push('controller ' + st.controller);
                    if (st.valve) parts.push('valve ' + st.valve);
                    if (st.loopType) parts.push('type ' + st.loopType);
                    if (st.setpoint) parts.push('setpoint ' + st.setpoint);
                    return parts.join(' ');
                }
            }
        ]
    };

    var directCommands = {
        'list_streams': { command: 'list streams', icon: '📋', name: 'Listar Corrientes', category: 'pfd_query' },
        'list_equipos': { command: 'list equipos', icon: '📦', name: 'Listar Equipos', category: 'pfd_query' },
        'validate_pfd': { command: 'validate pfd', icon: '🔍', name: 'Validar PFD', category: 'pfd_query' },
        'autolink': { command: 'autolink', icon: '🔗', name: 'Auto-Vincular PFD↔3D', category: 'pfd_query' },
        'list_instruments': { command: 'list instruments', icon: '📋', name: 'Listar Instrumentos', category: 'dti_query' },
        'list_loops': { command: 'list loops', icon: '🔄', name: 'Listar Lazos', category: 'dti_query' },
        'list_instrument_types': { command: 'list instrument types', icon: '📁', name: 'Tipos de Instrumentos', category: 'dti_query' },
        'validate_dti': { command: 'validate dti', icon: '🔍', name: 'Validar DTI', category: 'dti_query' },
        'validate_all': { command: 'validate all', icon: '🔍', name: 'Validar Todo', category: 'utility' },
        'project_summary': { command: 'project summary', icon: '📋', name: 'Resumen del Proyecto', category: 'utility' },
        'autofix': { command: 'autofix', icon: '🔧', name: 'Auto-Corregir', category: 'utility' },
        'export_db': { command: 'export db', icon: '🗄️', name: 'Exportar DB Excel', category: 'utility' },
        'export_pcf': { command: 'export pcf', icon: '📥', name: 'Exportar PCF', category: 'utility' },
        'export_mto': { command: 'export mto', icon: '📊', name: 'Exportar MTO', category: 'utility' }
    };

    Object.keys(directCommands).forEach(function(key) {
        if (!AdaptiveCommandSystem.DIRECT_COMMANDS[key]) {
            AdaptiveCommandSystem.DIRECT_COMMANDS[key] = directCommands[key];
        }
    });

    console.log('✅ PFD/DTI Flows v2.0: 8 equipos + 1 stream + 8 instrumentos + 1 loop + 14 comandos directos');
    
})();
