
const AdaptiveCommandSystem = (function() {
    
    let currentState = { commandPath: null, variantId: null, step: 0, selections: {}, flow: null };

    const COMMAND_FLOWS = {

        'PROJECT.SET': {
            name: 'Configurar Proyecto', icon: '⚙️', category: 'config',
            steps: [
                { id: 'selectVariant', title: '¿Qué desea configurar?', type: 'select',
                    options: [
                        { value: 'defaults', label: '📋 Ver configuración actual', description: 'Muestra material y spec por defecto' },
                        { value: 'material', label: '🧪 Cambiar material por defecto', description: 'PPR, Acero, HDPE, PVC...' },
                        { value: 'spec', label: '📋 Cambiar especificación por defecto', description: 'Norma y schedule predeterminados' }
                    ],
                    nextMap: { defaults: 'executeDefaults', material: 'setMaterial', spec: 'setSpec' }
                },
                { id: 'setMaterial', title: 'Seleccione material por defecto', type: 'select',
                    options: () => getMaterialOptions(), isFinal: true, executeImmediately: true,
                    buildCommand: (sel, st) => 'set project material ' + (st.setMaterial || sel)
                },
                { id: 'setSpec', title: 'Seleccione especificación por defecto', type: 'select',
                    options: (sel, st) => getSpecOptions(st.setMaterial), isFinal: true, executeImmediately: true,
                    buildCommand: (sel, st) => 'set project spec ' + (st.setSpec || sel)
                },
                { id: 'executeDefaults', title: 'Configuración actual', type: 'info',
                    message: () => {
                        const defs = (typeof SmartFlowCommands !== 'undefined' && SmartFlowCommands.getProjectDefaults) ? SmartFlowCommands.getProjectDefaults() : { material: 'N/D', spec: 'N/D' };
                        return '📐 Material por defecto: ' + defs.material + '\n📋 Spec por defecto: ' + defs.spec;
                    },
                    isFinal: true, executeImmediately: true, buildCommand: () => 'set project defaults'
                }
            ]
        },

        'CREATE.EQUIPMENT': {
            name: 'Crear Equipo', icon: '🏗️', category: 'create',
            steps: [
                { id: 'tipo', title: 'Seleccione tipo de equipo', type: 'dynamicSelect',
                    options: () => SmartFlowCatalog.listEquipmentTypes().map(t => { const eq = SmartFlowCatalog.getEquipment(t); return { value: t, label: (eq?.nombre || t), icon: getEquipmentIcon(t), description: eq?.categoria || '' }; }),
                    next: 'tag'
                },
                { id: 'tag', title: 'Ingrese Tag del equipo', type: 'text', placeholder: 'Ej: TK-001, B-101, E-201',
                    validate: (v) => { if (!v) return 'Tag requerido'; if (SmartFlowCore.findObjectByTag(v)) return 'Tag ya existe'; return null; },
                    next: 'position'
                },
                { id: 'position', title: 'Posición del equipo (X, Y, Z) en mm', type: 'coordinate', next: 'dimensions' },
                { id: 'dimensions', title: 'Dimensiones del equipo', type: 'form',
                    fields: (st) => {
                        const tipo = st.tipo || ''; const fields = [];
                        if (!['plataforma'].includes(tipo)) fields.push({ id: 'diametro', type: 'number', label: 'Diámetro (mm)', default: 1000, min: 50 });
                        if (!['plataforma'].includes(tipo) && tipo !== 'tanque_h') fields.push({ id: 'altura', type: 'number', label: 'Altura (mm)', default: 1500, min: 50 });
                        if (['tanque_h','plataforma','intercambiador','condensador'].includes(tipo) || (tipo && tipo.includes('bomba'))) fields.push({ id: 'largo', type: 'number', label: 'Largo (mm)', default: 1000, min: 50 });
                        if (['plataforma'].includes(tipo) || (tipo && tipo.includes('skid'))) fields.push({ id: 'ancho', type: 'number', label: 'Ancho (mm)', default: 1000, min: 50 });
                        if (fields.length === 0) { fields.push({ id: 'diametro', type: 'number', label: 'Diámetro (mm)', default: 1000, min: 50 }); fields.push({ id: 'altura', type: 'number', label: 'Altura (mm)', default: 1500, min: 50 }); }
                        return fields;
                    },
                    next: 'specs'
                },
                { id: 'specs', title: 'Especificaciones de material', type: 'form',
                    fields: [
                        { id: 'material', type: 'select', label: 'Material * (requerido)', options: () => getMaterialOptions(), required: true },
                        { id: 'spec', type: 'select', label: 'Especificación', options: (sel, st) => getSpecOptions(st.specs?.material) }
                    ],
                    next: 'connectionsCheck'
                },
                { id: 'connectionsCheck', title: '', type: 'conditional',
                    condition: (st) => { const tipo = st.tipo || ''; const noConnections = ['plataforma','agitador','molino','llenadora']; return !noConnections.includes(tipo); },
                    ifTrue: 'connections', ifFalse: 'extrasCheck'
                },
                { id: 'connections', title: 'Conexiones (opcional)', type: 'form', fields: (st) => getConnectionFields(st.tipo), next: 'extrasCheck' },
                { id: 'extrasCheck', title: '', type: 'conditional',
                    condition: (st) => { const tipo = st.tipo || ''; return ['plataforma','tanque_v','torre','reactor','columna_fraccionadora'].includes(tipo); },
                    ifTrue: 'extras', ifFalse: '__FINAL__'
                },
                { id: 'extras', title: 'Extras (opcional)', type: 'form',
                    fields: [
                        { id: 'baranda', type: 'checkbox', label: 'Incluir baranda' },
                        { id: 'escalera', type: 'checkbox', label: 'Incluir escalera' }
                    ],
                    isFinal: true,
                    buildCommand: (params, st) => {
                        let cmd = 'create ' + st.tipo + ' ' + st.tag + ' at (' + st.position.x + ',' + st.position.y + ',' + st.position.z + ')';
                        const dims = st.dimensions || {};
                        if (dims.diametro) cmd += ' diam ' + dims.diametro;
                        if (dims.altura) cmd += ' height ' + dims.altura;
                        if (dims.largo) cmd += ' largo ' + dims.largo;
                        if (dims.ancho) cmd += ' ancho ' + dims.ancho;
                        const conn = st.connections || {};
                        if (conn.diametro_succion) cmd += ' succion ' + conn.diametro_succion;
                        if (conn.diametro_descarga) cmd += ' descarga ' + conn.diametro_descarga;
                        if (conn.diametro_entrada) cmd += ' entrada ' + conn.diametro_entrada;
                        if (conn.diametro_salida) cmd += ' salida ' + conn.diametro_salida;
                        if (conn.altura_salida_desde_base) cmd += ' altura_salida ' + conn.altura_salida_desde_base;
                        const sp = st.specs || {};
                        if (sp.material) cmd += ' material ' + sp.material;
                        if (sp.spec) cmd += ' spec ' + sp.spec;
                        const ex = st.extras || {};
                        if (ex.baranda) cmd += ' baranda ' + ex.baranda;
                        if (ex.escalera) cmd += ' escalera ' + ex.escalera;
                        return cmd;
                    }
                }
            ]
        },

        'CREATE.LINE': {
            name: 'Crear Línea', icon: '📏', category: 'create',
            steps: [
                { id: 'tag', title: 'Tag de la línea', type: 'text', placeholder: 'Ej: L-001',
                    validate: (v) => v ? (SmartFlowCore.findObjectByTag(v) ? 'Tag ya existe' : null) : 'Tag requerido', next: 'points'
                },
                { id: 'points', title: 'Puntos de ruta', type: 'coordinateList', minPoints: 2, description: 'Agregue al menos 2 puntos (X, Y, Z) en mm', next: 'specs' },
                { id: 'specs', title: 'Especificaciones (opcional - usa default del proyecto)', type: 'form',
                    fields: [
                        { id: 'diameter', type: 'select', label: 'Diámetro (pulg)', options: pipeDiameters(), default: '4' },
                        { id: 'material', type: 'select', label: 'Material (opcional)', options: () => getMaterialOptions() },
                        { id: 'spec', type: 'select', label: 'Especificación (opcional)', options: (sel, st) => getSpecOptions(st.specs?.material) }
                    ],
                    isFinal: true,
                    buildCommand: (params, st) => {
                        let cmd = 'create line ' + st.tag + ' route';
                        st.points.forEach(p => cmd += ' (' + p.x + ',' + p.y + ',' + p.z + ')');
                        const sp = st.specs || {};
                        if (sp.diameter) cmd += ' diameter ' + sp.diameter;
                        if (sp.material) cmd += ' material ' + sp.material;
                        if (sp.spec) cmd += ' spec ' + sp.spec;
                        return cmd;
                    }
                }
            ]
        },

        'CREATE.LINE_FROM_TO': {
            name: 'Línea Entre Equipos', icon: '🔗', category: 'create',
            steps: [
                { id: 'selectVariant', title: 'Modo de conexión', type: 'select',
                    options: [{ value: 'direct', label: '🔗 Conexión directa' }, { value: 'via', label: '🗺️ Con waypoints' }],
                    nextMap: { direct: 'tag', via: 'tag' }
                },
                { id: 'tag', title: 'Tag de la línea', type: 'text', placeholder: 'Ej: L-001',
                    validate: (v) => v ? (SmartFlowCore.findObjectByTag(v) ? 'Tag ya existe' : null) : 'Tag requerido', next: 'fromEquip'
                },
                { id: 'fromEquip', title: 'Equipo origen', type: 'dynamicSelect', options: () => getEquipmentOptions(), next: 'fromPort' },
                { id: 'fromPort', title: 'Puerto origen', type: 'dynamicSelect', options: (sel, st) => getPortOptions(st.fromEquip), next: 'toEquip' },
                { id: 'toEquip', title: 'Equipo destino', type: 'dynamicSelect', options: () => getEquipmentOptions(), next: 'toPort' },
                { id: 'toPort', title: 'Puerto destino', type: 'dynamicSelect', options: (sel, st) => getPortOptions(st.toEquip), next: 'waypointsCheck' },
                { id: 'waypointsCheck', title: 'Waypoints', type: 'conditional', condition: (st) => st.selectVariant === 'via', ifTrue: 'waypoints', ifFalse: 'specs' },
                { id: 'waypoints', title: 'Puntos intermedios (vía)', type: 'coordinateList', minPoints: 1, next: 'specs' },
                { id: 'specs', title: 'Especificaciones de línea (opcional)', type: 'form',
                    fields: [
                        { id: 'diameter', type: 'select', label: 'Diámetro', options: pipeDiameters(), default: '4' },
                        { id: 'material', type: 'select', label: 'Material (opcional)', options: () => getMaterialOptions() },
                        { id: 'spec', type: 'select', label: 'Especificación (opcional)', options: (sel, st) => getSpecOptions(st.specs?.material) }
                    ],
                    isFinal: true,
                    buildCommand: (params, st) => {
                        let cmd = 'line ' + st.tag + ' from ' + st.fromEquip + ' ' + st.fromPort + ' to ' + st.toEquip;
                        if (st.toPort) cmd += ' ' + st.toPort;
                        if (st.waypoints && st.waypoints.length > 0) { cmd += ' via'; st.waypoints.forEach(wp => cmd += ' (' + wp.x + ',' + wp.y + ',' + wp.z + ')'); }
                        const sp = st.specs || {};
                        if (sp.diameter) cmd += ' diameter ' + sp.diameter;
                        if (sp.material) cmd += ' material ' + sp.material;
                        if (sp.spec) cmd += ' spec ' + sp.spec;
                        return cmd;
                    }
                }
            ]
        },

        'CONNECT': {
            name: 'Conectar', icon: '🔌', category: 'connect',
            steps: [
                { id: 'selectVariant', title: 'Tipo de conexión', type: 'select',
                    options: [
                        { value: 'equipment_to_equipment', label: '🏗️ Equipo → Equipo' },
                        { value: 'equipment_to_line', label: '🏗️→📏 Equipo → Línea' },
                        { value: 'line_to_equipment', label: '📏→🏗️ Línea → Equipo' },
                        { value: 'line_to_line', label: '📏→📏 Línea → Línea' },
                        { value: 'via_waypoints', label: '🗺️ Con waypoints' },
                        { value: 'with_orientation', label: '🧭 Con orientación de branch' }
                    ],
                    nextMap: { equipment_to_equipment: 'fromEquip', equipment_to_line: 'fromEquip', line_to_equipment: 'fromLine', line_to_line: 'fromLine', via_waypoints: 'fromEquip', with_orientation: 'fromEquip' }
                },
                { id: 'fromEquip', title: 'Equipo origen', type: 'dynamicSelect', options: () => getEquipmentOptions(), next: 'fromPort',
                    condition: (st) => ['equipment_to_equipment','equipment_to_line','via_waypoints','with_orientation'].includes(st.selectVariant)
                },
                { id: 'fromLine', title: 'Línea origen', type: 'dynamicSelect', options: () => getLineOptions(), next: 'fromPosition',
                    condition: (st) => ['line_to_equipment','line_to_line'].includes(st.selectVariant)
                },
                { id: 'fromPort', title: 'Puerto origen', type: 'dynamicSelect', options: (sel, st) => getPortOptions(st.fromEquip), next: 'toTarget', condition: (st) => st.fromEquip },
                { id: 'fromPosition', title: 'Posición en línea origen (0-1)', type: 'slider', min: 0.01, max: 0.99, step: 0.01, default: 0.5, next: 'toTarget', condition: (st) => st.fromLine },
                { id: 'toTarget', title: 'Tipo de destino', type: 'select',
                    options: (sel, st) => { const opts = [{ value: 'equipment', label: '🏗️ Equipo' }]; if (st.selectVariant !== 'equipment_to_equipment') opts.push({ value: 'line', label: '📏 Línea' }); return opts; },
                    nextMap: { equipment: 'toEquip', line: 'toLine' }
                },
                { id: 'toEquip', title: 'Equipo destino', type: 'dynamicSelect', options: () => getEquipmentOptions(), next: 'toPort' },
                { id: 'toLine', title: 'Línea destino', type: 'dynamicSelect', options: () => getLineOptions(), next: 'toPosition' },
                { id: 'toPort', title: 'Puerto destino', type: 'dynamicSelect', options: (sel, st) => getPortOptions(st.toEquip), next: 'waypointsCheck' },
                { id: 'toPosition', title: 'Posición en línea destino (0-1)', type: 'slider', min: 0.01, max: 0.99, step: 0.01, default: 0.5, next: 'waypointsCheck' },
                { id: 'waypointsCheck', title: 'Configuración adicional', type: 'conditional', condition: (st) => st.selectVariant === 'via_waypoints', ifTrue: 'waypoints', ifFalse: 'orientationCheck' },
                { id: 'waypoints', title: 'Waypoints intermedios', type: 'coordinateList', minPoints: 1, next: 'specs' },
                { id: 'orientationCheck', title: 'Orientación', type: 'conditional', condition: (st) => st.selectVariant === 'with_orientation', ifTrue: 'branchOrientation', ifFalse: 'specs' },
                { id: 'branchOrientation', title: 'Orientación del branch (dx, dy, dz)', type: 'coordinate', next: 'specs' },
                { id: 'specs', title: 'Especificaciones de línea (opcional)', type: 'form',
                    fields: [
                        { id: 'diameter', type: 'select', label: 'Diámetro', options: pipeDiameters(), default: '4' },
                        { id: 'material', type: 'select', label: 'Material (opcional)', options: () => getMaterialOptions() },
                        { id: 'spec', type: 'select', label: 'Especificación (opcional)', options: (sel, st) => getSpecOptions(st.specs?.material) }
                    ],
                    isFinal: true,
                    buildCommand: (params, st) => {
                        let cmd = 'connect ';
                        if (st.fromEquip) { cmd += st.fromEquip + ' ' + st.fromPort; }
                        else if (st.fromLine) { cmd += st.fromLine + ' ' + st.fromPosition; }
                        cmd += ' to ';
                        if (st.toEquip) { cmd += st.toEquip; if (st.toPort) cmd += ' ' + st.toPort; }
                        else if (st.toLine) { cmd += st.toLine + ' ' + st.toPosition; }
                        if (st.waypoints && st.waypoints.length > 0) { cmd += ' via'; st.waypoints.forEach(wp => cmd += ' (' + wp.x + ',' + wp.y + ',' + wp.z + ')'); }
                        if (st.branchOrientation) { cmd += ' orient (' + st.branchOrientation.x + ',' + st.branchOrientation.y + ',' + st.branchOrientation.z + ')'; }
                        const sp = st.specs || {};
                        if (sp.diameter) cmd += ' diameter ' + sp.diameter;
                        if (sp.material) cmd += ' material ' + sp.material;
                        if (sp.spec) cmd += ' spec ' + sp.spec;
                        return cmd;
                    }
                }
            ]
        },

        'ROUTE': {
            name: 'Ruta', icon: '🗺️', category: 'connect',
            steps: [
                { id: 'fromEquip', title: 'Equipo origen', type: 'dynamicSelect', options: () => getEquipmentOptions(), next: 'fromPort' },
                { id: 'fromPort', title: 'Puerto origen', type: 'dynamicSelect', options: (sel, st) => getPortOptions(st.fromEquip), next: 'toEquip' },
                { id: 'toEquip', title: 'Equipo destino', type: 'dynamicSelect', options: () => getEquipmentOptions(), next: 'toPort' },
                { id: 'toPort', title: 'Puerto destino', type: 'dynamicSelect', options: (sel, st) => getPortOptions(st.toEquip), next: 'waypointsCheck' },
                { id: 'waypointsCheck', title: '¿Desea agregar waypoints?', type: 'select',
                    options: [{ value: 'direct', label: '🔗 Ruta directa' }, { value: 'via', label: '🗺️ Con waypoints' }],
                    nextMap: { direct: 'specs', via: 'waypoints' }
                },
                { id: 'waypoints', title: 'Puntos intermedios', type: 'coordinateList', minPoints: 1, next: 'specs' },
                { id: 'specs', title: 'Especificaciones (opcional)', type: 'form',
                    fields: [
                        { id: 'diameter', type: 'select', label: 'Diámetro', options: pipeDiameters(), default: '4' },
                        { id: 'material', type: 'select', label: 'Material (opcional)', options: () => getMaterialOptions() },
                        { id: 'spec', type: 'select', label: 'Especificación (opcional)', options: (sel, st) => getSpecOptions(st.specs?.material) }
                    ],
                    isFinal: true,
                    buildCommand: (params, st) => {
                        let cmd = 'route from ' + st.fromEquip + ' ' + st.fromPort;
                        if (st.waypoints && st.waypoints.length > 0) { cmd += ' via'; st.waypoints.forEach(wp => cmd += ' (' + wp.x + ',' + wp.y + ',' + wp.z + ')'); }
                        cmd += ' to ' + st.toEquip; if (st.toPort) cmd += ' ' + st.toPort;
                        const sp = st.specs || {};
                        if (sp.diameter) cmd += ' diameter ' + sp.diameter;
                        if (sp.material) cmd += ' material ' + sp.material;
                        if (sp.spec) cmd += ' spec ' + sp.spec;
                        return cmd;
                    }
                }
            ]
        },

        'TAP': {
            name: 'Derivar (Tap)', icon: '🔀', category: 'connect',
            steps: [
                { id: 'selectVariant', title: 'Tipo de derivación', type: 'select',
                    options: [{ value: 'standard', label: '🔀 Derivación estándar' }, { value: 'with_orientation', label: '🧭 Con orientación' }],
                    nextMap: { standard: 'fromEquip', with_orientation: 'fromEquip' }
                },
                { id: 'fromEquip', title: 'Equipo origen', type: 'dynamicSelect', options: () => getEquipmentOptions(), next: 'fromPort' },
                { id: 'fromPort', title: 'Puerto origen', type: 'dynamicSelect', options: (sel, st) => getPortOptions(st.fromEquip), next: 'toLine' },
                { id: 'toLine', title: 'Línea destino', type: 'dynamicSelect', options: () => getLineOptions(), next: 'position' },
                { id: 'position', title: 'Posición de derivación (0-1)', type: 'slider', min: 0.02, max: 0.98, step: 0.01, default: 0.5, next: 'orientationCheck' },
                { id: 'orientationCheck', title: 'Orientación', type: 'conditional', condition: (st) => st.selectVariant === 'with_orientation', ifTrue: 'branchOrientation', ifFalse: 'specs' },
                { id: 'branchOrientation', title: 'Dirección del ramal (dx, dy, dz)', type: 'coordinate', next: 'specs' },
                { id: 'specs', title: 'Especificaciones (opcional)', type: 'form',
                    fields: [
                        { id: 'diameter', type: 'select', label: 'Diámetro', options: pipeDiameters(), default: '4' },
                        { id: 'material', type: 'select', label: 'Material (opcional)', options: () => getMaterialOptions() },
                        { id: 'spec', type: 'select', label: 'Especificación (opcional)', options: (sel, st) => getSpecOptions(st.specs?.material) }
                    ],
                    isFinal: true,
                    buildCommand: (params, st) => {
                        let cmd = 'tap ' + st.fromEquip + ' ' + st.fromPort + ' to ' + st.toLine + ' ' + st.position;
                        if (st.branchOrientation) { cmd += ' orient (' + st.branchOrientation.x + ',' + st.branchOrientation.y + ',' + st.branchOrientation.z + ')'; }
                        const sp = st.specs || {};
                        if (sp.diameter) cmd += ' diameter ' + sp.diameter;
                        if (sp.material) cmd += ' material ' + sp.material;
                        if (sp.spec) cmd += ' spec ' + sp.spec;
                        return cmd;
                    }
                }
            ]
        },

        'SPLIT': {
            name: 'Dividir Línea', icon: '✂️', category: 'edit',
            steps: [
                { id: 'lineTag', title: 'Seleccione línea a dividir', type: 'dynamicSelect', options: () => getLineOptions(), next: 'position' },
                { id: 'position', title: 'Punto de división (X, Y, Z)', type: 'coordinate', description: 'Coordenadas del punto de corte en mm', next: 'type' },
                { id: 'type', title: 'Tipo de accesorio', type: 'select', options: [{ value: 'TEE_EQUAL', label: '🔱 TEE Recta' }, { value: 'TEE_REDUCING', label: '🔱 TEE Reductora' }], next: 'splitMaterial' },
                { id: 'splitMaterial', title: 'Material del accesorio', type: 'select', options: () => getMaterialOptions(), next: 'splitSpec' },
                { id: 'splitSpec', title: 'Especificación (opcional)', type: 'select', options: (sel, st) => [{ value: '', label: 'Usar spec de la línea' }, ...getSpecOptions(st.splitMaterial)],
                    isFinal: true, buildCommand: (params, st) => {
                        let cmd = 'split ' + st.lineTag + ' at (' + st.position.x + ',' + st.position.y + ',' + st.position.z + ') type ' + (st.type || 'TEE_EQUAL');
                        if (st.splitMaterial) cmd += ' material ' + st.splitMaterial;
                        if (st.splitSpec) cmd += ' spec ' + st.splitSpec;
                        return cmd;
                    }
                }
            ]
        }
    };

    const DIRECT_COMMANDS = { 'UNDO': { name: 'Deshacer', icon: '↩️', command: 'undo' }, 'REDO': { name: 'Rehacer', icon: '↪️', command: 'redo' } };

    function getConnectionFields(tipo) {
        const fields = [];
        if (tipo.includes('bomba') || tipo === 'compresor') {
            fields.push({ id: 'diametro_succion', type: 'number', label: 'Diámetro Succión (pulg)', default: 3 });
            fields.push({ id: 'diametro_descarga', type: 'number', label: 'Diámetro Descarga (pulg)', default: 3 });
        } else if (['tanque_v', 'tanque_h', 'torre', 'reactor', 'reactor_encamisado', 'autoclave',
                   'separador', 'separador_trifasico', 'slug_catcher', 'clarificador', 'filtro_arena',
                   'filtro_carbon', 'desgasificador', 'desmineralizador', 'suavizador', 'espesador',
                   'floculador', 'columna_fraccionadora', 'absorbedor', 'stripper', 'evaporador',
                   'cristalizador', 'agitador', 'tanque_acero', 'tanque_aseptico', 'tina_quesera',
                   'caldera', 'pasteurizador', 'homogeneizador', 'esterilizador_uht', 'llenadora',
                   'celda_electrolitica', 'canaleta_parshall', 'condensador', 'calentador_fuego_directo',
                   'secador_rotativo', 'filtro_duplex', 'filtro_prensa', 'filtro_tambor',
                   'centrifuga', 'centrifuga_discos', 'molino', 'homogeneizador_ap'].includes(tipo)) {
            fields.push({ id: 'diametro_entrada', type: 'number', label: 'Diámetro Entrada (pulg)', default: 4 });
            fields.push({ id: 'diametro_salida', type: 'number', label: 'Diámetro Salida (pulg)', default: 4 });
            if (['tanque_v', 'torre', 'reactor', 'reactor_encamisado', 'columna_fraccionadora', 
                 'absorbedor', 'stripper', 'evaporador', 'cristalizador', 'agitador', 'caldera'].includes(tipo)) {
                fields.push({ id: 'altura_salida_desde_base', type: 'number', label: 'Altura salida desde base (mm)', default: 0 });
            }
        } else if (tipo === 'osmosis') {
            fields.push({ id: 'diametro_entrada', type: 'number', label: 'Diámetro Alimentación (pulg)', default: 4 });
            fields.push({ id: 'diametro_salida', type: 'number', label: 'Diámetro Permeado (pulg)', default: 2 });
        } else if (tipo === 'antorcha') {
            fields.push({ id: 'diametro_entrada', type: 'number', label: 'Diámetro Gas de Venteo (pulg)', default: 12 });
        } else if (['dosificador_quimico', 'skid_inyeccion'].includes(tipo)) {
            fields.push({ id: 'diametro_succion', type: 'number', label: 'Diámetro Succión (pulg)', default: 1 });
            fields.push({ id: 'diametro_descarga', type: 'number', label: 'Diámetro Descarga (pulg)', default: 1 });
        } else if (tipo === 'bomba_sumergible') {
            fields.push({ id: 'diametro_descarga', type: 'number', label: 'Diámetro Descarga (pulg)', default: 4 });
        }
        return fields;
    }

    function getEquipmentOptions() {
        return SmartFlowCore.getEquipos().map(eq => ({
            value: eq.tag, label: eq.tag + ' - ' + getEquipmentTypeName(eq.tipo),
            icon: getEquipmentIcon(eq.tipo), type: 'equipment'
        }));
    }

    function getLineOptions() {
        return SmartFlowCore.getLines().map(line => ({
            value: line.tag, label: line.tag + ' - ' + line.diameter + '" ' + (line.material || 'STD'),
            icon: '📏', type: 'line'
        }));
    }

    function getAllElementOptions() { return [...getEquipmentOptions(), ...getLineOptions()]; }

    function getPortOptions(tag) {
        if (!tag) return [];
        const obj = SmartFlowCore.findObjectByTag(tag);
        if (!obj || !obj.puertos) return [];
        return obj.puertos.map(p => ({
            value: p.id,
            label: p.id + ' - ⌀' + (p.diametro || '?') + '" [' + (p.status === 'open' ? '🟢 Libre' : '🔴 Conectado') + ']',
            status: p.status
        }));
    }

    function getComponentCategories() {
        return [
            { value: 'VALVE', label: '🔧 Válvulas' }, { value: 'ELBOW', label: '🔀 Codos' },
            { value: 'TEE', label: '🔱 Tees' }, { value: 'REDUCER', label: '🔽 Reductores' },
            { value: 'FLANGE', label: '⭕ Bridas' }, { value: 'STRAINER', label: '🔍 Filtros' },
            { value: 'STEAM_TRAP', label: '💨 Trampas de Vapor' },
            { value: 'INSTRUMENT', label: '📊 Instrumentos' }, { value: 'SUPPORT', label: '📌 Soportes' },
            { value: 'EXPANSION', label: '〰️ Juntas de Expansión' }, { value: 'CONNECTION', label: '🔗 Conexiones' },
            { value: 'SAFETY', label: '🛡️ Seguridad' }, { value: 'SANITARY', label: '🧼 Sanitario' },
            { value: 'HOSE', label: '🔧 Mangueras' }, { value: 'SPECIAL', label: '⚙️ Especiales' },
            { value: 'ALL', label: '📋 Todos los componentes' }
        ];
    }

    function getComponentTypeOptions() {
        const allComponents = []; const seen = new Set();
        const allKeys = SmartFlowCatalog.listComponentTypes();
        allKeys.forEach(key => {
            if (!seen.has(key)) {
                seen.add(key); const comp = SmartFlowCatalog.getComponent(key);
                if (comp) {
                    const tipo = (comp.tipo || key).toUpperCase(); let category = 'SPECIAL';
                    if (tipo.includes('VALVE')) category = 'VALVE';
                    else if (tipo.includes('ELBOW')) category = 'ELBOW';
                    else if (tipo.includes('TEE')) category = 'TEE';
                    else if (tipo.includes('REDUC')) category = 'REDUCER';
                    else if (tipo.includes('FLANGE') || tipo.includes('STUB')) category = 'FLANGE';
                    else if (tipo.includes('STRAINER') || tipo.includes('FILT')) category = 'STRAINER';
                    else if (tipo.includes('TRAP')) category = 'STEAM_TRAP';
                    else if (tipo.includes('GAUGE') || tipo.includes('METER') || tipo.includes('TRANSMITTER') || tipo.includes('SWITCH') || tipo.includes('SIGHT')) category = 'INSTRUMENT';
                    else if (tipo.includes('SHOE') || tipo.includes('GUIDE') || tipo.includes('ANCHOR') || tipo.includes('HANGER') || tipo.includes('SUPPORT') || tipo.includes('CLAMP') || tipo.includes('BOLT')) category = 'SUPPORT';
                    else if (tipo.includes('UNION') || tipo.includes('NIPPL') || tipo.includes('BULKHEAD') || tipo.includes('ADAPT') || tipo.includes('TRANSITION')) category = 'CONNECTION';
                    else if (tipo.includes('EXPANSION')) category = 'EXPANSION';
                    else if (tipo.includes('SILENCER') || tipo.includes('ARRESTER') || tipo.includes('RUPTURE') || tipo.includes('VACUUM') || tipo.includes('SAFETY') || tipo.includes('RELIEF') || tipo.includes('VENT')) category = 'SAFETY';
                    else if (tipo.includes('SPRAY') || tipo.includes('CIP') || tipo.includes('SANITARY') || tipo.includes('ASEPTIC')) category = 'SANITARY';
                    else if (tipo.includes('HOSE') || tipo.includes('MANGUERA')) category = 'HOSE';
                    allComponents.push({
                        value: key, label: (comp.nombre || comp.tipo || key) + ' [' + (comp.material || comp.spec || 'STD') + ']',
                        category, abbr: comp.abbr || '', spec: comp.spec || '', material: comp.material || ''
                    });
                }
            }
        });
        allComponents.sort((a, b) => a.label.localeCompare(b.label));
        return allComponents;
    }

    function getAllComponentOptions() {
        const options = [];
        SmartFlowCore.getLines().forEach(line => {
            if (line.components) {
                line.components.forEach(comp => {
                    options.push({ value: comp.tag, label: comp.tag + ' - ' + (comp.type || '?') + ' [' + line.tag + ']', type: 'component' });
                });
            }
        });
        return options;
    }

    function getMaterialOptions() {
        try {
            const specs = SmartFlowCatalog.getSpecs();
            if (!specs || Object.keys(specs).length === 0) return getDefaultMaterialOptions();
            const materials = new Set();
            Object.values(specs).forEach(s => { if (s.material) materials.add(s.material); });
            const result = Array.from(materials).sort().map(m => ({ value: m.toUpperCase(), label: m }));
            if (result.length === 0) return getDefaultMaterialOptions();
            return result;
        } catch (e) { return getDefaultMaterialOptions(); }
    }

    function getDefaultMaterialOptions() {
        return [
            { value: 'PPR', label: 'PPR' }, { value: 'HDPE', label: 'HDPE' },
            { value: 'ACERO_AL_CARBONO', label: 'Acero al Carbono' },
            { value: 'ACERO_INOXIDABLE', label: 'Acero Inoxidable' },
            { value: 'PVC', label: 'PVC' }, { value: 'CPVC', label: 'CPVC' }
        ];
    }

    function getSpecOptions(material) {
        const allSpecs = SmartFlowCatalog.getSpecs();
        const specs = [];
        Object.entries(allSpecs).forEach(([key, data]) => {
            if (!material) { specs.push({ value: key, label: key, material: data.material || '' }); return; }
            const matUpper = material.toUpperCase().replace(/ /g, '_');
            const specMat = (data.material || '').toUpperCase();
            const specKey = key.toUpperCase();
            if (specMat === matUpper || specMat.includes(matUpper) || matUpper.includes(specMat)) { specs.push({ value: key, label: key, material: data.material || '' }); return; }
            if (matUpper.includes('PPR') && specKey.includes('PPR')) specs.push({ value: key, label: key, material: data.material || '' });
            else if (matUpper.includes('HDPE') && specKey.includes('HDPE')) specs.push({ value: key, label: key, material: data.material || '' });
            else if ((matUpper.includes('ACERO') || matUpper.includes('CARBONO') || matUpper.includes('CS')) && specKey.includes('ACERO') && !specKey.includes('INOX')) specs.push({ value: key, label: key, material: data.material || '' });
            else if ((matUpper.includes('INOX') || matUpper.includes('SS') || matUpper.includes('STAINLESS')) && (specKey.includes('INOX') || specKey.includes('SS') || specKey.includes('SANITARY'))) specs.push({ value: key, label: key, material: data.material || '' });
            else if (matUpper.includes('PVC') && specKey.includes('PVC') && !specKey.includes('CPVC')) specs.push({ value: key, label: key, material: data.material || '' });
        });
        if (specs.length === 0 && material) return Object.keys(allSpecs).map(spec => ({ value: spec, label: spec, material: allSpecs[spec]?.material || '' }));
        return specs;
    }

    function pipeDiameters() {
        return ['2','3','4','6','8','10','12','16','20','24'].map(d => ({ value: d, label: d + '"' }));
    }

    function getEquipmentTypeName(tipo) { const eq = SmartFlowCatalog.getEquipment(tipo); return eq ? eq.nombre : tipo; }

    function getEquipmentIcon(tipo) {
        const icons = { 'tanque_v': '🛢️', 'tanque_h': '🛢️', 'bomba': '⚡', 'intercambiador': '🔥', 'torre': '🗼', 'reactor': '⚗️', 'compresor': '💨', 'separador': '🔀', 'caldera': '🔥', 'plataforma': '🏗️', 'filtro_arena': '🔍', 'osmosis': '💧', 'clarificador': '🔵', 'antorcha': '🔥' };
        return icons[tipo] || '📦';
    }

    function findFinalStep(steps) {
        for (let i = steps.length - 1; i >= 0; i--) { if (steps[i].isFinal && steps[i].buildCommand) return steps[i]; }
        return steps[steps.length - 1];
    }

    function startCommandFlow(commandPath) {
        if (DIRECT_COMMANDS[commandPath]) {
            return { direct: true, command: DIRECT_COMMANDS[commandPath].command, name: DIRECT_COMMANDS[commandPath].name, icon: DIRECT_COMMANDS[commandPath].icon };
        }
        const flow = COMMAND_FLOWS[commandPath];
        if (!flow) return null;
        currentState = { commandPath, variantId: null, step: 0, selections: {}, flow };
        return getCurrentStepData();
    }

    function getCurrentStepData() {
        if (!currentState.flow) return null;
        const steps = currentState.flow.steps;
        let stepIndex = currentState.step;
        let step = steps[stepIndex];
        if (step && step.type === 'conditional' && step.condition && !step.condition(currentState.selections)) {
            if (!step.ifFalse || step.ifFalse === '__FINAL__') {
                const finalStep = findFinalStep(steps);
                if (finalStep && finalStep.buildCommand) {
                    const cmd = finalStep.buildCommand(null, currentState.selections);
                    return { finished: true, command: cmd, executeImmediately: finalStep.executeImmediately || false };
                }
                return null;
            }
            const targetIndex = steps.findIndex(s => s.id === step.ifFalse);
            if (targetIndex >= 0) { currentState.step = targetIndex; stepIndex = targetIndex; step = steps[stepIndex]; }
            else { currentState.step++; stepIndex = currentState.step; step = steps[stepIndex]; }
        }
        if (!step) {
            const finalStep = findFinalStep(steps);
            if (finalStep && finalStep.buildCommand) {
                const cmd = finalStep.buildCommand(null, currentState.selections);
                return { finished: true, command: cmd, executeImmediately: finalStep.executeImmediately || false };
            }
            return null;
        }
        let options = []; 
        if (typeof step.options === 'function') { const depValue = currentState.selections[Object.keys(currentState.selections).pop()]; options = step.options(depValue, currentState.selections); } 
        else if (step.options) { options = step.options; }
        let fields = []; 
        if (typeof step.fields === 'function') { fields = step.fields(currentState.selections); } 
        else { fields = step.fields || []; }
        return {
            commandPath: currentState.commandPath, commandName: currentState.flow.name, commandIcon: currentState.flow.icon,
            stepIndex, totalSteps: steps.filter(s => !s.condition || s.condition(currentState.selections)).length,
            stepId: step.id, title: typeof step.title === 'function' ? step.title(currentState.selections) : step.title,
            type: step.type || 'select', options, fields, isFinal: step.isFinal || false,
            message: typeof step.message === 'function' ? step.message(currentState.selections) : step.message,
            executeImmediately: step.executeImmediately || false, nextMap: step.nextMap || null,
            condition: step.condition || null, progress: Math.min(((stepIndex + 1) / steps.length) * 100, 100),
            minSelect: step.minSelect || 2, minPoints: step.minPoints || 2, default: step.default || null,
            placeholder: step.placeholder || '', min: step.min, max: step.max, step: step.step, description: step.description || '',
            selections: currentState.selections
        };
    }

    function nextStep(selection) {
        if (!currentState.flow) return null;
        const step = currentState.flow.steps[currentState.step];
        if (step && step.id) { currentState.selections[step.id] = selection; }
        let nextStepId = null;
        if (step && step.nextMap && selection) { nextStepId = step.nextMap[selection]; }
        if (!nextStepId && step && step.next) {
            if (typeof step.next === 'function') { nextStepId = step.next(currentState.selections); }
            else { nextStepId = step.next; }
        }
        if (nextStepId && typeof nextStepId === 'string') {
            const targetIndex = currentState.flow.steps.findIndex(s => s.id === nextStepId);
            if (targetIndex >= 0) { currentState.step = targetIndex; return getCurrentStepData(); }
        }
        currentState.step++;
        const nextData = getCurrentStepData();
        if (!nextData || nextData.finished) {
            const finalStep = findFinalStep(currentState.flow.steps);
            if (finalStep && finalStep.buildCommand) {
                const cmd = finalStep.buildCommand(null, currentState.selections);
                return { finished: true, command: cmd, executeImmediately: finalStep.executeImmediately || false, commandName: currentState.flow.name, commandIcon: currentState.flow.icon };
            }
        }
        return nextData;
    }

    function previousStep() {
        if (currentState.step > 0) { currentState.step--; const step = currentState.flow.steps[currentState.step]; if (step && step.id) delete currentState.selections[step.id]; }
        return getCurrentStepData();
    }

    function resetFlow() { currentState = { commandPath: null, variantId: null, step: 0, selections: {}, flow: null }; }

    function getAvailableCommands() {
        const commands = [];
        Object.entries(COMMAND_FLOWS).forEach(([key, flow]) => commands.push({ command: key, name: flow.name, icon: flow.icon, category: flow.category }));
        Object.entries(DIRECT_COMMANDS).forEach(([key, cmd]) => commands.push({ command: key, name: cmd.name, icon: cmd.icon, category: 'direct' }));
        return commands;
    }

    function getCommandsByCategory() {
        const cats = {};
        getAvailableCommands().forEach(cmd => { if (!cats[cmd.category]) cats[cmd.category] = []; cats[cmd.category].push(cmd); });
        return cats;
    }

    return {
        startCommandFlow, getCurrentStepData, nextStep, previousStep, resetFlow,
        getAvailableCommands, getCommandsByCategory, COMMAND_FLOWS, DIRECT_COMMANDS,
        getEquipmentOptions, getLineOptions, getAllElementOptions, getPortOptions,
        getComponentCategories, getComponentTypeOptions, getMaterialOptions, getSpecOptions, pipeDiameters,
        getSelections: function() { return currentState.selections; },
        getConnectionFields: getConnectionFields
    };
})();
