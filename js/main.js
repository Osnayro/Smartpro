// ============================================================
// SMARTFLOW MAIN v3.1 - Punto de Entrada Principal
// Archivo: js/main.js
// Módulos: PFD + DTI + ISO 3D + Integrity + I/O + DB Export
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
        
        setTimeout(function() { if (notificationEl) notificationEl.style.display = 'none'; }, 5000);
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
        var module = window.currentModule || 'pfd';
        
        if (module === 'pfd' && typeof SmartFlowPFDRenderer !== 'undefined') {
            SmartFlowPFDRenderer.render();
        } else if (module === 'dti' && typeof SmartFlowDTIRenderer !== 'undefined') {
            SmartFlowDTIRenderer.render();
        } else if (module === 'iso' && window.currentViewMode === '2d' && window.SmartFlowRenderer) {
            window.SmartFlowRenderer.render();
        } else if (module === 'iso' && window.currentViewMode === '3d' && window.SmartFlowRender && window.SmartFlowRender.renderFrame) {
            window.SmartFlowRender.renderFrame();
        }
    }
    
    function autoCenter() {
        var module = window.currentModule || 'pfd';
        
        if (module === 'pfd' && typeof SmartFlowPFDRenderer !== 'undefined') {
            SmartFlowPFDRenderer.render();
        } else if (module === 'dti' && typeof SmartFlowDTIRenderer !== 'undefined') {
            SmartFlowDTIRenderer.render();
        } else if (module === 'iso' && window.currentViewMode === '2d' && window.SmartFlowRenderer) {
            window.SmartFlowRenderer.autoCenter();
        } else if (module === 'iso' && window.currentViewMode === '3d' && window.ThreeJsEngine) {
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
    
    function toggleAllPanels() {
        const panels = [sidePanel, document.getElementById('toolsPanel')];
        const visible = sidePanel && sidePanel.style.display !== 'none';
        panels.forEach(function(p) { if (p) p.style.display = visible ? 'none' : ''; });
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
        // 1. Core
        SmartFlowCore.init(notify, scheduleRender, updatePropertyPanel);
        console.log('✅ Core v6.0 inicializado');
        
        // 2. I/O
        if (typeof SmartFlowIO !== 'undefined' && !_ioInitialized) {
            SmartFlowIO.init(SmartFlowCore, notify);
            _ioInitialized = true;
            console.log('✅ SmartFlowIO inicializado');
        }
        
        // 3. DB Export
        if (typeof SmartFlowDBExport !== 'undefined') {
            SmartFlowDBExport.init(SmartFlowCore, typeof SmartFlowIO !== 'undefined' ? SmartFlowIO : null, notify);
            console.log('✅ SmartFlowDBExport inicializado');
        }
        
        // 4. PFD Engine
        if (typeof SmartFlowPFD !== 'undefined') {
            SmartFlowPFD.init(
                SmartFlowCore, 
                typeof SmartFlowCatalog !== 'undefined' ? SmartFlowCatalog : null, 
                notify
            );
            console.log('✅ SmartFlowPFD inicializado');
        }
        
        // 5. DTI Engine
        if (typeof SmartFlowDTI !== 'undefined') {
            SmartFlowDTI.init(
                SmartFlowCore, 
                typeof SmartFlowCatalog !== 'undefined' ? SmartFlowCatalog : null, 
                notify
            );
            console.log('✅ SmartFlowDTI inicializado');
        }
        
        // 6. Integrity
        if (typeof SmartFlowIntegrity !== 'undefined') {
            SmartFlowIntegrity.init(
                SmartFlowCore,
                typeof SmartFlowPFD !== 'undefined' ? SmartFlowPFD : null,
                typeof SmartFlowDTI !== 'undefined' ? SmartFlowDTI : null,
                notify
            );
            console.log('✅ SmartFlowIntegrity inicializado');
        }
        
        // 7. PFD Renderer
        if (typeof SmartFlowPFDRenderer !== 'undefined') {
            var pfdCanvas = document.getElementById('pfd-canvas');
            if (pfdCanvas) {
                SmartFlowPFDRenderer.init(pfdCanvas, SmartFlowCore, notify);
                console.log('✅ SmartFlowPFDRenderer inicializado');
            }
        }
        
        // 8. DTI Renderer
        if (typeof SmartFlowDTIRenderer !== 'undefined') {
            var dtiCanvas = document.getElementById('dti-canvas');
            if (dtiCanvas) {
                SmartFlowDTIRenderer.init(dtiCanvas, SmartFlowCore, notify);
                console.log('✅ SmartFlowDTIRenderer inicializado');
            }
        }
        
        // 9. Renderer 2D (ISO)
        if (typeof SmartFlowRenderer !== 'undefined' && canvas) {
            SmartFlowRenderer.init(canvas, SmartFlowCore, notify);
            _is2DInitialized = true;
            console.log('✅ SmartFlowRenderer inicializado');
        }
        
        // 10. Router y Commands
        if (typeof SmartFlowRouter !== 'undefined') {
            SmartFlowRouter.init(SmartFlowCore, SmartFlowCatalog, notify, scheduleRender);
        }
        
        SmartFlowCommands.init(SmartFlowCore, SmartFlowCatalog, SmartFlowRenderer, notify, scheduleRender, voiceFn);
        
        SmartFlowCore.setVoice(voiceEnabled);
        _modulesInitialized = true;
        
        notify('SmartEngp v3.1 listo | PFD + DTI + ISO', false);
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
        var toolIds = { select: 'toolSelect', moveEq: 'toolMoveEq', editPipe: 'toolEditPipe', addPoint: 'toolAddPoint' };
        Object.keys(toolIds).forEach(function(key) {
            var btn = document.getElementById(toolIds[key]);
            if (btn) btn.classList.toggle('active', mode === key);
        });
    }
    
    window.setElevation = function(level) {
        SmartFlowCore.setElevation(level);
        if (window.currentModule === 'iso' && window.currentViewMode === '2d' && window.SmartFlowRenderer) {
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
                    case '1': e.preventDefault();
                        if (typeof switchModule === 'function') switchModule('pfd');
                        break;
                    case '2': e.preventDefault();
                        if (typeof switchModule === 'function') switchModule('dti');
                        break;
                    case '3': e.preventDefault();
                        if (typeof switchModule === 'function') switchModule('iso');
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
        
        const primeraLinea = lineas[0].toLowerCase();
        const keepOpen = ['info', 'list', 'help', 'ayuda', 'validate', 'validar', 'summary', 'resumen', 'balance'];
        if (!keepOpen.some(function(k) { return primeraLinea.startsWith(k); })) {
            if (commandPanel) commandPanel.style.display = 'none';
        }
        
        scheduleRender();
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
        vincular('btnExportDB', function() { if (typeof SmartFlowDBExport !== 'undefined') SmartFlowDBExport.exportDatabase(); });
        vincular('btnExportPCF', function() { if (typeof SmartFlowIO !== 'undefined') SmartFlowIO.downloadPCF(); });
        vincular('btnImportPCF', function() { if (typeof SmartFlowIO !== 'undefined') SmartFlowIO.uploadAndImportPCF(); });
        vincular('btnMTO', function() { if (typeof SmartFlowIO !== 'undefined') SmartFlowIO.downloadMTO(); });
        
        // Módulos
        vincular('btn-mode-pfd', function() { if (typeof switchModule === 'function') switchModule('pfd'); });
        vincular('btn-mode-dti', function() { if (typeof switchModule === 'function') switchModule('dti'); });
        vincular('btn-mode-iso', function() { if (typeof switchModule === 'function') switchModule('iso'); });
        
        // Validación
        vincular('btnValidate', function() { if (typeof SmartFlowIntegrity !== 'undefined') SmartFlowIntegrity.validateAll(); });
        vincular('btnSummary', function() { if (typeof SmartFlowIntegrity !== 'undefined') SmartFlowIntegrity.quickSummary(); });
        
        // Vista
        vincular('btnReset', autoCenter);
        vincular('btnFullscreen', toggleFullscreen);
        vincular('btnFullscreenCenter', autoCenter);
        vincular('btnFullscreenExit', exitFullscreen);
        vincular('btnTogglePanels', toggleAllPanels);
        
        // Comandos
        vincular('btnCommand', abrirPanelComandos);
        vincular('closeCommand', function() { if (commandPanel) commandPanel.style.display = 'none'; });
        vincular('clearCommand', function() { if (commandText) { commandText.value = ''; _historyIndex = _commandHistory.length; _tempCommand = ''; } });
        vincular('runCommands', ejecutarComando);
        
        // Herramientas
        vincular('toolSelect', function() { setTool('select'); });
        vincular('toolMoveEq', function() { setTool('moveEq'); });
        vincular('toolEditPipe', function() { setTool('editPipe'); });
        vincular('toolAddPoint', function() { setTool('addPoint'); });
        
        // Más
        vincular('btnUndo', function() { SmartFlowCore.undo(); scheduleRender(); });
        vincular('btnRedo', function() { SmartFlowCore.redo(); scheduleRender(); });
        vincular('btnVoice', toggleVoice);
        vincular('btnRecalc', function() { SmartFlowCore.syncPhysicalData(); scheduleRender(); });
        vincular('btnSpeakSummary', function() { if (typeof SmartFlowIntegrity !== 'undefined') SmartFlowIntegrity.quickSummary(); });
        vincular('btnSetElev', function() {
            const val = parseInt(customElev ? customElev.value : 0);
            if (!isNaN(val)) window.setElevation(val);
        });
        vincular('btnApplyNorm', function() { notify("Función de normas en desarrollo.", false); });
        
        // Dropdowns
        function setupDropdown(buttonId) {
            const btn = document.getElementById(buttonId);
            if (!btn) return;
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                const parent = this.closest('.dropdown');
                if (parent) parent.classList.toggle('open');
            });
        }
        setupDropdown('btnFileMenu');
        setupDropdown('btnMoreMenu');
        
        document.addEventListener('click', function(e) {
            if (!e.target.closest('.dropdown')) {
                document.querySelectorAll('.dropdown.open').forEach(function(d) { d.classList.remove('open'); });
            }
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
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(function() {
                var module = window.currentModule || 'pfd';
                if (module === 'pfd' && typeof SmartFlowPFDRenderer !== 'undefined') {
                    SmartFlowPFDRenderer.resizeCanvas();
                    SmartFlowPFDRenderer.render();
                } else if (module === 'dti' && typeof SmartFlowDTIRenderer !== 'undefined') {
                    SmartFlowDTIRenderer.resizeCanvas();
                    SmartFlowDTIRenderer.render();
                } else if (module === 'iso' && typeof SmartFlowRenderer !== 'undefined') {
                    SmartFlowRenderer.resizeCanvas();
                }
            }, 150);
        });
    }
    
    // -------------------- 11. ARRANQUE --------------------
    function init() {
        window.currentProjectName = window.currentProjectName || 'Proyecto_SmartEngp';
        window.voiceEnabled = true;
        window.currentModule = 'pfd';
        window.currentViewMode = '2d';
        
        // Exponer switchModule globalmente
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
            
            document.querySelectorAll('.module-tab').forEach(function(tab) {
                tab.classList.remove('active');
            });
            
            var btnPFD = document.getElementById('btn-mode-pfd');
            var btnDTI = document.getElementById('btn-mode-dti');
            var btnISO = document.getElementById('btn-mode-iso');
            if (btnPFD) btnPFD.classList.remove('active');
            if (btnDTI) btnDTI.classList.remove('active');
            if (btnISO) btnISO.classList.remove('active');
            
            if (module === 'pfd') {
                if (pfdCanvas) pfdCanvas.style.display = 'block';
                document.querySelector('.pfd-tab').classList.add('active');
                if (btnPFD) btnPFD.classList.add('active');
                if (typeof SmartFlowPFDRenderer !== 'undefined') {
                    SmartFlowPFDRenderer.resizeCanvas();
                    setTimeout(function() { SmartFlowPFDRenderer.render(); }, 50);
                }
            } else if (module === 'dti') {
                if (dtiCanvas) dtiCanvas.style.display = 'block';
                document.querySelector('.dti-tab').classList.add('active');
                if (btnDTI) btnDTI.classList.add('active');
                if (typeof SmartFlowDTIRenderer !== 'undefined') {
                    SmartFlowDTIRenderer.resizeCanvas();
                    setTimeout(function() { SmartFlowDTIRenderer.render(); }, 50);
                }
            } else if (module === 'iso') {
                if (isoCanvas) isoCanvas.style.display = 'block';
                document.querySelector('.iso-tab').classList.add('active');
                if (btnISO) btnISO.classList.add('active');
                if (typeof SmartFlowRenderer !== 'undefined') {
                    SmartFlowRenderer.resizeCanvas();
                    setTimeout(function() { SmartFlowRenderer.autoCenter(); }, 100);
                }
            }
        };
        
        const splashStatus = document.getElementById('splash-status');
        const messages = [
            "Cargando librerías...",
            "Inicializando Core v6.0...",
            "Cargando PFD Engine...",
            "Cargando DTI Engine...",
            "Cargando Integrity Engine...",
            "Cargando PFD Renderer...",
            "Cargando DTI Renderer...",
            "¡SmartEngp v3.1 Activo!"
        ];
        let msgIndex = 0;
        const interval = setInterval(function() {
            if (msgIndex < messages.length && splashStatus) {
                splashStatus.textContent = messages[msgIndex];
                msgIndex++;
            }
        }, 600);
        
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
            
            // Iniciar en PFD
            if (typeof window.switchModule === 'function') {
                window.switchModule('pfd');
            }
            
            // Auto-resumen al iniciar
            setTimeout(function() {
                if (typeof SmartFlowIntegrity !== 'undefined') {
                    SmartFlowIntegrity.quickSummary();
                }
            }, 2500);
        }
        
        setTimeout(bootstrapWhenReady, 4000);
        
        if (window.innerWidth < 768) togglePanel(false);
    }
    
    init();
})();
