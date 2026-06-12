// ============================================================
// SMARTFLOW PFD ENGINE v1.1 - Motor de Diagrama de Flujo de Proceso
// Archivo: js/modules/pfd_engine.js
// Dependencias: SmartFlowCore v6.0+, SmartFlowCatalog (opcional)
// Novedades v1.1:
//   - Validación de tipos de equipo contra catálogo
//   - Creación de equipos lógicos (sin posición 3D)
//   - Los equipos creados desde PFD se comparten con DTI y 3D
// ============================================================

const SmartFlowPFD = (function() {
    
    let _core = null;
    let _catalog = null;
    let _notify = (msg, isErr) => console.log(msg);
    
    // ================================================================
    //  CONFIGURACIÓN
    // ================================================================
    const FLUID_TYPES = [
        'WATER', 'STEAM', 'CONDENSATE', 'AIR', 'NITROGEN', 'OXYGEN',
        'NATURAL_GAS', 'CRUDE_OIL', 'DIESEL', 'GASOLINE', 'ETHANOL',
        'METHANOL', 'AMMONIA', 'CHLORINE', 'H2SO4', 'NAOH', 'HCL',
        'PROCESS_WATER', 'COOLING_WATER', 'CHILLED_WATER', 'HOT_OIL',
        'THERMAL_FLUID', 'BRINE', 'GLYCOL', 'LUBE_OIL', 'SEAL_WATER'
    ];
    
    const PHASE_TYPES = ['LIQUID', 'GAS', 'TWO_PHASE', 'SOLID', 'SLURRY', 'SUPERCRITICAL'];
    
    // ================================================================
    //  VALIDACIÓN CONTRA CATÁLOGO
    // ================================================================
    
    function validateEquipmentType(tipo) {
        if (!_catalog || typeof _catalog.getEquipment !== 'function') {
            return { valid: true, msg: 'Catálogo no disponible - validación omitida' };
        }
        
        const equipoDef = _catalog.getEquipment(tipo);
        if (!equipoDef) {
            const tiposDisponibles = typeof _catalog.listEquipmentTypes === 'function' 
                ? _catalog.listEquipmentTypes() 
                : [];
            return { 
                valid: false, 
                msg: 'Tipo de equipo desconocido: ' + tipo,
                sugerencias: tiposDisponibles.slice(0, 5)
            };
        }
        
        return { valid: true, equipoDef: equipoDef };
    }
    
    // ================================================================
    //  CREACIÓN DE EQUIPOS LÓGICOS (para PFD)
    // ================================================================
    
    function createEquipmentForPFD(tipo, tag, params) {
        if (!_core) {
            _notify('❌ Error: Core no inicializado', true);
            return null;
        }
        
        // Validar contra catálogo
        const validation = validateEquipmentType(tipo);
        if (!validation.valid) {
            _notify('❌ ' + validation.msg, true);
            if (validation.sugerencias && validation.sugerencias.length > 0) {
                _notify('   Sugerencias: ' + validation.sugerencias.join(', '), false);
            }
            return null;
        }
        
        // Verificar si ya existe
        if (_core.findObjectByTag(tag)) {
            _notify('❌ Error: El equipo ' + tag + ' ya existe', true);
            return null;
        }
        
        // Crear equipo lógico (sin posición 3D o con posición por defecto)
        params = params || {};
        
        const equipo = {
            tag: tag,
            tipo: tipo,
            posX: params.posX || 0,
            posY: params.posY || 0,
            posZ: params.posZ || 0,
            diametro: params.diametro || validation.equipoDef?.diametro || 1000,
            altura: params.altura || validation.equipoDef?.altura || 1500,
            largo: params.largo || 0,
            ancho: params.ancho || 0,
            material: params.material || 'PPR',
            spec: params.spec || 'PPR_PN12_5',
            puertos: params.puertos || [],
            isLogical: params.isLogical !== false  // Marcar como equipo lógico
        };
        
        // Si el catálogo tiene puertos por defecto, usarlos
        if (validation.equipoDef && validation.equipoDef.puertos && !params.puertos) {
            equipo.puertos = validation.equipoDef.puertos.map(function(p) {
                return {
                    id: p.id,
                    relX: p.relX || 0,
                    relY: p.relY || 0,
                    relZ: p.relZ || 0,
                    diametro: p.diametro || 3,
                    status: 'open',
                    flow: 'bi',
                    orientacion: p.orientacion || { dx: 1, dy: 0, dz: 0 }
                };
            });
        }
        
        const result = _core.addEquipment(equipo);
        
        if (result) {
            _notify('✅ Equipo lógico ' + tag + ' (' + tipo + ') creado para PFD', false);
            return equipo;
        }
        
        return null;
    }
    
    // ================================================================
    //  CREACIÓN DE CORRIENTES
    // ================================================================
    
    function createStream(params) {
        if (!_core) {
            _notify('❌ Error: Core no inicializado', true);
            return null;
        }
        
        if (!params.tag) {
            _notify('❌ Error: Tag de corriente requerido', true);
            return null;
        }
        
        if (_core.getStreamByTag(params.tag)) {
            _notify('❌ Error: La corriente ' + params.tag + ' ya existe', true);
            return null;
        }
        
        // Validar que los equipos existen en la base de datos compartida
        if (params.from && !_core.findObjectByTag(params.from)) {
            _notify('⚠️ Equipo origen ' + params.from + ' no existe. Créelo primero con: create equipo TIPO TAG', false);
        }
        if (params.to && !_core.findObjectByTag(params.to)) {
            _notify('⚠️ Equipo destino ' + params.to + ' no existe. Créelo primero con: create equipo TIPO TAG', false);
        }
        
        if (params.fluid && FLUID_TYPES.indexOf(params.fluid.toUpperCase()) === -1) {
            _notify('⚠️ Fluido "' + params.fluid + '" fuera de la lista estándar', false);
        }
        
        const streamData = {
            tag: params.tag,
            from: params.from || '',
            to: params.to || '',
            fluid: params.fluid || 'WATER',
            flow: params.flow || 0,
            flowUnit: params.flowUnit || 'm3/h',
            pressure: params.pressure || 0,
            pressureUnit: params.pressureUnit || 'bar',
            temperature: params.temperature || 25,
            temperatureUnit: params.temperatureUnit || '°C',
            phase: params.phase || 'LIQUID',
            density: params.density || 1000,
            viscosity: params.viscosity || 1,
            service: params.service || '',
            description: params.description || '',
            linkedLineTags: [],
            designCase: params.designCase || 'NORMAL',
            massFlow: params.massFlow || 0,
            massFlowUnit: params.massFlowUnit || 'kg/h',
            velocity: params.velocity || 0,
            velocityUnit: params.velocityUnit || 'm/s'
        };
        
        const result = _core.addStream(streamData);
        
        if (result) {
            if (!params.phase && params.fluid === 'STEAM' && params.temperature >= 100) {
                _core.updateStream(params.tag, { phase: 'GAS' });
            }
            
            const fromStr = params.from || '?';
            const toStr = params.to || '?';
            _notify('✅ Corriente ' + params.tag + ': ' + fromStr + ' → ' + toStr + 
                    ' | ' + streamData.fluid + ' ' + streamData.flow + ' ' + streamData.flowUnit);
        }
        
        return result ? _core.getStreamByTag(params.tag) : null;
    }
    
    // ================================================================
    //  CONSULTA DE CORRIENTES
    // ================================================================
    
    function getStreamInfo(tag) {
        const stream = _core.getStreamByTag(tag);
        if (!stream) {
            _notify('❌ Corriente ' + tag + ' no encontrada', true);
            return null;
        }
        
        const allLines = _core.getLines();
        const linkedLines = allLines.filter(l => 
            stream.linkedLineTags && stream.linkedLineTags.includes(l.tag)
        );
        
        const relatedLines = allLines.filter(l => {
            if (!stream.from || !stream.to) return false;
            const fromMatch = l.origin && (l.origin.equipTag === stream.from || l.origin.objTag === stream.from);
            const toMatch = l.destination && (l.destination.equipTag === stream.to || l.destination.objTag === stream.to);
            return fromMatch && toMatch;
        });
        
        const info = {
            ...stream,
            linkedLines: linkedLines.map(l => l.tag),
            relatedLines: relatedLines.map(l => l.tag),
            totalLinkedLines: linkedLines.length + relatedLines.length,
            has3DRepresentation: linkedLines.length > 0 || relatedLines.length > 0
        };
        
        let msg = '═══════════════════════════════════\n';
        msg += '📊 CORRIENTE: ' + tag + '\n';
        msg += '═══════════════════════════════════\n\n';
        msg += '🔗 CONEXIÓN:\n';
        msg += '   ' + (stream.from || '?') + ' → ' + (stream.to || '?') + '\n\n';
        msg += '🧪 FLUIDO: ' + stream.fluid + ' | Fase: ' + stream.phase + '\n';
        msg += '📐 CONDICIONES:\n';
        msg += '   Flujo: ' + stream.flow + ' ' + stream.flowUnit + '\n';
        msg += '   Presión: ' + stream.pressure + ' ' + stream.pressureUnit + '\n';
        msg += '   Temperatura: ' + stream.temperature + ' ' + stream.temperatureUnit + '\n';
        
        if (info.has3DRepresentation) {
            msg += '\n🔗 LÍNEAS 3D ASOCIADAS: ' + info.totalLinkedLines + '\n';
            if (linkedLines.length > 0) msg += '   Vinculadas: ' + linkedLines.join(', ') + '\n';
            if (relatedLines.length > 0) msg += '   Relacionadas: ' + relatedLines.join(', ') + '\n';
        } else {
            msg += '\n⚠️ Sin representación 3D\n';
        }
        
        msg += '═══════════════════════════════════';
        
        _notify(msg, false);
        return info;
    }
    
    function listStreams(filter) {
        const streams = _core.getStreams();
        if (streams.length === 0) {
            _notify('📊 No hay corrientes definidas. Use: create stream TAG from EQUIPO to EQUIPO', false);
            return [];
        }
        
        let filtered = streams;
        if (filter) {
            const f = filter.toUpperCase();
            filtered = streams.filter(s => 
                (s.fluid && s.fluid.toUpperCase().includes(f)) ||
                (s.tag && s.tag.toUpperCase().includes(f)) ||
                (s.from && s.from.toUpperCase().includes(f)) ||
                (s.to && s.to.toUpperCase().includes(f)) ||
                (s.service && s.service.toUpperCase().includes(f))
            );
        }
        
        let msg = '📊 CORRIENTES DE PROCESO (' + filtered.length + ')\n';
        msg += '══════════════════════════════════════════\n';
        
        filtered.forEach(s => {
            const has3D = s.linkedLineTags && s.linkedLineTags.length > 0;
            const icon = has3D ? '🔗' : '⚠️';
            msg += icon + ' ' + s.tag + ': ' + (s.from||'?') + ' → ' + (s.to||'?') + 
                   ' | ' + s.fluid + ' ' + s.flow + ' ' + (s.flowUnit||'m3/h') + '\n';
        });
        
        msg += '══════════════════════════════════════════';
        _notify(msg, false);
        return filtered;
    }
    
    function listEquipment(filter) {
        const equipos = _core.getEquipos();
        if (equipos.length === 0) {
            _notify('📦 No hay equipos. Use: create equipo TIPO TAG', false);
            return [];
        }
        
        let filtered = equipos;
        if (filter) {
            const f = filter.toUpperCase();
            filtered = equipos.filter(e => 
                e.tag.toUpperCase().includes(f) || 
                e.tipo.toUpperCase().includes(f)
            );
        }
        
        let msg = '📦 EQUIPOS (' + filtered.length + ')\n';
        msg += '══════════════════════════════════════════\n';
        
        filtered.forEach(e => {
            const isLogical = !e.posX && !e.posY && !e.posZ;
            const icon = isLogical ? '📋' : '🧊';
            const hasStreams = (_core.getStreams() || []).filter(s => s.from === e.tag || s.to === e.tag).length;
            const hasLines = (_core.getLines() || []).filter(l => {
                const from = l.origin ? (l.origin.equipTag || l.origin.objTag) : '';
                const to = l.destination ? (l.destination.equipTag || l.destination.objTag) : '';
                return from === e.tag || to === e.tag;
            }).length;
            
            msg += icon + ' ' + e.tag + ' (' + e.tipo + ')';
            if (hasStreams > 0) msg += ' | Corrientes: ' + hasStreams;
            if (hasLines > 0) msg += ' | Líneas 3D: ' + hasLines;
            msg += '\n';
        });
        
        msg += '══════════════════════════════════════════';
        _notify(msg, false);
        return filtered;
    }
    
    // ================================================================
    //  VINCULACIÓN PFD ↔ 3D
    // ================================================================
    
    function linkStreamToLine(streamTag, lineTag) {
        if (!_core) {
            _notify('❌ Error: Core no inicializado', true);
            return false;
        }
        
        const stream = _core.getStreamByTag(streamTag);
        if (!stream) {
            _notify('❌ Corriente ' + streamTag + ' no encontrada', true);
            return false;
        }
        
        const line = _core.findObjectByTag(lineTag);
        if (!line || !_core.getLines().includes(line)) {
            _notify('❌ Línea ' + lineTag + ' no encontrada', true);
            return false;
        }
        
        const warnings = [];
        
        if (stream.from && line.origin) {
            const lineFrom = line.origin.equipTag || line.origin.objTag;
            if (lineFrom !== stream.from) {
                warnings.push('Origen no coincide: PFD=' + stream.from + ', 3D=' + lineFrom);
            }
        }
        
        if (stream.to && line.destination) {
            const lineTo = line.destination.equipTag || line.destination.objTag;
            if (lineTo !== stream.to) {
                warnings.push('Destino no coincide: PFD=' + stream.to + ', 3D=' + lineTo);
            }
        }
        
        if (stream.fluid && line.service && stream.fluid !== line.service) {
            warnings.push('Fluido no coincide: PFD=' + stream.fluid + ', 3D=' + line.service);
        }
        
        const result = _core.linkStreamToLine(streamTag, lineTag);
        
        if (result) {
            if (!line.service) {
                _core.updateLine(lineTag, { service: stream.fluid });
            }
            
            let msg = '✅ Corriente ' + streamTag + ' vinculada a línea ' + lineTag;
            if (warnings.length > 0) {
                msg += '\n⚠️ Advertencias:\n' + warnings.join('\n');
            }
            _notify(msg, warnings.length > 0);
        }
        
        return result;
    }
    
    function autoLinkStreams() {
        const streams = _core.getStreams();
        const lines = _core.getLines();
        let linked = 0;
        
        streams.forEach(stream => {
            if (!stream.from || !stream.to) return;
            
            lines.forEach(line => {
                const lineFrom = line.origin ? (line.origin.equipTag || line.origin.objTag) : '';
                const lineTo = line.destination ? (line.destination.equipTag || line.destination.objTag) : '';
                
                if (lineFrom === stream.from && lineTo === stream.to) {
                    if (!stream.linkedLineTags || !stream.linkedLineTags.includes(line.tag)) {
                        _core.linkStreamToLine(stream.tag, line.tag);
                        linked++;
                    }
                }
            });
        });
        
        _notify('✅ Auto-vinculación: ' + linked + ' corrientes vinculadas a líneas 3D', false);
        return linked;
    }
    
    // ================================================================
    //  VALIDACIÓN PFD
    // ================================================================
    
    function validatePFD() {
        if (!_core) return { valid: true, issues: [] };
        
        const issues = [];
        const streams = _core.getStreams();
        const equipos = _core.getEquipos();
        const lines = _core.getLines();
        const equiposTags = new Set(equipos.map(e => e.tag));
        
        streams.forEach(stream => {
            if (stream.from && !equiposTags.has(stream.from)) {
                issues.push({
                    type: 'ORIGEN_FALTANTE',
                    stream: stream.tag,
                    msg: 'Equipo origen ' + stream.from + ' no existe'
                });
            }
            
            if (stream.to && !equiposTags.has(stream.to)) {
                issues.push({
                    type: 'DESTINO_FALTANTE',
                    stream: stream.tag,
                    msg: 'Equipo destino ' + stream.to + ' no existe'
                });
            }
            
            const hasLines = stream.linkedLineTags && stream.linkedLineTags.length > 0;
            const connectedLines = lines.filter(l => {
                const from = l.origin ? (l.origin.equipTag || l.origin.objTag) : '';
                const to = l.destination ? (l.destination.equipTag || l.destination.objTag) : '';
                return from === stream.from && to === stream.to;
            });
            
            if (!hasLines && connectedLines.length === 0) {
                issues.push({
                    type: 'SIN_LINEA_3D',
                    stream: stream.tag,
                    msg: 'Corriente sin representación en 3D'
                });
            }
            
            if (!stream.fluid || (stream.fluid === 'WATER' && !stream.flow)) {
                issues.push({
                    type: 'DATOS_INCOMPLETOS',
                    stream: stream.tag,
                    msg: 'Faltan datos de diseño (fluido/flujo)'
                });
            }
        });
        
        equipos.forEach(eq => {
            if (eq.tipo === 'plataforma') return;
            
            const hasStream = streams.some(s => s.from === eq.tag || s.to === eq.tag);
            const hasLine = lines.some(l => {
                const from = l.origin ? (l.origin.equipTag || l.origin.objTag) : '';
                const to = l.destination ? (l.destination.equipTag || l.destination.objTag) : '';
                return from === eq.tag || to === eq.tag;
            });
            
            if (!hasStream && !hasLine) {
                issues.push({
                    type: 'EQUIPO_AISLADO',
                    equipment: eq.tag,
                    msg: 'Equipo ' + eq.tag + ' no tiene corrientes PFD ni tuberías 3D'
                });
            }
        });
        
        let report = '--- VALIDACIÓN PFD ---\n';
        if (issues.length === 0) {
            report += '✅ PFD íntegro.\n';
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
    
    function checkMassBalance(equipmentTag) {
        const streams = _core.getStreams();
        const inflows = streams.filter(s => s.to === equipmentTag);
        const outflows = streams.filter(s => s.from === equipmentTag);
        
        if (inflows.length === 0 && outflows.length === 0) {
            _notify('⚠️ El equipo ' + equipmentTag + ' no tiene corrientes asociadas', true);
            return null;
        }
        
        let totalIn = 0, totalOut = 0;
        inflows.forEach(s => totalIn += s.flow || 0);
        outflows.forEach(s => totalOut += s.flow || 0);
        
        const balance = totalIn - totalOut;
        const percentDiff = totalIn > 0 ? Math.abs(balance) / totalIn * 100 : 0;
        
        let msg = '⚖️ BALANCE DE MASA: ' + equipmentTag + '\n';
        msg += '══════════════════════════\n';
        msg += '📥 Entradas (' + inflows.length + '): ' + totalIn.toFixed(2) + ' m³/h\n';
        inflows.forEach(s => msg += '   ' + s.tag + ': ' + s.flow + ' ' + (s.flowUnit||'m³/h') + '\n');
        msg += '📤 Salidas (' + outflows.length + '): ' + totalOut.toFixed(2) + ' m³/h\n';
        outflows.forEach(s => msg += '   ' + s.tag + ': ' + s.flow + ' ' + (s.flowUnit||'m³/h') + '\n');
        msg += '──────────────────────────\n';
        
        if (percentDiff < 1) {
            msg += '✅ Balance OK (diferencia: ' + balance.toFixed(2) + ', ' + percentDiff.toFixed(1) + '%)';
        } else if (percentDiff < 5) {
            msg += '⚠️ Balance ACEPTABLE (diferencia: ' + balance.toFixed(2) + ', ' + percentDiff.toFixed(1) + '%)';
        } else {
            msg += '❌ Balance INCORRECTO (diferencia: ' + balance.toFixed(2) + ', ' + percentDiff.toFixed(1) + '%)';
        }
        
        _notify(msg, percentDiff >= 5);
        
        return { equipmentTag, totalIn, totalOut, balance, percentDiff, inflows, outflows };
    }
    
    function exportPFDData() {
        const streams = _core.getStreams();
        const headers = [
            'TAG', 'FROM', 'TO', 'FLUID', 'PHASE',
            'FLOW', 'FLOW_UNIT', 'PRESSURE', 'PRESSURE_UNIT',
            'TEMPERATURE', 'TEMP_UNIT', 'SERVICE',
            'LINKED_LINES', 'DESIGN_CASE'
        ];
        const rows = [headers];
        streams.forEach(s => {
            rows.push([
                s.tag, s.from || '', s.to || '', s.fluid || '', s.phase || '',
                s.flow || 0, s.flowUnit || 'm3/h', s.pressure || 0, s.pressureUnit || 'bar',
                s.temperature || 25, s.temperatureUnit || '°C', s.service || '',
                (s.linkedLineTags || []).join(', '), s.designCase || 'NORMAL'
            ]);
        });
        return rows;
    }
    
    // ================================================================
    //  INICIALIZACIÓN
    // ================================================================
    
    function init(coreInstance, catalogInstance, notifyFn) {
        _core = coreInstance;
        _catalog = catalogInstance || null;
        _notify = notifyFn || _notify;
        console.log('SmartFlowPFD v1.1 inicializado | Fluidos: ' + FLUID_TYPES.length + 
                    ' | Catálogo: ' + (_catalog ? '✅' : '⚠️ no disponible'));
    }
    
    // ================================================================
    //  API PÚBLICA
    // ================================================================
    
    return {
        init: init,
        createEquipmentForPFD: createEquipmentForPFD,
        createStream: createStream,
        getStreamInfo: getStreamInfo,
        listStreams: listStreams,
        listEquipment: listEquipment,
        linkStreamToLine: linkStreamToLine,
        autoLinkStreams: autoLinkStreams,
        validatePFD: validatePFD,
        checkMassBalance: checkMassBalance,
        exportPFDData: exportPFDData,
        validateEquipmentType: validateEquipmentType,
        FLUID_TYPES: FLUID_TYPES,
        PHASE_TYPES: PHASE_TYPES
    };
})();
