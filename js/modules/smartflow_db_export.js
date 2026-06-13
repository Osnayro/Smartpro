// ============================================================
// SMARTFLOW DB EXPORT v2.0 - Base de Datos Completa en Excel
// Archivo: js/modules/smartflow_db_export.js
// Dependencias: SmartFlowCore v5.6+, SmartFlowIO v1.0, XLSX (SheetJS)
// Estándares: Aveva E3D, SmartPlant 3D, AutoCAD Plant 3D, ISOGEN
// ============================================================

const SmartFlowDBExport = (function() {
    
    let _core = null;
    let _io = null;
    let _notify = (msg, isErr) => console.log(msg);
    
    // ================================================================
    //  CONFIGURACIÓN DEL PROYECTO
    // ================================================================
    const PROJECT_DEFAULTS = {
        designCode: 'ASME B31.3',
        unitsSystem: 'METRIC',
        defaultSpec: 'A1A',
        defaultMaterial: 'CS',
        boltSpec: 'A193_B7/A194_2H',
        gasketSpec: 'SPIRAL_WOUND_316L/GRAPHITE'
    };
    
    // ================================================================
    //  SKEYs ESTÁNDAR ISOGEN (para catálogo)
    // ================================================================
    const SKEY_CATALOG = {
        'PIPE':                     { skey: 'PIPE', symbol: 'PIPE', category: 'PIPE', endPrep: 'BW', description: 'Tubería recta' },
        'ELBOW_90_LR':              { skey: 'ELBW', symbol: 'ELLL', category: 'ELBOW', endPrep: 'BW', description: 'Codo 90° Long Radius' },
        'ELBOW_90_SR':              { skey: 'ELBS', symbol: 'ELLS', category: 'ELBOW', endPrep: 'BW', description: 'Codo 90° Short Radius' },
        'ELBOW_45':                 { skey: 'ELBW', symbol: 'ELL4', category: 'ELBOW', endPrep: 'BW', description: 'Codo 45°' },
        'ELBOW_90_PPR':             { skey: 'ELBW', symbol: 'ELLL', category: 'ELBOW', endPrep: 'PE', description: 'Codo 90° PPR' },
        'ELBOW_45_PPR':             { skey: 'ELBW', symbol: 'ELL4', category: 'ELBOW', endPrep: 'PE', description: 'Codo 45° PPR' },
        'TEE_EQUAL':                { skey: 'TEES', symbol: 'TEES', category: 'TEE', endPrep: 'BW', description: 'Tee Recta Igual' },
        'TEE_REDUCING':             { skey: 'TEER', symbol: 'TEER', category: 'TEE', endPrep: 'BW', description: 'Tee Reductora' },
        'CROSS':                    { skey: 'CROS', symbol: 'CROS', category: 'TEE', endPrep: 'BW', description: 'Cruz' },
        'CONCENTRIC_REDUCER':       { skey: 'RECN', symbol: 'RECN', category: 'REDUCER', endPrep: 'BW', description: 'Reductor Concéntrico' },
        'ECCENTRIC_REDUCER':        { skey: 'REEC', symbol: 'REEC', category: 'REDUCER', endPrep: 'BW', description: 'Reductor Excéntrico' },
        'WELD_NECK_FLANGE':         { skey: 'FLWN', symbol: 'FLWN', category: 'FLANGE', endPrep: 'BW', description: 'Brida Weld Neck' },
        'SLIP_ON_FLANGE':           { skey: 'FLSO', symbol: 'FLSO', category: 'FLANGE', endPrep: 'SW', description: 'Brida Slip-On' },
        'BLIND_FLANGE':             { skey: 'FLBL', symbol: 'FLBL', category: 'FLANGE', endPrep: 'FLG', description: 'Brida Ciega' },
        'LOOSE_FLANGE':             { skey: 'FLLJ', symbol: 'FLLJ', category: 'FLANGE', endPrep: 'FLG', description: 'Brida Loca' },
        'GATE_VALVE':               { skey: 'VAGF', symbol: 'VAGF', category: 'VALVE', endPrep: 'FLG', description: 'Válvula Compuerta' },
        'GLOBE_VALVE':              { skey: 'VGLF', symbol: 'VGLF', category: 'VALVE', endPrep: 'FLG', description: 'Válvula Globo' },
        'BALL_VALVE':               { skey: 'VBAL', symbol: 'VBAL', category: 'VALVE', endPrep: 'FLG', description: 'Válvula Bola' },
        'BUTTERFLY_VALVE':          { skey: 'VBAF', symbol: 'VBAF', category: 'VALVE', endPrep: 'FLG', description: 'Válvula Mariposa' },
        'CHECK_VALVE':              { skey: 'VCFF', symbol: 'VCFF', category: 'VALVE', endPrep: 'FLG', description: 'Válvula Check' },
        'SAFETY_VALVE':             { skey: 'VSFT', symbol: 'VSFT', category: 'VALVE', endPrep: 'FLG', description: 'Válvula de Seguridad' },
        'CAP':                      { skey: 'CAPF', symbol: 'CAPF', category: 'FITTING', endPrep: 'BW', description: 'Tapón' },
        'Y_STRAINER':               { skey: 'STRY', symbol: 'STRY', category: 'STRAINER', endPrep: 'FLG', description: 'Filtro Y' },
        'PRESSURE_GAUGE':           { skey: 'INPG', symbol: 'INPG', category: 'INSTRUMENT', endPrep: 'THR', description: 'Manómetro' },
        'TEMPERATURE_GAUGE':        { skey: 'INTG', symbol: 'INTG', category: 'INSTRUMENT', endPrep: 'THR', description: 'Termómetro' },
        'FLOW_METER':               { skey: 'INFM', symbol: 'INFM', category: 'INSTRUMENT', endPrep: 'FLG', description: 'Medidor de Flujo' },
        'LEVEL_SWITCH_RANA':        { skey: 'INSLS', symbol: 'INSLS', category: 'INSTRUMENT', endPrep: 'FLG', description: 'Switch de Nivel' },
        'UNION':                    { skey: 'UNIO', symbol: 'UNIO', category: 'FITTING', endPrep: 'THR', description: 'Unión Roscada' },
        'PIPE_SHOE':                { skey: 'SHOE', symbol: 'SHOE', category: 'SUPPORT', endPrep: 'N/A', description: 'Soporte Pipe Shoe' },
        'TRANSITION':               { skey: 'TRAN', symbol: 'TRAN', category: 'FITTING', endPrep: 'BW', description: 'Transición' }
    };
    
    // ================================================================
    //  DIRECCIONES CARDINALES
    // ================================================================
    function getCardinalDirection(dx, dy, dz) {
        const absDx = Math.abs(dx), absDy = Math.abs(dy), absDz = Math.abs(dz);
        if (absDy > absDx && absDy > absDz) return dy > 0 ? 'UP' : 'DN';
        if (absDx > absDz) return dx > 0 ? 'E' : 'W';
        return dz > 0 ? 'S' : 'N';
    }
    
    function getSlope(dx, dy, dz) {
        const horizontal = Math.hypot(dx, dz);
        if (horizontal < 0.01) return 'VERTICAL';
        const slopePercent = Math.abs(dy) / horizontal;
        if (slopePercent < 0.001) return 'HORIZONTAL';
        return '1:' + (1 / slopePercent).toFixed(0);
    }
    
    // ================================================================
    //  UTILIDADES GEOMÉTRICAS
    // ================================================================
    function getLinePoints(line) {
        if (_core && typeof _core.getLinePoints === 'function') return _core.getLinePoints(line) || [];
        return line._cachedPoints || line.points3D || line.points || [];
    }
    
    function getNozzleWorldPosition(equipo, nozzleId) {
        if (!equipo || !equipo.puertos) return null;
        const nozzle = equipo.puertos.find(p => p.id === nozzleId);
        if (!nozzle) return null;
        return {
            x: (equipo.posX || 0) + (nozzle.relX || 0),
            y: (equipo.posY || 0) + (nozzle.relY || 0),
            z: (equipo.posZ || 0) + (nozzle.relZ || 0),
            orientacion: nozzle.orientacion || { dx: 1, dy: 0, dz: 0 },
            diametro: nozzle.diametro || equipo.diametro || 4
        };
    }
    
    function getDirection(p1, p2) {
        const dx = p2.x - p1.x, dy = p2.y - p1.y, dz = p2.z - p1.z;
        const len = Math.sqrt(dx*dx + dy*dy + dz*dz) || 1;
        return { dx: dx/len, dy: dy/len, dz: dz/len };
    }
    
    function getParametricPoint(line, param) {
        const pts = getLinePoints(line);
        if (!pts || pts.length < 2) return null;
        let totalLen = 0;
        const lengths = [];
        for (let i = 0; i < pts.length - 1; i++) {
            const d = Math.hypot(pts[i+1].x-pts[i].x, pts[i+1].y-pts[i].y, pts[i+1].z-pts[i].z);
            lengths.push(d);
            totalLen += d;
        }
        if (totalLen === 0) return pts[0];
        const target = totalLen * Math.max(0, Math.min(1, param));
        let accum = 0;
        for (let i = 0; i < lengths.length; i++) {
            if (accum + lengths[i] >= target || i === lengths.length - 1) {
                const t = lengths[i] > 0 ? (target - accum) / lengths[i] : 0;
                return {
                    x: pts[i].x + (pts[i+1].x - pts[i].x) * t,
                    y: pts[i].y + (pts[i+1].y - pts[i].y) * t,
                    z: pts[i].z + (pts[i+1].z - pts[i].z) * t
                };
            }
            accum += lengths[i];
        }
        return pts[pts.length-1];
    }
    
    // ================================================================
    //  HOJA 1: DATOS_PROYECTO
    // ================================================================
    function buildProyectoSheet() {
        const db = _core ? _core.getDb() : {};
        const headers = ['CAMPO', 'VALOR', 'UNIDAD'];
        const rows = [headers];
        
        const data = [
            ['PROJECT_ID', db.projectId || '', ''],
            ['PROJECT_NAME', db.projectName || window.currentProjectName || 'Sin nombre', ''],
            ['CLIENT_NAME', db.clientName || '', ''],
            ['PLANT_LOCATION', db.plantLocation || '', ''],
            ['UNITS_SYSTEM', PROJECT_DEFAULTS.unitsSystem, ''],
            ['DESIGN_CODE', PROJECT_DEFAULTS.designCode, ''],
            ['DATUM_ELEVATION', '0', 'mm'],
            ['DATUM_NORTH', '0', 'mm'],
            ['DATUM_EAST', '0', 'mm'],
            ['PIPING_MATERIAL_DEFAULT', PROJECT_DEFAULTS.defaultMaterial, ''],
            ['PIPE_CLASS_DEFAULT', PROJECT_DEFAULTS.defaultSpec, ''],
            ['BOLT_SPEC', PROJECT_DEFAULTS.boltSpec, ''],
            ['GASKET_SPEC', PROJECT_DEFAULTS.gasketSpec, ''],
            ['TOTAL_EQUIPOS', _core ? _core.getEquipos().length : 0, 'und'],
            ['TOTAL_LINEAS', _core ? _core.getLines().length : 0, 'und'],
            ['FECHA_EXPORTACION', new Date().toISOString(), ''],
            ['VERSION_SMARTFLOW', 'v2.18', ''],
            ['INGENIERO_RESPONSABLE', 'Ing. Osnay Romero', ''],
            ['EMPRESA', 'AcQuaBlue International Corp.', '']
        ];
        
        data.forEach(row => rows.push(row));
        return rows;
    }
    
    // ================================================================
    //  HOJA 2: EQUIPOS
    // ================================================================
    function buildEquiposSheet() {
        if (!_core) return [];
        const equipos = _core.getEquipos();
        
        const headers = [
            'EQUIPMENT_TAG', 'EQUIPMENT_TYPE', 'DESCRIPTION',
            'POS_X (mm)', 'POS_Y (mm)', 'POS_Z (mm)',
            'CENTER_ELEVATION (m)', 'BASE_ELEVATION (m)', 'TOP_ELEVATION (m)',
            'DIAMETER (mm)', 'HEIGHT (mm)', 'LENGTH (mm)', 'WIDTH (mm)',
            'MATERIAL', 'PIPE_CLASS',
            'EMPTY_WEIGHT (kg)', 'OPERATING_WEIGHT (kg)',
            'MANUFACTURER', 'SERIAL_NUMBER',
            'DESIGN_PRESSURE (bar)', 'DESIGN_TEMPERATURE (°C)',
            'STATUS'
        ];
        
        const rows = [headers];
        
        for (const eq of equipos) {
            const altura = eq.altura || 0;
            rows.push([
                eq.tag || '',
                eq.tipo || '',
                eq.tipo || '',
                (eq.posX || 0).toFixed(1),
                (eq.posY || 0).toFixed(1),
                (eq.posZ || 0).toFixed(1),
                ((eq.posY || 0) / 1000).toFixed(3),
                (((eq.posY || 0) - altura/2) / 1000).toFixed(3),
                (((eq.posY || 0) + altura/2) / 1000).toFixed(3),
                eq.diametro || '',
                eq.altura || '',
                eq.largo || '',
                eq.ancho || '',
                eq.material || '',
                eq.spec || '',
                '', '', '', '',
                '', '',
                'ACTIVE'
            ]);
        }
        return rows;
    }
    
    // ================================================================
    //  HOJA 3: BOQUILLAS
    // ================================================================
    function buildBoquillasSheet() {
        if (!_core) return [];
        const equipos = _core.getEquipos();
        
        const headers = [
            'NOZZLE_GUID', 'EQUIPMENT_TAG', 'NOZZLE_ID', 'NOZZLE_SERVICE',
            'NOMINAL_DIAMETER (in)', 'WALL_THICKNESS (mm)',
            'FLANGE_STANDARD', 'FLANGE_RATING', 'FLANGE_FACING', 'FLANGE_SIZE (in)',
            'POS_X (mm)', 'POS_Y (mm)', 'POS_Z (mm)',
            'ELEVATION_FROM_DATUM (m)',
            'DIR_X', 'DIR_Y', 'DIR_Z',
            'ORIENTATION_CARDINAL', 'AZIMUTH_ANGLE (°)',
            'NOZZLE_LENGTH (mm)', 'NOZZLE_PROJECTION (mm)',
            'PAD_REINFORCEMENT', 'LINER_REQUIRED',
            'MATING_LINE', 'STATUS'
        ];
        
        const rows = [headers];
        
        for (const eq of equipos) {
            if (!eq.puertos) continue;
            for (const p of eq.puertos) {
                const absPos = getNozzleWorldPosition(eq, p.id);
                if (!absPos) continue;
                
                const ori = p.orientacion || { dx: 1, dy: 0, dz: 0 };
                const cardinal = getCardinalDirection(ori.dx, ori.dy, ori.dz);
                
                // Calcular azimuth (ángulo horizontal desde Norte)
                let azimuth = 0;
                if (Math.abs(ori.dy) < 0.9) {
                    azimuth = Math.atan2(ori.dx, -ori.dz) * 180 / Math.PI;
                    if (azimuth < 0) azimuth += 360;
                }
                
                const connectedLine = p.connectedTo ? p.connectedTo.tag : (p.connectedLine || '');
                const status = p.status === 'open' ? 'OPEN' : (connectedLine ? 'CONNECTED' : 'BLINDED');
                
                rows.push([
                    eq.tag + ':' + p.id,
                    eq.tag, p.id,
                    p.service || '',
                    p.diametro || '',
                    '', // Wall thickness
                    'ASME B16.5', '150#', 'RF', '', // Flange data
                    absPos.x.toFixed(1), absPos.y.toFixed(1), absPos.z.toFixed(1),
                    (absPos.y / 1000).toFixed(3),
                    ori.dx.toFixed(4), ori.dy.toFixed(4), ori.dz.toFixed(4),
                    cardinal,
                    cardinal === 'UP' || cardinal === 'DN' ? '' : azimuth.toFixed(1),
                    '', // Nozzle length
                    '', // Projection
                    'NO', 'NO',
                    connectedLine,
                    status
                ]);
            }
        }
        return rows;
    }
    
    // ================================================================
    //  HOJA 4: LINEAS (Line List)
    // ================================================================
    function buildLineasSheet() {
        if (!_core) return [];
        const lines = _core.getLines();
        
        const headers = [
            'LINE_ID', 'PIPELINE_REFERENCE',
            'NOMINAL_DIAMETER (in)', 'NOMINAL_DIAMETER (mm)',
            'PIPE_CLASS', 'PIPING_MATERIAL', 'CORROSION_ALLOWANCE (mm)',
            'FLUID_CODE', 'SERVICE_DESCRIPTION',
            'INSULATION_TYPE', 'INSULATION_THICKNESS (mm)',
            'HEAT_TRACING', 'PAINTING_SPEC',
            'DESIGN_PRESSURE (bar)', 'DESIGN_TEMPERATURE (°C)',
            'HYDROTEST_PRESSURE (bar)',
            'FROM_TAG', 'FROM_NOZZLE', 'FROM_TYPE',
            'TO_TAG', 'TO_NOZZLE', 'TO_TYPE',
            'TOTAL_LENGTH (m)',
            'NDE_REQUIREMENT', 'PWHT_REQUIRED',
            'CRITICAL_LINE', 'STRESS_ANALYSIS',
            'REVISION', 'STATUS'
        ];
        
        const rows = [headers];
        
        for (const line of lines) {
            const pts = getLinePoints(line);
            let totalLen = 0;
            if (pts && pts.length >= 2) {
                for (let i = 0; i < pts.length - 1; i++) {
                    totalLen += Math.hypot(pts[i+1].x-pts[i].x, pts[i+1].y-pts[i].y, pts[i+1].z-pts[i].z);
                }
            }
            
            const fromTag = line.origin ? (line.origin.equipTag || line.origin.objTag || '') : '';
            const fromNozzle = line.origin ? (line.origin.portId || '') : '';
            const fromType = line.origin ? (line.origin.objType || 'EQUIPMENT') : '';
            const toTag = line.destination ? (line.destination.equipTag || line.destination.objTag || '') : '';
            const toNozzle = line.destination ? (line.destination.portId || '') : '';
            const toType = line.destination ? (line.destination.objType || 'EQUIPMENT') : '';
            
            rows.push([
                line.tag, line.tag,
                line.diameter || '', Math.round((line.diameter || 4) * 25.4),
                line.spec || '', line.material || '', '',
                '', '', // Fluido y servicio
                line.insulation || '', '',
                line.tracing || '', '',
                '', '', '', // Presión, temperatura, hidrotest
                fromTag, fromNozzle, fromType,
                toTag, toNozzle, toType,
                (totalLen / 1000).toFixed(2),
                '', 'NO',
                'NO', 'NO',
                line.revision || '0', 'ACTIVE'
            ]);
        }
        return rows;
    }
    
    // ================================================================
    //  HOJA 5: CATALOGO_SKEY
    // ================================================================
    function buildCatalogoSKEYSheet() {
        const headers = [
            'COMPONENT_CODE', 'COMPONENT_TYPE', 'COMPONENT_SUBTYPE',
            'DESCRIPTION',
            'SKEY', 'ISOGEN_SYMBOL', 'ISOGEN_CATEGORY',
            'BORE_SIZE (in)',
            'DIMENSION_STANDARD', 'END_PREPARATION', 'CONNECTION_TYPE',
            'PRESSURE_CLASS', 'MATERIAL_GRADE',
            'WEIGHT (kg)', 'WEIGHT_UNIT',
            'SHOP_FIELD', 'MTO_CATEGORY',
            'GASKET_REQUIRED', 'BOLT_SET_REQUIRED'
        ];
        
        const rows = [headers];
        
        for (const [compType, data] of Object.entries(SKEY_CATALOG)) {
            rows.push([
                compType, data.category, compType,
                data.description,
                data.skey, data.symbol, data.category,
                '', // Bore size (variable)
                '', // Dimension standard (variable según spec)
                data.endPrep, data.endPrep === 'BW' ? 'BUTT_WELD' : (data.endPrep === 'FLG' ? 'FLANGED' : 'THREADED'),
                '', // Pressure class
                '', // Material grade
                '', 'KG',
                data.category === 'VALVE' ? 'SHOP' : 'BOTH',
                data.category,
                data.category === 'FLANGE' ? 'YES' : 'NO',
                data.category === 'FLANGE' ? 'YES' : 'NO'
            ]);
        }
        return rows;
    }
    
    // ================================================================
    //  HOJA 6: RUTEO_ISOMETRICO
    // ================================================================
    function buildRuteoSheet() {
        if (!_core) return [];
        const lines = _core.getLines();
        
        const headers = [
            'LINE_TAG', 'SEQUENCE', 'COMPONENT_CODE', 'SKEY',
            'START_X (mm)', 'START_Y (mm)', 'START_Z (mm)',
            'END_X (mm)', 'END_Y (mm)', 'END_Z (mm)',
            'DELTA_X (mm)', 'DELTA_Y (mm)', 'DELTA_Z (mm)',
            'LENGTH (mm)', 'VECTOR_X', 'VECTOR_Y', 'VECTOR_Z',
            'DIRECTION', 'SLOPE', 'ANGLE_CHANGE (°)', 'BEND_RADIUS (mm)',
            'ITEM_CODE', 'FABRICATION_ITEM', 'SPOOL_ID', 'WELD_ID',
            'FIT_POINT', 'SUPPORT_REQUIRED'
        ];
        
        const rows = [headers];
        let sequence = 0;
        
        for (const line of lines) {
            const pts = getLinePoints(line);
            if (!pts || pts.length < 2) continue;
            
            let seqLocal = 1;
            let accumulated = 0;
            let itemCounter = 0;
            
            for (let i = 0; i < pts.length - 1; i++) {
                const p1 = pts[i], p2 = pts[i+1];
                if (p1.isControlPoint || p2.isControlPoint) continue;
                
                const segLen = Math.hypot(p2.x-p1.x, p2.y-p1.y, p2.z-p1.z);
                if (segLen < 1) continue;
                
                const dir = getDirection(p1, p2);
                const cardinal = getCardinalDirection(dir.dx, dir.dy, dir.dz);
                const slope = getSlope(dir.dx, dir.dy, dir.dz);
                
                itemCounter++;
                accumulated += segLen;
                
                rows.push([
                    line.tag, seqLocal, 'PIPE', 'PIPE',
                    p1.x.toFixed(1), p1.y.toFixed(1), p1.z.toFixed(1),
                    p2.x.toFixed(1), p2.y.toFixed(1), p2.z.toFixed(1),
                    (p2.x-p1.x).toFixed(1), (p2.y-p1.y).toFixed(1), (p2.z-p1.z).toFixed(1),
                    segLen.toFixed(1),
                    dir.dx.toFixed(4), dir.dy.toFixed(4), dir.dz.toFixed(4),
                    cardinal, slope, '', '',
                    'PIPE-' + itemCounter, 'SHOP', '', '',
                    'NO', 'NO'
                ]);
                
                seqLocal++;
                
                // Verificar codo entre segmentos
                if (i < pts.length - 2) {
                    const p3 = pts[i+2];
                    if (!p3.isControlPoint) {
                        const dir1 = getDirection(p1, p2);
                        const dir2 = getDirection(p2, p3);
                        const dot = dir1.dx*dir2.dx + dir1.dy*dir2.dy + dir1.dz*dir2.dz;
                        const angle = Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI;
                        
                        if (angle > 0.5) {
                            itemCounter++;
                            const bendRadius = ((line.diameter || 4) * 25.4 * 1.5).toFixed(1);
                            
                            rows.push([
                                line.tag, seqLocal, 'ELBOW_90_LR', 'ELBW',
                                p2.x.toFixed(1), p2.y.toFixed(1), p2.z.toFixed(1),
                                p2.x.toFixed(1), p2.y.toFixed(1), p2.z.toFixed(1),
                                '', '', '', '',
                                '', '', '',
                                cardinal, '', angle.toFixed(1), bendRadius,
                                'ELBOW-' + itemCounter, 'SHOP', '', '',
                                'NO', 'NO'
                            ]);
                            seqLocal++;
                        }
                    }
                }
            }
            
            // Componentes insertados en la línea
            if (line.components && line.components.length > 0) {
                const sorted = [...line.components].sort((a, b) => (a.param || 0) - (b.param || 0));
                
                for (const comp of sorted) {
                    const pos = getParametricPoint(line, comp.param || 0.5);
                    if (!pos) continue;
                    
                    const skeyInfo = SKEY_CATALOG[comp.type] || { skey: 'MISC', category: 'MISC' };
                    itemCounter++;
                    
                    rows.push([
                        line.tag, seqLocal, comp.type, skeyInfo.skey,
                        pos.x.toFixed(1), pos.y.toFixed(1), pos.z.toFixed(1),
                        pos.x.toFixed(1), pos.y.toFixed(1), pos.z.toFixed(1),
                        '', '', '', '',
                        '', '', '',
                        '', '', '', '',
                        comp.tag || (comp.type + '-' + itemCounter),
                        'SHOP', '', '',
                        'NO', 'NO'
                    ]);
                    seqLocal++;
                    
                    // STUB_END + LOOSE_FLANGE
                    if (comp.type === 'STUB_END' || comp.type === 'STUB_END_PPR' || comp.type === 'STUB_END_HDPE') {
                        itemCounter++;
                        rows.push([
                            line.tag, seqLocal, 'LOOSE_FLANGE', 'FLLJ',
                            pos.x.toFixed(1), pos.y.toFixed(1), pos.z.toFixed(1),
                            pos.x.toFixed(1), pos.y.toFixed(1), pos.z.toFixed(1),
                            '', '', '', '',
                            '', '', '',
                            '', '', '', '',
                            'BL-' + (comp.tag || 'STUB'),
                            'SHOP', '', '',
                            'NO', 'NO'
                        ]);
                        seqLocal++;
                    }
                }
            }
            
            sequence += seqLocal;
        }
        return rows;
    }
    
    // ================================================================
    //  HOJA 7: COMPONENTES (Schedule detallado)
    // ================================================================
    function buildComponentesSheet() {
        if (!_core) return [];
        const lines = _core.getLines();
        
        const headers = [
            'LINE_TAG', 'COMPONENT_TAG', 'COMPONENT_TYPE', 'COMPONENT_SUBTYPE',
            'NOMINAL_DIAMETER (in)', 'MATERIAL', 'PIPE_CLASS',
            'PARAMETRIC_POS (0-1)',
            'POS_X (mm)', 'POS_Y (mm)', 'POS_Z (mm)', 'ELEVATION (m)',
            'DIR_X', 'DIR_Y', 'DIR_Z', 'DIRECTION',
            'SKEY', 'DIMENSION_STANDARD', 'PRESSURE_CLASS',
            'WEIGHT (kg)', 'DESCRIPTION',
            'SUPPLIER_CODE', 'PROCUREMENT_STATUS'
        ];
        
        const rows = [headers];
        
        for (const line of lines) {
            if (!line.components) continue;
            
            for (const comp of line.components) {
                const pos = getParametricPoint(line, comp.param || 0.5);
                if (!pos) continue;
                
                const skeyInfo = SKEY_CATALOG[comp.type] || {};
                const pts = getLinePoints(line);
                let dir = { dx: 1, dy: 0, dz: 0 };
                
                if (pts && pts.length >= 2) {
                    let minDist = Infinity;
                    for (let i = 0; i < pts.length - 1; i++) {
                        const mid = {
                            x: (pts[i].x + pts[i+1].x) / 2,
                            y: (pts[i].y + pts[i+1].y) / 2,
                            z: (pts[i].z + pts[i+1].z) / 2
                        };
                        const dist = Math.hypot(pos.x-mid.x, pos.y-mid.y, pos.z-mid.z);
                        if (dist < minDist) {
                            minDist = dist;
                            dir = getDirection(pts[i], pts[i+1]);
                        }
                    }
                }
                
                rows.push([
                    line.tag, comp.tag || '',
                    comp.type || '', '',
                    comp.diameter || line.diameter || '',
                    comp.material || line.material || '',
                    line.spec || '',
                    (comp.param || 0).toFixed(4),
                    pos.x.toFixed(1), pos.y.toFixed(1), pos.z.toFixed(1),
                    (pos.y / 1000).toFixed(3),
                    dir.dx.toFixed(4), dir.dy.toFixed(4), dir.dz.toFixed(4),
                    getCardinalDirection(dir.dx, dir.dy, dir.dz),
                    skeyInfo.skey || '', '', '',
                    '', comp.description || comp.type || '',
                    '', ''
                ]);
            }
        }
        return rows;
    }
    
    // ================================================================
    //  HOJA 8: MTO (Material Take-Off)
    // ================================================================
    function buildMTOSheet() {
        if (!_core) return [];
        const lines = _core.getLines();
        
        const headers = [
            'LINE_TAG', 'ITEM', 'QUANTITY', 'UOM',
            'DESCRIPTION', 'COMPONENT_TYPE',
            'NOMINAL_DIAMETER (in)', 'PIPE_CLASS', 'MATERIAL',
            'DIMENSION_STANDARD', 'CONNECTION_TYPE',
            'UNIT_WEIGHT (kg)', 'TOTAL_WEIGHT (kg)',
            'JOINTS_ESTIMATED',
            'MTO_CATEGORY', 'SHOP_FIELD'
        ];
        
        const rows = [headers];
        
        for (const line of lines) {
            if (typeof _core.getSpoolReport !== 'function') continue;
            
            const spool = _core.getSpoolReport(line.tag);
            if (!spool || !spool.bomItems) continue;
            
            for (const item of spool.bomItems) {
                rows.push([
                    line.tag, item.item, item.qty, item.unit,
                    item.desc, '',
                    line.diameter || '', line.spec || '', line.material || '',
                    spool.fittingNorm || '', spool.connectionType || '',
                    '', '', spool.juntasEstimadas || 0,
                    '', ''
                ]);
            }
        }
        return rows;
    }
    
    // ================================================================
    //  HOJA 9: CONEXIONES (Origen-Destino)
    // ================================================================
    function buildConexionesSheet() {
        if (!_core) return [];
        const lines = _core.getLines();
        
        const headers = [
            'LINE_TAG', 'NOMINAL_DIAMETER (in)',
            'FROM_TAG', 'FROM_NOZZLE', 'FROM_TYPE',
            'FROM_X (mm)', 'FROM_Y (mm)', 'FROM_Z (mm)', 'FROM_ELEVATION (m)',
            'TO_TAG', 'TO_NOZZLE', 'TO_TYPE',
            'TO_X (mm)', 'TO_Y (mm)', 'TO_Z (mm)', 'TO_ELEVATION (m)',
            'DISTANCE_3D (mm)', 'DISTANCE_HORIZONTAL (mm)',
            'DELTA_X (mm)', 'DELTA_Y (mm)', 'DELTA_Z (mm)',
            'DIRECTION_VECTOR_X', 'DIRECTION_VECTOR_Y', 'DIRECTION_VECTOR_Z'
        ];
        
        const rows = [headers];
        
        for (const line of lines) {
            let fx = '', fy = '', fz = '', felev = '';
            let tx = '', ty = '', tz = '', telev = '';
            let fromType = '', toType = '';
            let dist3D = '', distH = '', dx = '', dy = '', dz = '';
            let dvx = '', dvy = '', dvz = '';
            
            if (line.origin && line.origin.objTag) {
                const obj = _core.findObjectByTag(line.origin.objTag);
                if (obj) {
                    const pos = getNozzleWorldPosition(obj, line.origin.portId);
                    if (pos) {
                        fx = pos.x.toFixed(1); fy = pos.y.toFixed(1); fz = pos.z.toFixed(1);
                        felev = (pos.y / 1000).toFixed(3);
                    }
                    fromType = obj.posX !== undefined ? 'EQUIPMENT' : 'LINE';
                }
            }
            
            if (line.destination && line.destination.objTag) {
                const obj = _core.findObjectByTag(line.destination.objTag);
                if (obj) {
                    const pos = getNozzleWorldPosition(obj, line.destination.portId);
                    if (pos) {
                        tx = pos.x.toFixed(1); ty = pos.y.toFixed(1); tz = pos.z.toFixed(1);
                        telev = (pos.y / 1000).toFixed(3);
                    }
                    toType = obj.posX !== undefined ? 'EQUIPMENT' : 'LINE';
                }
            }
            
            if (fx && tx) {
                dx = (parseFloat(tx) - parseFloat(fx)).toFixed(1);
                dy = (parseFloat(ty) - parseFloat(fy)).toFixed(1);
                dz = (parseFloat(tz) - parseFloat(fz)).toFixed(1);
                dist3D = Math.hypot(parseFloat(dx), parseFloat(dy), parseFloat(dz)).toFixed(1);
                distH = Math.hypot(parseFloat(dx), parseFloat(dz)).toFixed(1);
                
                const dirVec = getDirection(
                    { x: parseFloat(fx), y: parseFloat(fy), z: parseFloat(fz) },
                    { x: parseFloat(tx), y: parseFloat(ty), z: parseFloat(tz) }
                );
                dvx = dirVec.dx.toFixed(4);
                dvy = dirVec.dy.toFixed(4);
                dvz = dirVec.dz.toFixed(4);
            }
            
            rows.push([
                line.tag, line.diameter || '',
                line.origin ? (line.origin.equipTag || line.origin.objTag || '') : '',
                line.origin ? (line.origin.portId || '') : '',
                fromType,
                fx, fy, fz, felev,
                line.destination ? (line.destination.equipTag || line.destination.objTag || '') : '',
                line.destination ? (line.destination.portId || '') : '',
                toType,
                tx, ty, tz, telev,
                dist3D, distH, dx, dy, dz,
                dvx, dvy, dvz
            ]);
        }
        return rows;
    }
    
    // ================================================================
    //  HOJA 10: SOLDADURAS
    // ================================================================
    function buildSoldadurasSheet() {
        if (!_core) return [];
        const lines = _core.getLines();
        
        const headers = [
            'WELD_ID', 'LINE_TAG', 'WELD_TYPE',
            'POS_X (mm)', 'POS_Y (mm)', 'POS_Z (mm)', 'ELEVATION (m)',
            'WELD_SIZE (mm)', 'NDE_REQUIRED', 'PWHT_REQUIRED',
            'SHOP_FIELD', 'WELD_PROCEDURE', 'STATUS'
        ];
        
        const rows = [headers];
        let weldCounter = 1;
        
        for (const line of lines) {
            const pts = getLinePoints(line);
            if (!pts || pts.length < 2) continue;
            
            // Soldadura al inicio
            rows.push([
                'W-' + String(weldCounter).padStart(4, '0'),
                line.tag, 'BW',
                pts[0].x.toFixed(1), pts[0].y.toFixed(1), pts[0].z.toFixed(1),
                (pts[0].y / 1000).toFixed(3),
                Math.round((line.diameter || 4) * 25.4),
                '', 'NO', 'FIELD', '', 'PENDING'
            ]);
            weldCounter++;
            
            // Soldaduras entre segmentos
            for (let i = 1; i < pts.length - 1; i++) {
                rows.push([
                    'W-' + String(weldCounter).padStart(4, '0'),
                    line.tag, 'BW',
                    pts[i].x.toFixed(1), pts[i].y.toFixed(1), pts[i].z.toFixed(1),
                    (pts[i].y / 1000).toFixed(3),
                    Math.round((line.diameter || 4) * 25.4),
                    '', 'NO', 'SHOP', '', 'PENDING'
                ]);
                weldCounter++;
            }
            
            // Soldadura al final
            rows.push([
                'W-' + String(weldCounter).padStart(4, '0'),
                line.tag, 'BW',
                pts[pts.length-1].x.toFixed(1), pts[pts.length-1].y.toFixed(1), pts[pts.length-1].z.toFixed(1),
                (pts[pts.length-1].y / 1000).toFixed(3),
                Math.round((line.diameter || 4) * 25.4),
                '', 'NO', 'FIELD', '', 'PENDING'
            ]);
            weldCounter++;
        }
        return rows;
    }
    
    // ================================================================
    //  HOJA 11: ESPECIFICACIONES
    // ================================================================
    function buildEspecificacionesSheet() {
        if (!_core) return [];
        const specs = _core.getDb().specs || {};
        
        const headers = [
            'PIPE_CLASS', 'MATERIAL', 'SCHEDULE', 'RATING',
            'CONNECTION_TYPE', 'FITTING_NORM',
            'DESIGN_PRESSURE', 'DESIGN_TEMPERATURE',
            'CORROSION_ALLOWANCE (mm)',
            'BOLT_SPEC', 'GASKET_SPEC',
            'AVAILABLE_DIAMETERS'
        ];
        
        const rows = [headers];
        
        for (const [specId, specData] of Object.entries(specs)) {
            rows.push([
                specId,
                specData.mat || '',
                specData.sch || specData.schedule || '',
                specData.rating || '',
                specData.connectionType || '',
                specData.fittingNorm || '',
                specData.presion || '',
                '',
                specData.corrosion || '',
                PROJECT_DEFAULTS.boltSpec,
                PROJECT_DEFAULTS.gasketSpec,
                specData.diameters || ''
            ]);
        }
        return rows;
    }
    
    // ================================================================
    //  GENERACIÓN DEL ARCHIVO XLSX
    // ================================================================
    
    function exportDatabase(filename) {
        if (typeof XLSX === 'undefined') {
            _notify('❌ Error: Librería XLSX (SheetJS) no disponible', true);
            return;
        }
        if (!_core) {
            _notify('❌ Error: Core no inicializado', true);
            return;
        }
        
        const wb = XLSX.utils.book_new();
        
        const sheets = [
            { name: '1. PROYECTO',        data: buildProyectoSheet() },
            { name: '2. EQUIPOS',          data: buildEquiposSheet() },
            { name: '3. BOQUILLAS',        data: buildBoquillasSheet() },
            { name: '4. LINEAS',           data: buildLineasSheet() },
            { name: '5. CATALOGO_SKEY',    data: buildCatalogoSKEYSheet() },
            { name: '6. RUTEO_ISOMETRICO', data: buildRuteoSheet() },
            { name: '7. COMPONENTES',      data: buildComponentesSheet() },
            { name: '8. MTO',              data: buildMTOSheet() },
            { name: '9. CONEXIONES',       data: buildConexionesSheet() },
            { name: '10. SOLDADURAS',      data: buildSoldadurasSheet() },
            { name: '11. ESPECIFICACIONES', data: buildEspecificacionesSheet() }
        ];
        
        for (const sheet of sheets) {
            const ws = XLSX.utils.aoa_to_sheet(sheet.data);
            
            // Ajustar ancho de columnas
            if (sheet.data[0]) {
                const colWidths = sheet.data[0].map((_, colIdx) => {
                    let maxLen = String(sheet.data[0][colIdx] || '').length;
                    for (let r = 1; r < Math.min(sheet.data.length, 50); r++) {
                        const cellLen = String(sheet.data[r][colIdx] || '').length;
                        if (cellLen > maxLen) maxLen = cellLen;
                    }
                    return { wch: Math.min(maxLen + 3, 35) };
                });
                ws['!cols'] = colWidths;
            }
            
            // Congelar primera fila
            ws['!freeze'] = { xSplit: 0, ySplit: 1 };
            
            XLSX.utils.book_append_sheet(wb, ws, sheet.name);
        }
        
        const projectName = (_core.getDb().projectName || window.currentProjectName || 'Proyecto').replace(/\s+/g, '_');
        const finalFilename = filename || `SmartFlow_DB_${projectName}_${new Date().toISOString().slice(0,10)}.xlsx`;
        XLSX.writeFile(wb, finalFilename);
        
        _notify('✅ Base de datos exportada: ' + finalFilename + '\n📊 ' + sheets.length + ' hojas generadas', false);
    }
    
    // ================================================================
    //  INICIALIZACIÓN
    // ================================================================
    
    function init(coreInstance, ioInstance, notifyFn) {
        _core = coreInstance;
        _io = ioInstance || null;
        _notify = notifyFn || _notify;
        console.log('SmartFlowDBExport v2.0 inicializado | Hojas: 11 | SKEYs: ' + Object.keys(SKEY_CATALOG).length);
    }
    
    return {
        init: init,
        exportDatabase: exportDatabase,
        SKEY_CATALOG: SKEY_CATALOG,
        PROJECT_DEFAULTS: PROJECT_DEFAULTS,
        buildProyectoSheet: buildProyectoSheet,
        buildEquiposSheet: buildEquiposSheet,
        buildBoquillasSheet: buildBoquillasSheet,
        buildLineasSheet: buildLineasSheet,
        buildCatalogoSKEYSheet: buildCatalogoSKEYSheet,
        buildRuteoSheet: buildRuteoSheet,
        buildComponentesSheet: buildComponentesSheet,
        buildMTOSheet: buildMTOSheet,
        buildConexionesSheet: buildConexionesSheet,
        buildSoldadurasSheet: buildSoldadurasSheet,
        buildEspecificacionesSheet: buildEspecificacionesSheet
    };
})();
