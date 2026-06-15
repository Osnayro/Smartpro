
// ============================================================
// SMARTFLOW ADAPTIVE COMMANDS v2.0
// Sistema de comandos asistido por módulo (Isométrico | PFD | DTI)
// Integración con SmartFlowCommands v5.0 (Maestro Unificado)
// ============================================================

const AdaptiveCommandSystem = (function() {
    
    let _currentModule = 'ISOMETRIC';
    let _core = null;
    
    function setCore(coreInstance) {
        _core = coreInstance;
    }
    
    function setModule(module) {
        _currentModule = module;
    }
    
    function getModule() {
        return _currentModule;
    }
    
    // ============================================================
    // UTILIDADES PARA OBTENER DATOS DEL CORE
    // ============================================================
    
    function getEquipmentOptions() {
        if (!_core) return [];
        return (_core.getEquipos() || []).map(eq => ({
            value: eq.tag,
            label: `${eq.tag} - ${eq.tipo || 'Equipo'}`,
            icon: getEquipmentIcon(eq.tipo),
            type: 'equipment',
            material: eq.material,
            spec: eq.spec,
            posX: eq.posX, posY: eq.posY, posZ: eq.posZ,
            puertos: eq.puertos || []
        }));
    }
    
    function getLineOptions() {
        if (!_core) return [];
        return (_core.getLines() || []).map(line => ({
            value: line.tag,
            label: `${line.tag} - ${line.diameter || '?'}" ${line.material || 'STD'}`,
            icon: '📏',
            type: 'line',
            material: line.material,
            spec: line.spec,
            diameter: line.diameter,
            components: line.components || [],
            puertos: line.puertos || [],
            origin: line.origin,
            destination: line.destination
        }));
    }
    
    function getAllElementOptions() {
        return [...getEquipmentOptions(), ...getLineOptions()];
    }
    
    function getPortOptions(tag, filterOpenOnly = false) {
        if (!_core) return [];
        const obj = _core.findObjectByTag(tag);
        if (!obj || !obj.puertos) return [];
        
        let ports = obj.puertos;
        if (filterOpenOnly) {
            ports = ports.filter(p => p.status === 'open' || !p.connectedTo);
        }
        
        return ports.map(p => ({
            value: p.id,
            label: `${p.id} - ⌀${p.diametro || '?'}" [${p.status === 'open' ? '🟢 Libre' : '🔴 Conectado'}]`,
            status: p.status,
            diametro: p.diametro,
            connectedTo: p.connectedTo,
            fullName: `${tag}.${p.id}`
        }));
    }
    
    function getAvailablePorts(tag) {
        return getPortOptions(tag, true);
    }
    
    function getStreamOptions() {
        if (!_core || !_core.getStreams) return [];
        return (_core.getStreams() || []).map(s => ({
            value: s.tag,
            label: `${s.tag} (${s.from} → ${s.to}) | ${s.fluid} ${s.flow}${s.flowUnit}`,
            from: s.from, to: s.to, fluid: s.fluid, flow: s.flow
        }));
    }
    
    function getInstrumentOptions() {
        if (!_core || !_core.getInstruments) return [];
        return (_core.getInstruments() || []).map(i => ({
            value: i.tag,
            label: `${i.tag} - ${i.type}${i.lineTag ? ` [${i.lineTag}]` : ''}`,
            type: i.type, lineTag: i.lineTag, position: i.position
        }));
    }
    
    function getLoopOptions() {
        if (!_core || !_core.getLoops) return [];
        return (_core.getLoops() || []).map(l => ({
            value: l.tag,
            label: `${l.tag} (${l.sensor} → ${l.controller} → ${l.valve})`,
            sensor: l.sensor, controller: l.controller, valve: l.valve
        }));
    }
    
    function getMaterialOptions() {
        try {
            if (_core && _core.getSpecs) {
                const specs = _core.getSpecs();
                if (specs && Object.keys(specs).length > 0) {
                    const materials = new Set();
                    Object.values(specs).forEach(s => { if (s.material) materials.add(s.material); });
                    const result = Array.from(materials).sort().map(m => ({ value: m.toUpperCase(), label: m }));
                    if (result.length > 0) return result;
                }
            }
        } catch(e) {}
        return [
            { value: 'PPR', label: 'PPR' }, { value: 'HDPE', label: 'HDPE' },
            { value: 'ACERO_AL_CARBONO', label: 'Acero al Carbono' },
            { value: 'ACERO_INOXIDABLE', label: 'Acero Inoxidable' },
            { value: 'PVC', label: 'PVC' }, { value: 'CPVC', label: 'CPVC' }
        ];
    }
    
    function getSpecOptions(material) {
        if (!_core || !_core.getSpecs) return [{ value: 'DEFAULT', label: 'Default' }];
        const allSpecs = _core.getSpecs();
        const specs = [];
        Object.entries(allSpecs).forEach(([key, data]) => {
            if (!material) { specs.push({ value: key, label: key, material: data.material || '' }); return; }
            const matUpper = material.toUpperCase().replace(/ /g, '_');
            const specMat = (data.material || '').toUpperCase();
            if (specMat === matUpper || specMat.includes(matUpper) || matUpper.includes(specMat) ||
                (matUpper.includes('PPR') && key.includes('PPR')) ||
                (matUpper.includes('HDPE') && key.includes('HDPE')) ||
                ((matUpper.includes('ACERO') || matUpper.includes('CARBONO')) && key.includes('ACERO') && !key.includes('INOX')) ||
                ((matUpper.includes('INOX') || matUpper.includes('SS')) && (key.includes('INOX') || key.includes('SS')))) {
                specs.push({ value: key, label: key, material: data.material || '' });
            }
        });
        if (specs.length === 0 && material) {
            return Object.keys(allSpecs).map(spec => ({ value: spec, label: spec }));
        }
        return specs.length > 0 ? specs : [{ value: 'DEFAULT', label: 'Default' }];
    }
    
    function getComponentCategories() {
        return [
            { value: 'VALVE', label: '🔧 Válvulas' }, { value: 'ELBOW', label: '🔀 Codos' },
            { value: 'TEE', label: '🔱 Tees' }, { value: 'REDUCER', label: '🔽 Reductores' },
            { value: 'FLANGE', label: '⭕ Bridas' }, { value: 'STRAINER', label: '🔍 Filtros' },
            { value: 'STEAM_TRAP', label: '💨 Trampas de Vapor' }, { value: 'INSTRUMENT', label: '📊 Instrumentos' },
            { value: 'SUPPORT', label: '📌 Soportes' }, { value: 'SPECIAL', label: '⚙️ Especiales' },
            { value: 'ALL', label: '📋 Todos' }
        ];
    }
    
    function getComponentTypeOptions() {
        if (typeof SmartFlowCatalog !== 'undefined' && SmartFlowCatalog.listComponentTypes) {
            const types = SmartFlowCatalog.listComponentTypes();
            return types.map(t => ({ value: t, label: t, category: getComponentCategory(t) }));
        }
        return [
            { value: 'GATE_VALVE', label: 'Válvula Compuerta', category: 'VALVE' },
            { value: 'BALL_VALVE', label: 'Válvula Esfera', category: 'VALVE' },
            { value: 'BUTTERFLY_VALVE', label: 'Válvula Mariposa', category: 'VALVE' },
            { value: 'CHECK_VALVE', label: 'Válvula Check', category: 'VALVE' },
            { value: 'ELBOW_90', label: 'Codo 90°', category: 'ELBOW' },
            { value: 'ELBOW_45', label: 'Codo 45°', category: 'ELBOW' },
            { value: 'TEE_EQUAL', label: 'Tee Recta', category: 'TEE' },
            { value: 'TEE_REDUCING', label: 'Tee Reductora', category: 'TEE' },
            { value: 'CONCENTRIC_REDUCER', label: 'Reductor Concéntrico', category: 'REDUCER' },
            { value: 'ECCENTRIC_REDUCER', label: 'Reductor Excéntrico', category: 'REDUCER' },
            { value: 'WELD_NECK_FLANGE', label: 'Brida Cuello Soldadura', category: 'FLANGE' },
            { value: 'SLIP_ON_FLANGE', label: 'Brida Deslizante', category: 'FLANGE' },
            { value: 'BLIND_FLANGE', label: 'Brida Ciega', category: 'FLANGE' },
            { value: 'STRAINER', label: 'Filtro', category: 'STRAINER' },
            { value: 'PRESSURE_GAUGE', label: 'Manómetro', category: 'INSTRUMENT' },
            { value: 'TEMPERATURE_GAUGE', label: 'Termómetro', category: 'INSTRUMENT' }
        ];
    }
    
    function getComponentCategory(type) {
        const upper = (type || '').toUpperCase();
        if (upper.includes('VALVE')) return 'VALVE';
        if (upper.includes('ELBOW')) return 'ELBOW';
        if (upper.includes('TEE')) return 'TEE';
        if (upper.includes('REDUC')) return 'REDUCER';
        if (upper.includes('FLANGE')) return 'FLANGE';
        if (upper.includes('STRAINER')) return 'STRAINER';
        if (upper.includes('GAUGE') || upper.includes('METER') || upper.includes('TRANSMITTER')) return 'INSTRUMENT';
        return 'SPECIAL';
    }
    
    function getEquipmentIcon(tipo) {
        const icons = {
            'tanque_v': '🛢️', 'tanque_h': '🛢️', 'bomba': '⚡', 'intercambiador': '🔥',
            'torre': '🗼', 'reactor': '⚗️', 'compresor': '💨', 'separador': '🔀',
            'caldera': '🔥', 'plataforma': '🏗️', 'filtro_arena': '🔍'
        };
        return icons[tipo] || '📦';
    }
    
    function pipeDiameters() {
        return ['2','3','4','6','8','10','12','16','20','24'].map(d => ({ value: d, label: `${d}"` }));
    }
    
    // ============================================================
    // DEFINICIÓN DE FLUJOS DE COMANDOS POR MÓDULO
    // ============================================================
    
    const COMMAND_FLOWS = {};
    
    // ============================================================
    // MÓDULO ISOMÉTRICO - FLUJOS
    // ============================================================
    
    COMMAND_FLOWS['CREATE.EQUIPMENT'] = {
        name: 'Crear Equipo', icon: '🏗️', category: 'create', module: 'ISOMETRIC',
        steps: [
            { id: 'tipo', title: 'Seleccione tipo de equipo', type: 'dynamicSelect',
                options: () => {
                    if (typeof SmartFlowCatalog !== 'undefined' && SmartFlowCatalog.listEquipmentTypes) {
                        return SmartFlowCatalog.listEquipmentTypes().map(t => {
                            const eq = SmartFlowCatalog.getEquipment(t);
                            return { value: t, label: eq?.nombre || t, icon: getEquipmentIcon(t) };
                        });
                    }
                    return [{ value: 'tanque_v', label: 'Tanque Vertical', icon: '🛢️' },
                            { value: 'tanque_h', label: 'Tanque Horizontal', icon: '🛢️' },
                            { value: 'bomba', label: 'Bomba', icon: '⚡' }];
                }, next: 'tag'
            },
            { id: 'tag', title: 'Tag del equipo', type: 'text', placeholder: 'Ej: TK-001, B-101',
                validate: (v) => {
                    if (!v) return 'Tag requerido';
                    if (_core && _core.findObjectByTag(v)) return 'Tag ya existe';
                    return null;
                }, next: 'position'
            },
            { id: 'position', title: 'Posición (X, Y, Z) mm', type: 'coordinate', default: { x: 0, y: 0, z: 0 }, next: 'dimensions' },
            { id: 'dimensions', title: 'Dimensiones', type: 'form',
                fields: (st) => {
                    const fields = [];
                    const tipo = st.tipo || '';
                    if (!['plataforma'].includes(tipo)) fields.push({ id: 'diametro', type: 'number', label: 'Diámetro (mm)', default: 1000 });
                    if (!['plataforma'].includes(tipo) && tipo !== 'tanque_h') fields.push({ id: 'altura', type: 'number', label: 'Altura (mm)', default: 1500 });
                    if (['tanque_h', 'plataforma'].includes(tipo)) fields.push({ id: 'largo', type: 'number', label: 'Largo (mm)', default: 1000 });
                    if (fields.length === 0) fields.push({ id: 'diametro', type: 'number', label: 'Diámetro (mm)', default: 1000 });
                    return fields;
                }, next: 'specs'
            },
            { id: 'specs', title: 'Especificaciones', type: 'form',
                fields: [
                    { id: 'material', type: 'select', label: 'Material', options: () => getMaterialOptions() },
                    { id: 'spec', type: 'select', label: 'Especificación', options: (sel, st) => getSpecOptions(st.specs?.material) }
                ], isFinal: true,
                buildCommand: (params, st) => {
                    let cmd = `create ${st.tipo} ${st.tag} at (${st.position.x},${st.position.y},${st.position.z})`;
                    const dims = st.dimensions || {};
                    if (dims.diametro) cmd += ` diam ${dims.diametro}`;
                    if (dims.altura) cmd += ` height ${dims.altura}`;
                    if (dims.largo) cmd += ` largo ${dims.largo}`;
                    const sp = st.specs || {};
                    if (sp.material) cmd += ` material ${sp.material}`;
                    if (sp.spec) cmd += ` spec ${sp.spec}`;
                    return cmd;
                }
            }
        ]
    };
    
    COMMAND_FLOWS['CREATE.LINE'] = {
        name: 'Crear Línea', icon: '📏', category: 'create', module: 'ISOMETRIC',
        steps: [
            { id: 'tag', title: 'Tag de línea', type: 'text', placeholder: 'Ej: L-001',
                validate: (v) => v ? (_core && _core.findObjectByTag(v) ? 'Tag ya existe' : null) : 'Tag requerido', next: 'points'
            },
            { id: 'points', title: 'Puntos de ruta (mínimo 2)', type: 'coordinateList', minPoints: 2, next: 'specs' },
            { id: 'specs', title: 'Especificaciones', type: 'form',
                fields: [
                    { id: 'diameter', type: 'select', label: 'Diámetro', options: pipeDiameters(), default: '4' },
                    { id: 'material', type: 'select', label: 'Material', options: () => getMaterialOptions() },
                    { id: 'spec', type: 'select', label: 'Especificación', options: (sel, st) => getSpecOptions(st.specs?.material) }
                ], isFinal: true,
                buildCommand: (params, st) => {
                    let cmd = `create line ${st.tag} route`;
                    st.points.forEach(p => cmd += ` (${p.x},${p.y},${p.z})`);
                    const sp = st.specs || {};
                    if (sp.diameter) cmd += ` diameter ${sp.diameter}`;
                    if (sp.material) cmd += ` material ${sp.material}`;
                    if (sp.spec) cmd += ` spec ${sp.spec}`;
                    return cmd;
                }
            }
        ]
    };
    
    COMMAND_FLOWS['CONNECT'] = {
        name: 'Conectar', icon: '🔌', category: 'connect', module: 'ISOMETRIC',
        steps: [
            { id: 'selectVariant', title: 'Tipo de conexión', type: 'select',
                options: [
                    { value: 'equipment_to_equipment', label: '🏗️ Equipo → Equipo' },
                    { value: 'equipment_to_line', label: '🏗️ → 📏 Equipo → Línea' },
                    { value: 'line_to_equipment', label: '📏 → 🏗️ Línea → Equipo' },
                    { value: 'line_to_line', label: '📏 → 📏 Línea → Línea' },
                    { value: 'with_waypoints', label: '🗺️ Con waypoints' }
                ], nextMap: {
                    equipment_to_equipment: 'fromEquip', equipment_to_line: 'fromEquip',
                    line_to_equipment: 'fromLine', line_to_line: 'fromLine', with_waypoints: 'fromEquip'
                }
            },
            { id: 'fromEquip', title: 'Equipo origen', type: 'dynamicSelect',
                options: () => getEquipmentOptions(), next: 'fromPort',
                condition: (st) => ['equipment_to_equipment','equipment_to_line','with_waypoints'].includes(st.selectVariant)
            },
            { id: 'fromLine', title: 'Línea origen', type: 'dynamicSelect',
                options: () => getLineOptions(), next: 'fromPosition',
                condition: (st) => ['line_to_equipment','line_to_line'].includes(st.selectVariant)
            },
            { id: 'fromPort', title: 'Puerto origen (disponibles)', type: 'dynamicSelect',
                options: (sel, st) => getAvailablePorts(st.fromEquip), next: 'toTarget',
                condition: (st) => st.fromEquip
            },
            { id: 'fromPosition', title: 'Posición en línea origen (0-1)', type: 'slider', min: 0.01, max: 0.99, step: 0.01, default: 0.5,
                next: 'toTarget', condition: (st) => st.fromLine
            },
            { id: 'toTarget', title: 'Tipo de destino', type: 'select',
                options: (sel, st) => {
                    const opts = [{ value: 'equipment', label: '🏗️ Equipo' }];
                    if (st.selectVariant !== 'equipment_to_equipment') opts.push({ value: 'line', label: '📏 Línea' });
                    return opts;
                }, nextMap: { equipment: 'toEquip', line: 'toLine' }
            },
            { id: 'toEquip', title: 'Equipo destino', type: 'dynamicSelect',
                options: () => getEquipmentOptions(), next: 'toPort'
            },
            { id: 'toLine', title: 'Línea destino', type: 'dynamicSelect',
                options: () => getLineOptions(), next: 'toPosition'
            },
            { id: 'toPort', title: 'Puerto destino (disponibles)', type: 'dynamicSelect',
                options: (sel, st) => getAvailablePorts(st.toEquip), next: 'waypointsCheck'
            },
            { id: 'toPosition', title: 'Posición en línea destino (0-1)', type: 'slider', min: 0.01, max: 0.99, step: 0.01, default: 0.5,
                next: 'waypointsCheck'
            },
            { id: 'waypointsCheck', title: 'Waypoints', type: 'conditional',
                condition: (st) => st.selectVariant === 'with_waypoints', ifTrue: 'waypoints', ifFalse: 'specs'
            },
            { id: 'waypoints', title: 'Puntos intermedios', type: 'coordinateList', minPoints: 1, next: 'specs' },
            { id: 'specs', title: 'Especificaciones', type: 'form',
                fields: [
                    { id: 'diameter', type: 'select', label: 'Diámetro', options: pipeDiameters(), default: '4' },
                    { id: 'material', type: 'select', label: 'Material', options: () => getMaterialOptions() },
                    { id: 'spec', type: 'select', label: 'Especificación', options: (sel, st) => getSpecOptions(st.specs?.material) }
                ], isFinal: true,
                buildCommand: (params, st) => {
                    let cmd = 'connect ';
                    if (st.fromEquip) cmd += `${st.fromEquip} ${st.fromPort}`;
                    else if (st.fromLine) cmd += `${st.fromLine} ${st.fromPosition}`;
                    cmd += ' to ';
                    if (st.toEquip) { cmd += st.toEquip; if (st.toPort) cmd += ` ${st.toPort}`; }
                    else if (st.toLine) cmd += `${st.toLine} ${st.toPosition}`;
                    if (st.waypoints && st.waypoints.length) { cmd += ' via'; st.waypoints.forEach(wp => cmd += ` (${wp.x},${wp.y},${wp.z})`); }
                    const sp = st.specs || {};
                    if (sp.diameter) cmd += ` diameter ${sp.diameter}`;
                    if (sp.material) cmd += ` material ${sp.material}`;
                    if (sp.spec) cmd += ` spec ${sp.spec}`;
                    return cmd;
                }
            }
        ]
    };
    
    COMMAND_FLOWS['TAP'] = {
        name: 'Derivar (Tap)', icon: '🔀', category: 'connect', module: 'ISOMETRIC',
        steps: [
            { id: 'fromEquip', title: 'Equipo origen', type: 'dynamicSelect',
                options: () => getEquipmentOptions(), next: 'fromPort'
            },
            { id: 'fromPort', title: 'Puerto origen', type: 'dynamicSelect',
                options: (sel, st) => getAvailablePorts(st.fromEquip), next: 'toLine'
            },
            { id: 'toLine', title: 'Línea destino', type: 'dynamicSelect',
                options: () => getLineOptions(), next: 'position'
            },
            { id: 'position', title: 'Posición de derivación (0-1)', type: 'slider', min: 0.02, max: 0.98, step: 0.01, default: 0.5,
                next: 'specs'
            },
            { id: 'specs', title: 'Especificaciones', type: 'form',
                fields: [
                    { id: 'diameter', type: 'select', label: 'Diámetro', options: pipeDiameters(), default: '4' },
                    { id: 'material', type: 'select', label: 'Material', options: () => getMaterialOptions() },
                    { id: 'spec', type: 'select', label: 'Especificación', options: (sel, st) => getSpecOptions(st.specs?.material) }
                ], isFinal: true,
                buildCommand: (params, st) => {
                    let cmd = `tap ${st.fromEquip} ${st.fromPort} to ${st.toLine} ${st.position}`;
                    const sp = st.specs || {};
                    if (sp.diameter) cmd += ` diameter ${sp.diameter}`;
                    if (sp.material) cmd += ` material ${sp.material}`;
                    if (sp.spec) cmd += ` spec ${sp.spec}`;
                    return cmd;
                }
            }
        ]
    };
    
    COMMAND_FLOWS['DELETE'] = {
        name: 'Eliminar', icon: '🗑️', category: 'edit', module: 'ISOMETRIC',
        steps: [
            { id: 'selectType', title: '¿Qué eliminar?', type: 'select',
                options: [
                    { value: 'equipment', label: '🏗️ Equipo (elimina líneas conectadas)' },
                    { value: 'line', label: '📏 Línea (libera puertos)' }
                ], nextMap: { equipment: 'selectEquipment', line: 'selectLine' }
            },
            { id: 'selectEquipment', title: 'Seleccione equipo', type: 'dynamicSelect',
                options: () => getEquipmentOptions(), next: 'confirmEquipment'
            },
            { id: 'confirmEquipment', title: 'Confirmar eliminación', type: 'confirm',
                message: (st) => `¿Eliminar "${st.selectEquipment}"?\nLos puertos quedarán libres.`, isFinal: true,
                buildCommand: (params, st) => `delete equipment ${st.selectEquipment}`
            },
            { id: 'selectLine', title: 'Seleccione línea', type: 'dynamicSelect',
                options: () => getLineOptions(), next: 'confirmLine'
            },
            { id: 'confirmLine', title: 'Confirmar eliminación', type: 'confirm',
                message: (st) => `¿Eliminar línea "${st.selectLine}"?`, isFinal: true,
                buildCommand: (params, st) => `delete line ${st.selectLine}`
            }
        ]
    };
    
    COMMAND_FLOWS['INFO'] = {
        name: 'Información', icon: 'ℹ️', category: 'query', module: 'ISOMETRIC',
        steps: [
            { id: 'selectType', title: 'Tipo de información', type: 'select',
                options: [
                    { value: 'equipment', label: '🏗️ Equipo' }, { value: 'line', label: '📏 Línea' },
                    { value: 'component', label: '🔩 Componente' }
                ], nextMap: { equipment: 'selectEquipment', line: 'selectLine', component: 'selectComponent' }
            },
            { id: 'selectEquipment', title: 'Seleccione equipo', type: 'dynamicSelect',
                options: () => getEquipmentOptions(), isFinal: true, executeImmediately: true,
                buildCommand: (params, st) => `info equipment ${st.selectEquipment}`
            },
            { id: 'selectLine', title: 'Seleccione línea', type: 'dynamicSelect',
                options: () => getLineOptions(), isFinal: true, executeImmediately: true,
                buildCommand: (params, st) => `info line ${st.selectLine}`
            },
            { id: 'selectComponent', title: 'Seleccione componente', type: 'dynamicSelect',
                options: () => {
                    const comps = [];
                    if (_core) {
                        (_core.getLines() || []).forEach(line => {
                            if (line.components) {
                                line.components.forEach(comp => {
                                    comps.push({ value: comp.tag, label: `${comp.tag} - ${comp.type} [${line.tag}]` });
                                });
                            }
                        });
                    }
                    return comps;
                }, isFinal: true, executeImmediately: true,
                buildCommand: (params, st) => `info component ${st.selectComponent}`
            }
        ]
    };
    
    COMMAND_FLOWS['NODES'] = {
        name: 'Ver Nodos', icon: '🔌', category: 'query', module: 'ISOMETRIC',
        steps: [
            { id: 'selectVariant', title: '¿Qué nodos ver?', type: 'select',
                options: [
                    { value: 'all', label: '📋 Todos los nodos' },
                    { value: 'open', label: '🟢 Solo disponibles (libres)' }
                ], nextMap: { all: 'selectElement', open: 'selectElementOpen' }
            },
            { id: 'selectElement', title: 'Seleccione elemento', type: 'dynamicSelect',
                options: () => getAllElementOptions(), isFinal: true, executeImmediately: true,
                buildCommand: (params, st) => `nodos ${st.selectElement}`
            },
            { id: 'selectElementOpen', title: 'Seleccione elemento', type: 'dynamicSelect',
                options: () => getAllElementOptions(), isFinal: true, executeImmediately: true,
                buildCommand: (params, st) => `nodos abiertos ${st.selectElementOpen}`
            }
        ]
    };
    
    COMMAND_FLOWS['MOVE'] = {
        name: 'Mover', icon: '📍', category: 'edit', module: 'ISOMETRIC',
        steps: [
            { id: 'selectElement', title: 'Elemento a mover', type: 'dynamicSelect',
                options: () => getAllElementOptions(), next: 'selectMode'
            },
            { id: 'selectMode', title: 'Modo', type: 'select',
                options: [{ value: 'to', label: '📍 A posición absoluta' }, { value: 'by', label: '↗️ Por incremento' }],
                next: 'coordinates'
            },
            { id: 'coordinates', title: 'Coordenadas (X,Y,Z) mm', type: 'coordinate', isFinal: true,
                buildCommand: (params, st) => {
                    const c = st.coordinates;
                    return st.selectMode === 'to' ? `move ${st.selectElement} to (${c.x},${c.y},${c.z})` : `move ${st.selectElement} by (${c.x},${c.y},${c.z})`;
                }
            }
        ]
    };
    
    COMMAND_FLOWS['BOM'] = {
        name: 'Lista de Materiales', icon: '📊', category: 'utility', module: 'ISOMETRIC',
        steps: [{ id: 'confirm', title: 'Generar BOM', type: 'confirm', message: '¿Generar CSV con materiales?', isFinal: true, buildCommand: () => 'bom' }]
    };
    
    COMMAND_FLOWS['AUDIT'] = {
        name: 'Auditar', icon: '🔍', category: 'utility', module: 'ISOMETRIC',
        steps: [{ id: 'confirm', title: 'Ejecutar Auditoría', type: 'confirm', message: 'Verificar colisiones y discrepancias', isFinal: true, buildCommand: () => 'audit' }]
    };
    
    // ============================================================
    // MÓDULO PFD (Diagrama de Flujo)
    // ============================================================
    
    COMMAND_FLOWS['STREAM.CREATE'] = {
        name: 'Crear Corriente', icon: '💧', category: 'pfd', module: 'PFD',
        steps: [
            { id: 'tag', title: 'Tag de corriente', type: 'text', placeholder: 'Ej: S-101',
                validate: (v) => {
                    if (!v) return 'Tag requerido';
                    if (_core && _core.getStreamByTag && _core.getStreamByTag(v)) return 'Tag ya existe';
                    return null;
                }, next: 'from'
            },
            { id: 'from', title: 'Equipo origen (desde PFD)', type: 'dynamicSelect',
                options: () => getEquipmentOptions().filter(eq => eq.type === 'equipment'), next: 'to'
            },
            { id: 'to', title: 'Equipo destino (desde PFD)', type: 'dynamicSelect',
                options: () => getEquipmentOptions().filter(eq => eq.type === 'equipment'), next: 'fluid'
            },
            { id: 'fluid', title: 'Fluido', type: 'select',
                options: [{ value: 'WATER', label: '💧 Agua' }, { value: 'STEAM', label: '💨 Vapor' },
                          { value: 'AIR', label: '🌬️ Aire' }, { value: 'OIL', label: '🛢️ Aceite' },
                          { value: 'GAS', label: '🔥 Gas' }], next: 'flow'
            },
            { id: 'flow', title: 'Caudal', type: 'form',
                fields: [{ id: 'value', type: 'number', label: 'Valor', default: 0 }, { id: 'unit', type: 'select', label: 'Unidad', options: [{ value: 'm3/h', label: 'm³/h' }, { value: 'kg/h', label: 'kg/h' }], default: 'm3/h' }],
                next: 'pressure'
            },
            { id: 'pressure', title: 'Presión', type: 'form',
                fields: [{ id: 'value', type: 'number', label: 'Valor', default: 0 }, { id: 'unit', type: 'select', label: 'Unidad', options: [{ value: 'bar', label: 'bar' }, { value: 'psi', label: 'psi' }], default: 'bar' }],
                next: 'temperature'
            },
            { id: 'temperature', title: 'Temperatura', type: 'form',
                fields: [{ id: 'value', type: 'number', label: 'Valor', default: 25 }, { id: 'unit', type: 'select', label: 'Unidad', options: [{ value: '°C', label: '°C' }, { value: '°F', label: '°F' }], default: '°C' }],
                isFinal: true,
                buildCommand: (params, st) => {
                    let cmd = `create stream ${st.tag} from ${st.from} to ${st.to} fluid ${st.fluid}`;
                    if (st.flow?.value) cmd += ` flow ${st.flow.value}`;
                    if (st.flow?.unit) cmd += ` flowunit ${st.flow.unit}`;
                    if (st.pressure?.value) cmd += ` pressure ${st.pressure.value}`;
                    if (st.pressure?.unit) cmd += ` pressureunit ${st.pressure.unit}`;
                    if (st.temperature?.value) cmd += ` temperature ${st.temperature.value}`;
                    if (st.temperature?.unit) cmd += ` temperatureunit ${st.temperature.unit}`;
                    return cmd;
                }
            }
        ]
    };
    
    COMMAND_FLOWS['STREAM.LINK'] = {
        name: 'Vincular a Línea 3D', icon: '🔗', category: 'pfd', module: 'PFD',
        steps: [
            { id: 'stream', title: 'Corriente PFD', type: 'dynamicSelect',
                options: () => getStreamOptions(), next: 'line'
            },
            { id: 'line', title: 'Línea 3D (Isométrico)', type: 'dynamicSelect',
                options: () => getLineOptions(), isFinal: true,
                buildCommand: (params, st) => `link stream ${st.stream} to ${st.line}`
            }
        ]
    };
    
    COMMAND_FLOWS['STREAM.LIST'] = {
        name: 'Listar Corrientes', icon: '📋', category: 'pfd', module: 'PFD',
        steps: [{ id: 'filter', title: 'Filtro (opcional)', type: 'text', placeholder: 'Ej: T-101', isFinal: true, executeImmediately: true, buildCommand: (params, st) => st.filter ? `list streams ${st.filter}` : 'list streams' }]
    };
    
    COMMAND_FLOWS['BALANCE.MASA'] = {
        name: 'Balance de Masa', icon: '⚖️', category: 'pfd', module: 'PFD',
        steps: [
            { id: 'equipment', title: 'Equipo a balancear', type: 'dynamicSelect',
                options: () => getEquipmentOptions(), isFinal: true, executeImmediately: true,
                buildCommand: (params, st) => `balance masa ${st.equipment}`
            }
        ]
    };
    
    // ============================================================
    // MÓDULO DTI (Instrumentación)
    // ============================================================
    
    COMMAND_FLOWS['INSTRUMENT.CREATE'] = {
        name: 'Crear Instrumento', icon: '🌡️', category: 'dti', module: 'DTI',
        steps: [
            { id: 'tag', title: 'Tag del instrumento', type: 'text', placeholder: 'Ej: TI-101, PT-202',
                validate: (v) => {
                    if (!v) return 'Tag requerido';
                    if (_core && _core.getInstrumentByTag && _core.getInstrumentByTag(v)) return 'Tag ya existe';
                    return null;
                }, next: 'type'
            },
            { id: 'type', title: 'Tipo', type: 'select',
                options: [
                    { value: 'PRESSURE_GAUGE', label: '📊 Manómetro (PG)' }, { value: 'THERMOMETER', label: '🌡️ Termómetro (T)' },
                    { value: 'FLOW_METER', label: '💧 Medidor Caudal (F)' }, { value: 'LEVEL_GAUGE', label: '📏 Nivel (LG)' },
                    { value: 'PRESSURE_TRANSMITTER', label: '📡 Transmisor Presión (PT)' },
                    { value: 'TEMPERATURE_TRANSMITTER', label: '📡 Transmisor Temp (TT)' },
                    { value: 'CONTROL_VALVE', label: '🔧 Válvula Control (CV)' }
                ], next: 'mounting'
            },
            { id: 'mounting', title: 'Montaje', type: 'select',
                options: [{ value: 'line', label: '📏 En línea' }, { value: 'equipment', label: '🏗️ En equipo' }],
                nextMap: { line: 'lineSelect', equipment: 'equipmentSelect' }
            },
            { id: 'lineSelect', title: 'Línea (3D)', type: 'dynamicSelect',
                options: () => getLineOptions(), next: 'position'
            },
            { id: 'equipmentSelect', title: 'Equipo', type: 'dynamicSelect',
                options: () => getEquipmentOptions(), next: 'portSelect'
            },
            { id: 'portSelect', title: 'Puerto del equipo', type: 'dynamicSelect',
                options: (sel, st) => getPortOptions(st.equipmentSelect), next: 'position'
            },
            { id: 'position', title: 'Posición paramétrica', type: 'slider', min: 0.01, max: 0.99, step: 0.01, default: 0.5,
                next: 'range'
            },
            { id: 'range', title: 'Rango (opcional)', type: 'text', placeholder: 'Ej: 0-100, 0-10 bar', next: 'signal' },
            { id: 'signal', title: 'Señal', type: 'select',
                options: [{ value: '', label: 'No especificado' }, { value: '4-20mA', label: '4-20 mA' }, { value: 'HART', label: 'HART' }],
                isFinal: true,
                buildCommand: (params, st) => {
                    let cmd = `create instrument ${st.tag} type ${st.type}`;
                    if (st.mounting === 'line' && st.lineSelect) cmd += ` on ${st.lineSelect}`;
                    if (st.mounting === 'equipment' && st.equipmentSelect) {
                        cmd += ` equipment ${st.equipmentSelect}`;
                        if (st.portSelect) cmd += ` port ${st.portSelect}`;
                    }
                    cmd += ` at ${st.position || 0.5}`;
                    if (st.range) cmd += ` range ${st.range}`;
                    if (st.signal) cmd += ` signal ${st.signal}`;
                    return cmd;
                }
            }
        ]
    };
    
    COMMAND_FLOWS['LOOP.CREATE'] = {
        name: 'Crear Lazo Control', icon: '🔄', category: 'dti', module: 'DTI',
        steps: [
            { id: 'tag', title: 'Tag del lazo', type: 'text', placeholder: 'Ej: FIC-101',
                validate: (v) => {
                    if (!v) return 'Tag requerido';
                    if (_core && _core.getLoopByTag && _core.getLoopByTag(v)) return 'Tag ya existe';
                    return null;
                }, next: 'type'
            },
            { id: 'type', title: 'Tipo de control', type: 'select',
                options: [{ value: 'FEEDBACK', label: '🔄 Retroalimentación (PID)' }, { value: 'CASCADE', label: '🔁 Cascade' }],
                next: 'sensor'
            },
            { id: 'sensor', title: 'Sensor (instrumento)', type: 'dynamicSelect',
                options: () => getInstrumentOptions(), next: 'controller'
            },
            { id: 'controller', title: 'Controlador', type: 'select',
                options: (sel, st) => {
                    const controllers = getInstrumentOptions().filter(i => i.type.includes('TRANSMITTER'));
                    return controllers.length ? controllers : [{ value: 'DCS', label: '🖥️ DCS' }];
                }, next: 'valve'
            },
            { id: 'valve', title: 'Válvula de control', type: 'dynamicSelect',
                options: () => getInstrumentOptions().filter(i => i.type.includes('CONTROL_VALVE')), next: 'setpoint'
            },
            { id: 'setpoint', title: 'Setpoint', type: 'text', placeholder: 'Ej: 50%, 100°C', isFinal: true,
                buildCommand: (params, st) => {
                    let cmd = `create loop ${st.tag} sensor ${st.sensor} controller ${st.controller} valve ${st.valve} type ${st.type}`;
                    if (st.setpoint) cmd += ` setpoint ${st.setpoint}`;
                    return cmd;
                }
            }
        ]
    };
    
    COMMAND_FLOWS['INSTRUMENT.LIST'] = {
        name: 'Listar Instrumentos', icon: '📋', category: 'dti', module: 'DTI',
        steps: [{ id: 'filter', title: 'Filtro', type: 'text', placeholder: 'Ej: TEMP', isFinal: true, executeImmediately: true, buildCommand: (params, st) => st.filter ? `list instruments ${st.filter}` : 'list instruments' }]
    };
    
    COMMAND_FLOWS['LOOP.LIST'] = {
        name: 'Listar Lazos', icon: '📋', category: 'dti', module: 'DTI',
        steps: [{ id: 'confirm', title: 'Listar lazos', type: 'confirm', message: 'Mostrar todos los lazos', isFinal: true, executeImmediately: true, buildCommand: () => 'list loops' }]
    };
    
    // ============================================================
    // COMANDOS UNIVERSALES (todos los módulos)
    // ============================================================
    
    const DIRECT_COMMANDS = {
        'UNDO': { name: 'Deshacer', icon: '↩️', command: 'undo', module: 'ALL' },
        'REDO': { name: 'Rehacer', icon: '↪️', command: 'redo', module: 'ALL' },
        'HELP': { name: 'Ayuda', icon: '❓', command: 'help', module: 'ALL' }
    };
    
    COMMAND_FLOWS['EXPORT'] = {
        name: 'Exportar', icon: '📁', category: 'utility', module: 'ALL',
        steps: [
            { id: 'format', title: 'Formato', type: 'select',
                options: [{ value: 'json', label: '📄 JSON' }, { value: 'csv', label: '📊 CSV (BOM)' }, { value: 'pcf', label: '📐 PCF' }],
                isFinal: true, buildCommand: (params, st) => `export ${st.format}`
            }
        ]
    };
    
    COMMAND_FLOWS['PROJECT.SET'] = {
        name: 'Configurar Proyecto', icon: '⚙️', category: 'config', module: 'ALL',
        steps: [
            { id: 'selectVariant', title: 'Configurar', type: 'select',
                options: [{ value: 'defaults', label: '📋 Ver actual' }, { value: 'material', label: '🧪 Material' }, { value: 'spec', label: '📋 Especificación' }],
                nextMap: { defaults: 'executeDefaults', material: 'setMaterial', spec: 'setSpec' }
            },
            { id: 'setMaterial', title: 'Material por defecto', type: 'select',
                options: () => getMaterialOptions(), isFinal: true, executeImmediately: true,
                buildCommand: (sel, st) => `set project material ${st.setMaterial || sel}`
            },
            { id: 'setSpec', title: 'Especificación', type: 'select',
                options: (sel, st) => getSpecOptions(st.setMaterial), isFinal: true, executeImmediately: true,
                buildCommand: (sel, st) => `set project spec ${st.setSpec || sel}`
            },
            { id: 'executeDefaults', title: 'Configuración actual', type: 'info',
                message: () => {
                    const defs = (typeof SmartFlowCommands !== 'undefined' && SmartFlowCommands.getProjectDefaults) ? SmartFlowCommands.getProjectDefaults() : { material: 'N/D', spec: 'N/D' };
                    return `📐 Material: ${defs.material}\n📋 Spec: ${defs.spec}`;
                }, isFinal: true, buildCommand: () => 'set project defaults'
            }
        ]
    };
    
    // ============================================================
    // SISTEMA DE ESTADO DEL FLUJO
    // ============================================================
    
    let currentState = { commandPath: null, step: 0, selections: {}, flow: null };
    
    function getCurrentStepData() {
        if (!currentState.flow) return null;
        const steps = currentState.flow.steps;
        let stepIndex = currentState.step;
        let step = steps[stepIndex];
        
        while (step && step.type === 'conditional' && step.condition && !step.condition(currentState.selections)) {
            const targetId = step.ifFalse;
            if (!targetId || targetId === '__FINAL__') {
                const finalStep = findFinalStep(steps);
                if (finalStep && finalStep.buildCommand) {
                    const cmd = finalStep.buildCommand(null, currentState.selections);
                    return { finished: true, command: cmd, executeImmediately: finalStep.executeImmediately || false };
                }
                return null;
            }
            const targetIndex = steps.findIndex(s => s.id === targetId);
            if (targetIndex >= 0) currentState.step = targetIndex;
            else currentState.step++;
            stepIndex = currentState.step;
            step = steps[stepIndex];
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
        if (typeof step.options === 'function') options = step.options(currentState.selections);
        else if (step.options) options = step.options;
        
        let fields = [];
        if (typeof step.fields === 'function') fields = step.fields(currentState.selections);
        else fields = step.fields || [];
        
        return {
            commandPath: currentState.commandPath,
            commandName: currentState.flow.name,
            commandIcon: currentState.flow.icon,
            stepIndex, totalSteps: steps.length,
            stepId: step.id, title: step.title, type: step.type,
            options, fields, isFinal: step.isFinal || false,
            message: typeof step.message === 'function' ? step.message(currentState.selections) : step.message,
            executeImmediately: step.executeImmediately || false,
            nextMap: step.nextMap, condition: step.condition,
            placeholder: step.placeholder, min: step.min, max: step.max,
            selections: currentState.selections
        };
    }
    
    function findFinalStep(steps) {
        for (let i = steps.length - 1; i >= 0; i--) {
            if (steps[i].isFinal && steps[i].buildCommand) return steps[i];
        }
        return steps[steps.length - 1];
    }
    
    function startCommandFlow(commandPath) {
        if (DIRECT_COMMANDS[commandPath]) {
            return { direct: true, command: DIRECT_COMMANDS[commandPath].command, name: DIRECT_COMMANDS[commandPath].name, icon: DIRECT_COMMANDS[commandPath].icon };
        }
        const flow = COMMAND_FLOWS[commandPath];
        if (!flow) return null;
        if (flow.module !== 'ALL' && flow.module !== _currentModule) return null;
        currentState = { commandPath, step: 0, selections: {}, flow };
        return getCurrentStepData();
    }
    
    function nextStep(selection) {
        if (!currentState.flow) return null;
        const step = currentState.flow.steps[currentState.step];
        if (step && step.id) currentState.selections[step.id] = selection;
        
        let nextStepId = null;
        if (step && step.nextMap && selection) nextStepId = step.nextMap[selection];
        if (!nextStepId && step && step.next) nextStepId = step.next;
        
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
        if (currentState.step > 0) {
            currentState.step--;
            const step = currentState.flow.steps[currentState.step];
            if (step && step.id) delete currentState.selections[step.id];
        }
        return getCurrentStepData();
    }
    
    function resetFlow() { currentState = { commandPath: null, step: 0, selections: {}, flow: null }; }
    
    function getSelections() { return currentState.selections; }
    
    function getAvailableCommands() {
        const commands = [];
        Object.entries(COMMAND_FLOWS).forEach(([key, flow]) => {
            if (flow.module === 'ALL' || flow.module === _currentModule) {
                commands.push({ command: key, name: flow.name, icon: flow.icon, category: flow.category, module: flow.module });
            }
        });
        Object.entries(DIRECT_COMMANDS).forEach(([key, cmd]) => {
            if (cmd.module === 'ALL' || cmd.module === _currentModule) {
                commands.push({ command: key, name: cmd.name, icon: cmd.icon, category: 'direct', module: cmd.module });
            }
        });
        return commands;
    }
    
    function getCommandsByCategory() {
        const cats = {};
        getAvailableCommands().forEach(cmd => {
            if (!cats[cmd.category]) cats[cmd.category] = [];
            cats[cmd.category].push(cmd);
        });
        return cats;
    }
    
    return {
        setCore, setModule, getModule,
        startCommandFlow, getCurrentStepData, nextStep, previousStep, resetFlow, getSelections,
        getAvailableCommands, getCommandsByCategory, COMMAND_FLOWS, DIRECT_COMMANDS,
        getEquipmentOptions, getLineOptions, getAllElementOptions, getPortOptions, getAvailablePorts,
        getStreamOptions, getInstrumentOptions, getLoopOptions,
        getMaterialOptions, getSpecOptions, getComponentCategories, getComponentTypeOptions, pipeDiameters
    };
    
})();
```

Ahora, actualiza adaptiveCommandsUI.js para usar el filtro por módulo:

Al inicio del archivo, agrega:

```javascript
// Al inicio de adaptiveCommandsUI.js
let _currentModule = 'ISOMETRIC';

function setModule(module) {
    _currentModule = module;
    AdaptiveCommandSystem.setModule(module);
    if (document.getElementById('adaptive-overlay')) {
        if (currentMode === 'assisted') renderAssistedGrid();
    }
}
```

Y en renderAssistedGrid(), modifica para mostrar el módulo actual:

```javascript
function renderAssistedGrid() {
    updateTitle('Comandos Inteligentes');
    currentFlow = null;
    AdaptiveCommandSystem.resetFlow();
    
    const currentModule = _currentModule;
    const commandsByCat = AdaptiveCommandSystem.getCommandsByCategory();
    const allCmds = getAvailableCommandsFiltered();
    
    const catNames = {
        'config': '⚙️ Configuración', 'create': '🏗️ Crear', 'connect': '🔗 Conectar',
        'edit': '✏️ Editar', 'query': '🔍 Consultar', 'utility': '📦 Utilidades',
        'direct': '⚡ Rápidos', 'pfd': '📊 P&ID', 'dti': '🔧 DTI'
    };
    
    let bodyHtml = `
        <div class="module-indicator" style="margin-bottom: 12px; padding: 8px 12px; background: rgba(0,242,255,0.1); border-radius: 8px;">
            📁 Módulo actual: <strong>${currentModule}</strong>
            ${currentModule !== 'ISOMETRIC' ? '<span style="color: #f59e0b;"> (Comandos filtrados)</span>' : ''}
        </div>
        <div class="mode-tabs">
            <button class="mode-tab active" data-mode="assisted" onclick="AdaptiveCommandUI.switchTab('assisted')">🧭 Asistido</button>
            <button class="mode-tab" data-mode="text" onclick="AdaptiveCommandUI.switchTab('text')">⌨️ Texto</button>
        </div>
        <div class="cmd-categories">
            <button class="cmd-cat active" data-cat="all" onclick="AdaptiveCommandUI.filterCategory('all')">📋 Todos (${allCmds.length})</button>
    `;
    
    Object.entries(commandsByCat).forEach(([cat, cmds]) => {
        bodyHtml += `<button class="cmd-cat" data-cat="${cat}" onclick="AdaptiveCommandUI.filterCategory('${cat}')">${catNames[cat] || cat} (${cmds.length})</button>`;
    });
    
    bodyHtml += `</div><div class="cmd-grid" id="cmdGrid">${renderCmdCards(allCmds)}</div>`;
    document.getElementById('adaptive-body').innerHTML = bodyHtml;
    // ... resto igual
}
