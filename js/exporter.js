
// ============================================================
// SMARTFLOW EXPORTER v1.0 - Módulo de Exportación e Importación
// Archivo: js/exporter.js
// Unifica: PDF, PCF, CSV, JSON, MTO, Import PCF, Import JSON
// ============================================================

const SmartFlowExporter = (function() {
    
    let _core = null;
    let _renderer = null;
    let _engine3d = null;
    let _catalog = null;

    // ================================================================
    // INICIALIZACIÓN
    // ================================================================
    function init(coreInstance, rendererInstance, engine3dInstance, catalogInstance) {
        _core = coreInstance;
        _renderer = rendererInstance;
        _engine3d = engine3dInstance;
        _catalog = catalogInstance;
        console.log('✔ SmartFlowExporter v1.0 inicializado');
    }

    // ================================================================
    // UTILIDADES
    // ================================================================
    function notify(msg, isErr) {
        isErr = isErr || false;
        if (typeof NotificationService !== 'undefined') {
            NotificationService.notify(msg, { isError: isErr, toast: true, statusBar: true });
        }
        const statusEl = document.getElementById('statusMsg');
        if (statusEl) {
            statusEl.textContent = msg;
            statusEl.style.color = isErr ? '#ef4444' : '#00f2ff';
        }
        const notifEl = document.getElementById('notification');
        if (notifEl) {
            notifEl.textContent = msg;
            notifEl.style.backgroundColor = isErr ? '#da3633' : '#238636';
            notifEl.style.display = 'block';
            setTimeout(function() { notifEl.style.display = 'none'; }, 4000);
        }
    }

    function getProjectName() {
        return (window.currentProjectName || 'SmartFlow-Proyecto');
    }

    function downloadBlob(content, fileName, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = fileName;
        a.click();
        setTimeout(function() { URL.revokeObjectURL(a.href); }, 1000);
    }

    function getPoints(obj) {
        if (!obj) return [];
        if (_core) return _core.getLinePoints(obj) || [];
        return obj._cachedPoints || obj.points3D || obj.points || [];
    }

    // ================================================================
    // EXPORTAR PDF (Isométrico 2.5D)
    // ================================================================
    function exportPDF() {
        const canvas = _renderer && _renderer.getCanvas ? _renderer.getCanvas() : document.getElementById('isoCanvas');
        if (!canvas) {
            // Intentar con el motor 3D
            if (_engine3d && _engine3d.exportToDataURL) {
                const dataURL = _engine3d.exportToDataURL();
                if (dataURL && typeof window.jspdf !== 'undefined') {
                    const { jsPDF } = window.jspdf;
                    const doc = new jsPDF({ orientation: 'landscape' });
                    doc.addImage(dataURL, 'PNG', 10, 10, 277, 150);
                    doc.setFontSize(16);
                    doc.text('SmartFlow - Reporte 3D', 10, 175);
                    doc.setFontSize(10);
                    doc.text('Fecha: ' + new Date().toLocaleString(), 10, 185);
                    doc.text('Proyecto: ' + getProjectName(), 10, 192);
                    doc.save(getProjectName() + '_3D_' + Date.now() + '.pdf');
                    notify('✅ PDF 3D generado correctamente.');
                    return;
                }
            }
            notify('Error: No hay vista disponible para exportar', true);
            return;
        }

        try {
            if (typeof window.jspdf === 'undefined') {
                notify('Error: jsPDF no disponible. Agregue la librería.', true);
                return;
            }

            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ orientation: 'landscape', unit: 'mm' });
            const imgData = canvas.toDataURL('image/png');
            doc.addImage(imgData, 'PNG', 10, 10, 277, 150);
            doc.setFontSize(16);
            doc.text('SmartFlow - Reporte Isométrico', 10, 175);
            doc.setFontSize(10);
            doc.text('Fecha: ' + new Date().toLocaleString(), 10, 185);
            doc.text('Proyecto: ' + getProjectName(), 10, 192);
            doc.save(getProjectName() + '_Isometrico_' + Date.now() + '.pdf');
            notify('✅ PDF generado correctamente.');
        } catch (e) {
            notify('Error al generar PDF: ' + e.message, true);
        }
    }

    // ================================================================
    // EXPORTAR PNG (Visor 3D)
    // ================================================================
    function exportPNG() {
        if (!_engine3d || !_engine3d.exportToDataURL) {
            notify('Error: Motor 3D no disponible', true);
            return;
        }

        const dataURL = _engine3d.exportToDataURL();
        if (!dataURL) {
            notify('Error al capturar vista 3D', true);
            return;
        }

        const a = document.createElement('a');
        a.href = dataURL;
        a.download = getProjectName() + '_3D_' + Date.now() + '.png';
        a.click();
        notify('✅ PNG exportado correctamente.');
    }

    // ================================================================
    // EXPORTAR PCF (Formato ISOGEN)
    // ================================================================
    const SKEY_MAP = {
        'GATE_VALVE': 'VAGF', 'GLOBE_VALVE': 'VGLF', 'BUTTERFLY_VALVE': 'VBAF',
        'BALL_VALVE': 'VBAL', 'VALVE_BALL': 'VBAL', 'CHECK_VALVE': 'VCFF',
        'DIAPHRAGM_VALVE': 'VDIA', 'CONTROL_VALVE': 'VCON',
        'PRESSURE_RELIEF': 'VPRV', 'SAFETY_VALVE': 'VSFT',
        'WELD_NECK_FLANGE': 'FLWN', 'SLIP_ON_FLANGE': 'FLSO',
        'BLIND_FLANGE': 'FLBL', 'LAP_JOINT_FLANGE': 'FLLJ',
        'ELBOW_90_LR': 'ELBW', 'ELBOW_90_SR': 'ELBS', 'ELBOW_45': 'ELL4',
        'ELBOW_90_PPR': 'ELBW', 'ELBOW_45_PPR': 'ELL4', 'CODO_90_ACERO_3IN': 'ELBW',
        'CONCENTRIC_REDUCER': 'RECN', 'ECCENTRIC_REDUCER': 'REEC',
        'TEE_EQUAL': 'TEE', 'TEE_REDUCING': 'TEER', 'TEE_PPR': 'TEE',
        'CROSS': 'CROS', 'CAP': 'CAPF',
        'PIPE_SHOE': 'SHOE', 'U_BOLT': 'UBOL', 'GUIDE': 'GUID', 'ANCHOR': 'ANCH',
        'TRANSITION': 'TRAN', 'UNION': 'UNIO', 'BULKHEAD': 'BULK',
        'Y_STRAINER': 'STRY', 'PRESSURE_GAUGE': 'INPG',
        'TEMPERATURE_GAUGE': 'INTG', 'FLOW_METER': 'INFM', 'LEVEL_SWITCH_RANA': 'INSLS'
    };

    function generatePCFHeader(line) {
        var projectName = getProjectName();
        return [
            'ISOGEN-FILES PCF.STYLE',
            'UNITS-BORMM             MM',
            'UNITS-COOR              MM',
            'UNITS-WEIGHT            KG',
            'PIPELINE-REFERENCE      ' + line.tag,
            'REVISION                ' + (line.revision || '0'),
            'PROJECT-IDENTIFIER      ' + projectName,
            'ATTRIBUTE1              ' + (line.service || 'PROCESS'),
            'ATTRIBUTE2              ' + (line.spec || 'UNSPECIFIED'),
            'END-POSITION-CHECK      OFF'
        ].join('\n');
    }

    function formatComponentPCF(comp, pos, diameterMM, dirVec) {
        var skey = SKEY_MAP[comp.type] || 'MISC';
        var lines = [
            comp.type,
            '    END-POINT           ' + pos.p1.x.toFixed(2) + ' ' + pos.p1.y.toFixed(2) + ' ' + pos.p1.z.toFixed(2) + '  ' + diameterMM.toFixed(2),
            '    END-POINT           ' + pos.p2.x.toFixed(2) + ' ' + pos.p2.y.toFixed(2) + ' ' + pos.p2.z.toFixed(2) + '  ' + diameterMM.toFixed(2),
            '    SKEY                ' + skey,
            '    ITEM-CODE           ' + (comp.itemCode || comp.type),
            '    ITEM-DESCRIPTION    ' + (comp.description || comp.nombre || comp.type)
        ];
        if (dirVec) {
            lines.push('    ENTRY               ' + dirVec.dx.toFixed(3) + ' ' + dirVec.dy.toFixed(3) + ' ' + dirVec.dz.toFixed(3));
            lines.push('    EXIT                ' + dirVec.dx.toFixed(3) + ' ' + dirVec.dy.toFixed(3) + ' ' + dirVec.dz.toFixed(3));
        }
        lines.push('    FABRICATION-ITEM');
        return lines.join('\n');
    }

    function calculateComponentPosition(line, param) {
        var pts = _core ? _core.getLinePoints(line) : (line._cachedPoints || line.points3D);
        if (!pts || pts.length < 2) return null;
        var lengths = [], totalLen = 0;
        for (var i = 0; i < pts.length - 1; i++) {
            var d = Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y, pts[i+1].z - pts[i].z);
            lengths.push(d); totalLen += d;
        }
        if (totalLen === 0) return null;
        var targetLen = totalLen * param;
        var accum = 0, segIdx = 0, t = 0;
        for (var j = 0; j < lengths.length; j++) {
            if (accum + lengths[j] >= targetLen || j === lengths.length - 1) {
                segIdx = j; t = (targetLen - accum) / (lengths[j] || 1); break;
            }
            accum += lengths[j];
        }
        var pA = pts[segIdx], pB = pts[segIdx + 1];
        var compPos = { x: pA.x + (pB.x - pA.x) * t, y: pA.y + (pB.y - pA.y) * t, z: pA.z + (pB.z - pA.z) * t };
        var dirVec = { dx: pB.x - pA.x, dy: pB.y - pA.y, dz: pB.z - pA.z };
        var len = Math.hypot(dirVec.dx, dirVec.dy, dirVec.dz) || 1;
        return { p1: compPos, p2: compPos, dir: { dx: dirVec.dx/len, dy: dirVec.dy/len, dz: dirVec.dz/len } };
    }

    function exportPCF(options) {
        options = options || {};
        if (!_core) { notify('Error: Core no inicializado', true); return; }

        var db = _core.getDb();
        var lines = db.lines || [];
        if (lines.length === 0) { notify('No hay líneas para exportar.', true); return; }

        var projectName = options.projectName || getProjectName();
        var pcfContent = '';

        // Boquillas de equipos
        if (options.includeNozzles !== false) {
            var equipos = db.equipos || [];
            equipos.forEach(function(eq) {
                if (!eq.puertos) return;
                eq.puertos.forEach(function(nz) {
                    var pos = {
                        x: eq.posX + (nz.relX || 0),
                        y: eq.posY + (nz.relY || 0),
                        z: eq.posZ + (nz.relZ || 0)
                    };
                    var dir = nz.orientacion || { dx: 0, dy: 0, dz: 1 };
                    var diamMM = (nz.diametro || 4) * 25.4;
                    pcfContent += 'NOZZLE\n';
                    pcfContent += '    COMPONENT-IDENTIFIER ' + eq.tag + '-' + nz.id + '\n';
                    pcfContent += '    END-POINT           ' + pos.x.toFixed(2) + ' ' + pos.y.toFixed(2) + ' ' + pos.z.toFixed(2) + '  ' + diamMM.toFixed(2) + '\n';
                    pcfContent += '    DIRECTION           ' + dir.dx.toFixed(3) + ' ' + dir.dy.toFixed(3) + ' ' + dir.dz.toFixed(3) + '\n';
                    pcfContent += '    SKEY                NOZZ\n';
                    pcfContent += '    ITEM-DESCRIPTION    Boquilla ' + nz.id + ' ' + nz.diametro + '"\n\n';
                });
            });
        }

        // Tuberías
        lines.forEach(function(line) {
            var pts = _core.getLinePoints(line) || line._cachedPoints || line.points3D || [];
            if (pts.length < 2) return;
            var diamMM = (line.diameter || 4) * 25.4;
            pcfContent += generatePCFHeader(line) + '\n';

            for (var i = 0; i < pts.length - 1; i++) {
                var p1 = pts[i], p2 = pts[i + 1];
                if (p1.isControlPoint || p2.isControlPoint) continue;
                var dirVec = { dx: p2.x - p1.x, dy: p2.y - p1.y, dz: p2.z - p1.z };
                var len = Math.hypot(dirVec.dx, dirVec.dy, dirVec.dz) || 1;
                var dir = { dx: dirVec.dx / len, dy: dirVec.dy / len, dz: dirVec.dz / len };
                pcfContent += 'PIPE\n';
                pcfContent += '    END-POINT           ' + p1.x.toFixed(2) + ' ' + p1.y.toFixed(2) + ' ' + p1.z.toFixed(2) + '  ' + diamMM.toFixed(2) + '\n';
                pcfContent += '    END-POINT           ' + p2.x.toFixed(2) + ' ' + p2.y.toFixed(2) + ' ' + p2.z.toFixed(2) + '  ' + diamMM.toFixed(2) + '\n';
                pcfContent += '    ENTRY               ' + dir.dx.toFixed(3) + ' ' + dir.dy.toFixed(3) + ' ' + dir.dz.toFixed(3) + '\n';
                pcfContent += '    EXIT                ' + dir.dx.toFixed(3) + ' ' + dir.dy.toFixed(3) + ' ' + dir.dz.toFixed(3) + '\n';
                pcfContent += '    ITEM-CODE           PIPE-' + (line.material || 'PPR') + '-' + line.diameter + 'IN\n';
                pcfContent += '    SKEY                PIPE\n';
                pcfContent += '    FABRICATION-ITEM\n\n';
            }

            // Componentes
            if (line.components && line.components.length) {
                line.components.forEach(function(comp) {
                    var pos = calculateComponentPosition(line, comp.param || 0.5);
                    if (pos) {
                        pcfContent += formatComponentPCF(comp, pos, diamMM, pos.dir) + '\n';
                    }
                });
            }

            pcfContent += '\n';
        });

        var timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
        downloadBlob(pcfContent, projectName + '_PCF_' + timestamp + '.pcf', 'text/plain');
        notify('✅ Archivo PCF exportado correctamente.');
    }

    // ================================================================
    // EXPORTAR JSON (Proyecto completo)
    // ================================================================
    function exportJSON() {
        if (!_core) { notify('Error: Core no inicializado', true); return; }
        var json = _core.exportProject();
        downloadBlob(json, getProjectName() + '_' + new Date().toISOString().slice(0, 10) + '.json', 'application/json');
        notify('📁 Proyecto exportado como JSON.');
    }

    // ================================================================
    // EXPORTAR CSV (BOM)
    // ================================================================
    function exportCSV() {
        if (!_core) { notify('Error: Core no inicializado', true); return; }

        var db = _core.getDb();
        var lines = db.lines || [];
        var equipos = db.equipos || [];
        var items = [];

        equipos.forEach(function(eq) {
            items.push({ tipo: 'EQUIPO', tag: eq.tag, descripcion: (eq.tipo || '') + ' ' + (eq.material || ''), cantidad: 1, unidad: 'Und' });
        });

        var pipeMap = new Map();
        lines.forEach(function(line) {
            var pts = getPoints(line);
            if (!pts || pts.length < 2) return;
            var length = 0;
            for (var i = 0; i < pts.length - 1; i++) length += Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y, pts[i+1].z - pts[i].z);
            var lengthM = length / 1000;
            var key = line.diameter + '"-' + (line.material || 'PPR') + '-' + (line.spec || 'STD');
            if (pipeMap.has(key)) pipeMap.get(key).length += lengthM;
            else pipeMap.set(key, { diametro: line.diameter, material: line.material || 'PPR', spec: line.spec || 'STD', length: lengthM });
        });

        for (var entry of pipeMap.entries()) {
            var data = entry[1];
            items.push({ tipo: 'TUBERIA', tag: '', descripcion: 'Tubo ' + data.material + ' ' + data.diametro + '" ' + data.spec, cantidad: data.length.toFixed(2), unidad: 'm' });
        }

        var compMap = new Map();
        lines.forEach(function(line) {
            if (line.components) {
                line.components.forEach(function(comp) {
                    var key = comp.type + '-' + line.diameter + '"';
                    compMap.set(key, (compMap.get(key) || 0) + 1);
                });
            }
        });
        for (var entry2 of compMap.entries()) {
            var parts = entry2[0].split('-');
            items.push({ tipo: 'COMPONENTE', tag: '', descripcion: parts[0] + ' ' + parts[1], cantidad: entry2[1], unidad: 'Und' });
        }

        var csv = 'Tipo,Tag,Descripción,Cantidad,Unidad\n';
        items.forEach(function(item) {
            csv += item.tipo + ',' + item.tag + ',' + item.descripcion + ',' + item.cantidad + ',' + item.unidad + '\n';
        });

        downloadBlob(csv, 'BOM_' + getProjectName() + '_' + Date.now() + '.csv', 'text/csv;charset=utf-8;');
        notify('✅ BOM exportado correctamente.');
    }

    // ================================================================
    // EXPORTAR MTO (Excel)
    // ================================================================
    function exportMTO() {
        if (!_core) { notify('Error: Core no inicializado', true); return; }
        if (typeof XLSX === 'undefined') { notify('Error: Librería XLSX no disponible', true); return; }

        var equipos = _core.getEquipos();
        var lines = _core.getLines();
        var items = [];

        equipos.forEach(function(eq) {
            if (eq.tipo !== 'colector') items.push([eq.tag, eq.tipo || 'Equipo', 'Und', 1]);
        });

        lines.forEach(function(line) {
            var length = 0;
            var pts = _core.getLinePoints(line);
            if (pts) for (var i = 0; i < pts.length - 1; i++) length += Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y, pts[i+1].z - pts[i].z);
            items.push([line.tag, 'Tubería ' + (line.material || 'PPR') + ' ' + line.diameter + '"', 'm', (length / 1000).toFixed(2)]);
            if (line.components) {
                line.components.forEach(function(comp) {
                    items.push([comp.tag || 'ACC-' + line.tag, comp.type || 'Componente', 'Und', 1]);
                });
            }
        });

        if (items.length === 0) { notify('No hay elementos para exportar.', true); return; }

        var ws = XLSX.utils.aoa_to_sheet([['Tag', 'Descripción', 'Unidad', 'Cantidad'], ...items]);
        var wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'MTO');
        XLSX.writeFile(wb, 'MTO_' + getProjectName() + '_' + Date.now() + '.xlsx');
        notify('✅ MTO exportado correctamente.');
    }

    // ================================================================
    // IMPORTAR JSON
    // ================================================================
    function importJSON(fileContent) {
        if (!_core) { notify('Error: Core no inicializado', true); return; }
        try {
            var state = JSON.parse(fileContent);
            _core.importState(state.data || state);
            notify('✅ Proyecto importado correctamente.');
            // Auto-centrar después de importar
            if (typeof SmartFlowRenderer !== 'undefined' && SmartFlowRenderer.autoCenter) {
                setTimeout(function() { SmartFlowRenderer.autoCenter(); }, 300);
            }
        } catch (e) {
            notify('Error al importar: archivo corrupto.', true);
        }
    }

    function importJSONFromFile() {
        var input = document.createElement('input');
        input.type = 'file'; input.accept = '.json';
        input.onchange = function(e) {
            var file = e.target.files[0];
            if (!file) return;
            var reader = new FileReader();
            reader.onload = function(ev) { importJSON(ev.target.result); };
            reader.readAsText(file);
        };
        input.click();
    }

    // ================================================================
    // IMPORTAR PCF
    // ================================================================
    var skeyToInternal = {
        'TANK': { type: 'equipment', internal: 'tanque_v' },
        'PUMP': { type: 'equipment', internal: 'bomba' },
        'VESS': { type: 'equipment', internal: 'tanque_v' },
        'STRA': { type: 'pipe', internal: 'PIPE' },
        'VALV': { type: 'component', internal: 'GATE_VALVE' },
        'VAGF': { type: 'component', internal: 'GATE_VALVE' },
        'VGLF': { type: 'component', internal: 'GLOBE_VALVE' },
        'VBAL': { type: 'component', internal: 'BALL_VALVE' },
        'VBAF': { type: 'component', internal: 'BUTTERFLY_VALVE' },
        'VCFF': { type: 'component', internal: 'CHECK_VALVE' },
        'ELBW': { type: 'component', internal: 'ELBOW_90_LR' },
        'ELL4': { type: 'component', internal: 'ELBOW_45' },
        'ELLL': { type: 'component', internal: 'ELBOW_90_LR' },
        'ELLS': { type: 'component', internal: 'ELBOW_90_SR' },
        'TEES': { type: 'component', internal: 'TEE_EQUAL' },
        'TEER': { type: 'component', internal: 'TEE_REDUCING' },
        'CROS': { type: 'component', internal: 'CROSS' },
        'FLWN': { type: 'component', internal: 'WELD_NECK_FLANGE' },
        'FLSO': { type: 'component', internal: 'SLIP_ON_FLANGE' },
        'FLBL': { type: 'component', internal: 'BLIND_FLANGE' },
        'CAPF': { type: 'component', internal: 'CAP' },
        'REDC': { type: 'component', internal: 'CONCENTRIC_REDUCER' },
        'REDE': { type: 'component', internal: 'ECCENTRIC_REDUCER' },
        'INSI': { type: 'component', internal: 'PRESSURE_GAUGE' },
        'INPG': { type: 'component', internal: 'PRESSURE_GAUGE' },
        'INTG': { type: 'component', internal: 'TEMPERATURE_GAUGE' },
        'INFM': { type: 'component', internal: 'FLOW_METER' },
        'INLV': { type: 'component', internal: 'LEVEL_SWITCH_RANA' }
    };

    function importPCF(fileContent) {
        if (!_core || !_catalog) { notify('Error: Core o Catálogo no inicializado.', true); return; }

        var lines = fileContent.split('\n');
        var currentLine = null, puntos = [], componentes = [];
        var equiposMap = new Map(), lineasMap = new Map();
        var currentComponent = null;

        function processAccumulatedComponent() {
            if (!currentComponent || !currentComponent.skey) return;
            var mapping = skeyToInternal[currentComponent.skey];
            if (mapping) {
                if (mapping.type === 'equipment') {
                    var pos = currentComponent.pos || {x:0, y:0, z:0};
                    var tag = currentComponent.itemCode || mapping.internal + '_' + (equiposMap.size + 1);
                    if (!equiposMap.has(tag)) {
                        var equipo = _catalog.createEquipment(mapping.internal, tag, pos.x, pos.y, pos.z, {
                            diametro: currentComponent.diameter || 1000,
                            altura: currentComponent.height || 1500,
                            material: currentComponent.material || 'PPR'
                        });
                        if (equipo) { equiposMap.set(tag, equipo); _core.addEquipment(equipo); }
                    }
                } else if (mapping.type === 'component' && currentLine) {
                    componentes.push({
                        type: mapping.internal,
                        tag: currentComponent.itemCode || mapping.internal + '_' + (componentes.length + 1),
                        param: 0.5,
                        description: currentComponent.description,
                        material: currentComponent.material
                    });
                }
            }
            currentComponent = null;
        }

        function finalizeLine() {
            if (currentLine && puntos.length >= 2) {
                if (!currentLine.tag) currentLine.tag = 'L-' + (lineasMap.size + 1);
                currentLine._cachedPoints = puntos;
                currentLine.components = componentes;
                _core.addLine(currentLine);
                var db = _core.getDb();
                var lReg = db.lines.find(function(l) { return l.tag === currentLine.tag; }) || currentLine;
                if (typeof SmartFlowRouter !== 'undefined' && SmartFlowRouter.ensureFittings) {
                    SmartFlowRouter.ensureFittings(lReg, null, null, null, null, lReg.diameter || 4, lReg.material || 'PPR');
                }
                if (_core.updateLine) _core.updateLine(lReg.tag, lReg);
                lineasMap.set(currentLine.tag, lReg);
            }
            currentLine = null; puntos = []; componentes = [];
        }

        for (var li = 0; li < lines.length; li++) {
            var line = lines[li].trim();
            if (line.startsWith('!') || line.length === 0) continue;
            var parts = line.split(/\s+/);
            var firstWord = parts[0];
            var newBlockWords = ['PIPE', 'VALVE', 'TEE', 'TANK', 'PUMP', 'INSTRUMENT', 'ELBOW', 'FLANGE', 'STRA'];

            if (newBlockWords.includes(firstWord)) {
                processAccumulatedComponent();
                if (firstWord === 'PIPE' || firstWord === 'STRA') {
                    finalizeLine();
                    currentLine = { tag: '', diameter: 4, material: 'PPR', spec: 'PPR_PN12_5' };
                    puntos = []; componentes = [];
                } else {
                    currentComponent = { type: firstWord };
                }
                continue;
            }

            if (line.startsWith('END-POINT')) {
                if (parts.length >= 7) {
                    var p1 = { x: parseFloat(parts[1]), y: parseFloat(parts[2]), z: parseFloat(parts[3]) };
                    var p2 = { x: parseFloat(parts[4]), y: parseFloat(parts[5]), z: parseFloat(parts[6]) };
                    var diam = parts.length >= 8 ? parseFloat(parts[7]) : null;
                    if (currentLine) {
                        if (puntos.length === 0) puntos.push(p1);
                        puntos.push(p2);
                        if (diam && !currentLine.diameter) currentLine.diameter = diam / 25.4;
                    }
                    if (currentComponent) { currentComponent.pos = p1; if (diam) currentComponent.diameter = diam; }
                }
            } else if (line.startsWith('PCF_ELEM_SKEY')) {
                var skey = (parts[1] || '').replace(/'/g, '');
                if (currentComponent) currentComponent.skey = skey;
                else if (currentLine) currentLine.skey = skey;
            } else if (line.startsWith('ITEM-CODE')) {
                var code = line.substring(line.indexOf('ITEM-CODE') + 9).trim().replace(/'/g, '');
                if (currentComponent) currentComponent.itemCode = code;
                else if (currentLine) currentLine.tag = code;
            } else if (line.startsWith('DESCRIPTION')) {
                var desc = line.substring(line.indexOf('DESCRIPTION') + 11).trim().replace(/'/g, '');
                if (currentComponent) currentComponent.description = desc;
            } else if (line.startsWith('MATERIAL')) {
                var mat = (parts[1] || '').replace(/'/g, '');
                if (currentComponent) currentComponent.material = mat;
                else if (currentLine) currentLine.material = mat;
            } else if (line.startsWith('HEIGHT')) {
                if (currentComponent) currentComponent.height = parseFloat(parts[1]);
            } else if (line.startsWith('DIAMETER')) {
                if (currentComponent) currentComponent.diameter = parseFloat(parts[1]);
            } else if (line.startsWith('PIPING-SPEC')) {
                var spec = parts.slice(1).join(' ').replace(/'/g, '');
                if (currentLine) currentLine.spec = spec;
            }
        }

        processAccumulatedComponent();
        finalizeLine();
        
        // Auto-centrar después de importar
        if (typeof SmartFlowRenderer !== 'undefined' && SmartFlowRenderer.autoCenter) {
            setTimeout(function() { SmartFlowRenderer.autoCenter(); }, 500);
        }
        
        notify('✅ PCF importado: ' + equiposMap.size + ' equipos, ' + lineasMap.size + ' líneas.');
    }

    function importPCFFromFile() {
        var input = document.createElement('input');
        input.type = 'file'; input.accept = '.pcf,.txt';
        input.onchange = function(e) {
            var file = e.target.files[0];
            if (!file) return;
            var reader = new FileReader();
            reader.onload = function(ev) { importPCF(ev.target.result); };
            reader.readAsText(file);
        };
        input.click();
    }

    // ================================================================
    // GUARDAR / CARGAR PROYECTO (localStorage)
    // ================================================================
    function guardarProyecto() {
        if (!_core) return;
        var state = _core.exportProject();
        localStorage.setItem('smartflow_v3_project', state);
        notify('✅ Proyecto guardado en el navegador.');
    }

    function cargarProyecto() {
        if (!_core) return;
        var data = localStorage.getItem('smartflow_v3_project');
        if (data) {
            try {
                var state = JSON.parse(data);
                _core.importState(state.data || state);
                // Auto-centrar después de cargar
                if (typeof SmartFlowRenderer !== 'undefined' && SmartFlowRenderer.autoCenter) {
                    setTimeout(function() { SmartFlowRenderer.autoCenter(); }, 500);
                }
                notify('✅ Proyecto cargado correctamente.');
            } catch (e) {
                notify('Error al cargar el proyecto.', true);
            }
        } else {
            notify('No hay proyecto guardado.', true);
        }
    }

    function nuevoProyecto() {
        if (!_core) return;
        if (confirm('¿Desea crear un nuevo proyecto? Se perderán los cambios no guardados.')) {
            _core.nuevoProyecto();
            if (typeof SmartFlowRenderer !== 'undefined' && SmartFlowRenderer.autoCenter) {
                setTimeout(function() { SmartFlowRenderer.autoCenter(); }, 300);
            }
            notify('✅ Nuevo proyecto creado.');
        }
    }

    // ================================================================
    // API PÚBLICA
    // ================================================================
    return {
        init: init,
        exportPDF: exportPDF,
        exportPNG: exportPNG,
        exportPCF: exportPCF,
        exportJSON: exportJSON,
        exportCSV: exportCSV,
        exportMTO: exportMTO,
        importJSON: importJSON,
        importJSONFromFile: importJSONFromFile,
        importPCF: importPCF,
        importPCFFromFile: importPCFFromFile,
        guardarProyecto: guardarProyecto,
        cargarProyecto: cargarProyecto,
        nuevoProyecto: nuevoProyecto
    };
})();
```

---

Cambios en index.html

Agrega antes de main.js:

```html
<script src="js/exporter.js"></script>
```

---

Cambios en main.js

En initModules(), agrega después de la inicialización de SmartFlowCommands:

```javascript
// Inicializar el Exportador
if (typeof SmartFlowExporter !== 'undefined') {
    SmartFlowExporter.init(
        SmartFlowCore, 
        SmartFlowRenderer, 
        typeof ThreeJsEngine !== 'undefined' ? ThreeJsEngine : null, 
        SmartFlowCatalog
    );
}
```

Y actualiza los bindings de botones:

```javascript
// Reemplazar los bindings existentes por:
vincular('btnSave', function() { SmartFlowExporter.guardarProyecto(); });
vincular('btnOpen', function() { 
    SmartFlowExporter.cargarProyecto(); 
    if (welcomePanel) welcomePanel.classList.add('welcome-hidden');
});
vincular('btnExportProject', function() { SmartFlowExporter.exportJSON(); });
vincular('btnImportProject', function() { SmartFlowExporter.importJSONFromFile(); });
vincular('btnMTO', function() { SmartFlowExporter.exportMTO(); });
vincular('btnPDF', function() { SmartFlowExporter.exportPDF(); });
vincular('btnExportPCF', function() { SmartFlowExporter.exportPCF(); });
vincular('btnImportPCF', function() { SmartFlowExporter.importPCFFromFile(); });
