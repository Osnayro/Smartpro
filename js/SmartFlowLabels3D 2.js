
const SmartFlowLabels3D = (function() {
    let _core = null;
    let _engine = null;
    let _labelGroup = new THREE.Group();
    let _dimensionGroup3D = new THREE.Group();
    let _cssRenderer = null;
    let _labelDivs = [];

    function init(coreInstance, engineInstance) {
        _core = coreInstance;
        _engine = engineInstance;
        const scene = _engine.getScene();
        if (scene) {
            _labelGroup.userData = { isLabelGroup: true };
            _labelGroup.renderOrder = 10;
            _dimensionGroup3D.userData = { isDimensionGroup3D: true };
            _dimensionGroup3D.renderOrder = 9;
            scene.add(_labelGroup);
            scene.add(_dimensionGroup3D);
        }
    }

    function disposeLabels() {
        while (_labelGroup.children.length > 0) {
            const child = _labelGroup.children[_labelGroup.children.length - 1];
            if (child.material) {
                if (child.material.map) child.material.map.dispose();
                child.material.dispose();
            }
            if (child.geometry) child.geometry.dispose();
            _labelGroup.remove(child);
        }
        _labelDivs.forEach(function(div) {
            if (div && div.parentNode) div.parentNode.removeChild(div);
        });
        _labelDivs = [];
    }

    function disposeDimensions() {
        while (_dimensionGroup3D.children.length > 0) {
            const child = _dimensionGroup3D.children[_dimensionGroup3D.children.length - 1];
            if (child.material) child.material.dispose();
            if (child.geometry) child.geometry.dispose();
            _dimensionGroup3D.remove(child);
        }
    }

    function createTextSprite(text, position, color, scale) {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = color || '#ffffff';
        ctx.font = 'bold 24px "Segoe UI", Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 128, 32);

        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        const spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.position.copy(position);
        const s = scale || 1;
        sprite.scale.set(s * 4, s * 1, 1);
        return sprite;
    }

    function createLineLabel(text, position, color) {
        const canvas = document.createElement('canvas');
        canvas.width = 512;
        canvas.height = 64;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = 'rgba(14, 165, 233, 0.5)';
        ctx.lineWidth = 2;
        ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
        ctx.fillStyle = color || '#ffffff';
        ctx.font = 'bold 22px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, 256, 32);

        const texture = new THREE.CanvasTexture(canvas);
        texture.minFilter = THREE.LinearFilter;
        const spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false });
        const sprite = new THREE.Sprite(spriteMaterial);
        sprite.position.copy(position);
        sprite.scale.set(8, 1, 1);
        return sprite;
    }

    function createDimensionLine(p1, p2, distanceText, offsetY) {
        const group = new THREE.Group();
        const oY = offsetY || 1.5;

        const start = new THREE.Vector3(p1.x, p1.y + oY, p1.z);
        const end = new THREE.Vector3(p2.x, p2.y + oY, p2.z);

        const dashMat = new THREE.LineBasicMaterial({ color: 0x64748b, transparent: true, opacity: 0.5 });
        const dashGeo1 = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(p1.x, p1.y, p1.z), start]);
        const dashGeo2 = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(p2.x, p2.y, p2.z), end]);
        group.add(new THREE.Line(dashGeo1, dashMat));
        group.add(new THREE.Line(dashGeo2, dashMat));

        const lineGeo = new THREE.BufferGeometry().setFromPoints([start, end]);
        const lineMat = new THREE.LineBasicMaterial({ color: 0x00ffcc, linewidth: 2 });
        group.add(new THREE.Line(lineGeo, lineMat));

        const midPoint = new THREE.Vector3((start.x + end.x) / 2, (start.y + end.y) / 2, (start.z + end.z) / 2);
        const label = createTextSprite(distanceText, midPoint, '#00ffcc', 0.8);
        group.add(label);

        return group;
    }

    function refreshAllLabels() {
        if (!_core || !_engine) return;
        disposeLabels();

        const db = _core.getDb();
        if (!db) return;

        const equipos = db.equipos || [];
        equipos.forEach(function(eq) {
            if (!eq.posX) return;
            const pos = new THREE.Vector3(eq.posX / 1000, eq.posY / 1000, eq.posZ / 1000);
            const label = createTextSprite(eq.tag, new THREE.Vector3(pos.x, pos.y + (eq.altura || 2000) / 1000 + 0.5, pos.z), '#f59e0b', 1.2);
            label.userData = { tag: eq.tag, type: 'equipment-label' };
            _labelGroup.add(label);
        });

        const inlineComponents = db.inlineComponents || [];
        inlineComponents.forEach(function(ic) {
            const pos = new THREE.Vector3(ic.posX / 1000, ic.posY / 1000, ic.posZ / 1000);
            const label = createTextSprite(ic.tag || 'TEE', new THREE.Vector3(pos.x, pos.y + 0.5, pos.z), '#d35400', 0.8);
            label.userData = { tag: ic.tag, type: 'inline-label' };
            _labelGroup.add(label);
        });

        const lines = db.lines || [];
        lines.forEach(function(line) {
            const pts = _core.getLinePoints(line) || line._cachedPoints || line.points3D || [];
            if (pts.length < 2) return;
            const midIdx = Math.floor(pts.length / 2);
            const midPt = pts[midIdx];
            const pos = new THREE.Vector3(midPt.x / 1000, midPt.y / 1000 + 1, midPt.z / 1000);
            const lineLabel = line.service ? line.diameter + '"-' + line.service : line.diameter + '"-' + (line.material || 'PPR');
            const label = createLineLabel(lineLabel, pos, '#e2e8f0');
            label.userData = { tag: line.tag, type: 'line-label' };
            _labelGroup.add(label);

            if (line.components) {
                line.components.forEach(function(comp) {
                    if (comp.param === undefined) return;
                    let totalLen = 0;
                    for (let i = 0; i < pts.length - 1; i++) {
                        totalLen += Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y, pts[i+1].z - pts[i].z);
                    }
                    const targetLen = totalLen * comp.param;
                    let accum = 0, cx = pts[0].x, cy = pts[0].y, cz = pts[0].z;
                    for (let i = 0; i < pts.length - 1; i++) {
                        const segLen = Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y, pts[i+1].z - pts[i].z);
                        if (accum + segLen >= targetLen || i === pts.length - 2) {
                            const t = segLen > 0 ? (targetLen - accum) / segLen : 0;
                            cx = pts[i].x + (pts[i+1].x - pts[i].x) * t;
                            cy = pts[i].y + (pts[i+1].y - pts[i].y) * t;
                            cz = pts[i].z + (pts[i+1].z - pts[i].z) * t;
                            break;
                        }
                        accum += segLen;
                    }
                    const compPos = new THREE.Vector3(cx / 1000, cy / 1000 + 0.8, cz / 1000);
                    const compLabel = createTextSprite((comp.type || '?').substring(0, 6), compPos, '#fbbf24', 0.6);
                    compLabel.userData = { tag: comp.tag || '', type: 'component-label' };
                    _labelGroup.add(compLabel);
                });
            }
        });
    }

    function refreshAllDimensions() {
        if (!_core || !_engine) return;
        disposeDimensions();

        const db = _core.getDb();
        if (!db) return;

        const lines = db.lines || [];
        lines.forEach(function(line) {
            const pts = _core.getLinePoints(line) || line._cachedPoints || line.points3D || [];
            if (pts.length < 2) return;
            const offsetY = (line.diameter || 4) * 25.4 / 1000 * 3;
            for (let i = 0; i < pts.length - 1; i++) {
                const p1 = { x: pts[i].x / 1000, y: pts[i].y / 1000, z: pts[i].z / 1000 };
                const p2 = { x: pts[i+1].x / 1000, y: pts[i+1].y / 1000, z: pts[i+1].z / 1000 };
                const dist = Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y, pts[i+1].z - pts[i].z);
                if (dist < 100) continue;
                const distText = dist >= 1000 ? (dist / 1000).toFixed(2) + 'm' : Math.round(dist) + 'mm';
                const dimGroup = createDimensionLine(p1, p2, distText, offsetY);
                _dimensionGroup3D.add(dimGroup);
            }
        });
    }

    function getLabelGroup() { return _labelGroup; }
    function getDimensionGroup() { return _dimensionGroup3D; }

    return {
        init: init,
        refreshAllLabels: refreshAllLabels,
        refreshAllDimensions: refreshAllDimensions,
        getLabelGroup: getLabelGroup,
        getDimensionGroup: getDimensionGroup
    };
})();

if (typeof window !== 'undefined') window.SmartFlowLabels3D = SmartFlowLabels3D;

