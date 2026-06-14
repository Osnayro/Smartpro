
// ============================================================
// SMARTFLOW ADAPTIVE ISO UPDATE FLOWS - Posicionar Equipos Existentes
// Archivo: js/modules/adaptive_iso_update_flows.js
// Congruente con: adaptiveCommands.js (CREATE.EQUIPMENT)
// ============================================================

(function() {
    
    if (typeof AdaptiveCommandSystem === 'undefined') {
        console.warn('AdaptiveCommandSystem no disponible');
        return;
    }
    
    // ═══════════════════════════════════════════
    //  FLUJO: UPDATE_EQUIPMENT (Posicionar equipo existente)
    // ═══════════════════════════════════════════
    
    AdaptiveCommandSystem.COMMAND_FLOWS['UPDATE_EQUIPMENT'] = {
        name: 'Posicionar Equipo (desde PFD)',
        icon: '📍',
        category: 'create',
        steps: [
            // PASO 1: Seleccionar equipo de la BD (solo equipos ya creados)
            {
                id: 'selectEquipment',
                title: 'Seleccione equipo a posicionar en 3D',
                type: 'dynamicSelect',
                description: 'Equipos creados en PFD/DTI que necesitan posición espacial',
                options: function() {
                    var equipos = [];
                    if (typeof SmartFlowCore !== 'undefined') {
                        equipos = SmartFlowCore.getEquipos().map(function(e) {
                            var tienePos = (e.posX !== 0 || e.posY !== 0 || e.posZ !== 0);
                            var icon = tienePos ? '📍' : '📋';
                            return {
                                value: e.tag,
                                label: icon + ' ' + e.tag + ' | ' + (e.tipo || '?') + ' | ' + (e.material || 'N/D'),
                                icon: icon,
                                description: tienePos ? '⚠️ Ya tiene posición 3D (se actualizará): ' + e.posX + ',' + e.posY + ',' + e.posZ : '✅ Listo para posicionar en 3D'
                            };
                        });
                    }
                    if (equipos.length === 0) {
                        return [{ value: '', label: '⚠️ No hay equipos creados. Use PFD: create equipo TIPO TAG', icon: '⚠️' }];
                    }
                    return equipos;
                },
                next: 'position'
            },
            
            // PASO 2: Posición (igual que CREATE.EQUIPMENT)
            {
                id: 'position',
                title: 'Posición del equipo (X, Y, Z) en mm',
                type: 'coordinate',
                next: 'dimensions'
            },
            
            // PASO 3: Dimensiones (igual que CREATE.EQUIPMENT)
            {
                id: 'dimensions',
                title: 'Dimensiones del equipo',
                type: 'form',
                fields: function(st) {
                    var tipo = '';
                    if (st.selectEquipment && typeof SmartFlowCore !== 'undefined') {
                        var eq = SmartFlowCore.findObjectByTag(st.selectEquipment);
                        if (eq) tipo = eq.tipo || '';
                    }
                    
                    var fields = [];
                    if (tipo !== 'plataforma') {
                        fields.push({ id: 'diametro', type: 'number', label: 'Diámetro (mm)', default: 1000, min: 50 });
                    }
                    if (tipo !== 'plataforma' && tipo !== 'tanque_h') {
                        fields.push({ id: 'altura', type: 'number', label: 'Altura (mm)', default: 1500, min: 50 });
                    }
                    if (['tanque_h', 'plataforma', 'intercambiador', 'condensador'].indexOf(tipo) !== -1 || (tipo && tipo.indexOf('bomba') !== -1)) {
                        fields.push({ id: 'largo', type: 'number', label: 'Largo (mm)', default: 1000, min: 50 });
                    }
                    if (tipo === 'plataforma' || (tipo && tipo.indexOf('skid') !== -1)) {
                        fields.push({ id: 'ancho', type: 'number', label: 'Ancho (mm)', default: 1000, min: 50 });
                    }
                    if (fields.length === 0) {
                        fields.push({ id: 'diametro', type: 'number', label: 'Diámetro (mm)', default: 1000, min: 50 });
                        fields.push({ id: 'altura', type: 'number', label: 'Altura (mm)', default: 1500, min: 50 });
                    }
                    return fields;
                },
                next: 'specs'
            },
            
            // PASO 4: Especificaciones (igual que CREATE.EQUIPMENT)
            {
                id: 'specs',
                title: 'Especificaciones de material',
                type: 'form',
                fields: [
                    { id: 'material', type: 'select', label: 'Material', options: function() { return AdaptiveCommandSystem.getMaterialOptions(); } },
                    { id: 'spec', type: 'select', label: 'Especificación', 
                        options: function(sel, st) { return AdaptiveCommandSystem.getSpecOptions(st.specs ? st.specs.material : null); } }
                ],
                next: 'connectionsCheck'
            },
            
            // PASO 5: Conexiones condicional (igual que CREATE.EQUIPMENT)
            {
                id: 'connectionsCheck',
                title: '',
                type: 'conditional',
                condition: function(st) {
                    var tipo = '';
                    if (st.selectEquipment && typeof SmartFlowCore !== 'undefined') {
                        var eq = SmartFlowCore.findObjectByTag(st.selectEquipment);
                        if (eq) tipo = eq.tipo || '';
                    }
                    var noConnections = ['plataforma', 'agitador', 'molino', 'llenadora'];
                    return noConnections.indexOf(tipo) === -1;
                },
                ifTrue: 'connections',
                ifFalse: 'extrasCheck'
            },
            
            // PASO 6: Conexiones (igual que CREATE.EQUIPMENT)
            {
                id: 'connections',
                title: 'Conexiones (opcional)',
                type: 'form',
                fields: function(st) {
                    var tipo = '';
                    if (st.selectEquipment && typeof SmartFlowCore !== 'undefined') {
                        var eq = SmartFlowCore.findObjectByTag(st.selectEquipment);
                        if (eq) tipo = eq.tipo || '';
                    }
                    // Usar la misma función getConnectionFields del sistema original
                    if (typeof AdaptiveCommandSystem.getConnectionFields === 'function') {
                        return AdaptiveCommandSystem.getConnectionFields(tipo);
                    }
                    return getConnectionFieldsLocal(tipo);
                },
                next: 'extrasCheck'
            },
            
            // PASO 7: Extras condicional (igual que CREATE.EQUIPMENT)
            {
                id: 'extrasCheck',
                title: '',
                type: 'conditional',
                condition: function(st) {
                    var tipo = '';
                    if (st.selectEquipment && typeof SmartFlowCore !== 'undefined') {
                        var eq = SmartFlowCore.findObjectByTag(st.selectEquipment);
                        if (eq) tipo = eq.tipo || '';
                    }
                    return ['plataforma', 'tanque_v', 'torre', 'reactor', 'columna_fraccionadora'].indexOf(tipo) !== -1;
                },
                ifTrue: 'extras',
                ifFalse: '__FINAL__'
            },
            
            // PASO 8: Extras (igual que CREATE.EQUIPMENT)
            {
                id: 'extras',
                title: 'Extras (opcional)',
                type: 'form',
                fields: [
                    { id: 'baranda', type: 'checkbox', label: 'Incluir baranda' },
                    { id: 'escalera', type: 'checkbox', label: 'Incluir escalera' }
                ],
                isFinal: true,
                buildCommand: function(params, st) {
                    var tag = st.selectEquipment || 'EQ-001';
                    var pos = st.position || { x: 5000, y: 1450, z: 0 };
                    
                    // Construir comando update equipment
                    var parts = ['update equipment ' + tag];
                    parts.push('posX ' + pos.x);
                    parts.push('posY ' + pos.y);
                    parts.push('posZ ' + pos.z);
                    
                    var dims = st.dimensions || {};
                    if (dims.diametro) parts.push('diametro ' + dims.diametro);
                    if (dims.altura) parts.push('altura ' + dims.altura);
                    if (dims.largo) parts.push('largo ' + dims.largo);
                    if (dims.ancho) parts.push('ancho ' + dims.ancho);
                    
                    var conn = st.connections || {};
                    if (conn.diametro_succion) parts.push('diametro_succion ' + conn.diametro_succion);
                    if (conn.diametro_descarga) parts.push('diametro_descarga ' + conn.diametro_descarga);
                    if (conn.diametro_entrada) parts.push('diametro_entrada ' + conn.diametro_entrada);
                    if (conn.diametro_salida) parts.push('diametro_salida ' + conn.diametro_salida);
                    if (conn.altura_salida_desde_base) parts.push('altura_salida_desde_base ' + conn.altura_salida_desde_base);
                    
                    var sp = st.specs || {};
                    if (sp.material) parts.push('material ' + sp.material);
                    if (sp.spec) parts.push('spec ' + sp.spec);
                    
                    var ex = st.extras || {};
                    if (ex.baranda) parts.push('baranda ' + ex.baranda);
                    if (ex.escalera) parts.push('escalera ' + ex.escalera);
                    
                    return parts.join(' ');
                }
            }
        ]
    };
    
    // ═══════════════════════════════════════════
    //  FUNCIÓN LOCAL getConnectionFields (respaldo)
    // ═══════════════════════════════════════════
    
    function getConnectionFieldsLocal(tipo) {
        var fields = [];
        if (tipo && tipo.indexOf('bomba') !== -1 || tipo === 'compresor') {
            fields.push({ id: 'diametro_succion', type: 'number', label: 'Diámetro Succión (pulg)', default: 3 });
            fields.push({ id: 'diametro_descarga', type: 'number', label: 'Diámetro Descarga (pulg)', default: 3 });
        } else {
            fields.push({ id: 'diametro_entrada', type: 'number', label: 'Diámetro Entrada (pulg)', default: 4 });
            fields.push({ id: 'diametro_salida', type: 'number', label: 'Diámetro Salida (pulg)', default: 4 });
            if (['tanque_v', 'torre', 'reactor', 'reactor_encamisado', 'columna_fraccionadora', 'caldera'].indexOf(tipo) !== -1) {
                fields.push({ id: 'altura_salida_desde_base', type: 'number', label: 'Altura salida desde base (mm)', default: 0 });
            }
        }
        return fields;
    }
    
    console.log('✅ Adaptive ISO Update Flow cargado | UPDATE_EQUIPMENT');
    
})();
