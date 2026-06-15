
// ============================================================
// ENGFLOOW v1.0 - MAIN APPLICATION
// Suite de Ingeniería Unificada
// Módulos: Isométrico (2D/3D) | P&ID | DTI
// Comandos: Modo texto + Modo asistido
// ============================================================

(function() {
    "use strict";
    
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
    
    let toolMode = 'select';
    let voiceEnabled = true;
    let currentModule = 'ISOMETRIC';
    let currentViewMode = '2d';
    let _is2DInitialized = false;
    let _is3DInitialized = false;
    let _ioInitialized = false;
    let _modulesInitialized = false;
    
    const _commandHistory = [];
    let _historyIndex = -1;
    let _tempCommand = '';
    
    function notify(msg, isErr) {
        if (isErr === undefined) isErr = false;
        if (notificationEl) {
            notificationEl.textContent = msg;
            notificationEl.className = 'notification-toast' + (isErr ? ' error' : '');
            notificationEl.style.display = 'block';
            setTimeout(function() {
                if (notificationEl) notificationEl.style.display = 'none';
            }, 4000);
        }
        if (statusMsgEl) statusMsgEl.textContent = msg;
        if (voiceEnabled && window.speechSynthesis) {
            window.speechSynthesis.cancel();
            var u = new SpeechSynthesisUtterance(msg);
            u.lang = 'es-ES';
            u.rate = 0.9;
            window.speechSynthesis.speak(u);
        }
    }
    
    function voiceFn(msg) {
        if (voiceEnabled && window.speechSynthesis) {
            window.speechSynthesis.cancel();
            var u = new SpeechSynthesisUtterance(msg);
            u.lang = 'es-ES';
            u.rate = 0.9;
            window.speechSynthesis.speak(u);
        }
    }
    
    function showCommandError() {
        if (cmdInput) {
            cmdInput.classList.add('error');
            setTimeout(function() { cmdInput.classList.remove('error'); }, 500);
        }
    }
    
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
        var html = '<div class="property-field"><label>TAG</label><div class="value">' + (info.tag || 'N/A') + '</div></div>';
        html += '<div class="property-field"><label>TIPO</label><div class="value">' + (info.tipo || 'Desconocido') + '</div></div>';
        html += '<div class="property-field"><label>MATERIAL</label><div class="value">' + (info.material || 'N/A') + '</div></div>';
        html += '<div class="property-field"><label>DIÁMETRO</label><div class="value">' + (info.diametro || 'N/A') + '</div></div>';
        if (info.puertos && info.puertos.length) {
            html += '<div class="property-field"><label>PUERTOS</label><div class="value">';
            info.puertos.forEach(function(p) {
                var sc = p.status === 'open' ? '🟢' : '🔴';
                html += '<div>' + sc + ' ' + (p.id || '?') + ' (⌀' + (p.diametro || '?') + '") ' + (p.status === 'open' ? 'Libre' : 'Conectado') + '</div>';
            });
            html += '</div></div>';
        }
        if (info.spool) {
            html += '<div class="property-field"><label>LONGITUD</label><div class="value">' + info.spool.longitudTotalM + ' m</div></div>';
            html += '<div class="property-field"><label>JUNTAS</label><div class="value">' + info.spool.juntasEstimadas + '</div></div>';
        }
        panelContent.innerHTML = html;
    }
    
    function addToHistory(cmd) {
        var t = cmd.trim();
        if (!t) return;
        if (_commandHistory.length > 0 && _commandHistory[_commandHistory.length - 1] === t) return;
        _commandHistory.push(t);
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
            notify("❌ No se ingresó ningún comando", true);
            showCommandError();
            return false;
        }
        var lines = cmdText.split('\n').filter(function(l) { return l.trim(); });
        var success = false;
        try {
            if (lines.length === 1) {
                success = SmartFlowCommands.executeCommand(lines[0]) !== false;
            } else {
                var r = SmartFlowCommands.executeBatch(lines.join('\n'));
                success = r > 0;
            }
        } catch(e) {
            success = false;
            notify("❌ Error: " + e.message, true);
        }
        if (success) {
            addToHistory(cmdText);
            if (currentModule === 'PFD') refreshStreamList();
            if (currentModule === 'DTI') refreshInstrumentList();
            scheduleRender();
        } else {
            showCommandError();
        }
        return success;
    }
    
    function openAssistant() {
        if (typeof SmartFlowAssistantUI !== 'undefined') {
            SmartFlowAssistantUI.openPanel();
        }
    }
    
    function switchModule(module) {
        currentModule = module;
        document.querySelectorAll('.module-view').forEach(function(v) { v.classList.remove('active'); });
        var modId = module === 'ISOMETRIC' ? 'isometric-module' : (module === 'PFD' ? 'pfd-module' : 'dti-module');
        var av = document.getElementById(modId);
        if (av) av.classList.add('active');
        document.querySelectorAll('.module-switcher button').forEach(function(b) {
            b.classList.remove('active');
            if (b.dataset.module === module) b.classList.add('active');
        });
        if (toolsPanel) toolsPanel.style.display = module === 'ISOMETRIC' ? 'block' : 'none';
        if (typeof SmartFlowAssistant !== 'undefined') SmartFlowAssistant.setModule(module);
        if (module === 'PFD' && typeof SmartFlowPFDRenderer !== 'undefined') {
            SmartFlowPFDRenderer.resizeCanvas();
            setTimeout(function() { SmartFlowPFDRenderer.render(); }, 50);
        } else if (module === 'DTI' && typeof SmartFlowDTIRenderer !== 'undefined') {
            SmartFlowDTIRenderer.resizeCanvas();
            setTimeout(function() { SmartFlowDTIRenderer.render(); }, 50);
        } else if (module === 'ISOMETRIC') {
            if (currentViewMode === '2d' && typeof SmartFlowRenderer !== 'undefined') {
                SmartFlowRenderer.resizeCanvas();
                setTimeout(function() { SmartFlowRenderer.autoCenter(); }, 100);
            } else if (currentViewMode === '3d' && window.ThreeJsEngine) {
                setTimeout(function() { window.ThreeJsEngine.fitCameraToEquipments(); }, 100);
            }
        }
        var msgs = {
            'ISOMETRIC': { n: 'Isométrico', m: 'Módulo isométrico activado.' },
            'PFD': { n: 'P&ID', m: 'Módulo P&ID activado.' },
            'DTI': { n: 'DTI', m: 'Módulo DTI activado.' }
        };
        var info = msgs[module];
        if (info) {
            if (voiceEnabled) voiceFn(info.m);
            if (statusMsgEl) statusMsgEl.textContent = 'EngFlow | ' + info.n + ' | Listo';
            notify('✅ Módulo ' + info.n + ' activado', false);
        }
    }
    
    function refreshStreamList() {
        var c = document.getElementById('stream-list');
        if (!c) return;
        if (typeof SmartFlowPFD !== 'undefined' && SmartFlowPFD.getStreams) {
            var ss = SmartFlowPFD.getStreams();
            if (ss && ss.length) {
                c.innerHTML = ss.map(function(s) {
                    return '<div class="stream-item" data-stream="' + s.tag + '" onclick="window.selectStream(\'' + s.tag + '\')"><div class="stream-tag">' + (s.tag||'?') + '</div><div class="stream-flow">' + (s.from||'?') + ' → ' + (s.to||'?') + '</div><div class="stream-fluid">' + (s.fluid||'') + ' ' + (s.flow||0) + (s.flowUnit||'') + '</div></div>';
                }).join('');
            } else {
                c.innerHTML = '<div style="text-align:center;color:#64748b;padding:20px;">No hay corrientes</div>';
            }
        }
    }
    
    function refreshInstrumentList() {
        var ic = document.getElementById('instrument-list');
        var lc = document.getElementById('loop-list');
        if (ic && typeof SmartFlowDTI !== 'undefined' && SmartFlowDTI.getInstruments) {
            var ins = SmartFlowDTI.getInstruments();
            if (ins && ins.length) {
                ic.innerHTML = ins.map(function(i) {
                    return '<div class="instrument-item" data-instrument="' + i.tag + '" onclick="window.selectInstrument(\'' + i.tag + '\')"><div class="instrument-tag">' + (i.tag||'?') + '</div><div class="instrument-type">' + (i.type||'?') + '</div><div class="instrument-location">' + (i.lineTag||i.equipmentTag||'Sin ubicación') + '</div></div>';
                }).join('');
            } else {
                ic.innerHTML = '<div style="text-align:center;color:#64748b;padding:20px;">No hay instrumentos</div>';
            }
        }
        if (lc && typeof SmartFlowDTI !== 'undefined' && SmartFlowDTI.getLoops) {
            var ls = SmartFlowDTI.getLoops();
            if (ls && ls.length) {
                lc.innerHTML = ls.map(function(l) {
                    return '<div class="loop-item" data-loop="' + l.tag + '" onclick="window.selectLoop(\'' + l.tag + '\')"><div class="instrument-tag">' + (l.tag||'?') + '</div><div class="instrument-type">' + (l.type||'PID') + '</div><div class="instrument-location">' + (l.sensor||'?') + ' → ' + (l.valve||'?') + '</div></div>';
                }).join('');
            } else {
                lc.innerHTML = '<div style="text-align:center;color:#64748b;padding:20px;">No hay lazos</div>';
            }
        }
    }
    
    window.selectStream = function(tag) {
        if (typeof SmartFlowPFD !== 'undefined') SmartFlowPFD.getStreamInfo(tag);
        notify('Corriente: ' + tag, false);
    };
    
    window.selectInstrument = function(tag) {
        if (typeof SmartFlowDTI !== 'undefined') SmartFlowDTI.getInstrumentInfo(tag);
        var dp = document.getElementById('dti-detail-panel');
        if (dp) dp.innerHTML = '<div class="detail-card"><strong>📊 ' + tag + '</strong><br>Detalles cargando...</div>';
        notify('Instrumento: ' + tag, false);
    };
    
    window.selectLoop = function(tag) {
        if (typeof SmartFlowDTI !== 'undefined' && SmartFlowDTI.getLoopInfo) SmartFlowDTI.getLoopInfo(tag);
        var dp = document.getElementById('dti-detail-panel');
        if (dp) dp.innerHTML = '<div class="detail-card"><strong>🔄 ' + tag + '</strong><br>Detalles cargando...</div>';
        notify('Lazo: ' + tag, false);
    };
    
    function setToolMode(mode) {
        toolMode = mode;
        document.querySelectorAll('.iso-tools-buttons button').forEach(function(b) { b.classList.remove('active'); });
        var ab = document.getElementById('tool-' + mode);
        if (ab) ab.classList.add('active');
    }
    
    function setElevation(level) {
        if (typeof SmartFlowCore !== 'undefined') SmartFlowCore.setElevation(level);
        if (currentModule === 'ISOMETRIC' && currentViewMode === '2d' && window.SmartFlowRenderer) {
            window.SmartFlowRenderer.setElevation(level);
        }
        var ce = document.getElementById('custom-elev');
        if (ce) ce.value = level;
    }
    
    function toggleVoice() {
        voiceEnabled = !voiceEnabled;
        if (typeof SmartFlowCore !== 'undefined') SmartFlowCore.setVoice(voiceEnabled);
        var bv = document.getElementById('btn-voice');
        if (bv) bv.textContent = voiceEnabled ? '🔊 Voz' : '🔇 Voz';
        if (voiceEnabled) voiceFn('Voz activada');
        notify(voiceEnabled ? 'Voz activada' : 'Voz desactivada', false);
    }
    
    function initModules() {
        SmartFlowCore.init(notify, scheduleRender, updatePropertyPanel);
        console.log('✅ Core v6.0');
        if (typeof SmartFlowIO !== 'undefined' && !_ioInitialized) {
            SmartFlowIO.init(SmartFlowCore, notify);
            _ioInitialized = true;
            console.log('✅ I/O');
        }
        if (typeof SmartFlowPFD !== 'undefined') {
            SmartFlowPFD.init(SmartFlowCore, typeof SmartFlowCatalog !== 'undefined' ? SmartFlowCatalog : null, notify);
            console.log('✅ PFD Engine');
        }
        if (typeof SmartFlowDTI !== 'undefined') {
            SmartFlowDTI.init(SmartFlowCore, typeof SmartFlowCatalog !== 'undefined' ? SmartFlowCatalog : null, notify);
            console.log('✅ DTI Engine');
        }
        if (typeof SmartFlowIntegrity !== 'undefined') {
            SmartFlowIntegrity.init(SmartFlowCore, typeof SmartFlowPFD !== 'undefined' ? SmartFlowPFD : null, typeof SmartFlowDTI !== 'undefined' ? SmartFlowDTI : null, notify);
            console.log('✅ Integrity');
        }
        if (typeof SmartFlowPFDRenderer !== 'undefined') {
            var pfdC = document.getElementById('pfdCanvas');
            if (pfdC) SmartFlowPFDRenderer.init(pfdC, SmartFlowCore, notify);
            console.log('✅ PFD Renderer');
        }
        if (typeof SmartFlowDTIRenderer !== 'undefined') {
            var dtiC = document.getElementById('dtiCanvas');
            if (dtiC) SmartFlowDTIRenderer.init(dtiC, SmartFlowCore, notify);
            console.log('✅ DTI Renderer');
        }
        if (typeof SmartFlowRenderer !== 'undefined' && canvas) {
            SmartFlowRenderer.init(canvas, SmartFlowCore, notify);
            _is2DInitialized = true;
            console.log('✅ ISO Renderer 2D');
        }
        if (typeof SmartFlowRouter !== 'undefined') {
            SmartFlowRouter.init(SmartFlowCore, SmartFlowCatalog, notify, scheduleRender);
            console.log('✅ Router');
        }
        SmartFlowCommands.init(SmartFlowCore, SmartFlowCatalog, SmartFlowRenderer, notify, scheduleRender, voiceFn);
        console.log('✅ Commands');
        if (typeof SmartFlowAssistant !== 'undefined') {
            SmartFlowAssistant.setCore(SmartFlowCore);
            SmartFlowAssistant.setModule(currentModule);
            console.log('✅ Assistant');
        }
        SmartFlowCore.setVoice(voiceEnabled);
        _modulesInitialized = true;
        setTimeout(function() {
            if (voiceEnabled) voiceFn('Bienvenido a EngFlow. Suite de ingeniería inteligente.');
        }, 1000);
        notify('EngFlow v1.0 listo | Isométrico + P&ID + DTI', false);
    }
    
    function setupShortcuts() {
        document.addEventListener('keydown', function(e) {
            if (e.ctrlKey && e.shiftKey) {
                switch(e.key) {
                    case '1': e.preventDefault(); switchModule('ISOMETRIC'); break;
                    case '2': e.preventDefault(); switchModule('PFD'); break;
                    case '3': e.preventDefault(); switchModule('DTI'); break;
                    case 'C': e.preventDefault(); openAssistant(); break;
                    case 'U': e.preventDefault(); SmartFlowCore.undo(); scheduleRender(); break;
                    case 'Y': e.preventDefault(); SmartFlowCore.redo(); scheduleRender(); break;
                    case 'S': e.preventDefault(); if (typeof SmartFlowIO !== 'undefined') SmartFlowIO.downloadJSON(); break;
                    case 'E': e.preventDefault(); if (typeof SmartFlowIO !== 'undefined') SmartFlowIO.downloadPCF(); break;
                    case 'M': e.preventDefault(); if (typeof SmartFlowIO !== 'undefined') SmartFlowIO.downloadMTO(); break;
                    case 'A': e.preventDefault(); if (typeof SmartFlowIntegrity !== 'undefined') SmartFlowIntegrity.validateAll(); break;
                    case 'V': e.preventDefault(); autoCenter(); break;
                }
            }
            if (e.key === 'Escape') {
                if (sidePanel && !sidePanel.classList.contains('hidden')) sidePanel.classList.add('hidden');
                if (typeof SmartFlowAssistantUI !== 'undefined') SmartFlowAssistantUI.closeOverlay();
            }
            if (e.ctrlKey && !e.shiftKey) {
                if (e.key === 'z') { e.preventDefault(); SmartFlowCore.undo(); scheduleRender(); }
                if (e.key === 'y') { e.preventDefault(); SmartFlowCore.redo(); scheduleRender(); }
            }
            if (e.key === 'F11') {
                e.preventDefault();
                document.body.classList.toggle('fullscreen-mode');
                autoCenter();
            }
            if (document.activeElement === cmdInput) {
                if (e.key === 'ArrowUp') { e.preventDefault(); navigateHistory('up'); }
                else if (e.key === 'ArrowDown') { e.preventDefault(); navigateHistory('down'); }
            }
        });
    }
    
    function setupEventListeners() {
        var b = function(id, fn) { var el = document.getElementById(id); if (el) el.addEventListener('click', fn); };
        b('btn-undo', function() { SmartFlowCore.undo(); scheduleRender(); });
        b('btn-redo', function() { SmartFlowCore.redo(); scheduleRender(); });
        b('btn-voice', toggleVoice);
        b('btn-assistant', openAssistant);
        b('btn-fullscreen', function() { document.body.classList.toggle('fullscreen-mode'); autoCenter(); });
        b('btn-toggle-property', function() { if (sidePanel) sidePanel.classList.toggle('hidden'); });
        b('close-property-panel', function() { if (sidePanel) sidePanel.classList.add('hidden'); });
        document.querySelectorAll('.module-switcher button').forEach(function(btn) {
            btn.addEventListener('click', function() { var m = btn.dataset.module; if (m) switchModule(m); });
        });
        b('btn-create-stream', function() { if (typeof SmartFlowAssistantUI !== 'undefined') SmartFlowAssistantUI.startFlow('STREAM.CREATE'); });
        b('btn-link-stream', function() { if (typeof SmartFlowAssistantUI !== 'undefined') SmartFlowAssistantUI.startFlow('STREAM.LINK'); });
        b('btn-balance', function() { if (typeof SmartFlowAssistantUI !== 'undefined') SmartFlowAssistantUI.startFlow('BALANCE.MASA'); });
        b('btn-create-instrument', function() { if (typeof SmartFlowAssistantUI !== 'undefined') SmartFlowAssistantUI.startFlow('INSTRUMENT.CREATE'); });
        b('btn-create-loop', function() { if (typeof SmartFlowAssistantUI !== 'undefined') SmartFlowAssistantUI.startFlow('LOOP.CREATE'); });
        b('btn-refresh-dti', function() { refreshInstrumentList(); notify('Listas actualizadas', false); });
        b('tool-select', function() { setToolMode('select'); });
        b('tool-move', function() { setToolMode('move'); });
        b('tool-edit', function() { setToolMode('edit'); });
        b('tool-add-point', function() { setToolMode('addPoint'); });
        b('elev-0', function() { setElevation(0); });
        b('elev-2500', function() { setElevation(2500); });
        b('elev-5000', function() { setElevation(5000); });
        b('set-elev', function() { var ce = document.getElementById('custom-elev'); if (ce) setElevation(parseInt(ce.value) || 0); });
        b('cmd-run', function() { if (cmdInput && cmdInput.value.trim()) { executeTextCommand(cmdInput.value.trim()); cmdInput.value = ''; cmdInput.focus(); } });
        b('cmd-assistant', openAssistant);
        b('cmd-clear', function() { if (cmdInput) { cmdInput.value = ''; cmdInput.focus(); } });
        if (cmdInput) {
            cmdInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') { e.preventDefault(); if (cmdInput.value.trim()) { executeTextCommand(cmdInput.value.trim()); cmdInput.value = ''; } }
            });
        }
        document.querySelectorAll('.module-card').forEach(function(card) {
            card.addEventListener('click', function() {
                var m = card.dataset.module;
                if (m) { switchModule(m); if (welcomeScreen) welcomeScreen.style.display = 'none'; }
            });
        });
        var rt;
        window.addEventListener('resize', function() {
            clearTimeout(rt);
            rt = setTimeout(function() {
                if (currentModule === 'PFD' && typeof SmartFlowPFDRenderer !== 'undefined') { SmartFlowPFDRenderer.resizeCanvas(); SmartFlowPFDRenderer.render(); }
                else if (currentModule === 'DTI' && typeof SmartFlowDTIRenderer !== 'undefined') { SmartFlowDTIRenderer.resizeCanvas(); SmartFlowDTIRenderer.render(); }
                else if (currentModule === 'ISOMETRIC' && typeof SmartFlowRenderer !== 'undefined') { SmartFlowRenderer.resizeCanvas(); }
            }, 150);
        });
    }
    
    function init() {
        var ss = document.getElementById('splash-status');
        var msgs = ["Inicializando Core...", "Cargando módulos...", "Preparando interfaz...", "¡EngFlow listo!"];
        var mi = 0;
        var iv = setInterval(function() { if (ss && mi < msgs.length) { ss.textContent = msgs[mi]; mi++; } }, 800);
        setTimeout(function() { if (splashScreen) splashScreen.classList.add('splash-hidden'); clearInterval(iv); }, 3500);
        function bootstrap() {
            if (typeof SmartFlowCore === 'undefined' || typeof SmartFlowCommands === 'undefined') { setTimeout(bootstrap, 100); return; }
            initModules();
            setupEventListeners();
            setupShortcuts();
            if (welcomeScreen) welcomeScreen.style.display = 'flex';
            var tb = document.getElementById('app-toolbar');
            if (tb) tb.style.display = 'flex';
            if (commandBar) commandBar.style.display = 'flex';
            setTimeout(function() {
                if (welcomeScreen && welcomeScreen.style.display !== 'none') {
                    setTimeout(function() {
                        if (welcomeScreen && welcomeScreen.style.display !== 'none') { switchModule('ISOMETRIC'); if (welcomeScreen) welcomeScreen.style.display = 'none'; }
                    }, 5000);
                }
            }, 500);
        }
        setTimeout(bootstrap, 500);
    }
    
    window.switchModule = switchModule;
    window.autoCenter = autoCenter;
    window.setElevation = setElevation;
    window.notify = notify;
    window.scheduleRender = scheduleRender;
    window.refreshStreamList = refreshStreamList;
    window.refreshInstrumentList = refreshInstrumentList;
    window.executeTextCommand = executeTextCommand;
    window.openAssistant = openAssistant;
    window.toggleVoice = toggleVoice;
    
    init();
})();
