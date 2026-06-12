
// ============================================================
// SMARTFLOW PFD ENGINE v1.0 - Motor de Diagrama de Flujo de Proceso
// Archivo: js/modules/pfd_engine.js
// Dependencias: SmartFlowCore v6.0+
// ============================================================
// 
// Gestiona:
//   - Corrientes de proceso (Streams)
//   - Conexiones lógicas entre equipos
//   - Vinculación PFD ↔ Líneas 3D
//   - Validación de integridad PFD
//   - Cálculos de balance de masa simples
//
// ============================================================

const SmartFlowPFD = (function() {
    
    let _core = null;
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
    //  CREACIÓN DE CORRIENTES
    // ================================================================
    
    /**
     * Crea una nueva corriente de proceso
     * @param {Object} params - Parámetros de la corriente
     * @returns {Object|null} La corriente creada o null si hay error
     */
    function createStream(params) {
        if (!_core) {
            _notify('❌ Error: Core no inicializado', true);
            return null;
        }
        
        // Validaciones
        if (!params.tag) {
            _notify('❌ Error: Tag de corriente requerido', true);
            return null;
        }
        
        if (_core.getStreamByTag(params.tag)) {
            _notify('❌ Error: La corriente ' + params.tag + ' ya existe', true);
            return null;
        }
        
        // Validar que los equipos existen si se especifican
        if (params.from && !_core.findObjectByTag(params.from)) {
            _notify('⚠️ Advertencia: Equipo origen ' + params.from + ' no existe en el modelo 3D', false);
        }
        if (params.to && !_core.findObjectByTag(params.to)) {
            _notify('⚠️ Advertencia: Equipo destino ' + params.to + ' no existe en el modelo 3D', false);
        }
        
        // Validar fluido
        if (params.fluid && FLUID_TYPES.indexOf(params.fluid.toUpperCase()) === -1) {
            _notify('⚠️ Fluido "' + params.fluid + '" no está en la lista estándar. Se agregará igualmente.', false);
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
            // Auto-detectar fase según temperatura
            if (!params.phase && params.fluid === 'STEAM' && params.temperature >= 100) {
                _core.updateStream(params.tag, { phase: 'GAS' });
            }
            
            const fromStr = params.from ? params.from : '?';
            const toStr = params.to ? params.to : '?';
            _notify('✅ Corriente ' + params.tag + ': ' + fromStr + ' → ' + toStr + ' | ' + streamData.fluid + ' ' + streamData.flow + ' ' + streamData.flowUnit);
        }
        
        return result ? _core.getStreamByTag(params.tag) : null;
    }
    
    // ================================================================
    //  CONSULTA DE CORRIENTES
    // ================================================================
    
    /**
     * Obtiene información detallada de una corriente
     */
    function getStreamInfo(tag) {
        const stream = _core.getStreamByTag(tag);
        if (!stream) {
            _notify('❌ Corriente ' + tag + ' no encontrada', true);
            return null;
        }
        
        // Buscar líneas 3D vinculadas
        const allLines = _core.getLines();
        const linkedLines = allLines.filter(l => 
            stream.linkedLineTags && stream.linkedLineTags.includes(l.tag)
        );
        
        // Buscar líneas que conecten los mismos equipos
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
        
        // Formatear salida
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
    
    /**
     * Lista todas las corrientes
     */
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
            msg += icon + ' ' + s.tag + ': ' + (s.from||'?') + ' → ' + (s.to||'?') + ' | ' + s.fluid + ' ' + s.flow + ' ' + (s.flowUnit||'m3/h') + '\n';
        });
        
        msg += '══════════════════════════════════════════';
        _notify(msg, false);
        return filtered;
    }
    
    // ================================================================
    //  VINCULACIÓN PFD ↔ 3D
    // ================================================================
    
    /**
     * Vincula una corriente PFD con una línea 3D
     */
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
        
        // Verificar consistencia
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
            // Actualizar el servicio de la línea con el fluido de la corriente
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
    
    /**
     * Auto-vincula corrientes con líneas basado en coincidencia de equipos
     */
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
    //  VALIDACIÓN DE INTEGRIDAD PFD
    // ================================================================
    
    /**
     * Valida la integridad del PFD contra el modelo 3D
     */
    function validatePFD() {
        if (!_core) return { valid: true, issues: [] };
        
        const issues = [];
        const streams = _core.getStreams();
        const equipos = _core.getEquipos();
        const lines = _core.getLines();
        const equiposTags = new Set(equipos.map(e => e.tag));
        
        streams.forEach(stream => {
            // Verificar origen
            if (stream.from && !equiposTags.has(stream.from)) {
                issues.push({
                    type: 'ORIGEN_FALTANTE',
                    stream: stream.tag,
                    msg: 'Equipo origen ' + stream.from + ' no existe en el modelo 3D'
                });
            }
            
            // Verificar destino
            if (stream.to && !equiposTags.has(stream.to)) {
                issues.push({
                    type: 'DESTINO_FALTANTE',
                    stream: stream.tag,
                    msg: 'Equipo destino ' + stream.to + ' no existe en el modelo 3D'
                });
            }
            
            // Verificar si tiene líneas 3D asociadas
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
            
            // Verificar datos mínimos
            if (!stream.fluid || stream.fluid === 'WATER' && !stream.flow) {
                issues.push({
                    type: 'DATOS_INCOMPLETOS',
                    stream: stream.tag,
                    msg: 'Faltan datos de diseño (fluido/flujo)'
                });
            }
        });
        
        // Verificar equipos sin corrientes
        equipos.forEach(eq => {
            if (eq.tipo === 'plataforma') return; // Las plataformas no tienen corrientes
            
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
        
        // Reporte
        let report = '--- VALIDACIÓN PFD ---\n';
        if (issues.length === 0) {
            report += '✅ PFD íntegro. Todas las corrientes tienen representación 3D.\n';
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
        
        return {
            valid: issues.length === 0,
            issues: issues,
            report: report
        };
    }
    
    // ================================================================
    //  BALANCE DE MASA SIMPLE
    // ================================================================
    
    /**
     * Verifica balance de masa para un equipo
     * Suma de flujos de entrada = Suma de flujos de salida
     */
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
        
        return {
            equipmentTag: equipmentTag,
            totalIn: totalIn,
            totalOut: totalOut,
            balance: balance,
            percentDiff: percentDiff,
            inflows: inflows,
            outflows: outflows
        };
    }
    
    // ================================================================
    //  EXPORTACIÓN DE DATOS PFD
    // ================================================================
    
    /**
     * Exporta los datos PFD para la base de datos Excel
     */
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
                s.tag,
                s.from || '',
                s.to || '',
                s.fluid || '',
                s.phase || '',
                s.flow || 0,
                s.flowUnit || 'm3/h',
                s.pressure || 0,
                s.pressureUnit || 'bar',
                s.temperature || 25,
                s.temperatureUnit || '°C',
                s.service || '',
                (s.linkedLineTags || []).join(', '),
                s.designCase || 'NORMAL'
            ]);
        });
        
        return rows;
    }
    
    // ================================================================
    //  INICIALIZACIÓN
    // ================================================================
    
    function init(coreInstance, notifyFn) {
        _core = coreInstance;
        _notify = notifyFn || _notify;
        console.log('SmartFlowPFD v1.0 inicializado | Fluidos: ' + FLUID_TYPES.length + ' | Fases: ' + PHASE_TYPES.length);
    }
    
    // ================================================================
    //  API PÚBLICA
    // ================================================================
    
    return {
        init: init,
        createStream: createStream,
        getStreamInfo: getStreamInfo,
        listStreams: listStreams,
        linkStreamToLine: linkStreamToLine,
        autoLinkStreams: autoLinkStreams,
        validatePFD: validatePFD,
        checkMassBalance: checkMassBalance,
        exportPFDData: exportPFDData,
        FLUID_TYPES: FLUID_TYPES,
        PHASE_TYPES: PHASE_TYPES
    };
})();
```

---

Integración en commands.js

Agrega estas funciones de parsing y regístralas en executeCommand():

```javascript
// ================================================================
//  COMANDOS PFD (Agregar en commands.js)
// ================================================================

