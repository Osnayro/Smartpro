
// ============================================================
// SMARTFLOW LABELS 3D v3.1 - Three.js 0.160.0
// Mejorado: rendimiento, legibilidad, robustez
// ============================================================
import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

/**
 * Módulo de etiquetas 3D y cotas para SmartFlow
 */
export const SmartFlowLabels3D = (function() {
    // --------------------------------------------------------
    // Estado privado
    // --------------------------------------------------------
    let _core = null;
    let _engine = null;
    let _labelRenderer = null;
    let _camera = null;
    let _scene = null;
    
    const _labelGroup = new THREE.Group();
    const _dimensionGroup3D = new THREE.Group();
    
    const _equipmentLabels = new Map();
    const _lineLabels = new Map();
    const _componentLabels = new Map();
    const _dimensionLines = new Map();
    
    // Materiales compartidos
    let _sharedDimLineMat = null;
    let _sharedDimExtMat = null;
    let _sharedDimTickMat = null;
    let _sharedAnchorMat = null;
    let _sharedAnchorGeo = null;
    
    // Constantes
    const EQUIPMENT_LABEL_OFFSET = 0.5;
    const LINE_LABEL_OFFSET = 0.15;
    const DIMENSION_OFFSET = 0.3;
    const MIN_SEGMENT_LENGTH = 0.1;
    
    const COLORS = {
        equipment: '#f59e0b',
        equipmentBg: 'rgba(15, 23, 42, 0.92)',
        equipmentBorder: '#f59e0b',
        line: '#00f2ff',
        lineBg: 'rgba(15, 23, 42, 0.88)',
        lineBorder: '#0ea5e9',
        component: '#a78bfa',
        componentBg: 'rgba(15, 23, 42, 0.85)',
        componentBorder: '#8b5cf6',
        dimension: '#facc15',
        dimensionBg: 'rgba(15, 23, 42, 0.85)',
        dimensionBorder: '#facc15',
        dimensionText: '#ffffff'
    };
    
    // --------------------------------------------------------
    // Utilidades
    // --------------------------------------------------------
    const toMeters = (mmValue) => (mmValue || 0) / 1000;
    const diameterToRadiusMeters = (diameterPulgadas) => ((diameterPulgadas || 4) * 25.4) / 2000;
    
    /**
     * Crea un div estilizado para CSS2DObject
     */
    function createStyledDiv(content, bgColor, borderColor, textColor, extraStyles = '') {
        const div = document.createElement('div');
        div.style.cssText = `
            background: ${bgColor};
            border: 1px solid ${borderColor};
            border-radius: 6px;
            padding: 6px 10px;
            font-family: "Courier New", monospace;
            font-size: 10px;
            color: ${textColor};
            text-align: center;
            white-space: nowrap;
            backdrop-filter: blur(4px);
            box-shadow: 0 2px 8px rgba(0,0,0,0.5);
            pointer-events: auto;
            cursor: pointer;
            user-select: none;
            ${extraStyles}
        `;
        div.innerHTML = content;
        return div;
    }
    
    /**
     * Calcula punto medio sobre una línea poligonal
     */
    function computeMidPointOnLine(points, offsetY = 0) {
        if (points.length < 2) return null;
        
        let totalLen = 0;
        const lengths = [];
        for (let i = 0; i < points.length - 1; i++) {
            const d = Math.hypot(points[i+1].x - points[i].x, points[i+1].y - points[i].y, points[i+1].z - points[i].z);
            lengths.push(d);
            totalLen += d;
        }
        if (totalLen === 0) return null;
        
        const halfLen = totalLen / 2;
        let accum = 0;
        let segIdx = 0;
        let t = 0;
        
        for (let j = 0; j < lengths.length; j++) {
            if (accum + lengths[j] >= halfLen || j === lengths.length - 1) {
                segIdx = j;
                t = lengths[j] > 0 ? (halfLen - accum) / lengths[j] : 0;
                t = Math.min(1, Math.max(0, t));
                break;
            }
            accum += lengths[j];
        }
        
        const p1 = points[segIdx];
        const p2 = points[segIdx + 1];
        const isVertical = Math.abs(p2.x - p1.x) < 10 && Math.abs(p2.z - p1.z) < 10;
        
        const midX = toMeters(p1.x + (p2.x - p1.x) * t) + (isVertical ? 0.2 : 0);
        const midY = toMeters(p1.y + (p2.y - p1.y) * t) + (isVertical ? 0 : offsetY);
        const midZ = toMeters(p1.z + (p2.z - p1.z) * t) + (isVertical ? 0.2 : 0);
        
        return { x: midX, y: midY, z: midZ, isVertical };
    }
    
    function formatDistance(meters) {
        return meters >= 1 ? `${meters.toFixed(2)} m` : `${(meters * 1000).toFixed(0)} mm`;
    }
    
    function getAbbreviation(type) {
        const t = (type || '').toUpperCase();
        const map = {
            'GATE_VALVE': 'GV', 'COMPUERTA': 'GV',
            'GLOBE_VALVE': 'GL', 'BALL_VALVE': 'BA', 'BOLA': 'BA',
            'BUTTERFLY_VALVE': 'VB', 'MARIPOSA': 'VB', 'CHECK_VALVE': 'CK',
            'RETENCION': 'CK', 'DIAPHRAGM_VALVE': 'DV', 'CONTROL_VALVE': 'CV',
            'RELIEF': 'RV', 'SAFETY': 'RV', 'ELBOW_90': 'E9', 'ELBOW_45': 'E4',
            'TEE_EQUAL': 'TE', 'TEE_REDUCING': 'TR', 'REDUCER': 'RE', 'REDUCTOR': 'RE',
            'FLANGE': 'FL', 'BRIDA': 'FL', 'BULKHEAD': 'BH', 'PASAMUROS': 'BH',
            'CAP': 'CA', 'TAPON': 'CA', 'UNION': 'UN', 'NIPPLE': 'NI', 'NIPLE': 'NI',
            'STRAINER': 'ST', 'FILTRO': 'ST', 'STEAM_TRAP': 'TR', 'EXPANSION': 'EJ',
            'GAUGE': 'PG', 'MANOMETRO': 'PG', 'FLOW_METER': 'FM', 'CAUDAL': 'FM',
            'TRANSMITTER': 'XT', 'LEVEL_SWITCH': 'LS', 'PIPE_SHOE': 'SH', 'ZAPATA': 'SH',
            'GUIDE': 'GD', 'GUIA': 'GD', 'ANCHOR': 'AN', 'ANCLAJE': 'AN',
            'HANGER': 'HG', 'COLGADOR': 'HG'
        };
        
        for (const [key, value] of Object.entries(map)) {
            if (t.includes(key)) return value;
        }
        return '??';
    }
    
    // --------------------------------------------------------
    // Creación de etiquetas
    // --------------------------------------------------------
    function createEquipmentLabel(eq) {
        if (!eq?.tag) return null;
        
        const posX = toMeters(eq.posX);
        const posY = toMeters(eq.posY);
        const posZ = toMeters(eq.posZ);
        
        let altura = toMeters(eq.altura || eq.diametro || 2000);
        if (eq.tipo === 'tanque_h') altura = toMeters(eq.diametro || 3000);
        if (eq.tipo?.includes('bomba')) altura = toMeters(eq.diametro || 800);
        if (eq.tipo === 'plataforma') altura = toMeters(eq.altura || 400);
        
        const offsetY = (altura / 2) + EQUIPMENT_LABEL_OFFSET;
        
        const anchor = new THREE.Mesh(_sharedAnchorGeo, _sharedAnchorMat);
        anchor.position.set(posX, posY + offsetY, posZ);
        anchor.userData = { tag: eq.tag, isLabelAnchor: true };
        _labelGroup.add(anchor);
        
        const tipoStr = eq.tipo || 'EQUIPO';
        const matStr = (eq.material || 'N/D').substring(0, 15);
        const diamStr = eq.diametro ? ` ⌀${(eq.diametro / 1000).toFixed(1)}m` : '';
        
        const content = `
            <div style="font-weight:bold;font-size:11px;">🏭 ${eq.tag}</div>
            <div style="font-size:8px;color:#94a3b8;">${tipoStr}${diamStr} | ${matStr}</div>
        `;
        
        const div = createStyledDiv(content, COLORS.equipmentBg, COLORS.equipmentBorder, COLORS.equipment);
        const label = new CSS2DObject(div);
        label.position.copy(anchor.position);
        label.userData = { tag: eq.tag, isEquipmentLabel: true };
        _labelGroup.add(label);
        
        const clickHandler = (e) => {
            e.stopPropagation();
            if (_core) _core.setSelected?.({ obj: eq, type: 'equipment' });
        };
        div.addEventListener('click', clickHandler);
        
        _equipmentLabels.set(eq.tag, { anchor, label, element: div, handler: clickHandler });
        return { anchor, label };
    }
    
    function createLineLabel(line) {
        if (!line?.tag) return null;
        
        const points = _core.getLinePoints(line) || line._cachedPoints || line.points3D || [];
        const mid = computeMidPointOnLine(points, LINE_LABEL_OFFSET);
        if (!mid) return null;
        
        const diam = line.diameter || '?';
        const service = line.service || '';
        const matShort = (line.material || 'N/D').substring(0, 4);
        
        const content = `${diam}" ${matShort}${service ? ` ${service}` : ''}`;
        const div = createStyledDiv(content, COLORS.lineBg, COLORS.lineBorder, COLORS.line, 'padding: 3px 7px; font-size: 9px;');
        const label = new CSS2DObject(div);
        label.position.set(mid.x, mid.y, mid.z);
        label.userData = { tag: line.tag, isLineLabel: true };
        _labelGroup.add(label);
        
        const clickHandler = (e) => {
            e.stopPropagation();
            if (_core) _core.setSelected?.({ obj: line, type: 'line' });
        };
        div.addEventListener('click', clickHandler);
        
        _lineLabels.set(line.tag, { label, element: div, handler: clickHandler });
        return { label };
    }
    
    function createComponentLabels(line) {
        if (!line.components?.length) return;
        
        const points = _core.getLinePoints(line) || line._cachedPoints || line.points3D || [];
        if (points.length < 2) return;
        
        let totalLen = 0;
        const lengths = [];
        for (let i = 0; i < points.length - 1; i++) {
            const d = Math.hypot(points[i+1].x - points[i].x, points[i+1].y - points[i].y, points[i+1].z - points[i].z);
            lengths.push(d);
            totalLen += d;
        }
        if (totalLen === 0) return;
        
        for (const comp of line.components) {
            try {
                const param = comp.param ?? 0.5;
                const targetLen = totalLen * Math.min(1, Math.max(0, param));
                let accum = 0, segIdx = 0, t = 0;
                for (let j = 0; j < lengths.length; j++) {
                    if (accum + lengths[j] >= targetLen || j === lengths.length - 1) {
                        segIdx = j;
                        t = (targetLen - accum) / (lengths[j] || 1);
                        break;
                    }
                    accum += lengths[j];
                }
                const pA = points[segIdx];
                const pB = points[segIdx + 1];
                const cx = toMeters(pA.x + (pB.x - pA.x) * t);
                const cy = toMeters(pA.y + (pB.y - pA.y) * t) + LINE_LABEL_OFFSET;
                const cz = toMeters(pA.z + (pB.z - pA.z) * t);
                
                const abbr = getAbbreviation(comp.type);
                const div = createStyledDiv(abbr, COLORS.componentBg, COLORS.componentBorder, COLORS.component, 'padding: 2px 5px; font-size: 8px;');
                const label = new CSS2DObject(div);
                label.position.set(cx, cy, cz);
                label.userData = { tag: comp.tag, type: comp.type, isComponentLabel: true };
                _labelGroup.add(label);
                
                const key = comp.tag || `${line.tag}_${comp.type}`;
                _componentLabels.set(key, { label, element: div });
            } catch (err) {
                console.warn(`Error creando etiqueta para componente en línea ${line.tag}`, err);
            }
        }
    }
    
    // --------------------------------------------------------
    // Dimensiones 3D
    // --------------------------------------------------------
    function createDimensionLine3D(p1, p2, labelText = null) {
        const pos1 = new THREE.Vector3(toMeters(p1.x), toMeters(p1.y), toMeters(p1.z));
        const pos2 = new THREE.Vector3(toMeters(p2.x), toMeters(p2.y), toMeters(p2.z));
        
        const distance = pos1.distanceTo(pos2);
        if (distance < MIN_SEGMENT_LENGTH) return null;
        
        const key = `${Math.round(p1.x)},${Math.round(p1.y)},${Math.round(p1.z)}-${Math.round(p2.x)},${Math.round(p2.y)},${Math.round(p2.z)}`;
        if (_dimensionLines.has(key)) return null;
        
        const dir = new THREE.Vector3().subVectors(pos2, pos1).normalize();
        let perpendicular = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
        if (perpendicular.length() < 0.1) perpendicular = new THREE.Vector3(0, 1, 0);
        perpendicular.multiplyScalar(DIMENSION_OFFSET);
        
        const cota1 = new THREE.Vector3().addVectors(pos1, perpendicular);
        const cota2 = new THREE.Vector3().addVectors(pos2, perpendicular);
        
        // Extensiones
        const extGeo1 = new THREE.BufferGeometry().setFromPoints([pos1, cota1]);
        const extGeo2 = new THREE.BufferGeometry().setFromPoints([pos2, cota2]);
        _dimensionGroup3D.add(new THREE.Line(extGeo1, _sharedDimExtMat));
        _dimensionGroup3D.add(new THREE.Line(extGeo2, _sharedDimExtMat));
        
        // Línea principal
        const lineGeo = new THREE.BufferGeometry().setFromPoints([cota1, cota2]);
        _dimensionGroup3D.add(new THREE.Line(lineGeo, _sharedDimLineMat));
        
        // Marcas
        const tickDir = dir.clone().multiplyScalar(0.1);
        const tickGeo1 = new THREE.BufferGeometry().setFromPoints([cota1.clone().add(tickDir), cota1.clone().sub(tickDir)]);
        const tickGeo2 = new THREE.BufferGeometry().setFromPoints([cota2.clone().add(tickDir), cota2.clone().sub(tickDir)]);
        _dimensionGroup3D.add(new THREE.Line(tickGeo1, _sharedDimTickMat));
        _dimensionGroup3D.add(new THREE.Line(tickGeo2, _sharedDimTickMat));
        
        // Texto
        const dimText = labelText || formatDistance(distance);
        const textDiv = document.createElement('div');
        textDiv.innerHTML = `<span style="background: ${COLORS.dimensionBg}; color: ${COLORS.dimensionText}; padding: 2px 6px; border-radius: 3px; font-family: 'Courier New', monospace; font-size: 8px; white-space: nowrap; border: 1px solid ${COLORS.dimensionBorder};">${dimText}</span>`;
        const textLabel = new CSS2DObject(textDiv);
        textLabel.position.copy(new THREE.Vector3().addVectors(cota1, cota2).multiplyScalar(0.5));
        textLabel.userData = { isDimensionText: true, key };
        _dimensionGroup3D.add(textLabel);
        
        _dimensionLines.set(key, { textLabel });
        return { cota1, cota2, textLabel };
    }
    
    function createDimensionsForLine(line) {
        const points = _core.getLinePoints(line) || line._cachedPoints || line.points3D || [];
        for (let i = 0; i < points.length - 1; i++) {
            if (points[i].isControlPoint || points[i+1].isControlPoint) continue;
            const dist = Math.hypot(points[i+1].x - points[i].x, points[i+1].y - points[i].y, points[i+1].z - points[i].z);
            if (dist >= 100) createDimensionLine3D(points[i], points[i+1]);
        }
    }
    
    function createDimensionsForEquipment(eq) {
        if (!eq.puertos?.length) return;
        for (let i = 0; i < eq.puertos.length; i++) {
            for (let j = i + 1; j < eq.puertos.length; j++) {
                const pA = eq.puertos[i];
                const pB = eq.puertos[j];
                const posA = { x: (eq.posX || 0) + (pA.relX || 0), y: (eq.posY || 0) + (pA.relY || 0), z: (eq.posZ || 0) + (pA.relZ || 0) };
                const posB = { x: (eq.posX || 0) + (pB.relX || 0), y: (eq.posY || 0) + (pB.relY || 0), z: (eq.posZ || 0) + (pB.relZ || 0) };
                createDimensionLine3D(posA, posB, `${pA.id} ↔ ${pB.id}`);
            }
        }
    }
    
    // --------------------------------------------------------
    // Limpieza
    // --------------------------------------------------------
    function clearAllLabels() {
        for (const { element, handler, label, anchor } of _equipmentLabels.values()) {
            if (element && handler) element.removeEventListener('click', handler);
            if (label) {
                if (label.parent) label.parent.remove(label);
                if (label.element) label.element.remove();
            }
            if (anchor?.parent) anchor.parent.remove(anchor);
        }
        _equipmentLabels.clear();
        
        for (const { element, handler, label } of _lineLabels.values()) {
            if (element && handler) element.removeEventListener('click', handler);
            if (label) {
                if (label.parent) label.parent.remove(label);
                if (label.element) label.element.remove();
            }
        }
        _lineLabels.clear();
        
        for (const { label } of _componentLabels.values()) {
            if (label) {
                if (label.parent) label.parent.remove(label);
                if (label.element) label.element.remove();
            }
        }
        _componentLabels.clear();
    }
    
    function clearAllDimensions() {
        for (const { textLabel } of _dimensionLines.values()) {
            if (textLabel) {
                if (textLabel.parent) textLabel.parent.remove(textLabel);
                if (textLabel.element) textLabel.element.remove();
            }
        }
        _dimensionLines.clear();
        
        while (_dimensionGroup3D.children.length) {
            const child = _dimensionGroup3D.children[0];
            if (child.geometry) child.geometry.dispose();
            if (child.element) child.element.remove();
            _dimensionGroup3D.remove(child);
        }
    }
    
    // --------------------------------------------------------
    // Refrescos públicos
    // --------------------------------------------------------
    let _refreshTimeout = null;
    function scheduleRefresh(refreshFn) {
        if (_refreshTimeout) clearTimeout(_refreshTimeout);
        _refreshTimeout = setTimeout(() => {
            refreshFn();
            _refreshTimeout = null;
        }, 100);
    }
    
    function refreshAllLabels() {
        if (!_core) return;
        clearAllLabels();
        const db = _core.getDb?.();
        if (!db) return;
        
        const equipos = db.equipos || [];
        for (const eq of equipos) {
            if (eq.tipo !== 'plataforma' && !(eq.tag || '').startsWith('TEE-')) {
                createEquipmentLabel(eq);
            }
        }
        
        const lines = db.lines || [];
        for (const line of lines) {
            createLineLabel(line);
            createComponentLabels(line);
        }
    }
    
    function refreshAllDimensions() {
        if (!_core) return;
        clearAllDimensions();
        const db = _core.getDb?.();
        if (!db) return;
        
        const lines = db.lines || [];
        for (const line of lines) createDimensionsForLine(line);
        
        const equipos = db.equipos || [];
        for (const eq of equipos) createDimensionsForEquipment(eq);
    }
    
    // --------------------------------------------------------
    // Ciclo de vida
    // --------------------------------------------------------
    function init(coreInstance, engineInstance) {
        if (!coreInstance || !engineInstance) {
            console.warn('SmartFlowLabels3D: core o engine no proporcionados');
            return false;
        }
        
        _core = coreInstance;
        _engine = engineInstance;
        _camera = engineInstance.getCamera?.();
        _scene = engineInstance.getScene?.();
        
        if (!_scene || !_camera) {
            console.warn('SmartFlowLabels3D: Engine sin cámara o escena');
            return false;
        }
        
        // Materiales compartidos
        _sharedDimLineMat = new THREE.LineBasicMaterial({ color: 0xfacc15, linewidth: 1, transparent: true, opacity: 0.8, depthTest: true });
        _sharedDimExtMat = new THREE.LineBasicMaterial({ color: 0xfacc15, linewidth: 1, transparent: true, opacity: 0.4, depthTest: true });
        _sharedDimTickMat = new THREE.LineBasicMaterial({ color: 0xfacc15, linewidth: 1, transparent: true, opacity: 0.8, depthTest: true });
        _sharedAnchorMat = new THREE.MeshBasicMaterial({ visible: false });
        _sharedAnchorGeo = new THREE.SphereGeometry(0.02, 4, 4);
        
        // CSS2DRenderer
        try {
            _labelRenderer = new CSS2DRenderer();
            _labelRenderer.setSize(window.innerWidth, window.innerHeight);
            _labelRenderer.domElement.style.position = 'absolute';
            _labelRenderer.domElement.style.top = '0px';
            _labelRenderer.domElement.style.left = '0px';
            _labelRenderer.domElement.style.pointerEvents = 'none';
            _labelRenderer.domElement.style.zIndex = '10';
            
            const container = _engine.getRenderer?.()?.domElement?.parentElement;
            if (container) container.appendChild(_labelRenderer.domElement);
        } catch (e) {
            console.warn('SmartFlowLabels3D: CSS2DRenderer no disponible', e);
            _labelRenderer = null;
        }
        
        _labelGroup.userData = { isLabelGroup: true };
        _dimensionGroup3D.userData = { isDimensionGroup3D: true };
        _scene.add(_labelGroup);
        _scene.add(_dimensionGroup3D);
        
        if (_core && typeof _core.on === 'function') {
            _core.on('modelChanged', () => {
                scheduleRefresh(refreshAllLabels);
                scheduleRefresh(refreshAllDimensions);
            });
        }
        
        window.addEventListener('resize', () => _labelRenderer?.setSize(window.innerWidth, window.innerHeight));
        
        console.log('✔ SmartFlowLabels3D v3.1 (Three.js 0.160.0)');
        return true;
    }
    
    function render() {
        if (_labelRenderer && _scene && _camera) {
            _labelRenderer.render(_scene, _camera);
        }
    }
    
    function dispose() {
        clearAllLabels();
        clearAllDimensions();
        
        _sharedDimLineMat?.dispose();
        _sharedDimExtMat?.dispose();
        _sharedDimTickMat?.dispose();
        _sharedAnchorMat?.dispose();
        _sharedAnchorGeo?.dispose();
        
        if (_labelRenderer?.domElement) _labelRenderer.domElement.remove();
        if (_labelGroup.parent) _labelGroup.parent.remove(_labelGroup);
        if (_dimensionGroup3D.parent) _dimensionGroup3D.parent.remove(_dimensionGroup3D);
        
        window.removeEventListener('resize', () => {});
        if (_refreshTimeout) clearTimeout(_refreshTimeout);
        
        _core = null;
        _engine = null;
        _labelRenderer = null;
        _camera = null;
        _scene = null;
    }
    
    // --------------------------------------------------------
    // API pública
    // --------------------------------------------------------
    return {
        init,
        refreshAllLabels,
        refreshAllDimensions,
        clearAllLabels,
        clearAllDimensions,
        render,
        getLabelRenderer: () => _labelRenderer,
        dispose
    };
})();

// Exportación global opcional para compatibilidad
if (typeof window !== 'undefined') {
    window.SmartFlowLabels3D = SmartFlowLabels3D;
}
```

---

📦 Cómo usar el módulo mejorado

```javascript
import { SmartFlowLabels3D } from './js/SmartFlowLabels3D.js';

// Inicializar
SmartFlowLabels3D.init(coreInstance, engineInstance);

// Refrescar todo
SmartFlowLabels3D.refreshAllLabels();
SmartFlowLabels3D.refreshAllDimensions();

// En el loop de renderizado
function animate() {
    requestAnimationFrame(animate);
    SmartFlowLabels3D.render();
}
