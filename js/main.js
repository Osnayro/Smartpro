
// ============================================================
// SMARTFLOW MAIN v3.0 - Punto de Entrada Principal
// Archivo: js/main.js
// Novedades v3.0:
//   - Inicialización de PFD, DTI, Integrity, DB Export
//   - Comandos unificados para los 3 módulos
//   - Panel de comandos mejorado con ejemplos PFD/DTI/3D
//   - Atajos de teclado ampliados
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
    
    // -------------------- 2. ESTADO DE LA APLICACIÓN --------------------
    let toolMode = 'select';
    let voiceEnabled = true;
    let currentViewMode = '2d';
    
    let _is2DInitialized = false;
    let _is3DInitialized = false;
    let _ioInitialized = false;
    let _modulesInitialized = false;
    
    let draggingEquipment = false;
    let draggedEquipTag = null;
    let dragLastPos = { x: 0, y: 0 };
    
    // -------------------- 3. HISTORIAL DE COMANDOS --------------------
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
            indicator.textContent = _commandHistory.length > 0 
                ? '⏺ Historial: ' + _commandHistory.length + ' comandos (↑↓ para navegar)' 
                : '';
        }
    }
    
    function navigateHistory(direction) {
        if (!commandText || _isNavigatingHistory) return;
        _isNavigatingHistory = true;
        
        if (_historyIndex === _commandHistory.length) {
            _tempCommand = commandText.value;
        }
        
        if (direction === 'up' && _historyIndex > 0) {
            _historyIndex--;
            commandText.value = _commandHistory[_historyIndex];
        } else if (direction === 'down' && _historyIndex < _commandHistory.length - 1) {
            _historyIndex++;
            commandText.value = _commandHistory[_historyIndex];
        } else if (direction === 'down' && _historyIndex === _commandHistory.length - 1) {
            _historyIndex++;
            commandText.value = _tempCommand || '';
        }
        
        setTimeout(function() { _isNavigatingHistory = false; }, 50);
    }
    
    // -------------------- 4. FUNCIONES DE UI --------------------
    function notify(msg, isErr) {
        if (isErr === undefined) isErr = false;
        if (notificationEl) {
            notificationEl.textContent = msg;
            notificationEl.style.backgroundColor = isErr ? '#da3633' : '#238636';
            notificationEl.style.display = 'block';
        }
        if (statusMsgEl) statusMsgEl.textContent = msg;
        
        if (voiceEnabled && window.speechSynthesis) {
            window.speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(msg);
            u.lang = 'es-ES';
            setTimeout(function() { window.speechSynthesis.speak(u); }, 50);
        }
        
        setTimeout(function() { if (notificationEl) notificationEl.style.display = 'none'; }, 4000);
    }
    
    function voiceFn(msg) {
        if (voiceEnabled && window.speechSynthesis) {
            window.speechSynthesis.cancel();
            const u = new SpeechSynthesisUtterance(msg);
            u.lang = 'es-ES';
            window.speechSynthesis.speak(u);
        }
    }
    
    function scheduleRender() {
        if (currentViewMode === '2d' && window.SmartFlowRenderer) {
            window.SmartFlowRenderer.render();
        } else if (currentViewMode === '3d' && window.SmartFlowRender && window.SmartFlowRender.renderFrame) {
            window.SmartFlowRender.renderFrame();
        }
    }
    
    function autoCenter() {
        if (currentViewMode === '2d' && window.SmartFlowRenderer) {
            window.SmartFlowRenderer.autoCenter();
        } else if (currentViewMode === '3d' && window.ThreeJsEngine) {
            window.ThreeJsEngine.fitCameraToEquipments();
        }
    }
    
    function toggleFullscreen() {
        document.body.classList.add('fullscreen-mode');
        autoCenter();
    }
    
    function exitFullscreen() {
        document.body.classList.remove('fullscreen-mode');
        autoCenter();
    }
    
    function togglePanel(show) {
        if (sidePanel) {
            if (show) sidePanel.classList.remove('hidden');
            else sidePanel.classList.add('hidden');
        }
    }
    
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
            <div class="prop-group"><span class="prop-label">PUERTOS</span>
                ${info.puertos && info.puertos.length ? info.puertos.map(function(p) { return `
                    <div class="port-item"><span>${p.id}</span><span class="${p.status === 'open' ? 'port-open' : 'port-connected'}">${p.status === 'open' ? 'DISPONIBLE' : 'CONECTADO'}</span></div>
                `; }).join('') : '<p>Sin puertos</p>'}
            </div>
        `;
    }
    
    // -------------------- 5. INICIALIZACIÓN DE MÓDULOS --------------------
    function initModules() {
        // 1. Core (base de datos unificada)
        SmartFlowCore.init(notify, scheduleRender, updatePropertyPanel);
        console.log('✅ Core v6.0 inicializado');
        
        // 2. Módulo I/O
        if (typeof SmartFlowIO !== 'undefined' && !_ioInitialized) {
            SmartFlowIO.init(SmartFlowCore, notify);
            _ioInitialized = true;
            console.log('✅ SmartFlowIO inicializado');
        }
        
        // 3. Módulo DB Export
        if (typeof SmartFlowDBExport !== 'undefined') {
            SmartFlowDBExport.init(SmartFlowCore, typeof SmartFlowIO !== 'undefined' ? SmartFlowIO : null, notify);
            console.log('✅ SmartFlowDBExport inicializado');
        }
        
        // 4. Módulo PFD
        if (typeof SmartFlowPFD !== 'undefined') {
            SmartFlowPFD.init(
                SmartFlowCore, 
                typeof SmartFlowCatalog !== 'undefined' ? SmartFlowCatalog : null, 
                notify
            );
            console.log('✅ SmartFlowPFD inicializado');
        }
        
        // 5. Módulo DTI
        if (typeof SmartFlowDTI !== 'undefined') {
            SmartFlowDTI.init(
                SmartFlowCore, 
                typeof SmartFlowCatalog !== 'undefined' ? SmartFlowCatalog : null, 
                notify
            );
            console.log('✅ SmartFlowDTI inicializado');
        }
        
        // 6. Módulo Integrity
        if (typeof SmartFlowIntegrity !== 'undefined') {
            SmartFlowIntegrity.init(
                SmartFlowCore,
                typeof SmartFlowPFD !== 'undefined' ? SmartFlowPFD : null,
                typeof SmartFlowDTI !== 'undefined' ? SmartFlowDTI : null,
                notify
            );
            console.log('✅ SmartFlowIntegrity inicializado');
        }
        
        // 7. Renderer 2D o 3D
        const container3D = document.getElementById('viewer-3d');
        
        if (currentViewMode === '2d') {
            if (container3D) container3D.style.display = 'none';
            if (canvas) canvas.style.display = 'block';
            
            if (typeof SmartFlowRenderer !== 'undefined') {
                SmartFlowRenderer.init(canvas, SmartFlowCore, notify);
                _is2DInitialized = true;
            }
        } else {
            if (canvas) canvas.style.display = 'none';
            if (container3D) container3D.style.display = 'block';
            
            waitFor3DModules(function() {
                if (typeof ThreeJsEngine !== 'undefined' && container3D) {
                    ThreeJsEngine.init(container3D, SmartFlowCore);
                    _is3DInitialized = true;
                    if (typeof SmartFlowRender !== 'undefined') {
                        SmartFlowRender.init(SmartFlowCore, ThreeJsEngine);
                    }
                }
            });
        }
        
        // 8. Router y Commands
        if (typeof SmartFlowRouter !== 'undefined') {
            SmartFlowRouter.init(SmartFlowCore, SmartFlowCatalog, notify, scheduleRender);
        }
        
        SmartFlowCommands.init(SmartFlowCore, SmartFlowCatalog, SmartFlowRenderer, notify, scheduleRender, voiceFn);
        
        SmartFlowCore.setVoice(voiceEnabled);
        _modulesInitialized = true;
        
        updateViewModeButtons();
        notify('SmartEngp v3.0 listo | PFD + DTI + 3D', false);
    }
    
    function waitFor3DModules(callback) {
        var maxAttempts = 50;
        var attempts = 0;
        function check() {
            if (window.ThreeJsEngine && window.SmartFlowRender) {
                callback();
            } else if (attempts < maxAttempts) {
                attempts++;
                setTimeout(check, 200);
            } else {
                console.warn('⚠️ Módulos 3D no disponibles');
                callback();
            }
        }
        check();
    }
    
    function switchViewMode(mode) {
        if (currentViewMode === mode) return;
        
        var selected = SmartFlowCore.getSelected();
        currentViewMode = mode;
        
        var container3D = document.getElementById('viewer-3d');
        
        if (mode === '2d') {
            if (typeof ThreeJsEngine !== 'undefined' && _is3DInitialized && ThreeJsEngine.pauseLoop) {
                ThreeJsEngine.pauseLoop();
            }
            if (container3D) container3D.style.display = 'none';
            if (canvas) canvas.style.display = 'block';
            
            if (typeof SmartFlowRenderer !== 'undefined' && canvas) {
                if (!_is2DInitialized) {
                    SmartFlowRenderer.init(canvas, SmartFlowCore, notify);
                    _is2DInitialized = true;
                }
                SmartFlowRenderer.autoCenter();
            }
        } else {
            if (canvas) canvas.style.display = 'none';
            if (container3D) {
                container3D.style.display = 'block';
                container3D.style.width = '100%';
                container3D.style.height = '100%';
            }
            
            waitFor3DModules(function() {
                if (typeof ThreeJsEngine !== 'undefined' && container3D) {
                    if (!_is3DInitialized) {
                        ThreeJsEngine.init(container3D, SmartFlowCore);
                        _is3DInitialized = true;
                    } else if (ThreeJsEngine.resumeLoop) {
                        ThreeJsEngine.resumeLoop();
                    }
                    
                    if (typeof SmartFlowRender !== 'undefined') {
                        SmartFlowRender.init(SmartFlowCore, ThreeJsEngine);
                    }
                    
                    setTimeout(function() {
                        if (ThreeJsEngine && ThreeJsEngine.fitCameraToEquipments) {
                            ThreeJsEngine.fitCameraToEquipments();
                        }
                    }, 500);
                }
            });
        }
        
        updateViewModeButtons();
        
        if (selected) {
            setTimeout(function() { SmartFlowCore.setSelected(selected); }, 150);
        }
        
        scheduleRender();
        notify('✅ Modo ' + mode.toUpperCase() + ' activado', false);
    }
    
    function updateViewModeButtons() {
        var btn2D = document.getElementById('btn-mode-2d');
        var btn3D = document.getElementById('btn-mode-3d');
        if (btn2D) {
            btn2D.classList.toggle('active', currentViewMode === '2d');
        }
        if (btn3D) {
            btn3D.classList.toggle('active', currentViewMode === '3d');
        }
    }
    
    // -------------------- 6. GESTIÓN DE PROYECTOS --------------------
    function guardarProyecto() {
        if (typeof SmartFlowIO !== 'undefined') { SmartFlowIO.downloadJSON(); return; }
        const state = SmartFlowCore.exportProject();
        localStorage.setItem('smartengp_v3_project', state);
        notify("✅ Proyecto guardado.", false);
    }
    
    function cargarProyecto() {
        if (typeof SmartFlowIO !== 'undefined') { SmartFlowIO.uploadAndImportJSON(); return; }
        const data = localStorage.getItem('smartengp_v3_project');
        if (data) {
            try {
                SmartFlowCore.importState(JSON.parse(data));
                autoCenter();
                notify("✅ Proyecto cargado.", false);
            } catch (e) { notify("Error al cargar.", true); }
        } else { notify("No hay proyecto guardado.", true); }
    }
    
    function exportarProyectoArchivo() {
        if (typeof SmartFlowIO !== 'undefined') { SmartFlowIO.downloadJSON(); }
    }
    
    function importarProyectoArchivo() {
        if (typeof SmartFlowIO !== 'undefined') { SmartFlowIO.uploadAndImportJSON(); }
    }
    
    function nuevoProyecto() {
        if (confirm("¿Crear nuevo proyecto? Se perderán los cambios no guardados.")) {
            SmartFlowCore.nuevoProyecto();
            autoCenter();
        }
    }
    
    function iniciarNuevoProyecto() {
        const name = projectInput ? projectInput.value.trim() : '';
        if (name) window.currentProjectName = name;
        if (projectModal) projectModal.style.display = 'none';
        if (welcomePanel) welcomePanel.classList.add('welcome-hidden');
        SmartFlowCore.nuevoProyecto();
        if (statusMsgEl) statusMsgEl.textContent = 'Proyecto: ' + window.currentProjectName + ' | Listo';
        autoCenter();
    }
    
    function saltarNombreProyecto() {
        if (projectModal) projectModal.style.display = 'none';
        if (welcomePanel) welcomePanel.classList.add('welcome-hidden');
        if (statusMsgEl) statusMsgEl.textContent = 'Proyecto: ' + window.currentProjectName + ' | Listo';
    }
    
    // -------------------- 7. HERRAMIENTAS --------------------
    function setTool(mode) {
        toolMode = mode;
        ['select', 'moveEq', 'editPipe', 'addPoint'].forEach(function(id) {
            const btn = document.getElementById('tool' + id.charAt(0).toUpperCase() + id.slice(1));
            if (btn) btn.classList.toggle('active', mode === id);
        });
    }
    
    window.setElevation = function(level) {
        SmartFlowCore.setElevation(level);
        if (currentViewMode === '2d' && window.SmartFlowRenderer) {
            window.SmartFlowRenderer.setElevation(level);
        }
        if (customElev) customElev.value = level;
    };
    
    function toggleVoice() {
        voiceEnabled = !voiceEnabled;
        SmartFlowCore.setVoice(voiceEnabled);
        const btnVoice = document.getElementById('btnVoice');
        if (btnVoice) btnVoice.textContent = voiceEnabled ? '🔊 Voz ON' : '🔇 Voz OFF';
    }
    
    // -------------------- 8. ATAJOS DE TECLADO --------------------
    function setupKeyboardShortcuts() {
        document.addEventListener('keydown', function(e) {
            if (e.ctrlKey && e.shiftKey) {
                switch(e.key.toUpperCase()) {
                    case 'C': e.preventDefault(); abrirPanelComandos(); break;
                    case 'V': e.preventDefault(); autoCenter(); break;
                    case 'U': e.preventDefault(); SmartFlowCore.undo(); scheduleRender(); break;
                    case 'Y': e.preventDefault(); SmartFlowCore.redo(); scheduleRender(); break;
                    case 'S': e.preventDefault(); guardarProyecto(); break;
                    case 'E': e.preventDefault();
                        if (typeof SmartFlowIO !== 'undefined') SmartFlowIO.downloadPCF();
                        break;
                    case 'M': e.preventDefault();
                        if (typeof SmartFlowIO !== 'undefined') SmartFlowIO.downloadMTO();
                        break;
                    case 'D': e.preventDefault();
                        if (typeof SmartFlowDBExport !== 'undefined') SmartFlowDBExport.exportDatabase();
                        break;
                    case 'A': e.preventDefault();
                        if (typeof SmartFlowIntegrity !== 'undefined') SmartFlowIntegrity.validateAll();
                        break;
                }
            }
        });
    }
    
    // -------------------- 9. COMANDOS --------------------
    function abrirPanelComandos() {
        if (commandPanel) {
            commandPanel.style.display = 'block';
            if (commandText) commandText.focus();
        }
    }
    
    function ejecutarComando() {
        if (!commandText) return;
        const textoCompleto = commandText.value.trim();
        if (!textoCompleto) return;
        
        const lineas = textoCompleto.split('\n').filter(function(l) { return l.trim(); });
        
        let success = true;
        if (lineas.length === 1) {
            success = SmartFlowCommands.executeCommand(lineas[0]) !== false;
        } else {
            success = SmartFlowCommands.executeBatch(lineas.join('\n')) > 0;
        }
        
        if (success) addToHistory(textoCompleto);
        
        commandText.value = '';
        _historyIndex = _commandHistory.length;
        _tempCommand = '';
        
        // Ocultar panel para comandos de acción
        const primeraLinea = lineas[0].toLowerCase();
        const keepOpen = ['info', 'list', 'help', 'ayuda', 'validate', 'validar', 'summary', 'resumen'];
        if (!keepOpen.some(function(k) { return primeraLinea.startsWith(k); })) {
            if (commandPanel) commandPanel.style.display = 'none';
        }
    }
    
    // -------------------- 10. CABLEADO DE BOTONES --------------------
    function bindEvents() {
        const vincular = function(id, accion) {
            const el = document.getElementById(id);
            if (el) el.onclick = accion;
        };
        
        // Welcome
        vincular('welcome-new-project', function() { if (projectModal) projectModal.style.display = 'flex'; });
        vincular('welcome-open-project', function() { cargarProyecto(); if (welcomePanel) welcomePanel.classList.add('welcome-hidden'); });
        vincular('modal-accept', iniciarNuevoProyecto);
        vincular('modal-skip', saltarNombreProyecto);
        
        // Archivo
        vincular('btnOpen', cargarProyecto);
        vincular('btnSave', guardarProyecto);
        vincular('btnExportProject', exportarProyectoArchivo);
        vincular('btnImportProject', importarProyectoArchivo);
        
        // Vista
        vincular('btnReset', autoCenter);
        vincular('btnFullscreen', toggleFullscreen);
        vincular('btnFullscreenCenter', autoCenter);
        vincular('btnFullscreenExit', exitFullscreen);
        vincular('btnTogglePanels', toggleAllPanels);
        vincular('btn-mode-2d', function() { switchViewMode('2d'); });
        vincular('btn-mode-3d', function() { switchViewMode('3d'); });
        
        // Comandos
        vincular('btnCommand', abrirPanelComandos);
        vincular('closeCommand', function() { if (commandPanel) commandPanel.style.display = 'none'; });
        vincular('clearCommand', function() { if (commandText) { commandText.value = ''; _historyIndex = _commandHistory.length; _tempCommand = ''; } });
        vincular('runCommands', ejecutarComando);
        
        // I/O
        vincular('btnExportPCF', function() { if (typeof SmartFlowIO !== 'undefined') SmartFlowIO.downloadPCF(); });
        vincular('btnImportPCF', function() { if (typeof SmartFlowIO !== 'undefined') SmartFlowIO.uploadAndImportPCF(); });
        vincular('btnExportDB', function() { if (typeof SmartFlowDBExport !== 'undefined') SmartFlowDBExport.exportDatabase(); });
        vincular('btnMTO', function() { if (typeof SmartFlowIO !== 'undefined') SmartFlowIO.downloadMTO(); });
        
        // Herramientas
        vincular('toolSelect', function() { setTool('select'); });
        vincular('toolMoveEq', function() { setTool('moveEq'); });
        vincular('toolEditPipe', function() { setTool('editPipe'); });
        vincular('toolAddPoint', function() { setTool('addPoint'); });
        
        // Validación
        vincular('btnValidate', function() { if (typeof SmartFlowIntegrity !== 'undefined') SmartFlowIntegrity.validateAll(); });
        vincular('btnSummary', function() { if (typeof SmartFlowIntegrity !== 'undefined') SmartFlowIntegrity.quickSummary(); });
        
        // Undo/Redo
        vincular('btnUndo', function() { SmartFlowCore.undo(); scheduleRender(); });
        vincular('btnRedo', function() { SmartFlowCore.redo(); scheduleRender(); });
        vincular('btnVoice', toggleVoice);
        vincular('btnRecalc', function() { SmartFlowCore.syncPhysicalData(); scheduleRender(); });
        
        // Elevación
        vincular('btnSetElev', function() {
            const val = parseInt(customElev ? customElev.value : 0);
            if (!isNaN(val)) window.setElevation(val);
        });
        
        // Tecla Enter en commandText
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
        
        // Redimensionar
        let resizeTimeout;
        window.addEventListener('resize', function() {
            if (currentViewMode === '2d' && window.SmartFlowRenderer) {
                window.SmartFlowRenderer.resizeCanvas();
            } else if (currentViewMode === '3d' && window.ThreeJsEngine) {
                window.ThreeJsEngine.onResize();
            }
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(autoCenter, 150);
        });
    }
    
    function toggleAllPanels() {
        const panels = [sidePanel, document.getElementById('toolsPanel')];
        const visible = sidePanel && sidePanel.style.display !== 'none';
        panels.forEach(function(p) { if (p) p.style.display = visible ? 'none' : ''; });
    }
    
    // -------------------- 11. ARRANQUE --------------------
    function init() {
        window.currentProjectName = window.currentProjectName || 'Proyecto_SmartEngp';
        window.voiceEnabled = true;
        
        const splashStatus = document.getElementById('splash-status');
        const messages = [
            "Cargando librerías...",
            "Inicializando Core v6.0...",
            "Cargando PFD Engine...",
            "Cargando DTI Engine...",
            "Cargando Integrity Engine...",
            "¡SmartEngp v3.0 Activo!"
        ];
        let msgIndex = 0;
        const interval = setInterval(function() {
            if (msgIndex < messages.length && splashStatus) {
                splashStatus.textContent = messages[msgIndex];
                msgIndex++;
            }
        }, 700);
        
        function bootstrapWhenReady() {
            if (typeof SmartFlowCore === 'undefined' || typeof SmartFlowCommands === 'undefined') {
                setTimeout(bootstrapWhenReady, 100);
                return;
            }
            
            initModules();
            bindEvents();
            setupKeyboardShortcuts();
            setTool('select');
            window.setElevation(0);
            
            if (splashScreen) splashScreen.classList.add('splash-hidden');
            clearInterval(interval);
            
            setTimeout(function() {
                if (welcomePanel) welcomePanel.classList.remove('welcome-hidden');
            }, 300);
            
            // Auto-validar al iniciar
            setTimeout(function() {
                if (typeof SmartFlowIntegrity !== 'undefined') {
                    SmartFlowIntegrity.quickSummary();
                }
            }, 2000);
        }
        
        setTimeout(bootstrapWhenReady, 3500);
        
        if (window.innerWidth < 768) togglePanel(false);
        
        setTimeout(function() {
            if (currentViewMode === '2d' && window.SmartFlowRenderer) {
                window.SmartFlowRenderer.resizeCanvas();
            }
            autoCenter();
        }, 200);
    }
    
    init();
})();
