
// ============================================================
// SMARTFLOW RENDER 3D v4.1 - Motor de Visualización Industrial
// Archivo: js/render3d.js
// Three.js 0.160.0 + Materiales PBR + Texturas procedurales
// Compatible 100% con SmartFlowCatalog v4.1
// ============================================================

import * as THREE from 'three';

const SmartFlowRender = (function() {
    let _composer = null;
    let _outlinePass = null;
    let _core = null;
    let _engine = null;
    let _labelRenderer = null;
    let _symbolGroup = new THREE.Group();
    let _dimensionGroup = new THREE.Group();
    let _flowArrowGroup = new THREE.Group();
    let _debounceTimer = null;
    let _totalObjects = 0;
    let _sceneRef = null;
    let _cameraRef = null;
    let _rendererRef = null;

    function toM(mmValue) { return (mmValue || 0) / 1000; }
    function diamToRadiusM(diamPulg) { return ((diamPulg || 4) * 25.4) / 2000; }
    function compSize(diamPulg) { return diamToRadiusM(diamPulg) * 3; }

    // ================================================================
    // 1. CATÁLOGO DE MATERIALES INDUSTRIALES v4.1 (COMPLETO)
    // ================================================================
    const IndustrialMaterials = {
        // Aceros y metales
        'CS': { name: 'Carbon Steel', color: 0x8a9aaa, roughness: 0.55, metalness: 0.85, pattern: 'brushed', envMapIntensity: 0.8, rust: true, weldMarks: true, clearcoat: 0.1 },
        'CS_PAINTED': { name: 'Painted Carbon Steel', color: 0x5c8a6a, roughness: 0.65, metalness: 0.12, pattern: 'none', envMapIntensity: 0.4, rust: false, weldMarks: false, clearcoat: 0.25 },
        'SS304': { name: 'Stainless Steel 304', color: 0xc8d0d8, roughness: 0.32, metalness: 0.92, pattern: 'brushed', envMapIntensity: 1.2, rust: false, weldMarks: true, clearcoat: 0.4 },
        'SS316': { name: 'Stainless Steel 316', color: 0xd8e0e8, roughness: 0.25, metalness: 0.95, pattern: 'brushed', envMapIntensity: 1.4, rust: false, weldMarks: false, clearcoat: 0.5 },
        'CS_GALVANIZED': { name: 'Galvanized Steel', color: 0x9aaaba, roughness: 0.48, metalness: 0.88, pattern: 'spangled', envMapIntensity: 0.9, rust: false, weldMarks: true },
        
        // Materiales estructurales (NUEVO v4.1)
        'CONCRETE': { name: 'Concrete', color: 0x9ca3af, roughness: 0.85, metalness: 0.05, pattern: 'matte', envMapIntensity: 0.15, bumpScale: 0.3 },
        'ALUMINUM': { name: 'Aluminum', color: 0xd1d5db, roughness: 0.45, metalness: 0.72, pattern: 'brushed', envMapIntensity: 0.9, clearcoat: 0.35 },
        'WOOD': { name: 'Wood', color: 0x8b6914, roughness: 0.78, metalness: 0.02, pattern: 'wood', envMapIntensity: 0.2 },
        'TITANIUM': { name: 'Titanium', color: 0xb8c4c8, roughness: 0.28, metalness: 0.93, pattern: 'brushed', envMapIntensity: 1.3, clearcoat: 0.45 },
        'MONEL': { name: 'Monel', color: 0x9aa8b0, roughness: 0.35, metalness: 0.88, pattern: 'brushed', envMapIntensity: 1.0 },
        'INCONEL': { name: 'Inconel', color: 0x8a9aaa, roughness: 0.38, metalness: 0.9, pattern: 'brushed', envMapIntensity: 1.1 },
        'BRONZE': { name: 'Bronze', color: 0xcd7f32, roughness: 0.42, metalness: 0.82, pattern: 'brushed', envMapIntensity: 0.85 },
        
        // Plásticos
        'PPR': { name: 'PPR (Polypropylene)', color: 0x8b5cf6, roughness: 0.55, metalness: 0.05, pattern: 'plastic', envMapIntensity: 0.25, plasticGloss: 0.4, clearcoat: 0.15 },
        'PVC': { name: 'PVC', color: 0xeab308, roughness: 0.6, metalness: 0.03, pattern: 'plastic', envMapIntensity: 0.2, plasticGloss: 0.35 },
        'CPVC': { name: 'CPVC', color: 0xcbd5e1, roughness: 0.58, metalness: 0.04, pattern: 'plastic', envMapIntensity: 0.25 },
        'HDPE': { name: 'HDPE', color: 0x3b82f6, roughness: 0.58, metalness: 0.02, pattern: 'plastic', envMapIntensity: 0.25 },
        'FRP': { name: 'FRP (Fiberglass)', color: 0x8b5cf6, roughness: 0.52, metalness: 0.08, pattern: 'woven', envMapIntensity: 0.35 },
        
        // Especiales
        'BRASS': { name: 'Brass', color: 0xd4a574, roughness: 0.32, metalness: 0.88, pattern: 'brushed', envMapIntensity: 1.0 },
        'RUBBER': { name: 'Rubber', color: 0x333333, roughness: 0.85, metalness: 0.02, pattern: 'matte', envMapIntensity: 0.15 },
        'GLASS': { name: 'Glass', color: 0xaaddff, roughness: 0.08, metalness: 0.05, transparent: true, opacity: 0.65, envMapIntensity: 1.5 },
        'CERAMIC': { name: 'Ceramic', color: 0xf0f0f0, roughness: 0.15, metalness: 0.02, pattern: 'glazed', envMapIntensity: 0.7 }
    };

    const SpecMaterialMap = {
        // Aceros
        'PPR_PN12_5': 'PPR', 'HDPE_PE100': 'HDPE', 'PVC_SCH80': 'PVC', 'PVC_SCH40': 'PVC',
        'CPVC_SCH80': 'CPVC', 'PVDF_PN16': 'PVC', 'FRP': 'FRP',
        'ACERO_150_RF': 'CS', 'ACERO_SCH80': 'CS', 'A1A': 'CS',
        'CS_300_RF': 'CS', 'CS_600_RF': 'CS', 'CS_900_RF': 'CS', 'CS_1500_RTJ': 'CS',
        'CS_CRYO': 'CS',
        // Aceros Inoxidables
        'SS_150_RF': 'SS304', 'SS_300_RF': 'SS304', 'SS_600_RF': 'SS316',
        'SS_SANITARY': 'SS316', 'A3B': 'SS304', 'DUPLEX_150_RF': 'SS304',
        // Revestidos y especiales
        'PTFE_LINED': 'CS_PAINTED', 'RUBBER_LINED': 'RUBBER', 'GLASS_LINED': 'GLASS',
        // Materiales estructurales (NUEVO)
        'HORMIGON_ESTRUCTURAL': 'CONCRETE',
        'ALUMINIO_ESTRUCTURAL': 'ALUMINUM',
        'MADERA_ESTRUCTURAL': 'WOOD',
        'TITANIO_GR2': 'TITANIUM',
        'MONEL_400': 'MONEL',
        'INCONEL_625': 'INCONEL',
        'BRONCE_ALUMINIO': 'BRONZE'
    };

    const _materialCache = new Map();

    // ================================================================
    // 2. TEXTURAS PROCEDURALES
    // ================================================================
    function createMetalTexture(baseColor, roughness, metalness, pattern, options) {
        options = options || {};
        const canvas = document.createElement('canvas');
        canvas.width = 1024; canvas.height = 1024;
        const ctx = canvas.getContext('2d');
        const r = ((baseColor >> 16) & 255) / 255, g = ((baseColor >> 8) & 255) / 255, b = (baseColor & 255) / 255;
        ctx.fillStyle = 'rgb(' + (r*255) + ',' + (g*255) + ',' + (b*255) + ')';
        ctx.fillRect(0, 0, 1024, 1024);
        
        // Ruido base
        for (let i = 0; i < 12000; i++) {
            const x = Math.random() * 1024, y = Math.random() * 1024;
            const intensity = (Math.random() - 0.5) * 0.12;
            const val = Math.max(0, Math.min(255, (r + intensity) * 255));
            ctx.fillStyle = 'rgb(' + val + ',' + (val*0.95) + ',' + (val*0.9) + ')';
            ctx.fillRect(x, y, Math.random()*2+1, Math.random()*2+1);
        }
        
        // Patrón cepillado
        if (pattern === 'brushed' || options.brushed) {
            ctx.strokeStyle = 'rgba(220,220,240,0.05)'; ctx.lineWidth = 1.2;
            for (let y = 0; y < 1024; y += 3) {
                ctx.beginPath(); const offset = (Math.random()-0.5)*2;
                ctx.moveTo(0, y+offset); ctx.lineTo(1024, y+offset+(Math.random()-0.5)*1.5); ctx.stroke();
            }
        }
        
        // Óxido
        if (options.rust) {
            for (let i = 0; i < 400; i++) {
                const x = Math.random()*1024, y = Math.random()*1024, radius = Math.random()*18+4;
                const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
                gradient.addColorStop(0, 'rgba(180,100,50,' + (0.2+Math.random()*0.15) + ')');
                gradient.addColorStop(0.6, 'rgba(140,70,30,' + (0.05+Math.random()*0.1) + ')');
                gradient.addColorStop(1, 'rgba(180,100,50,0)');
                ctx.fillStyle = gradient; ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI*2); ctx.fill();
            }
        }
        
        // Desgaste
        if (options.wear) {
            ctx.strokeStyle = 'rgba(80,80,100,0.06)'; ctx.lineWidth = 0.8;
            for (let i = 0; i < 800; i++) {
                ctx.beginPath(); const sx = Math.random()*1024, sy = Math.random()*1024;
                ctx.moveTo(sx, sy); ctx.lineTo(sx+(Math.random()-0.5)*15, sy+(Math.random()-0.5)*15); ctx.stroke();
            }
        }
        
        // Plástico
        if (pattern === 'plastic') {
            for (let i = 0; i < 8000; i++) {
                const brightness = 20+Math.random()*30;
                ctx.fillStyle = 'rgba(' + brightness + ',' + brightness + ',' + brightness + ',0.04)';
                ctx.fillRect(Math.random()*1024, Math.random()*1024, 1, 1);
            }
        }
        
        // Tejido (FRP)
        if (pattern === 'woven') {
            ctx.strokeStyle = 'rgba(100,100,120,0.1)'; ctx.lineWidth = 1.5;
            for (let x = 0; x < 1024; x += 24) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,1024); ctx.stroke(); }
            for (let y = 0; y < 1024; y += 24) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(1024,y); ctx.stroke(); }
        }
        
        // Madera (NUEVO)
        if (pattern === 'wood') {
            for (let i = 0; i < 800; i++) {
                const x = Math.random() * 1024;
                const y = Math.random() * 1024;
                const width = 2 + Math.random() * 8;
                ctx.fillStyle = `rgba(60, 40, 20, ${0.1 + Math.random() * 0.3})`;
                ctx.fillRect(x, y, width, 1);
            }
        }
        
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(options.repeatX || 2, options.repeatY || 2);
        texture.needsUpdate = true;
        return texture;
    }

    // ================================================================
    // 3. FACTORY DE MATERIALES PBR
    // ================================================================
    function getMaterialBySpec(specCode, componentType) {
        componentType = componentType || 'body';
        const materialKey = SpecMaterialMap[specCode] || 'CS';
        const materialDef = IndustrialMaterials[materialKey] || IndustrialMaterials.CS;
        let finalDef = Object.assign({}, materialDef);
        
        switch(componentType) {
            case 'pipe': finalDef.roughness = Math.min(finalDef.roughness + 0.12, 0.92); break;
            case 'flange': finalDef.metalness = Math.min(finalDef.metalness + 0.03, 0.98); finalDef.roughness = Math.max(finalDef.roughness - 0.05, 0.2); break;
            case 'valve': finalDef.clearcoat = 0.35; finalDef.roughness = Math.max(finalDef.roughness - 0.05, 0.25); break;
            case 'tank': finalDef.roughness = Math.min(finalDef.roughness + 0.08, 0.85); break;
        }
        
        const cacheKey = materialKey + '_' + componentType;
        if (_materialCache.has(cacheKey)) return _materialCache.get(cacheKey).clone();
        
        const material = new THREE.MeshStandardMaterial({
            color: finalDef.color, roughness: finalDef.roughness, metalness: finalDef.metalness,
            envMapIntensity: finalDef.envMapIntensity || 0.8
        });
        
        if (finalDef.pattern && finalDef.pattern !== 'none') {
            material.map = createMetalTexture(finalDef.color, finalDef.roughness, finalDef.metalness, finalDef.pattern, {
                brushed: finalDef.pattern === 'brushed',
                rust: finalDef.rust || false,
                wear: true,
                repeatX: componentType === 'pipe' ? 4 : 2,
                repeatY: componentType === 'pipe' ? 2 : 2
            });
        }
        
        if (finalDef.clearcoat !== undefined) { material.clearcoat = finalDef.clearcoat; material.clearcoatRoughness = 0.25; }
        if (finalDef.transparent) { material.transparent = true; material.opacity = finalDef.opacity || 0.65; }
        
        _materialCache.set(cacheKey, material);
        return material.clone();
    }

    // ================================================================
    // 4. PLACA DE IDENTIFICACIÓN
    // ================================================================
    function createNameplate(tag, specCode, diameter) {
        const group = new THREE.Group();
        const canvas = document.createElement('canvas');
        canvas.width = 512; canvas.height = 256;
        const ctx = canvas.getContext('2d');
        
        ctx.fillStyle = '#c8d0d8'; ctx.fillRect(0, 0, 512, 256);
        ctx.strokeStyle = '#334455'; ctx.lineWidth = 3; ctx.strokeRect(5, 5, 502, 246);
        ctx.strokeStyle = '#8899aa'; ctx.lineWidth = 1; ctx.strokeRect(10, 10, 492, 236);
        ctx.fillStyle = '#000000'; ctx.font = 'Bold 32px Arial'; ctx.textAlign = 'center';
        ctx.fillText(tag || 'EQUIPMENT', 256, 60);
        ctx.font = '20px Arial'; ctx.fillStyle = '#334455';
        ctx.fillText('SPEC: ' + (specCode || 'STD'), 256, 110);
        ctx.font = '18px Arial'; ctx.fillStyle = '#445566';
        ctx.fillText('SIZE: ' + (diameter || '?') + '"', 256, 155);
        
        const texture = new THREE.CanvasTexture(canvas);
        const plateMat = new THREE.MeshStandardMaterial({ color: 0xc8d0d8, roughness: 0.25, metalness: 0.85 });
        const textMat = new THREE.MeshStandardMaterial({ map: texture, metalness: 0.1, roughness: 0.4 });
        const plate = new THREE.Mesh(new THREE.BoxGeometry(70, 35, 1.5), plateMat);
        const textPlate = new THREE.Mesh(new THREE.BoxGeometry(68, 33, 0.5), textMat);
        textPlate.position.z = 1;
        group.add(plate); group.add(textPlate);
        return group;
    }

    // Materiales base
    const matSupport = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.7, roughness: 0.25 });
    const matStem = new THREE.MeshStandardMaterial({ color: 0xc0c0c0, metalness: 0.8, roughness: 0.2 });
    const matWheel = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.6, roughness: 0.3 });
    const matBlack = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.3, roughness: 0.6 });
    const matRed = new THREE.MeshStandardMaterial({ color: 0xff0000, roughness: 0.3 });
    const matGreen = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.4 });
    const matBrass = new THREE.MeshStandardMaterial({ color: 0xd4a800, metalness: 0.8, roughness: 0.2 });

    function orientComponent(group, dirVec) {
        if (!dirVec || dirVec.lengthSq() < 0.001) return;
        var targetMatrix = new THREE.Matrix4();
        var upVec = Math.abs(dirVec.y) > 0.99 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
        targetMatrix.lookAt(new THREE.Vector3(0, 0, 0), dirVec.clone().normalize(), upVec);
        group.quaternion.setFromRotationMatrix(targetMatrix);
        group.rotateY(Math.PI / 2);
    }

    function deepDisposeGroup(group) {
        if (!group) return;
        group.traverse(function(node) {
            if (!node) return;
            if (node.geometry) { try { node.geometry.dispose(); } catch(e) {} node.geometry = null; }
            if (node.material) {
                try {
                    if (Array.isArray(node.material)) {
                        node.material.forEach(function(m) { if (m.map) { m.map.dispose(); m.map = null; } m.dispose(); });
                    } else {
                        if (node.material.map) { node.material.map.dispose(); node.material.map = null; }
                        node.material.dispose();
                    }
                } catch(e) {}
                node.material = null;
            }
        });
        while (group.children.length > 0) { group.remove(group.children[group.children.length - 1]); }
    }

    // ================================================================
    // 5. EQUIPOS 3D (100% del catálogo v4.1)
    // ================================================================
    function createTankVertical(eq) {
        const spec = eq.spec || 'ACERO_150_RF';
        const mat = getMaterialBySpec(spec, 'tank');
        const matRing = getMaterialBySpec(spec, 'flange');
        const r = toM((eq.diametro || 3000) / 2), h = toM(eq.altura || 6000);
        const group = new THREE.Group();
        
        const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 32), mat);
        body.position.y = h / 2; body.castShadow = true; body.receiveShadow = true;
        group.add(body);
        
        const dome = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 16, 0, Math.PI*2, 0, Math.PI/2), mat);
        dome.position.y = h; dome.rotation.x = -Math.PI/2; dome.castShadow = true;
        group.add(dome);
        
        const step = h / 4;
        for (let y = step; y < h; y += step) {
            const ring = new THREE.Mesh(new THREE.TorusGeometry(r+0.02, 0.03, 8, 32), matRing);
            ring.position.y = y; ring.rotation.x = Math.PI/2; group.add(ring);
        }
        
        const nameplate = createNameplate(eq.tag, spec, eq.diametro ? (eq.diametro/25.4).toFixed(1) : '?');
        nameplate.position.set(0, h * 0.6, r + 0.15);
        group.add(nameplate);
        
        group.position.set(toM(eq.posX), toM(eq.posY), toM(eq.posZ));
        group.userData = { tag: eq.tag, tipo: 'equipo' };
        return group;
    }

    function createTankHorizontal(eq) {
        const spec = eq.spec || 'ACERO_150_RF';
        const mat = getMaterialBySpec(spec, 'tank');
        const r = toM((eq.diametro||3000)/2), l = toM(eq.largo||6000);
        const group = new THREE.Group();
        
        const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, l, 32), mat);
        body.rotation.z = Math.PI/2; body.position.set(l/2, r, 0); body.castShadow = true; body.receiveShadow = true;
        group.add(body);
        
        const capGeo = new THREE.SphereGeometry(r, 32, 16, 0, Math.PI*2, 0, Math.PI/2);
        const cap1 = new THREE.Mesh(capGeo, mat); cap1.position.set(0, r, 0); cap1.rotation.z = -Math.PI/2; group.add(cap1);
        const cap2 = new THREE.Mesh(capGeo, mat); cap2.position.set(l, r, 0); cap2.rotation.z = Math.PI/2; group.add(cap2);
        
        const legGeo = new THREE.BoxGeometry(r*0.3, r*1.5, r*0.5);
        for (let i=0; i<2; i++) { const leg = new THREE.Mesh(legGeo, matSupport.clone()); leg.position.set(l*0.25+i*l*0.5, -r*0.5, 0); group.add(leg); }
        
        const nameplate = createNameplate(eq.tag, spec, eq.diametro ? (eq.diametro/25.4).toFixed(1) : '?');
        nameplate.position.set(l/2, r + 0.3, 0);
        group.add(nameplate);
        
        group.position.set(toM(eq.posX), toM(eq.posY), toM(eq.posZ));
        group.userData = { tag: eq.tag, tipo: 'equipo' };
        return group;
    }

    function createThreePhaseSeparator(eq) {
        const spec = eq.spec || 'ACERO_150_RF';
        const mat = getMaterialBySpec(spec, 'tank');
        const l = toM(eq.largo || 5000), r = toM((eq.diametro || 1200) / 2);
        const group = new THREE.Group();
        
        const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, l, 32), mat);
        body.rotation.z = Math.PI/2; body.position.set(l/2, r, 0); body.castShadow = true;
        group.add(body);
        
        const capGeo = new THREE.SphereGeometry(r, 32, 16, 0, Math.PI*2, 0, Math.PI/2);
        const capLeft = new THREE.Mesh(capGeo, mat); capLeft.position.set(0, r, 0); capLeft.rotation.z = -Math.PI/2; group.add(capLeft);
        const capRight = new THREE.Mesh(capGeo, mat); capRight.position.set(l, r, 0); capRight.rotation.z = Math.PI/2; group.add(capRight);
        
        const saddle = new THREE.Mesh(new THREE.BoxGeometry(r*2.2, 0.15, r*1.5), matSupport.clone());
        saddle.position.set(l/2, -r*0.6, 0); group.add(saddle);
        
        const nozzleMat = getMaterialBySpec('SS304', 'flange');
        const inletNozzle = new THREE.Mesh(new THREE.CylinderGeometry(r*0.25, r*0.25, 0.4, 16), nozzleMat);
        inletNozzle.position.set(-0.3, r*0.5, 0); inletNozzle.rotation.z = Math.PI/2; group.add(inletNozzle);
        
        const gasNozzle = new THREE.Mesh(new THREE.CylinderGeometry(r*0.2, r*0.2, 0.35, 16), nozzleMat);
        gasNozzle.position.set(l/2, r*1.1, 0); group.add(gasNozzle);
        
        const oilNozzle = new THREE.Mesh(new THREE.CylinderGeometry(r*0.18, r*0.18, 0.35, 16), nozzleMat);
        oilNozzle.position.set(l*0.7, r*0.2, r*0.8); oilNozzle.rotation.x = Math.PI/2; group.add(oilNozzle);
        
        const nameplate = createNameplate(eq.tag, spec, eq.diametro ? (eq.diametro/25.4).toFixed(1) : '?');
        nameplate.position.set(l/2, r + 0.3, r*0.9);
        group.add(nameplate);
        
        group.position.set(toM(eq.posX), toM(eq.posY), toM(eq.posZ));
        group.userData = { tag: eq.tag, tipo: 'separador_trifasico' };
        return group;
    }

    function createFlare(eq) {
        const spec = eq.spec || 'ACERO_150_RF';
        const mat = getMaterialBySpec(spec, 'body');
        const r = toM((eq.diametro || 1000) / 2), h = toM(eq.altura || 10000);
        const group = new THREE.Group();
        
        const body = new THREE.Mesh(new THREE.CylinderGeometry(r, r*1.2, h, 32), mat);
        body.position.y = h/2; body.castShadow = true;
        group.add(body);
        
        const nozzleMat = getMaterialBySpec('SS304', 'body');
        const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(r*1.5, r*1.8, 0.3, 16), nozzleMat);
        nozzle.position.y = h; nozzle.castShadow = true;
        group.add(nozzle);
        
        const flameMat = new THREE.MeshStandardMaterial({ color: 0xff6600, emissive: 0xff3300, emissiveIntensity: 0.8, transparent: true, opacity: 0.7 });
        const flame = new THREE.Mesh(new THREE.ConeGeometry(r*1.2, 1.5, 8), flameMat);
        flame.position.y = h + 0.25; flame.castShadow = false;
        group.add(flame);
        
        const innerFlameMat = new THREE.MeshStandardMaterial({ color: 0xffaa00, emissive: 0xff4400, emissiveIntensity: 1.2, transparent: true, opacity: 0.9 });
        const innerFlame = new THREE.Mesh(new THREE.ConeGeometry(r*0.7, 0.8, 8), innerFlameMat);
        innerFlame.position.y = h + 0.3;
        group.add(innerFlame);
        
        const platformMat = getMaterialBySpec('CS_GALVANIZED', 'flange');
        const platform = new THREE.Mesh(new THREE.CylinderGeometry(r*1.3, r*1.3, 0.1, 24), platformMat);
        platform.position.y = h * 0.7; platform.castShadow = true;
        group.add(platform);
        
        const nameplate = createNameplate(eq.tag, spec, eq.diametro ? (eq.diametro/25.4).toFixed(1) : '?');
        nameplate.position.set(r*1.5, h*0.6, 0);
        group.add(nameplate);
        
        group.position.set(toM(eq.posX), toM(eq.posY), toM(eq.posZ));
        group.userData = { tag: eq.tag, tipo: 'antorcha' };
        return group;
    }

    function createChemicalSkid(eq) {
        const l = toM(eq.largo || 2500), w = toM(eq.ancho || 1500), h = toM(eq.altura || 200);
        const group = new THREE.Group();
        const skidMat = getMaterialBySpec('CS_GALVANIZED', 'body');
        
        const base = new THREE.Mesh(new THREE.BoxGeometry(l, h, w), skidMat);
        base.position.y = h/2; base.castShadow = true; base.receiveShadow = true;
        group.add(base);
        
        const pumpMat = getMaterialBySpec('SS304', 'body');
        const pump1 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.4), pumpMat);
        pump1.position.set(-l*0.3, h + 0.3, w*0.3); pump1.castShadow = true;
        group.add(pump1);
        
        const pump2 = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.4), pumpMat);
        pump2.position.set(-l*0.3, h + 0.3, -w*0.3); pump2.castShadow = true;
        group.add(pump2);
        
        const pipeMat = getMaterialBySpec('SS304', 'pipe');
        const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, l*0.5, 8), pipeMat);
        pipe.position.set(l*0.2, h + 0.4, 0); pipe.rotation.z = Math.PI/2;
        group.add(pipe);
        
        const panelMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.1, roughness: 0.4 });
        const panel = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.1), panelMat);
        panel.position.set(l*0.4, h + 0.25, w*0.4);
        group.add(panel);
        
        const displayMat = new THREE.MeshStandardMaterial({ color: 0x0ea5e9, emissive: 0x0ea5e9, emissiveIntensity: 0.3 });
        const display = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.15, 0.02), displayMat);
        display.position.set(l*0.4, h + 0.3, w*0.41);
        group.add(display);
        
        const nameplate = createNameplate(eq.tag, eq.spec || 'CS', '');
        nameplate.position.set(0, h + 0.5, w*0.5);
        group.add(nameplate);
        
        group.position.set(toM(eq.posX), toM(eq.posY), toM(eq.posZ));
        group.userData = { tag: eq.tag, tipo: 'skid_inyeccion' };
        return group;
    }

    function createBomba(eq) {
        const spec = eq.spec || 'ACERO_150_RF';
        const mat = getMaterialBySpec(spec, 'body');
        const s = toM(eq.diametro||800);
        const group = new THREE.Group();
        
        group.add(new THREE.Mesh(new THREE.BoxGeometry(s*1.2, s*0.1, s*0.8), matSupport.clone()));
        const casing = new THREE.Mesh(new THREE.CylinderGeometry(s*0.4, s*0.45, s*0.7, 16), mat);
        casing.position.set(0, s*0.4, 0); casing.castShadow = true; group.add(casing);
        
        const motor = new THREE.Mesh(new THREE.CylinderGeometry(s*0.3, s*0.3, s*0.6, 16), getMaterialBySpec('SS304', 'body'));
        motor.position.set(s*0.5, s*0.5, 0); motor.castShadow = true; group.add(motor);
        
        const nameplate = createNameplate(eq.tag, spec, eq.diametro ? (eq.diametro/25.4).toFixed(1) : '?');
        nameplate.position.set(0, s*0.2, s*0.5);
        group.add(nameplate);
        
        group.position.set(toM(eq.posX), toM(eq.posY), toM(eq.posZ));
        group.userData = { tag: eq.tag, tipo: 'equipo' };
        return group;
    }

    function createCompresor(eq) {
        const spec = eq.spec || 'ACERO_150_RF';
        const mat = getMaterialBySpec(spec, 'body');
        const s = toM(eq.diametro||1000);
        const group = new THREE.Group();
        
        const body = new THREE.Mesh(new THREE.BoxGeometry(s*1.2, s*0.9, s*0.7), mat);
        body.position.y = s*0.45; body.castShadow = true; group.add(body);
        group.add(new THREE.Mesh(new THREE.CylinderGeometry(s*0.3, s*0.35, s*0.5, 16), matSupport.clone())).position.set(0, s*0.9, 0);
        
        group.position.set(toM(eq.posX), toM(eq.posY), toM(eq.posZ));
        group.userData = { tag: eq.tag, tipo: 'equipo' };
        return group;
    }

    function createExchanger(eq) {
        const spec = eq.spec || 'ACERO_150_RF';
        const mat = getMaterialBySpec(spec, 'tank');
        const l = toM(eq.largo||4000), r = toM((eq.diametro||800)/2);
        const group = new THREE.Group();
        
        const shell = new THREE.Mesh(new THREE.CylinderGeometry(r, r, l, 24), mat);
        shell.rotation.z = Math.PI/2; shell.position.set(l/2, r*1.5, 0); shell.castShadow = true;
        group.add(shell);
        
        group.position.set(toM(eq.posX), toM(eq.posY), toM(eq.posZ));
        group.userData = { tag: eq.tag, tipo: 'equipo' };
        return group;
    }

    function createBoxEquip(eq) {
        const spec = eq.spec || 'ACERO_150_RF';
        const mat = getMaterialBySpec(spec, 'body');
        const xl = toM(eq.largo||eq.diametro||800), yh = toM(eq.altura||800), zw = toM(eq.ancho||eq.diametro||800);
        const group = new THREE.Group();
        
        const body = new THREE.Mesh(new THREE.BoxGeometry(xl, yh, zw), mat);
        body.position.y = yh/2; body.castShadow = true; body.receiveShadow = true;
        group.add(body);
        
        group.position.set(toM(eq.posX), toM(eq.posY), toM(eq.posZ));
        group.userData = { tag: eq.tag, tipo: 'equipo' };
        return group;
    }

    function createPlatform(eq) {
        const material = (eq.material || '').toUpperCase();
        const esConcreto = material.includes('CONCRETO') || material.includes('CEMENTO') || material.includes('HORMIGON');
        const esAluminio = material.includes('ALUMINIO') || material.includes('ALUMINUM');
        const w = toM(eq.largo || 6000), d = toM(eq.ancho || 3000), h = toM(eq.altura || 400);
        const group = new THREE.Group();
        
        let mat;
        if (esConcreto) mat = getMaterialBySpec('HORMIGON_ESTRUCTURAL', 'tank');
        else if (esAluminio) mat = getMaterialBySpec('ALUMINIO_ESTRUCTURAL', 'body');
        else mat = getMaterialBySpec('ACERO_150_RF', 'flange');
        
        const losa = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        losa.position.y = h/2; losa.castShadow = true; losa.receiveShadow = true;
        group.add(losa);
        
        const pilarGeo = new THREE.BoxGeometry(0.25, h*3, 0.25);
        const pilarMat = esConcreto ? getMaterialBySpec('HORMIGON_ESTRUCTURAL', 'body') : matSupport.clone();
        const posiciones = [{x:-w/2+0.2,z:-d/2+0.2},{x:w/2-0.2,z:-d/2+0.2},{x:w/2-0.2,z:d/2-0.2},{x:-w/2+0.2,z:d/2-0.2}];
        posiciones.forEach(function(pos){const p=new THREE.Mesh(pilarGeo,pilarMat);p.position.set(pos.x,-h*1.2,pos.z);p.castShadow=true;group.add(p);});
        
        if (eq.baranda !== false && !esConcreto) {
            const bMat = new THREE.MeshStandardMaterial({color:0xf59e0b,metalness:0.7,roughness:0.3});
            const posteGeo = new THREE.CylinderGeometry(0.015,0.015,1.1,8);
            for (let px=-w/2+0.3; px<=w/2-0.3; px+=1.5){[-1,1].forEach(function(side){const po=new THREE.Mesh(posteGeo,bMat);po.position.set(px,h+0.55,side*(d/2-0.05));group.add(po);});}
        }
        
        group.position.set(toM(eq.posX), toM(eq.posY), toM(eq.posZ));
        group.userData = { tag: eq.tag, tipo: 'equipo' };
        return group;
    }

    function createEquipmentMesh(eq) {
        if (!eq || !eq.tipo) return null;
        const tipo = (eq.tipo||'').toLowerCase();
        
        // Tanques verticales y torres
        if (tipo==='tanque_v'||tipo==='tanque_acero'||tipo==='torre'||tipo==='reactor'||tipo==='desgasificador'||tipo==='desmineralizador'||tipo==='suavizador'||tipo==='filtro_carbon'||tipo==='filtro_arena'||tipo==='clarificador'||tipo==='columna_fraccionadora'||tipo==='evaporador'||tipo==='cristalizador'||tipo==='absorbedor'||tipo==='stripper'||tipo==='reactor_encamisado'||tipo==='autoclave'||tipo==='agitador'||tipo==='centrifuga_discos'||tipo==='tanque_aseptico'||tipo==='espesador'||tipo==='separador')
            return createTankVertical(eq);
        
        // Tanques horizontales
        if (tipo==='tanque_h'||tipo==='separador_trifasico'||tipo==='slug_catcher'||tipo==='calentador_fuego_directo'||tipo==='secador_rotativo'||tipo==='centrifuga'||tipo==='filtro_tambor'||tipo==='molino')
            return createThreePhaseSeparator(eq);
        
        // Antorcha
        if (tipo==='antorcha')
            return createFlare(eq);
        
        // Skid
        if (tipo==='skid_inyeccion')
            return createChemicalSkid(eq);
        
        // Bombas
        if (tipo.includes('bomba')||tipo==='skid_inyeccion')
            return createBomba(eq);
        
        // Compresor
        if (tipo==='compresor')
            return createCompresor(eq);
        
        // Intercambiadores
        if (tipo==='intercambiador'||tipo==='caldera'||tipo==='condensador'||tipo==='pasteurizador'||tipo==='esterilizador_uht')
            return createExchanger(eq);
        
        // Plataformas
        if (tipo==='plataforma')
            return createPlatform(eq);
        
        // Default
        return createBoxEquip(eq);
    }

    // ================================================================
    // 6. TUBERÍAS CON CORDONES DE SOLDADURA
    // ================================================================
    function createPipeMesh(line) {
        const pts = _core.getLinePoints(line) || line._cachedPoints || line.points3D || [];
        if (pts.length < 2) return null;
        const spec = line.spec || 'ACERO_150_RF';
        const radius = diamToRadiusM(line.diameter||4);
        const isPPR = (line.spec||line.material||'').toUpperCase().includes('PPR');
        const vector3Points = pts.map(function(p){ return new THREE.Vector3(toM(p.x), toM(p.y), toM(p.z)); });
        const curve = new THREE.CatmullRomCurve3(vector3Points, false, 'catmullrom', 0);
        const segments = Math.min(Math.max(vector3Points.length*4, 32), 256);
        const pipeMaterial = getMaterialBySpec(spec, 'pipe');
        const pipe = new THREE.Mesh(new THREE.TubeGeometry(curve, segments, radius, 12, false), pipeMaterial);
        pipe.castShadow = true; pipe.receiveShadow = true;
        pipe.userData = { tag: line.tag, tipo: 'linea' };
        if (_engine) _engine.registerVisualMesh(line.tag, pipe);
        
        if (isPPR) {
            const totalLength = curve.getLength(), spacing = 1.5, numRings = Math.floor(totalLength/spacing);
            for (let i=1; i<numRings; i++) {
                const t = i*spacing/totalLength, pt = curve.getPointAt(t), tangent = curve.getTangentAt(t).normalize();
                const ring = new THREE.Mesh(new THREE.TorusGeometry(radius*1.25, radius*0.2, 8, 16), getMaterialBySpec(spec, 'flange'));
                ring.position.copy(pt); const q = new THREE.Quaternion(); q.setFromUnitVectors(new THREE.Vector3(0,0,1), tangent); ring.quaternion.copy(q);
                ring.userData = { isFusionRing: true };
            }
        } else {
            const totalLength = curve.getLength();
            const weldSpacing = 6;
            const numWelds = Math.floor(totalLength / weldSpacing);
            const weldMat = getMaterialBySpec(spec, 'flange');
            for (let w = 1; w <= numWelds; w++) {
                const tw = (w * weldSpacing) / totalLength;
                const pt = curve.getPointAt(Math.min(tw, 0.99));
                const tangent = curve.getTangentAt(Math.min(tw, 0.99)).normalize();
                const weldRing = new THREE.Mesh(new THREE.TorusGeometry(radius + 0.003, 0.005, 8, 16), weldMat);
                weldRing.position.copy(pt);
                const q = new THREE.Quaternion(); q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);
                weldRing.quaternion.copy(q);
            }
        }
        return pipe;
    }

    // ================================================================
    // 7. COMPONENTES (FITTINGS Y VÁLVULAS) - COMPLETO v4.1
    // ================================================================
    function createFitting(comp, pos3D, dirVec, size, compType, spec) {
        const type = (compType || comp.type || '').toUpperCase(), s = size;
        const mat = getMaterialBySpec(spec || 'ACERO_150_RF', 'pipe');
        const matDark = getMaterialBySpec(spec || 'ACERO_150_RF', 'flange');
        const group = new THREE.Group();

        if (type.includes('ELBOW_90') || type.includes('CODO_90')) {
            const curve = new THREE.EllipseCurve(0, 0, s * 1.5, s * 1.5, 0, Math.PI / 2, false, 0);
            const points = curve.getPoints(24);
            group.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(function(p) { return new THREE.Vector3(p.x, p.y, 0); })), 24, s * 0.4, 8, false), mat));
        } else if (type.includes('ELBOW_45') || type.includes('CODO_45')) {
            const curve = new THREE.EllipseCurve(0, 0, s * 1.5, s * 1.5, 0, Math.PI / 4, false, 0);
            const points = curve.getPoints(16);
            group.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(function(p) { return new THREE.Vector3(p.x, p.y, 0); })), 16, s * 0.4, 8, false), mat));
        } else if (type.includes('TEE_EQUAL') || type.includes('TEE_RECTA') || type.includes('TEE_PPR')) {
            const main = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.4, s * 0.4, s * 2.5, 16), mat);
            main.rotation.z = Math.PI / 2; group.add(main);
            const branch = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.35, s * 0.35, s * 1.2, 16), mat);
            branch.position.y = s * 0.7; group.add(branch);
            const collar = new THREE.Mesh(new THREE.TorusGeometry(s * 0.45, s * 0.08, 8, 16), matDark);
            collar.position.y = s * 0.1; collar.rotation.x = Math.PI / 2; group.add(collar);
        } else if (type.includes('TEE_REDUCING')) {
            const trm = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.4, s * 0.4, s * 2.5, 16), mat);
            trm.rotation.z = Math.PI / 2; group.add(trm);
            const trb = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.25, s * 0.25, s * 1.2, 16), mat);
            trb.position.y = s * 0.7; group.add(trb);
        } else if (type.includes('CROSS')) {
            const cm = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.35, s * 0.35, s * 2.5, 16), mat);
            cm.rotation.z = Math.PI / 2; group.add(cm);
            const cb1 = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.3, s * 0.3, s * 1.2, 16), mat);
            cb1.position.y = s * 0.7; group.add(cb1);
            const cb2 = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.3, s * 0.3, s * 1.2, 16), mat);
            cb2.position.y = -s * 0.7; group.add(cb2);
        } else if (type.includes('CONCENTRIC_REDUCER') || type.includes('REDUCTOR_CONCENTRICO')) {
            group.add(new THREE.Mesh(new THREE.CylinderGeometry(s * 0.5, s * 0.3, s * 1.8, 16), mat));
        } else if (type.includes('ECCENTRIC_REDUCER')) {
            const re = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.5, s * 0.3, s * 1.8, 16), mat);
            re.position.y = -s * 0.25; group.add(re);
        } else if (type.includes('SPECTACLE_BLIND')) {
            const blindPlate = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.6, s * 0.6, s * 0.05, 24), matDark);
            blindPlate.rotation.z = Math.PI/2; group.add(blindPlate);
            const handle = new THREE.Mesh(new THREE.BoxGeometry(s * 0.4, s * 0.05, s * 0.15), mat);
            handle.position.x = s * 0.35; group.add(handle);
        } else if (type.includes('INSULATING_JOINT')) {
            const jointBody = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.4, s * 0.4, s * 0.6, 16), mat);
            jointBody.rotation.z = Math.PI/2; group.add(jointBody);
            const insulator = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.45, s * 0.45, s * 0.1, 16), new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.5 }));
            insulator.rotation.z = Math.PI/2; insulator.position.x = 0.05; group.add(insulator);
            const insulator2 = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.45, s * 0.45, s * 0.1, 16), new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.5 }));
            insulator2.rotation.z = Math.PI/2; insulator2.position.x = -0.05; group.add(insulator2);
        } else if (type.includes('DETONATION_ARRESTER')) {
            const arresterBody = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.45, s * 0.45, s * 1.0, 16), new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.6, roughness: 0.25 }));
            arresterBody.rotation.z = Math.PI/2; group.add(arresterBody);
            const element = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.3, s * 0.3, s * 0.4, 8), new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xff6600, emissiveIntensity: 0.3 }));
            element.rotation.z = Math.PI/2; group.add(element);
        } else if (type.includes('PIG_LAUNCHER')) {
            const launcherBody = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.5, s * 0.5, s * 2.0, 16), mat);
            launcherBody.rotation.z = Math.PI/2; group.add(launcherBody);
            const reducerCone = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.35, s * 0.5, s * 0.6, 16), matDark);
            reducerCone.rotation.z = Math.PI/2; reducerCone.position.x = s * 1.0; group.add(reducerCone);
            const closure = new THREE.Mesh(new THREE.SphereGeometry(s * 0.35, 16, 8), matDark);
            closure.position.x = s * 1.35; group.add(closure);
        } else if (type.includes('STATIC_MIXER')) {
            const mixerBody = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.4, s * 0.4, s * 1.5, 16), mat);
            mixerBody.rotation.z = Math.PI/2; group.add(mixerBody);
            for (let i = -0.6; i <= 0.6; i += 0.4) {
                const vane = new THREE.Mesh(new THREE.BoxGeometry(s * 0.3, s * 0.05, s * 0.6), matDark);
                vane.position.x = i; vane.rotation.z = Math.PI/4; group.add(vane);
            }
        } else if (type.includes('AIR_DIFFUSER')) {
            const diffuserBase = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.3, s * 0.4, s * 0.3, 16), mat);
            diffuserBase.rotation.z = Math.PI/2; group.add(diffuserBase);
            const diffuserDome = new THREE.Mesh(new THREE.SphereGeometry(s * 0.35, 16, 8), new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.7 }));
            diffuserDome.position.x = s * 0.25; group.add(diffuserDome);
        } else if (type.includes('CHEMICAL_INJECTOR')) {
            const injectorBody = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.2, s * 0.2, s * 0.6, 8), mat);
            injectorBody.rotation.z = Math.PI/2; group.add(injectorBody);
            const injectionPort = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.08, s * 0.1, s * 0.3, 6), matDark);
            injectionPort.position.y = s * 0.3; group.add(injectionPort);
        } else if (type.includes('RUPTURE_DISC')) {
            const discBody = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.5, s * 0.5, s * 0.08, 24), new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.8 }));
            discBody.rotation.z = Math.PI/2; group.add(discBody);
            const cross = new THREE.Mesh(new THREE.BoxGeometry(s * 0.6, s * 0.02, s * 0.1), matDark);
            cross.rotation.z = Math.PI/4; group.add(cross);
            const cross2 = new THREE.Mesh(new THREE.BoxGeometry(s * 0.6, s * 0.02, s * 0.1), matDark);
            cross2.rotation.z = -Math.PI/4; group.add(cross2);
        } else if (type.includes('FLANGE') || type.includes('BRIDA') || type.includes('RTJ') || type.includes('ORIFICE')) {
            const fb = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.35, s * 0.35, s * 0.3, 16), mat);
            fb.rotation.z = Math.PI / 2; group.add(fb);
            const fd = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.6, s * 0.6, s * 0.1, 32), matDark);
            fd.rotation.z = Math.PI / 2; fd.position.x = s * 0.2; group.add(fd);
            for (let h = 0; h < Math.PI * 2; h += Math.PI / 3) {
                const hole = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.04, s * 0.04, s * 0.12, 8), matBlack.clone());
                hole.rotation.z = Math.PI / 2; hole.position.set(s * 0.2, Math.cos(h) * s * 0.45, Math.sin(h) * s * 0.45); group.add(hole);
            }
        } else if (type.includes('CAP') || type.includes('TAPON')) {
            group.add(new THREE.Mesh(new THREE.SphereGeometry(s * 0.45, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat));
        } else if (type.includes('UNION') || type.includes('UNION_ACERO')) {
            const ub = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.4, s * 0.4, s * 0.7, 16), mat);
            ub.rotation.z = Math.PI / 2; group.add(ub);
            const un = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.45, s * 0.45, s * 0.15, 6), matDark);
            un.rotation.z = Math.PI / 2; un.position.x = s * 0.4; group.add(un);
        } else if (type.includes('NIPPLE') || type.includes('NIPLE')) {
            group.add(new THREE.Mesh(new THREE.CylinderGeometry(s * 0.3, s * 0.3, s * 1.5, 16), mat));
        } else if (type.includes('BULKHEAD') || type.includes('PASAMUROS')) {
            const bh = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.3, s * 0.3, s * 1.2, 16), mat);
            bh.rotation.z = Math.PI / 2; group.add(bh);
            const bfg = new THREE.CylinderGeometry(s * 0.55, s * 0.55, s * 0.12, 32);
            const bf1 = new THREE.Mesh(bfg, matDark); bf1.rotation.z = Math.PI / 2; bf1.position.x = -s * 0.6; group.add(bf1);
            const bf2 = new THREE.Mesh(bfg, matDark); bf2.rotation.z = Math.PI / 2; bf2.position.x = s * 0.6; group.add(bf2);
        } else if (type.includes('EXPANSION_JOINT') || type.includes('JUNTA_EXPANSION')) {
            const ej = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.45, s * 0.45, s * 1.2, 16), mat);
            ej.rotation.z = Math.PI / 2; group.add(ej);
            for (let b = 0; b < 3; b++) {
                const bellows = new THREE.Mesh(new THREE.TorusGeometry(s * 0.5, s * 0.05, 8, 16), matDark);
                bellows.position.x = -s * 0.4 + b * s * 0.4; bellows.rotation.y = Math.PI / 2; group.add(bellows);
            }
        } else if (type.includes('Y_STRAINER') || type.includes('FILTRO_Y')) {
            const strainerType = type.includes('Y_') ? 'Y' : (type.includes('T_') ? 'T' : 'BASKET');
            const stBody = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.4, s * 0.4, s * 1.5, 16), mat);
            stBody.rotation.z = Math.PI / 2; group.add(stBody);
            if (strainerType === 'Y') {
                const yLeg = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.25, s * 0.25, s * 1.0, 8), mat);
                yLeg.position.set(0, -s * 0.7, 0); yLeg.rotation.x = Math.PI / 4; group.add(yLeg);
            }
            const stCap = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.3, s * 0.3, s * 0.2, 16), matDark);
            stCap.position.set(0, -s * 1.0, 0); group.add(stCap);
        } else if (type.includes('STEAM_TRAP') || type.includes('TRAMPA')) {
            const trap = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.3, s * 0.3, s * 0.9, 16), mat);
            trap.rotation.z = Math.PI / 2; group.add(trap);
            const trapTop = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.25, s * 0.3, s * 0.3, 16), matDark);
            trapTop.position.y = s * 0.5; group.add(trapTop);
        } else if (type.includes('CAMLOCK') || type.includes('CAM-LOCK')) {
            const cl = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.35, s * 0.35, s * 0.6, 16), mat);
            cl.rotation.z = Math.PI / 2; group.add(cl);
            for (let a = 0; a < Math.PI * 2; a += Math.PI) {
                const arm = new THREE.Mesh(new THREE.BoxGeometry(s * 0.08, s * 0.3, s * 0.05), matDark);
                arm.position.set(Math.cos(a) * s * 0.4, Math.sin(a) * s * 0.4, 0); group.add(arm);
            }
        } else if (type.includes('HOSE') || type.includes('MANGUERA')) {
            const hoseColor = type.includes('PTFE') ? 0xa78bfa : (type.includes('METALLIC') ? 0x94a3b8 : 0x22c55e);
            const hoseMat = new THREE.MeshStandardMaterial({ color: hoseColor, metalness: 0.1, roughness: 0.7 });
            group.add(new THREE.Mesh(new THREE.CylinderGeometry(s * 0.35, s * 0.35, s * 1.5, 16), hoseMat));
            for (let r = 0; r < 4; r++) {
                const rib = new THREE.Mesh(new THREE.TorusGeometry(s * 0.38, s * 0.03, 8, 16), matDark);
                rib.position.x = -s * 0.6 + r * s * 0.4; rib.rotation.y = Math.PI / 2; group.add(rib);
            }
        } else if (type.includes('PIPE_SHOE') || type.includes('ZAPATA')) {
            group.add(new THREE.Mesh(new THREE.BoxGeometry(s * 0.6, s * 0.3, s * 0.6), matSupport.clone()));
        } else if (type.includes('U_BOLT') || type.includes('U-BOLT')) {
            const ubGeo = new THREE.TorusGeometry(s * 0.4, s * 0.05, 8, 8, Math.PI);
            group.add(new THREE.Mesh(ubGeo, matSupport.clone()));
            const ubPlate = new THREE.Mesh(new THREE.BoxGeometry(s * 0.8, s * 0.04, s * 0.1), matSupport.clone());
            ubPlate.position.y = -s * 0.4; group.add(ubPlate);
        } else if (type.includes('ANCHOR') || type.includes('ANCLAJE')) {
            const anchorGeo = new THREE.BoxGeometry(s * 0.5, s * 0.5, s * 0.5);
            group.add(new THREE.Mesh(anchorGeo, new THREE.MeshStandardMaterial({ color: 0xdc2626, metalness: 0.7, roughness: 0.25 })));
        } else if (type.includes('HANGER') || type.includes('COLGADOR') || type.includes('SPRING')) {
            const hangerRod = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.05, s * 0.05, s * 1.5, 8), matSupport.clone());
            group.add(hangerRod);
            if (type.includes('SPRING')) {
                const springGeo = new THREE.TorusGeometry(s * 0.2, s * 0.04, 8, 16);
                for (let sp = 0; sp < 3; sp++) {
                    const spring = new THREE.Mesh(springGeo, matSupport.clone());
                    spring.position.y = sp * s * 0.2; group.add(spring);
                }
            }
        } else if (type.includes('GUIDE') || type.includes('GUIA')) {
            group.add(new THREE.Mesh(new THREE.BoxGeometry(s * 0.3, s * 0.6, s * 0.3), matSupport.clone()));
        } else {
            group.add(new THREE.Mesh(new THREE.SphereGeometry(s * 0.35, 8, 8), mat));
        }

        group.position.copy(pos3D);
        orientComponent(group, dirVec);
        group.userData = { tag: comp.tag, type: comp.type, isComponent: true };
        return group;
    }

    // ================================================================
    // 8. VÁLVULAS con materiales PBR
    // ================================================================
    function createValve(comp, pos3D, dirVec, size, compType, spec) {
        const type = (compType || comp.type || '').toUpperCase(), s = size;
        const mat = getMaterialBySpec(spec || 'ACERO_150_RF', 'valve');
        const matDark = getMaterialBySpec(spec || 'ACERO_150_RF', 'flange');
        const group = new THREE.Group();

        if (type.includes('GATE_VALVE') || type.includes('COMPUERTA')) {
            const body = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.35, s * 0.35, s * 1.4, 16), mat);
            body.rotation.z = Math.PI / 2; group.add(body);
            const bonnet = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.3, s * 0.35, s * 0.5, 16), matDark);
            bonnet.position.y = s * 0.55; group.add(bonnet);
            const stem = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.05, s * 0.05, s * 1.2, 8), matStem.clone());
            stem.position.y = s * 1.1; group.add(stem);
            const wheel = new THREE.Mesh(new THREE.TorusGeometry(s * 0.4, s * 0.06, 8, 24), matWheel.clone());
            wheel.position.y = s * 1.7; wheel.rotation.x = Math.PI / 2; group.add(wheel);
            for (let a = 0; a < Math.PI * 2; a += Math.PI / 3) {
                const spoke = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.03, s * 0.03, s * 0.35, 6), matWheel.clone());
                spoke.position.set(Math.cos(a) * s * 0.35, s * 1.7, Math.sin(a) * s * 0.35);
                spoke.rotation.z = Math.PI / 2; group.add(spoke);
            }
        } else if (type.includes('GLOBE_VALVE')) {
            const gBody = new THREE.Mesh(new THREE.SphereGeometry(s * 0.45, 16, 16), mat);
            gBody.scale.set(1, 1.2, 1); group.add(gBody);
            const gBonnet = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.25, s * 0.35, s * 0.5, 16), matDark);
            gBonnet.position.y = s * 0.7; group.add(gBonnet);
            const gStem = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.04, s * 0.04, s * 0.9, 8), matStem.clone());
            gStem.position.y = s * 1.15; group.add(gStem);
            const gWheel = new THREE.Mesh(new THREE.TorusGeometry(s * 0.3, s * 0.05, 8, 24), matWheel.clone());
            gWheel.position.y = s * 1.6; gWheel.rotation.x = Math.PI / 2; group.add(gWheel);
        } else if (type.includes('BALL_VALVE') || type.includes('BOLA')) {
            const bBody = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.4, s * 0.4, s * 1.0, 16), matDark);
            bBody.rotation.z = Math.PI / 2; group.add(bBody);
            const bBall = new THREE.Mesh(new THREE.SphereGeometry(s * 0.3, 16, 16), new THREE.MeshStandardMaterial({ color: 0xe0e0e0, metalness: 0.9, roughness: 0.1 }));
            group.add(bBall);
            const lever = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.04, s * 0.04, s * 1.0, 8), matDark);
            lever.position.y = s * 0.6; group.add(lever);
            const handle = new THREE.Mesh(new THREE.SphereGeometry(s * 0.09, 8, 8), matRed.clone());
            handle.position.y = s * 1.1; group.add(handle);
        } else if (type.includes('BUTTERFLY_VALVE') || type.includes('MARIPOSA')) {
            const mBody = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.4, s * 0.4, s * 0.3, 16), mat);
            mBody.rotation.z = Math.PI / 2; group.add(mBody);
            const disc = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.35, s * 0.35, s * 0.04, 16), matDark);
            disc.rotation.z = Math.PI / 2; group.add(disc);
            const mStem = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.04, s * 0.04, s * 0.7, 8), matStem.clone());
            mStem.position.y = s * 0.4; group.add(mStem);
            const mHandle = new THREE.Mesh(new THREE.BoxGeometry(s * 0.6, s * 0.04, s * 0.06), matDark);
            mHandle.position.y = s * 0.75; group.add(mHandle);
        } else if (type.includes('CHECK_VALVE') || type.includes('RETENCION')) {
            const cBody = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.35, s * 0.35, s * 1.2, 16), mat);
            cBody.rotation.z = Math.PI / 2; group.add(cBody);
            const arrow = new THREE.Mesh(new THREE.ConeGeometry(s * 0.12, s * 0.35, 8), new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x0a3d0a, emissiveIntensity: 0.5 }));
            arrow.position.x = s * 0.3; arrow.rotation.z = -Math.PI / 2; group.add(arrow);
        } else if (type.includes('DIAPHRAGM_VALVE') || type.includes('DIAFRAGMA')) {
            const dBody = new THREE.Mesh(new THREE.BoxGeometry(s * 1.0, s * 0.6, s * 0.8), mat); group.add(dBody);
            const dBonnet = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.25, s * 0.35, s * 0.5, 16), matDark);
            dBonnet.position.y = s * 0.5; group.add(dBonnet);
            const dWheel = new THREE.Mesh(new THREE.TorusGeometry(s * 0.3, s * 0.04, 8, 16), matWheel.clone());
            dWheel.position.y = s * 0.85; dWheel.rotation.x = Math.PI / 2; group.add(dWheel);
        } else if (type.includes('CONTROL_VALVE')) {
            const cvBody = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.35, s * 0.45, s * 1.2, 16), mat);
            cvBody.rotation.z = Math.PI / 2; group.add(cvBody);
            const actuator = new THREE.Mesh(new THREE.BoxGeometry(s * 0.5, s * 0.7, s * 0.5), new THREE.MeshStandardMaterial({ color: 0x3b82f6, metalness: 0.3, roughness: 0.4 }));
            actuator.position.y = s * 0.7; group.add(actuator);
        } else if (type.includes('RELIEF') || type.includes('SAFETY') || type.includes('ALIVIO') || type.includes('SEGURIDAD')) {
            const rBody = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.25, s * 0.35, s * 0.8, 16), new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.5, roughness: 0.3 }));
            group.add(rBody);
            const rCap = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.3, s * 0.3, s * 0.2, 16), matDark);
            rCap.position.y = s * 0.5; group.add(rCap);
        } else if (type.includes('DRAIN_VALVE') || type.includes('PURGA')) {
            const dv = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.2, s * 0.2, s * 0.6, 16), mat);
            dv.rotation.z = Math.PI / 2; group.add(dv);
            const dvHandle = new THREE.Mesh(new THREE.BoxGeometry(s * 0.3, s * 0.04, s * 0.04), matDark);
            dvHandle.position.y = s * 0.35; group.add(dvHandle);
        } else if (type.includes('PRESSURE_GAUGE') || type.includes('MANOMETRO')) {
            const pgBody = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.3, s * 0.3, s * 0.15, 32), matDark);
            group.add(pgBody);
            const pgDial = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.28, s * 0.28, s * 0.02, 32), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1 }));
            pgDial.position.z = s * 0.09; group.add(pgDial);
            const pgNeedle = new THREE.Mesh(new THREE.BoxGeometry(s * 0.01, s * 0.15, s * 0.01), matRed.clone());
            pgNeedle.position.z = s * 0.1; group.add(pgNeedle);
        } else if (type.includes('TEMPERATURE_GAUGE') || type.includes('TERMOMETRO')) {
            const tgStem = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.04, s * 0.04, s * 1.0, 8), matStem.clone());
            group.add(tgStem);
            const tgDial = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.2, s * 0.2, s * 0.1, 16), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.1 }));
            tgDial.position.y = s * 0.5; group.add(tgDial);
        } else if (type.includes('FLOW_METER') || type.includes('CAUDALIMETRO')) {
            const fm = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.35, s * 0.35, s * 0.8, 16), mat);
            fm.rotation.z = Math.PI / 2; group.add(fm);
            const fmDisplay = new THREE.Mesh(new THREE.BoxGeometry(s * 0.3, s * 0.4, s * 0.05), matDark);
            fmDisplay.position.y = s * 0.5; group.add(fmDisplay);
        } else if (type.includes('LEVEL_SWITCH_RANA')) {
            const ls = new THREE.Mesh(new THREE.BoxGeometry(s * 0.35, s * 0.25, s * 0.25), new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.3, roughness: 0.4 }));
            group.add(ls);
            const lsRod = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.04, s * 0.04, s * 0.6, 8), matStem.clone());
            lsRod.position.y = s * 0.4; group.add(lsRod);
        } else if (type.includes('PH_METER')) {
            const phBody = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.3, s * 0.3, s * 0.5, 16), new THREE.MeshStandardMaterial({ color: 0x0ea5e9, metalness: 0.3 }));
            group.add(phBody);
            const phProbe = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.08, s * 0.08, s * 0.8, 8), new THREE.MeshStandardMaterial({ color: 0x22c55e }));
            phProbe.position.y = -s * 0.4; group.add(phProbe);
        } else if (type.includes('CONDUCTIVITY_METER')) {
            const condBody = new THREE.Mesh(new THREE.BoxGeometry(s * 0.5, s * 0.4, s * 0.3), new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.5 }));
            group.add(condBody);
            const condSensor = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.06, s * 0.08, s * 0.6, 8), new THREE.MeshStandardMaterial({ color: 0xcbd5e1, metalness: 0.7 }));
            condSensor.position.y = -s * 0.35; group.add(condSensor);
        } else if (type.includes('ROTAMETER')) {
            const rotaTube = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.12, s * 0.15, s * 0.8, 16), new THREE.MeshStandardMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.6 }));
            group.add(rotaTube);
            const rotaFloat = new THREE.Mesh(new THREE.ConeGeometry(s * 0.1, s * 0.15, 8), new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 0.3 }));
            rotaFloat.position.y = s * 0.2; group.add(rotaFloat);
        } else if (type.includes('CORIOLIS_METER')) {
            const coriolisBase = new THREE.Mesh(new THREE.BoxGeometry(s * 0.6, s * 0.3, s * 0.4), new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.7 }));
            group.add(coriolisBase);
            const coriolisTube = new THREE.Mesh(new THREE.TorusGeometry(s * 0.25, s * 0.05, 16, 32), new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.85 }));
            coriolisTube.rotation.x = Math.PI/2; coriolisTube.position.y = s * 0.15; group.add(coriolisTube);
        } else {
            group.add(new THREE.Mesh(new THREE.SphereGeometry(s * 0.35, 8, 8), mat));
        }

        group.position.copy(pos3D);
        orientComponent(group, dirVec);
        group.userData = { tag: comp.tag, type: comp.type, isComponent: true };
        return group;
    }

    function isFitting(type) {
        const t = (type || '').toUpperCase();
        return t.includes('ELBOW') || t.includes('CODO') || t.includes('TEE') || t.includes('CROSS') ||
            t.includes('REDUCER') || t.includes('REDUCTOR') || t.includes('FLANGE') || t.includes('BRIDA') ||
            t.includes('BULKHEAD') || t.includes('PASAMUROS') || t.includes('CAP') || t.includes('TAPON') ||
            t.includes('UNION') || t.includes('NIPPLE') || t.includes('NIPLE') || t.includes('STUB_END') ||
            t.includes('PORTABRIDA') || t.includes('TRANSITION') || t.includes('ADAPTADOR') ||
            t.includes('EXPANSION') || t.includes('STRAINER') || t.includes('FILTRO') ||
            t.includes('STEAM_TRAP') || t.includes('TRAMPA') || t.includes('CAMLOCK') ||
            t.includes('QUICK_CONNECT') || t.includes('HOSE') || t.includes('MANGUERA') ||
            t.includes('SILENCER') || t.includes('FLAME_ARRESTER') || t.includes('ARRESTADOR') ||
            t.includes('VACUUM_BREAKER') || t.includes('ROMPEDOR') || t.includes('SAMPLE_COOLER') ||
            t.includes('PIPE_SHOE') || t.includes('ZAPATA') || t.includes('U_BOLT') || t.includes('GUIDE') ||
            t.includes('GUIA') || t.includes('ANCHOR') || t.includes('ANCLAJE') || t.includes('HANGER') ||
            t.includes('COLGADOR') || t.includes('SPRING') || t.includes('PIPE_CLAMP') || t.includes('ABRAZADERA') ||
            t.includes('SPECTACLE_BLIND') || t.includes('INSULATING_JOINT') || t.includes('DETONATION_ARRESTER') ||
            t.includes('PIG_LAUNCHER') || t.includes('STATIC_MIXER') || t.includes('AIR_DIFFUSER') ||
            t.includes('CHEMICAL_INJECTOR') || t.includes('RUPTURE_DISC');
    }

    // ================================================================
    // 9. REFRESCO Y RENDER
    // ================================================================
    function refreshAllSymbols() {
        if (!_core) return;
        deepDisposeGroup(_symbolGroup);
        const db = _core.getDb(); if (!db) return;
        _totalObjects = 0;

        const equipos = db.equipos || [];
        for (let i = 0; i < equipos.length; i++) {
            if (equipos[i].tag && equipos[i].tag.toString().startsWith('TEE-')) continue;
            const mesh = createEquipmentMesh(equipos[i]);
            if (mesh) { if (_engine) _engine.registerVisualMesh(equipos[i].tag, mesh); _symbolGroup.add(mesh); _totalObjects++; }
        }

        const lines = db.lines || [];
        for (let j = 0; j < lines.length; j++) {
            const line = lines[j];
            const pipe = createPipeMesh(line);
            if (pipe) { _symbolGroup.add(pipe); _totalObjects++; }
            if (line.components && line.components.length) {
                const pts = _core.getLinePoints(line) || line._cachedPoints || line.points3D || [];
                if (pts.length >= 2) {
                    let lengths = [], totalLen = 0;
                    for (let k = 0; k < pts.length - 1; k++) { const d = Math.hypot(pts[k + 1].x - pts[k].x, pts[k + 1].y - pts[k].y, pts[k + 1].z - pts[k].z); lengths.push(d); totalLen += d; }
                    line.components.forEach(function(comp) {
                        const param = comp.param || 0.5, targetLen = totalLen * Math.min(1, Math.max(0, param));
                        let accum = 0, segIdx = 0, t = 0;
                        for (let m = 0; m < lengths.length; m++) { if (accum + lengths[m] >= targetLen || m === lengths.length - 1) { segIdx = m; t = (targetLen - accum) / (lengths[m] || 1); break; } accum += lengths[m]; }
                        const pA = pts[segIdx], pB = pts[segIdx + 1];
                        const pos3D = new THREE.Vector3(toM(pA.x + (pB.x - pA.x) * t), toM(pA.y + (pB.y - pA.y) * t), toM(pA.z + (pB.z - pA.z) * t));
                        const dirVec = new THREE.Vector3(pB.x - pA.x, pB.y - pA.y, pB.z - pA.z).normalize();
                        const size = compSize(line.diameter || 4), spec = line.spec || line.material || 'ACERO_150_RF';
                        const symbol = isFitting(comp.type) ? createFitting(comp, pos3D, dirVec, size, comp.type, spec) : createValve(comp, pos3D, dirVec, size, comp.type, spec);
                        if (symbol) { _symbolGroup.add(symbol); _totalObjects++; }
                    });
                }
            }
        }
    }

    function refreshAllFlowArrows() {
        if (!_core) return;
        deepDisposeGroup(_flowArrowGroup);
        (_core.getDb().lines || []).forEach(function(line) {
            const pts = _core.getLinePoints(line) || [];
            if (pts.length < 2) return;
            const arrowSize = diamToRadiusM(line.diameter || 4) * 1.5;
            for (let i = 0; i < pts.length - 1; i++) {
                const mid = new THREE.Vector3(toM((pts[i].x + pts[i + 1].x) / 2), toM((pts[i].y + pts[i + 1].y) / 2) + arrowSize, toM((pts[i].z + pts[i + 1].z) / 2));
                const dir = new THREE.Vector3(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y, pts[i + 1].z - pts[i].z).normalize();
                const cone = new THREE.Mesh(new THREE.ConeGeometry(arrowSize, arrowSize * 2.5, 6, 6), new THREE.MeshStandardMaterial({ color: 0x00f2ff, emissive: 0x003344 }));
                cone.position.copy(mid); const q = new THREE.Quaternion(); q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir); cone.quaternion.copy(q);
                _flowArrowGroup.add(cone);
            }
        });
    }

    function fitCameraToEquipments() {
        if (!_engine) return;
        const scene = _engine.getScene(), camera = _engine.getCamera(), controls = _engine.getControls();
        if (!scene || !camera || !controls) return;
        const bounds = new THREE.Box3(); let has = false;
        scene.traverse(function(c) { if (c.isMesh && c.visible && c.geometry && !(c instanceof THREE.GridHelper || c instanceof THREE.ArrowHelper)) { bounds.expandByObject(c); has = true; } });
        if (!has) { camera.position.set(12, 8, 12); controls.target.set(0, 0, 0); controls.update(); return; }
        const center = bounds.getCenter(new THREE.Vector3()), size = bounds.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z, 1), dist = Math.min(maxDim * 1.3, 80);
        camera.position.set(center.x + dist * 0.8, center.y + dist * 0.6, center.z + dist * 0.8);
        controls.target.copy(center); controls.update();
    }

    function updateSelectionHighlight() {
        const sel = _core ? _core.getSelected() : null;
        if (_outlinePass && _outlinePass.enabled) _outlinePass.selectedObjects = (sel && sel.obj && _engine) ? [_engine.getVisualMesh(sel.obj.tag)].filter(Boolean) : [];
    }

    function scheduleRefresh() {
        if (_debounceTimer) clearTimeout(_debounceTimer);
        _debounceTimer = setTimeout(function() { refreshAllSymbols(); refreshAllFlowArrows(); }, 200);
    }

    function renderFrame() {
        if (!_rendererRef || !_sceneRef || !_cameraRef) return;
        if (_composer && _outlinePass && _outlinePass.enabled) _composer.render();
        else _rendererRef.render(_sceneRef, _cameraRef);
    }

    function init(coreInstance, engineInstance) {
        _core = coreInstance; _engine = engineInstance;
        if (!_engine) { console.error('SmartFlowRender: engineInstance requerido'); return; }
        _sceneRef = _engine.getScene(); _cameraRef = _engine.getCamera(); _rendererRef = _engine.getRenderer();
        if (!_sceneRef || !_cameraRef || !_rendererRef) { console.error('SmartFlowRender: Engine no inicializado'); return; }

        _symbolGroup.userData = { isSymbolGroup: true }; _symbolGroup.renderOrder = 1;
        _flowArrowGroup.userData = { isFlowArrowGroup: true }; _flowArrowGroup.renderOrder = 2;
        _dimensionGroup.userData = { isDimensionGroup: true }; _dimensionGroup.renderOrder = 3;

        _sceneRef.add(_symbolGroup); _sceneRef.add(_dimensionGroup); _sceneRef.add(_flowArrowGroup);

        if (typeof _core.on === 'function') _core.on('modelChanged', function() { scheduleRefresh(); });
        
        scheduleRefresh();
        console.log("✔ SmartFlowRender v4.1 - Motor 3D Industrial (100% catálogo)");
        console.log("  - Materiales: CS, SS, PPR, HDPE, PVC, CONCRETE, ALUMINUM, WOOD, TITANIUM, MONEL, INCONEL");
        console.log("  - Equipos: Tanques, bombas, torres, reactores, separadores, antorchas, skids");
        console.log("  - Válvulas: Gate, Globe, Ball, Butterfly, Check, Diaphragm, Control, Relief");
        console.log("  - Fittings: Tees, codos, reductores, bridas, uniones, soportes, especiales");
        console.log("  - Instrumentos: PG, TG, FM, LS, pH, Conductividad, Rotámetro, Coriolis");
    }

    function dispose() {
        deepDisposeGroup(_symbolGroup); deepDisposeGroup(_dimensionGroup); deepDisposeGroup(_flowArrowGroup);
        _materialCache.forEach(function(m) { m.dispose(); });
        _materialCache.clear();
        _core = null; _engine = null;
    }

    // ================================================================
    // 10. API PÚBLICA
    // ================================================================
    return {
        init: init,
        fitCameraToEquipments: fitCameraToEquipments,
        refreshAllSymbols: refreshAllSymbols,
        refreshAllFlowArrows: refreshAllFlowArrows,
        updateSelectionHighlight: updateSelectionHighlight,
        renderFrame: renderFrame,
        scheduleRefresh: scheduleRefresh,
        dispose: dispose,
        createEquipmentMesh: createEquipmentMesh,
        createPipeMesh: createPipeMesh,
        createFitting: createFitting,
        createValve: createValve,
        getMaterialBySpec: getMaterialBySpec,
        createNameplate: createNameplate,
        getComposer: function() { return _composer; },
        getOutlinePass: function() { return _outlinePass; },
        setLabelRenderer: function(lr) { _labelRenderer = lr; },
        // Métodos para nuevos equipos
        createFlare: createFlare,
        createThreePhaseSeparator: createThreePhaseSeparator,
        createChemicalSkid: createChemicalSkid,
        // Métodos de texturas
        createMetalTexture: createMetalTexture,
        createWoodTexture: function() {
            const canvas = document.createElement('canvas');
            canvas.width = 1024; canvas.height = 1024;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#8b6914'; ctx.fillRect(0, 0, 1024, 1024);
            for (let i = 0; i < 800; i++) {
                const x = Math.random() * 1024;
                const y = Math.random() * 1024;
                const width = 2 + Math.random() * 8;
                ctx.fillStyle = `rgba(60, 40, 20, ${0.1 + Math.random() * 0.3})`;
                ctx.fillRect(x, y, width, 1);
            }
            const texture = new THREE.CanvasTexture(canvas);
            texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(4, 4);
            return texture;
        }
    };
})();

// Exponer globalmente
if (typeof window !== 'undefined') {
    window.SmartFlowRender = SmartFlowRender;
}
