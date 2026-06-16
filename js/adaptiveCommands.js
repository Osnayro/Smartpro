
// ============================================================
// ADAPTIVE COMMANDS v3.0 - SISTEMA ADAPTATIVO MODULAR COMPLETO
// Archivo: js/adaptiveCommands.js
// 
// INCLUYE EL 100% DE LOS COMANDOS DE LOS TRES MÓDULOS:
//   📊 PFD: 8 comandos (ISO 10628)
//   🔧 DTI: 7 comandos (ISA-5.1)
//   🧊 ISO: 25 comandos (ASME B31.3)
//   ⚙️ GENERAL: 10 comandos
// ============================================================

const AdaptiveCommandSystem = (function() {
    
    // ================================================================
    // ESTADO GLOBAL
    // ================================================================
    
    let currentState = {
        commandPath: null,
        step: 0,
        selections: {},
        flow: null,
        activeModule: 'pfd'
    };

    let _uiCallbacks = { onModuleChange: null };

    // ================================================================
    // FUNCIONES PARA OBTENER DATOS DEL CORE
    // ================================================================
    
    function getEquiposList() {
        if (typeof SmartFlowCore === 'undefined') return [];
        const equipos = SmartFlowCore.getEquipos();
        if (!equipos || equipos.length === 0) return [];
        return equipos.map(function(eq) {
            return {
                value: eq.tag,
                label: eq.tag + ' (' + (eq.tipo || '?') + ')',
                icon: getEquipmentIcon(eq.tipo),
                description: (eq.tipo || 'Equipo') + (eq.material ? ' | ' + eq.material : '')
            };
        });
    }

    function getLineasList() {
        if (typeof SmartFlowCore === 'undefined') return [];
        const lines = SmartFlowCore.getLines();
        if (!lines || lines.length === 0) return [];
        return lines.map(function(line) {
            return {
                value: line.tag,
                label: line.tag + ' ⌀' + (line.diameter || '?') + '" ' + (line.material || ''),
                icon: '📏',
                description: (line.diameter || '?') + '" | ' + (line.material || 'STD') + ' | ' + (line.spec || '')
            };
        });
    }

    function getPuertosLibres(equipoTag) {
        if (typeof SmartFlowCore === 'undefined') return [];
        const eq = SmartFlowCore.findObjectByTag(equipoTag);
        if (!eq || !eq.puertos) return [];
        return eq.puertos
            .filter(function(p) { return p.status === 'open' || !p.connectedTo; })
            .map(function(p) {
                return {
                    value: p.id,
                    label: p.id + ' ⌀' + (p.diametro || '?') + '" 🟢',
                    icon: '🟢',
                    description: '⌀' + (p.diametro || '?') + '" | Disponible',
                    status: 'open'
                };
            });
    }

    function getPuertosTodos(equipoTag) {
        if (typeof SmartFlowCore === 'undefined') return [];
        const eq = SmartFlowCore.findObjectByTag(equipoTag);
        if (!eq || !eq.puertos) return [];
        return eq.puertos.map(function(p) {
            const isFree = p.status === 'open' || !p.connectedTo;
            return {
                value: p.id,
                label: p.id + (p.diametro ? ' ⌀' + p.diametro + '"' : '') + (isFree ? ' 🟢' : ' 🔴'),
                icon: isFree ? '🟢' : '🔴',
                description: isFree ? '🟢 Disponible' : '🔴 Conectado a ' + (p.connectedTo?.tag || '?'),
                status: isFree ? 'open' : 'connected'
            };
        });
    }

    function getPosicionesLinea() {
        return [
            { value: '0', label: '0 (Inicio)', icon: '🔵' },
            { value: '0.25', label: '0.25', icon: '🔵' },
            { value: '0.5', label: '0.5 (Centro)', icon: '🔵' },
            { value: '0.75', label: '0.75', icon: '🔵' },
            { value: '1', label: '1 (Final)', icon: '🔵' }
        ];
    }

    function getEquipmentIcon(tipo) {
        const icons = {
            'tanque_v': '🛢️', 'tanque_h': '🛢️', 'tanque_acero': '🛢️', 'tanque_aseptico': '🛢️',
            'bomba': '⚡', 'bomba_z': '⚡', 'bomba_dosificacion': '⚡', 'bomba_sumergible': '⚡',
            'intercambiador': '🔥', 'condensador': '❄️', 'caldera': '🔥',
            'torre': '🗼', 'columna_fraccionadora': '🗼', 'reactor': '⚗️', 'reactor_encamisado': '⚗️',
            'compresor': '💨', 'separador': '🔀', 'separador_trifasico': '🔀',
            'plataforma': '🏗️', 'antorcha': '🔥', 'autoclave': '🧪',
            'filtro_arena': '🔍', 'filtro_carbon': '🔍', 'filtro_prensa': '🔍', 'filtro_duplex': '🔍',
            'osmosis': '💧', 'centrifuga': '🔄', 'agitador': '🔄', 'molino': '⚙️',
            'llenadora': '📦', 'skid_inyeccion': '💉', 'clarificador': '💧',
            'desgasificador': '💨', 'desmineralizador': '🧪', 'suavizador': '🧪',
            'espesador': '📊', 'floculador': '🧪', 'celda_electrolitica': '⚡',
            'slug_catcher': '📥', 'calentador_fuego_directo': '🔥',
            'evaporador': '🌡️', 'cristalizador': '💎', 'secador_rotativo': '🌀',
            'absorbedor': '🧪', 'stripper': '🧪', 'centrifuga_discos': '🔄',
            'homogeneizador': '🔄', 'homogeneizador_ap': '🔄',
            'esterilizador_uht': '🌡️', 'pasteurizador': '🌡️',
            'tina_quesera': '🧀', 'dosificador_quimico': '💉',
            'canaleta_parshall': '📐'
        };
        return icons[tipo] || '📦';
    }

    function getMaterialOptions() {
        if (typeof SmartFlowCatalog !== 'undefined' && SmartFlowCatalog.getSpecs) {
            try {
                const specs = SmartFlowCatalog.getSpecs();
                const materials = new Set();
                Object.values(specs).forEach(function(s) {
                    if (s.material) materials.add(s.material);
                });
                const result = Array.from(materials).sort().map(function(m) {
                    return { value: m.toUpperCase(), label: m };
                });
                if (result.length > 0) return result;
            } catch (e) {}
        }
        return [
            { value: 'PPR', label: 'PPR' },
            { value: 'HDPE', label: 'HDPE' },
            { value: 'ACERO_AL_CARBONO', label: 'Acero al Carbono' },
            { value: 'ACERO_INOXIDABLE', label: 'Acero Inoxidable' },
            { value: 'PVC', label: 'PVC' },
            { value: 'CPVC', label: 'CPVC' },
            { value: 'DUPLEX', label: 'Dúplex' },
            { value: 'ALUMINIO', label: 'Aluminio' },
            { value: 'CONCRETO', label: 'Concreto' }
        ];
    }

    function getSpecOptions(material) {
        if (typeof SmartFlowCatalog === 'undefined') return [];
        try {
            const specs = SmartFlowCatalog.getSpecs();
            if (!specs) return [];
            const result = [];
            const matUpper = (material || '').toUpperCase().replace(/ /g, '_');
            Object.entries(specs).forEach(function(entry) {
                const key = entry[0];
                const data = entry[1];
                if (!material) {
                    result.push({ value: key, label: key + ' (' + (data.material || '') + ')' });
                    return;
                }
                const specMat = (data.material || '').toUpperCase().replace(/ /g, '_');
                if (specMat === matUpper || specMat.includes(matUpper) || matUpper.includes(specMat)) {
                    result.push({ value: key, label: key + ' (' + (data.material || '') + ')' });
                }
            });
            if (result.length === 0) {
                return Object.keys(specs).map(function(key) {
                    return { value: key, label: key };
                });
            }
            return result;
        } catch (e) {
            return [];
        }
    }

    function pipeDiameters() {
        return ['2', '3', '4', '6', '8', '10', '12', '16', '20', '24'].map(function(d) {
            return { value: d, label: d + '"' };
        });
    }

    function getEquipmentTypeName(tipo) {
        if (typeof SmartFlowCatalog !== 'undefined') {
            const eq = SmartFlowCatalog.getEquipment(tipo);
            if (eq) return eq.nombre || tipo;
        }
        return tipo || 'Equipo';
    }

    function getEquipmentTypes() {
        if (typeof SmartFlowCatalog !== 'undefined' && SmartFlowCatalog.listEquipmentTypes) {
            return SmartFlowCatalog.listEquipmentTypes().map(function(t) {
                const eq = SmartFlowCatalog.getEquipment(t);
                return {
                    value: t,
                    label: (eq && eq.nombre) || t,
                    icon: getEquipmentIcon(t),
                    categoria: (eq && eq.categoria) || 'General'
                };
            });
        }
        return [
            { value: 'tanque_v', label: 'Tanque Vertical', icon: '🛢️', categoria: 'Almacenamiento' },
            { value: 'tanque_h', label: 'Tanque Horizontal', icon: '🛢️', categoria: 'Almacenamiento' },
            { value: 'bomba', label: 'Bomba Centrífuga', icon: '⚡', categoria: 'Rotativo' },
            { value: 'bomba_z', label: 'Bomba (succión Z)', icon: '⚡', categoria: 'Rotativo' },
            { value: 'intercambiador', label: 'Intercambiador de Calor', icon: '🔥', categoria: 'Térmico' },
            { value: 'torre', label: 'Torre de Destilación', icon: '🗼', categoria: 'Proceso' },
            { value: 'reactor', label: 'Reactor', icon: '⚗️', categoria: 'Proceso' },
            { value: 'compresor', label: 'Compresor', icon: '💨', categoria: 'Rotativo' },
            { value: 'separador', label: 'Separador', icon: '🔀', categoria: 'Proceso' },
            { value: 'caldera', label: 'Caldera', icon: '🔥', categoria: 'Térmico' },
            { value: 'plataforma', label: 'Plataforma Estructural', icon: '🏗️', categoria: 'Estructura' },
            { value: 'antorcha', label: 'Antorcha (Flare)', icon: '🔥', categoria: 'Seguridad' },
            { value: 'filtro_arena', label: 'Filtro de Arena', icon: '🔍', categoria: 'Tratamiento' },
            { value: 'osmosis', label: 'Ósmosis Inversa', icon: '💧', categoria: 'Tratamiento' },
            { value: 'clarificador', label: 'Clarificador', icon: '💧', categoria: 'Tratamiento' },
            { value: 'desgasificador', label: 'Desgasificador', icon: '💨', categoria: 'Tratamiento' },
            { value: 'suavizador', label: 'Suavizador', icon: '🧪', categoria: 'Tratamiento' },
            { value: 'reactor_encamisado', label: 'Reactor Encamisado', icon: '⚗️', categoria: 'Proceso' },
            { value: 'autoclave', label: 'Autoclave', icon: '🧪', categoria: 'Proceso' },
            { value: 'centrifuga', label: 'Centrífuga', icon: '🔄', categoria: 'Rotativo' },
            { value: 'agitador', label: 'Agitador/Mezclador', icon: '🔄', categoria: 'Proceso' },
            { value: 'filtro_prensa', label: 'Filtro Prensa', icon: '🔍', categoria: 'Filtración' },
            { value: 'evaporador', label: 'Evaporador', icon: '🌡️', categoria: 'Térmico' },
            { value: 'cristalizador', label: 'Cristalizador', icon: '💎', categoria: 'Proceso' },
            { value: 'secador_rotativo', label: 'Secador Rotativo', icon: '🌀', categoria: 'Térmico' },
            { value: 'absorbedor', label: 'Absorbedor', icon: '🧪', categoria: 'Proceso' },
            { value: 'stripper', label: 'Stripper/Despojador', icon: '🧪', categoria: 'Proceso' },
            { value: 'pasteurizador', label: 'Pasteurizador', icon: '🌡️', categoria: 'Alimentos' },
            { value: 'homogeneizador', label: 'Homogeneizador', icon: '🔄', categoria: 'Alimentos' },
            { value: 'tanque_acero', label: 'Tanque Acero Inoxidable', icon: '🛢️', categoria: 'Alimentos' },
            { value: 'llenadora', label: 'Llenadora', icon: '📦', categoria: 'Envasado' }
        ];
    }

    // ================================================================
    // FUNCIONES PARA OBTENER STREAMS E INSTRUMENTOS
    // ================================================================
    
    function getStreamsList() {
        if (typeof SmartFlowCore === 'undefined') return [];
        const streams = SmartFlowCore.getStreams ? SmartFlowCore.getStreams() : [];
        if (!streams || streams.length === 0) return [];
        return streams.map(function(s) {
            return {
                value: s.tag,
                label: s.tag + ' (' + s.fluid + ' | ' + s.from + ' → ' + s.to + ')',
                icon: '➡️',
                description: s.fluid + ' | ' + s.flow + ' ' + (s.flowUnit || 'm³/h')
            };
        });
    }

    function getInstrumentsList() {
        if (typeof SmartFlowCore === 'undefined') return [];
        const instruments = SmartFlowCore.getInstruments ? SmartFlowCore.getInstruments() : [];
        if (!instruments || instruments.length === 0) return [];
        return instruments.map(function(inst) {
            return {
                value: inst.tag,
                label: inst.tag + ' (' + inst.type + ')' + (inst.lineTag ? ' en ' + inst.lineTag : ''),
                icon: '📟',
                description: inst.type + ' | ' + (inst.range || 'N/D')
            };
        });
    }

    function getLoopsList() {
        if (typeof SmartFlowCore === 'undefined') return [];
        const loops = SmartFlowCore.getLoops ? SmartFlowCore.getLoops() : [];
        if (!loops || loops.length === 0) return [];
        return loops.map(function(loop) {
            return {
                value: loop.tag,
                label: loop.tag + ' (' + (loop.type || 'FEEDBACK') + ')',
                icon: '🔄',
                description: loop.sensor + ' → ' + loop.controller + ' → ' + loop.valve
            };
        });
    }

    // ================================================================
    // COMANDOS - MÓDULO PFD (8 comandos)
    // ================================================================
    
    const PFD_COMMANDS = {
        'CREATE.EQUIPO': {
            name: 'Crear Equipo Lógico',
            icon: '🏗️',
            category: 'pfd',
            description: 'Crea un equipo en el diagrama de flujo (ISO 10628)',
            steps: [
                {
                    id: 'tipo',
                    title: 'Seleccione el tipo de equipo',
                    type: 'dynamicSelect',
                    description: 'Elija el tipo de equipo que desea crear',
                    options: function() {
                        return getEquipmentTypes().map(function(t) {
                            return {
                                value: t.value,
                                label: t.label,
                                icon: t.icon,
                                description: t.categoria || ''
                            };
                        });
                    },
                    next: 'tag'
                },
                {
                    id: 'tag',
                    title: 'Ingrese el Tag del equipo',
                    type: 'text',
                    placeholder: 'Ej: TK-101, B-01, E-201',
                    description: 'El Tag debe ser único en el proyecto',
                    validate: function(value) {
                        if (!value || value.trim() === '') return 'El Tag es obligatorio';
                        if (typeof SmartFlowCore !== 'undefined') {
                            if (SmartFlowCore.findObjectByTag(value.trim())) {
                                return 'El Tag "' + value.trim() + '" ya existe';
                            }
                        }
                        return null;
                    },
                    next: 'material'
                },
                {
                    id: 'material',
                    title: 'Material del equipo',
                    type: 'select',
                    description: 'Seleccione el material de construcción',
                    options: function() { return getMaterialOptions(); },
                    next: 'confirm'
                },
                {
                    id: 'confirm',
                    title: 'Confirmar creación',
                    type: 'confirm',
                    message: function(selections) {
                        const tipo = selections.tipo || '?';
                        const tipoLabel = getEquipmentTypeName(tipo);
                        return '✅ ¿Crear equipo lógico **' + selections.tag + '** de tipo **' + tipoLabel + '**?\n\n' +
                               '📐 Material: ' + (selections.material || 'PPR') + '\n' +
                               '📋 Se creará como equipo lógico en el PFD.\n' +
                               '💡 Luego podrá posicionarlo en 3D con el comando **update equipment**';
                    },
                    isFinal: true,
                    executeImmediately: true,
                    buildCommand: function(params, selections) {
                        var cmd = 'create equipo ' + (selections.tipo || 'tanque_v') + ' ' + (selections.tag || 'EQ-001');
                        if (selections.material) cmd += ' material ' + selections.material;
                        return cmd;
                    }
                }
            ]
        },

        'CREATE.STREAM': {
            name: 'Crear Corriente de Proceso',
            icon: '➡️',
            category: 'pfd',
            description: 'Crea una corriente de proceso con todos los parámetros (ISO 10628)',
            steps: [
                {
                    id: 'tag',
                    title: '① Tag de la corriente',
                    type: 'text',
                    placeholder: 'Ej: S1, S-101, CW-01',
                    description: 'Identificador único de la corriente de proceso',
                    validate: function(value) {
                        if (!value || value.trim() === '') return 'El Tag es obligatorio';
                        return null;
                    },
                    next: 'from'
                },
                {
                    id: 'from',
                    title: '② Equipo Origen (From)',
                    type: 'dynamicSelect',
                    description: 'Seleccione el equipo de donde sale la corriente',
                    options: function() {
                        var equipos = getEquiposList();
                        if (equipos.length === 0) {
                            return [{ value: '', label: '⚠️ No hay equipos. Cree uno primero en PFD.', icon: '⚠️' }];
                        }
                        return equipos;
                    },
                    next: 'to'
                },
                {
                    id: 'to',
                    title: '③ Equipo Destino (To)',
                    type: 'dynamicSelect',
                    description: 'Seleccione el equipo a donde llega la corriente',
                    options: function(selections) {
                        var equipos = getEquiposList();
                        if (equipos.length === 0) {
                            return [{ value: '', label: '⚠️ No hay equipos. Cree uno primero en PFD.', icon: '⚠️' }];
                        }
                        if (selections && selections.from) {
                            return equipos.filter(function(e) { return e.value !== selections.from; });
                        }
                        return equipos;
                    },
                    next: 'fluid'
                },
                {
                    id: 'fluid',
                    title: '④ Fluido de proceso',
                    type: 'select',
                    description: 'Seleccione el fluido que transporta la corriente',
                    options: function() {
                        return [
                            { value: 'WATER', label: '💧 Agua (WATER)' },
                            { value: 'STEAM', label: '💨 Vapor (STEAM)' },
                            { value: 'CONDENSATE', label: '💧 Condensado (CONDENSATE)' },
                            { value: 'AIR', label: '🌬️ Aire (AIR)' },
                            { value: 'NITROGEN', label: '🧪 Nitrógeno (NITROGEN)' },
                            { value: 'OXYGEN', label: '🧪 Oxígeno (OXYGEN)' },
                            { value: 'NATURAL_GAS', label: '🔥 Gas Natural (NATURAL_GAS)' },
                            { value: 'CRUDE_OIL', label: '🛢️ Petróleo Crudo (CRUDE_OIL)' },
                            { value: 'DIESEL', label: '⛽ Diesel' },
                            { value: 'GASOLINE', label: '⛽ Gasolina' },
                            { value: 'ETHANOL', label: '🧪 Etanol' },
                            { value: 'METHANOL', label: '🧪 Metanol' },
                            { value: 'PROCESS_WATER', label: '💧 Agua de Proceso' },
                            { value: 'COOLING_WATER', label: '❄️ Agua de Enfriamiento' },
                            { value: 'CHILLED_WATER', label: '🧊 Agua Chilled' },
                            { value: 'HOT_OIL', label: '🔥 Aceite Térmico' },
                            { value: 'THERMAL_FLUID', label: '🔥 Fluido Térmico' },
                            { value: 'GLYCOL', label: '🧪 Glicol' },
                            { value: 'BRINE', label: '🧂 Salmuera (BRINE)' },
                            { value: 'LUBE_OIL', label: '🛢️ Aceite Lubricante' },
                            { value: 'AMMONIA', label: '🧪 Amoniaco (AMMONIA)' },
                            { value: 'CHLORINE', label: '🧪 Cloro (CHLORINE)' },
                            { value: 'H2SO4', label: '🧪 Ácido Sulfúrico (H2SO4)' },
                            { value: 'NAOH', label: '🧪 Soda Cáustica (NAOH)' },
                            { value: 'HCL', label: '🧪 Ácido Clorhídrico (HCL)' },
                            { value: 'SLURRY', label: '💧🧱 Lodo (SLURRY)' },
                            { value: 'SEAL_WATER', label: '💧 Agua de Sello (SEAL_WATER)' }
                        ];
                    },
                    next: 'flow'
                },
                {
                    id: 'flow',
                    title: '⑤ Caudal',
                    type: 'number',
                    default: 50,
                    min: 0,
                    step: 1,
                    description: 'Caudal en metros cúbicos por hora (m³/h)',
                    next: 'flowUnit'
                },
                {
                    id: 'flowUnit',
                    title: 'Unidad de caudal (opcional)',
                    type: 'select',
                    description: 'Seleccione la unidad de caudal',
                    options: function() {
                        return [
                            { value: 'm3/h', label: 'm³/h (metros cúbicos por hora)' },
                            { value: 'l/min', label: 'l/min (litros por minuto)' },
                            { value: 'm3/s', label: 'm³/s (metros cúbicos por segundo)' },
                            { value: 'gpm', label: 'GPM (galones por minuto)' }
                        ];
                    },
                    default: 'm3/h',
                    next: 'pressure'
                },
                {
                    id: 'pressure',
                    title: '⑥ Presión de operación',
                    type: 'number',
                    default: 2,
                    min: 0,
                    step: 0.5,
                    description: 'Presión en bar (1 bar = 100 kPa)',
                    next: 'pressureUnit'
                },
                {
                    id: 'pressureUnit',
                    title: 'Unidad de presión (opcional)',
                    type: 'select',
                    description: 'Seleccione la unidad de presión',
                    options: function() {
                        return [
                            { value: 'bar', label: 'bar' },
                            { value: 'psi', label: 'psi' },
                            { value: 'kPa', label: 'kPa' },
                            { value: 'MPa', label: 'MPa' }
                        ];
                    },
                    default: 'bar',
                    next: 'temperature'
                },
                {
                    id: 'temperature',
                    title: '⑦ Temperatura de operación',
                    type: 'number',
                    default: 25,
                    min: -50,
                    max: 500,
                    step: 1,
                    description: 'Temperatura en grados Celsius (°C)',
                    next: 'temperatureUnit'
                },
                {
                    id: 'temperatureUnit',
                    title: 'Unidad de temperatura (opcional)',
                    type: 'select',
                    description: 'Seleccione la unidad de temperatura',
                    options: function() {
                        return [
                            { value: '°C', label: '°C (Celsius)' },
                            { value: '°F', label: '°F (Fahrenheit)' },
                            { value: 'K', label: 'K (Kelvin)' }
                        ];
                    },
                    default: '°C',
                    next: 'phase'
                },
                {
                    id: 'phase',
                    title: '⑧ Fase del fluido',
                    type: 'select',
                    description: 'Estado físico del fluido en la corriente',
                    options: function() {
                        return [
                            { value: 'LIQUID', label: '💧 Líquido' },
                            { value: 'GAS', label: '💨 Gas' },
                            { value: 'TWO_PHASE', label: '🌫️ Dos Fases (Líquido + Gas)' },
                            { value: 'SOLID', label: '🧱 Sólido' },
                            { value: 'SLURRY', label: '💧🧱 Lodo (Sólido + Líquido)' },
                            { value: 'SUPERCRITICAL', label: '🔥 Supercrítico' }
                        ];
                    },
                    next: 'service'
                },
                {
                    id: 'service',
                    title: '⑨ Servicio - Opcional',
                    type: 'text',
                    placeholder: 'Ej: PROCESS, COOLING, HEATING, CHEMICAL',
                    description: 'Descripción del servicio de la corriente',
                    next: 'designCase'
                },
                {
                    id: 'designCase',
                    title: '⑩ Caso de diseño - Opcional',
                    type: 'select',
                    description: 'Seleccione el caso de diseño',
                    options: function() {
                        return [
                            { value: 'NORMAL', label: '🟢 Normal' },
                            { value: 'DESIGN', label: '🟡 Diseño' },
                            { value: 'EMERGENCY', label: '🔴 Emergencia' }
                        ];
                    },
                    default: 'NORMAL',
                    next: 'confirm'
                },
                {
                    id: 'confirm',
                    title: '✅ Confirmar creación de la corriente',
                    type: 'confirm',
                    message: function(selections) {
                        var phaseLabels = {
                            'LIQUID': '💧 Líquido',
                            'GAS': '💨 Gas',
                            'TWO_PHASE': '🌫️ Dos Fases',
                            'SOLID': '🧱 Sólido',
                            'SLURRY': '💧🧱 Lodo',
                            'SUPERCRITICAL': '🔥 Supercrítico'
                        };
                        var phaseLabel = phaseLabels[selections.phase] || selections.phase || 'LIQUID';
                        
                        return '✅ ¿Crear corriente de proceso **' + selections.tag + '**?\n\n' +
                               '🔗 **' + (selections.from || '?') + '** → **' + (selections.to || '?') + '**\n\n' +
                               '📊 **PARÁMETROS DE PROCESO:**\n' +
                               '   💧 Fluido: ' + (selections.fluid || 'WATER') + '\n' +
                               '   📊 Caudal: ' + (selections.flow || 0) + ' ' + (selections.flowUnit || 'm³/h') + '\n' +
                               '   📈 Presión: ' + (selections.pressure || 0) + ' ' + (selections.pressureUnit || 'bar') + '\n' +
                               '   🌡️ Temperatura: ' + (selections.temperature || 25) + ' ' + (selections.temperatureUnit || '°C') + '\n' +
                               '   🧊 Fase: ' + phaseLabel + '\n' +
                               (selections.service ? '   📋 Servicio: ' + selections.service + '\n' : '') +
                               (selections.designCase ? '   📐 Caso: ' + selections.designCase + '\n' : '');
                    },
                    isFinal: true,
                    executeImmediately: true,
                    buildCommand: function(params, selections) {
                        var cmd = 'create stream ' + (selections.tag || 'S1');
                        if (selections.from) cmd += ' from ' + selections.from;
                        if (selections.to) cmd += ' to ' + selections.to;
                        if (selections.fluid) cmd += ' fluid ' + selections.fluid;
                        if (selections.flow) cmd += ' flow ' + selections.flow;
                        if (selections.flowUnit && selections.flowUnit !== 'm3/h') cmd += ' flowUnit ' + selections.flowUnit;
                        if (selections.pressure) cmd += ' pressure ' + selections.pressure;
                        if (selections.pressureUnit && selections.pressureUnit !== 'bar') cmd += ' pressureUnit ' + selections.pressureUnit;
                        if (selections.temperature) cmd += ' temperature ' + selections.temperature;
                        if (selections.temperatureUnit && selections.temperatureUnit !== '°C') cmd += ' temperatureUnit ' + selections.temperatureUnit;
                        if (selections.phase) cmd += ' phase ' + selections.phase;
                        if (selections.service) cmd += ' service ' + selections.service;
                        if (selections.designCase && selections.designCase !== 'NORMAL') cmd += ' designCase ' + selections.designCase;
                        return cmd;
                    }
                }
            ]
        },

        'INFO.STREAM': {
            name: 'Información de Corriente',
            icon: '📋',
            category: 'pfd',
            description: 'Muestra los detalles de una corriente de proceso',
            steps: [
                {
                    id: 'tag',
                    title: 'Seleccione la corriente',
                    type: 'dynamicSelect',
                    description: 'Corriente para obtener información',
                    options: function() {
                        var streams = getStreamsList();
                        if (streams.length === 0) {
                            return [{ value: '', label: '⚠️ No hay corrientes. Créelas con create stream.', icon: '⚠️' }];
                        }
                        return streams;
                    },
                    next: 'confirm'
                },
                {
                    id: 'confirm',
                    title: 'Confirmar',
                    type: 'confirm',
                    message: function(selections) {
                        return '📋 Mostrar información de la corriente **' + (selections.tag || '?') + '**';
                    },
                    isFinal: true,
                    executeImmediately: true,
                    buildCommand: function(params, selections) {
                        return 'info stream ' + (selections.tag || '');
                    }
                }
            ]
        },

        'LIST.STREAMS': {
            name: 'Listar Corrientes',
            icon: '📋',
            category: 'pfd',
            description: 'Muestra todas las corrientes de proceso',
            isDirect: true,
            command: 'list streams'
        },

        'LINK.STREAM': {
            name: 'Vincular Corriente a Línea',
            icon: '🔗',
            category: 'pfd',
            description: 'Vincula una corriente PFD con una línea 3D',
            steps: [
                {
                    id: 'streamTag',
                    title: 'Corriente a vincular',
                    type: 'dynamicSelect',
                    description: 'Seleccione la corriente PFD',
                    options: function() {
                        var streams = getStreamsList();
                        if (streams.length === 0) {
                            return [{ value: '', label: '⚠️ No hay corrientes', icon: '⚠️' }];
                        }
                        return streams;
                    },
                    next: 'lineTag'
                },
                {
                    id: 'lineTag',
                    title: 'Línea destino',
                    type: 'dynamicSelect',
                    description: 'Seleccione la línea 3D',
                    options: function() {
                        var lines = getLineasList();
                        if (lines.length === 0) {
                            return [{ value: '', label: '⚠️ No hay líneas. Cree una en ISO.', icon: '⚠️' }];
                        }
                        return lines;
                    },
                    next: 'confirm'
                },
                {
                    id: 'confirm',
                    title: 'Confirmar vinculación',
                    type: 'confirm',
                    message: function(selections) {
                        return '🔗 Vincular corriente **' + (selections.streamTag || '?') + '** con línea **' + (selections.lineTag || '?') + '**';
                    },
                    isFinal: true,
                    executeImmediately: true,
                    buildCommand: function(params, selections) {
                        return 'link stream ' + (selections.streamTag || '') + ' to ' + (selections.lineTag || '');
                    }
                }
            ]
        },

        'BALANCE.MASA': {
            name: 'Balance de Masa',
            icon: '⚖️',
            category: 'pfd',
            description: 'Verifica el balance de masa de un equipo',
            steps: [
                {
                    id: 'equipo',
                    title: 'Seleccione el equipo',
                    type: 'dynamicSelect',
                    description: 'Equipo para verificar balance de masa',
                    options: function() {
                        var equipos = getEquiposList();
                        if (equipos.length === 0) {
                            return [{ value: '', label: '⚠️ No hay equipos', icon: '⚠️' }];
                        }
                        return equipos;
                    },
                    next: 'confirm'
                },
                {
                    id: 'confirm',
                    title: 'Confirmar balance',
                    type: 'confirm',
                    message: function(selections) {
                        return '⚖️ Verificar balance de masa de **' + (selections.equipo || '?') + '**\n\n' +
                               '📊 Se calcularán los flujos de entrada y salida.\n' +
                               '🔍 Se verificará que masa_entrada = masa_salida.';
                    },
                    isFinal: true,
                    executeImmediately: true,
                    buildCommand: function(params, selections) {
                        return 'balance masa ' + (selections.equipo || 'TK-001');
                    }
                }
            ]
        },

        'VALIDATE.PFD': {
            name: 'Validar PFD',
            icon: '🔍',
            category: 'pfd',
            description: 'Valida la integridad del diagrama de flujo (ISO 10628)',
            isDirect: true,
            command: 'validate pfd'
        },

        'AUTOLINK': {
            name: 'Auto-Vincular PFD↔3D',
            icon: '🔗',
            category: 'pfd',
            description: 'Vincula automáticamente corrientes PFD con líneas 3D',
            isDirect: true,
            command: 'autolink'
        }
    };

    // ================================================================
    // COMANDOS - MÓDULO DTI (7 comandos)
    // ================================================================
    
    const DTI_COMMANDS = {
        'CREATE.INSTRUMENT': {
            name: 'Crear Instrumento',
            icon: '📟',
            category: 'dti',
            description: 'Crea un instrumento según ISA-5.1',
            steps: [
                {
                    id: 'tag',
                    title: '① Tag ISA-5.1 del instrumento',
                    type: 'text',
                    placeholder: 'Ej: PI-101, FT-101, LT-101',
                    description: 'Siga la nomenclatura ISA-5.1 (PG, PT, FT, LT, etc.)',
                    validate: function(value) {
                        if (!value || value.trim() === '') return 'El Tag es obligatorio';
                        if (!/^[A-Z]+-\d+$/.test(value.trim())) {
                            return 'Formato ISA-5.1 inválido. Use: LETRAS-NÚMERO (ej: PI-101)';
                        }
                        return null;
                    },
                    next: 'type'
                },
                {
                    id: 'type',
                    title: '② Tipo de instrumento',
                    type: 'select',
                    description: 'Seleccione el tipo de instrumento',
                    options: function() {
                        return [
                            { value: 'PRESSURE_GAUGE', label: '📟 Manómetro (PG)', description: 'Presión local' },
                            { value: 'PRESSURE_TRANSMITTER', label: '📡 Transmisor Presión (PT)', description: 'Señal 4-20mA' },
                            { value: 'PRESSURE_SWITCH', label: '📏 Switch Presión (PS)', description: 'Alarma' },
                            { value: 'PRESSURE_CONTROLLER', label: '🎛️ Controlador Presión (PIC)', description: 'Panel' },
                            { value: 'TEMPERATURE_GAUGE', label: '🌡️ Termómetro (TG)', description: 'Temperatura local' },
                            { value: 'TEMPERATURE_TRANSMITTER', label: '📡 Transmisor Temp (TT)', description: 'Señal 4-20mA' },
                            { value: 'TEMPERATURE_SWITCH', label: '📏 Switch Temp (TS)', description: 'Alarma' },
                            { value: 'TEMPERATURE_CONTROLLER', label: '🎛️ Controlador Temp (TIC)', description: 'Panel' },
                            { value: 'FLOW_METER', label: '📊 Caudalímetro (FG)', description: 'Flujo local' },
                            { value: 'FLOW_TRANSMITTER', label: '📡 Transmisor Flujo (FT)', description: 'Señal 4-20mA' },
                            { value: 'FLOW_SWITCH', label: '📏 Switch Flujo (FS)', description: 'Alarma' },
                            { value: 'FLOW_CONTROLLER', label: '🎛️ Controlador Flujo (FIC)', description: 'Panel' },
                            { value: 'LEVEL_GAUGE', label: '📊 Nivel (LG)', description: 'Nivel local' },
                            { value: 'LEVEL_TRANSMITTER', label: '📡 Transmisor Nivel (LT)', description: 'Señal 4-20mA' },
                            { value: 'LEVEL_SWITCH', label: '📏 Switch Nivel (LS)', description: 'Alarma' },
                            { value: 'LEVEL_CONTROLLER', label: '🎛️ Controlador Nivel (LIC)', description: 'Panel' },
                            { value: 'CONTROL_VALVE', label: '🔧 Válvula Control (CV)', description: 'Actuador' },
                            { value: 'ON_OFF_VALVE', label: '🔛 Válvula ON/OFF (XV)', description: 'Apertura total' },
                            { value: 'SAFETY_VALVE', label: '🛡️ Válvula Seguridad (SV)', description: 'Alivio' },
                            { value: 'ROTAMETER', label: '🔄 Rotámetro (RO)', description: 'Flujo visual' },
                            { value: 'SIGHT_GLASS', label: '👁️ Visor (SG)', description: 'Visual' }
                        ];
                    },
                    next: 'line'
                },
                {
                    id: 'line',
                    title: '③ Línea de instalación',
                    type: 'dynamicSelect',
                    description: 'Seleccione la línea donde se instalará el instrumento',
                    options: function() {
                        var lines = getLineasList();
                        if (lines.length === 0) {
                            return [{ value: '', label: '⚠️ No hay líneas. Cree una en ISO.', icon: '⚠️' }];
                        }
                        return lines;
                    },
                    next: 'position'
                },
                {
                    id: 'position',
                    title: '④ Posición en la línea (0-1)',
                    type: 'slider',
                    min: 0,
                    max: 1,
                    step: 0.01,
                    default: 0.5,
                    description: '0 = inicio, 1 = final de la línea',
                    next: 'range'
                },
                {
                    id: 'range',
                    title: '⑤ Rango de medición',
                    type: 'text',
                    placeholder: 'Ej: 0-10 bar, 0-100 °C, 0-50 m³/h',
                    description: 'Especifique el rango del instrumento',
                    next: 'signal'
                },
                {
                    id: 'signal',
                    title: '⑥ Tipo de señal',
                    type: 'select',
                    description: 'Tipo de señal del instrumento',
                    options: function() {
                        return [
                            { value: '4-20mA', label: '4-20 mA (estándar)' },
                            { value: '0-10V', label: '0-10 V' },
                            { value: 'HART', label: 'HART (digital)' },
                            { value: 'FIELDBUS', label: 'FIELDBUS' },
                            { value: 'LOCAL', label: '📟 Local (solo indicación)' }
                        ];
                    },
                    next: 'location'
                },
                {
                    id: 'location',
                    title: '⑦ Ubicación',
                    type: 'select',
                    description: 'Dónde está instalado el instrumento',
                    options: function() {
                        return [
                            { value: 'FIELD', label: '🏭 Campo (FIELD)' },
                            { value: 'PANEL', label: '📋 Panel Local' },
                            { value: 'CONTROL_ROOM', label: '🖥️ Sala de Control' },
                            { value: 'REMOTE', label: '📡 Remoto' }
                        ];
                    },
                    next: 'manufacturer'
                },
                {
                    id: 'manufacturer',
                    title: '⑧ Fabricante - Opcional',
                    type: 'text',
                    placeholder: 'Ej: Emerson, Endress+Hauser, Rosemount',
                    description: 'Fabricante del instrumento',
                    next: 'model'
                },
                {
                    id: 'model',
                    title: '⑨ Modelo - Opcional',
                    type: 'text',
                    placeholder: 'Ej: 3051S, Cerabar, PX3000',
                    description: 'Modelo del instrumento',
                    next: 'criticality'
                },
                {
                    id: 'criticality',
                    title: '⑩ Criticalidad - Opcional',
                    type: 'select',
                    description: 'Nivel de criticalidad del instrumento',
                    options: function() {
                        return [
                            { value: 'NORMAL', label: '🟢 Normal' },
                            { value: 'SAFETY', label: '🟡 Seguridad' },
                            { value: 'CRITICAL', label: '🔴 Crítico' }
                        ];
                    },
                    default: 'NORMAL',
                    next: 'confirm'
                },
                {
                    id: 'confirm',
                    title: '✅ Confirmar creación',
                    type: 'confirm',
                    message: function(selections) {
                        return '✅ ¿Crear instrumento **' + selections.tag + '**?\n\n' +
                               '🔧 Tipo: ' + (selections.type || 'PRESSURE_GAUGE') + '\n' +
                               '📏 Línea: ' + (selections.line || '?') + '\n' +
                               '📍 Posición: ' + (selections.position || 0.5) + '\n' +
                               '📊 Rango: ' + (selections.range || 'N/D') + '\n' +
                               '📡 Señal: ' + (selections.signal || '4-20mA') + '\n' +
                               '📍 Ubicación: ' + (selections.location || 'FIELD') + '\n' +
                               (selections.manufacturer ? '🏭 Fabricante: ' + selections.manufacturer + '\n' : '') +
                               (selections.model ? '📐 Modelo: ' + selections.model + '\n' : '') +
                               (selections.criticality ? '🔶 Criticalidad: ' + selections.criticality + '\n' : '');
                    },
                    isFinal: true,
                    executeImmediately: true,
                    buildCommand: function(params, selections) {
                        var cmd = 'create instrument ' + (selections.tag || 'PI-101');
                        if (selections.type) cmd += ' type ' + selections.type;
                        if (selections.line) cmd += ' on ' + selections.line;
                        if (selections.position !== undefined) cmd += ' at ' + selections.position;
                        if (selections.range) cmd += ' range ' + selections.range;
                        if (selections.signal && selections.signal !== '4-20mA') cmd += ' signal ' + selections.signal;
                        if (selections.location && selections.location !== 'FIELD') cmd += ' location ' + selections.location;
                        if (selections.manufacturer) cmd += ' manufacturer ' + selections.manufacturer;
                        if (selections.model) cmd += ' model ' + selections.model;
                        if (selections.criticality && selections.criticality !== 'NORMAL') cmd += ' criticality ' + selections.criticality;
                        return cmd;
                    }
                }
            ]
        },

        'CREATE.LOOP': {
            name: 'Crear Lazo de Control',
            icon: '🔁',
            category: 'dti',
            description: 'Crea un lazo de control PID según ISA-5.1',
            steps: [
                {
                    id: 'tag',
                    title: '① Tag del lazo de control',
                    type: 'text',
                    placeholder: 'Ej: LIC-101, FIC-101, PIC-101',
                    description: 'Siga la nomenclatura ISA-5.1 para lazos',
                    validate: function(value) {
                        if (!value || value.trim() === '') return 'El Tag es obligatorio';
                        if (!/^[A-Z]+-\d+$/.test(value.trim())) {
                            return 'Formato ISA-5.1 inválido. Use: LETRAS-NÚMERO (ej: PIC-101)';
                        }
                        return null;
                    },
                    next: 'sensor'
                },
                {
                    id: 'sensor',
                    title: '② Sensor / Transmisor',
                    type: 'text',
                    placeholder: 'Ej: LT-101, FT-101, PT-101',
                    description: 'Tag del instrumento sensor',
                    next: 'controller'
                },
                {
                    id: 'controller',
                    title: '③ Controlador',
                    type: 'text',
                    placeholder: 'Ej: LIC-101, FIC-101',
                    description: 'Tag del controlador',
                    next: 'valve'
                },
                {
                    id: 'valve',
                    title: '④ Válvula de Control',
                    type: 'text',
                    placeholder: 'Ej: LV-101, FV-101, PV-101',
                    description: 'Tag de la válvula actuada',
                    next: 'loopType'
                },
                {
                    id: 'loopType',
                    title: '⑤ Tipo de lazo',
                    type: 'select',
                    description: 'Estrategia de control',
                    options: function() {
                        return [
                            { value: 'FEEDBACK', label: '🔁 FEEDBACK (estándar)' },
                            { value: 'CASCADE', label: '🔗 CASCADE (en cascada)' },
                            { value: 'RATIO', label: '⚖️ RATIO (relación)' },
                            { value: 'FEEDFORWARD', label: '➡️ FEEDFORWARD (adelanto)' },
                            { value: 'SPLIT_RANGE', label: '🔀 SPLIT RANGE (rango dividido)' },
                            { value: 'ON_OFF', label: '🔛 ON/OFF (todo/nada)' },
                            { value: 'SELECTOR', label: '🎯 SELECTOR (máx/mín)' }
                        ];
                    },
                    next: 'setpoint'
                },
                {
                    id: 'setpoint',
                    title: '⑥ Setpoint - Opcional',
                    type: 'text',
                    placeholder: 'Ej: 5 bar, 100 m³/h, 50 °C',
                    description: 'Valor de consigna del lazo',
                    next: 'range'
                },
                {
                    id: 'range',
                    title: '⑦ Rango - Opcional',
                    type: 'text',
                    placeholder: 'Ej: 0-10 bar, 0-100 m³/h',
                    description: 'Rango del lazo de control',
                    next: 'confirm'
                },
                {
                    id: 'confirm',
                    title: '✅ Confirmar creación',
                    type: 'confirm',
                    message: function(selections) {
                        return '✅ ¿Crear lazo **' + selections.tag + '**?\n\n' +
                               '📡 Sensor: ' + (selections.sensor || 'N/D') + '\n' +
                               '🎛️ Controlador: ' + (selections.controller || 'N/D') + '\n' +
                               '🔧 Válvula: ' + (selections.valve || 'N/D') + '\n' +
                               '🔁 Tipo: ' + (selections.loopType || 'FEEDBACK') + '\n' +
                               (selections.setpoint ? '🎯 Setpoint: ' + selections.setpoint + '\n' : '') +
                               (selections.range ? '📊 Rango: ' + selections.range + '\n' : '');
                    },
                    isFinal: true,
                    executeImmediately: true,
                    buildCommand: function(params, selections) {
                        var cmd = 'create loop ' + (selections.tag || 'LIC-101');
                        if (selections.sensor) cmd += ' sensor ' + selections.sensor;
                        if (selections.controller) cmd += ' controller ' + selections.controller;
                        if (selections.valve) cmd += ' valve ' + selections.valve;
                        if (selections.loopType) cmd += ' type ' + selections.loopType;
                        if (selections.setpoint) cmd += ' setpoint ' + selections.setpoint;
                        if (selections.range) cmd += ' range ' + selections.range;
                        return cmd;
                    }
                }
            ]
        },

        'INFO.INSTRUMENT': {
            name: 'Información de Instrumento',
            icon: '📋',
            category: 'dti',
            description: 'Muestra los detalles de un instrumento',
            steps: [
                {
                    id: 'tag',
                    title: 'Seleccione el instrumento',
                    type: 'dynamicSelect',
                    description: 'Instrumento para obtener información',
                    options: function() {
                        var instruments = getInstrumentsList();
                        if (instruments.length === 0) {
                            return [{ value: '', label: '⚠️ No hay instrumentos. Créelos con create instrument.', icon: '⚠️' }];
                        }
                        return instruments;
                    },
                    next: 'confirm'
                },
                {
                    id: 'confirm',
                    title: 'Confirmar',
                    type: 'confirm',
                    message: function(selections) {
                        return '📋 Mostrar información del instrumento **' + (selections.tag || '?') + '**';
                    },
                    isFinal: true,
                    executeImmediately: true,
                    buildCommand: function(params, selections) {
                        return 'info instrument ' + (selections.tag || '');
                    }
                }
            ]
        },

        'LIST.INSTRUMENTS': {
            name: 'Listar Instrumentos',
            icon: '📋',
            category: 'dti',
            description: 'Muestra todos los instrumentos',
            isDirect: true,
            command: 'list instruments'
        },

        'LIST.LOOPS': {
            name: 'Listar Lazos de Control',
            icon: '🔄',
            category: 'dti',
            description: 'Muestra todos los lazos de control',
            isDirect: true,
            command: 'list loops'
        },

        'LIST.INSTRUMENT_TYPES': {
            name: 'Tipos de Instrumentos',
            icon: '📁',
            category: 'dti',
            description: 'Muestra los tipos de instrumentos disponibles (ISA-5.1)',
            isDirect: true,
            command: 'list instrument types'
        },

        'VALIDATE.DTI': {
            name: 'Validar DTI',
            icon: '🔍',
            category: 'dti',
            description: 'Valida la integridad del DTI según ISA-5.1',
            isDirect: true,
            command: 'validate dti'
        }
    };

    // ================================================================
    // COMANDOS - MÓDULO ISO (25 comandos)
    // ================================================================
    
    const ISO_COMMANDS = {
        'CREATE.EQUIPMENT': {
            name: 'Crear Equipo 3D',
            icon: '🏗️',
            category: 'iso',
            description: 'Crea un equipo con dimensiones reales en 3D (ASME B31.3)',
            steps: [
                {
                    id: 'tipo',
                    title: 'Seleccione el tipo de equipo',
                    type: 'dynamicSelect',
                    description: 'Elija el tipo de equipo para modelar en 3D',
                    options: function() {
                        return getEquipmentTypes().map(function(t) {
                            return {
                                value: t.value,
                                label: t.label,
                                icon: t.icon,
                                description: t.categoria || ''
                            };
                        });
                    },
                    next: 'tag'
                },
                {
                    id: 'tag',
                    title: 'Tag del equipo',
                    type: 'text',
                    placeholder: 'Ej: TK-101, B-01, E-201',
                    description: 'Tag único para el equipo 3D',
                    validate: function(value) {
                        if (!value || value.trim() === '') return 'El Tag es obligatorio';
                        if (typeof SmartFlowCore !== 'undefined') {
                            if (SmartFlowCore.findObjectByTag(value.trim())) {
                                return 'El Tag "' + value.trim() + '" ya existe';
                            }
                        }
                        return null;
                    },
                    next: 'position'
                },
                {
                    id: 'position',
                    title: 'Posición (X, Y, Z) en mm',
                    type: 'coordinate',
                    description: 'Coordenadas del centro del equipo',
                    default: { x: 0, y: 0, z: 0 },
                    next: 'dimensions'
                },
                {
                    id: 'dimensions',
                    title: 'Dimensiones del equipo',
                    type: 'form',
                    description: 'Especifique las dimensiones en mm',
                    fields: function(selections) {
                        var tipo = selections.tipo || '';
                        var fields = [];
                        if (!['plataforma'].includes(tipo)) {
                            fields.push({ id: 'diametro', type: 'number', label: 'Diámetro (mm)', default: 1000, min: 50 });
                        }
                        if (!['plataforma'].includes(tipo) && tipo !== 'tanque_h') {
                            fields.push({ id: 'altura', type: 'number', label: 'Altura (mm)', default: 1500, min: 50 });
                        }
                        if (['tanque_h', 'plataforma', 'intercambiador', 'condensador'].includes(tipo) || 
                            (tipo && tipo.includes('bomba'))) {
                            fields.push({ id: 'largo', type: 'number', label: 'Largo (mm)', default: 1000, min: 50 });
                        }
                        if (['plataforma'].includes(tipo) || (tipo && tipo.includes('skid'))) {
                            fields.push({ id: 'ancho', type: 'number', label: 'Ancho (mm)', default: 1000, min: 50 });
                        }
                        if (fields.length === 0) {
                            fields.push({ id: 'diametro', type: 'number', label: 'Diámetro (mm)', default: 1000, min: 50 });
                            fields.push({ id: 'altura', type: 'number', label: 'Altura (mm)', default: 1500, min: 50 });
                        }
                        return fields;
                    },
                    next: 'material'
                },
                {
                    id: 'material',
                    title: 'Especificaciones del material',
                    type: 'form',
                    description: 'Seleccione material y especificación',
                    fields: [
                        { id: 'material', type: 'select', label: 'Material', options: function() { return getMaterialOptions(); } },
                        { id: 'spec', type: 'select', label: 'Especificación', options: function(selections) { 
                            return getSpecOptions(selections && selections.material ? selections.material : null);
                        } }
                    ],
                    next: 'connections'
                },
                {
                    id: 'connections',
                    title: 'Conexiones (opcional)',
                    type: 'form',
                    description: 'Diámetros de conexión en pulgadas',
                    fields: function(selections) {
                        var tipo = selections.tipo || '';
                        var fields = [];
                        if (tipo.includes('bomba') || tipo === 'compresor') {
                            fields.push({ id: 'diametro_succion', type: 'number', label: 'Diámetro Succión (pulg)', default: 3 });
                            fields.push({ id: 'diametro_descarga', type: 'number', label: 'Diámetro Descarga (pulg)', default: 3 });
                        } else if (['tanque_v', 'tanque_h', 'torre', 'reactor', 'separador'].includes(tipo)) {
                            fields.push({ id: 'diametro_entrada', type: 'number', label: 'Diámetro Entrada (pulg)', default: 4 });
                            fields.push({ id: 'diametro_salida', type: 'number', label: 'Diámetro Salida (pulg)', default: 4 });
                        }
                        return fields;
                    },
                    next: 'extras'
                },
                {
                    id: 'extras',
                    title: 'Extras (opcional)',
                    type: 'form',
                    description: 'Opciones adicionales para el equipo',
                    fields: function(selections) {
                        var tipo = selections.tipo || '';
                        var fields = [];
                        if (['plataforma', 'tanque_v', 'torre', 'reactor'].includes(tipo)) {
                            fields.push({ id: 'baranda', type: 'checkbox', label: 'Incluir baranda' });
                            fields.push({ id: 'escalera', type: 'checkbox', label: 'Incluir escalera' });
                        }
                        if (['reactor', 'reactor_encamisado'].includes(tipo)) {
                            fields.push({ id: 'agitador', type: 'checkbox', label: 'Incluir agitador' });
                            fields.push({ id: 'chaqueta', type: 'checkbox', label: 'Incluir chaqueta' });
                        }
                        return fields;
                    },
                    next: 'confirm'
                },
                {
                    id: 'confirm',
                    title: '✅ Confirmar creación',
                    type: 'confirm',
                    message: function(selections) {
                        var tipo = selections.tipo || '?';
                        var tipoLabel = getEquipmentTypeName(tipo);
                        var dims = selections.dimensions || {};
                        var pos = selections.position || { x: 0, y: 0, z: 0 };
                        var mat = selections.material || {};
                        return '✅ ¿Crear equipo 3D **' + selections.tag + '**?\n\n' +
                               '📐 Tipo: ' + tipoLabel + '\n' +
                               '📍 Posición: (' + pos.x + ', ' + pos.y + ', ' + pos.z + ')\n' +
                               (dims.diametro ? '📏 Diámetro: ' + dims.diametro + ' mm\n' : '') +
                               (dims.altura ? '📏 Altura: ' + dims.altura + ' mm\n' : '') +
                               (dims.largo ? '📏 Largo: ' + dims.largo + ' mm\n' : '') +
                               (dims.ancho ? '📏 Ancho: ' + dims.ancho + ' mm\n' : '') +
                               '🔩 Material: ' + (mat.material || 'PPR') + '\n' +
                               (mat.spec ? '📋 Spec: ' + mat.spec + '\n' : '');
                    },
                    isFinal: true,
                    executeImmediately: true,
                    buildCommand: function(params, selections) {
                        var cmd = 'create ' + (selections.tipo || 'tanque_v') + ' ' + (selections.tag || 'EQ-001');
                        var pos = selections.position || { x: 0, y: 0, z: 0 };
                        cmd += ' at (' + pos.x + ',' + pos.y + ',' + pos.z + ')';
                        var dims = selections.dimensions || {};
                        if (dims.diametro) cmd += ' diam ' + dims.diametro;
                        if (dims.altura) cmd += ' height ' + dims.altura;
                        if (dims.largo) cmd += ' largo ' + dims.largo;
                        if (dims.ancho) cmd += ' ancho ' + dims.ancho;
                        var mat = selections.material || {};
                        if (mat.material) cmd += ' material ' + mat.material;
                        if (mat.spec) cmd += ' spec ' + mat.spec;
                        var conn = selections.connections || {};
                        if (conn.diametro_succion) cmd += ' succion ' + conn.diametro_succion;
                        if (conn.diametro_descarga) cmd += ' descarga ' + conn.diametro_descarga;
                        if (conn.diametro_entrada) cmd += ' entrada ' + conn.diametro_entrada;
                        if (conn.diametro_salida) cmd += ' salida ' + conn.diametro_salida;
                        var extras = selections.extras || {};
                        if (extras.baranda) cmd += ' baranda true';
                        if (extras.escalera) cmd += ' escalera true';
                        if (extras.agitador) cmd += ' agitador true';
                        if (extras.chaqueta) cmd += ' chaqueta true';
                        return cmd;
                    }
                }
            ]
        },

        'UPDATE.EQUIPMENT': {
            name: 'Posicionar/Actualizar Equipo',
            icon: '📍',
            category: 'iso',
            description: '⭐ Posiciona o actualiza un equipo existente en 3D (ASME B31.3)',
            steps: [
                {
                    id: 'tag',
                    title: 'Seleccione el equipo a actualizar',
                    type: 'dynamicSelect',
                    description: 'Equipo existente que desea posicionar o modificar',
                    options: function() {
                        var equipos = getEquiposList();
                        if (equipos.length === 0) {
                            return [{ value: '', label: '⚠️ No hay equipos. Créelos en PFD o ISO.', icon: '⚠️' }];
                        }
                        return equipos;
                    },
                    next: 'position'
                },
                {
                    id: 'position',
                    title: 'Nueva posición (X, Y, Z) en mm',
                    type: 'coordinate',
                    description: 'Coordenadas donde se ubicará el equipo',
                    default: function(selections) {
                        if (typeof SmartFlowCore !== 'undefined' && selections && selections.tag) {
                            var eq = SmartFlowCore.findObjectByTag(selections.tag);
                            if (eq) return { x: eq.posX || 0, y: eq.posY || 0, z: eq.posZ || 0 };
                        }
                        return { x: 0, y: 0, z: 0 };
                    },
                    next: 'dimensions'
                },
                {
                    id: 'dimensions',
                    title: 'Dimensiones (opcional)',
                    type: 'form',
                    description: 'Modifique las dimensiones si es necesario',
                    fields: function(selections) {
                        var tag = selections && selections.tag ? selections.tag : '';
                        var defaultDiam = 1000, defaultAlt = 1500, defaultLargo = 1000, defaultAncho = 1000;
                        if (typeof SmartFlowCore !== 'undefined' && tag) {
                            var eq = SmartFlowCore.findObjectByTag(tag);
                            if (eq) {
                                defaultDiam = eq.diametro || 1000;
                                defaultAlt = eq.altura || 1500;
                                defaultLargo = eq.largo || 1000;
                                defaultAncho = eq.ancho || 1000;
                            }
                        }
                        return [
                            { id: 'diametro', type: 'number', label: 'Diámetro (mm)', default: defaultDiam, min: 50 },
                            { id: 'altura', type: 'number', label: 'Altura (mm)', default: defaultAlt, min: 50 },
                            { id: 'largo', type: 'number', label: 'Largo (mm)', default: defaultLargo, min: 50 },
                            { id: 'ancho', type: 'number', label: 'Ancho (mm)', default: defaultAncho, min: 50 }
                        ];
                    },
                    next: 'material'
                },
                {
                    id: 'material',
                    title: 'Material y especificación (opcional)',
                    type: 'form',
                    description: 'Cambie el material si es necesario',
                    fields: [
                        { id: 'material', type: 'select', label: 'Material', options: function() { return getMaterialOptions(); } },
                        { id: 'spec', type: 'select', label: 'Especificación', options: function(selections) {
                            return getSpecOptions(selections && selections.material ? selections.material : null);
                        } }
                    ],
                    next: 'connections'
                },
                {
                    id: 'connections',
                    title: 'Conexiones (opcional)',
                    type: 'form',
                    description: 'Actualice los diámetros de conexión',
                    fields: function(selections) {
                        var tag = selections && selections.tag ? selections.tag : '';
                        var defaultSucc = 3, defaultDesc = 3, defaultEnt = 4, defaultSal = 4;
                        if (typeof SmartFlowCore !== 'undefined' && tag) {
                            var eq = SmartFlowCore.findObjectByTag(tag);
                            if (eq) {
                                defaultSucc = eq.diametro_succion || 3;
                                defaultDesc = eq.diametro_descarga || 3;
                                defaultEnt = eq.diametro_entrada || 4;
                                defaultSal = eq.diametro_salida || 4;
                            }
                        }
                        return [
                            { id: 'diametro_succion', type: 'number', label: 'Diámetro Succión (pulg)', default: defaultSucc },
                            { id: 'diametro_descarga', type: 'number', label: 'Diámetro Descarga (pulg)', default: defaultDesc },
                            { id: 'diametro_entrada', type: 'number', label: 'Diámetro Entrada (pulg)', default: defaultEnt },
                            { id: 'diametro_salida', type: 'number', label: 'Diámetro Salida (pulg)', default: defaultSal }
                        ];
                    },
                    next: 'confirm'
                },
                {
                    id: 'confirm',
                    title: '✅ Confirmar actualización',
                    type: 'confirm',
                    message: function(selections) {
                        var pos = selections.position || { x: 0, y: 0, z: 0 };
                        var dims = selections.dimensions || {};
                        var mat = selections.material || {};
                        return '✅ ¿Actualizar equipo **' + selections.tag + '**?\n\n' +
                               '📍 Nueva posición: (' + pos.x + ', ' + pos.y + ', ' + pos.z + ')\n' +
                               (dims.diametro ? '📏 Diámetro: ' + dims.diametro + ' mm\n' : '') +
                               (dims.altura ? '📏 Altura: ' + dims.altura + ' mm\n' : '') +
                               (dims.largo ? '📏 Largo: ' + dims.largo + ' mm\n' : '') +
                               (dims.ancho ? '📏 Ancho: ' + dims.ancho + ' mm\n' : '') +
                               (mat.material ? '🔩 Material: ' + mat.material + '\n' : '') +
                               (mat.spec ? '📋 Spec: ' + mat.spec + '\n' : '');
                    },
                    isFinal: true,
                    executeImmediately: true,
                    buildCommand: function(params, selections) {
                        var cmd = 'update equipment ' + (selections.tag || 'EQ-001');
                        var pos = selections.position || { x: 0, y: 0, z: 0 };
                        cmd += ' posX ' + pos.x + ' posY ' + pos.y + ' posZ ' + pos.z;
                        var dims = selections.dimensions || {};
                        if (dims.diametro) cmd += ' diametro ' + dims.diametro;
                        if (dims.altura) cmd += ' altura ' + dims.altura;
                        if (dims.largo) cmd += ' largo ' + dims.largo;
                        if (dims.ancho) cmd += ' ancho ' + dims.ancho;
                        var mat = selections.material || {};
                        if (mat.material) cmd += ' material ' + mat.material;
                        if (mat.spec) cmd += ' spec ' + mat.spec;
                        var conn = selections.connections || {};
                        if (conn.diametro_succion) cmd += ' succion ' + conn.diametro_succion;
                        if (conn.diametro_descarga) cmd += ' descarga ' + conn.diametro_descarga;
                        if (conn.diametro_entrada) cmd += ' entrada ' + conn.diametro_entrada;
                        if (conn.diametro_salida) cmd += ' salida ' + conn.diametro_salida;
                        return cmd;
                    }
                }
            ]
        },

        'CREATE.LINE': {
            name: 'Crear Línea',
            icon: '📏',
            category: 'iso',
            description: 'Crea una línea con waypoints (ASME B31.3)',
            steps: [
                {
                    id: 'tag',
                    title: 'Tag de la línea',
                    type: 'text',
                    placeholder: 'Ej: L-001, L-101',
                    description: 'Identificador único de la línea',
                    validate: function(value) {
                        if (!value || value.trim() === '') return 'El Tag es obligatorio';
                        if (typeof SmartFlowCore !== 'undefined') {
                            if (SmartFlowCore.findObjectByTag(value.trim())) {
                                return 'El Tag "' + value.trim() + '" ya existe';
                            }
                        }
                        return null;
                    },
                    next: 'points'
                },
                {
                    id: 'points',
                    title: 'Puntos de ruta (X, Y, Z) en mm',
                    type: 'coordinateList',
                    minPoints: 2,
                    description: 'Agregue al menos 2 puntos para definir la ruta',
                    default: [{ x: 0, y: 0, z: 0 }, { x: 1000, y: 0, z: 0 }],
                    next: 'diameter'
                },
                {
                    id: 'diameter',
                    title: 'Diámetro de la línea',
                    type: 'select',
                    description: 'Diámetro nominal en pulgadas',
                    options: function() { return pipeDiameters(); },
                    next: 'material'
                },
                {
                    id: 'material',
                    title: 'Material y especificación',
                    type: 'form',
                    description: 'Seleccione material y especificación',
                    fields: [
                        { id: 'material', type: 'select', label: 'Material', options: function() { return getMaterialOptions(); } },
                        { id: 'spec', type: 'select', label: 'Especificación', options: function(selections) {
                            return getSpecOptions(selections && selections.material ? selections.material : null);
                        } }
                    ],
                    next: 'confirm'
                },
                {
                    id: 'confirm',
                    title: '✅ Confirmar creación',
                    type: 'confirm',
                    message: function(selections) {
                        var points = selections.points || [];
                        return '✅ ¿Crear línea **' + selections.tag + '**?\n\n' +
                               '📍 ' + points.length + ' puntos de ruta\n' +
                               '📏 Diámetro: ' + (selections.diameter || 4) + '"' + '\n' +
                               '🔩 Material: ' + (selections.material ? selections.material.material || 'PPR' : 'PPR') + '\n' +
                               (selections.material && selections.material.spec ? '📋 Spec: ' + selections.material.spec + '\n' : '');
                    },
                    isFinal: true,
                    executeImmediately: true,
                    buildCommand: function(params, selections) {
                        var cmd = 'create line ' + (selections.tag || 'L-001') + ' route';
                        var points = selections.points || [];
                        points.forEach(function(p) {
                            cmd += ' (' + (p.x || 0) + ',' + (p.y || 0) + ',' + (p.z || 0) + ')';
                        });
                        if (selections.diameter) cmd += ' diameter ' + selections.diameter;
                        var mat = selections.material || {};
                        if (mat.material) cmd += ' material ' + mat.material;
                        if (mat.spec) cmd += ' spec ' + mat.spec;
                        return cmd;
                    }
                }
            ]
        },

        'LINE.FROM.TO': {
            name: 'Línea Entre Equipos',
            icon: '🔗',
            category: 'iso',
            description: 'Crea una línea conectando dos equipos (ASME B31.3)',
            steps: [
                {
                    id: 'tag',
                    title: 'Tag de la línea',
                    type: 'text',
                    placeholder: 'Ej: L-001, L-101',
                    description: 'Identificador único de la línea',
                    validate: function(value) {
                        if (!value || value.trim() === '') return 'El Tag es obligatorio';
                        if (typeof SmartFlowCore !== 'undefined') {
                            if (SmartFlowCore.findObjectByTag(value.trim())) {
                                return 'El Tag "' + value.trim() + '" ya existe';
                            }
                        }
                        return null;
                    },
                    next: 'fromEquip'
                },
                {
                    id: 'fromEquip',
                    title: 'Equipo Origen',
                    type: 'dynamicSelect',
                    description: 'Seleccione el equipo de origen',
                    options: function() {
                        var equipos = getEquiposList();
                        if (equipos.length === 0) {
                            return [{ value: '', label: '⚠️ No hay equipos. Créelos en PFD.', icon: '⚠️' }];
                        }
                        return equipos;
                    },
                    next: 'fromPort'
                },
                {
                    id: 'fromPort',
                    title: 'Puerto Origen',
                    type: 'dynamicSelect',
                    description: 'Seleccione el puerto de salida',
                    options: function(selections) {
                        if (!selections || !selections.fromEquip) {
                            return [{ value: '', label: 'Seleccione un equipo primero' }];
                        }
                        var puertos = getPuertosTodos(selections.fromEquip);
                        if (puertos.length === 0) {
                            return [{ value: '', label: '⚠️ Sin puertos disponibles' }];
                        }
                        return puertos;
                    },
                    next: 'toEquip'
                },
                {
                    id: 'toEquip',
                    title: 'Equipo Destino',
                    type: 'dynamicSelect',
                    description: 'Seleccione el equipo de destino',
                    options: function(selections) {
                        var equipos = getEquiposList();
                        if (equipos.length === 0) {
                            return [{ value: '', label: '⚠️ No hay equipos', icon: '⚠️' }];
                        }
                        if (selections && selections.fromEquip) {
                            return equipos.filter(function(e) { return e.value !== selections.fromEquip; });
                        }
                        return equipos;
                    },
                    next: 'toPort'
                },
                {
                    id: 'toPort',
                    title: 'Puerto Destino',
                    type: 'dynamicSelect',
                    description: 'Seleccione el puerto de entrada',
                    options: function(selections) {
                        if (!selections || !selections.toEquip) {
                            return [{ value: '', label: 'Seleccione un equipo primero' }];
                        }
                        var puertos = getPuertosTodos(selections.toEquip);
                        if (puertos.length === 0) {
                            return [{ value: '', label: '⚠️ Sin puertos disponibles' }];
                        }
                        return puertos;
                    },
                    next: 'diameter'
                },
                {
                    id: 'diameter',
                    title: 'Diámetro de la línea',
                    type: 'select',
                    description: 'Diámetro nominal en pulgadas',
                    options: function() { return pipeDiameters(); },
                    next: 'material'
                },
                {
                    id: 'material',
                    title: 'Material y especificación',
                    type: 'form',
                    description: 'Seleccione material y especificación',
                    fields: [
                        { id: 'material', type: 'select', label: 'Material', options: function() { return getMaterialOptions(); } },
                        { id: 'spec', type: 'select', label: 'Especificación', options: function(selections) {
                            return getSpecOptions(selections && selections.material ? selections.material : null);
                        } }
                    ],
                    next: 'confirm'
                },
                {
                    id: 'confirm',
                    title: '✅ Confirmar creación',
                    type: 'confirm',
                    message: function(selections) {
                        return '✅ ¿Crear línea **' + selections.tag + '**?\n\n' +
                               '🔗 ' + (selections.fromEquip || '?') + ':' + (selections.fromPort || '?') + 
                               ' → ' + (selections.toEquip || '?') + ':' + (selections.toPort || '?') + '\n' +
                               '📏 Diámetro: ' + (selections.diameter || 4) + '"' + '\n' +
                               '🔩 Material: ' + (selections.material ? selections.material.material || 'PPR' : 'PPR');
                    },
                    isFinal: true,
                    executeImmediately: true,
                    buildCommand: function(params, selections) {
                        var cmd = 'line ' + (selections.tag || 'L-001') + 
                                  ' from ' + (selections.fromEquip || '?') + ' ' + (selections.fromPort || 'N1') +
                                  ' to ' + (selections.toEquip || '?') + ' ' + (selections.toPort || 'N1');
                        if (selections.diameter) cmd += ' diameter ' + selections.diameter;
                        var mat = selections.material || {};
                        if (mat.material) cmd += ' material ' + mat.material;
                        if (mat.spec) cmd += ' spec ' + mat.spec;
                        return cmd;
                    }
                }
            ]
        },

        'CONNECT': {
            name: 'Conectar',
            icon: '🔌',
            category: 'iso',
            description: 'Conecta equipos o líneas entre sí (solo puertos libres)',
            steps: [
                {
                    id: 'tipoConexion',
                    title: 'Tipo de conexión',
                    type: 'select',
                    description: 'Seleccione qué desea conectar',
                    options: function() {
                        var opts = [
                            { value: 'equipo_equipo', label: '🏗️ Equipo → Equipo' },
                            { value: 'equipo_linea', label: '🏗️ Equipo → 📏 Línea' },
                            { value: 'linea_equipo', label: '📏 Línea → 🏗️ Equipo' },
                            { value: 'linea_linea', label: '📏 Línea → 📏 Línea' }
                        ];
                        var lines = getLineasList();
                        if (lines.length === 0) {
                            return opts.filter(function(o) { return o.value === 'equipo_equipo'; });
                        }
                        var equipos = getEquiposList();
                        if (equipos.length === 0) {
                            return [{ value: '', label: '⚠️ No hay equipos. Créelos en PFD o ISO.', icon: '⚠️' }];
                        }
                        return opts;
                    },
                    nextMap: {
                        'equipo_equipo': 'fromEquip',
                        'equipo_linea': 'fromEquip',
                        'linea_equipo': 'fromLine',
                        'linea_linea': 'fromLine'
                    }
                },
                {
                    id: 'fromEquip',
                    title: 'Equipo Origen',
                    type: 'dynamicSelect',
                    description: 'Seleccione el equipo de origen (debe tener puertos libres)',
                    options: function() {
                        var equipos = getEquiposList();
                        if (equipos.length === 0) {
                            return [{ value: '', label: '⚠️ No hay equipos. Créelos en PFD.', icon: '⚠️' }];
                        }
                        return equipos.filter(function(eq) {
                            if (typeof SmartFlowCore === 'undefined') return true;
                            var obj = SmartFlowCore.findObjectByTag(eq.value);
                            if (!obj || !obj.puertos) return false;
                            return obj.puertos.some(function(p) { return p.status === 'open' || !p.connectedTo; });
                        });
                    },
                    next: 'fromPort'
                },
                {
                    id: 'fromPort',
                    title: 'Puerto Origen (SOLO LIBRES)',
                    type: 'dynamicSelect',
                    description: 'Seleccione el puerto de salida (solo se muestran puertos libres)',
                    options: function(selections) {
                        if (!selections || !selections.fromEquip) {
                            return [{ value: '', label: 'Seleccione un equipo primero' }];
                        }
                        var puertos = getPuertosLibres(selections.fromEquip);
                        if (puertos.length === 0) {
                            return [{ value: '', label: '⚠️ No hay puertos libres en ' + selections.fromEquip, icon: '⚠️' }];
                        }
                        return puertos;
                    },
                    next: function(selections) {
                        if (selections.tipoConexion === 'equipo_equipo') return 'toEquip';
                        if (selections.tipoConexion === 'equipo_linea') return 'toLine';
                        return 'toEquip';
                    }
                },
                {
                    id: 'fromLine',
                    title: 'Línea Origen',
                    type: 'dynamicSelect',
                    description: 'Seleccione la línea de origen (debe tener geometría)',
                    options: function() {
                        var lines = getLineasList();
                        if (lines.length === 0) {
                            return [{ value: '', label: '⚠️ No hay líneas. Créelas en ISO.', icon: '⚠️' }];
                        }
                        return lines;
                    },
                    next: 'fromPosition'
                },
                {
                    id: 'fromPosition',
                    title: 'Posición en la línea origen',
                    type: 'select',
                    description: 'Seleccione la posición de conexión en la línea',
                    options: function() {
                        return getPosicionesLinea();
                    },
                    next: function(selections) {
                        if (selections.tipoConexion === 'linea_equipo') return 'toEquip';
                        if (selections.tipoConexion === 'linea_linea') return 'toLine';
                        return 'toEquip';
                    }
                },
                {
                    id: 'toEquip',
                    title: 'Equipo Destino',
                    type: 'dynamicSelect',
                    description: 'Seleccione el equipo destino (debe tener puertos libres)',
                    options: function(selections) {
                        var equipos = getEquiposList();
                        if (equipos.length === 0) {
                            return [{ value: '', label: '⚠️ No hay equipos', icon: '⚠️' }];
                        }
                        if (selections && selections.fromEquip) {
                            equipos = equipos.filter(function(e) { return e.value !== selections.fromEquip; });
                        }
                        return equipos.filter(function(eq) {
                            if (typeof SmartFlowCore === 'undefined') return true;
                            var obj = SmartFlowCore.findObjectByTag(eq.value);
                            if (!obj || !obj.puertos) return false;
                            return obj.puertos.some(function(p) { return p.status === 'open' || !p.connectedTo; });
                        });
                    },
                    next: 'toPort'
                },
                {
                    id: 'toPort',
                    title: 'Puerto Destino (SOLO LIBRES)',
                    type: 'dynamicSelect',
                    description: 'Seleccione el puerto de entrada (solo se muestran puertos libres)',
                    options: function(selections) {
                        if (!selections || !selections.toEquip) {
                            return [{ value: '', label: 'Seleccione un equipo primero' }];
                        }
                        var puertos = getPuertosLibres(selections.toEquip);
                        if (puertos.length === 0) {
                            return [{ value: '', label: '⚠️ No hay puertos libres en ' + selections.toEquip, icon: '⚠️' }];
                        }
                        return puertos;
                    },
                    next: 'diameter'
                },
                {
                    id: 'toLine',
                    title: 'Línea Destino',
                    type: 'dynamicSelect',
                    description: 'Seleccione la línea destino (debe tener geometría)',
                    options: function(selections) {
                        var lines = getLineasList();
                        if (lines.length === 0) {
                            return [{ value: '', label: '⚠️ No hay líneas', icon: '⚠️' }];
                        }
                        if (selections && selections.fromLine) {
                            lines = lines.filter(function(l) { return l.value !== selections.fromLine; });
                        }
                        return lines;
                    },
                    next: 'toPosition'
                },
                {
                    id: 'toPosition',
                    title: 'Posición en la línea destino',
                    type: 'select',
                    description: 'Seleccione la posición de conexión en la línea',
                    options: function() {
                        return getPosicionesLinea();
                    },
                    next: 'diameter'
                },
                {
                    id: 'diameter',
                    title: 'Diámetro de la nueva línea',
                    type: 'select',
                    description: 'Diámetro nominal en pulgadas',
                    options: function() { return pipeDiameters(); },
                    next: 'material'
                },
                {
                    id: 'material',
                    title: 'Material y especificación',
                    type: 'form',
                    description: 'Seleccione material y especificación',
                    fields: [
                        { id: 'material', type: 'select', label: 'Material', options: function() { return getMaterialOptions(); } },
                        { id: 'spec', type: 'select', label: 'Especificación', options: function(selections) {
                            return getSpecOptions(selections && selections.material ? selections.material : null);
                        } }
                    ],
                    next: 'confirm'
                },
                {
                    id: 'confirm',
                    title: '✅ Confirmar conexión',
                    type: 'confirm',
                    message: function(selections) {
                        var tipo = selections.tipoConexion || 'equipo_equipo';
                        var msg = '✅ Conectar:\n';
                        if (tipo === 'equipo_equipo') {
                            msg += '🏗️ ' + (selections.fromEquip || '?') + ':' + (selections.fromPort || '?') + 
                                   ' → 🏗️ ' + (selections.toEquip || '?') + ':' + (selections.toPort || '?');
                        } else if (tipo === 'equipo_linea') {
                            msg += '🏗️ ' + (selections.fromEquip || '?') + ':' + (selections.fromPort || '?') + 
                                   ' → 📏 ' + (selections.toLine || '?') + ' @ ' + (selections.toPosition || '0.5');
                        } else if (tipo === 'linea_equipo') {
                            msg += '📏 ' + (selections.fromLine || '?') + ' @ ' + (selections.fromPosition || '0.5') + 
                                   ' → 🏗️ ' + (selections.toEquip || '?') + ':' + (selections.toPort || '?');
                        } else if (tipo === 'linea_linea') {
                            msg += '📏 ' + (selections.fromLine || '?') + ' @ ' + (selections.fromPosition || '0.5') + 
                                   ' → 📏 ' + (selections.toLine || '?') + ' @ ' + (selections.toPosition || '0.5');
                        }
                        msg += '\n\n📏 Diámetro: ' + (selections.diameter || 4) + '"';
                        var mat = selections.material || {};
                        if (mat.material) msg += '\n🔩 Material: ' + mat.material;
                        if (mat.spec) msg += '\n📋 Spec: ' + mat.spec;
                        return msg;
                    },
                    isFinal: true,
                    executeImmediately: true,
                    buildCommand: function(params, selections) {
                        var tipo = selections.tipoConexion || 'equipo_equipo';
                        var cmd = 'connect ';
                        if (tipo === 'equipo_equipo') {
                            cmd += (selections.fromEquip || '?') + ' ' + (selections.fromPort || '0') +
                                   ' to ' + (selections.toEquip || '?') + ' ' + (selections.toPort || '1');
                        } else if (tipo === 'equipo_linea') {
                            cmd += (selections.fromEquip || '?') + ' ' + (selections.fromPort || '0') +
                                   ' to ' + (selections.toLine || '?') + ' ' + (selections.toPosition || '0.5');
                        } else if (tipo === 'linea_equipo') {
                            cmd += (selections.fromLine || '?') + ' ' + (selections.fromPosition || '0.5') +
                                   ' to ' + (selections.toEquip || '?') + ' ' + (selections.toPort || '1');
                        } else if (tipo === 'linea_linea') {
                            cmd += (selections.fromLine || '?') + ' ' + (selections.fromPosition || '0.5') +
                                   ' to ' + (selections.toLine || '?') + ' ' + (selections.toPosition || '0.5');
                        }
                        if (selections.diameter) cmd += ' diameter ' + selections.diameter;
                        var mat = selections.material || {};
                        if (mat.material) cmd += ' material ' + mat.material;
                        if (mat.spec) cmd += ' spec ' + mat.spec;
                        return cmd;
                    }
                }
            ]
        },

        'ROUTE': {
            name: 'Ruta con Waypoints',
            icon: '🗺️',
            category: 'iso',
            description: 'Crea una ruta con puntos intermedios (ASME B31.3)',
            steps: [
                {
                    id: 'fromEquip',
                    title: 'Equipo Origen',
                    type: 'dynamicSelect',
                    description: 'Seleccione el equipo de origen',
                    options: function() {
                        var equipos = getEquiposList();
                        if (equipos.length === 0) {
                            return [{ value: '', label: '⚠️ No hay equipos', icon: '⚠️' }];
                        }
                        return equipos;
                    },
                    next: 'fromPort'
                },
                {
                    id: 'fromPort',
                    title: 'Puerto Origen',
                    type: 'dynamicSelect',
                    description: 'Seleccione el puerto de salida',
                    options: function(selections) {
                        if (!selections || !selections.fromEquip) return [{ value: '', label: 'Seleccione un equipo' }];
                        return getPuertosTodos(selections.fromEquip);
                    },
                    next: 'waypoints'
                },
                {
                    id: 'waypoints',
                    title: 'Waypoints (X, Y, Z) en mm',
                    type: 'coordinateList',
                    minPoints: 1,
                    description: 'Agregue puntos intermedios para la ruta',
                    default: [{ x: 500, y: 0, z: 0 }, { x: 1000, y: 500, z: 0 }],
                    next: 'toEquip'
                },
                {
                    id: 'toEquip',
                    title: 'Equipo Destino',
                    type: 'dynamicSelect',
                    description: 'Seleccione el equipo de destino',
                    options: function(selections) {
                        var equipos = getEquiposList();
                        if (selections && selections.fromEquip) {
                            equipos = equipos.filter(function(e) { return e.value !== selections.fromEquip; });
                        }
                        if (equipos.length === 0) {
                            return [{ value: '', label: '⚠️ No hay equipos disponibles', icon: '⚠️' }];
                        }
                        return equipos;
                    },
                    next: 'toPort'
                },
                {
                    id: 'toPort',
                    title: 'Puerto Destino',
                    type: 'dynamicSelect',
                    description: 'Seleccione el puerto de entrada',
                    options: function(selections) {
                        if (!selections || !selections.toEquip) return [{ value: '', label: 'Seleccione un equipo' }];
                        return getPuertosTodos(selections.toEquip);
                    },
                    next: 'diameter'
                },
                {
                    id: 'diameter',
                    title: 'Diámetro',
                    type: 'select',
                    description: 'Diámetro nominal en pulgadas',
                    options: function() { return pipeDiameters(); },
                    next: 'confirm'
                },
                {
                    id: 'confirm',
                    title: '✅ Confirmar ruta',
                    type: 'confirm',
                    message: function(selections) {
                        var pts = selections.waypoints || [];
                        return '🗺️ Crear ruta de **' + (selections.fromEquip || '?') + ':' + (selections.fromPort || '?') +
                               '** a **' + (selections.toEquip || '?') + ':' + (selections.toPort || '?') + '**\n\n' +
                               '📍 ' + pts.length + ' waypoint(s)\n' +
                               '📏 Diámetro: ' + (selections.diameter || 4) + '"';
                    },
                    isFinal: true,
                    executeImmediately: true,
                    buildCommand: function(params, selections) {
                        var cmd = 'route from ' + (selections.fromEquip || '?') + ' ' + (selections.fromPort || '0');
                        var pts = selections.waypoints || [];
                        if (pts.length > 0) {
                            cmd += ' via';
                            pts.forEach(function(p) {
                                cmd += ' (' + (p.x || 0) + ',' + (p.y || 0) + ',' + (p.z || 0) + ')';
                            });
                        }
                        cmd += ' to ' + (selections.toEquip || '?') + ' ' + (selections.toPort || '1');
                        if (selections.diameter) cmd += ' diameter ' + selections.diameter;
                        return cmd;
                    }
                }
            ]
        },

        'TAP': {
            name: 'Derivación (Tap)',
            icon: '🔀',
            category: 'iso',
            description: 'Crea una derivación desde un equipo a una línea existente',
            steps: [
                {
                    id: 'fromEquip',
                    title: 'Equipo Origen',
                    type: 'dynamicSelect',
                    description: 'Seleccione el equipo de origen (debe tener puerto libre)',
                    options: function() {
                        var equipos = getEquiposList();
                        if (equipos.length === 0) {
                            return [{ value: '', label: '⚠️ No hay equipos', icon: '⚠️' }];
                        }
                        return equipos.filter(function(eq) {
                            if (typeof SmartFlowCore === 'undefined') return true;
                            var obj = SmartFlowCore.findObjectByTag(eq.value);
                            if (!obj || !obj.puertos) return false;
                            return obj.puertos.some(function(p) { return p.status === 'open' || !p.connectedTo; });
                        });
                    },
                    next: 'fromPort'
                },
                {
                    id: 'fromPort',
                    title: 'Puerto Origen (SOLO LIBRES)',
                    type: 'dynamicSelect',
                    description: 'Seleccione el puerto de salida (solo puertos libres)',
                    options: function(selections) {
                        if (!selections || !selections.fromEquip) {
                            return [{ value: '', label: 'Seleccione un equipo primero' }];
                        }
                        var puertos = getPuertosLibres(selections.fromEquip);
                        if (puertos.length === 0) {
                            return [{ value: '', label: '⚠️ No hay puertos libres en ' + selections.fromEquip, icon: '⚠️' }];
                        }
                        return puertos;
                    },
                    next: 'toLine'
                },
                {
                    id: 'toLine',
                    title: 'Línea Destino (EXISTENTE)',
                    type: 'dynamicSelect',
                    description: 'Seleccione la línea existente donde derivar',
                    options: function() {
                        var lines = getLineasList();
                        if (lines.length === 0) {
                            return [{ value: '', label: '⚠️ No hay líneas. Cree una en ISO.', icon: '⚠️' }];
                        }
                        return lines;
                    },
                    next: 'position'
                },
                {
                    id: 'position',
                    title: 'Posición de derivación en la línea',
                    type: 'select',
                    description: 'Seleccione la posición donde insertar el TEE',
                    options: function() {
                        return getPosicionesLinea();
                    },
                    next: 'diameter'
                },
                {
                    id: 'diameter',
                    title: 'Diámetro de la línea derivada',
                    type: 'select',
                    description: 'Diámetro nominal en pulgadas',
                    options: function() { return pipeDiameters(); },
                    next: 'confirm'
                },
                {
                    id: 'confirm',
                    title: '✅ Confirmar derivación',
                    type: 'confirm',
                    message: function(selections) {
                        return '✅ Crear derivación:\n' +
                               '🏗️ ' + (selections.fromEquip || '?') + ':' + (selections.fromPort || '?') + 
                               ' → 📏 ' + (selections.toLine || '?') + ' @ ' + (selections.position || '0.5') +
                               '\n\n📏 Diámetro: ' + (selections.diameter || 4) + '"';
                    },
                    isFinal: true,
                    executeImmediately: true,
                    buildCommand: function(params, selections) {
                        return 'tap ' + (selections.fromEquip || '?') + ' ' + (selections.fromPort || 'N1') +
                               ' to ' + (selections.toLine || '?') + ' ' + (selections.position || '0.5') +
                               ' diameter ' + (selections.diameter || 4);
                    }
                }
            ]
        },

        'SPLIT': {
            name: 'Dividir Línea',
            icon: '✂️',
            category: 'iso',
            description: 'Divide una línea existente en un punto',
            steps: [
                {
                    id: 'lineTag',
                    title: 'Línea a dividir (EXISTENTE)',
                    type: 'dynamicSelect',
                    description: 'Seleccione la línea existente que desea dividir',
                    options: function() {
                        var lines = getLineasList();
                        if (lines.length === 0) {
                            return [{ value: '', label: '⚠️ No hay líneas. Cree una en ISO.', icon: '⚠️' }];
                        }
                        return lines;
                    },
                    next: 'position'
                },
                {
                    id: 'position',
                    title: 'Posición de división en la línea',
                    type: 'select',
                    description: 'Seleccione la posición donde insertar el TEE',
                    options: function() {
                        return [
                            { value: '0.1', label: '0.1 (cerca inicio)', icon: '🔵' },
                            { value: '0.25', label: '0.25', icon: '🔵' },
                            { value: '0.5', label: '0.5 (Centro)', icon: '🔵' },
                            { value: '0.75', label: '0.75', icon: '🔵' },
                            { value: '0.9', label: '0.9 (cerca final)', icon: '🔵' }
                        ];
                    },
                    next: 'type'
                },
                {
                    id: 'type',
                    title: 'Tipo de TEE',
                    type: 'select',
                    description: 'Seleccione el tipo de accesorio',
                    options: function() {
                        return [
                            { value: 'TEE_EQUAL', label: '🔱 TEE Recta (igual diámetro)' },
                            { value: 'TEE_REDUCING', label: '🔱 TEE Reductora' }
                        ];
                    },
                    next: 'confirm'
                },
                {
                    id: 'confirm',
                    title: '✅ Confirmar división',
                    type: 'confirm',
                    message: function(selections) {
                        return '✅ Dividir línea **' + (selections.lineTag || '?') + '**' +
                               '\n📍 Posición: ' + (selections.position || '0.5') +
                               '\n🔱 Tipo: ' + (selections.type || 'TEE_EQUAL');
                    },
                    isFinal: true,
                    executeImmediately: true,
                    buildCommand: function(params, selections) {
                        return 'split ' + (selections.lineTag || 'L-001') + ' at param ' + (selections.position || '0.5') +
                               ' type ' + (selections.type || 'TEE_EQUAL');
                    }
                }
            ]
        },

        'ACCESSORIES': {
            name: 'Gestionar Accesorios',
            icon: '🔩',
            category: 'iso',
            description: 'Añade accesorios a una línea (ASME B31.3)',
            steps: [
                {
                    id: 'lineTag',
                    title: 'Seleccione la línea',
                    type: 'dynamicSelect',
                    description: 'Línea donde añadir accesorios',
                    options: function() {
                        var lines = getLineasList();
                        if (lines.length === 0) {
                            return [{ value: '', label: '⚠️ No hay líneas', icon: '⚠️' }];
                        }
                        return lines;
                    },
                    next: 'mode'
                },
                {
                    id: 'mode',
                    title: 'Modo de adición',
                    type: 'select',
                    description: 'Seleccione cómo añadir los accesorios',
                    options: function() {
                        return [
                            { value: 'add', label: '➕ Añadir manual (TIPO@pos)' },
                            { value: 'auto', label: '🤖 Auto-espaciado' },
                            { value: 'transition', label: '🔄 Transición de materiales' }
                        ];
                    },
                    next: function(selections) {
                        if (selections && selections.mode === 'transition') return 'materialFrom';
                        return 'components';
                    }
                },
                {
                    id: 'components',
                    title: 'Componentes a añadir',
                    type: 'text',
                    placeholder: 'Ej: GATE_VALVE@0.3 BALL_VALVE@0.7',
                    description: 'Lista de componentes con su posición (TIPO@pos)',
                    next: function(selections) {
                        if (selections && selections.mode === 'transition') return 'materialFrom';
                        return 'confirm';
                    },
                    condition: function(selections) {
                        return selections && selections.mode !== 'transition';
                    }
                },
                {
                    id: 'materialFrom',
                    title: 'Material de origen',
                    type: 'select',
                    description: 'Material actual de la línea',
                    options: function() { return getMaterialOptions(); },
                    next: 'materialTo',
                    condition: function(selections) {
                        return selections && selections.mode === 'transition';
                    }
                },
                {
                    id: 'materialTo',
                    title: 'Material de destino',
                    type: 'select',
                    description: 'Material al que se transiciona',
                    options: function() { return getMaterialOptions(); },
                    next: 'confirm',
                    condition: function(selections) {
                        return selections && selections.mode === 'transition';
                    }
                },
                {
                    id: 'confirm',
                    title: '✅ Confirmar',
                    type: 'confirm',
                    message: function(selections) {
                        if (selections.mode === 'add') {
                            return '✅ Añadir accesorios a **' + selections.lineTag + '**:\n\n' +
                                   '🔩 ' + (selections.components || 'Ninguno');
                        } else if (selections.mode === 'auto') {
                            return '✅ Añadir accesorios con auto-espaciado a **' + selections.lineTag + '**:\n\n' +
                                   '🔩 ' + (selections.components || 'Ninguno');
                        } else if (selections.mode === 'transition') {
                            return '✅ Crear transición en **' + selections.lineTag + '**:\n\n' +
                                   '🔄 ' + (selections.materialFrom || 'PPR') + ' → ' + (selections.materialTo || 'CS');
                        }
                        return '✅ Confirmar operación';
                    },
                    isFinal: true,
                    executeImmediately: true,
                    buildCommand: function(params, selections) {
                        if (selections.mode === 'add' || selections.mode === 'auto') {
                            return 'accessories ' + (selections.lineTag || 'L-001') + ' ' + 
                                   (selections.mode || 'add') + ' ' + (selections.components || '');
                        } else if (selections.mode === 'transition') {
                            return 'accessories ' + (selections.lineTag || 'L-001') + ' transition from ' +
                                   (selections.materialFrom || 'PPR') + ' to ' + (selections.materialTo || 'CS');
                        }
                        return 'accessories ' + (selections.lineTag || 'L-001') + ' add';
                    }
                }
            ]
        },

        'DELETE': {
            name: 'Eliminar Elemento',
            icon: '🗑️',
            category: 'iso',
            description: 'Elimina un equipo o línea del proyecto',
            steps: [
                {
                    id: 'tag',
                    title: 'Seleccione el elemento a eliminar',
                    type: 'dynamicSelect',
                    description: 'Equipo o línea que desea eliminar',
                    options: function() {
                        var allOptions = [];
                        var equipos = getEquiposList();
                        var lines = getLineasList();
                        equipos.forEach(function(e) {
                            allOptions.push({ value: e.value, label: '🏗️ ' + e.label, icon: '🏗️', type: 'equipment' });
                        });
                        lines.forEach(function(l) {
                            allOptions.push({ value: l.value, label: '📏 ' + l.label, icon: '📏', type: 'line' });
                        });
                        if (allOptions.length === 0) {
                            return [{ value: '', label: '⚠️ No hay elementos', icon: '⚠️' }];
                        }
                        return allOptions;
                    },
                    next: 'type'
                },
                {
                    id: 'type',
                    title: 'Tipo de eliminación',
                    type: 'select',
                    description: 'Confirme el tipo de elemento',
                    options: function(selections) {
                        var tag = selections && selections.tag ? selections.tag : '';
                        var isEquipment = false, isLine = false;
                        if (typeof SmartFlowCore !== 'undefined' && tag) {
                            var obj = SmartFlowCore.findObjectByTag(tag);
                            if (obj) {
                                isEquipment = obj.posX !== undefined || (obj.pos && obj.pos.x !== undefined);
                                isLine = !isEquipment;
                            }
                        }
                        var options = [];
                        if (isEquipment || !tag) {
                            options.push({ value: 'equipment', label: '🏗️ Equipo' });
                        }
                        if (isLine || !tag) {
                            options.push({ value: 'line', label: '📏 Línea' });
                        }
                        if (options.length === 0) {
                            return [{ value: '', label: '⚠️ No se pudo determinar el tipo' }];
                        }
                        return options;
                    },
                    next: 'confirm'
                },
                {
                    id: 'confirm',
                    title: '⚠️ Confirmar eliminación',
                    type: 'confirm',
                    message: function(selections) {
                        return '⚠️ ¿Eliminar **' + (selections.tag || '?') + '**?\n\n' +
                               'Esta acción **NO SE PUEDE DESHACER**.\n' +
                               'Las líneas conectadas también serán eliminadas.';
                    },
                    isFinal: true,
                    executeImmediately: true,
                    buildCommand: function(params, selections) {
                        return 'delete ' + (selections.type || 'equipment') + ' ' + (selections.tag || '');
                    }
                }
            ]
        },

        'MOVE': {
            name: 'Mover Elemento',
            icon: '✋',
            category: 'iso',
            description: 'Mueve un elemento a una nueva posición',
            steps: [
                {
                    id: 'tag',
                    title: 'Elemento a mover',
                    type: 'dynamicSelect',
                    description: 'Seleccione el elemento que desea mover',
                    options: function() {
                        var allOptions = [];
                        var equipos = getEquiposList();
                        var lines = getLineasList();
                        equipos.forEach(function(e) {
                            allOptions.push({ value: e.value, label: '🏗️ ' + e.label, icon: '🏗️' });
                        });
                        lines.forEach(function(l) {
                            allOptions.push({ value: l.value, label: '📏 ' + l.label, icon: '📏' });
                        });
                        if (allOptions.length === 0) {
                            return [{ value: '', label: '⚠️ No hay elementos', icon: '⚠️' }];
                        }
                        return allOptions;
                    },
                    next: 'mode'
                },
                {
                    id: 'mode',
                    title: 'Modo de movimiento',
                    type: 'select',
                    description: '¿Mover a coordenadas absolutas o relativo?',
                    options: function() {
                        return [
                            { value: 'to', label: '📍 A coordenadas (to)' },
                            { value: 'by', label: '➕ Desplazamiento (by)' }
                        ];
                    },
                    next: 'position'
                },
                {
                    id: 'position',
                    title: 'Coordenadas (X, Y, Z) en mm',
                    type: 'coordinate',
                    description: 'Nueva posición o desplazamiento',
                    default: { x: 0, y: 0, z: 0 },
                    next: 'confirm'
                },
                {
                    id: 'confirm',
                    title: '✅ Confirmar movimiento',
                    type: 'confirm',
                    message: function(selections) {
                        var pos = selections.position || { x: 0, y: 0, z: 0 };
                        var mode = selections.mode === 'to' ? 'a' : 'desplazar';
                        return '✅ Mover **' + (selections.tag || '?') + '** ' + mode + ' (' + pos.x + ', ' + pos.y + ', ' + pos.z + ')';
                    },
                    isFinal: true,
                    executeImmediately: true,
                    buildCommand: function(params, selections) {
                        var pos = selections.position || { x: 0, y: 0, z: 0 };
                        return 'move ' + (selections.tag || '') + ' ' + (selections.mode || 'to') + 
                               ' (' + pos.x + ',' + pos.y + ',' + pos.z + ')';
                    }
                }
            ]
        },

        'EDIT': {
            name: 'Editar Propiedades',
            icon: '✏️',
            category: 'iso',
            description: 'Edita propiedades de un elemento',
            steps: [
                {
                    id: 'tag',
                    title: 'Elemento a editar',
                    type: 'dynamicSelect',
                    description: 'Seleccione el elemento',
                    options: function() {
                        var allOptions = [];
                        var equipos = getEquiposList();
                        var lines = getLineasList();
                        equipos.forEach(function(e) {
                            allOptions.push({ value: e.value, label: '🏗️ ' + e.label, icon: '🏗️' });
                        });
                        lines.forEach(function(l) {
                            allOptions.push({ value: l.value, label: '📏 ' + l.label, icon: '📏' });
                        });
                        if (allOptions.length === 0) {
                            return [{ value: '', label: '⚠️ No hay elementos' }];
                        }
                        return allOptions;
                    },
                    next: 'property'
                },
                {
                    id: 'property',
                    title: 'Propiedad a modificar',
                    type: 'select',
                    description: 'Seleccione la propiedad',
                    options: function(selections) {
                        var tag = selections && selections.tag ? selections.tag : '';
                        var isLine = false, isEquip = false;
                        if (typeof SmartFlowCore !== 'undefined' && tag) {
                            var obj = SmartFlowCore.findObjectByTag(tag);
                            if (obj) {
                                isLine = obj._cachedPoints || obj.points3D || obj.points;
                                isEquip = !isLine;
                            }
                        }
                        var opts = [];
                        if (isEquip || !tag) {
                            opts.push({ value: 'material', label: '🔩 Material' });
                            opts.push({ value: 'spec', label: '📋 Especificación' });
                        }
                        if (isLine || !tag) {
                            opts.push({ value: 'material', label: '🔩 Material' });
                            opts.push({ value: 'spec', label: '📋 Especificación' });
                            opts.push({ value: 'diameter', label: '📏 Diámetro' });
                        }
                        if (opts.length === 0) {
                            return [{ value: '', label: '⚠️ No se pudo determinar el tipo' }];
                        }
                        return opts;
                    },
                    next: 'value'
                },
                {
                    id: 'value',
                    title: 'Nuevo valor',
                    type: 'text',
                    placeholder: 'Ingrese el nuevo valor',
                    description: 'Valor para la propiedad seleccionada',
                    next: 'confirm'
                },
                {
                    id: 'confirm',
                    title: '✅ Confirmar edición',
                    type: 'confirm',
                    message: function(selections) {
                        return '✏️ Editar **' + (selections.tag || '?') + '**\n' +
                               'Propiedad: ' + (selections.property || '?') + '\n' +
                               'Nuevo valor: **' + (selections.value || '') + '**';
                    },
                    isFinal: true,
                    executeImmediately: true,
                    buildCommand: function(params, selections) {
                        var tag = selections.tag || '';
                        var isLine = false;
                        if (typeof SmartFlowCore !== 'undefined' && tag) {
                            var obj = SmartFlowCore.findObjectByTag(tag);
                            if (obj) {
                                isLine = obj._cachedPoints || obj.points3D || obj.points;
                            }
                        }
                        var type = isLine ? 'line' : 'equipment';
                        return 'edit ' + type + ' ' + tag + ' set ' + (selections.property || '') + ' ' + (selections.value || '');
                    }
                }
            ]
        },

        'EXTEND': {
            name: 'Extender Línea',
            icon: '➕',
            category: 'iso',
            description: 'Extiende una línea hasta un equipo',
            steps: [
                {
                    id: 'lineTag',
                    title: 'Línea a extender',
                    type: 'dynamicSelect',
                    description: 'Seleccione la línea',
                    options: function() {
                        var lines = getLineasList();
                        if (lines.length === 0) {
                            return [{ value: '', label: '⚠️ No hay líneas' }];
                        }
                        return lines;
                    },
                    next: 'toEquip'
                },
                {
                    id: 'toEquip',
                    title: 'Equipo destino',
                    type: 'dynamicSelect',
                    description: 'Seleccione el equipo destino',
                    options: function() {
                        var equipos = getEquiposList();
                        if (equipos.length === 0) {
                            return [{ value: '', label: '⚠️ No hay equipos' }];
                        }
                        return equipos;
                    },
                    next: 'toPort'
                },
                {
                    id: 'toPort',
                    title: 'Puerto destino',
                    type: 'dynamicSelect',
                    description: 'Seleccione el puerto de entrada',
                    options: function(selections) {
                        if (!selections || !selections.toEquip) return [{ value: '', label: 'Seleccione un equipo' }];
                        return getPuertosTodos(selections.toEquip);
                    },
                    next: 'confirm'
                },
                {
                    id: 'confirm',
                    title: '✅ Confirmar extensión',
                    type: 'confirm',
                    message: function(selections) {
                        return '➕ Extender línea **' + (selections.lineTag || '?') + '**\n' +
                               ' hasta **' + (selections.toEquip || '?') + ':' + (selections.toPort || '?') + '**';
                    },
                    isFinal: true,
                    executeImmediately: true,
                    buildCommand: function(params, selections) {
                        return 'extend line ' + (selections.lineTag || '') + ' to ' + 
                               (selections.toEquip || '') + ' ' + (selections.toPort || 'N1');
                    }
                }
            ]
        },

        'OPTIMIZE.ROUTE': {
            name: 'Optimizar Ruta',
            icon: '🔄',
            category: 'iso',
            description: 'Elimina puntos redundantes de una línea',
            steps: [
                {
                    id: 'lineTag',
                    title: 'Línea a optimizar',
                    type: 'dynamicSelect',
                    description: 'Seleccione la línea',
                    options: function() {
                        var lines = getLineasList();
                        if (lines.length === 0) {
                            return [{ value: '', label: '⚠️ No hay líneas' }];
                        }
                        return lines;
                    },
                    next: 'confirm'
                },
                {
                    id: 'confirm',
                    title: '✅ Confirmar optimización',
                    type: 'confirm',
                    message: function(selections) {
                        return '🔄 Optimizar ruta de **' + (selections.lineTag || '?') + '**\n\n' +
                               'Se eliminarán puntos colineales redundantes.';
                    },
                    isFinal: true,
                    executeImmediately: true,
                    buildCommand: function(params, selections) {
                        return 'optimize route ' + (selections.lineTag || '');
                    }
                }
            ]
        },

        'REROUTE': {
            name: 'Re-enrutar Línea',
            icon: '🔄',
            category: 'iso',
            description: 'Recalcula la ruta de una línea',
            steps: [
                {
                    id: 'lineTag',
                    title: 'Línea a re-enrutar',
                    type: 'dynamicSelect',
                    description: 'Seleccione la línea',
                    options: function() {
                        var lines = getLineasList();
                        if (lines.length === 0) {
                            return [{ value: '', label: '⚠️ No hay líneas' }];
                        }
                        return lines;
                    },
                    next: 'mode'
                },
                {
                    id: 'mode',
                    title: 'Modo de enrutado',
                    type: 'select',
                    description: 'Seleccione el modo',
                    options: function() {
                        return [
                            { value: 'smart', label: '🧠 Smart (inteligente)' },
                            { value: 'orthogonal', label: '📐 Orthogonal (ortogonal)' }
                        ];
                    },
                    next: 'elevation'
                },
                {
                    id: 'elevation',
                    title: 'Elevación (mm) - opcional',
                    type: 'number',
                    default: 0,
                    min: 0,
                    step: 100,
                    description: 'Elevación fija para la ruta (0 = automática)',
                    next: 'confirm'
                },
                {
                    id: 'confirm',
                    title: '✅ Confirmar re-enrutado',
                    type: 'confirm',
                    message: function(selections) {
                        return '🔄 Re-enrutar **' + (selections.lineTag || '?') + '**\n' +
                               'Modo: ' + (selections.mode || 'smart') + '\n' +
                               (selections.elevation > 0 ? 'Elevación: ' + selections.elevation + ' mm' : 'Elevación: automática');
                    },
                    isFinal: true,
                    executeImmediately: true,
                    buildCommand: function(params, selections) {
                        var cmd = 'reroute line ' + (selections.lineTag || '');
                        if (selections.mode) cmd += ' mode ' + selections.mode;
                        if (selections.elevation > 0) cmd += ' elevation ' + selections.elevation;
                        return cmd;
                    }
                }
            ]
        },

        'PLACE': {
            name: 'Apoyar Equipo',
            icon: '📐',
            category: 'iso',
            description: 'Apoya un equipo sobre una superficie (ASME B31.3)',
            steps: [
                {
                    id: 'tag',
                    title: 'Equipo a apoyar',
                    type: 'dynamicSelect',
                    description: 'Seleccione el equipo',
                    options: function() {
                        var equipos = getEquiposList();
                        if (equipos.length === 0) {
                            return [{ value: '', label: '⚠️ No hay equipos' }];
                        }
                        return equipos;
                    },
                    next: 'surface'
                },
                {
                    id: 'surface',
                    title: 'Superficie de apoyo',
                    type: 'select',
                    description: 'Seleccione la superficie',
                    options: function(selections) {
                        var opts = [
                            { value: 'ground', label: '🏔️ Suelo (EL 0.000m)' },
                            { value: 'ground_plus', label: '🏔️ Suelo + 1.0m' },
                            { value: 'ground_plus2', label: '🏔️ Suelo + 2.0m' }
                        ];
                        var equipos = getEquiposList();
                        equipos.forEach(function(e) {
                            if (e.value !== (selections && selections.tag)) {
                                opts.push({ value: e.value, label: '🏗️ ' + e.label + ' (superior)' });
                            }
                        });
                        return opts;
                    },
                    next: 'confirm'
                },
                {
                    id: 'confirm',
                    title: '✅ Confirmar apoyo',
                    type: 'confirm',
                    message: function(selections) {
                        return '📐 Apoyar equipo **' + (selections.tag || '?') + '**\n' +
                               ' sobre **' + (selections.surface || 'ground') + '**';
                    },
                    isFinal: true,
                    executeImmediately: true,
                    buildCommand: function(params, selections) {
                        return 'place ' + (selections.tag || '') + ' on ' + (selections.surface || 'ground');
                    }
                }
            ]
        },

        'ROTATE': {
            name: 'Rotar Elemento',
            icon: '🔄',
            category: 'iso',
            description: 'Rota un elemento alrededor de un eje',
            steps: [
                {
                    id: 'tag',
                    title: 'Elemento a rotar',
                    type: 'dynamicSelect',
                    description: 'Seleccione el elemento',
                    options: function() {
                        var allOptions = [];
                        var equipos = getEquiposList();
                        var lines = getLineasList();
                        equipos.forEach(function(e) {
                            allOptions.push({ value: e.value, label: '🏗️ ' + e.label, icon: '🏗️' });
                        });
                        lines.forEach(function(l) {
                            allOptions.push({ value: l.value, label: '📏 ' + l.label, icon: '📏' });
                        });
                        if (allOptions.length === 0) {
                            return [{ value: '', label: '⚠️ No hay elementos' }];
                        }
                        return allOptions;
                    },
                    next: 'angle'
                },
                {
                    id: 'angle',
                    title: 'Ángulo de rotación (°)',
                    type: 'number',
                    default: 90,
                    min: -360,
                    max: 360,
                    step: 5,
                    description: 'Ángulo en grados (positivo = horario)',
                    next: 'axis'
                },
                {
                    id: 'axis',
                    title: 'Eje de rotación',
                    type: 'select',
                    description: 'Seleccione el eje',
                    options: function() {
                        return [
                            { value: 'X', label: 'Eje X' },
                            { value: 'Y', label: 'Eje Y' },
                            { value: 'Z', label: 'Eje Z' }
                        ];
                    },
                    next: 'confirm'
                },
                {
                    id: 'confirm',
                    title: '✅ Confirmar rotación',
                    type: 'confirm',
                    message: function(selections) {
                        return '🔄 Rotar **' + (selections.tag || '?') + '**\n' +
                               (selections.angle || 0) + '° alrededor del eje ' + (selections.axis || 'Y');
                    },
                    isFinal: true,
                    executeImmediately: true,
                    buildCommand: function(params, selections) {
                        return 'rotate ' + (selections.tag || '') + ' ' + (selections.angle || 90) + ' around ' + (selections.axis || 'Y');
                    }
                }
            ]
        },

        'DUPLICATE': {
            name: 'Duplicar Elemento',
            icon: '📋',
            category: 'iso',
            description: 'Duplica un elemento con offset',
            steps: [
                {
                    id: 'tag',
                    title: 'Elemento a duplicar',
                    type: 'dynamicSelect',
                    description: 'Seleccione el elemento',
                    options: function() {
                        var allOptions = [];
                        var equipos = getEquiposList();
                        var lines = getLineasList();
                        equipos.forEach(function(e) {
                            allOptions.push({ value: e.value, label: '🏗️ ' + e.label, icon: '🏗️' });
                        });
                        lines.forEach(function(l) {
                            allOptions.push({ value: l.value, label: '📏 ' + l.label, icon: '📏' });
                        });
                        if (allOptions.length === 0) {
                            return [{ value: '', label: '⚠️ No hay elementos' }];
                        }
                        return allOptions;
                    },
                    next: 'newTag'
                },
                {
                    id: 'newTag',
                    title: 'Tag del nuevo elemento',
                    type: 'text',
                    placeholder: 'Ej: TK-101-COPY',
                    description: 'Tag único para el duplicado',
                    validate: function(value) {
                        if (!value || value.trim() === '') return 'El Tag es obligatorio';
                        if (typeof SmartFlowCore !== 'undefined') {
                            if (SmartFlowCore.findObjectByTag(value.trim())) {
                                return 'El Tag "' + value.trim() + '" ya existe';
                            }
                        }
                        return null;
                    },
                    next: 'offset'
                },
                {
                    id: 'offset',
                    title: 'Offset (X, Y, Z) en mm',
                    type: 'coordinate',
                    description: 'Desplazamiento para el duplicado',
                    default: { x: 2000, y: 0, z: 0 },
                    next: 'confirm'
                },
                {
                    id: 'confirm',
                    title: '✅ Confirmar duplicación',
                    type: 'confirm',
                    message: function(selections) {
                        var pos = selections.offset || { x: 0, y: 0, z: 0 };
                        return '📋 Duplicar **' + (selections.tag || '?') + '**\n' +
                               '→ **' + (selections.newTag || '') + '**\n' +
                               'Offset: (' + pos.x + ', ' + pos.y + ', ' + pos.z + ')';
                    },
                    isFinal: true,
                    executeImmediately: true,
                    buildCommand: function(params, selections) {
                        var pos = selections.offset || { x: 0, y: 0, z: 0 };
                        return 'duplicate ' + (selections.tag || '') + ' as ' + (selections.newTag || '') +
                               ' offset (' + pos.x + ',' + pos.y + ',' + pos.z + ')';
                    }
                }
            ]
        },

        'ALIGN': {
            name: 'Alinear Equipos',
            icon: '📏',
            category: 'iso',
            description: 'Alinea múltiples equipos en un eje',
            steps: [
                {
                    id: 'tags',
                    title: 'Equipos a alinear (seleccione 2+)',
                    type: 'multiSelect',
                    minSelect: 2,
                    description: 'Seleccione al menos 2 equipos para alinear',
                    options: function() {
                        var equipos = getEquiposList();
                        if (equipos.length < 2) {
                            return [{ value: '', label: '⚠️ Se necesitan al menos 2 equipos' }];
                        }
                        return equipos;
                    },
                    next: 'axis'
                },
                {
                    id: 'axis',
                    title: 'Eje de alineación',
                    type: 'select',
                    description: 'Seleccione el eje de alineación',
                    options: function() {
                        return [
                            { value: 'X', label: 'Eje X (Este-Oeste)' },
                            { value: 'Y', label: 'Eje Y (Altura)' },
                            { value: 'Z', label: 'Eje Z (Norte-Sur)' }
                        ];
                    },
                    next: 'confirm'
                },
                {
                    id: 'confirm',
                    title: '✅ Confirmar alineación',
                    type: 'confirm',
                    message: function(selections) {
                        var tags = (selections.tags || []).join(', ');
                        return '📏 Alinear **' + tags + '**\n' +
                               'en el eje **' + (selections.axis || 'Y') + '**\n\n' +
                               'El primer equipo será la referencia.';
                    },
                    isFinal: true,
                    executeImmediately: true,
                    buildCommand: function(params, selections) {
                        var tags = (selections.tags || []);
                        if (tags.length < 2) return '';
                        var cmd = 'align';
                        tags.forEach(function(t) { cmd += ' ' + t; });
                        cmd += ' on ' + (selections.axis || 'Y');
                        return cmd;
                    }
                }
            ]
        },

        'NODES': {
            name: 'Ver Nodos/Puertos',
            icon: '🔌',
            category: 'iso',
            description: 'Muestra todos los puertos de un elemento',
            steps: [
                {
                    id: 'tag',
                    title: 'Seleccione el elemento',
                    type: 'dynamicSelect',
                    description: 'Equipo o línea para ver sus puertos',
                    options: function() {
                        var allOptions = [];
                        var equipos = getEquiposList();
                        var lines = getLineasList();
                        equipos.forEach(function(e) {
                            allOptions.push({ value: e.value, label: '🏗️ ' + e.label, icon: '🏗️' });
                        });
                        lines.forEach(function(l) {
                            allOptions.push({ value: l.value, label: '📏 ' + l.label, icon: '📏' });
                        });
                        if (allOptions.length === 0) {
                            return [{ value: '', label: '⚠️ No hay elementos' }];
                        }
                        return allOptions;
                    },
                    next: 'mode'
                },
                {
                    id: 'mode',
                    title: 'Tipo de nodos',
                    type: 'select',
                    description: '¿Qué nodos desea ver?',
                    options: function() {
                        return [
                            { value: 'all', label: '📋 Todos los nodos' },
                            { value: 'abiertos', label: '🟢 Solo nodos abiertos (libres)' }
                        ];
                    },
                    next: 'confirm'
                },
                {
                    id: 'confirm',
                    title: '✅ Confirmar',
                    type: 'confirm',
                    message: function(selections) {
                        var tipo = selections.mode === 'abiertos' ? 'nodos abiertos' : 'todos los nodos';
                        return '🔌 Mostrar ' + tipo + ' de **' + (selections.tag || '?') + '**';
                    },
                    isFinal: true,
                    executeImmediately: true,
                    buildCommand: function(params, selections) {
                        if (selections.mode === 'abiertos') {
                            return 'nodos abiertos ' + (selections.tag || '');
                        }
                        return 'nodos ' + (selections.tag || '');
                    }
                }
            ]
        },

        'POINT': {
            name: 'Coordenadas de Punto',
            icon: '📍',
            category: 'iso',
            description: 'Obtiene coordenadas de un punto en un elemento',
            steps: [
                {
                    id: 'tag',
                    title: 'Seleccione el elemento',
                    type: 'dynamicSelect',
                    description: 'Elemento para obtener coordenadas',
                    options: function() {
                        var allOptions = [];
                        var equipos = getEquiposList();
                        var lines = getLineasList();
                        equipos.forEach(function(e) {
                            allOptions.push({ value: e.value, label: '🏗️ ' + e.label, icon: '🏗️' });
                        });
                        lines.forEach(function(l) {
                            allOptions.push({ value: l.value, label: '📏 ' + l.label, icon: '📏' });
                        });
                        if (allOptions.length === 0) {
                            return [{ value: '', label: '⚠️ No hay elementos' }];
                        }
                        return allOptions;
                    },
                    next: 'punto'
                },
                {
                    id: 'punto',
                    title: 'Punto o puerto',
                    type: 'select',
                    description: 'Seleccione el punto o puerto',
                    options: function(selections) {
                        if (!selections || !selections.tag) {
                            return [{ value: '', label: 'Seleccione un elemento' }];
                        }
                        var opts = [
                            { value: 'pos', label: '📍 Posición del equipo' },
                            { value: 'inicio', label: '🔵 Inicio de línea' },
                            { value: 'fin', label: '🔴 Fin de línea' },
                            { value: '0.25', label: '📐 25% de la línea' },
                            { value: '0.5', label: '📐 50% de la línea (Centro)' },
                            { value: '0.75', label: '📐 75% de la línea' }
                        ];
                        if (typeof SmartFlowCore !== 'undefined') {
                            var obj = SmartFlowCore.findObjectByTag(selections.tag);
                            if (obj && obj.puertos) {
                                obj.puertos.forEach(function(p) {
                                    var isFree = p.status === 'open' || !p.connectedTo;
                                    opts.push({
                                        value: 'puerto_' + p.id,
                                        label: '🔌 ' + p.id + (isFree ? ' 🟢' : ' 🔴')
                                    });
                                });
                            }
                        }
                        return opts;
                    },
                    next: 'confirm'
                },
                {
                    id: 'confirm',
                    title: '✅ Confirmar',
                    type: 'confirm',
                    message: function(selections) {
                        var punto = selections.punto || 'pos';
                        return '📍 Mostrar coordenadas de **' + (selections.tag || '?') + '**\n' +
                               'Punto: ' + punto;
                    },
                    isFinal: true,
                    executeImmediately: true,
                    buildCommand: function(params, selections) {
                        var punto = selections.punto || 'pos';
                        if (punto.startsWith('puerto_')) {
                            var portId = punto.replace('puerto_', '');
                            return 'point de ' + (selections.tag || '') + ' ' + portId;
                        }
                        if (punto === 'inicio') return 'point de ' + (selections.tag || '') + ' 0';
                        if (punto === 'fin') return 'point de ' + (selections.tag || '') + ' end';
                        if (punto === 'pos') return 'point ' + (selections.tag || '');
                        return 'point de ' + (selections.tag || '') + ' @' + punto;
                    }
                }
            ]
        },

        'MEASURE': {
            name: 'Medir Distancia',
            icon: '📏',
            category: 'iso',
            description: 'Mide la distancia entre dos elementos',
            steps: [
                {
                    id: 'tag1',
                    title: 'Primer elemento',
                    type: 'dynamicSelect',
                    description: 'Seleccione el primer elemento',
                    options: function() {
                        var allOptions = [];
                        var equipos = getEquiposList();
                        var lines = getLineasList();
                        equipos.forEach(function(e) {
                            allOptions.push({ value: e.value, label: '🏗️ ' + e.label, icon: '🏗️' });
                        });
                        lines.forEach(function(l) {
                            allOptions.push({ value: l.value, label: '📏 ' + l.label, icon: '📏' });
                        });
                        if (allOptions.length === 0) {
                            return [{ value: '', label: '⚠️ No hay elementos' }];
                        }
                        return allOptions;
                    },
                    next: 'tag2'
                },
                {
                    id: 'tag2',
                    title: 'Segundo elemento',
                    type: 'dynamicSelect',
                    description: 'Seleccione el segundo elemento',
                    options: function(selections) {
                        var allOptions = [];
                        var equipos = getEquiposList();
                        var lines = getLineasList();
                        equipos.forEach(function(e) {
                            allOptions.push({ value: e.value, label: '🏗️ ' + e.label, icon: '🏗️' });
                        });
                        lines.forEach(function(l) {
                            allOptions.push({ value: l.value, label: '📏 ' + l.label, icon: '📏' });
                        });
                        if (selections && selections.tag1) {
                            allOptions = allOptions.filter(function(opt) {
                                return opt.value !== selections.tag1;
                            });
                        }
                        if (allOptions.length === 0) {
                            return [{ value: '', label: '⚠️ No hay otros elementos' }];
                        }
                        return allOptions;
                    },
                    next: 'confirm'
                },
                {
                    id: 'confirm',
                    title: '✅ Confirmar medición',
                    type: 'confirm',
                    message: function(selections) {
                        return '📏 Medir distancia entre:\n' +
                               '**' + (selections.tag1 || '?') + '**\n' +
                               'y\n' +
                               '**' + (selections.tag2 || '?') + '**';
                    },
                    isFinal: true,
                    executeImmediately: true,
                    buildCommand: function(params, selections) {
                        return 'measure ' + (selections.tag1 || '') + ' to ' + (selections.tag2 || '');
                    }
                }
            ]
        },

        'VIEW': {
            name: 'Cambiar Vista',
            icon: '🔭',
            category: 'iso',
            description: 'Cambia la vista de la cámara 3D',
            steps: [
                {
                    id: 'vista',
                    title: 'Seleccione la vista',
                    type: 'select',
                    description: 'Vista de cámara deseada',
                    options: function() {
                        return [
                            { value: 'top', label: '🔭 Planta (TOP)' },
                            { value: 'front', label: '🔭 Frontal (FRONT)' },
                            { value: 'iso', label: '🔭 Isométrica (ISO)' },
                            { value: 'extents', label: '🔭 Extender (FIT)' }
                        ];
                    },
                    next: 'tag'
                },
                {
                    id: 'tag',
                    title: 'Centrar en elemento (opcional)',
                    type: 'dynamicSelect',
                    description: 'Elemento para centrar la vista',
                    options: function() {
                        var allOptions = [{ value: '', label: '📷 Sin centrar (vista general)' }];
                        var equipos = getEquiposList();
                        var lines = getLineasList();
                        equipos.forEach(function(e) {
                            allOptions.push({ value: e.value, label: '🏗️ ' + e.label, icon: '🏗️' });
                        });
                        lines.forEach(function(l) {
                            allOptions.push({ value: l.value, label: '📏 ' + l.label, icon: '📏' });
                        });
                        return allOptions;
                    },
                    next: 'confirm'
                },
                {
                    id: 'confirm',
                    title: '✅ Confirmar vista',
                    type: 'confirm',
                    message: function(selections) {
                        var msg = '🔭 Cambiar a vista **' + (selections.vista || 'iso') + '**';
                        if (selections.tag) msg += '\nCentrar en **' + selections.tag + '**';
                        return msg;
                    },
                    isFinal: true,
                    executeImmediately: true,
                    buildCommand: function(params, selections) {
                        var cmd = 'view ' + (selections.vista || 'iso');
                        if (selections.tag) cmd += ' ' + selections.tag;
                        return cmd;
                    }
                }
            ]
        }
    };

    // ================================================================
    // COMANDOS - MÓDULO GENERAL (10 comandos)
    // ================================================================
    
    const GENERAL_COMMANDS = {
        'UNDO': {
            name: 'Deshacer',
            icon: '↩️',
            category: 'general',
            description: 'Deshace la última acción',
            isDirect: true,
            command: 'undo'
        },
        'REDO': {
            name: 'Rehacer',
            icon: '↪️',
            category: 'general',
            description: 'Rehace la acción deshecha',
            isDirect: true,
            command: 'redo'
        },
        'HELP': {
            name: 'Ayuda',
            icon: '❓',
            category: 'general',
            description: 'Muestra los comandos disponibles',
            isDirect: true,
            command: 'help'
        },
        'PROJECT.SUMMARY': {
            name: 'Resumen del Proyecto',
            icon: '📋',
            category: 'general',
            description: 'Muestra un resumen del proyecto',
            isDirect: true,
            command: 'project summary'
        },
        'VALIDATE.ALL': {
            name: 'Validar Todo',
            icon: '🔍',
            category: 'general',
            description: 'Valida todo el proyecto (PFD + DTI + ISO)',
            isDirect: true,
            command: 'validate all'
        },
        'AUTOFIX': {
            name: 'Auto-Corregir',
            icon: '🔧',
            category: 'general',
            description: 'Corrige errores automáticamente',
            isDirect: true,
            command: 'autofix'
        },
        'EXPORT.PCF': {
            name: 'Exportar PCF',
            icon: '📥',
            category: 'general',
            description: 'Exporta a formato PCF (Plant 3D)',
            isDirect: true,
            command: 'export pcf'
        },
        'EXPORT.MTO': {
            name: 'Exportar MTO',
            icon: '📊',
            category: 'general',
            description: 'Exporta lista de materiales (MTO)',
            isDirect: true,
            command: 'export mto'
        },
        'EXPORT.JSON': {
            name: 'Exportar JSON',
            icon: '💾',
            category: 'general',
            description: 'Exporta el proyecto completo a JSON',
            isDirect: true,
            command: 'export json'
        },
        'EXPORT.DB': {
            name: 'Exportar DB Excel',
            icon: '📗',
            category: 'general',
            description: 'Exporta a base de datos Excel',
            isDirect: true,
            command: 'export db'
        },
        'IMPORT.PCF': {
            name: 'Importar PCF',
            icon: '📤',
            category: 'general',
            description: 'Importa desde formato PCF',
            isDirect: true,
            command: 'import pcf'
        },
        'IMPORT.JSON': {
            name: 'Importar JSON',
            icon: '📤',
            category: 'general',
            description: 'Importa desde archivo JSON',
            isDirect: true,
            command: 'import json'
        },
        'SET.PROJECT': {
            name: 'Configurar Proyecto',
            icon: '⚙️',
            category: 'general',
            description: 'Configura defaults del proyecto (material, spec)',
            steps: [
                {
                    id: 'opcion',
                    title: '¿Qué desea configurar?',
                    type: 'select',
                    description: 'Seleccione la opción',
                    options: function() {
                        return [
                            { value: 'defaults', label: '📋 Ver configuración actual' },
                            { value: 'material', label: '🧪 Cambiar material por defecto' },
                            { value: 'spec', label: '📋 Cambiar especificación por defecto' }
                        ];
                    },
                    nextMap: {
                        'defaults': 'showDefaults',
                        'material': 'setMaterial',
                        'spec': 'setSpec'
                    }
                },
                {
                    id: 'showDefaults',
                    title: 'Configuración actual',
                    type: 'info',
                    message: function() {
                        var defaults = { material: 'PPR', spec: 'PPR_PN12_5' };
                        if (typeof SmartFlowCommands !== 'undefined' && SmartFlowCommands.getProjectDefaults) {
                            defaults = SmartFlowCommands.getProjectDefaults();
                        }
                        return '📐 **Material por defecto:** ' + defaults.material + '\n' +
                               '📋 **Especificación por defecto:** ' + defaults.spec + '\n\n' +
                               '💡 Para cambiar: set project material <MATERIAL> spec <SPEC>';
                    },
                    isFinal: true,
                    executeImmediately: true,
                    buildCommand: function() { return 'set project defaults'; }
                },
                {
                    id: 'setMaterial',
                    title: 'Seleccione el material por defecto',
                    type: 'select',
                    description: 'Material que se usará por defecto en nuevos elementos',
                    options: function() { return getMaterialOptions(); },
                    isFinal: true,
                    executeImmediately: true,
                    buildCommand: function(params, selections) {
                        return 'set project material ' + (selections.setMaterial || 'PPR');
                    }
                },
                {
                    id: 'setSpec',
                    title: 'Seleccione la especificación por defecto',
                    type: 'select',
                    description: 'Especificación que se usará por defecto',
                    options: function(selections) {
                        return getSpecOptions(selections && selections.material ? selections.material : null);
                    },
                    isFinal: true,
                    executeImmediately: true,
                    buildCommand: function(params, selections) {
                        return 'set project spec ' + (selections.setSpec || 'PPR_PN12_5');
                    }
                }
            ]
        }
    };

    // ================================================================
    // CONTROLADOR PRINCIPAL
    // ================================================================
    
    let _commandsCache = null;

    function getCommandsForModule(module) {
        var commands = {};
        Object.assign(commands, GENERAL_COMMANDS);
        
        switch (module) {
            case 'pfd':
                Object.assign(commands, PFD_COMMANDS);
                break;
            case 'dti':
                Object.assign(commands, DTI_COMMANDS);
                break;
            case 'iso':
                Object.assign(commands, ISO_COMMANDS);
                break;
            default:
                Object.assign(commands, ISO_COMMANDS);
                break;
        }
        return commands;
    }

    function getCommandsByCategory(module) {
        var commands = getCommandsForModule(module);
        var categories = {};
        Object.entries(commands).forEach(function(entry) {
            var key = entry[0];
            var cmd = entry[1];
            var cat = cmd.category || 'general';
            if (!categories[cat]) categories[cat] = [];
            categories[cat].push({ command: key, name: cmd.name, icon: cmd.icon, description: cmd.description || '' });
        });
        return categories;
    }

    function getCommand(commandPath) {
        var commands = getCommandsForModule(currentState.activeModule);
        return commands[commandPath] || null;
    }

    function startCommandFlow(commandPath) {
        var command = getCommand(commandPath);
        if (!command) return null;
        
        if (command.isDirect) {
            return { direct: true, command: command.command, name: command.name, icon: command.icon };
        }
        
        currentState.commandPath = commandPath;
        currentState.step = 0;
        currentState.selections = {};
        currentState.flow = command;
        
        return getCurrentStepData();
    }

    function getCurrentStepData() {
        if (!currentState.flow || !currentState.flow.steps) return null;
        
        var steps = currentState.flow.steps;
        var stepIndex = currentState.step;
        
        while (stepIndex < steps.length) {
            var step = steps[stepIndex];
            if (step.condition && !step.condition(currentState.selections)) {
                if (step.next) {
                    var nextStep = typeof step.next === 'function' ? 
                        step.next(currentState.selections) : step.next;
                    if (nextStep) {
                        var targetIndex = steps.findIndex(function(s) { return s.id === nextStep; });
                        if (targetIndex >= 0) { stepIndex = targetIndex; continue; }
                    }
                }
                stepIndex++;
                continue;
            }
            break;
        }
        
        if (stepIndex >= steps.length) {
            for (var i = steps.length - 1; i >= 0; i--) {
                if (steps[i].isFinal && steps[i].buildCommand) {
                    var cmd = steps[i].buildCommand(null, currentState.selections);
                    return { finished: true, command: cmd, executeImmediately: steps[i].executeImmediately || false };
                }
            }
            return null;
        }
        
        currentState.step = stepIndex;
        var step = steps[stepIndex];
        
        var options = [];
        if (typeof step.options === 'function') {
            options = step.options(currentState.selections);
        } else if (step.options) {
            options = step.options;
        }
        
        var fields = [];
        if (typeof step.fields === 'function') {
            fields = step.fields(currentState.selections);
        } else if (step.fields) {
            fields = step.fields;
        }
        
        var defaultValue = step.default;
        if (typeof step.default === 'function') {
            defaultValue = step.default(currentState.selections);
        }
        
        var totalSteps = steps.filter(function(s) {
            return !s.condition || s.condition(currentState.selections);
        }).length;
        var progress = Math.min(((stepIndex + 1) / totalSteps) * 100, 100);
        
        return {
            commandPath: currentState.commandPath,
            commandName: currentState.flow.name,
            commandIcon: currentState.flow.icon,
            stepIndex: stepIndex,
            totalSteps: totalSteps,
            stepId: step.id,
            title: typeof step.title === 'function' ? step.title(currentState.selections) : step.title,
            type: step.type || 'select',
            description: typeof step.description === 'function' ? step.description(currentState.selections) : (step.description || ''),
            options: options,
            fields: fields,
            isFinal: step.isFinal || false,
            message: typeof step.message === 'function' ? step.message(currentState.selections) : step.message,
            executeImmediately: step.executeImmediately || false,
            nextMap: step.nextMap || null,
            condition: step.condition || null,
            progress: progress,
            minSelect: step.minSelect || 2,
            minPoints: step.minPoints || 2,
            default: defaultValue,
            placeholder: step.placeholder || '',
            min: step.min,
            max: step.max,
            step: step.step,
            selections: currentState.selections
        };
    }

    function nextStep(selection) {
        if (!currentState.flow) return null;
        
        var steps = currentState.flow.steps;
        var currentStep = steps[currentState.step];
        
        if (currentStep && currentStep.id) {
            currentState.selections[currentStep.id] = selection;
        }
        
        var nextStepId = null;
        if (currentStep && currentStep.nextMap && selection) {
            nextStepId = currentStep.nextMap[selection];
        }
        if (!nextStepId && currentStep && currentStep.next) {
            nextStepId = typeof currentStep.next === 'function' ? 
                currentStep.next(currentState.selections) : currentStep.next;
        }
        
        if (nextStepId && typeof nextStepId === 'string') {
            var targetIndex = steps.findIndex(function(s) { return s.id === nextStepId; });
            if (targetIndex >= 0) {
                currentState.step = targetIndex;
                return getCurrentStepData();
            }
        }
        
        currentState.step++;
        return getCurrentStepData();
    }

    function previousStep() {
        if (currentState.step > 0) {
            currentState.step--;
            var steps = currentState.flow ? currentState.flow.steps : [];
            if (steps[currentState.step] && steps[currentState.step].id) {
                delete currentState.selections[steps[currentState.step].id];
            }
        }
        return getCurrentStepData();
    }

    function resetFlow() {
        currentState.commandPath = null;
        currentState.step = 0;
        currentState.selections = {};
        currentState.flow = null;
    }

    function setActiveModule(module) {
        if (module === 'pfd' || module === 'dti' || module === 'iso') {
            currentState.activeModule = module;
            resetFlow();
            if (_uiCallbacks.onModuleChange) {
                _uiCallbacks.onModuleChange(module);
            }
        }
    }

    function getActiveModule() {
        return currentState.activeModule;
    }

    function setCallbacks(callbacks) {
        _uiCallbacks = Object.assign(_uiCallbacks, callbacks);
    }

    function getModuleCommands(module) {
        return getCommandsForModule(module);
    }

    // ================================================================
    // EXPOSICIÓN DE FUNCIONES PARA LA UI
    // ================================================================
    
    var exposedFunctions = {
        getEquiposList: getEquiposList,
        getLineasList: getLineasList,
        getPuertosLibres: getPuertosLibres,
        getPuertosTodos: getPuertosTodos,
        getPosicionesLinea: getPosicionesLinea,
        getMaterialOptions: getMaterialOptions,
        getSpecOptions: getSpecOptions,
        pipeDiameters: pipeDiameters,
        getEquipmentTypes: getEquipmentTypes,
        getEquipmentIcon: getEquipmentIcon,
        getStreamsList: getStreamsList,
        getInstrumentsList: getInstrumentsList,
        getLoopsList: getLoopsList
    };

    // ================================================================
    // API PÚBLICA
    // ================================================================
    
    return {
        setActiveModule: setActiveModule,
        getActiveModule: getActiveModule,
        setCallbacks: setCallbacks,
        getCommandsForModule: getCommandsForModule,
        getCommandsByCategory: getCommandsByCategory,
        getCommand: getCommand,
        getModuleCommands: getModuleCommands,
        startCommandFlow: startCommandFlow,
        getCurrentStepData: getCurrentStepData,
        nextStep: nextStep,
        previousStep: previousStep,
        resetFlow: resetFlow,
        PFD_COMMANDS: PFD_COMMANDS,
        DTI_COMMANDS: DTI_COMMANDS,
        ISO_COMMANDS: ISO_COMMANDS,
        GENERAL_COMMANDS: GENERAL_COMMANDS,
        getEquiposList: getEquiposList,
        getLineasList: getLineasList,
        getPuertosLibres: getPuertosLibres,
        getPuertosTodos: getPuertosTodos,
        getPosicionesLinea: getPosicionesLinea,
        getMaterialOptions: getMaterialOptions,
        getSpecOptions: getSpecOptions,
        pipeDiameters: pipeDiameters,
        getEquipmentTypes: getEquipmentTypes,
        getEquipmentIcon: getEquipmentIcon,
        getStreamsList: getStreamsList,
        getInstrumentsList: getInstrumentsList,
        getLoopsList: getLoopsList
    };
})();

