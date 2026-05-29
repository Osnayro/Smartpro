// ============================================================
// SMARTFLOW RENDER 3D v4.0 - Nivel 2 Industrial Realism
// Archivo: js/render.js - PARTE 1 DE 2
// Three.js 0.160.0 + Materiales PBR + Texturas procedurales
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
    // 1. CATÁLOGO DE MATERIALES INDUSTRIALES NIVEL 2
    // ================================================================
    const IndustrialMaterials = {
        'CS': { name: 'Carbon Steel', color: 0x8a9aaa, roughness: 0.55, metalness: 0.85, pattern: 'brushed', envMapIntensity: 0.8, rust: true, weldMarks: true, clearcoat: 0.1 },
        'CS_PAINTED': { name: 'Painted Carbon Steel', color: 0x5c8a6a, roughness: 0.65, metalness: 0.12, pattern: 'none', envMapIntensity: 0.4, rust: false, weldMarks: false, clearcoat: 0.25 },
        'SS304': { name: 'Stainless Steel 304', color: 0xc8d0d8, roughness: 0.32, metalness: 0.92, pattern: 'brushed', envMapIntensity: 1.2, rust: false, weldMarks: true, clearcoat: 0.4 },
        'SS316': { name: 'Stainless Steel 316', color: 0xd8e0e8, roughness: 0.25, metalness: 0.95, pattern: 'brushed', envMapIntensity: 1.4, rust: false, weldMarks: false, clearcoat: 0.5 },
        'CS_GALVANIZED': { name: 'Galvanized Steel', color: 0x9aaaba, roughness: 0.48, metalness: 0.88, pattern: 'spangled', envMapIntensity: 0.9, rust: false, weldMarks: true },
        'PPR': { name: 'PPR (Polypropylene)', color: 0x8b5cf6, roughness: 0.55, metalness: 0.05, pattern: 'plastic', envMapIntensity: 0.25, plasticGloss: 0.4, clearcoat: 0.15 },
        'PVC': { name: 'PVC', color: 0xeab308, roughness: 0.6, metalness: 0.03, pattern: 'plastic', envMapIntensity: 0.2, plasticGloss: 0.35 },
        'CPVC': { name: 'CPVC', color: 0xcbd5e1, roughness: 0.58, metalness: 0.04, pattern: 'plastic', envMapIntensity: 0.25 },
        'HDPE': { name: 'HDPE', color: 0x3b82f6, roughness: 0.58, metalness: 0.02, pattern: 'plastic', envMapIntensity: 0.25 },
        'FRP': { name: 'FRP (Fiberglass)', color: 0x8b5cf6, roughness: 0.52, metalness: 0.08, pattern: 'woven', envMapIntensity: 0.35 },
        'BRASS': { name: 'Brass', color: 0xd4a574, roughness: 0.32, metalness: 0.88, pattern: 'brushed', envMapIntensity: 1.0 },
        'RUBBER': { name: 'Rubber', color: 0x333333, roughness: 0.85, metalness: 0.02, pattern: 'matte', envMapIntensity: 0.15 },
        'GLASS': { name: 'Glass', color: 0xaaddff, roughness: 0.08, metalness: 0.05, transparent: true, opacity: 0.65, envMapIntensity: 1.5 },
        'CERAMIC': { name: 'Ceramic', color: 0xf0f0f0, roughness: 0.15, metalness: 0.02, pattern: 'glazed', envMapIntensity: 0.7 },
        'CONCRETE': { name: 'Concrete', color: 0x9ca3af, roughness: 0.85, metalness: 0.05, pattern: 'matte', envMapIntensity: 0.1 }
    };

    const SpecMaterialMap = {
        'PPR_PN12_5': 'PPR', 'HDPE_PE100': 'HDPE', 'PVC_SCH80': 'PVC', 'PVC_SCH40': 'PVC',
        'CPVC_SCH80': 'CPVC', 'PVDF_PN16': 'PVC', 'FRP': 'FRP',
        'ACERO_150_RF': 'CS', 'ACERO_SCH80': 'CS', 'A1A': 'CS',
        'CS_300_RF': 'CS', 'CS_600_RF': 'CS', 'CS_900_RF': 'CS', 'CS_1500_RTJ': 'CS',
        'SS_150_RF': 'SS304', 'SS_300_RF': 'SS304', 'SS_600_RF': 'SS316',
        'SS_SANITARY': 'SS316', 'A3B': 'SS304', 'DUPLEX_150_RF': 'SS304',
        'PTFE_LINED': 'CS_PAINTED', 'RUBBER_LINED': 'RUBBER', 'GLASS_LINED': 'GLASS',
        'CS_CRYO': 'CS', 'HORMIGON_ESTRUCTURAL': 'CONCRETE'
    };

    const _materialCache = new Map();

    // ================================================================
    // 2. TEXTURA PROCEDURAL
    // ================================================================
    function createMetalTexture(baseColor, roughness, metalness, pattern, options) {
        options = options || {};
        const canvas = document.createElement('canvas');
        canvas.width = 1024; canvas.height = 1024;
        const ctx = canvas.getContext('2d');
        const r = ((baseColor >> 16) & 255) / 255, g = ((baseColor >> 8) & 255) / 255, b = (baseColor & 255) / 255;
        ctx.fillStyle = 'rgb(' + (r*255) + ',' + (g*255) + ',' + (b*255) + ')';
        ctx.fillRect(0, 0, 1024, 1024);
        for (let i = 0; i < 12000; i++) {
            const x = Math.random() * 1024, y = Math.random() * 1024;
            const intensity = (Math.random() - 0.5) * 0.12;
            const val = Math.max(0, Math.min(255, (r + intensity) * 255));
            ctx.fillStyle = 'rgb(' + val + ',' + (val*0.95) + ',' + (val*0.9) + ')';
            ctx.fillRect(x, y, Math.random()*2+1, Math.random()*2+1);
        }
        if (pattern === 'brushed' || options.brushed) {
            ctx.strokeStyle = 'rgba(220,220,240,0.05)'; ctx.lineWidth = 1.2;
            for (let y = 0; y < 1024; y += 3) {
                ctx.beginPath(); const offset = (Math.random()-0.5)*2;
                ctx.moveTo(0, y+offset); ctx.lineTo(1024, y+offset+(Math.random()-0.5)*1.5); ctx.stroke();
            }
        }
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
        if (options.wear) {
            ctx.strokeStyle = 'rgba(80,80,100,0.06)'; ctx.lineWidth = 0.8;
            for (let i = 0; i < 800; i++) {
                ctx.beginPath(); const sx = Math.random()*1024, sy = Math.random()*1024;
                ctx.moveTo(sx, sy); ctx.lineTo(sx+(Math.random()-0.5)*15, sy+(Math.random()-0.5)*15); ctx.stroke();
            }
        }
        if (pattern === 'plastic') {
            for (let i = 0; i < 8000; i++) {
                const brightness = 20+Math.random()*30;
                ctx.fillStyle = 'rgba(' + brightness + ',' + brightness + ',' + brightness + ',0.04)';
                ctx.fillRect(Math.random()*1024, Math.random()*1024, 1, 1);
            }
        }
        if (pattern === 'woven') {
            ctx.strokeStyle = 'rgba(100,100,120,0.1)'; ctx.lineWidth = 1.5;
            for (let x = 0; x < 1024; x += 24) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,1024); ctx.stroke(); }
            for (let y = 0; y < 1024; y += 24) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(1024,y); ctx.stroke(); }
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
                brushed: finalDef.pattern === 'brushed', rust: finalDef.rust || false,
                wear: true, repeatX: componentType === 'pipe' ? 4 : 2, repeatY: componentType === 'pipe' ? 2 : 2
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
    // 5. EQUIPOS 3D (100% del catálogo) con materiales PBR
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

    function createPlataforma(eq) {
        const material = (eq.material || '').toUpperCase();
        const esConcreto = material.includes('CONCRETO') || material.includes('CEMENTO') || material.includes('HORMIGON');
        const w = toM(eq.largo || 6000), d = toM(eq.ancho || 3000), h = toM(eq.altura || 400);
        const group = new THREE.Group();
        if (esConcreto) {
            const losa = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), getMaterialBySpec('HORMIGON_ESTRUCTURAL', 'tank'));
            losa.position.y = h/2; losa.castShadow = true; losa.receiveShadow = true; group.add(losa);
            const pilarGeo = new THREE.BoxGeometry(0.25, h*3, 0.25);
            const pilarMat = getMaterialBySpec('HORMIGON_ESTRUCTURAL', 'body');
            const posiciones = [{x:-w/2+0.2,z:-d/2+0.2},{x:w/2-0.2,z:-d/2+0.2},{x:w/2-0.2,z:d/2-0.2},{x:-w/2+0.2,z:d/2-0.2}];
            posiciones.forEach(function(pos){const p=new THREE.Mesh(pilarGeo,pilarMat);p.position.set(pos.x,-h*1.2,pos.z);p.castShadow=true;group.add(p);});
        } else {
            const piso = new THREE.Mesh(new THREE.BoxGeometry(w, h*0.2, d), getMaterialBySpec('ACERO_150_RF', 'flange'));
            piso.position.y = h; piso.receiveShadow = true; group.add(piso);
            const colGeo = new THREE.BoxGeometry(0.15, h*3, 0.15);
            const colMat = getMaterialBySpec('ACERO_150_RF', 'body');
            [{x:-w/2+0.2,z:-d/2+0.2},{x:w/2-0.2,z:-d/2+0.2},{x:w/2-0.2,z:d/2-0.2},{x:-w/2+0.2,z:d/2-0.2}].forEach(function(pos){const c=new THREE.Mesh(colGeo,colMat);c.position.set(pos.x,-h*1.2,pos.z);c.castShadow=true;group.add(c);});
            if (eq.baranda !== false) {
                const bMat = new THREE.MeshStandardMaterial({color:0xf59e0b,metalness:0.7,roughness:0.3});
                const posteGeo = new THREE.CylinderGeometry(0.015,0.015,1.1,8);
                for (let px=-w/2+0.3; px<=w/2-0.3; px+=1.5){[-1,1].forEach(function(side){const po=new THREE.Mesh(posteGeo,bMat);po.position.set(px,h+0.55,side*(d/2-0.05));group.add(po);});}
            }
        }
        group.position.set(toM(eq.posX), toM(eq.posY), toM(eq.posZ));
        group.userData = { tag: eq.tag, tipo: 'equipo' };
        return group;
    }

    function createEquipmentMesh(eq) {
        if (!eq || !eq.tipo) return null;
        const tipo = (eq.tipo||'').toLowerCase();
        if (tipo==='tanque_v'||tipo==='tanque_acero'||tipo==='torre'||tipo==='reactor'||tipo==='desgasificador'||tipo==='desmineralizador'||tipo==='suavizador'||tipo==='filtro_carbon'||tipo==='filtro_arena'||tipo==='clarificador'||tipo==='columna_fraccionadora'||tipo==='evaporador'||tipo==='cristalizador'||tipo==='absorbedor'||tipo==='stripper'||tipo==='reactor_encamisado'||tipo==='autoclave'||tipo==='agitador'||tipo==='centrifuga_discos'||tipo==='tanque_aseptico'||tipo==='espesador'||tipo==='separador'||tipo==='antorcha') return createTankVertical(eq);
        if (tipo==='tanque_h'||tipo==='separador_trifasico'||tipo==='slug_catcher'||tipo==='calentador_fuego_directo'||tipo==='secador_rotativo'||tipo==='centrifuga'||tipo==='filtro_tambor'||tipo==='molino') return createTankHorizontal(eq);
        if (tipo.includes('bomba')||tipo==='skid_inyeccion') return createBomba(eq);
        if (tipo==='compresor') return createCompresor(eq);
        if (tipo==='intercambiador'||tipo==='caldera'||tipo==='condensador'||tipo==='pasteurizador'||tipo==='esterilizador_uht') return createExchanger(eq);
        if (tipo==='plataforma') return createPlataforma(eq);
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
    // 7. COMPONENTES (FITTINGS Y VÁLVULAS) con materiales PBR
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
        } else if (type.includes('FLANGE') || type.includes('BRIDA') || type.includes('RTJ') || type.includes('ORIFICE')) {
            const fb = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.35, s * 0.35, s * 0.3, 16), mat);
            fb.rotation.z = Math.PI / 2; group.add(fb);
            const fd = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.6, s * 0.6, s * 0.1, 32), matDark);
            fd.rotation.z = Math.PI / 2; fd.position.x = s * 0.2; group.add(fd);
            for (let h = 0; h < Math.PI * 2; h += Math.PI / 3) {
                const hole = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.04, s * 0.04, s * 0.12, 8), matBlack.clone());
                hole.rotation.z = Math.PI / 2; hole.position.set(s * 0.2, Math.cos(h) * s * 0.45, Math.sin(h) * s * 0.45); group.add(hole);
            }
        } else if (type.includes('BULKHEAD') || type.includes('PASAMUROS')) {
            const bh = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.3, s * 0.3, s * 1.2, 16), mat);
            bh.rotation.z = Math.PI / 2; group.add(bh);
            const bfg = new THREE.CylinderGeometry(s * 0.55, s * 0.55, s * 0.12, 32);
            const bf1 = new THREE.Mesh(bfg, matDark); bf1.rotation.z = Math.PI / 2; bf1.position.x = -s * 0.6; group.add(bf1);
            const bf2 = new THREE.Mesh(bfg, matDark); bf2.rotation.z = Math.PI / 2; bf2.position.x = s * 0.6; group.add(bf2);
            const gask = new THREE.Mesh(new THREE.TorusGeometry(s * 0.45, s * 0.04, 8, 16), matGreen.clone());
            gask.position.x = -s * 0.65; gask.rotation.y = Math.PI / 2; group.add(gask);
        } else if (type.includes('STUB_END') || type.includes('PORTABRIDA')) {
            const se = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.35, s * 0.45, s * 0.5, 16), mat);
            se.rotation.z = Math.PI / 2; group.add(se);
            const sef = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.55, s * 0.55, s * 0.1, 32), matDark);
            sef.rotation.z = Math.PI / 2; sef.position.x = s * 0.3; group.add(sef);
        } else if (type.includes('CAP') || type.includes('TAPON')) {
            group.add(new THREE.Mesh(new THREE.SphereGeometry(s * 0.45, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat));
        } else if (type.includes('UNION')) {
            const ub = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.4, s * 0.4, s * 0.7, 16), mat);
            ub.rotation.z = Math.PI / 2; group.add(ub);
            const un = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.45, s * 0.45, s * 0.15, 6), matDark);
            un.rotation.z = Math.PI / 2; un.position.x = s * 0.4; group.add(un);
        } else if (type.includes('NIPPLE') || type.includes('NIPLE')) {
            group.add(new THREE.Mesh(new THREE.CylinderGeometry(s * 0.3, s * 0.3, s * 1.5, 16), mat));
        } else if (type.includes('TRANSITION') || type.includes('ADAPTADOR')) {
            const trGeo = new THREE.CylinderGeometry(s * 0.4, s * 0.5, s * 1.0, 16);
            group.add(new THREE.Mesh(trGeo, mat));
            const trNut = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.5, s * 0.5, s * 0.15, 6), matDark);
            trNut.rotation.z = Math.PI / 2; trNut.position.x = s * 0.5; group.add(trNut);
        } else if (type.includes('EXPANSION_JOINT') || type.includes('JUNTA_EXPANSION')) {
            const ej = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.45, s * 0.45, s * 1.2, 16), mat);
            ej.rotation.z = Math.PI / 2; group.add(ej);
            for (let b = 0; b < 3; b++) {
                const bellows = new THREE.Mesh(new THREE.TorusGeometry(s * 0.5, s * 0.05, 8, 16), matDark);
                bellows.position.x = -s * 0.4 + b * s * 0.4; bellows.rotation.y = Math.PI / 2; group.add(bellows);
            }
        } else if (type.includes('STRAINER') || type.includes('FILTRO')) {
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
        } else if (type.includes('QUICK_CONNECT') || type.includes('CONEXION_RAPIDA')) {
            const qc = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.35, s * 0.35, s * 0.5, 16), matBrass.clone());
            qc.rotation.z = Math.PI / 2; group.add(qc);
            const qcRing = new THREE.Mesh(new THREE.TorusGeometry(s * 0.4, s * 0.04, 8, 16), matDark);
            qcRing.rotation.y = Math.PI / 2; group.add(qcRing);
        } else if (type.includes('HOSE') || type.includes('MANGUERA')) {
            const hoseColor = type.includes('PTFE') ? 0xa78bfa : (type.includes('METALLIC') ? 0x94a3b8 : 0x22c55e);
            const hoseMat = new THREE.MeshStandardMaterial({ color: hoseColor, metalness: 0.1, roughness: 0.7 });
            group.add(new THREE.Mesh(new THREE.CylinderGeometry(s * 0.35, s * 0.35, s * 1.5, 16), hoseMat));
            for (let r = 0; r < 4; r++) {
                const rib = new THREE.Mesh(new THREE.TorusGeometry(s * 0.38, s * 0.03, 8, 16), matDark);
                rib.position.x = -s * 0.6 + r * s * 0.4; rib.rotation.y = Math.PI / 2; group.add(rib);
            }
        } else if (type.includes('SILENCER') || type.includes('SILENCIADOR')) {
            const sil = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.4, s * 0.5, s * 1.5, 16), mat); group.add(sil);
            const silCap1 = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.5, s * 0.5, s * 0.1, 16), matDark);
            silCap1.position.y = s * 0.8; group.add(silCap1);
            const silCap2 = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.4, s * 0.4, s * 0.1, 16), matDark);
            silCap2.position.y = -s * 0.8; group.add(silCap2);
        } else if (type.includes('FLAME_ARRESTER') || type.includes('ARRESTADOR')) {
            const fa = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.35, s * 0.35, s * 0.9, 16), new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.5, roughness: 0.3 }));
            fa.rotation.z = Math.PI / 2; group.add(fa);
            const faGrid = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.3, s * 0.3, s * 0.05, 32), matBlack.clone()); group.add(faGrid);
        } else if (type.includes('VACUUM_BREAKER') || type.includes('ROMPEDOR')) {
            const vb = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.2, s * 0.3, s * 0.7, 16), new THREE.MeshStandardMaterial({ color: 0x0ea5e9, metalness: 0.5, roughness: 0.3 }));
            group.add(vb);
            const vbCap = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.3, s * 0.3, s * 0.1, 16), matDark);
            vbCap.position.y = s * 0.4; group.add(vbCap);
        } else if (type.includes('SAMPLE_COOLER') || type.includes('ENFRIADOR')) {
            const sc = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.3, s * 0.3, s * 1.0, 16), mat);
            sc.rotation.z = Math.PI / 2; group.add(sc);
            const scJacket = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.4, s * 0.4, s * 0.8, 16), new THREE.MeshStandardMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.4 }));
            scJacket.rotation.z = Math.PI / 2; group.add(scJacket);
        } else if (type.includes('PIPE_SHOE') || type.includes('ZAPATA')) {
            group.add(new THREE.Mesh(new THREE.BoxGeometry(s * 0.6, s * 0.3, s * 0.6), matSupport.clone()));
        } else if (type.includes('U_BOLT') || type.includes('U-BOLT')) {
            const ubGeo = new THREE.TorusGeometry(s * 0.4, s * 0.05, 8, 8, Math.PI);
            group.add(new THREE.Mesh(ubGeo, matSupport.clone()));
            const ubPlate = new THREE.Mesh(new THREE.BoxGeometry(s * 0.8, s * 0.04, s * 0.1), matSupport.clone());
            ubPlate.position.y = -s * 0.4; group.add(ubPlate);
        } else if (type.includes('GUIDE') || type.includes('GUIA')) {
            group.add(new THREE.Mesh(new THREE.BoxGeometry(s * 0.3, s * 0.6, s * 0.3), matSupport.clone()));
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
        } else if (type.includes('PIPE_CLAMP') || type.includes('ABRAZADERA')) {
            const clampGeo = new THREE.TorusGeometry(s * 0.45, s * 0.05, 8, 16);
            group.add(new THREE.Mesh(clampGeo, matSupport.clone()));
        } else if (type.includes('SPECTACLE_BLIND')) {
            group.add(new THREE.Mesh(new THREE.CylinderGeometry(s * 0.6, s * 0.6, s * 0.08, 32), matDark));
        } else if (type.includes('INSULATING_JOINT')) {
            group.add(new THREE.Mesh(new THREE.CylinderGeometry(s * 0.5, s * 0.5, s * 0.8, 16), mat));
        } else if (type.includes('DETONATION_ARRESTER')) {
            group.add(new THREE.Mesh(new THREE.CylinderGeometry(s * 0.45, s * 0.45, s * 1.2, 16), new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.6, roughness: 0.25 })));
        } else if (type.includes('PIG_LAUNCHER')) {
            group.add(new THREE.Mesh(new THREE.CylinderGeometry(s * 0.5, s * 0.5, s * 2.0, 16), mat));
        } else if (type.includes('STATIC_MIXER')) {
            group.add(new THREE.Mesh(new THREE.CylinderGeometry(s * 0.35, s * 0.35, s * 1.5, 16), mat));
        } else if (type.includes('AIR_DIFFUSER')) {
            group.add(new THREE.Mesh(new THREE.SphereGeometry(s * 0.4, 8, 8), new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.7 })));
        } else if (type.includes('CHEMICAL_INJECTOR') || type.includes('CHLORINE_EJECTOR')) {
            group.add(new THREE.Mesh(new THREE.CylinderGeometry(s * 0.15, s * 0.15, s * 1.0, 8), mat));
        } else if (type.includes('RUPTURE_DISC')) {
            group.add(new THREE.Mesh(new THREE.CylinderGeometry(s * 0.5, s * 0.5, s * 0.1, 32), new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.8, roughness: 0.2 })));
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
        } else if (type.includes('AIR_RELEASE') || type.includes('LIBERACION')) {
            const ar = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.15, s * 0.2, s * 0.5, 16), mat); group.add(ar);
            const arVent = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.05, s * 0.05, s * 0.2, 8), matBlack.clone());
            arVent.position.y = s * 0.3; group.add(arVent);
        } else if (type.includes('SAMPLE_VALVE') || type.includes('MUESTREO')) {
            const sv = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.2, s * 0.2, s * 0.5, 16), mat);
            sv.rotation.z = Math.PI / 2; group.add(sv);
            const svPort = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.08, s * 0.08, s * 0.3, 8), matDark);
            svPort.position.y = s * 0.3; group.add(svPort);
            const svKnob = new THREE.Mesh(new THREE.SphereGeometry(s * 0.08, 6, 6), matRed.clone());
            svKnob.position.y = s * 0.5; group.add(svKnob);
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
        } else if (type.includes('LEVEL_SWITCH') || type.includes('SWITCH_RANA')) {
            const ls = new THREE.Mesh(new THREE.BoxGeometry(s * 0.35, s * 0.25, s * 0.25), new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.3, roughness: 0.4 }));
            group.add(ls);
            const lsRod = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.04, s * 0.04, s * 0.6, 8), matStem.clone());
            lsRod.position.y = s * 0.4; group.add(lsRod);
        } else if (type.includes('PLUG_VALVE') || type.includes('TAPON')) {
            const pvBody = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.35, s * 0.35, s * 1.0, 16), mat);
            pvBody.rotation.z = Math.PI / 2; group.add(pvBody);
            const pvStem = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.04, s * 0.04, s * 0.6, 8), matStem.clone());
            pvStem.position.y = s * 0.5; group.add(pvStem);
        } else if (type.includes('CHOKE_VALVE')) {
            const chBody = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.3, s * 0.4, s * 1.2, 16), matDark);
            chBody.rotation.z = Math.PI / 2; group.add(chBody);
        } else if (type.includes('CRYOGENIC_VALVE')) {
            const cvBody = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.3, s * 0.3, s * 1.5, 16), new THREE.MeshStandardMaterial({ color: 0x6366f1, metalness: 0.5, roughness: 0.3 }));
            cvBody.rotation.z = Math.PI / 2; group.add(cvBody);
        } else if (type.includes('GLASS_LINED_VALVE')) {
            const glvBody = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.35, s * 0.35, s * 1.2, 16), new THREE.MeshStandardMaterial({ color: 0xf0f9ff, metalness: 0.2, roughness: 0.2 }));
            glvBody.rotation.z = Math.PI / 2; group.add(glvBody);
        } else if (type.includes('ASEPTIC_VALVE') || type.includes('ASÉPTICA')) {
            const avBody = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.3, s * 0.3, s * 1.0, 16), new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.6, roughness: 0.2 }));
            avBody.rotation.z = Math.PI / 2; group.add(avBody);
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
            t.includes('SILENCER') || t.includes('SILENCIADOR') || t.includes('FLAME_ARRESTER') ||
            t.includes('ARRESTADOR') || t.includes('VACUUM_BREAKER') || t.includes('ROMPEDOR') ||
            t.includes('SAMPLE_COOLER') || t.includes('ENFRIADOR') ||
            t.includes('PIPE_SHOE') || t.includes('ZAPATA') || t.includes('U_BOLT') ||
            t.includes('GUIDE') || t.includes('GUIA') || t.includes('ANCHOR') || t.includes('ANCLAJE') ||
            t.includes('HANGER') || t.includes('COLGADOR') || t.includes('SPRING') ||
            t.includes('PIPE_CLAMP') || t.includes('ABRAZADERA') || t.includes('SPECTACLE_BLIND') ||
            t.includes('INSULATING_JOINT') || t.includes('DETONATION_ARRESTER') ||
            t.includes('PIG_LAUNCHER') || t.includes('STATIC_MIXER') ||
            t.includes('AIR_DIFFUSER') || t.includes('CHEMICAL_INJECTOR') || t.includes('CHLORINE_EJECTOR') ||
            t.includes('RUPTURE_DISC');
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
        if (_labelRenderer && _sceneRef && _cameraRef) _labelRenderer.render(_sceneRef, _cameraRef);
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

        if (typeof SmartFlowLabels3D !== 'undefined') {
            SmartFlowLabels3D.init(coreInstance, engineInstance);
            setTimeout(function() { SmartFlowLabels3D.refreshAllLabels(); SmartFlowLabels3D.refreshAllDimensions(); }, 800);
        }

        if (typeof _core.on === 'function') _core.on('modelChanged', function() { scheduleRefresh(); });
        window.set3DView = function(type) { _engine.setView(type); };
        scheduleRefresh();
        console.log("✔ SmartFlowRender v4.0 - Nivel 2 Industrial Realism");
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
        setLabelRenderer: function(lr) { _labelRenderer = lr; }
    };
})();

window.SmartFlowRender = SmartFlowRender;

