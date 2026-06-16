
(function() {
    "use strict";
    
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
    
    let toolMode = 'select';
    let voiceEnabled = true;
    let _is2DInitialized = false;
    let _is3DInitialized = false;
    let _ioInitialized = false;
    let _modulesInitialized = false;
    let draggingEquipment = false;
    let draggedEquipTag = null;
    let dragLastPos = { x: 0, y: 0 };
    
    const _commandHistory = [];
    const MAX_HISTORY = 50;
    let _historyIndex = -1;
    let _tempCommand = '';
    let _isNavigatingHistory = false;
    
    // ================================================================
    // FUNCIONES DE HISTORIAL
    // ================================================================
    
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
        if (indicator) { indicator.textContent = _commandHistory.length > 0 ? '⏺ Historial: ' + _commandHistory.length + ' comandos' : ''; }
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
    
    // ================================================================
    // NOTIFICACIONES Y VOZ
    // ================================================================
    
    function notify(msg, isErr) {
        if (isErr === undefined) isErr = false;
        if (notificationEl) { notificationEl.textContent = msg; notificationEl.style.backgroundColor = isErr ? '#da3633' : '#238636'; notificationEl.style.display = 'block'; }
        if (statusMsgEl) statusMsgEl.textContent = msg;
        if (voiceEnabled && window.speechSynthesis) { window.speechSynthesis.cancel(); var u = new SpeechSynthesisUtterance(msg); u.lang = 'es-ES'; setTimeout(function() { window.speechSynthesis.speak(u); }, 50); }
        setTimeout(function() { if (notificationEl) notificationEl.style.display = 'none'; }, 5000);
    }
    
    function voiceFn(msg) { if (voiceEnabled && window.speechSynthesis) { window.speechSynthesis.cancel(); var u = new SpeechSynthesisUtterance(msg); u.lang = 'es-ES'; window.speechSynthesis.speak(u); } }
    
    // ================================================================
    // RENDERIZADO Y VISUALIZACIÓN
    // ================================================================
    
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
    function toggleAllPanels() { var panels = [sidePanel, document.getElementById('toolsPanel')]; var visible = sidePanel && sidePanel.style.display !== 'none'; panels.forEach(function(p) { if (p) p.style.display = visible ? 'none' : ''; }); }
    
    function updatePropertyPanel(info) {
        if (!panelContent) return;
        if (!info) { togglePanel(false); return; }
        togglePanel(true);
        panelContent.innerHTML = '<div class="prop-group"><span class="prop-label">TAG</span><span class="prop-value">' + (info.tag || 'N/A') + '</span></div><div class="prop-group"><span class="prop-label">TIPO</span><span class="prop-value">' + (info.tipo || 'Desconocido') + '</span></div><div class="prop-group"><span class="prop-label">MATERIAL</span><span class="prop-value">' + (info.material || 'N/A') + '</span></div><div class="prop-group"><span class="prop-label">DIÁMETRO</span><span class="prop-value">' + (info.diametro || 'N/A') + '</span></div><hr style="border:0;border-top:1px solid rgba(255,255,255,0.1);margin:15px 0"><div class="prop-group"><span class="prop-label">PUERTOS</span>' + (info.puertos && info.puertos.length ? info.puertos.map(function(p) { return '<div class="port-item"><span>' + p.id + '</span><span class="' + (p.status === 'open' ? 'port-open' : 'port-connected') + '">' + (p.status === 'open' ? 'DISPONIBLE' : 'CONECTADO') + '</span></div>'; }).join('') : '<p>Sin puertos</p>') + '</div>';
    }
    
    // ================================================================
    // INICIALIZACIÓN DE MÓDULOS
    // ================================================================
    
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
        
        // ============================================================
        // SISTEMA ADAPTATIVO - SOLO INICIALIZAR, NO REDECLARAR
        // ============================================================
        if (typeof AdaptiveCommandSystem !== 'undefined') {
            AdaptiveCommandSystem.setActiveModule(window.currentModule || 'pfd');
            console.log('✅ AdaptiveCommandSystem inicializado (módulo: ' + (window.currentModule || 'pfd') + ')');
        }
        
        // SOLO VERIFICAR, NO REDECLARAR AdaptiveCommandsUI
        if (typeof AdaptiveCommandsUI !== 'undefined') {
            console.log('✅ AdaptiveCommandsUI disponible');
            if (typeof AdaptiveCommandsUI.init === 'function') {
                AdaptiveCommandsUI.init();
            }
        } else {
            console.warn('⚠️ AdaptiveCommandsUI no disponible');
        }
        
        _modulesInitialized = true;
        notify('SmartEngp v3.4 listo | PFD + DTI + ISO', false);
    }
    
    // ================================================================
    // CAMBIO DE MÓDULO
    // ================================================================
    
    function switchModule(module) {
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
        
        // ACTUALIZAR SISTEMA ADAPTATIVO
        if (typeof AdaptiveCommandSystem !== 'undefined') {
            AdaptiveCommandSystem.setActiveModule(module);
            console.log('🔄 AdaptiveCommandSystem: módulo cambiado a ' + module);
        }
        
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
    }
    
    // ================================================================
    // FUNCIONES DE PROYECTO
    // ================================================================
    
    function guardarProyecto() {
        var state = SmartFlowCore.exportProject();
        localStorage.setItem('smartengp_v3_project', state);
        notify("✅ Proyecto guardado en el navegador.", false);
    }
    
    function cargarProyecto() {
        var data = localStorage.getItem('smartengp_v3_project');
        if (data) {
            try {
                var state = JSON.parse(data);
                SmartFlowCore.importState(state.data || state);
                autoCenter();
                notify("✅ Proyecto cargado correctamente.", false);
            } catch (e) { notify("Error al cargar el proyecto.", true); }
        } else { notify("No hay proyecto guardado en el navegador.", true); }
    }
    
    function exportarProyectoArchivo() { if (typeof SmartFlowIO !== 'undefined') SmartFlowIO.downloadJSON(); }
    function importarProyectoArchivo() { if (typeof SmartFlowIO !== 'undefined') SmartFlowIO.uploadAndImportJSON(); }
    function nuevoProyecto() { if (confirm("¿Crear nuevo proyecto? Se perderán los cambios no guardados.")) { SmartFlowCore.nuevoProyecto(); autoCenter(); } }
    function iniciarNuevoProyecto() { var n = projectInput ? projectInput.value.trim() : ''; if (n) window.currentProjectName = n; if (projectModal) projectModal.style.display = 'none'; if (welcomePanel) welcomePanel.classList.add('welcome-hidden'); SmartFlowCore.nuevoProyecto(); if (statusMsgEl) statusMsgEl.textContent = 'Proyecto: ' + window.currentProjectName; autoCenter(); }
    function saltarNombreProyecto() { if (projectModal) projectModal.style.display = 'none'; if (welcomePanel) welcomePanel.classList.add('welcome-hidden'); if (statusMsgEl) statusMsgEl.textContent = 'Proyecto: ' + window.currentProjectName; }
    
    // ================================================================
    // HERRAMIENTAS Y UTILIDADES
    // ================================================================
    
    function setTool(mode) { toolMode = mode; var ids = { select: 'toolSelect', moveEq: 'toolMoveEq', editPipe: 'toolEditPipe', addPoint: 'toolAddPoint' }; Object.keys(ids).forEach(function(k) { var b = document.getElementById(ids[k]); if (b) b.classList.toggle('active', mode === k); }); }
    
    function setElevation(level) {
        SmartFlowCore.setElevation(level);
        if (window.currentModule === 'iso' && window.currentViewMode === '2d' && window.SmartFlowRenderer) window.SmartFlowRenderer.setElevation(level);
        if (customElev) customElev.value = level;
    }
    
    function toggleVoice() { voiceEnabled = !voiceEnabled; SmartFlowCore.setVoice(voiceEnabled); var b = document.getElementById('btnVoice'); if (b) b.textContent = voiceEnabled ? '🔊 Voz ON' : '🔇 Voz OFF'; }
    
    // ================================================================
    // EJECUCIÓN DE COMANDOS
    // ================================================================
    
    function ejecutarComando() {
        if (!commandText) return;
        var txt = commandText.value.trim();
        if (!txt) return;
        var lineas = txt.split('\n').filter(function(l) { return l.trim(); });
        var ok = lineas.length === 1 ? SmartFlowCommands.executeCommand(lineas[0]) !== false : SmartFlowCommands.executeBatch(lineas.join('\n')) > 0;
        if (ok) addToHistory(txt);
        commandText.value = ''; _historyIndex = _commandHistory.length; _tempCommand = '';
        var first = lineas[0].toLowerCase();
        if (!['info','list','help','ayuda','validate','validar','summary','resumen','balance'].some(function(k) { return first.startsWith(k); })) { if (commandPanel) commandPanel.style.display = 'none'; }
        scheduleRender();
    }
    
    function abrirPanelComandos() {
        // Usar la UI adaptativa si está disponible
        if (typeof AdaptiveCommandsUI !== 'undefined') {
            AdaptiveCommandsUI.toggle();
        } else {
            // Fallback: panel tradicional
            if (commandPanel) {
                commandPanel.style.display = 'block';
                if (commandText) commandText.focus();
            }
        }
    }
    
    // ================================================================
    // ATALAJOS DE TECLADO
    // ================================================================
    
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
                    case '1': e.preventDefault(); switchModule('pfd'); break;
                    case '2': e.preventDefault(); switchModule('dti'); break;
                    case '3': e.preventDefault(); switchModule('iso'); break;
                }
            }
        });
    }
    
    // ================================================================
    // EVENTOS DEL DOM
    // ================================================================
    
    function bindEvents() {
        var v = function(id, accion) { 
            var el = document.getElementById(id); 
            if (el) el.onclick = accion; 
        };
        
        // ============================================================
        // PROYECTO
        // ============================================================
        v('welcome-new-project', function() { 
            if (projectModal) projectModal.style.display = 'flex'; 
        });
        v('welcome-open-project', function() { 
            cargarProyecto(); 
            if (welcomePanel) welcomePanel.classList.add('welcome-hidden'); 
        });
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
        
        // ============================================================
        // MÓDULOS
        // ============================================================
        v('btn-mode-pfd', function() { switchModule('pfd'); });
        v('btn-mode-dti', function() { switchModule('dti'); });
        v('btn-mode-iso', function() { switchModule('iso'); });
        
        // ============================================================
        // ACCIONES
        // ============================================================
        v('btnValidate', function() { if (typeof SmartFlowIntegrity !== 'undefined') SmartFlowIntegrity.validateAll(); });
        v('btnSummary', function() { if (typeof SmartFlowIntegrity !== 'undefined') SmartFlowIntegrity.quickSummary(); });
        v('btnReset', autoCenter);
        v('btnFullscreen', toggleFullscreen);
        v('btnFullscreenCenter', autoCenter);
        v('btnFullscreenExit', exitFullscreen);
        v('btnTogglePanels', toggleAllPanels);
        
        // ============================================================
        // COMANDOS
        // ============================================================
        // BOTÓN DE COMANDOS - USA LA UI ADAPTATIVA
        var cmdBtn = document.getElementById('btnCommand');
        if (cmdBtn) {
            cmdBtn.onclick = function() {
                abrirPanelComandos();
            };
        }
        
        v('closeCommand', function() { if (commandPanel) commandPanel.style.display = 'none'; });
        v('clearCommand', function() { if (commandText) { commandText.value = ''; _historyIndex = _commandHistory.length; _tempCommand = ''; } });
        v('runCommands', ejecutarComando);
        
        // ============================================================
        // HERRAMIENTAS
        // ============================================================
        v('toolSelect', function() { setTool('select'); });
        v('toolMoveEq', function() { setTool('moveEq'); });
        v('toolEditPipe', function() { setTool('editPipe'); });
        v('toolAddPoint', function() { setTool('addPoint'); });
        
        // ============================================================
        // BOTONES ADICIONALES
        // ============================================================
        v('btnUndo', function() { SmartFlowCore.undo(); scheduleRender(); });
        v('btnRedo', function() { SmartFlowCore.redo(); scheduleRender(); });
        v('btnVoice', toggleVoice);
        v('btnRecalc', function() { SmartFlowCore.syncPhysicalData(); scheduleRender(); });
        v('btnSpeakSummary', function() { if (typeof SmartFlowIntegrity !== 'undefined') SmartFlowIntegrity.quickSummary(); });
        v('btnSetElev', function() { var val = parseInt(customElev ? customElev.value : 0); if (!isNaN(val)) setElevation(val); });
        
        // ============================================================
        // DROPDOWNS
        // ============================================================
        function setupDropdown(id) { 
            var b = document.getElementById(id); 
            if (!b) return; 
            b.addEventListener('click', function(e) { 
                e.stopPropagation(); 
                var p = this.closest('.dropdown'); 
                if (p) p.classList.toggle('open'); 
            }); 
        }
        setupDropdown('btnFileMenu');
        setupDropdown('btnMoreMenu');
        
        document.addEventListener('click', function(e) { 
            if (!e.target.closest('.dropdown')) {
                document.querySelectorAll('.dropdown.open').forEach(function(d) { 
                    d.classList.remove('open'); 
                });
            }
        });
        
        // ============================================================
        // TECLADO EN COMMAND TEXT
        // ============================================================
        if (commandText) {
            commandText.addEventListener('keydown', function(e) { 
                if (e.key === 'Enter' && !e.shiftKey) { 
                    e.preventDefault(); 
                    ejecutarComando(); 
                } else if (e.key === 'ArrowUp') { 
                    e.preventDefault(); 
                    navigateHistory('up'); 
                } else if (e.key === 'ArrowDown') { 
                    e.preventDefault(); 
                    navigateHistory('down'); 
                } 
            });
        }
        
        // ============================================================
        // RESIZE
        // ============================================================
        var rt;
        window.addEventListener('resize', function() { 
            clearTimeout(rt); 
            rt = setTimeout(function() { 
                var m = window.currentModule || 'pfd'; 
                if (m === 'pfd' && typeof SmartFlowPFDRenderer !== 'undefined') { 
                    SmartFlowPFDRenderer.resizeCanvas(); 
                    SmartFlowPFDRenderer.render(); 
                } else if (m === 'dti' && typeof SmartFlowDTIRenderer !== 'undefined') { 
                    SmartFlowDTIRenderer.resizeCanvas(); 
                    SmartFlowDTIRenderer.render(); 
                } else if (m === 'iso' && typeof SmartFlowRenderer !== 'undefined') { 
                    SmartFlowRenderer.resizeCanvas(); 
                } 
            }, 150); 
        });
        
        // ============================================================
        // PANEL DE PROPIEDADES (CLOSE)
        // ============================================================
        var closePanelBtn = document.getElementById('btnClosePanel');
        if (closePanelBtn) {
            closePanelBtn.addEventListener('click', function() { 
                togglePanel(false); 
            });
        }
        
        // ============================================================
        // BOTONES DE ELEVACIÓN
        // ============================================================
        ['btnElev0', 'btnElev2500', 'btnElev5000'].forEach(function(id) {
            var btn = document.getElementById(id);
            if (btn) {
                btn.addEventListener('click', function() {
                    var level = parseInt(this.getAttribute('data-level'), 10);
                    setElevation(level);
                });
            }
        });
    }
    
    // ================================================================
    // EXPOSICIÓN GLOBAL (UNA SOLA VEZ - SIN REDECLARAR)
    // ================================================================
    
    window.switchModule = switchModule;
    window.setElevation = setElevation;
    window.togglePanel = togglePanel;
    window.autoCenter = autoCenter;
    window.scheduleRender = scheduleRender;
    
    window.executeCommand = function(cmd) {
        if (typeof SmartFlowCommands !== 'undefined' && SmartFlowCommands.executeCommand) {
            return SmartFlowCommands.executeCommand(cmd);
        }
        return false;
    };
    
    // ================================================================
    // INICIALIZACIÓN PRINCIPAL
    // ================================================================
    
    function init() {
        window.currentProjectName = window.currentProjectName || 'Proyecto_SmartEngp';
        window.voiceEnabled = true;
        window.currentModule = 'pfd';
        window.currentViewMode = '2d';
        
        var ss = document.getElementById('splash-status');
        var msgs = ["Cargando...", "Core v6.0...", "PFD Engine...", "DTI Engine...", "Integrity...", "PFD Renderer...", "DTI Renderer...", "¡SmartEngp v3.4!"];
        var mi = 0;
        var iv = setInterval(function() { if (mi < msgs.length && ss) { ss.textContent = msgs[mi]; mi++; } }, 600);
        
        function bootstrap() {
            if (typeof SmartFlowCore === 'undefined' || typeof SmartFlowCommands === 'undefined') { 
                setTimeout(bootstrap, 100); 
                return; 
            }
            
            initModules();
            bindEvents();
            setupKeyboardShortcuts();
            setTool('select');
            setElevation(0);
            
            if (splashScreen) splashScreen.classList.add('splash-hidden');
            clearInterval(iv);
            setTimeout(function() { 
                if (welcomePanel) welcomePanel.classList.remove('welcome-hidden'); 
            }, 300);
            
            switchModule('pfd');
            setTimeout(function() { 
                if (typeof SmartFlowIntegrity !== 'undefined') SmartFlowIntegrity.quickSummary(); 
            }, 2500);
            
            console.log('🚀 SmartEngp v3.4 con Sistema Adaptativo cargado');
            console.log('📊 Módulo actual: ' + window.currentModule);
            console.log('💡 Presiona Ctrl+Shift+C para abrir el panel de comandos');
            console.log('💡 O haz clic en el botón 🤖 Cmd');
        }
        
        setTimeout(bootstrap, 4000);
        if (window.innerWidth < 768) togglePanel(false);
    }
    
    init();
})();
