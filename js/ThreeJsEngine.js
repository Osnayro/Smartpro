
// ============================================================
// ARCHIVO: js/ThreeJsEngine.js - v3.1 (Three.js 0.160.0)
// MEJORAS: Optimización de cámara 3D, bounding box real,
//          límites de órbita, Z-fighting eliminado
// ============================================================
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const ThreeJsEngine = (function() {
    let _scene = null;
    let _camera = null;
    let _renderer = null;
    let _controls = null;
    let _container = null;
    let _core = null;
    
    let _visualMeshes = new Map();
    let _raycastTargets = [];
    
    let _raycaster = new THREE.Raycaster();
    let _mouse = new THREE.Vector2();
    
    let _animationId = null;
    let _loopActive = false;
    
    let _isDragging = false;
    let _dragStart = { x: 0, y: 0 };
    
    const BASE_FRUSTUM_SIZE = 20;
    
    // ============ INICIALIZACIÓN ============
    function init(containerElement, coreInstance) {
        _container = containerElement;
        _core = coreInstance;
        
        if (!_container) {
            console.error('ThreeJsEngine: contenedor no encontrado');
            return false;
        }
        
        _container.innerHTML = '';
        
        try {
            _renderer = new THREE.WebGLRenderer({ 
                antialias: true,
                alpha: false,
                preserveDrawingBuffer: true
            });
            _renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            _renderer.setSize(_container.clientWidth, _container.clientHeight);
            _renderer.shadowMap.enabled = true;
            _renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            _container.appendChild(_renderer.domElement);
        } catch (e) {
            console.error('ThreeJsEngine: Error al crear WebGLRenderer', e);
            return false;
        }
        
        _scene = new THREE.Scene();
        _scene.background = new THREE.Color(0x0a0f1a);
        
        _camera = createCamera();
        
        try {
            _controls = new OrbitControls(_camera, _renderer.domElement);
            _controls.target.set(0, 0, 0);
            _controls.enableDamping = true;
            _controls.dampingFactor = 0.05;
            _controls.rotateSpeed = 0.8;
            _controls.zoomSpeed = 1.2;
            _controls.panSpeed = 0.8;
            
            // === MEJORAS DE OPTIMIZACIÓN DE CÁMARA ===
            _controls.maxPolarAngle = Math.PI / 2 - 0.05; // Bloquea cámara bajo el suelo
            _controls.minDistance = 50;                   // Zoom mínimo (evita traspasar equipos)
            _controls.maxDistance = 50000;                // Zoom máximo
            _controls.enableZoom = true;
            _controls.enablePan = true;
            
            _controls.update();
        } catch (e) {
            console.warn('ThreeJsEngine: OrbitControls no disponible');
            _controls = {
                target: new THREE.Vector3(0, 0, 0),
                update: function() {},
                enableDamping: false
            };
        }
        
        setupLights();
        setupGrid();
        setupAxes();
        
        _renderer.domElement.addEventListener('pointerdown', onPointerDown);
        _renderer.domElement.addEventListener('pointerup', onPointerUp);
        _renderer.domElement.addEventListener('pointermove', onPointerMove);
        _renderer.domElement.addEventListener('wheel', function(e) { e.preventDefault(); }, { passive: false });
        
        window.addEventListener('resize', onResize);
        
        resumeLoop();
        
        console.log('✔ ThreeJsEngine v3.1 - Cámara optimizada (Three.js 0.160.0)');
        return true;
    }
    
    function createCamera() {
        var aspect = (_container.clientWidth / _container.clientHeight) || 1;
        var frustumSize = BASE_FRUSTUM_SIZE;
        
        // Planos de corte mejorados para evitar Z-fighting
        var camera = new THREE.OrthographicCamera(
            frustumSize * aspect / -2,
            frustumSize * aspect / 2,
            frustumSize / 2,
            frustumSize / -2,
            0.5,      // near - aumentado para mejor rendimiento
            20000     // far - aumentado para capturar equipos grandes
        );
        
        camera.position.set(15, 12, 15);
        camera.zoom = 1.0;
        camera.lookAt(0, 0, 0);
        
        return camera;
    }
    
    function setupLights() {
        var ambientLight = new THREE.AmbientLight(0x334455, 1.5);
        _scene.add(ambientLight);
        
        var sunLight = new THREE.DirectionalLight(0xffffff, 2.5);
        sunLight.position.set(20, 30, 15);
        sunLight.castShadow = true;
        sunLight.shadow.mapSize.width = 2048;
        sunLight.shadow.mapSize.height = 2048;
        sunLight.shadow.camera.near = 0.5;
        sunLight.shadow.camera.far = 150;
        sunLight.shadow.camera.left = -40;
        sunLight.shadow.camera.right = 40;
        sunLight.shadow.camera.top = 40;
        sunLight.shadow.camera.bottom = -40;
        _scene.add(sunLight);
        
        var fillLight = new THREE.DirectionalLight(0x8899cc, 0.6);
        fillLight.position.set(-8, 4, -10);
        _scene.add(fillLight);
        
        var hemiLight = new THREE.HemisphereLight(0x8899cc, 0x334455, 0.4);
        _scene.add(hemiLight);
    }
    
    function setupGrid() {
        // Cuadrícula principal
        var gridHelper = new THREE.GridHelper(100, 40, 0x3b82f6, 0x1e293b);
        gridHelper.position.y = -0.01;
        gridHelper.material.transparent = true;
        gridHelper.material.opacity = 0.35;
        _scene.add(gridHelper);
        
        // Cuadrícula secundaria más densa
        var fineGrid = new THREE.GridHelper(50, 20, 0x64748b, 0x334155);
        fineGrid.position.y = -0.009;
        fineGrid.material.transparent = true;
        fineGrid.material.opacity = 0.15;
        _scene.add(fineGrid);
    }
    
    let _axesGroup = null;
    
    function setupAxes() {
        _axesGroup = new THREE.Group();
        _axesGroup.userData = { isAxesGroup: true };
        
        var len = 2;
        var head = 0.3;
        var headSize = 0.15;
        
        _axesGroup.add(new THREE.ArrowHelper(
            new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 0), len, 0xff4444, head, headSize
        ));
        _axesGroup.add(new THREE.ArrowHelper(
            new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0), len, 0x44ff44, head, headSize
        ));
        _axesGroup.add(new THREE.ArrowHelper(
            new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 0), len, 0x4444ff, head, headSize
        ));
        
        _scene.add(_axesGroup);
    }
    
    function getIntersections(event) {
        if (!_renderer || !_camera) return [];
        var rect = _renderer.domElement.getBoundingClientRect();
        _mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        _mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        _raycaster.setFromCamera(_mouse, _camera);
        return _raycaster.intersectObjects(_raycastTargets, true);
    }
    
    function findRootWithTag(object) {
        var current = object;
        var depth = 0;
        while (current && depth < 30) {
            if (current.userData && current.userData.tag) return current;
            current = current.parent;
            depth++;
        }
        return null;
    }
    
    function onPointerDown(event) {
        _dragStart = { x: event.clientX, y: event.clientY };
        _isDragging = false;
    }
    
    function onPointerUp(event) {
        var dx = event.clientX - _dragStart.x;
        var dy = event.clientY - _dragStart.y;
        var dist = Math.hypot(dx, dy);
        if (dist < 5) {
            var intersects = getIntersections(event);
            if (intersects.length > 0) {
                var root = findRootWithTag(intersects[0].object);
                if (root && root.userData.tag && _core) {
                    var tag = root.userData.tag;
                    var dbObj = _core.findObjectByTag(tag);
                    if (dbObj) {
                        var isLine = _core.linesMap && _core.linesMap.has(tag);
                        _core.setSelected({ obj: dbObj, type: isLine ? 'line' : 'equipment' });
                        return;
                    }
                }
            }
            if (_core) _core.setSelected(null);
        }
        _isDragging = false;
    }
    
    function onPointerMove(event) {
        if (_dragStart.x && (Math.abs(event.clientX - _dragStart.x) > 3 || 
            Math.abs(event.clientY - _dragStart.y) > 3)) _isDragging = true;
        var intersects = getIntersections(event);
        _renderer.domElement.style.cursor = (intersects.length > 0) ? 'pointer' : 'default';
    }
    
    function registerVisualMesh(tag, mesh) {
        if (mesh) {
            mesh.userData.tag = tag;
            _visualMeshes.set(tag, mesh);
            _raycastTargets.push(mesh);
        }
    }
    
    function unregisterVisualMesh(tag) {
        var mesh = _visualMeshes.get(tag);
        if (mesh) {
            var index = _raycastTargets.indexOf(mesh);
            if (index > -1) _raycastTargets.splice(index, 1);
        }
        _visualMeshes.delete(tag);
    }
    
    function getVisualMesh(tag) {
        return _visualMeshes.get(tag) || null;
    }
    
    function clearAllMeshes() {
        var toRemove = [];
        _scene.traverse(function(child) {
            if (child.userData && child.userData.tag && 
                (child.isMesh || child.isGroup) &&
                !child.userData.isSymbolGroup &&
                !child.userData.isDimensionGroup &&
                !child.userData.isFlowArrowGroup &&
                !child.userData.isLabelGroup &&
                !child.userData.isDimensionGroup3D &&
                !child.userData.isAxesGroup) {
                toRemove.push(child);
            }
        });
        toRemove.forEach(function(obj) {
            obj.traverse(function(node) {
                if (node.geometry) { node.geometry.dispose(); node.geometry = null; }
                if (node.material) {
                    if (Array.isArray(node.material)) {
                        node.material.forEach(function(m) { if (m.map) { m.map.dispose(); m.map = null; } m.dispose(); });
                    } else {
                        if (node.material.map) { node.material.map.dispose(); node.material.map = null; }
                        node.material.dispose();
                    }
                    node.material = null;
                }
            });
            if (obj.parent) obj.parent.remove(obj);
        });
        _visualMeshes.clear();
        _raycastTargets = [];
    }
    
    function addToScene(object) { if (object && _scene) _scene.add(object); }
    function removeFromScene(object) { if (object && _scene && object.parent) object.parent.remove(object); }
    
    function pauseLoop() {
        _loopActive = false;
        if (_animationId) { cancelAnimationFrame(_animationId); _animationId = null; }
    }
    
    function resumeLoop() {
        if (!_loopActive) { _loopActive = true; animate(); }
    }
    
    // ================================================================
    // OPTIMIZACIÓN DE CÁMARA 3D - Bounding Box + FOV Calculation
    // ================================================================
    function getAllSceneObjects() {
        const objects = [];
        if (!_scene) return objects;
        
        _scene.traverse(obj => {
            // Excluir helpers, luces, grupos de anotaciones
            if (obj.isMesh && obj.visible && obj.geometry) {
                // Excluir GridHelper y ArrowHelper
                if (obj instanceof THREE.GridHelper) return;
                if (obj instanceof THREE.ArrowHelper) return;
                // Excluir elementos de UI/anotaciones
                if (obj.userData && (obj.userData.isLabel || obj.userData.isLabelAnchor || 
                    obj.userData.isLineLabel || obj.userData.isDimensionText)) return;
                objects.push(obj);
            } else if (obj.isGroup && obj.children.length > 0) {
                // Excluir grupos de anotaciones y ejes
                if (obj.userData?.isSymbolGroup === true) return;
                if (obj.userData?.isAxesGroup === true) return;
                if (obj.userData?.isLabelGroup === true) return;
                if (obj.userData?.isDimensionGroup === true) return;
                if (obj.userData?.isDimensionGroup3D === true) return;
                if (obj.userData?.isFlowArrowGroup === true) return;
                
                // Verificar si el grupo contiene geometría
                let hasGeometry = false;
                obj.traverse(child => {
                    if (child.isMesh && child.geometry && child.visible) hasGeometry = true;
                });
                if (hasGeometry) objects.push(obj);
            }
        });
        
        return objects;
    }
    
    function fitCameraToScene(camera, controls, sceneObjects, offset = 1.2) {
        if (!sceneObjects || sceneObjects.length === 0) return;

        const boundingBox = new THREE.Box3();
        
        sceneObjects.forEach(object => {
            if (object && object.isObject3D) {
                boundingBox.expandByObject(object);
            }
        });

        if (boundingBox.isEmpty()) return;

        const center = new THREE.Vector3();
        const size = new THREE.Vector3();
        boundingBox.getCenter(center);
        boundingBox.getSize(size);

        const maxDim = Math.max(size.x, size.y, size.z);
        
        // Calcular distancia óptima basada en FOV (cámara ortográfica)
        const frustumSize = BASE_FRUSTUM_SIZE;
        let optimalZoom = frustumSize / (maxDim * offset);
        optimalZoom = Math.min(Math.max(optimalZoom, 0.3), 8.0);
        
        // Posicionar cámara en diagonal isométrica manteniendo el centro
        const distance = Math.max(maxDim * 1.2, 5);
        camera.position.set(
            center.x + distance * 0.7,
            center.y + distance * 0.55,
            center.z + distance * 0.7
        );
        
        camera.zoom = optimalZoom;
        camera.updateProjectionMatrix();
        
        controls.target.copy(center);
        controls.update();
        
        console.log(`📐 Camera optimized: center=(${center.x.toFixed(1)}, ${center.y.toFixed(1)}, ${center.z.toFixed(1)}) | maxDim=${maxDim.toFixed(1)} | zoom=${optimalZoom.toFixed(3)}`);
    }
    
    function fitCameraToEquipments() {
        if (!_scene || !_camera || !_controls) return;
        
        const allObjects = getAllSceneObjects();
        
        if (allObjects.length === 0) {
            // Fallback: posición por defecto
            _camera.position.set(15, 12, 15);
            _camera.zoom = 1.0;
            _camera.updateProjectionMatrix();
            _controls.target.set(0, 0, 0);
            _controls.update();
            return;
        }
        
        fitCameraToScene(_camera, _controls, allObjects, 1.3);
    }
    
    function setView(type) {
        if (!_camera || !_controls) return;
        var center = new THREE.Vector3();
        if (_controls.target) center.copy(_controls.target);
        var dist = 30;
        switch(type) {
            case 'iso': _camera.position.set(center.x + dist*0.7, center.y + dist*0.55, center.z + dist*0.7); break;
            case 'top': _camera.position.set(center.x, center.y + dist, center.z); break;
            case 'front': _camera.position.set(center.x, center.y, center.z + dist); break;
            case 'side': _camera.position.set(center.x + dist, center.y, center.z); break;
        }
        _camera.lookAt(center);
        _camera.zoom = 1.0;
        _camera.updateProjectionMatrix();
        _controls.update();
    }
    
    function animate() {
        if (!_loopActive) return;
        _animationId = requestAnimationFrame(animate);
        
        // Actualizar controles (necesario para damping suave)
        if (_controls && _controls.update) {
            _controls.update();
        }
        
        // Renderizado principal
        if (typeof SmartFlowRender !== 'undefined' && SmartFlowRender.renderFrame) {
            SmartFlowRender.renderFrame();
        } else if (_renderer && _scene && _camera) {
            _renderer.render(_scene, _camera);
        }
        
        // Renderizado de etiquetas CSS2D
        if (typeof SmartFlowLabels3D !== 'undefined' && SmartFlowLabels3D.render) {
            SmartFlowLabels3D.render();
        }
    }
    
    function onResize() {
        if (!_container || !_camera || !_renderer) return;
        var width = _container.clientWidth;
        var height = _container.clientHeight;
        if (width === 0 || height === 0) return;
        var aspect = width / height;
        var frustumSize = BASE_FRUSTUM_SIZE;
        _camera.left = frustumSize * aspect / -2;
        _camera.right = frustumSize * aspect / 2;
        _camera.top = frustumSize / 2;
        _camera.bottom = frustumSize / -2;
        _camera.updateProjectionMatrix();
        _renderer.setSize(width, height);
    }
    
    function exportToDataURL() {
        if (_renderer && _scene && _camera) {
            _renderer.render(_scene, _camera);
            return _renderer.domElement.toDataURL('image/png');
        }
        return null;
    }
    
    function dispose() {
        pauseLoop();
        window.removeEventListener('resize', onResize);
        clearAllMeshes();
        if (_renderer) {
            _renderer.dispose();
            if (_renderer.domElement && _renderer.domElement.parentNode) {
                _renderer.domElement.parentNode.removeChild(_renderer.domElement);
            }
        }
        _scene = null;
        _camera = null;
        _renderer = null;
        _controls = null;
        _container = null;
        _core = null;
        _visualMeshes.clear();
        _raycastTargets = [];
    }
    
    function refreshCamera() {
        setTimeout(function() { fitCameraToEquipments(); }, 100);
    }
    
    return {
        init: init,
        getScene: function() { return _scene; },
        getCamera: function() { return _camera; },
        getRenderer: function() { return _renderer; },
        getControls: function() { return _controls; },
        registerVisualMesh: registerVisualMesh,
        unregisterVisualMesh: unregisterVisualMesh,
        getVisualMesh: getVisualMesh,
        clearAllMeshes: clearAllMeshes,
        addToScene: addToScene,
        removeFromScene: removeFromScene,
        pauseLoop: pauseLoop,
        resumeLoop: resumeLoop,
        fitCameraToEquipments: fitCameraToEquipments,
        setView: setView,
        exportToDataURL: exportToDataURL,
        onResize: onResize,
        dispose: dispose,
        refreshCamera: refreshCamera
    };
})();

if (typeof window !== 'undefined') {
    window.ThreeJsEngine = ThreeJsEngine;
}

export default ThreeJsEngine;