if (typeof window !== 'undefined') {
    window.AdaptiveCommandSystem = AdaptiveCommandSystem;
}

console.log('✅ AdaptiveCommandSystem v3.0 - SISTEMA ADAPTATIVO MODULAR COMPLETO');
console.log('📊 PFD: ' + Object.keys(AdaptiveCommandSystem.PFD_COMMANDS).length + ' comandos');
console.log('🔧 DTI: ' + Object.keys(AdaptiveCommandSystem.DTI_COMMANDS).length + ' comandos');
console.log('🧊 ISO: ' + Object.keys(AdaptiveCommandSystem.ISO_COMMANDS).length + ' comandos');
console.log('⚙️ GENERAL: ' + Object.keys(AdaptiveCommandSystem.GENERAL_COMMANDS).length + ' comandos');
console.log('📋 TOTAL: ' + (Object.keys(AdaptiveCommandSystem.PFD_COMMANDS).length + 
                           Object.keys(AdaptiveCommandSystem.DTI_COMMANDS).length + 
                           Object.keys(AdaptiveCommandSystem.ISO_COMMANDS).length + 
                           Object.keys(AdaptiveCommandSystem.GENERAL_COMMANDS).length) + ' comandos');
console.log('💡 Usa AdaptiveCommandSystem.setActiveModule("pfd"|"dti"|"iso") para cambiar de módulo.');