function parseCreateStream(cmd) {
    const parts = cmd.trim().split(/\s+/);
    if (parts[0] !== 'create' || parts[1] !== 'stream') return false;
    
    const tag = parts[2];
    if (!tag) { notifyWithVoice('❌ Uso: create stream TAG from EQUIPO to EQUIPO fluid FLUIDO flow VALOR', true); return true; }
    
    const fromIdx = parts.indexOf('from') !== -1 ? parts.indexOf('from') : parts.indexOf('desde');
    const toIdx = parts.indexOf('to') !== -1 ? parts.indexOf('to') : parts.indexOf('a');
    
    if (fromIdx === -1 || toIdx === -1) {
        notifyWithVoice('❌ Especifique origen (from) y destino (to)', true);
        return true;
    }
    
    const params = {
        tag: tag,
        from: parts[fromIdx + 1] || '',
        to: parts[toIdx + 1] || ''
    };
    
    // Extraer parámetros nombrados
    for (let i = toIdx + 2; i < parts.length; i++) {
        const key = parts[i].toLowerCase();
        if (key === 'fluid' || key === 'fluido') params.fluid = parts[++i]?.toUpperCase();
        else if (key === 'flow' || key === 'flujo') params.flow = parseFloat(parts[++i]) || 0;
        else if (key === 'pressure' || key === 'presion') params.pressure = parseFloat(parts[++i]) || 0;
        else if (key === 'temperature' || key === 'temperatura') params.temperature = parseFloat(parts[++i]) || 25;
        else if (key === 'phase' || key === 'fase') params.phase = parts[++i]?.toUpperCase();
        else if (key === 'service' || key === 'servicio') params.service = parts[++i];
        else if (key === 'density' || key === 'densidad') params.density = parseFloat(parts[++i]) || 1000;
    }
    
    if (typeof SmartFlowPFD !== 'undefined') {
        SmartFlowPFD.createStream(params);
        return true;
    }
    
    notifyWithVoice('❌ Módulo PFD no disponible', true);
    return true;
}

