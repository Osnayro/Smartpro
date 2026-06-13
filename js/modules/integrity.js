
// ============================================================
// SMARTFLOW INTEGRITY v1.0 - Motor de Validación Cruzada
// Archivo: js/modules/integrity.js
// Dependencias: SmartFlowCore v6.0+, SmartFlowPFD, SmartFlowDTI
// ============================================================
// 
// Valida la consistencia entre los 3 módulos:
//   - PFD ↔ 3D: Corrientes vs Líneas
//   - DTI ↔ 3D: Instrumentos vs Componentes
//   - PFD ↔ DTI: Corrientes vs Instrumentos
//   - Tags duplicados, faltantes, inconsistencias
//   - Diámetros, especificaciones, materiales
//
// ============================================================

const SmartFlowIntegrity = (function() {
    
    let _core = null;
    let _pfd = null;
    let _dti = null;
    let _notify = (msg, isErr) => console.log(msg);
    
    // ================================================================
    //  TIPOS DE ISSUES
    // ================================================================
    const ISSUE_TYPES = {
        // PFD ↔ 3D
        'STREAM_SIN_LINEA':        { severity: 'WARNING',  module: 'PFD↔3D', desc: 'Corriente PFD sin línea 3D asociada' },
        'LINEA_SIN_STREAM':        { severity: 'INFO',     module: 'PFD↔3D', desc: 'Línea 3D sin corriente PFD asociada' },
        'ORIGEN_NO_COINCIDE':      { severity: 'ERROR',    module: 'PFD↔3D', desc: 'Origen PFD no coincide con origen 3D' },
        'DESTINO_NO_COINCIDE':     { severity: 'ERROR',    module: 'PFD↔3D', desc: 'Destino PFD no coincide con destino 3D' },
        'FLUIDO_NO_COINCIDE':      { severity: 'WARNING',  module: 'PFD↔3D', desc: 'Fluido PFD no coincide con servicio de línea' },
        
        // DTI ↔ 3D
        'INSTRUMENTO_SIN_LINEA':   { severity: 'WARNING',  module: 'DTI↔3D', desc: 'Instrumento DTI sin línea 3D asociada' },
        'INSTRUMENTO_NO_EN_LINEA': { severity: 'ERROR',    module: 'DTI↔3D', desc: 'Instrumento DTI vinculado a línea que no lo contiene' },
        'COMPONENTE_SIN_INSTR':    { severity: 'INFO',     module: 'DTI↔3D', desc: 'Componente 3D sin instrumento DTI asociado' },
        
        // PFD ↔ DTI
        'STREAM_SIN_INSTRUMENTOS': { severity: 'INFO',     module: 'PFD↔DTI', desc: 'Corriente sin instrumentos asociados' },
        
        // Generales
        'TAG_DUPLICADO':           { severity: 'ERROR',    module: 'GENERAL', desc: 'Tag duplicado entre módulos' },
        'EQUIPO_SIN_CONEXION':     { severity: 'WARNING',  module: 'GENERAL', desc: 'Equipo sin conexiones PFD ni 3D' },
        'DIAMETRO_NO_COINCIDE':    { severity: 'ERROR',    module: 'GENERAL', desc: 'Diámetro de línea no coincide con boquilla' },
        'SPEC_NO_COINCIDE':        { severity: 'WARNING',  module: 'GENERAL', desc: 'Especificación no coincide entre extremos' },
        'MATERIAL_NO_COINCIDE':    { severity: 'WARNING',  module: 'GENERAL', desc: 'Material no coincide entre corriente y línea' }
    };
    
    // ================================================================
    //  VALIDACIÓN PFD ↔ 3D
    // ================================================================
    
    function validatePFDvs3D() {
        const issues = [];
        const streams = _core.getStreams();
        const lines = _core.getLines();
        const equipos = _core.getEquipos();
        const equiposTags = new Set(equipos.map(e => e.tag));
        
        // Mapa de líneas por origen-destino
        const lineMap = new Map();
        lines.forEach(line => {
            const from = line.origin ? (line.origin.equipTag || line.origin.objTag) : '';
            const to = line.destination ? (line.destination.equipTag || line.destination.objTag) : '';
            const key = from + '→' + to;
            if (!lineMap.has(key)) lineMap.set(key, []);
            lineMap.get(key).push(line);
        });
        
        // Validar cada stream
        streams.forEach(stream => {
            const key = (stream.from || '') + '→' + (stream.to || '');
            const matchedLines = lineMap.get(key) || [];
            
            // Stream sin línea 3D
            if (matchedLines.length === 0 && !(stream.linkedLineTags && stream.linkedLineTags.length > 0)) {
                issues.push({
                    type: 'STREAM_SIN_LINEA',
                    severity: 'WARNING',
                    module: 'PFD↔3D',
                    entity: stream.tag,
                    msg: 'Corriente ' + stream.tag + ' (' + stream.from + ' → ' + stream.to + ') sin línea 3D',
                    suggestion: 'Use: link stream ' + stream.tag + ' to L-X'
                });
            }
            
            // Validar líneas vinculadas
            if (stream.linkedLineTags) {
                stream.linkedLineTags.forEach(lineTag => {
                    const line = _core.findObjectByTag(lineTag);
                    if (!line) {
                        issues.push({
                            type: 'LINEA_SIN_STREAM',
                            severity: 'ERROR',
                            module: 'PFD↔3D',
                            entity: stream.tag,
                            msg: 'Línea vinculada ' + lineTag + ' no existe'
                        });
                        return;
                    }
                    
                    const lineFrom = line.origin ? (line.origin.equipTag || line.origin.objTag) : '';
                    const lineTo = line.destination ? (line.destination.equipTag || line.destination.objTag) : '';
                    
                    if (stream.from && lineFrom && stream.from !== lineFrom) {
                        issues.push({
                            type: 'ORIGEN_NO_COINCIDE',
                            severity: 'ERROR',
                            module: 'PFD↔3D',
                            entity: stream.tag + ' / ' + lineTag,
                            msg: 'Origen: PFD=' + stream.from + ', 3D=' + lineFrom
                        });
                    }
                    
                    if (stream.to && lineTo && stream.to !== lineTo) {
                        issues.push({
                            type: 'DESTINO_NO_COINCIDE',
                            severity: 'ERROR',
                            module: 'PFD↔3D',
                            entity: stream.tag + ' / ' + lineTag,
                            msg: 'Destino: PFD=' + stream.to + ', 3D=' + lineTo
                        });
                    }
                    
                    if (stream.fluid && line.service && stream.fluid !== line.service) {
                        issues.push({
                            type: 'FLUIDO_NO_COINCIDE',
                            severity: 'WARNING',
                            module: 'PFD↔3D',
                            entity: stream.tag + ' / ' + lineTag,
                            msg: 'Fluido: PFD=' + stream.fluid + ', 3D=' + line.service
                        });
                    }
                });
            }
            
            // Validar equipos origen/destino
            if (stream.from && !equiposTags.has(stream.from)) {
                issues.push({
                    type: 'ORIGEN_NO_COINCIDE',
                    severity: 'ERROR',
                    module: 'PFD↔3D',
                    entity: stream.tag,
                    msg: 'Equipo origen ' + stream.from + ' no existe en el modelo'
                });
            }
            if (stream.to && !equiposTags.has(stream.to)) {
                issues.push({
                    type: 'DESTINO_NO_COINCIDE',
                    severity: 'ERROR',
                    module: 'PFD↔3D',
                    entity: stream.tag,
                    msg: 'Equipo destino ' + stream.to + ' no existe en el modelo'
                });
            }
        });
        
        // Líneas sin stream
        const allLinkedLines = new Set();
        streams.forEach(s => {
            if (s.linkedLineTags) s.linkedLineTags.forEach(t => allLinkedLines.add(t));
        });
        
        lines.forEach(line => {
            const from = line.origin ? (line.origin.equipTag || line.origin.objTag) : '';
            const to = line.destination ? (line.destination.equipTag || line.destination.objTag) : '';
            const key = from + '→' + to;
            const hasStream = streams.some(s => {
                const sk = (s.from || '') + '→' + (s.to || '');
                return sk === key || (s.linkedLineTags && s.linkedLineTags.includes(line.tag));
            });
            
            if (!hasStream && from && to) {
                issues.push({
                    type: 'LINEA_SIN_STREAM',
                    severity: 'INFO',
                    module: 'PFD↔3D',
                    entity: line.tag,
                    msg: 'Línea ' + line.tag + ' (' + from + ' → ' + to + ') sin corriente PFD asociada',
                    suggestion: 'Use: create stream SX from ' + from + ' to ' + to
                });
            }
        });
        
        return issues;
    }
    
    // ================================================================
    //  VALIDACIÓN DTI ↔ 3D
    // ================================================================
    
    function validateDTIvs3D() {
        const issues = [];
        const instruments = _core.getInstruments();
        const lines = _core.getLines();
        const lineTags = new Set(lines.map(l => l.tag));
        
        instruments.forEach(inst => {
            // Instrumento sin línea
            if (!inst.lineTag && !inst.equipmentTag) {
                issues.push({
                    type: 'INSTRUMENTO_SIN_LINEA',
                    severity: 'WARNING',
                    module: 'DTI↔3D',
                    entity: inst.tag,
                    msg: 'Instrumento ' + inst.tag + ' no vinculado a línea o equipo'
                });
                return;
            }
            
            // Instrumento vinculado a línea que no existe
            if (inst.lineTag && !lineTags.has(inst.lineTag)) {
                issues.push({
                    type: 'INSTRUMENTO_SIN_LINEA',
                    severity: 'ERROR',
                    module: 'DTI↔3D',
                    entity: inst.tag,
                    msg: 'Línea ' + inst.lineTag + ' no existe para instrumento ' + inst.tag
                });
                return;
            }
            
            // Verificar que el instrumento esté como componente en la línea
            if (inst.lineTag && lineTags.has(inst.lineTag)) {
                const line = _core.findObjectByTag(inst.lineTag);
                if (line && line.components) {
                    const found = line.components.some(c => c.tag === inst.tag || c.type === inst.type);
                    if (!found) {
                        issues.push({
                            type: 'INSTRUMENTO_NO_EN_LINEA',
                            severity: 'ERROR',
                            module: 'DTI↔3D',
                            entity: inst.tag,
                            msg: 'Instrumento ' + inst.tag + ' no está como componente en línea ' + inst.lineTag,
                            suggestion: 'El instrumento se agregará automáticamente al validar'
                        });
                        
                        // Auto-corrección: agregar el instrumento como componente
                        if (!line.components) line.components = [];
                        line.components.push({
                            type: inst.type,
                            tag: inst.tag,
                            param: inst.position || 0.5,
                            description: 'Instrumento ' + inst.tag + ' - ' + (inst.service || inst.type)
                        });
                        _core.updateLine(inst.lineTag, { components: line.components });
                    }
                }
            }
        });
        
        // Componentes sin instrumento DTI
        const instTags = new Set(instruments.map(i => i.tag));
        const instTypes = new Set(instruments.map(i => i.type));
        
        lines.forEach(line => {
            if (!line.components) return;
            line.components.forEach(comp => {
                const isInstrumentType = [
                    'PRESSURE_GAUGE', 'TEMPERATURE_GAUGE', 'FLOW_METER',
                    'LEVEL_SWITCH', 'LEVEL_TRANSMITTER', 'PRESSURE_TRANSMITTER',
                    'CONTROL_VALVE', 'SAFETY_VALVE'
                ].includes(comp.type);
                
                if (isInstrumentType && !instTags.has(comp.tag) && !instTypes.has(comp.type)) {
                    issues.push({
                        type: 'COMPONENTE_SIN_INSTR',
                        severity: 'INFO',
                        module: 'DTI↔3D',
                        entity: comp.tag || comp.type,
                        msg: 'Componente ' + (comp.tag || comp.type) + ' en línea ' + line.tag + ' sin ficha DTI',
                        suggestion: 'Use: create instrument TAG type ' + comp.type + ' on ' + line.tag
                    });
                }
            });
        });
        
        return issues;
    }
    
    // ================================================================
    //  VALIDACIÓN PFD ↔ DTI
    // ================================================================
    
    function validatePFDvsDTI() {
        const issues = [];
        const streams = _core.getStreams();
        const instruments = _core.getInstruments();
        
        streams.forEach(stream => {
            if (!stream.linkedLineTags || stream.linkedLineTags.length === 0) return;
            
            // Buscar instrumentos en las líneas vinculadas
            const instOnLines = instruments.filter(inst => 
                stream.linkedLineTags.includes(inst.lineTag)
            );
            
            if (instOnLines.length === 0) {
                issues.push({
                    type: 'STREAM_SIN_INSTRUMENTOS',
                    severity: 'INFO',
                    module: 'PFD↔DTI',
                    entity: stream.tag,
                    msg: 'Corriente ' + stream.tag + ' sin instrumentos en sus líneas 3D',
                    suggestion: 'Agregue instrumentos a las líneas: ' + stream.linkedLineTags.join(', ')
                });
            }
        });
        
        return issues;
    }
    
    // ================================================================
    //  VALIDACIÓN DE TAGS DUPLICADOS
    // ================================================================
    
    function validateDuplicateTags() {
        const issues = [];
        const allTags = new Map();
        
        // Equipos
        _core.getEquipos().forEach(e => {
            if (!allTags.has(e.tag)) allTags.set(e.tag, []);
            allTags.get(e.tag).push('EQUIPO');
        });
        
        // Líneas
        _core.getLines().forEach(l => {
            if (!allTags.has(l.tag)) allTags.set(l.tag, []);
            allTags.get(l.tag).push('LINEA');
        });
        
        // Streams
        _core.getStreams().forEach(s => {
            if (!allTags.has(s.tag)) allTags.set(s.tag, []);
            allTags.get(s.tag).push('STREAM');
        });
        
        // Instruments
        _core.getInstruments().forEach(i => {
            if (!allTags.has(i.tag)) allTags.set(i.tag, []);
            allTags.get(i.tag).push('INSTRUMENT');
        });
        
        // Loops
        _core.getLoops().forEach(l => {
            if (!allTags.has(l.tag)) allTags.set(l.tag, []);
            allTags.get(l.tag).push('LOOP');
        });
        
        allTags.forEach((types, tag) => {
            if (types.length > 1) {
                issues.push({
                    type: 'TAG_DUPLICADO',
                    severity: 'ERROR',
                    module: 'GENERAL',
                    entity: tag,
                    msg: 'Tag duplicado: ' + tag + ' existe como ' + types.join(', ')
                });
            }
        });
        
        return issues;
    }
    
    // ================================================================
    //  VALIDACIÓN DE CONSISTENCIA DE INGENIERÍA
    // ================================================================
    
    function validateEngineeringConsistency() {
        const issues = [];
        const lines = _core.getLines();
        const equipos = _core.getEquipos();
        
        // Validar diámetros línea vs boquilla
        lines.forEach(line => {
            const diamLinea = line.diameter || 0;
            
            if (line.origin && line.origin.objTag) {
                const obj = _core.findObjectByTag(line.origin.objTag);
                if (obj && obj.puertos) {
                    const nozzle = obj.puertos.find(p => p.id === line.origin.portId);
                    if (nozzle && nozzle.diametro && nozzle.diametro !== diamLinea) {
                        issues.push({
                            type: 'DIAMETRO_NO_COINCIDE',
                            severity: 'ERROR',
                            module: 'GENERAL',
                            entity: line.tag,
                            msg: 'Diámetro línea ' + line.tag + ' (' + diamLinea + '") ≠ boquilla ' + 
                                 line.origin.objTag + '.' + line.origin.portId + ' (' + nozzle.diametro + '")'
                        });
                    }
                }
            }
            
            if (line.destination && line.destination.objTag) {
                const obj = _core.findObjectByTag(line.destination.objTag);
                if (obj && obj.puertos) {
                    const nozzle = obj.puertos.find(p => p.id === line.destination.portId);
                    if (nozzle && nozzle.diametro && nozzle.diametro !== diamLinea) {
                        issues.push({
                            type: 'DIAMETRO_NO_COINCIDE',
                            severity: 'ERROR',
                            module: 'GENERAL',
                            entity: line.tag,
                            msg: 'Diámetro línea ' + line.tag + ' (' + diamLinea + '") ≠ boquilla ' + 
                                 line.destination.objTag + '.' + line.destination.portId + ' (' + nozzle.diametro + '")'
                        });
                    }
                }
            }
        });
        
        // Equipos sin conexiones
        const connectedEquipos = new Set();
        lines.forEach(line => {
            if (line.origin && line.origin.objTag) connectedEquipos.add(line.origin.objTag);
            if (line.destination && line.destination.objTag) connectedEquipos.add(line.destination.objTag);
        });
        
        _core.getStreams().forEach(s => {
            if (s.from) connectedEquipos.add(s.from);
            if (s.to) connectedEquipos.add(s.to);
        });
        
        equipos.forEach(eq => {
            if (eq.tipo === 'plataforma') return;
            if (!connectedEquipos.has(eq.tag)) {
                issues.push({
                    type: 'EQUIPO_SIN_CONEXION',
                    severity: 'WARNING',
                    module: 'GENERAL',
                    entity: eq.tag,
                    msg: 'Equipo ' + eq.tag + ' (' + eq.tipo + ') sin corrientes PFD ni líneas 3D'
                });
            }
        });
        
        return issues;
    }
    
    // ================================================================
    //  VALIDACIÓN COMPLETA
    // ================================================================
    
    function validateAll() {
        const allIssues = [];
        
        allIssues.push(...validatePFDvs3D());
        allIssues.push(...validateDTIvs3D());
        allIssues.push(...validatePFDvsDTI());
        allIssues.push(...validateDuplicateTags());
        allIssues.push(...validateEngineeringConsistency());
        
        // Estadísticas
        const stats = {
            total: allIssues.length,
            errors: allIssues.filter(i => i.severity === 'ERROR').length,
            warnings: allIssues.filter(i => i.severity === 'WARNING').length,
            info: allIssues.filter(i => i.severity === 'INFO').length,
            byModule: {},
            byType: {}
        };
        
        allIssues.forEach(i => {
            if (!stats.byModule[i.module]) stats.byModule[i.module] = 0;
            stats.byModule[i.module]++;
            
            if (!stats.byType[i.type]) stats.byType[i.type] = 0;
            stats.byType[i.type]++;
        });
        
        // Generar reporte
        let report = '══════════════════════════════════════\n';
        report += '🔍 VALIDACIÓN CRUZADA PFD ↔ DTI ↔ 3D\n';
        report += '══════════════════════════════════════\n\n';
        
        report += '📊 RESUMEN:\n';
        report += '   Total issues: ' + stats.total + '\n';
        report += '   ❌ Errores: ' + stats.errors + '\n';
        report += '   ⚠️ Advertencias: ' + stats.warnings + '\n';
        report += '   ℹ️ Info: ' + stats.info + '\n\n';
        
        if (Object.keys(stats.byModule).length > 0) {
            report += '📁 POR MÓDULO:\n';
            for (const [mod, count] of Object.entries(stats.byModule)) {
                const icon = mod === 'GENERAL' ? '🔧' : mod === 'PFD↔3D' ? '📊' : mod === 'DTI↔3D' ? '🔧' : '🔗';
                report += '   ' + icon + ' ' + mod + ': ' + count + '\n';
            }
        }
        
        if (allIssues.length > 0) {
            report += '\n══════════════════════════════════════\n';
            report += 'DETALLE DE ISSUES:\n';
            report += '══════════════════════════════════════\n';
            
            // Agrupar por severidad
            ['ERROR', 'WARNING', 'INFO'].forEach(severity => {
                const items = allIssues.filter(i => i.severity === severity);
                if (items.length === 0) return;
                
                const icon = severity === 'ERROR' ? '❌' : severity === 'WARNING' ? '⚠️' : 'ℹ️';
                report += '\n' + icon + ' ' + severity + ' (' + items.length + '):\n';
                
                items.forEach(item => {
                    report += '   [' + item.module + '] ' + item.msg + '\n';
                    if (item.suggestion) {
                        report += '   💡 ' + item.suggestion + '\n';
                    }
                });
            });
        } else {
            report += '\n✅ PROYECTO ÍNTEGRO\n';
            report += '   Sin discrepancias entre PFD, DTI y modelo 3D.\n';
        }
        
        report += '\n══════════════════════════════════════';
        
        _notify(report, stats.errors > 0);
        
        return {
            issues: allIssues,
            stats: stats,
            report: report,
            isValid: stats.errors === 0
        };
    }
    
    // ================================================================
    //  REPORTE RÁPIDO
    // ================================================================
    
    function quickSummary() {
        const stats = {
            equipos: _core.getEquipos().length,
            lineas: _core.getLines().length,
            streams: _core.getStreams().length,
            instruments: _core.getInstruments().length,
            loops: _core.getLoops().length,
            equiposConectados: 0,
            streamsConLineas: 0,
            instrumentosVinculados: 0
        };
        
        const connectedEquipos = new Set();
        _core.getLines().forEach(l => {
            if (l.origin && l.origin.objTag) connectedEquipos.add(l.origin.objTag);
            if (l.destination && l.destination.objTag) connectedEquipos.add(l.destination.objTag);
        });
        _core.getStreams().forEach(s => {
            if (s.from) connectedEquipos.add(s.from);
            if (s.to) connectedEquipos.add(s.to);
        });
        
        stats.equiposConectados = connectedEquipos.size;
        stats.streamsConLineas = _core.getStreams().filter(s => s.linkedLineTags && s.linkedLineTags.length > 0).length;
        stats.instrumentosVinculados = _core.getInstruments().filter(i => i.lineTag || i.equipmentTag).length;
        
        let msg = '══════════════════════════\n';
        msg += '📊 RESUMEN DEL PROYECTO\n';
        msg += '══════════════════════════\n\n';
        msg += '📦 Equipos: ' + stats.equipos + ' (' + stats.equiposConectados + ' conectados)\n';
        msg += '📏 Líneas 3D: ' + stats.lineas + '\n';
        msg += '📊 Corrientes PFD: ' + stats.streams + ' (' + stats.streamsConLineas + ' con línea 3D)\n';
        msg += '🔧 Instrumentos DTI: ' + stats.instruments + ' (' + stats.instrumentosVinculados + ' vinculados)\n';
        msg += '🔄 Lazos de control: ' + stats.loops + '\n';
        msg += '══════════════════════════';
        
        _notify(msg, false);
        return stats;
    }
    
    // ================================================================
    //  AUTO-CORRECCIÓN
    // ================================================================
    
    function autoFix() {
        let fixed = 0;
        
        // Vincular automáticamente streams con líneas
        if (_pfd && typeof _pfd.autoLinkStreams === 'function') {
            fixed += _pfd.autoLinkStreams();
        }
        
        // Corregir instrumentos que no están como componentes
        const instruments = _core.getInstruments();
        instruments.forEach(inst => {
            if (!inst.lineTag) return;
            const line = _core.findObjectByTag(inst.lineTag);
            if (!line) return;
            
            if (!line.components) line.components = [];
            const found = line.components.some(c => c.tag === inst.tag);
            
            if (!found) {
                line.components.push({
                    type: inst.type,
                    tag: inst.tag,
                    param: inst.position || 0.5,
                    description: 'Instrumento ' + inst.tag + ' - ' + (inst.service || inst.type)
                });
                _core.updateLine(inst.lineTag, { components: line.components });
                fixed++;
            }
        });
        
        _notify('✅ Auto-corrección: ' + fixed + ' issues resueltos', false);
        return fixed;
    }
    
    // ================================================================
    //  INICIALIZACIÓN
    // ================================================================
    
    function init(coreInstance, pfdInstance, dtiInstance, notifyFn) {
        _core = coreInstance;
        _pfd = pfdInstance || null;
        _dti = dtiInstance || null;
        _notify = notifyFn || _notify;
        console.log('SmartFlowIntegrity v1.0 inicializado | Core: ' + (_core ? '✅' : '❌') + 
                    ' | PFD: ' + (_pfd ? '✅' : '⚠️') + ' | DTI: ' + (_dti ? '✅' : '⚠️'));
    }
    
    // ================================================================
    //  API PÚBLICA
    // ================================================================
    
    return {
        init: init,
        validateAll: validateAll,
        validatePFDvs3D: validatePFDvs3D,
        validateDTIvs3D: validateDTIvs3D,
        validatePFDvsDTI: validatePFDvsDTI,
        validateDuplicateTags: validateDuplicateTags,
        validateEngineeringConsistency: validateEngineeringConsistency,
        quickSummary: quickSummary,
        autoFix: autoFix,
        ISSUE_TYPES: ISSUE_TYPES
    };
})();
