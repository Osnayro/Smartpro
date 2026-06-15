// ============================================================
// ENGFLOOW v1.0 - MAIN APPLICATION
// Suite de Ingeniería Unificada
// Módulos: Isométrico (2D/3D) | P&ID | DTI
// Comandos: Modo texto + Modo asistido
// ============================================================

(function() {
    "use strict";
    
    // Elementos DOM
    const canvas = document.getElementById('isoCanvas');
    const notificationEl = document.getElementById('notification-toast');
    const statusMsgEl = document.getElementById('statusMsg');
    const cmdInput = document.getElementById('cmd-input');
    const commandBar = document.getElementById('command-bar');
    const sidePanel = document.getElementById('property-panel');
    const panelContent = document.getElementById('property-content');
    const splashScreen = document.getElementById('splash-screen');
    const welcomeScreen = document.getElementById('welcome-screen');
    const moduleContainer = document.getElementById('module-container');
    const toolsPanel = document.querySelector('.iso-tools');
    
    // Estado global
    let toolMode = 'select';
    let voiceEnabled = true;
    let currentModule = 'ISOMETRIC';
    let currentViewMode = '2d';
    let _is2DInitialized = false;
    let _is3DInitialized = false;
    let _ioInitialized = false;
    let _modulesInitialized = false;
    
    // Historial de comandos
    const _commandHistory = [];
    let _historyIndex = -1;
    let _tempCommand = '';
    
    // ============================================================
    // NOTIFICACIONES Y VOZ
    // ============================================================
    
    function notify(msg, isErr) {
        if (isErr === undefined) isErr = false;
        if (notificationEl) {
            notificationEl.textContent = msg;
            notificationEl.className = `notification-toast ${isErr ? 'error' : ''}`;
            notificationEl.style.display = 'block';
            setTimeout(() => {
                if (notificationEl) notificationEl.style.display = 'none';
            }, 4000);
        }
        if (statusMsgEl) statusMsgEl.textContent = msg;
        if (voiceEnabled && window.speechSynthesis) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(msg);
            utterance.lang = 'es-ES';
            utterance.rate = 0.9;
            window.speechSynthesis.speak(utterance);
        }
    }
    
    function voiceFn(msg) {
        if (voiceEnabled && window.speechSynthesis) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(msg);
            utterance.lang = 'es-ES';
            utterance.rate = 0.9;
            window.speechSynthesis.speak(utterance);
        }
    }
    
    function showCommandError() {
        if (cmdInput) {
            cmdInput.classList.add('error');
            setTimeout(() => {
                cmdInput.classList.remove('error');
            }, 500);
        }
    }
    
    // ============================================================
    // RENDERIZADO Y ACTUALIZACIONES
    // ============================================================
    
    function scheduleRender() {
        if (currentModule === 'PFD' && typeof SmartFlowPFDRenderer !== 'undefined') {
            SmartFlowPFDRenderer.render();
        } else if (currentModule === 'DTI' && typeof SmartFlowDTIRenderer !== 'undefined') {
            SmartFlowDTIRenderer.render();
        } else if (currentModule === 'ISOMETRIC') {
            if (currentViewMode === '2d' && window.SmartFlowRenderer) {
                window.SmartFlowRenderer.render();
            } else if (currentViewMode === '3d' && window.SmartFlowRender) {
                window.SmartFlowRender.renderFrame();
            }
        }
    }
    
    function autoCenter() {
        if (currentModule === 'PFD' && typeof SmartFlowPFDRenderer !== 'undefined') {
            SmartFlowPFDRenderer.render();
        } else if (currentModule === 'DTI' && typeof SmartFlowDTIRenderer !== 'undefined') {
            SmartFlowDTIRenderer.render();
        } else if (currentModule === 'ISOMETRIC') {
            if (currentViewMode === '2d' && window.SmartFlowRenderer) {
                window.SmartFlowRenderer.autoCenter();
            } else if (currentViewMode === '3d' && window.ThreeJsEngine) {
                window.ThreeJsEngine.fitCameraToEquipments();
            }
        }
    }
    
    function updatePropertyPanel(info) {
        if (!panelContent) return;
        if (!info) {
            if (sidePanel) sidePanel.classList.add('hidden');
            return;
        }
        if (sidePanel) sidePanel.classList.remove('hidden');
        
        let html = `
            <div class="property-field"><label>TAG</label><div class="value">${escapeHtml(info.tag || 'N/A')}</div></div>
            <div class="property-field"><label>TIPO</label><div class="value">${escapeHtml(info.tipo || 'Desconocido')}</div></div>
            <div class="property-field"><label>MATERIAL</label><div class="value">${escapeHtml(info.material || 'N/A')}</div></div>
            <div class="property-field"><label>DIÁMETRO</label><div class="value">${escapeHtml(info.diametro || 'N/A')}</div></div>
        `;
        
        if (info.puertos && info.puertos.length) {
            html += `<div class="property-field"><label>PUERTOS</label><div class="value">`;
            info.puertos.forEach(p => {
                const statusClass = p.status === 'open' ? '🟢' : '🔴';
                html += `<div>${statusClass} ${escapeHtml(p.id)} (⌀${p.diametro || '?'}") ${p.status === 'open' ? 'Libre' : 'Conectado'}</div>`;
            });
            html += `</div></div>`;
        }
        
        if (info.spool) {
            html += `<div class="property-field"><label>LONGITUD</label><div class="value">${info.spool.longitudTotalM} m</div></div>`;
            html += `<div class="property-field"><label>JUNTAS</label><div class="value">${info.spool.juntasEstimadas}</div></div>`;
        }
        
        panelContent.innerHTML = html;
    }
    
    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/[&<>]/g, function(m) {
            if (m === '&') return '&amp;';
            if (m === '<') return '&lt;';
            if (m === '>') return '&gt;';
            return m;
        });
    }
    
    // ============================================================
    // COMANDOS - MODO TEXTO
    // ============================================================
    
    function addToHistory(cmd) {
        const trimmed = cmd.trim();
        if (!trimmed) return;
        if (_commandHistory.length > 0 && _commandHistory[_commandHistory.length - 1] === trimmed) return;
        _commandHistory.push(trimmed);
        if (_commandHistory.length > 50) _commandHistory.shift();
        _historyIndex = _commandHistory.length;
    }
    
    function navigateHistory(direction) {
        if (!cmdInput) return;
        if (_historyIndex === _commandHistory.length) _tempCommand = cmdInput.value;
        if (direction === 'up' && _historyIndex > 0) {
            _historyIndex--;
            cmdInput.value = _commandHistory[_historyIndex];
        } else if (direction === 'down' && _historyIndex < _commandHistory.length - 1) {
            _historyIndex++;
            cmdInput.value = _commandHistory[_historyIndex];
        } else if (direction === 'down' && _historyIndex === _commandHistory.length - 1) {
            _historyIndex++;
            cmdInput.value = _tempCommand || '';
        }
        cmdInput.focus();
    }
    
    function executeTextCommand(cmdText) {
        if (!cmdText.trim()) {
            const msg = "❌ No se ingresó ningún comando";
            if (voiceEnabled && typeof SmartFlowCommands !== 'undefined' && SmartFlowCommands.notify) {
                SmartFlowCommands.notify(msg, true);
            } else {
                notify(msg, true);
            }
            showCommandError();
            return false;
        }
        
        const lines = cmdText.split('\n').filter(l => l.trim());
        let success = false;
        let errorMsg = null;
        
        try {
            if (lines.length === 1) {
                success = SmartFlowCommands.executeCommand(lines[0]) !== false;
                if (!success) {
                    errorMsg = `❌ No se pudo ejecutar: "${lines[0].substring(0, 50)}"`;
                }
            } else {
                const result = SmartFlowCommands.executeBatch(lines.join('\n'));
                success = result > 0;
                if (!success) {
                    errorMsg = `❌ Ninguno de los ${lines.length} comandos se pudo ejecutar`;
                }
            }
        } catch (e) {
            success = false;
            errorMsg = `❌ Error: ${e.message}`;
        }
        
        if (success) {
            addToHistory(cmdText);
            if (currentModule === 'PFD') refreshStreamList();
            if (currentModule === 'DTI') refreshInstrumentList();
            scheduleRender();
        } else {
            if (errorMsg) {
                if (voiceEnabled && typeof SmartFlowCommands !== 'undefined' && SmartFlowCommands.notify) {
                    SmartFlowCommands.notify(errorMsg, true);
                } else {
                    notify(errorMsg, true);
                }
            }
            showCommandError();
        }
        
        return success;
    }
    
    // ============================================================
    // COMANDOS - MODO ASISTIDO
    // ============================================================
    
    function openAssistant() {
        if (typeof SmartFlowAssistantUI !== 'undefined') {
            SmartFlowAssistantUI.openPanel();
        }
    }
    
    // ============================================================
    // GESTIÓN DE MÓDULOS
    // ============================================================
    
    function switchModule(module) {
        currentModule = module;
        
        // Ocultar todos los módulos
        document.querySelectorAll('.module-view').forEach(view => {
            view.classList.remove('active');
        });
        
        // Mostrar el módulo seleccionado
        const moduleId = module === 'ISOMETRIC' ? 'isometric-module' : 
                         module === 'PFD' ? 'pfd-module' : 'dti-module';
        const activeView = document.getElementById(moduleId);
        if (activeView) activeView.classList.add('active');
        
        // Actualizar botones del selector
        document.querySelectorAll('.module-switcher button').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.module === module) btn.classList.add('active');
        });
        
        // Mostrar/ocultar herramientas del módulo
        if (toolsPanel) {
            toolsPanel.style.display = module === 'ISOMETRIC' ? 'block' : 'none';
        }
        
        // Actualizar asistente
        if (typeof SmartFlowAssistant !== 'undefined') {
            SmartFlowAssistant.setModule(module);
        }
        
        // Renderizar módulo
        if (module === 'PFD' && typeof SmartFlowPFDRenderer !== 'undefined') {
            SmartFlowPFDRenderer.resizeCanvas();
            setTimeout(() => SmartFlowPFDRenderer.render(), 50);
        } else if (module === 'DTI' && typeof SmartFlowDTIRenderer !== 'undefined') {
            SmartFlowDTIRenderer.resizeCanvas();
            setTimeout(() => SmartFlowDTIRenderer.render(), 50);
        } else if (module === 'ISOMETRIC') {
            if (currentViewMode === '2d' && typeof SmartFlowRenderer !== 'undefined') {
                SmartFlowRenderer.resizeCanvas();
                setTimeout(() => SmartFlowRenderer.autoCenter(), 100);
            } else if (currentViewMode === '3d' && window.ThreeJsEngine) {
                setTimeout(() => window.ThreeJsEngine.fitCameraToEquipments(), 100);
            }
        }
        
        // NOTIFICACIÓN POR VOZ AL CAMBIAR DE MÓDULO
        const moduleMessages = {
            'ISOMETRIC': { nombre: 'Isométrico', mensaje: 'Módulo isométrico activado. Modo diseño de tuberías y equipos.' },
            'PFD': { nombre: 'P&ID', mensaje: 'Módulo P&ID activado. Diagramas de flujo y corrientes de proceso.' },
            'DTI': { nombre: 'DTI', mensaje: 'Módulo DTI activado. Instrumentación y lazos de control.' }
        };
        
        const info = moduleMessages[module];
        if (info) {
            if (voiceEnabled) {
                voiceFn(info.mensaje);
            }
            if (statusMsgEl) {
                statusMsgEl.textContent = `EngFlow | ${info.nombre} | Listo`;
            }
            notify(`✅ Módulo ${info.nombre} activado`, false);
        }
        
        console.log(`✅ Módulo cambiado a ${info?.nombre || module}`);
    }
    
    function refreshStreamList() {
        const container = document.getElementById('stream-list');
        if (!container) return;
        
        if (typeof SmartFlowPFD !== 'undefined' && SmartFlowPFD.getStreams) {
            const streams = SmartFlowPFD.getStreams();
            if (streams && streams.length) {
                container.innerHTML = streams.map(s => `
                    <div class="stream-item" data-stream="${s.tag}" onclick="window.selectStream('${s.tag}')">
                        <div class="stream-tag">${escapeHtml(s.tag)}</div>
                        <div class="stream-flow">${escapeHtml(s.from || '?')} → ${escapeHtml(s.to || '?')}</div>
                        <div class="stream-fluid">${escapeHtml(s.fluid)} ${s.flow || 0}${s.flowUnit || ''}</div>
                    </div>
                `).join('');
            } else {
                container.innerHTML = '<div style="text-align:center; color:#64748b; padding:20px;">No hay corrientes. Cree una con el asistente.</div>';
            }
        }
    }
    
    function refreshInstrumentList() {
        const instrumentContainer = document.getElementById('instrument-list');
        const loopContainer = document.getElementById('loop-list');
        
        if (instrumentContainer && typeof SmartFlowDTI !== 'undefined' && SmartFlowDTI.getInstruments) {
            const instruments = SmartFlowDTI.getInstruments();
            if (instruments && instruments.length) {
                instrumentContainer.innerHTML = instruments.map(i => `
                    <div class="instrument-item" data-instrument="${i.tag}" onclick="window.selectInstrument('${i.tag}')">
                        <div class="instrument-tag">${escapeHtml(i.tag)}</div>
                        <div class="instrument-type">${escapeHtml(i.type || '?')}</div>
                        <div class="instrument-location">${escapeHtml(i.lineTag || i.equipmentTag || 'Sin ubicación')}</div>
                    </div>
                `).join('');
            } else {
                instrumentContainer.innerHTML = '<div style="text-align:center; color:#64748b; padding:20px;">No hay instrumentos</div>';
            }
        }
        
        if (loopContainer && typeof SmartFlowDTI !== 'undefined' && SmartFlowDTI.getLoops) {
            const loops = SmartFlowDTI.getLoops();
            if (loops && loops.length) {
                loopContainer.innerHTML = loops.map(l => `
                    <div class="loop-item" data-loop="${l.tag}" onclick="window.selectLoop('${l.tag}')">
                        <div class="instrument-tag">${escapeHtml(l.tag)}</div>
                        <div class="instrument-type">${escapeHtml(l.type || 'PID')}</div>
                        <div class="instrument-location">${escapeHtml(l.sensor || '?')} → ${escapeHtml(l.valve || '?')}</div>
                    </div>
                `).join('');
            } else {
                loopContainer.innerHTML = '<div style="text-align:center; color:#64748b; padding:20px;">No hay lazos</div>';
            }
        }
    }
    
    // Funciones globales para selección
    window.selectStream = function(tag) {
        if (typeof SmartFlowPFD !== 'undefined') {
            SmartFlowPFD.getStreamInfo(tag);
        }
        notify(`Corriente seleccionada: ${tag}`, false);
    };
    
    window.selectInstrument = function(tag) {
        if (typeof SmartFlowDTI !== 'undefined') {
            SmartFlowDTI.getInstrumentInfo(tag);
        }
        const detailPanel = document.getElementById('dti-detail-panel');
        if (detailPanel) {
            detailPanel.innerHTML = `<div class="detail-card"><strong>📊 ${escapeHtml(tag)}</strong><br>Detalles cargando...</div>`;
        }
        notify(`Instrumento seleccionado: ${tag}`, false);
    };
    
    window.selectLoop = function(tag) {
        if (typeof SmartFlowDTI !== 'undefined' && SmartFlowDTI.getLoopInfo) {
            SmartFlowDTI.getLoopInfo(tag);
        }
        const detailPanel = document.getElementById('dti-detail-panel');
        if (detailPanel) {
            detailPanel.innerHTML = `<div class="detail-card"><strong>🔄 ${escapeHtml(tag)}</strong><br>Detalles cargando...</div>`;
        }
        notify(`Lazo seleccionado: ${tag}`, false);
    };
    
    // ============================================================
    // HERRAMIENTAS ISOMÉTRICAS
    // ============================================================
    
    function setToolMode(mode) {
        toolMode = mode;
        document.querySelectorAll('.iso-tools-buttons button').forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.getElementById(`tool-${mode}`);
        if (activeBtn) activeBtn.classList.add('active');
        notify(`Herramienta: ${mode === 'select' ? 'Seleccionar' : mode === 'move' ? 'Mover equipo' : mode === 'edit' ? 'Editar línea' : 'Añadir punto'}`, false);
    }
    
    function setElevation(level) {
        if (typeof SmartFlowCore !== 'undefined') SmartFlowCore.setElevation(level);
        if (currentModule === 'ISOMETRIC' && currentViewMode === '2d' && window.SmartFlowRenderer) {
            window.SmartFlowRenderer.setElevation(level);
        }
        const customElev = document.getElementById('custom-elev');
        if (customElev) customElev.value = level;
        notify(`Elevación establecida en ${level/1000} m`, false);
    }
    
    function toggleVoice() {
        voiceEnabled = !voiceEnabled;
        if (typeof SmartFlowCore !== 'undefined') SmartFlowCore.setVoice(voiceEnabled);
        
        const btnVoice = document.getElementById('btn-voice');
        if (btnVoice) {
            btnVoice.textContent = voiceEnabled ? '🔊 Voz ON' : '🔇 Voz OFF';
        }
        
        const msg = voiceEnabled ? 'Asistente de voz activado' : 'Asistente de voz desactivado';
        if (voiceEnabled) {
            voiceFn(msg);
        }
        notify(msg, false);
    }
    
    // ============================================================
    // INICIALIZACIÓN DE MÓDULOS
    // ============================================================
    
    function initModules() {
        SmartFlowCore.init(notify, scheduleRender, updatePropertyPanel);
        console.log('✅ EngFlow Core v6.0');
        
        if (typeof SmartFlowIO !== 'undefined' && !_ioInitialized) {
            SmartFlowIO.init(SmartFlowCore, notify);
            _ioInitialized = true;
            console.log('✅ EngFlow I/O');
        }
        
        if (typeof SmartFlowPFD !== 'undefined') {
            SmartFlowPFD.init(SmartFlowCore, typeof SmartFlowCatalog !== 'undefined' ? SmartFlowCatalog : null, notify);
            console.log('✅ EngFlow PFD Engine');
        }
        
        if (typeof SmartFlowDTI !== 'undefined') {
            SmartFlowDTI.init(SmartFlowCore, typeof SmartFlowCatalog !== 'undefined' ? SmartFlowCatalog : null, notify);
            console.log('✅ EngFlow DTI Engine');
        }
        
        if (typeof SmartFlowIntegrity !== 'undefined') {
            SmartFlowIntegrity.init(SmartFlowCore, 
                typeof SmartFlowPFD !== 'undefined' ? SmartFlowPFD : null,
                typeof SmartFlowDTI !== 'undefined' ? SmartFlowDTI : null, notify);
            console.log('✅ EngFlow Integrity');
        }
        
        if (typeof SmartFlowPFDRenderer !== 'undefined') {
            const pfdCanvas = document.getElementById('pfdCanvas');
            if (pfdCanvas) SmartFlowPFDRenderer.init(pfdCanvas, SmartFlowCore, notify);
            console.log('✅ EngFlow PFD Renderer');
        }
        
        if (typeof SmartFlowDTIRenderer !== 'undefined') {
            const dtiCanvas = document.getElementById('dtiCanvas');
            if (dtiCanvas) SmartFlowDTIRenderer.init(dtiCanvas, SmartFlowCore, notify);
            console.log('✅ EngFlow DTI Renderer');
        }
        
        if (typeof SmartFlowRenderer !== 'undefined' && canvas) {
            SmartFlowRenderer.init(canvas, SmartFlowCore, notify);
            _is2DInitialized = true;
            console.log('✅ EngFlow ISO Renderer 2D');
        }
        
        if (typeof SmartFlowRouter !== 'undefined') {
            SmartFlowRouter.init(SmartFlowCore, SmartFlowCatalog, notify, scheduleRender);
            console.log('✅ EngFlow Router');
        }
        
        SmartFlowCommands.init(SmartFlowCore, SmartFlowCatalog, SmartFlowRenderer, notify, scheduleRender, voiceFn);
        console.log('✅ EngFlow Commands');
        
        if (typeof SmartFlowAssistant !== 'undefined') {
            SmartFlowAssistant.setCore(SmartFlowCore);
            SmartFlowAssistant.setModule(currentModule);
            console.log('✅ EngFlow Assistant');
        }
        
        SmartFlowCore.setVoice(voiceEnabled);
        _modulesInitialized = true;
        
        // Mensaje de bienvenida por voz
        setTimeout(() => {
            if (voiceEnabled) {
                voiceFn('Bienvenido a EngFlow. Suite de ingeniería inteligente.');
            }
        }, 1000);
        
        notify('EngFlow v1.0 listo | Isométrico + P&ID + DTI', false);
    }
    
    // ============================================================
    // EVENTOS Y SHORTCUTS
    // ============================================================
    
    function setupShortcuts() {
        document.addEventListener('keydown', function(e) {
            // Ctrl+Shift+1/2/3: cambiar módulo
            if (e.ctrlKey && e.shiftKey) {
                switch(e.key) {
                    case '1': e.preventDefault(); switchModule('ISOMETRIC'); break;
                    case '2': e.preventDefault(); switchModule('PFD'); break;
                    case '3': e.preventDefault(); switchModule('DTI'); break;
                    case 'C': e.preventDefault(); openAssistant(); break;
                    case 'U': e.preventDefault(); SmartFlowCore.undo(); scheduleRender(); break;
                    case 'Y': e.preventDefault(); SmartFlowCore.redo(); scheduleRender(); break;
                    case 'S': e.preventDefault(); 
                        if (typeof SmartFlowIO !== 'undefined') SmartFlowIO.downloadJSON();
                        break;
                    case 'E': e.preventDefault();
                        if (typeof SmartFlowIO !== 'undefined') SmartFlowIO.downloadPCF();
                        break;
                    case 'M': e.preventDefault();
                        if (typeof SmartFlowIO !== 'undefined') SmartFlowIO.downloadMTO();
                        break;
                    case 'A': e.preventDefault();
                        if (typeof SmartFlowIntegrity !== 'undefined') SmartFlowIntegrity.validateAll();
                        break;
                    case 'V': e.preventDefault(); autoCenter(); break;
                }
            }
            
            // Escape: cerrar paneles (NO la barra de comandos)
            if (e.key === 'Escape') {
                if (sidePanel && !sidePanel.classList.contains('hidden')) {
                    sidePanel.classList.add('hidden');
                }
                if (typeof SmartFlowAssistantUI !== 'undefined') {
                    SmartFlowAssistantUI.closeOverlay();
                }
            }
            
            // Ctrl+Z / Ctrl+Y
            if (e.ctrlKey && !e.shiftKey) {
                if (e.key === 'z') { e.preventDefault(); SmartFlowCore.undo(); scheduleRender(); }
                if (e.key === 'y') { e.preventDefault(); SmartFlowCore.redo(); scheduleRender(); }
            }
            
            // F11: pantalla completa
            if (e.key === 'F11') {
                e.preventDefault();
                document.body.classList.toggle('fullscreen-mode');
                autoCenter();
            }
            
            // Flechas en el input de comandos
            if (document.activeElement === cmdInput) {
                if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    navigateHistory('up');
                } else if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    navigateHistory('down');
                }
            }
        });
    }
    
    function setupEventListeners() {
        // Botones principales
        document.getElementById('btn-undo')?.addEventListener('click', () => { SmartFlowCore.undo(); scheduleRender(); });
        document.getElementById('btn-redo')?.addEventListener('click', () => { SmartFlowCore.redo(); scheduleRender(); });
        document.getElementById('btn-voice')?.addEventListener('click', toggleVoice);
        document.getElementById('btn-assistant')?.addEventListener('click', openAssistant);
        document.getElementById('btn-fullscreen')?.addEventListener('click', () => {
            document.body.classList.toggle('fullscreen-mode');
            autoCenter();
        });
        document.getElementById('btn-toggle-property')?.addEventListener('click', () => {
            if (sidePanel) sidePanel.classList.toggle('hidden');
        });
        document.getElementById('close-property-panel')?.addEventListener('click', () => {
            if (sidePanel) sidePanel.classList.add('hidden');
        });
        
        // Selector de módulo
        document.querySelectorAll('.module-switcher button').forEach(btn => {
            btn.addEventListener('click', () => {
                const module = btn.dataset.module;
                if (module) switchModule(module);
            });
        });
        
        // Acciones PFD
        document.getElementById('btn-create-stream')?.addEventListener('click', () => {
            if (typeof SmartFlowAssistantUI !== 'undefined') SmartFlowAssistantUI.startFlow('STREAM.CREATE');
        });
        document.getElementById('btn-link-stream')?.addEventListener('click', () => {
            if (typeof SmartFlowAssistantUI !== 'undefined') SmartFlowAssistantUI.startFlow('STREAM.LINK');
        });
        document.getElementById('btn-balance')?.addEventListener('click', () => {
            if (typeof SmartFlowAssistantUI !== 'undefined') SmartFlowAssistantUI.startFlow('BALANCE.MASA');
        });
        
        // Acciones DTI
        document.getElementById('btn-create-instrument')?.addEventListener('click', () => {
            if (typeof SmartFlowAssistantUI !== 'undefined') SmartFlowAssistantUI.startFlow('INSTRUMENT.CREATE');
        });
        document.getElementById('btn-create-loop')?.addEventListener('click', () => {
            if (typeof SmartFlowAssistantUI !== 'undefined') SmartFlowAssistantUI.startFlow('LOOP.CREATE');
        });
        document.getElementById('btn-refresh-dti')?.addEventListener('click', () => {
            refreshInstrumentList();
            notify('Listas actualizadas', false);
        });
        
        // Herramientas isométricas
        document.getElementById('tool-select')?.addEventListener('click', () => setToolMode('select'));
        document.getElementById('tool-move')?.addEventListener('click', () => setToolMode('move'));
        document.getElementById('tool-edit')?.addEventListener('click', () => setToolMode('edit'));
        document.getElementById('tool-add-point')?.addEventListener('click', () => setToolMode('addPoint'));
        
        // Elevación
        document.getElementById('elev-0')?.addEventListener('click', () => setElevation(0));
        document.getElementById('elev-2500')?.addEventListener('click', () => setElevation(2500));
        document.getElementById('elev-5000')?.addEventListener('click', () => setElevation(5000));
        document.getElementById('set-elev')?.addEventListener('click', () => {
            const customElev = document.getElementById('custom-elev');
            if (customElev) setElevation(parseInt(customElev.value) || 0);
        });
        
        // Comandos
        document.getElementById('cmd-run')?.addEventListener('click', () => {
            if (cmdInput && cmdInput.value.trim()) {
                executeTextCommand(cmdInput.value.trim());
                cmdInput.value = '';
                cmdInput.focus();
            }
        });
        document.getElementById('cmd-assistant')?.addEventListener('click', openAssistant);
        document.getElementById('cmd-clear')?.addEventListener('click', () => {
            if (cmdInput) cmdInput.value = '';
            cmdInput.focus();
        });
        
        if (cmdInput) {
            cmdInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    if (cmdInput.value.trim()) {
                        executeTextCommand(cmdInput.value.trim());
                        cmdInput.value = '';
                    }
                }
            });
        }
        
        // Welcome screen - selección de módulo
        document.querySelectorAll('.module-card').forEach(card => {
            card.addEventListener('click', () => {
                const module = card.dataset.module;
                if (module) {
                    switchModule(module);
                    if (welcomeScreen) welcomeScreen.style.display = 'none';
                }
            });
        });
        
        // Redimensionamiento
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                if (currentModule === 'PFD' && typeof SmartFlowPFDRenderer !== 'undefined') {
                    SmartFlowPFDRenderer.resizeCanvas();
                    SmartFlowPFDRenderer.render();
                } else if (currentModule === 'DTI' && typeof SmartFlowDTIRenderer !== 'undefined') {
                    SmartFlowDTIRenderer.resizeCanvas();
                    SmartFlowDTIRenderer.render();
                } else if (currentModule === 'ISOMETRIC' && typeof SmartFlowRenderer !== 'undefined') {
                    SmartFlowRenderer.resizeCanvas();
                }
            }, 150);
        });
    }
    
    // ============================================================
    // INICIALIZACIÓN PRINCIPAL
    // ============================================================
    
    function init() {
        const splashStatus = document.getElementById('splash-status');
        const messages = ["Inicializando Core...", "Cargando módulos...", "Preparando interfaz...", "¡EngFlow listo!"];
        let msgIndex = 0;
        const msgInterval = setInterval(() => {
            if (splashStatus && msgIndex < messages.length) {
                splashStatus.textContent = messages[msgIndex];
                msgIndex++;
            }
        }, 800);
        
        setTimeout(() => {
            if (splashScreen) splashScreen.classList.add('splash-hidden');
            clearInterval(msgInterval);
        }, 3500);
        
        function bootstrap() {
            if (typeof SmartFlowCore === 'undefined' || typeof SmartFlowCommands === 'undefined') {
                setTimeout(bootstrap, 100);
                return;
            }
            
            initModules();
            setupEventListeners();
            setupShortcuts();
            
            if (welcomeScreen) welcomeScreen.style.display = 'flex';
            
            const toolbar = document.getElementById('app-toolbar');
            if (toolbar) toolbar.style.display = 'flex';
            
            if (commandBar) commandBar.style.display = 'flex';
            
            setTimeout(() => {
                if (welcomeScreen && welcomeScreen.style.display !== 'none') {
                    setTimeout(() => {
                        if (welcomeScreen && welcomeScreen.style.display !== 'none') {
                            switchModule('ISOMETRIC');
                            if (welcomeScreen) welcomeScreen.style.display = 'none';
                        }
                    }, 5000);
                }
            }, 500);
            
            console.log('✅ EngFlow inicializado correctamente');
        }
        
        setTimeout(bootstrap, 500);
    }
    
    // Exponer funciones globales
    window.switchModule = switchModule;
    window.autoCenter = autoCenter;
    window.setElevation = setElevation;
    window.notify = notify;
    window.scheduleRender = scheduleRender;
    window.refreshStreamList = refreshStreamList;
    window.refreshInstrumentList = refreshInstrumentList;
    window.executeTextCommand = executeTextCommand;
    window.openAssistant = openAssistant;
    window.currentModule = currentModule;
    window.toggleVoice = toggleVoice;
    
    init();
})();