function parseStreamInfo(cmd) {
    const parts = cmd.trim().split(/\s+/);
    if (parts[0] !== 'info' || parts[1] !== 'stream') return false;
    const tag = parts[2];
    if (!tag) { notifyWithVoice('Uso: info stream TAG', true); return true; }
    if (typeof SmartFlowPFD !== 'undefined') {
        SmartFlowPFD.getStreamInfo(tag);
        return true;
    }
    return false;
}

function parseListStreams(cmd) {
    const parts = cmd.trim().split(/\s+/);
    if (parts[0] !== 'list' || parts[1] !== 'streams') return false;
    const filter = parts[2] || null;
    if (typeof SmartFlowPFD !== 'undefined') {
        SmartFlowPFD.listStreams(filter);
        return true;
    }
    return false;
}

function parseLinkStream(cmd) {
    const parts = cmd.trim().split(/\s+/);
    if (parts[0] !== 'link' || parts[1] !== 'stream') return false;
    // "link stream S1 to L-1"
    const streamTag = parts[2];
    const toIdx = parts.indexOf('to');
    if (toIdx === -1 || !streamTag) return false;
    const lineTag = parts[toIdx + 1];
    if (typeof SmartFlowPFD !== 'undefined') {
        SmartFlowPFD.linkStreamToLine(streamTag, lineTag);
        return true;
    }
    return false;
}

function parseValidatePFD(cmd) {
    const trimmed = cmd.trim().toLowerCase();
    if (trimmed === 'validate pfd' || trimmed === 'validar pfd') {
        if (typeof SmartFlowPFD !== 'undefined') {
            SmartFlowPFD.validatePFD();
            return true;
        }
    }
    return false;
}

function parseBalance(cmd) {
    const parts = cmd.trim().split(/\s+/);
    if (parts[0] !== 'balance' || parts[1] !== 'masa') return false;
    const tag = parts[2];
    if (!tag) { notifyWithVoice('Uso: balance masa EQUIPO_TAG', true); return true; }
    if (typeof SmartFlowPFD !== 'undefined') {
        SmartFlowPFD.checkMassBalance(tag);
        return true;
    }
    return false;
}

function parseAutoLink(cmd) {
    const trimmed = cmd.trim().toLowerCase();
    if (trimmed === 'autolink' || trimmed === 'auto link' || trimmed === 'vincular auto') {
        if (typeof SmartFlowPFD !== 'undefined') {
            SmartFlowPFD.autoLinkStreams();
            return true;
        }
    }
    return false;
}
```

---

Registro en executeCommand() — Agregar estas líneas:

```javascript
// En executeCommand(), después de los comandos existentes:

// ===== COMANDOS PFD =====
if (parseCreateStream(trimmed))    { recordCommand(cmd); return true; }
if (parseStreamInfo(trimmed))      { recordCommand(cmd); return true; }
if (parseListStreams(trimmed))     { recordCommand(cmd); return true; }
if (parseLinkStream(trimmed))      { recordCommand(cmd); return true; }
if (parseValidatePFD(trimmed))     { recordCommand(cmd); return true; }
if (parseBalance(trimmed))         { recordCommand(cmd); return true; }
if (parseAutoLink(trimmed))        { recordCommand(cmd); return true; }
