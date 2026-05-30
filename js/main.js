
// ============================================================
// SMARTFLOW MAIN v3.6 - Punto de Entrada Principal (3D)
// Archivo: js/main.js
// CORREGIDO: Voz con window.speechSynthesis directo (sin VoiceService)
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
    let currentViewMode = '3d';
    
    let _is3DInitialized = false;
    
    let draggingEquipment = false;
    let draggedEquipTag = null;
    let dragLastPos = { x: 0, y: 0 };
    
    // -------------------- 3. FUNCIONES DE UI --------------------
    function notify(msg, isErr) {
        if (isErr === undefined) isErr = false;
        
        // Notificación visual
        if (notificationEl) {
            notificationEl.textContent = msg;
            notificationEl.style.backgroundColor = isErr ? '#da3633' : '#238636';
            notificationEl.style.display = 'block';
        }
        
        // Status bar
        if (statusMsgEl) {
            statusMsgEl.innerText = msg;
            statusMsgEl.style.color = isErr ? '#ef4444' : '#00f2ff';
        }
        
        // ✅ VOZ DIRECTA con window.speechSynthesis (funciona en 2D y 3D)
        if (voiceEnabled && window.speechSynthesis) {
            try {
                window.speechSynthesis.cancel();
                const utterance = new SpeechSynthesisUtterance(msg);
                utterance.lang = 'es-ES';
                utterance.rate = 0.9;
                setTimeout(() => window.speechSynthesis.speak(utterance), 50);
            } catch(e) {
                console.warn('Error en síntesis de voz:', e);
            }
        }
        
        // Ocultar notificación después de 4 segundos
        setTimeout(function() { 
            if (notificationEl) notificationEl.style.display = 'none'; 
        }, 4000);
    }
    
    // ✅ Función de voz directa (para commands.js)
    function voiceFn(msg) {
        if (voiceEnabled && window.speechSynthesis) {
            try {
                window.speechSynthesis.cancel();
                const utterance = new SpeechSynthesisUtterance(msg);
                utterance.lang = 'es-ES';
                utterance.rate = 0.9;
                window.speechSynthesis.speak(utterance);
                console.log('🔊 Voz:', msg.substring(0, 50));
            } catch(e) {
                console.warn('Error en voz:', e);
            }
        }
    }
    
    function scheduleRender() {
        if (window.ThreeJsEngine && window.ThreeJsEngine.renderFrame) {
            window.ThreeJsEngine.renderFrame();
        } else if (window.SmartFlowRender && window.SmartFlowRender.renderFrame) {
            window.SmartFlowRender.renderFrame();
        }
    }
    
    function autoCenter() {
        if (window.ThreeJsEngine && typeof window.ThreeJsEngine.fitCameraToEquipments === 'function') {
            window.ThreeJsEngine.fitCameraToEquipments();
            notify("✅ Vista 3D centrada.", false);
        }
    }
    
    function toggleFullscreen() {
        document.body.classList.add('fullscreen-mode');
        if (window.ThreeJsEngine) {
            window.ThreeJsEngine.onResize();
            setTimeout(function() {
                if (window.ThreeJsEngine && window.ThreeJsEngine.fitCameraToEquipments) {
                    window.ThreeJsEngine.fitCameraToEquipments();
                }
            }, 100);
        }
    }
    
    function exitFullscreen() {
        document.body.classList.remove('fullscreen-mode');
        if (window.ThreeJsEngine) {
            window.ThreeJsEngine.onResize();
            setTimeout(function() {
                if (window.ThreeJsEngine && window.ThreeJsEngine.fitCameraToEquipments) {
                    window.ThreeJsEngine.fitCameraToEquipments();
                }
            }, 100);
        }
    }
    
    function togglePanel(show) {
        if (sidePanel) {
            if (show) sidePanel.classList.remove('hidden');
            else sidePanel.classList.add('hidden');
        }
    }
    
    let _allPanelsVisible = true;
    function toggleAllPanels() {
        _allPanelsVisible = !_allPanelsVisible;
        if (sidePanel) sidePanel.style.display = _allPanelsVisible ? '' : 'none';
        const toolsPanel = document.getElementById('toolsPanel');
        if (toolsPanel) toolsPanel.style.display = _allPanelsVisible ? '' : 'none';
        if (commandPanel && commandPanel.style.display === 'block') {
            commandPanel.style.display = _allPanelsVisible ? 'block' : 'none';
        }
        const btn = document.getElementById('btnTogglePanels');
        if (btn) {
            btn.textContent = _allPanelsVisible ? '👁️' : '👁️‍🗨️';
            if (!_allPanelsVisible) btn.classList.add('active');
            else btn.classList.remove('active');
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
                    <div class="port-item"><span>${p.id}</span><span class="${p.status === 'open' ? 'port-open' : 'port-connected'}">${p.status === 'open' ? 'DISPONIBLE' : 'CONECTADO a ' + (p.connectedTo || '')}</span></div>
                `; }).join('') : '<p>Sin puertos</p>'}
            </div>
        `;
    }
    
    // -------------------- 4. INICIALIZACIÓN DE MÓDULOS --------------------
    function waitFor3DModules(callback) {
        var maxAttempts = 50;
        var attempts = 0;
        function check() {
            if (window.ThreeJsEngine && window.ThreeJsEngine.isReady && window.ThreeJsEngine.isReady()) {
                console.log('✅ Módulos 3D listos');
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
    
    function initModules() {
        console.log('🚀 Inicializando SmartFlow v3.6 (3D)...');
        
        // 1. Core
        if (typeof SmartFlowCore !== 'undefined') {
            SmartFlowCore.init(notify, scheduleRender, updatePropertyPanel);
            console.log('✅ Core inicializado');
        }
        
        const container3D = document.getElementById('viewer-3d');
        
        // 2. Modo 3D
        if (canvas) canvas.style.display = 'none';
        if (container3D) {
            container3D.style.display = 'block';
            container3D.style.width = '100%';
            container3D.style.height = '100%';
        }
        
        waitFor3DModules(function() {
            if (typeof ThreeJsEngine !== 'undefined' && container3D) {
                ThreeJsEngine.init(container3D, SmartFlowCore);
                _is3DInitialized = true;
                console.log('✅ ThreeJsEngine inicializado');
                
                if (typeof SmartFlowRender !== 'undefined') {
                    SmartFlowRender.init(SmartFlowCore, ThreeJsEngine);
                    console.log('✅ SmartFlowRender inicializado');
                }
                
                // Configurar selección
                if (typeof ThreeJsEngine.onSelection === 'function') {
                    ThreeJsEngine.onSelection(function(selectionData) {
                        if (selectionData && selectionData.obj) {
                            updatePropertyPanel(SmartFlowCore.getPropertyInfo(selectionData.obj.tag));
                        } else {
                            updatePropertyPanel(null);
                        }
                    });
                }
                
                setTimeout(function() {
                    if (ThreeJsEngine && ThreeJsEngine.fitCameraToEquipments) {
                        ThreeJsEngine.fitCameraToEquipments();
                    }
                }, 500);
            }
        });
        
        // 3. Router
        if (typeof SmartFlowRouter !== 'undefined') {
            SmartFlowRouter.init(SmartFlowCore, SmartFlowCatalog, notify, scheduleRender);
            console.log('✅ Router inicializado');
        }
        
        // 4. Comandos (con voiceFn directo)
        if (typeof SmartFlowCommands !== 'undefined') {
            SmartFlowCommands.init(
                SmartFlowCore, 
                SmartFlowCatalog, 
                window.ThreeJsEngine || window.SmartFlowRender, 
                notify, 
                scheduleRender, 
                voiceFn
            );
            console.log('✅ Comandos inicializado');
        }
        
        // 5. Configurar voz
        if (typeof SmartFlowCore !== 'undefined') {
            SmartFlowCore.setVoice(voiceEnabled);
        }
        
        notify('SmartFlow v3.6 listo (3D)', false);
        console.log('🎯 SmartFlow v3.6 iniciado correctamente');
    }
    
    function updateViewModeButtons() {
        var btn2D = document.getElementById('btn-mode-2d');
        var btn3D = document.getElementById('btn-mode-3d');
        if (btn2D) {
            btn2D.classList.remove('active');
            btn2D.style.opacity = '0.5';
            btn2D.title = 'Modo 2D no disponible';
        }
        if (btn3D) {
            btn3D.classList.add('active');
        }
    }
    
    // -------------------- 5. GESTIÓN DE PROYECTOS --------------------
    function guardarProyecto() {
        if (typeof SmartFlowCore === 'undefined') return;
        const state = SmartFlowCore.exportProject();
        localStorage.setItem('smartflow_v3_project', state);
        notify("✅ Proyecto guardado.", false);
    }
    
    function cargarProyecto() {
        if (typeof SmartFlowCore === 'undefined') return;
        const data = localStorage.getItem('smartflow_v3_project');
        if (data) {
            try {
                const state = JSON.parse(data);
                SmartFlowCore.importState(state.data || state);
                autoCenter();
                notify("✅ Proyecto cargado.", false);
            } catch (e) {
                notify("Error al cargar.", true);
            }
        } else {
            notify("No hay proyecto guardado.", true);
        }
    }
    
    function exportarProyectoArchivo() {
        if (typeof SmartFlowCore === 'undefined') return;
        const state = SmartFlowCore.exportProject();
        const blob = new Blob([state], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = (window.currentProjectName || 'Proyecto') + '_SmartFlow.json';
        a.click();
        notify("✅ Proyecto exportado.", false);
    }
    
    function importarProyectoArchivo() {
        if (typeof SmartFlowCore === 'undefined') return;
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = function(e) {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = function(ev) {
                try {
                    const state = JSON.parse(ev.target.result);
                    SmartFlowCore.importState(state.data || state);
                    autoCenter();
                    notify("✅ Proyecto importado.", false);
                } catch (err) {
                    notify("Error al importar.", true);
                }
            };
            reader.readAsText(file);
        };
        input.click();
    }
    
    function iniciarNuevoProyecto() {
        const name = projectInput ? projectInput.value.trim() : '';
        if (name) window.currentProjectName = name;
        if (projectModal) projectModal.style.display = 'none';
        if (welcomePanel) welcomePanel.classList.add('welcome-hidden');
        if (typeof SmartFlowCore !== 'undefined') SmartFlowCore.nuevoProyecto();
        if (statusMsgEl) statusMsgEl.textContent = 'Proyecto: ' + window.currentProjectName + ' | Listo';
        autoCenter();
    }
    
    function saltarNombreProyecto() {
        if (projectModal) projectModal.style.display = 'none';
        if (welcomePanel) welcomePanel.classList.add('welcome-hidden');
        if (statusMsgEl) statusMsgEl.textContent = 'Proyecto: ' + window.currentProjectName + ' | Listo';
    }
    
    // -------------------- 6. MTO Y RESUMEN --------------------
    function exportarMTO() {
        if (typeof SmartFlowExporter !== 'undefined') {
            SmartFlowExporter.exportMTO();
            return;
        }
        if (typeof SmartFlowCore === 'undefined') return;
        
        const equipos = SmartFlowCore.getEquipos();
        const lines = SmartFlowCore.getLines();
        let items = [];
        equipos.forEach(function(eq) { if (eq.tipo !== 'colector') items.push([eq.tag, eq.tipo, "Und", 1]); });
        lines.forEach(function(line) {
            let length = 0;
            const pts = SmartFlowCore.getLinePoints(line);
            if (pts) for (let i = 0; i < pts.length - 1; i++) length += Math.hypot(pts[i+1].x - pts[i].x, pts[i+1].y - pts[i].y, pts[i+1].z - pts[i].z);
            items.push([line.tag, 'Tubería ' + (line.material || 'PPR') + ' ' + line.diameter + '"', "m", (length / 1000).toFixed(2)]);
            if (line.components) {
                line.components.forEach(function(comp) {
                    items.push([comp.tag || 'ACC-' + line.tag, comp.type, "Und", 1]);
                });
            }
        });
        if (items.length === 0) { notify("No hay elementos.", true); return; }
        
        if (typeof XLSX === 'undefined') {
            notify("Librería XLSX no disponible.", true);
            return;
        }
        const ws = XLSX.utils.aoa_to_sheet([["Tag", "Descripción", "Unidad", "Cantidad"], ...items]);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "MTO");
        XLSX.writeFile(wb, 'MTO_' + Date.now() + '.xlsx');
        notify("✅ MTO exportado.", false);
    }
    
    function resumenProyecto() {
        if (typeof SmartFlowCore === 'undefined') return;
        const equipos = SmartFlowCore.getEquipos();
        const lines = SmartFlowCore.getLines();
        const tanques = equipos.filter(function(e) { return e.tipo === 'tanque_v' || e.tipo === 'tanque_h'; });
        const bombas = equipos.filter(function(e) { return e.tipo && e.tipo.includes('bomba'); });
        let totalCodos = 0, totalTees = 0, totalReducciones = 0, totalValvulas = 0;
        lines.forEach(function(l) {
            if (l.components) {
                l.components.forEach(function(c) {
                    const type = c.type || '';
                    if (type.includes('ELBOW')) totalCodos++;
                    else if (type.includes('TEE')) totalTees++;
                    else if (type.includes('REDUCER')) totalReducciones++;
                    else if (type.includes('VALVE')) totalValvulas++;
                });
            }
        });
        const resumen = equipos.length + ' equipos (' + tanques.length + ' tanques, ' + bombas.length + ' bombas), ' + lines.length + ' tuberías, ' + totalCodos + ' codos, ' + totalTees + ' tees, ' + totalReducciones + ' reducciones, ' + totalValvulas + ' válvulas.';
        notify(resumen, false);
    }
    
    // -------------------- 7. HERRAMIENTAS --------------------
    function setTool(mode) {
        toolMode = mode;
        const buttons = {
            select: document.getElementById('toolSelect'),
            moveEq: document.getElementById('toolMoveEq'),
            editPipe: document.getElementById('toolEditPipe'),
            addPoint: document.getElementById('toolAddPoint')
        };
        Object.values(buttons).forEach(function(btn) { if (btn) btn.classList.remove('active'); });
        if (buttons[mode]) buttons[mode].classList.add('active');
    }
    
    window.setElevation = function(level) {
        if (typeof SmartFlowCore !== 'undefined') SmartFlowCore.setElevation(level);
        if (customElev) customElev.value = level;
    };
    
    function toggleVoice() {
        voiceEnabled = !voiceEnabled;
        if (typeof SmartFlowCore !== 'undefined') SmartFlowCore.setVoice(voiceEnabled);
        const btnVoice = document.getElementById('btnVoice');
        if (btnVoice) btnVoice.textContent = voiceEnabled ? '🔊 Voz ON' : '🔇 Voz OFF';
        notify(voiceEnabled ? "✅ Voz activada" : "🔇 Voz desactivada", false);
    }
    
    // -------------------- 8. ATAJOS DE TECLADO --------------------
    function setupKeyboardShortcuts() {
        document.addEventListener('keydown', function(e) {
            const activeEl = document.activeElement;
            if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA') && activeEl.id !== 'commandText') return;
            
            if (e.ctrlKey && e.shiftKey) {
                switch(e.key.toUpperCase()) {
                    case 'C': e.preventDefault(); abrirPanelComandos(); break;
                    case 'R': e.preventDefault(); resumenProyecto(); break;
                    case 'V': e.preventDefault(); autoCenter(); break;
                    case 'U': e.preventDefault(); if (typeof SmartFlowCore !== 'undefined') { SmartFlowCore.undo(); scheduleRender(); notify("✅ Acción deshecha.", false); } break;
                    case 'Y': e.preventDefault(); if (typeof SmartFlowCore !== 'undefined') { SmartFlowCore.redo(); scheduleRender(); notify("✅ Acción rehecha.", false); } break;
                    case 'M': e.preventDefault(); exportarMTO(); break;
                    case 'P': e.preventDefault(); if (typeof SmartFlowExporter !== 'undefined') SmartFlowExporter.exportPDF(); break;
                    case 'E': e.preventDefault(); if (typeof SmartFlowExporter !== 'undefined') SmartFlowExporter.exportPCF(); break;
                    case 'S': e.preventDefault(); guardarProyecto(); break;
                }
            }
        });
    }
    
    // -------------------- 9. CABLEADO DE BOTONES --------------------
    function abrirPanelComandos() {
        if (commandPanel) {
            commandPanel.style.display = 'block';
            if (commandText) commandText.focus();
        }
    }
    
    function ejecutarComando() {
        if (!commandText) return;
        if (typeof SmartFlowCommands === 'undefined') {
            notify("Sistema de comandos no disponible", true);
            return;
        }
        
        const textoCompleto = commandText.value.trim();
        if (!textoCompleto) return;
        
        const lineas = textoCompleto.split('\n').map(function(l) { return l.trim(); }).filter(function(l) { return l.length > 0; });
        
        let success = true;
        if (lineas.length === 1) {
            const resultado = SmartFlowCommands.executeCommand(lineas[0]);
            success = (resultado !== false);
        } else {
            const ejecutados = SmartFlowCommands.executeBatch(lineas.join('\n'));
            success = ejecutados > 0;
        }
        
        if (success) addToHistory(textoCompleto);
        
        commandText.value = '';
        
        const primeraLinea = lineas[0].toLowerCase();
        if (!primeraLinea.startsWith('info') && !primeraLinea.startsWith('coordenadas') && 
            !primeraLinea.startsWith('nodos') && !primeraLinea.startsWith('listar') && 
            !primeraLinea.startsWith('list') && !primeraLinea.startsWith('ayuda') && 
            !primeraLinea.startsWith('help') && !primeraLinea.startsWith('bom') && 
            !primeraLinea.startsWith('mto') && !primeraLinea.startsWith('audit')) {
            if (commandPanel) commandPanel.style.display = 'none';
        }
    }
    
    // -------------------- 10. HISTORIAL DE COMANDOS --------------------
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
            if (_commandHistory.length > 0) {
                indicator.textContent = '⏺ Historial: ' + _commandHistory.length + ' comandos (↑↓)';
            } else {
                indicator.textContent = '';
            }
        }
    }
    
    function navigateHistory(direction) {
        if (!commandText) return;
        if (_isNavigatingHistory) return;
        _isNavigatingHistory = true;
        
        if (_historyIndex === _commandHistory.length) _tempCommand = commandText.value;
        
        if (direction === 'up') {
            if (_historyIndex > 0) { _historyIndex--; commandText.value = _commandHistory[_historyIndex]; }
        } else if (direction === 'down') {
            if (_historyIndex < _commandHistory.length - 1) { _historyIndex++; commandText.value = _commandHistory[_historyIndex]; }
            else if (_historyIndex === _commandHistory.length - 1) { _historyIndex++; commandText.value = _tempCommand || ''; }
        }
        
        setTimeout(function() { _isNavigatingHistory = false; }, 50);
    }
    
    function bindEvents() {
        const vincular = function(id, accion) {
            const el = document.getElementById(id);
            if (el) el.onclick = accion;
        };
        
        vincular('welcome-new-project', function() { if (projectModal) projectModal.style.display = 'flex'; });
        vincular('welcome-open-project', function() { cargarProyecto(); if (welcomePanel) welcomePanel.classList.add('welcome-hidden'); });
        vincular('modal-accept', iniciarNuevoProyecto);
        vincular('modal-skip', saltarNombreProyecto);
        
        vincular('btnOpen', cargarProyecto);
        vincular('btnSave', guardarProyecto);
        vincular('btnExportProject', exportarProyectoArchivo);
        vincular('btnImportProject', importarProyectoArchivo);
        
        vincular('btnReset', autoCenter);
        vincular('btnFullscreen', toggleFullscreen);
        vincular('btnFullscreenCenter', autoCenter);
        vincular('btnFullscreenExit', exitFullscreen);
        vincular('btnTogglePanels', toggleAllPanels);
        
        vincular('btn-mode-2d', function() { 
            notify("❌ Modo 2D no disponible. Solo modo 3D activo.", true);
        });
        vincular('btn-mode-3d', function() { 
            if (currentViewMode !== '3d') {
                currentViewMode = '3d';
                updateViewModeButtons();
                notify("✅ Modo 3D activado", false);
            }
        });
        
        vincular('btnCommand', abrirPanelComandos);
        vincular('closeCommand', function() { if (commandPanel) commandPanel.style.display = 'none'; });
        vincular('clearCommand', function() { if (commandText) { commandText.value = ''; _historyIndex = _commandHistory.length; _tempCommand = ''; } });
        vincular('runCommands', ejecutarComando);
        
        vincular('btnAddTank', function() {
            if (typeof SmartFlowCore === 'undefined' || typeof SmartFlowCommands === 'undefined') return;
            const equipos = SmartFlowCore.getEquipos();
            const tag = 'TK-' + (equipos.filter(function(e) { return e.tipo === 'tanque_v'; }).length + 1);
            const ult = equipos[equipos.length - 1];
            const x = ult ? ult.posX + 3000 : 0;
            SmartFlowCommands.executeCommand('create tanque_v ' + tag + ' at (' + x + ',1450,0) diam 2380 height 2900 material PE');
            notify('✅ Equipo ' + tag + ' creado.', false);
        });
        vincular('btnAddPump', function() {
            if (typeof SmartFlowCore === 'undefined' || typeof SmartFlowCommands === 'undefined') return;
            const equipos = SmartFlowCore.getEquipos();
            const tag = 'B-' + (equipos.filter(function(e) { return e.tipo && e.tipo.includes('bomba'); }).length + 1);
            const ult = equipos[equipos.length - 1];
            const x = ult ? ult.posX + 3000 : 5000;
            SmartFlowCommands.executeCommand('create bomba ' + tag + ' at (' + x + ',800,0) diam 800 height 800');
            notify('✅ Equipo ' + tag + ' creado.', false);
        });
        
        vincular('toolSelect', function() { setTool('select'); });
        vincular('toolMoveEq', function() { setTool('moveEq'); });
        vincular('toolEditPipe', function() { setTool('editPipe'); });
        vincular('toolAddPoint', function() { setTool('addPoint'); });
        vincular('toolToggleHide', function() {
            const panel = document.getElementById('toolsPanel');
            const buttons = document.getElementById('toolsButtons');
            const toggleBtn = document.getElementById('toolToggleHide');
            if (buttons.style.display === 'none') {
                buttons.style.display = 'flex'; buttons.style.flexDirection = 'column'; buttons.style.gap = '4px';
                if (toggleBtn) toggleBtn.textContent = '−'; if (panel) panel.classList.remove('collapsed');
            } else {
                buttons.style.display = 'none';
                if (toggleBtn) toggleBtn.textContent = '+'; if (panel) panel.classList.add('collapsed');
            }
        });
        
        vincular('btnMTO', exportarMTO);
        vincular('btnPDF', function() { 
            if (typeof SmartFlowExporter !== 'undefined') SmartFlowExporter.exportPDF(); 
            else if (typeof SmartFlowRenderer !== 'undefined' && SmartFlowRenderer.exportPDF) SmartFlowRenderer.exportPDF();
        });
        vincular('btnExportPCF', function() { 
            if (typeof SmartFlowExporter !== 'undefined') SmartFlowExporter.exportPCF(); 
        });
        vincular('btnImportPCF', function() { 
            if (typeof SmartFlowExporter !== 'undefined') SmartFlowExporter.importPCFFromFile(); 
        });
        
        vincular('btnUndo', function() { if (typeof SmartFlowCore !== 'undefined') { SmartFlowCore.undo(); scheduleRender(); notify("✅ Acción deshecha.", false); } });
        vincular('btnRedo', function() { if (typeof SmartFlowCore !== 'undefined') { SmartFlowCore.redo(); scheduleRender(); notify("✅ Acción rehecha.", false); } });
        vincular('btnVoice', toggleVoice);
        vincular('btnSpeakSummary', resumenProyecto);
        vincular('btnRecalc', function() { if (typeof SmartFlowCore !== 'undefined') { SmartFlowCore.syncPhysicalData(); scheduleRender(); notify("✅ Recálculo completado.", false); } });
        vincular('btnSetElev', function() {
            const val = parseInt(customElev ? customElev.value : 0);
            if (!isNaN(val)) window.setElevation(val);
        });
        vincular('btnApplyNorm', function() { notify("Función de normas en desarrollo.", false); });
        
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
        
        if (commandText) {
            commandText.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    ejecutarComando();
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault(); navigateHistory('up');
                } else if (e.key === 'ArrowDown') {
                    e.preventDefault(); navigateHistory('down');
                }
            });
        }
        
        let resizeTimeout;
        window.addEventListener('resize', function() {
            if (window.ThreeJsEngine) {
                window.ThreeJsEngine.onResize();
            }
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(function() { autoCenter(); }, 150);
        });
    }
    
    // -------------------- 11. ARRANQUE --------------------
    function init() {
        window.currentProjectName = window.currentProjectName || 'Proyecto_SmartFlow';
        window.voiceEnabled = true;
        
        const splashStatus = document.getElementById('splash-status');
        const messages = [
            "Cargando librerías...",
            "Inicializando motor 3D...",
            "Cargando catálogo de equipos...",
            "¡SmartFlow Activo!"
        ];
        let msgIndex = 0;
        const interval = setInterval(function() {
            if (msgIndex < messages.length && splashStatus) {
                splashStatus.textContent = messages[msgIndex];
                msgIndex++;
            }
        }, 800);
        
        function bootstrapWhenReady() {
            if (typeof SmartFlowCore === 'undefined') {
                setTimeout(bootstrapWhenReady, 100);
                return;
            }
            
            console.log('🚀 Iniciando SmartFlow v3.6 (3D con voz directa)...');
            
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
            
            setTimeout(function() {
                autoCenter();
            }, 1000);
        }
        
        setTimeout(bootstrapWhenReady, 1000);
        
        if (window.innerWidth < 768) togglePanel(false);
    }
    
    init();
})();
