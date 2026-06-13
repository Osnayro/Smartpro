// ============================================================
// SMARTFLOW MAIN v3.2 - Punto de Entrada Principal
// Archivo: js/main.js
// Corrección v3.2: switchModule unificado en window
// ============================================================

(function() {
    "use strict";
    
    // -------------------- 1. REFERENCIAS AL DOM --------------------
    const canvas = document.getElementById('isoCanvas');
    const notificationEl = document.getElementById('notification');
    const statusMsgEl = document.getElementById('statusMsg');
    const commandPanel = document.getElementById('commandPanel');
    const commandText = document.getElementById('commandText');
    const customElev = document.getElementById('customElev');
    const sidePanel = document.getElementById('side-panel');
    const panelContent = document.getElementById('panel-content');
    
    const splashScreen = document.getElementById('splash-screen');
    const welcomePanel = document.getElementById('welcome-panel');
    const projectModal = document.getElementById('project-name-modal');
    const projectInput = document.getElementById('project-name-input');
    
    // -------------------- 2. ESTADO --------------------
    let toolMode = 'select';
    let voiceEnabled = true;
    let _is2DInitialized = false;
    let _is3DInitialized = false;
    let _ioInitialized = false;
    let _modulesInitialized = false;
    let draggingEquipment = false;
    let draggedEquipTag = null;
    let dragLastPos = { x: 0, y: 0 };
    
    // -------------------- 3. HISTORIAL --------------------
    const _commandHistory = [];
    const MAX_HISTORY = 50;
    let _historyIndex = -1;
    let _tempCommand = '';
    let _isNavigatingHistory = false;
    
    function addToHistory(cmd) {
        const trimmed = cmd.trim();
        if (!trimmed) return;
        if (_commandHistory.length > 0 && _commandHistory[_commandHistory.length - 1] === trimmed) return;
        _commandHistory.push(trimmed);
        if (_commandHistory.length > MAX_HISTORY) _commandHistory.shift();
        _historyIndex = _commandHistory.length;
        updateHistoryIndicator();
    }
    
    function updateHistoryIndicator() {
        const indicator = document.getElementById('historyIndicator');
        if (indicator) {
            indicator.textContent = _commandHistory.length > 0 ? '⏺ Historial: ' + _commandHistory.length + ' comandos' : '';
        }
    }
    
    function navigateHistory(direction) {
        if (!commandText || _isNavigatingHistory) return;
        _isNavigatingHistory = true;
        if (_historyIndex === _commandHistory.length) _tempCommand = commandText.value;
        if (direction === 'up' && _historyIndex > 0) { _historyIndex--; commandText.value = _commandHistory[_historyIndex]; }
        else if (direction === 'down' && _historyIndex < _commandHistory.length - 1) { _historyIndex++; commandText.value = _commandHistory[_historyIndex]; }
        else if (direction === 'down' && _historyIndex === _commandHistory.length - 1) { _historyIndex++; commandText.value = _tempCommand || ''; }
        setTimeout(function() { _isNavigatingHistory = false; }, 50);
    }
    
    // -------------------- 4. UI --------------------
    function notify(msg, isErr) {
        if (isErr === undefined) isErr = false;
        if (notificationEl) { notificationEl.textContent = msg; notificationEl.style.backgroundColor = isErr ? '#da3633' : '#238636'; notificationEl.style.display = 'block'; }
        if (statusMsgEl) statusMsgEl.textContent = msg;
        if (voiceEnabled && window.speechSynthesis) { window.speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(msg); u.lang = 'es-ES'; setTimeout(function() { window.speechSynthesis.speak(u); }, 50); }
        setTimeout(function() { if (notificationEl) notificationEl.style.display = 'none'; }, 5000);
    }
    
    function voiceFn(msg) { if (voiceEnabled && window.speechSynthesis) { window.speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(msg); u.lang = 'es-ES'; window.speechSynthesis.speak(u); } }
    
    function scheduleRender() {
        var m = window.currentModule || 'pfd';
        if (m === 'pfd' && typeof SmartFlowPFDRenderer !== 'undefined') SmartFlowPFDRenderer.render();
        else if (m === 'dti' && typeof SmartFlowDTIRenderer !== 'undefined') SmartFlowDTIRenderer.render();
        else if (m === 'iso' && window.currentViewMode === '2d' && window.SmartFlowRenderer) window.SmartFlowRenderer.render();
        else if (m === 'iso' && window.currentViewMode === '3d' && window.SmartFlowRender) window.SmartFlowRender.renderFrame();
    }
    
    function autoCenter() {
        var m = window.currentModule || 'pfd';
        if (m === 'pfd' && typeof SmartFlowPFDRenderer !== 'undefined') SmartFlowPFDRenderer.render();
        else if (m === 'dti' && typeof SmartFlowDTIRenderer !== 'undefined') SmartFlowDTIRenderer.render();
        else if (m === 'iso' && window.currentViewMode === '2d' && window.SmartFlowRenderer) window.SmartFlowRenderer.autoCenter();
        else if (m === 'iso' && window.currentViewMode === '3d' && window.ThreeJsEngine) window.ThreeJsEngine.fitCameraToEquipments();
    }
    
    function toggleFullscreen() { document.body.classList.add('fullscreen-mode'); autoCenter(); }
    function exitFullscreen() { document.body.classList.remove('fullscreen-mode'); autoCenter(); }
    function togglePanel(show) { if (sidePanel) { if (show) sidePanel.classList.remove('hidden'); else sidePanel.classList.add('hidden'); } }
    function toggleAllPanels() { const panels = [sidePanel, document.getElementById('toolsPanel')]; const visible = sidePanel && sidePanel.style.display !== 'none'; panels.forEach(function(p) { if (p) p.style.display = visible ? 'none' : ''; }); }
    
    function updatePropertyPanel(info) {
        if (!panelContent) return;
        if (!info) { togglePanel(false); return; }
        togglePanel(true);
        panelContent.innerHTML = `
            <div class="prop-group"><span class="prop-label">TAG</span><span class="prop-value">${info.tag || 'N/A'}</span></div>
            <div class="prop-group"><span class="prop-label">TIPO</span><span class="prop-value">${info.tipo || 'Desconocido'}</span></div>
            <div class="prop-group"><span class="prop-label">MATERIAL</span><span class="prop-value">${info.material || 'N/A'}</span></div>
            <div class="prop-group"><span class="prop-label">DIÁMETRO</span><span class="prop-value">${info.diametro || 'N/A'}</span></div>
            <hr style="border:0; border-top:1px solid rgba(255,255,255,0.1); margin:15px 0;">
            <div class="prop-group"><span class="prop-label">PUERTOS</span>${info.puertos && info.puertos.length ? info.puertos.map(function(p) { return `<div class="port-item"><span>${p.id}</span><span class="${p.status === 'open' ? 'port-open' : 'port-connected'}">${p.status === 'open' ? 'DISPONIBLE' : 'CONECTADO'}</span></div>`; }).join('') : '<p>Sin puertos</p>'}</div>`;
    }
    
    // -------------------- 5. INICIALIZACIÓN DE MÓDULOS --------------------
    function initModules() {
        SmartFlowCore.init(notify, scheduleRender, updatePropertyPanel);
        console.log('✅ Core v6.0');
        
        if (typeof SmartFlowIO !== 'undefined' && !_ioInitialized) { SmartFlowIO.init(SmartFlowCore, notify); _ioInitialized = true; console.log('✅ I/O'); }
        if (typeof SmartFlowDBExport !== 'undefined') { SmartFlowDBExport.init(SmartFlowCore, typeof SmartFlowIO !== 'undefined' ? SmartFlowIO : null, notify); console.log('✅ DB Export'); }
        if (typeof SmartFlowPFD !== 'undefined') { SmartFlowPFD.init(SmartFlowCore, typeof SmartFlowCatalog !== 'undefined' ? SmartFlowCatalog : null, notify); console.log('✅ PFD Engine'); }
        if (typeof SmartFlowDTI !== 'undefined') { SmartFlowDTI.init(SmartFlowCore, typeof SmartFlowCatalog !== 'undefined' ? SmartFlowCatalog : null, notify); console.log('✅ DTI Engine'); }
        if (typeof SmartFlowIntegrity !== 'undefined') { SmartFlowIntegrity.init(SmartFlowCore, typeof SmartFlowPFD !== 'undefined' ? SmartFlowPFD : null, typeof SmartFlowDTI !== 'undefined' ? SmartFlowDTI : null, notify); console.log('✅ Integrity'); }
        
        var pfdCanvas = document.getElementById('pfd-canvas');
        if (typeof SmartFlowPFDRenderer !== 'undefined' && pfdCanvas) { SmartFlowPFDRenderer.init(pfdCanvas, SmartFlowCore, notify); console.log('✅ PFD Renderer'); }
        
        var dtiCanvas = document.getElementById('dti-canvas');
        if (typeof SmartFlowDTIRenderer !== 'undefined' && dtiCanvas) { SmartFlowDTIRenderer.init(dtiCanvas, SmartFlowCore, notify); console.log('✅ DTI Renderer'); }
        
        if (typeof SmartFlowRenderer !== 'undefined' && canvas) { SmartFlowRenderer.init(canvas, SmartFlowCore, notify); _is2DInitialized = true; console.log('✅ ISO Renderer'); }
        if (typeof SmartFlowRouter !== 'undefined') { SmartFlowRouter.init(SmartFlowCore, SmartFlowCatalog, notify, scheduleRender); }
        
        SmartFlowCommands.init(SmartFlowCore, SmartFlowCatalog, SmartFlowRenderer, notify, scheduleRender, voiceFn);
        SmartFlowCore.setVoice(voiceEnabled);
        _modulesInitialized = true;
        notify('SmartEngp v3.2 listo | PFD + DTI + ISO', false);
    }
    
    // -------------------- 6. SWITCH DE MÓDULO (DEFINIDO UNA SOLA VEZ) --------------------
    window.switchModule = function(module) {
        window.currentModule = module;
        
        var pfdCanvas = document.getElementById('pfd-canvas');
        var dtiCanvas = document.getElementById('dti-canvas');
        var isoCanvas = document.getElementById('isoCanvas');
        var viewer3d = document.getElementById('viewer-3d');
        
        if (pfdCanvas) pfdCanvas.style.display = 'none';
        if (dtiCanvas) dtiCanvas.style.display = 'none';
        if (isoCanvas) isoCanvas.style.display = 'none';
        if (viewer3d) viewer3d.style.display = 'none';
        
        var toolsPanel = document.getElementById('toolsPanel');
        if (toolsPanel) toolsPanel.style.display = module === 'iso' ? '' : 'none';
        
        document.querySelectorAll('.module-tab').forEach(function(t) { t.classList.remove('active'); });
        
        var bp = document.getElementById('btn-mode-pfd');
        var bd = document.getElementById('btn-mode-dti');
        var bi = document.getElementById('btn-mode-iso');
        if (bp) bp.classList.remove('active');
        if (bd) bd.classList.remove('active');
        if (bi) bi.classList.remove('active');
        
        if (module === 'pfd') {
            if (pfdCanvas) pfdCanvas.style.display = 'block';
            var tp = document.querySelector('.pfd-tab'); if (tp) tp.classList.add('active');
            if (bp) bp.classList.add('active');
            if (typeof SmartFlowPFDRenderer !== 'undefined') { SmartFlowPFDRenderer.resizeCanvas(); setTimeout(function() { SmartFlowPFDRenderer.render(); }, 50); }
        } else if (module === 'dti') {
            if (dtiCanvas) dtiCanvas.style.display = 'block';
            var td = document.querySelector('.dti-tab'); if (td) td.classList.add('active');
            if (bd) bd.classList.add('active');
            if (typeof SmartFlowDTIRenderer !== 'undefined') { SmartFlowDTIRenderer.resizeCanvas(); setTimeout(function() { SmartFlowDTIRenderer.render(); }, 50); }
        } else if (module === 'iso') {
            if (isoCanvas) isoCanvas.style.display = 'block';
            var ti = document.querySelector('.iso-tab'); if (ti) ti.classList.add('active');
            if (bi) bi.classList.add('active');
            if (typeof SmartFlowRenderer !== 'undefined') { SmartFlowRenderer.resizeCanvas(); setTimeout(function() { SmartFlowRenderer.autoCenter(); }, 100); }
        }
    };
    
    // -------------------- 7. PROYECTOS --------------------
    function guardarProyecto() { if (typeof SmartFlowIO !== 'undefined') { SmartFlowIO.downloadJSON(); return; } localStorage.setItem('smartengp_v3_project', SmartFlowCore.exportProject()); notify("✅ Guardado.", false); }
    function cargarProyecto() { if (typeof SmartFlowIO !== 'undefined') { SmartFlowIO.uploadAndImportJSON(); return; } const d = localStorage.getItem('smartengp_v3_project'); if (d) { try { SmartFlowCore.importState(JSON.parse(d)); autoCenter(); } catch(e) { notify("Error.", true); } } else { notify("Sin proyecto.", true); } }
    function exportarProyectoArchivo() { if (typeof SmartFlowIO !== 'undefined') SmartFlowIO.downloadJSON(); }
    function importarProyectoArchivo() { if (typeof SmartFlowIO !== 'undefined') SmartFlowIO.uploadAndImportJSON(); }
    function nuevoProyecto() { if (confirm("¿Nuevo proyecto?")) { SmartFlowCore.nuevoProyecto(); autoCenter(); } }
    function iniciarNuevoProyecto() { const n = projectInput ? projectInput.value.trim() : ''; if (n) window.currentProjectName = n; if (projectModal) projectModal.style.display = 'none'; if (welcomePanel) welcomePanel.classList.add('welcome-hidden'); SmartFlowCore.nuevoProyecto(); if (statusMsgEl) statusMsgEl.textContent = 'Proyecto: ' + window.currentProjectName; autoCenter(); }
    function saltarNombreProyecto() { if (projectModal) projectModal.style.display = 'none'; if (welcomePanel) welcomePanel.classList.add('welcome-hidden'); if (statusMsgEl) statusMsgEl.textContent = 'Proyecto: ' + window.currentProjectName; }
    
    // -------------------- 8. HERRAMIENTAS --------------------
    function setTool(mode) { toolMode = mode; var ids = { select: 'toolSelect', moveEq: 'toolMoveEq', editPipe: 'toolEditPipe', addPoint: 'toolAddPoint' }; Object.keys(ids).forEach(function(k) { var b = document.getElementById(ids[k]); if (b) b.classList.toggle('active', mode === k); }); }
    window.setElevation = function(level) { SmartFlowCore.setElevation(level); if (window.currentModule === 'iso' && window.currentViewMode === '2d' && window.SmartFlowRenderer) window.SmartFlowRenderer.setElevation(level); if (customElev) customElev.value = level; };
    function toggleVoice() { voiceEnabled = !voiceEnabled; SmartFlowCore.setVoice(voiceEnabled); var b = document.getElementById('btnVoice'); if (b) b.textContent = voiceEnabled ? '🔊 Voz ON' : '🔇 Voz OFF'; }
    
    // -------------------- 9. ATAJOS --------------------
    function setupKeyboardShortcuts() {
        document.addEventListener('keydown', function(e) {
            if (e.ctrlKey && e.shiftKey) {
                switch(e.key.toUpperCase()) {
                    case 'C': e.preventDefault(); abrirPanelComandos(); break;
                    case 'V': e.preventDefault(); autoCenter(); break;
                    case 'U': e.preventDefault(); SmartFlowCore.undo(); scheduleRender(); break;
                    case 'Y': e.preventDefault(); SmartFlowCore.redo(); scheduleRender(); break;
                    case 'S': e.preventDefault(); guardarProyecto(); break;
                    case 'E': e.preventDefault(); if (typeof SmartFlowIO !== 'undefined') SmartFlowIO.downloadPCF(); break;
                    case 'M': e.preventDefault(); if (typeof SmartFlowIO !== 'undefined') SmartFlowIO.downloadMTO(); break;
                    case 'D': e.preventDefault(); if (typeof SmartFlowDBExport !== 'undefined') SmartFlowDBExport.exportDatabase(); break;
                    case 'A': e.preventDefault(); if (typeof SmartFlowIntegrity !== 'undefined') SmartFlowIntegrity.validateAll(); break;
                    case '1': e.preventDefault(); if (typeof window.switchModule === 'function') window.switchModule('pfd'); break;
                    case '2': e.preventDefault(); if (typeof window.switchModule === 'function') window.switchModule('dti'); break;
                    case '3': e.preventDefault(); if (typeof window.switchModule === 'function') window.switchModule('iso'); break;
                }
            }
        });
    }
    
    // -------------------- 10. COMANDOS --------------------
    function abrirPanelComandos() { if (commandPanel) { commandPanel.style.display = 'block'; if (commandText) commandText.focus(); } }
    function ejecutarComando() {
        if (!commandText) return;
        const txt = commandText.value.trim();
        if (!txt) return;
        const lineas = txt.split('\n').filter(function(l) { return l.trim(); });
        let ok = lineas.length === 1 ? SmartFlowCommands.executeCommand(lineas[0]) !== false : SmartFlowCommands.executeBatch(lineas.join('\n')) > 0;
        if (ok) addToHistory(txt);
        commandText.value = ''; _historyIndex = _commandHistory.length; _tempCommand = '';
        const first = lineas[0].toLowerCase();
        if (!['info', 'list', 'help', 'ayuda', 'validate', 'validar', 'summary', 'resumen', 'balance'].some(function(k) { return first.startsWith(k); })) { if (commandPanel) commandPanel.style.display = 'none'; }
        scheduleRender();
    }
    
    // -------------------- 11. BOTONES --------------------
    function bindEvents() {
        const v = function(id, accion) { const el = document.getElementById(id); if (el) el.onclick = accion; };
        v('welcome-new-project', function() { if (projectModal) projectModal.style.display = 'flex'; });
        v('welcome-open-project', function() { cargarProyecto(); if (welcomePanel) welcomePanel.classList.add('welcome-hidden'); });
        v('modal-accept', iniciarNuevoProyecto);
        v('modal-skip', saltarNombreProyecto);
        v('btnOpen', cargarProyecto);
        v('btnSave', guardarProyecto);
        v('btnExportProject', exportarProyectoArchivo);
        v('btnImportProject', importarProyectoArchivo);
        v('btnExportDB', function() { if (typeof SmartFlowDBExport !== 'undefined') SmartFlowDBExport.exportDatabase(); });
        v('btnExportPCF', function() { if (typeof SmartFlowIO !== 'undefined') SmartFlowIO.downloadPCF(); });
        v('btnImportPCF', function() { if (typeof SmartFlowIO !== 'undefined') SmartFlowIO.uploadAndImportPCF(); });
        v('btnMTO', function() { if (typeof SmartFlowIO !== 'undefined') SmartFlowIO.downloadMTO(); });
        v('btn-mode-pfd', function() { if (typeof window.switchModule === 'function') window.switchModule('pfd'); });
        v('btn-mode-dti', function() { if (typeof window.switchModule === 'function') window.switchModule('dti'); });
        v('btn-mode-iso', function() { if (typeof window.switchModule === 'function') window.switchModule('iso'); });
        v('btnValidate', function() { if (typeof SmartFlowIntegrity !== 'undefined') SmartFlowIntegrity.validateAll(); });
        v('btnSummary', function() { if (typeof SmartFlowIntegrity !== 'undefined') SmartFlowIntegrity.quickSummary(); });
        v('btnReset', autoCenter);
        v('btnFullscreen', toggleFullscreen);
        v('btnFullscreenCenter', autoCenter);
        v('btnFullscreenExit', exitFullscreen);
        v('btnTogglePanels', toggleAllPanels);
        v('btnCommand', abrirPanelComandos);
        v('closeCommand', function() { if (commandPanel) commandPanel.style.display = 'none'; });
        v('clearCommand', function() { if (commandText) { commandText.value = ''; _historyIndex = _commandHistory.length; _tempCommand = ''; } });
        v('runCommands', ejecutarComando);
        v('toolSelect', function() { setTool('select'); });
        v('toolMoveEq', function() { setTool('moveEq'); });
        v('toolEditPipe', function() { setTool('editPipe'); });
        v('toolAddPoint', function() { setTool('addPoint'); });
        v('btnUndo', function() { SmartFlowCore.undo(); scheduleRender(); });
        v('btnRedo', function() { SmartFlowCore.redo(); scheduleRender(); });
        v('btnVoice', toggleVoice);
        v('btnRecalc', function() { SmartFlowCore.syncPhysicalData(); scheduleRender(); });
        v('btnSpeakSummary', function() { if (typeof SmartFlowIntegrity !== 'undefined') SmartFlowIntegrity.quickSummary(); });
        v('btnSetElev', function() { const val = parseInt(customElev ? customElev.value : 0); if (!isNaN(val)) window.setElevation(val); });
        
        function setupDropdown(id) { const b = document.getElementById(id); if (!b) return; b.addEventListener('click', function(e) { e.stopPropagation(); const p = this.closest('.dropdown'); if (p) p.classList.toggle('open'); }); }
        setupDropdown('btnFileMenu');
        setupDropdown('btnMoreMenu');
        document.addEventListener('click', function(e) { if (!e.target.closest('.dropdown')) document.querySelectorAll('.dropdown.open').forEach(function(d) { d.classList.remove('open'); }); });
        
        if (commandText) {
            commandText.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ejecutarComando(); }
                else if (e.key === 'ArrowUp') { e.preventDefault(); navigateHistory('up'); }
                else if (e.key === 'ArrowDown') { e.preventDefault(); navigateHistory('down'); }
            });
        }
        
        let rt;
        window.addEventListener('resize', function() { clearTimeout(rt); rt = setTimeout(function() { var m = window.currentModule || 'pfd'; if (m === 'pfd' && typeof SmartFlowPFDRenderer !== 'undefined') { SmartFlowPFDRenderer.resizeCanvas(); SmartFlowPFDRenderer.render(); } else if (m === 'dti' && typeof SmartFlowDTIRenderer !== 'undefined') { SmartFlowDTIRenderer.resizeCanvas(); SmartFlowDTIRenderer.render(); } else if (m === 'iso' && typeof SmartFlowRenderer !== 'undefined') { SmartFlowRenderer.resizeCanvas(); } }, 150); });
    }
    
    // -------------------- 12. ARRANQUE --------------------
    function init() {
        window.currentProjectName = window.currentProjectName || 'Proyecto_SmartEngp';
        window.voiceEnabled = true;
        window.currentModule = 'pfd';
        window.currentViewMode = '2d';
        
        const ss = document.getElementById('splash-status');
        const msgs = ["Cargando...", "Core v6.0...", "PFD Engine...", "DTI Engine...", "Integrity...", "PFD Renderer...", "DTI Renderer...", "¡SmartEngp v3.2!"];
        let mi = 0;
        const iv = setInterval(function() { if (mi < msgs.length && ss) { ss.textContent = msgs[mi]; mi++; } }, 600);
        
        function bootstrap() {
            if (typeof SmartFlowCore === 'undefined' || typeof SmartFlowCommands === 'undefined') { setTimeout(bootstrap, 100); return; }
            initModules();
            bindEvents();
            setupKeyboardShortcuts();
            setTool('select');
            window.setElevation(0);
            if (splashScreen) splashScreen.classList.add('splash-hidden');
            clearInterval(iv);
            setTimeout(function() { if (welcomePanel) welcomePanel.classList.remove('welcome-hidden'); }, 300);
            if (typeof window.switchModule === 'function') window.switchModule('pfd');
            setTimeout(function() { if (typeof SmartFlowIntegrity !== 'undefined') SmartFlowIntegrity.quickSummary(); }, 2500);
        }
        setTimeout(bootstrap, 4000);
        if (window.innerWidth < 768) togglePanel(false);
    }
    
    init();
})();
