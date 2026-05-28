
// ============================================================
// SMARTFLOW RENDER 3D v3.0 - Three.js 0.160.0
// Archivo: js/render.js
// ============================================================
import * as THREE from 'three';

const SmartFlowRender = (function() {
    let _composer = null;
    let _outlinePass = null;
    let _currentHighlighted = null;
    let _infoPanel = null;
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
    
    // ============ CONVERSIÓN DE UNIDADES ============
    function toM(mmValue) { return (mmValue || 0) / 1000; }
    function diamToRadiusM(diamPulg) { return ((diamPulg || 4) * 25.4) / 2000; }
    function compSize(diamPulg) { return diamToRadiusM(diamPulg) * 3; }
    
    // ============ COLORES ============
    function getPipeColor(spec) {
        var s = (spec || '').toUpperCase();
        if (s.includes('PPR')) return 0x10b981;
        if (s.includes('HDPE') || s.includes('PE100')) return 0x22c55e;
        if (s.includes('PVC')) return 0xeab308;
        if (s.includes('SS_') || s.includes('INOX') || s.includes('SANITARY')) return 0xe2e8f0;
        if (s.includes('A3B')) return 0x64748b;
        if (s.includes('A1A') || s.includes('ACERO') || s.includes('CS_') || s.includes('SCH80')) return 0x94a3b8;
        if (s.includes('PTFE')) return 0xa78bfa;
        return 0x94a3b8;
    }
    
    function getEquipmentColor(tipo) {
        var t = (tipo || '').toLowerCase();
        if (t === 'tanque_v' || t === 'tanque_acero' || t === 'desgasificador' || t === 'desmineralizador' || t === 'suavizador' || t === 'filtro_carbon' || t === 'filtro_arena' || t === 'clarificador' || t === 'espesador' || t === 'floculador') return 0x3b82f6;
        if (t === 'tanque_h' || t === 'separador' || t === 'separador_trifasico' || t === 'slug_catcher' || t === 'calentador_fuego_directo' || t === 'secador_rotativo' || t === 'centrifuga' || t === 'filtro_tambor' || t === 'molino') return 0x2563eb;
        if (t === 'torre' || t === 'columna_fraccionadora' || t === 'absorbedor' || t === 'stripper' || t === 'antorcha') return 0x6366f1;
        if (t === 'reactor' || t === 'reactor_encamisado' || t === 'autoclave' || t === 'cristalizador') return 0x8b5cf6;
        if (t.includes('bomba') || t === 'skid_inyeccion') return 0xf39c12;
        if (t === 'compresor') return 0xef4444;
        if (t === 'intercambiador' || t === 'caldera' || t === 'condensador' || t === 'evaporador' || t === 'pasteurizador' || t === 'esterilizador_uht') return 0x06b6d4;
        if (t === 'osmosis' || t === 'celda_electrolitica') return 0x06b6d4;
        if (t === 'homogeneizador' || t === 'homogeneizador_ap' || t === 'agitador') return 0xa855f7;
        if (t === 'plataforma') return 0x6b7280;
        if (t.includes('TEE')) return 0xd35400;
        if (t === 'centrifuga_discos' || t === 'tina_quesera' || t === 'llenadora') return 0xe2e8f0;
        if (t === 'tanque_aseptico') return 0xe2e8f0;
        if (t === 'filtro_prensa' || t === 'filtro_duplex' || t === 'dosificador_quimico') return 0x475569;
        if (t === 'canaleta_parshall') return 0x64748b;
        return 0x475569;
    }
    
    function createMaterial(color, metalness, roughness) {
        return new THREE.MeshStandardMaterial({ color: color, metalness: metalness || 0.3, roughness: roughness || 0.5 });
    }
    
    const matSupport = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.7, roughness: 0.25 });
    const matStem = new THREE.MeshStandardMaterial({ color: 0xc0c0c0, metalness: 0.8, roughness: 0.2 });
    const matWheel = new THREE.MeshStandardMaterial({ color: 0x444444, metalness: 0.6, roughness: 0.3 });
    const matBlack = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.3, roughness: 0.6 });
    const matGlass = new THREE.MeshStandardMaterial({ color: 0x87ceeb, transparent: true, opacity: 0.5, roughness: 0.1 });
    const matRed = new THREE.MeshStandardMaterial({ color: 0xff0000, roughness: 0.3 });
    const matGreen = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.4 });
    const matBrass = new THREE.MeshStandardMaterial({ color: 0xd4a800, metalness: 0.8, roughness: 0.2 });
    
    // ============ ORIENTACIÓN ESTABLE ============
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
        while (group.children.length > 0) {
            var child = group.children[group.children.length - 1];
            group.remove(child);
        }
    }
    
    // ============ EQUIPOS 3D (100% del catálogo) ============
    function createTankVertical(eq) {
        var color = getEquipmentColor(eq.tipo), 
            mat = createMaterial(color, 0.4, 0.35), 
            matRing = createMaterial(color, 0.6, 0.3);
        var r = toM((eq.diametro || 3000) / 2);
        var h = toM(eq.altura || 6000);
        var group = new THREE.Group();
        
        var body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 32), mat);
        body.position.y = h / 2; 
        body.castShadow = true; 
        body.receiveShadow = true;
        group.add(body);
        
        var dome = new THREE.Mesh(
            new THREE.SphereGeometry(r, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), mat
        );
        dome.position.y = h;
        dome.rotation.x = -Math.PI / 2;
        dome.castShadow = true;
        group.add(dome);
        
        var step = h / 4;
        for (var y = step; y < h; y += step) {
            var ring = new THREE.Mesh(
                new THREE.TorusGeometry(r + 0.02, 0.03, 8, 32), matRing
            );
            ring.position.y = y; 
            ring.rotation.x = Math.PI / 2;
            group.add(ring);
        }
        
        group.position.set(toM(eq.posX), toM(eq.posY), toM(eq.posZ));
        group.userData = { tag: eq.tag, tipo: 'equipo' };
        return group;
    }
    
    function createTankHorizontal(eq) {
        var color = getEquipmentColor(eq.tipo), mat = createMaterial(color, 0.4, 0.35);
        var r = toM((eq.diametro||3000)/2), l = toM(eq.largo||6000), group = new THREE.Group();
        var body = new THREE.Mesh(new THREE.CylinderGeometry(r, r, l, 32), mat);
        body.rotation.z = Math.PI/2; body.position.set(l/2, r, 0);
        body.castShadow = true; body.receiveShadow = true;
        group.add(body);
        var capGeo = new THREE.SphereGeometry(r, 32, 16, 0, Math.PI*2, 0, Math.PI/2);
        var cap1 = new THREE.Mesh(capGeo, mat); cap1.position.set(0, r, 0); cap1.rotation.z = -Math.PI/2;
        group.add(cap1);
        var cap2 = new THREE.Mesh(capGeo, mat); cap2.position.set(l, r, 0); cap2.rotation.z = Math.PI/2;
        group.add(cap2);
        var legGeo = new THREE.BoxGeometry(r*0.3, r*1.5, r*0.5);
        for (var i=0; i<2; i++) { var leg = new THREE.Mesh(legGeo, matSupport.clone()); leg.position.set(l*0.25+i*l*0.5, -r*0.5, 0); group.add(leg); }
        group.position.set(toM(eq.posX), toM(eq.posY), toM(eq.posZ));
        group.userData = { tag: eq.tag, tipo: 'equipo' };
        return group;
    }
    
    function createBomba(eq) {
        var color = getEquipmentColor(eq.tipo), mat = createMaterial(color, 0.5, 0.3);
        var s = toM(eq.diametro||800), group = new THREE.Group();
        group.add(new THREE.Mesh(new THREE.BoxGeometry(s*1.2, s*0.1, s*0.8), matSupport.clone()));
        var casing = new THREE.Mesh(new THREE.CylinderGeometry(s*0.4, s*0.45, s*0.7, 16), mat);
        casing.position.set(0, s*0.4, 0); casing.castShadow = true;
        group.add(casing);
        var motor = new THREE.Mesh(new THREE.CylinderGeometry(s*0.3, s*0.3, s*0.6, 16), new THREE.MeshStandardMaterial({ color:0x666666, metalness:0.6, roughness:0.3 }));
        motor.position.set(s*0.5, s*0.5, 0); motor.castShadow = true;
        group.add(motor);
        group.position.set(toM(eq.posX), toM(eq.posY), toM(eq.posZ));
        group.userData = { tag: eq.tag, tipo: 'equipo' };
        return group;
    }
    
    function createCompresor(eq) {
        var color = getEquipmentColor(eq.tipo), mat = createMaterial(color, 0.5, 0.3);
        var s = toM(eq.diametro||1000), group = new THREE.Group();
        var body = new THREE.Mesh(new THREE.BoxGeometry(s*1.2, s*0.9, s*0.7), mat);
        body.position.y = s*0.45; body.castShadow = true;
        group.add(body);
        group.add(new THREE.Mesh(new THREE.CylinderGeometry(s*0.3, s*0.35, s*0.5, 16), matSupport.clone())).position.set(0, s*0.9, 0);
        group.position.set(toM(eq.posX), toM(eq.posY), toM(eq.posZ));
        group.userData = { tag: eq.tag, tipo: 'equipo' };
        return group;
    }
    
    function createExchanger(eq) {
        var color = getEquipmentColor(eq.tipo), mat = createMaterial(color, 0.5, 0.3);
        var l = toM(eq.largo||4000), r = toM((eq.diametro||800)/2), group = new THREE.Group();
        var shell = new THREE.Mesh(new THREE.CylinderGeometry(r, r, l, 24), mat);
        shell.rotation.z = Math.PI/2; shell.position.set(l/2, r*1.5, 0); shell.castShadow = true;
        group.add(shell);
        group.position.set(toM(eq.posX), toM(eq.posY), toM(eq.posZ));
        group.userData = { tag: eq.tag, tipo: 'equipo' };
        return group;
    }
    
    function createBoxEquip(eq) {
        var color = getEquipmentColor(eq.tipo), mat = createMaterial(color, 0.3, 0.5);
        var xl = toM(eq.largo||eq.diametro||800), yh = toM(eq.altura||800), zw = toM(eq.ancho||eq.diametro||800), group = new THREE.Group();
        var body = new THREE.Mesh(new THREE.BoxGeometry(xl, yh, zw), mat);
        body.position.y = yh/2; body.castShadow = true; body.receiveShadow = true;
        group.add(body);
        group.position.set(toM(eq.posX), toM(eq.posY), toM(eq.posZ));
        group.userData = { tag: eq.tag, tipo: 'equipo' };
        return group;
    }
    
    function createPlataforma(eq) {
        var material = (eq.material || '').toUpperCase();
        var esConcreto = material.includes('CONCRETO') || material.includes('CEMENTO') || material.includes('HORMIGON');
        var esMetal = !esConcreto;
        
        var w = toM(eq.largo || 6000);
        var d = toM(eq.ancho || 3000);
        var h = toM(eq.altura || 400);
        var group = new THREE.Group();
        
        if (esConcreto) {
            var losaGeo = new THREE.BoxGeometry(w, h, d);
            var losaMat = new THREE.MeshStandardMaterial({ color: 0x9ca3af, metalness: 0.05, roughness: 0.85 });
            var losa = new THREE.Mesh(losaGeo, losaMat);
            losa.position.y = h / 2;
            losa.castShadow = true; losa.receiveShadow = true;
            group.add(losa);
            
            var pilarGeo = new THREE.BoxGeometry(0.25, h * 3, 0.25);
            var pilarMat = new THREE.MeshStandardMaterial({ color: 0x78716c, metalness: 0.05, roughness: 0.75 });
            var posiciones = [
                { x: -w/2 + 0.2, z: -d/2 + 0.2 }, { x: w/2 - 0.2, z: -d/2 + 0.2 },
                { x: w/2 - 0.2, z: d/2 - 0.2 }, { x: -w/2 + 0.2, z: d/2 - 0.2 }
            ];
            posiciones.forEach(function(pos) {
                var pilar = new THREE.Mesh(pilarGeo, pilarMat);
                pilar.position.set(pos.x, -h * 1.2, pos.z);
                pilar.castShadow = true; pilar.receiveShadow = true;
                group.add(pilar);
            });
        } else {
            var pisoGeo = new THREE.BoxGeometry(w, h * 0.2, d);
            var pisoMat = new THREE.MeshStandardMaterial({ color: 0x6b7280, metalness: 0.85, roughness: 0.3 });
            var piso = new THREE.Mesh(pisoGeo, pisoMat);
            piso.position.y = h;
            piso.receiveShadow = true;
            group.add(piso);
            
            var columnaGeo = new THREE.BoxGeometry(0.15, h * 3, 0.15);
            var columnaMat = new THREE.MeshStandardMaterial({ color: 0x374151, metalness: 0.9, roughness: 0.2 });
            var posCols = [
                { x: -w/2 + 0.2, z: -d/2 + 0.2 }, { x: w/2 - 0.2, z: -d/2 + 0.2 },
                { x: w/2 - 0.2, z: d/2 - 0.2 }, { x: -w/2 + 0.2, z: d/2 - 0.2 }
            ];
            posCols.forEach(function(pos) {
                var columna = new THREE.Mesh(columnaGeo, columnaMat);
                columna.position.set(pos.x, -h * 1.2, pos.z);
                columna.castShadow = true;
                group.add(columna);
            });
            
            if (eq.baranda !== false) {
                var barandaH = 1.1;
                var posteGeo = new THREE.CylinderGeometry(0.015, 0.015, barandaH, 8);
                var barandaMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.7, roughness: 0.3 });
                for (var px = -w/2 + 0.3; px <= w/2 - 0.3; px += 1.5) {
                    [-1, 1].forEach(function(side) {
                        var poste = new THREE.Mesh(posteGeo, barandaMat);
                        poste.position.set(px, h + barandaH/2, side * (d/2 - 0.05));
                        group.add(poste);
                    });
                }
            }
        }
        
        group.position.set(toM(eq.posX), toM(eq.posY), toM(eq.posZ));
        group.userData = { tag: eq.tag, tipo: 'equipo' };
        return group;
    }
    
    function createEquipmentMesh(eq) {
        if (!eq || !eq.tipo) return null;
        var tipo = (eq.tipo||'').toLowerCase();
        
        if (tipo==='tanque_v'||tipo==='tanque_acero'||tipo==='torre'||tipo==='reactor'||
            tipo==='desgasificador'||tipo==='desmineralizador'||tipo==='suavizador'||
            tipo==='filtro_carbon'||tipo==='filtro_arena'||tipo==='clarificador'||
            tipo==='columna_fraccionadora'||tipo==='evaporador'||tipo==='cristalizador'||
            tipo==='absorbedor'||tipo==='stripper'||tipo==='reactor_encamisado'||
            tipo==='autoclave'||tipo==='agitador'||tipo==='centrifuga_discos'||
            tipo==='tanque_aseptico'||tipo==='espesador'||tipo==='separador'||tipo==='antorcha') {
            return createTankVertical(eq);
        }
        
        if (tipo==='tanque_h'||tipo==='separador_trifasico'||tipo==='slug_catcher'||
            tipo==='calentador_fuego_directo'||tipo==='secador_rotativo'||
            tipo==='centrifuga'||tipo==='filtro_tambor'||tipo==='molino') {
            return createTankHorizontal(eq);
        }
        
        if (tipo.includes('bomba')||tipo==='skid_inyeccion') return createBomba(eq);
        if (tipo==='compresor') return createCompresor(eq);
        if (tipo==='intercambiador'||tipo==='caldera'||tipo==='condensador'||tipo==='pasteurizador'||tipo==='esterilizador_uht') return createExchanger(eq);
        if (tipo==='plataforma') return createPlataforma(eq);
        return createBoxEquip(eq);
    }
    
    // ============ TUBERÍAS ============
    function createPipeMesh(line) {
        var pts = _core.getLinePoints(line) || line._cachedPoints || line.points3D || [];
        if (pts.length < 2) return null;
        var color = getPipeColor(line.spec || line.material), radius = diamToRadiusM(line.diameter||4);
        var isPPR = (line.spec||line.material||'').toUpperCase().includes('PPR');
        var vector3Points = pts.map(function(p){ return new THREE.Vector3(toM(p.x), toM(p.y), toM(p.z)); });
        var curve = new THREE.CatmullRomCurve3(vector3Points, false, 'catmullrom', 0);
        var segments = Math.min(Math.max(vector3Points.length*4, 32), 256);
        var pipe = new THREE.Mesh(new THREE.TubeGeometry(curve, segments, radius, 12, false),
            new THREE.MeshStandardMaterial({ color: color, metalness: 0.05, roughness: 0.5 }));
        pipe.castShadow = true; pipe.receiveShadow = true;
        pipe.userData = { tag: line.tag, tipo: 'linea' };
        if (_engine) _engine.registerVisualMesh(line.tag, pipe);
        if (isPPR) {
            var totalLength = curve.getLength(), spacing = 1.5, numRings = Math.floor(totalLength/spacing);
            for (var i=1; i<numRings; i++) {
                var t = i*spacing/totalLength, pt = curve.getPointAt(t), tangent = curve.getTangentAt(t).normalize();
                var ring = new THREE.Mesh(new THREE.TorusGeometry(radius*1.25, radius*0.2, 8, 16),
                    new THREE.MeshStandardMaterial({ color:0x064e3b, metalness:0.1, roughness:0.4, emissive:0x022c1a, emissiveIntensity:0.3 }));
                ring.position.copy(pt);
                var q = new THREE.Quaternion(); q.setFromUnitVectors(new THREE.Vector3(0,0,1), tangent);
                ring.quaternion.copy(q); ring.userData = { isFusionRing: true };
            }
        }
        return pipe;
    }
    
    // ============ COMPONENTES (FITTINGS) ============
    function createFitting(comp, pos3D, dirVec, size, compType, spec) {
        var type = (compType || comp.type || '').toUpperCase(), s = size;
        var color = getPipeColor(spec);
        var mat = new THREE.MeshStandardMaterial({ color:color, metalness:0.3, roughness:0.4 });
        var matDark = new THREE.MeshStandardMaterial({ color:color, metalness:0.5, roughness:0.25 });
        var group = new THREE.Group();
        
        if (type.includes('ELBOW_90')||type.includes('CODO_90')) {
            var c90 = new THREE.EllipseCurve(0,0,s*1.5,s*1.5,0,Math.PI/2,false,0);
            var p90 = c90.getPoints(24);
            group.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(p90.map(function(p){return new THREE.Vector3(p.x,p.y,0);})),24,s*0.4,8,false),mat));
        }
        else if (type.includes('ELBOW_45')||type.includes('CODO_45')) {
            var c45 = new THREE.EllipseCurve(0,0,s*1.5,s*1.5,0,Math.PI/4,false,0);
            var p45 = c45.getPoints(16);
            group.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(p45.map(function(p){return new THREE.Vector3(p.x,p.y,0);})),16,s*0.4,8,false),mat));
        }
        else if (type.includes('TEE_EQUAL')||type.includes('TEE_RECTA')||type.includes('TEE_PPR')) {
            var main = new THREE.Mesh(new THREE.CylinderGeometry(s*0.4,s*0.4,s*2.5,16),mat); main.rotation.z=Math.PI/2; group.add(main);
            var branch = new THREE.Mesh(new THREE.CylinderGeometry(s*0.35,s*0.35,s*1.2,16),mat); branch.position.y=s*0.7; group.add(branch);
            var collar = new THREE.Mesh(new THREE.TorusGeometry(s*0.45,s*0.08,8,16),matDark); collar.position.y=s*0.1; collar.rotation.x=Math.PI/2; group.add(collar);
        }
        else if (type.includes('TEE_REDUCING')) {
            var trm = new THREE.Mesh(new THREE.CylinderGeometry(s*0.4,s*0.4,s*2.5,16),mat); trm.rotation.z=Math.PI/2; group.add(trm);
            var trb = new THREE.Mesh(new THREE.CylinderGeometry(s*0.25,s*0.25,s*1.2,16),mat); trb.position.y=s*0.7; group.add(trb);
        }
        else if (type.includes('CROSS')) {
            var cm = new THREE.Mesh(new THREE.CylinderGeometry(s*0.35,s*0.35,s*2.5,16),mat); cm.rotation.z=Math.PI/2; group.add(cm);
            var cb1 = new THREE.Mesh(new THREE.CylinderGeometry(s*0.3,s*0.3,s*1.2,16),mat); cb1.position.y=s*0.7; group.add(cb1);
            var cb2 = new THREE.Mesh(new THREE.CylinderGeometry(s*0.3,s*0.3,s*1.2,16),mat); cb2.position.y=-s*0.7; group.add(cb2);
        }
        else if (type.includes('CONCENTRIC_REDUCER')||type.includes('REDUCTOR_CONCENTRICO')) {
            group.add(new THREE.Mesh(new THREE.CylinderGeometry(s*0.5,s*0.3,s*1.8,16),mat));
        }
        else if (type.includes('ECCENTRIC_REDUCER')) {
            var re = new THREE.Mesh(new THREE.CylinderGeometry(s*0.5,s*0.3,s*1.8,16),mat); re.position.y=-s*0.25; group.add(re);
        }
        else if (type.includes('FLANGE')||type.includes('BRIDA')) {
            var fb = new THREE.Mesh(new THREE.CylinderGeometry(s*0.35,s*0.35,s*0.3,16),mat); fb.rotation.z=Math.PI/2; group.add(fb);
            var fd = new THREE.Mesh(new THREE.CylinderGeometry(s*0.6,s*0.6,s*0.1,32),matDark); fd.rotation.z=Math.PI/2; fd.position.x=s*0.2; group.add(fd);
            for (var h=0; h<Math.PI*2; h+=Math.PI/3) {
                var hole = new THREE.Mesh(new THREE.CylinderGeometry(s*0.04,s*0.04,s*0.12,8), matBlack.clone());
                hole.rotation.z=Math.PI/2; hole.position.set(s*0.2, Math.cos(h)*s*0.45, Math.sin(h)*s*0.45); group.add(hole);
            }
        }
        else if (type.includes('BULKHEAD')||type.includes('PASAMUROS')) {
            var bh = new THREE.Mesh(new THREE.CylinderGeometry(s*0.3,s*0.3,s*1.2,16),mat); bh.rotation.z=Math.PI/2; group.add(bh);
            var bfg = new THREE.CylinderGeometry(s*0.55,s*0.55,s*0.12,32);
            var bf1 = new THREE.Mesh(bfg,matDark); bf1.rotation.z=Math.PI/2; bf1.position.x=-s*0.6; group.add(bf1);
            var bf2 = new THREE.Mesh(bfg,matDark); bf2.rotation.z=Math.PI/2; bf2.position.x=s*0.6; group.add(bf2);
            var gask = new THREE.Mesh(new THREE.TorusGeometry(s*0.45,s*0.04,8,16), matGreen.clone()); gask.position.x=-s*0.65; gask.rotation.y=Math.PI/2; group.add(gask);
        }
        else if (type.includes('CAP')||type.includes('TAPON')) {
            group.add(new THREE.Mesh(new THREE.SphereGeometry(s*0.45,16,8,0,Math.PI*2,0,Math.PI/2),mat));
        }
        else if (type.includes('UNION')) {
            var ub = new THREE.Mesh(new THREE.CylinderGeometry(s*0.4,s*0.4,s*0.7,16),mat); ub.rotation.z=Math.PI/2; group.add(ub);
            var un = new THREE.Mesh(new THREE.CylinderGeometry(s*0.45,s*0.45,s*0.15,6),matDark); un.rotation.z=Math.PI/2; un.position.x=s*0.4; group.add(un);
        }
        else if (type.includes('NIPPLE')||type.includes('NIPLE')) {
            group.add(new THREE.Mesh(new THREE.CylinderGeometry(s*0.3,s*0.3,s*1.5,16),mat));
        }
        else if (type.includes('TRANSITION')||type.includes('ADAPTADOR')) {
            var trGeo = new THREE.CylinderGeometry(s*0.4,s*0.5,s*1.0,16);
            group.add(new THREE.Mesh(trGeo,mat));
            var trNut = new THREE.Mesh(new THREE.CylinderGeometry(s*0.5,s*0.5,s*0.15,6),matDark);
            trNut.rotation.z=Math.PI/2; trNut.position.x=s*0.5; group.add(trNut);
        }
        else if (type.includes('EXPANSION_JOINT')||type.includes('JUNTA_EXPANSION')) {
            var ej = new THREE.Mesh(new THREE.CylinderGeometry(s*0.45,s*0.45,s*1.2,16),mat); ej.rotation.z=Math.PI/2; group.add(ej);
            for (var b=0; b<3; b++) {
                var bellows = new THREE.Mesh(new THREE.TorusGeometry(s*0.5,s*0.05,8,16),matDark);
                bellows.position.x = -s*0.4 + b*s*0.4; bellows.rotation.y=Math.PI/2; group.add(bellows);
            }
        }
        else if (type.includes('STRAINER')||type.includes('FILTRO')) {
            var strainerType = type.includes('Y_') ? 'Y' : (type.includes('T_') ? 'T' : 'BASKET');
            var stBody = new THREE.Mesh(new THREE.CylinderGeometry(s*0.4,s*0.4,s*1.5,16),mat);
            stBody.rotation.z=Math.PI/2; group.add(stBody);
            if (strainerType==='Y') {
                var yLeg = new THREE.Mesh(new THREE.CylinderGeometry(s*0.25,s*0.25,s*1.0,8),mat);
                yLeg.position.set(0,-s*0.7,0); yLeg.rotation.x=Math.PI/4; group.add(yLeg);
            }
            var stCap = new THREE.Mesh(new THREE.CylinderGeometry(s*0.3,s*0.3,s*0.2,16),matDark);
            stCap.position.set(0,-s*1.0,0); group.add(stCap);
        }
        else if (type.includes('STEAM_TRAP')||type.includes('TRAMPA')) {
            var trap = new THREE.Mesh(new THREE.CylinderGeometry(s*0.3,s*0.3,s*0.9,16),mat); trap.rotation.z=Math.PI/2; group.add(trap);
            var trapTop = new THREE.Mesh(new THREE.CylinderGeometry(s*0.25,s*0.3,s*0.3,16),matDark); trapTop.position.y=s*0.5; group.add(trapTop);
        }
        else if (type.includes('PIPE_SHOE')||type.includes('ZAPATA')) {
            group.add(new THREE.Mesh(new THREE.BoxGeometry(s*0.6,s*0.3,s*0.6), matSupport.clone()));
        }
        else if (type.includes('U_BOLT')||type.includes('U-BOLT')) {
            var ubGeo = new THREE.TorusGeometry(s*0.4,s*0.05,8,8,Math.PI);
            group.add(new THREE.Mesh(ubGeo, matSupport.clone()));
            var ubPlate = new THREE.Mesh(new THREE.BoxGeometry(s*0.8,s*0.04,s*0.1), matSupport.clone()); ubPlate.position.y=-s*0.4; group.add(ubPlate);
        }
        else if (type.includes('GUIDE')||type.includes('GUIA')) {
            group.add(new THREE.Mesh(new THREE.BoxGeometry(s*0.3,s*0.6,s*0.3), matSupport.clone()));
        }
        else if (type.includes('ANCHOR')||type.includes('ANCLAJE')) {
            var anchorGeo = new THREE.BoxGeometry(s*0.5,s*0.5,s*0.5);
            group.add(new THREE.Mesh(anchorGeo, new THREE.MeshStandardMaterial({ color:0xdc2626, metalness:0.7, roughness:0.25 })));
        }
        else if (type.includes('HANGER')||type.includes('COLGADOR')||type.includes('SPRING')) {
            var hangerRod = new THREE.Mesh(new THREE.CylinderGeometry(s*0.05,s*0.05,s*1.5,8), matSupport.clone()); group.add(hangerRod);
            if (type.includes('SPRING')) {
                var springGeo = new THREE.TorusGeometry(s*0.2,s*0.04,8,16);
                for (var sp=0; sp<3; sp++) { var spring = new THREE.Mesh(springGeo, matSupport.clone()); spring.position.y=sp*s*0.2; group.add(spring); }
            }
        }
        else if (type.includes('PIPE_CLAMP')||type.includes('ABRAZADERA')) {
            var clampGeo = new THREE.TorusGeometry(s*0.45,s*0.05,8,16);
            group.add(new THREE.Mesh(clampGeo, matSupport.clone()));
        }
        else {
            group.add(new THREE.Mesh(new THREE.SphereGeometry(s*0.35,8,8),mat));
        }
        
        group.position.copy(pos3D);
        orientComponent(group, dirVec);
        group.userData = { tag: comp.tag, type: comp.type, isComponent: true };
        return group;
    }
    
    // ============ VÁLVULAS ============
    function createValve(comp, pos3D, dirVec, size, compType, spec) {
        var type = (compType || comp.type || '').toUpperCase(), s = size;
        var color = getPipeColor(spec);
        var mat = new THREE.MeshStandardMaterial({ color:color, metalness:0.5, roughness:0.3 });
        var matDark = new THREE.MeshStandardMaterial({ color:color, metalness:0.6, roughness:0.25 });
        var group = new THREE.Group();
        
        if (type.includes('GATE_VALVE')||type.includes('COMPUERTA')) {
            var body = new THREE.Mesh(new THREE.CylinderGeometry(s*0.35,s*0.35,s*1.4,16),mat); body.rotation.z=Math.PI/2; group.add(body);
            var bonnet = new THREE.Mesh(new THREE.CylinderGeometry(s*0.3,s*0.35,s*0.5,16),matDark); bonnet.position.y=s*0.55; group.add(bonnet);
            var stem = new THREE.Mesh(new THREE.CylinderGeometry(s*0.05,s*0.05,s*1.2,8),matStem.clone()); stem.position.y=s*1.1; group.add(stem);
            var wheel = new THREE.Mesh(new THREE.TorusGeometry(s*0.4,s*0.06,8,24),matWheel.clone()); wheel.position.y=s*1.7; wheel.rotation.x=Math.PI/2; group.add(wheel);
            for (var a=0; a<Math.PI*2; a+=Math.PI/3) { var spoke = new THREE.Mesh(new THREE.CylinderGeometry(s*0.03,s*0.03,s*0.35,6),matWheel.clone()); spoke.position.set(Math.cos(a)*s*0.35,s*1.7,Math.sin(a)*s*0.35); spoke.rotation.z=Math.PI/2; group.add(spoke); }
        }
        else if (type.includes('GLOBE_VALVE')) {
            var gBody = new THREE.Mesh(new THREE.SphereGeometry(s*0.45,16,16),mat); gBody.scale.set(1,1.2,1); group.add(gBody);
            var gBonnet = new THREE.Mesh(new THREE.CylinderGeometry(s*0.25,s*0.35,s*0.5,16),matDark); gBonnet.position.y=s*0.7; group.add(gBonnet);
            var gStem = new THREE.Mesh(new THREE.CylinderGeometry(s*0.04,s*0.04,s*0.9,8),matStem.clone()); gStem.position.y=s*1.15; group.add(gStem);
            var gWheel = new THREE.Mesh(new THREE.TorusGeometry(s*0.3,s*0.05,8,24),matWheel.clone()); gWheel.position.y=s*1.6; gWheel.rotation.x=Math.PI/2; group.add(gWheel);
        }
        else if (type.includes('BALL_VALVE')||type.includes('BOLA')) {
            var bBody = new THREE.Mesh(new THREE.CylinderGeometry(s*0.4,s*0.4,s*1.0,16),matDark); bBody.rotation.z=Math.PI/2; group.add(bBody);
            var bBall = new THREE.Mesh(new THREE.SphereGeometry(s*0.3,16,16),new THREE.MeshStandardMaterial({color:0xe0e0e0,metalness:0.9,roughness:0.1})); group.add(bBall);
            var lever = new THREE.Mesh(new THREE.CylinderGeometry(s*0.04,s*0.04,s*1.0,8),matDark); lever.position.y=s*0.6; group.add(lever);
            var handle = new THREE.Mesh(new THREE.SphereGeometry(s*0.09,8,8),matRed.clone()); handle.position.y=s*1.1; group.add(handle);
        }
        else if (type.includes('BUTTERFLY_VALVE')||type.includes('MARIPOSA')) {
            var mBody = new THREE.Mesh(new THREE.CylinderGeometry(s*0.4,s*0.4,s*0.3,16),mat); mBody.rotation.z=Math.PI/2; group.add(mBody);
            var disc = new THREE.Mesh(new THREE.CylinderGeometry(s*0.35,s*0.35,s*0.04,16),matDark); disc.rotation.z=Math.PI/2; group.add(disc);
            var mStem = new THREE.Mesh(new THREE.CylinderGeometry(s*0.04,s*0.04,s*0.7,8),matStem.clone()); mStem.position.y=s*0.4; group.add(mStem);
            var mHandle = new THREE.Mesh(new THREE.BoxGeometry(s*0.6,s*0.04,s*0.06),matDark); mHandle.position.y=s*0.75; group.add(mHandle);
        }
        else if (type.includes('CHECK_VALVE')||type.includes('RETENCION')) {
            var cBody = new THREE.Mesh(new THREE.CylinderGeometry(s*0.35,s*0.35,s*1.2,16),mat); cBody.rotation.z=Math.PI/2; group.add(cBody);
            var arrow = new THREE.Mesh(new THREE.ConeGeometry(s*0.12,s*0.35,8),new THREE.MeshStandardMaterial({color:0x22c55e,emissive:0x0a3d0a,emissiveIntensity:0.5})); arrow.position.x=s*0.3; arrow.rotation.z=-Math.PI/2; group.add(arrow);
        }
        else if (type.includes('DIAPHRAGM_VALVE')||type.includes('DIAFRAGMA')) {
            var dBody = new THREE.Mesh(new THREE.BoxGeometry(s*1.0,s*0.6,s*0.8),mat); group.add(dBody);
            var dBonnet = new THREE.Mesh(new THREE.CylinderGeometry(s*0.25,s*0.35,s*0.5,16),matDark); dBonnet.position.y=s*0.5; group.add(dBonnet);
            var dWheel = new THREE.Mesh(new THREE.TorusGeometry(s*0.3,s*0.04,8,16),matWheel.clone()); dWheel.position.y=s*0.85; dWheel.rotation.x=Math.PI/2; group.add(dWheel);
        }
        else if (type.includes('CONTROL_VALVE')) {
            var cvBody = new THREE.Mesh(new THREE.CylinderGeometry(s*0.35,s*0.45,s*1.2,16),mat); cvBody.rotation.z=Math.PI/2; group.add(cvBody);
            var actuator = new THREE.Mesh(new THREE.BoxGeometry(s*0.5,s*0.7,s*0.5),new THREE.MeshStandardMaterial({color:0x3b82f6,metalness:0.3,roughness:0.4})); actuator.position.y=s*0.7; group.add(actuator);
        }
        else if (type.includes('RELIEF')||type.includes('SAFETY')||type.includes('ALIVIO')||type.includes('SEGURIDAD')) {
            var rBody = new THREE.Mesh(new THREE.CylinderGeometry(s*0.25,s*0.35,s*0.8,16),new THREE.MeshStandardMaterial({color:0xef4444,metalness:0.5,roughness:0.3})); group.add(rBody);
            var rCap = new THREE.Mesh(new THREE.CylinderGeometry(s*0.3,s*0.3,s*0.2,16),matDark); rCap.position.y=s*0.5; group.add(rCap);
        }
        else if (type.includes('DRAIN_VALVE')||type.includes('PURGA')) {
            var dv = new THREE.Mesh(new THREE.CylinderGeometry(s*0.2,s*0.2,s*0.6,16),mat); dv.rotation.z=Math.PI/2; group.add(dv);
            var dvHandle = new THREE.Mesh(new THREE.BoxGeometry(s*0.3,s*0.04,s*0.04),matDark); dvHandle.position.y=s*0.35; group.add(dvHandle);
        }
        else if (type.includes('AIR_RELEASE')||type.includes('LIBERACION')) {
            var ar = new THREE.Mesh(new THREE.CylinderGeometry(s*0.15,s*0.2,s*0.5,16),mat); group.add(ar);
            var arVent = new THREE.Mesh(new THREE.CylinderGeometry(s*0.05,s*0.05,s*0.2,8),matBlack.clone()); arVent.position.y=s*0.3; group.add(arVent);
        }
        else if (type.includes('SAMPLE_VALVE')||type.includes('MUESTREO')) {
            var sv = new THREE.Mesh(new THREE.CylinderGeometry(s*0.2,s*0.2,s*0.5,16),mat); sv.rotation.z=Math.PI/2; group.add(sv);
            var svPort = new THREE.Mesh(new THREE.CylinderGeometry(s*0.08,s*0.08,s*0.3,8),matDark); svPort.position.y=s*0.3; group.add(svPort);
            var svKnob = new THREE.Mesh(new THREE.SphereGeometry(s*0.08,6,6),matRed.clone()); svKnob.position.y=s*0.5; group.add(svKnob);
        }
        else if (type.includes('PRESSURE_GAUGE')||type.includes('MANOMETRO')) {
            var pgBody = new THREE.Mesh(new THREE.CylinderGeometry(s*0.3,s*0.3,s*0.15,32),
                new THREE.MeshStandardMaterial({color:0x333333,metalness:0.6,roughness:0.2})); group.add(pgBody);
            var pgDial = new THREE.Mesh(new THREE.CylinderGeometry(s*0.28,s*0.28,s*0.02,32),
                new THREE.MeshStandardMaterial({color:0xffffff,roughness:0.1})); pgDial.position.z=s*0.09; group.add(pgDial);
            var pgNeedle = new THREE.Mesh(new THREE.BoxGeometry(s*0.01,s*0.15,s*0.01),matRed.clone()); pgNeedle.position.z=s*0.1; group.add(pgNeedle);
        }
        else if (type.includes('TEMPERATURE_GAUGE')||type.includes('TERMOMETRO')) {
            var tgStem = new THREE.Mesh(new THREE.CylinderGeometry(s*0.04,s*0.04,s*1.0,8),matStem.clone()); group.add(tgStem);
            var tgDial = new THREE.Mesh(new THREE.CylinderGeometry(s*0.2,s*0.2,s*0.1,16),
                new THREE.MeshStandardMaterial({color:0xffffff,roughness:0.1})); tgDial.position.y=s*0.5; group.add(tgDial);
        }
        else if (type.includes('FLOW_METER')||type.includes('CAUDALIMETRO')) {
            var fm = new THREE.Mesh(new THREE.CylinderGeometry(s*0.35,s*0.35,s*0.8,16),mat); fm.rotation.z=Math.PI/2; group.add(fm);
            var fmDisplay = new THREE.Mesh(new THREE.BoxGeometry(s*0.3,s*0.4,s*0.05),
                new THREE.MeshStandardMaterial({color:0x1e293b,roughness:0.2})); fmDisplay.position.y=s*0.5; group.add(fmDisplay);
        }
        else if (type.includes('LEVEL_SWITCH')||type.includes('SWITCH_RANA')) {
            var ls = new THREE.Mesh(new THREE.BoxGeometry(s*0.35,s*0.25,s*0.25),
                new THREE.MeshStandardMaterial({color:0xf59e0b,metalness:0.3,roughness:0.4})); group.add(ls);
            var lsRod = new THREE.Mesh(new THREE.CylinderGeometry(s*0.04,s*0.04,s*0.6,8),matStem.clone()); lsRod.position.y=s*0.4; group.add(lsRod);
        }
        else {
            group.add(new THREE.Mesh(new THREE.SphereGeometry(s*0.35,8,8),mat));
        }
        
        group.position.copy(pos3D);
        orientComponent(group, dirVec);
        group.userData = { tag: comp.tag, type: comp.type, isComponent: true };
        return group;
    }
    
    function isFitting(type) {
        var t = (type||'').toUpperCase();
        return t.includes('ELBOW')||t.includes('CODO')||t.includes('TEE')||t.includes('CROSS')||
               t.includes('REDUCER')||t.includes('REDUCTOR')||t.includes('FLANGE')||t.includes('BRIDA')||
               t.includes('BULKHEAD')||t.includes('PASAMUROS')||t.includes('CAP')||t.includes('TAPON')||
               t.includes('UNION')||t.includes('NIPPLE')||t.includes('NIPLE')||t.includes('STUB_END')||
               t.includes('PORTABRIDA')||t.includes('TRANSITION')||t.includes('ADAPTADOR')||
               t.includes('EXPANSION')||t.includes('STRAINER')||t.includes('FILTRO')||
               t.includes('STEAM_TRAP')||t.includes('TRAMPA')||t.includes('CAMLOCK')||
               t.includes('QUICK_CONNECT')||t.includes('HOSE')||t.includes('MANGUERA')||
               t.includes('SILENCER')||t.includes('SILENCIADOR')||t.includes('FLAME_ARRESTER')||
               t.includes('ARRESTADOR')||t.includes('VACUUM_BREAKER')||t.includes('ROMPEDOR')||
               t.includes('SAMPLE_COOLER')||t.includes('ENFRIADOR')||
               t.includes('PIPE_SHOE')||t.includes('ZAPATA')||t.includes('U_BOLT')||
               t.includes('GUIDE')||t.includes('GUIA')||t.includes('ANCHOR')||t.includes('ANCLAJE')||
               t.includes('HANGER')||t.includes('COLGADOR')||t.includes('SPRING')||
               t.includes('PIPE_CLAMP')||t.includes('ABRAZADERA');
    }
    
    // ============ REFRESCO ============
    function refreshAllSymbols() {
        if (!_core) return;
        deepDisposeGroup(_symbolGroup);
        var db = _core.getDb(); if (!db) return;
        _totalObjects = 0;
        
        var equipos = db.equipos || [];
        for (var i=0; i<equipos.length; i++) {
            if (equipos[i].tag && equipos[i].tag.toString().startsWith('TEE-')) continue;
            var mesh = createEquipmentMesh(equipos[i]);
            if (mesh) { if (_engine) _engine.registerVisualMesh(equipos[i].tag, mesh); _symbolGroup.add(mesh); _totalObjects++; }
        }
        
        var lines = db.lines || [];
        for (var j=0; j<lines.length; j++) {
            var line = lines[j];
            var pipe = createPipeMesh(line);
            if (pipe) { _symbolGroup.add(pipe); _totalObjects++; }
            if (line.components && line.components.length) {
                var pts = _core.getLinePoints(line)||line._cachedPoints||line.points3D||[];
                if (pts.length >= 2) {
                    var lengths=[], totalLen=0;
                    for (var k=0; k<pts.length-1; k++) { var d=Math.hypot(pts[k+1].x-pts[k].x,pts[k+1].y-pts[k].y,pts[k+1].z-pts[k].z); lengths.push(d); totalLen+=d; }
                    line.components.forEach(function(comp){
                        var param=comp.param||0.5, targetLen=totalLen*Math.min(1,Math.max(0,param)), accum=0, segIdx=0, t=0;
                        for (var m=0; m<lengths.length; m++) { if (accum+lengths[m]>=targetLen||m===lengths.length-1){ segIdx=m; t=(targetLen-accum)/(lengths[m]||1); break; } accum+=lengths[m]; }
                        var pA=pts[segIdx], pB=pts[segIdx+1];
                        var pos3D=new THREE.Vector3(toM(pA.x+(pB.x-pA.x)*t), toM(pA.y+(pB.y-pA.y)*t), toM(pA.z+(pB.z-pA.z)*t));
                        var dirVec=new THREE.Vector3(pB.x-pA.x, pB.y-pA.y, pB.z-pA.z).normalize();
                        var size=compSize(line.diameter||4), spec=line.spec||line.material||'ACERO';
                        var symbol = isFitting(comp.type) ? createFitting(comp,pos3D,dirVec,size,comp.type,spec) : createValve(comp,pos3D,dirVec,size,comp.type,spec);
                        if (symbol) { _symbolGroup.add(symbol); _totalObjects++; }
                    });
                }
            }
        }
    }
    
    function refreshAllFlowArrows() {
        if (!_core) return;
        deepDisposeGroup(_flowArrowGroup);
        (_core.getDb().lines||[]).forEach(function(line){
            var pts=_core.getLinePoints(line)||[];
            if (pts.length<2) return;
            var arrowSize = diamToRadiusM(line.diameter||4) * 1.5;
            for (var i=0; i<pts.length-1; i++){
                var mid=new THREE.Vector3(toM((pts[i].x+pts[i+1].x)/2),toM((pts[i].y+pts[i+1].y)/2)+arrowSize,toM((pts[i].z+pts[i+1].z)/2));
                var dir=new THREE.Vector3(pts[i+1].x-pts[i].x,pts[i+1].y-pts[i].y,pts[i+1].z-pts[i].z).normalize();
                var cone=new THREE.Mesh(new THREE.ConeGeometry(arrowSize,arrowSize*2.5,6,6),new THREE.MeshStandardMaterial({color:0x00f2ff,emissive:0x003344}));
                cone.position.copy(mid); var q=new THREE.Quaternion(); q.setFromUnitVectors(new THREE.Vector3(0,1,0),dir); cone.quaternion.copy(q);
                _flowArrowGroup.add(cone);
            }
        });
    }
    
    function fitCameraToEquipments() {
        if (!_engine) return;
        var scene=_engine.getScene(), camera=_engine.getCamera(), controls=_engine.getControls();
        if (!scene||!camera||!controls) return;
        var bounds=new THREE.Box3(), has=false;
        scene.traverse(function(c){ if (c.isMesh&&c.visible&&c.geometry&&!(c instanceof THREE.GridHelper||c instanceof THREE.ArrowHelper)){ bounds.expandByObject(c); has=true; }});
        if (!has){ camera.position.set(12,8,12); controls.target.set(0,0,0); controls.update(); return; }
        var center=bounds.getCenter(new THREE.Vector3()), size=bounds.getSize(new THREE.Vector3());
        var maxDim=Math.max(size.x,size.y,size.z,1), dist=Math.min(maxDim*1.3,80);
        camera.position.set(center.x+dist*0.8, center.y+dist*0.6, center.z+dist*0.8);
        controls.target.copy(center); controls.update();
    }
    
    function updateSelectionHighlight() {
        var sel=_core?_core.getSelected():null;
        if (_outlinePass&&_outlinePass.enabled) _outlinePass.selectedObjects=(sel&&sel.obj&&_engine)?[_engine.getVisualMesh(sel.obj.tag)].filter(Boolean):[];
    }
    
    function scheduleRefresh() {
        if (_debounceTimer) clearTimeout(_debounceTimer);
        _debounceTimer=setTimeout(function(){ refreshAllSymbols(); refreshAllFlowArrows(); },200);
    }
    
    function renderFrame() {
        if (!_rendererRef||!_sceneRef||!_cameraRef) return;
        if (_composer&&_outlinePass&&_outlinePass.enabled) _composer.render();
        else _rendererRef.render(_sceneRef,_cameraRef);
        if (_labelRenderer&&_sceneRef&&_cameraRef) _labelRenderer.render(_sceneRef,_cameraRef);
    }
    
    function init(coreInstance, engineInstance) {
        _core=coreInstance; _engine=engineInstance;
        if (!_engine){ console.error('SmartFlowRender: engineInstance requerido'); return; }
        _sceneRef=_engine.getScene(); _cameraRef=_engine.getCamera(); _rendererRef=_engine.getRenderer();
        if (!_sceneRef||!_cameraRef||!_rendererRef){ console.error('SmartFlowRender: Engine no inicializado'); return; }
        
        // Los efectos (EffectComposer, OutlinePass) requieren imports adicionales.
        // Si no están disponibles, se omite el setup de efectos.
        if (typeof THREE.EffectComposer !== 'undefined') {
            _composer = new THREE.EffectComposer(_rendererRef);
            _composer.addPass(new THREE.RenderPass(_sceneRef, _cameraRef));
            if (typeof THREE.OutlinePass !== 'undefined') {
                _outlinePass = new THREE.OutlinePass(new THREE.Vector2(window.innerWidth, window.innerHeight), _sceneRef, _cameraRef);
                _outlinePass.edgeStrength = 3; _outlinePass.edgeGlow = 0.6; _outlinePass.edgeThickness = 1.5;
                _outlinePass.pulsePeriod = 2;
                _outlinePass.visibleEdgeColor.setHex(0x00f2ff); _outlinePass.hiddenEdgeColor.setHex(0x1e293b);
                _composer.addPass(_outlinePass);
            }
        }
        
        _symbolGroup.userData={isSymbolGroup:true}; 
        _symbolGroup.renderOrder = 1;
        _flowArrowGroup.userData={isFlowArrowGroup:true};
        _flowArrowGroup.renderOrder = 2;
        _dimensionGroup.userData={isDimensionGroup:true};
        _dimensionGroup.renderOrder = 3;
        
        _sceneRef.add(_symbolGroup); _sceneRef.add(_dimensionGroup); _sceneRef.add(_flowArrowGroup);
        if (typeof SmartFlowLabels3D!=='undefined'){ SmartFlowLabels3D.init(coreInstance,engineInstance); setTimeout(function(){ SmartFlowLabels3D.refreshAllLabels(); SmartFlowLabels3D.refreshAllDimensions(); },800); }
        if (typeof _core.on==='function') _core.on('modelChanged',function(){ scheduleRefresh(); });
        window.set3DView=function(type){ _engine.setView(type); };
        scheduleRefresh();
        console.log("✔ SmartFlowRender v3.0 - Three.js 0.160.0 con imports");
    }
    
    return {
        init: init,
        fitCameraToEquipments: fitCameraToEquipments,
        refreshAllSymbols: refreshAllSymbols,
        refreshAllFlowArrows: refreshAllFlowArrows,
        updateSelectionHighlight: updateSelectionHighlight,
        renderFrame: renderFrame,
        getComposer:function(){return _composer;},
        getOutlinePass:function(){return _outlinePass;},
        setLabelRenderer:function(lr){_labelRenderer=lr;}
    };
})();

window.SmartFlowRender = SmartFlowRender;
