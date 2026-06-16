
// ============================================================
// ADAPTIVE COMMANDS UI v2.0 - INTEGRADA CON PANEL DE TEXTO
// Archivo: js/adaptiveCommandsUI.js
// ============================================================

(function() {
    'use strict';
    
    // ================================================================
    // 1. ESTADO
    // ================================================================
    
    var _currentModule = 'pfd';
    var _currentFlow = null;
    var _isOpen = false;
    var _commandHistory = [];
    var _assistantContainer = null;
    var _assistantBody = null;
    var _assistantFooter = null;
    var _commandText = null;
    var _isInitialized = false;
    
    // ================================================================
    // 2. INICIALIZACIÓN
    // ================================================================
    
    function init() {
        if (_isInitialized) return;
        _isInitialized = true;
        
        var panel = document.getElementById('commandPanel');
        if (!panel) {
            crearPanelCompleto();
            return;
        }
        
        var assistantContainer = document.createElement('div');
        assistantContainer.id = 'adaptive-assistant-container';
        assistantContainer.className = 'assistant-container';
        assistantContainer.style.cssText = 'border-top:1px solid rgba(0,242,255,0.15);padding-top:10px;margin-top:4px;';
        
        assistantContainer.innerHTML = `
            <div class="assistant-title">
                <span>🧭 ASISTENTE PASO A PASO</span>
                <span class="module-badge">Módulo: <span id="assistant-module-badge">PFD</span></span>
            </div>
            <div class="assistant-module-tabs" id="assistant-tabs">
                <button class="assistant-tab active-pfd" data-module="pfd">📊 PFD</button>
                <button class="assistant-tab" data-module="dti">🔧 DTI</button>
                <button class="assistant-tab" data-module="iso">🧊 ISO</button>
            </div>
            <div class="assistant-body" id="assistant-body">
                <p style="color:#64748b;font-size:11px;text-align:center;padding:15px 0;">Seleccione un comando para comenzar el asistente</p>
            </div>
            <div class="assistant-footer" id="assistant-footer"></div>
        `;
        
        var textarea = document.getElementById('commandText');
        if (textarea) {
            textarea.parentNode.insertBefore(assistantContainer, textarea.nextSibling);
        } else {
            panel.appendChild(assistantContainer);
        }
        
        _assistantContainer = assistantContainer;
        _assistantBody = document.getElementById('assistant-body');
        _assistantFooter = document.getElementById('assistant-footer');
        _commandText = document.getElementById('commandText');
        
        // Tabs
        document.querySelectorAll('#assistant-tabs .assistant-tab').forEach(function(tab) {
            tab.addEventListener('click', function() {
                var module = this.dataset.module;
                setModule(module);
                document.querySelectorAll('#assistant-tabs .assistant-tab').forEach(function(t) {
                    t.className = 'assistant-tab';
                });
                this.classList.add('active-' + module);
            });
        });
        
        setModule('pfd');
        console.log('✅ AdaptiveCommandsUI integrado en el panel de comandos');
    }
    
    // ================================================================
    // 3. CREAR PANEL COMPLETO
    // ================================================================
    
    function crearPanelCompleto() {
        var panel = document.createElement('div');
        panel.id = 'commandPanel';
        panel.className = 'command-panel';
        panel.style.cssText = 'position:fixed;left:50%;bottom:20px;transform:translateX(-50%);width:90%;max-width:620px;max-height:80vh;background:rgba(15,23,42,0.95);border-radius:12px;border:1px solid #00f2ff;z-index:1000;backdrop-filter:blur(10px);padding:12px 16px;display:none;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,0.6);';
        
        panel.innerHTML = `
            <div class="command-header">
                <strong>🤖 COMANDOS SMARTENGP</strong>
                <button class="close-btn" id="closeCommand" aria-label="Cerrar panel de comandos">✖</button>
            </div>
            <div style="margin-bottom:6px;">
                <label style="font-size:9px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.3px;">📝 CONSOLA DE TEXTO</label>
                <textarea id="commandText" class="command-textarea" rows="3" placeholder="Escriba comandos aquí..."></textarea>
                <div id="historyIndicator" class="history-indicator"></div>
                <div class="command-buttons">
                    <button class="btn-run" id="runCommands">▶ Ejecutar</button>
                    <button class="btn-clear" id="clearCommand">🗑️ Limpiar</button>
                    <span style="font-size:9px;color:#64748b;display:flex;align-items:center;margin-left:4px;">⬆⬇ Historial | Ctrl+Enter</span>
                </div>
            </div>
            <div class="assistant-container" id="adaptive-assistant-container">
                <div class="assistant-title">
                    <span>🧭 ASISTENTE PASO A PASO</span>
                    <span class="module-badge">Módulo: <span id="assistant-module-badge">PFD</span></span>
                </div>
                <div class="assistant-module-tabs" id="assistant-tabs">
                    <button class="assistant-tab active-pfd" data-module="pfd">📊 PFD</button>
                    <button class="assistant-tab" data-module="dti">🔧 DTI</button>
                    <button class="assistant-tab" data-module="iso">🧊 ISO</button>
                </div>
                <div class="assistant-body" id="assistant-body">
                    <p style="color:#64748b;font-size:11px;text-align:center;padding:15px 0;">Seleccione un comando para comenzar el asistente</p>
                </div>
                <div class="assistant-footer" id="assistant-footer"></div>
            </div>
        `;
        
        document.body.appendChild(panel);
        
        _assistantContainer = document.getElementById('adaptive-assistant-container');
        _assistantBody = document.getElementById('assistant-body');
        _assistantFooter = document.getElementById('assistant-footer');
        _commandText = document.getElementById('commandText');
        
        document.getElementById('closeCommand').addEventListener('click', function() {
            panel.style.display = 'none';
            _isOpen = false;
        });
        
        document.getElementById('runCommands').addEventListener('click', function() {
            var txt = _commandText.value.trim();
            if (txt) {
                if (typeof SmartFlowCommands !== 'undefined') {
                    SmartFlowCommands.executeCommand(txt);
                }
                _commandText.value = '';
            }
        });
        
        document.getElementById('clearCommand').addEventListener('click', function() {
            if (_commandText) _commandText.value = '';
        });
        
        document.querySelectorAll('#assistant-tabs .assistant-tab').forEach(function(tab) {
            tab.addEventListener('click', function() {
                var module = this.dataset.module;
                setModule(module);
                document.querySelectorAll('#assistant-tabs .assistant-tab').forEach(function(t) {
                    t.className = 'assistant-tab';
                });
                this.classList.add('active-' + module);
            });
        });
        
        if (_commandText) {
            _commandText.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' && e.ctrlKey) {
                    e.preventDefault();
                    var txt = this.value.trim();
                    if (txt) {
                        if (typeof SmartFlowCommands !== 'undefined') {
                            SmartFlowCommands.executeCommand(txt);
                        }
                        this.value = '';
                    }
                }
            });
        }
        
        setModule('pfd');
        console.log('✅ Panel de comandos creado');
    }
    
    // ================================================================
    // 4. SET MODULE
    // ================================================================
    
    function setModule(module) {
        _currentModule = module;
        if (typeof AdaptiveCommandSystem !== 'undefined') {
            AdaptiveCommandSystem.setActiveModule(module);
        }
        var badge = document.getElementById('assistant-module-badge');
        if (badge) {
            var labels = { 'pfd': 'PFD', 'dti': 'DTI', 'iso': 'ISO' };
            badge.textContent = labels[module] || module.toUpperCase();
        }
        renderCommandGrid();
    }
    
    // ================================================================
    // 5. RENDER COMANDOS
    // ================================================================
    
    function renderCommandGrid() {
        if (!_assistantBody) return;
        
        var commands = getModuleCommands(_currentModule);
        if (!commands || commands.length === 0) {
            _assistantBody.innerHTML = '<p style="color:#64748b;font-size:11px;text-align:center;padding:15px 0;">No hay comandos disponibles para este módulo</p>';
            return;
        }
        
        var html = '<div class="assistant-cmd-grid">';
        commands.forEach(function(cmd) {
            html += `
                <div class="assistant-cmd-card" data-command="${cmd.command}" onclick="AdaptiveCommandsUI.startFlow('${cmd.command}')">
                    <span class="cmd-icon">${cmd.icon || '📋'}</span>
                    <span class="cmd-name">${cmd.name}</span>
                </div>
            `;
        });
        html += '</div>';
        _assistantBody.innerHTML = html;
    }
    
    // ================================================================
    // 6. GET MODULE COMMANDS
    // ================================================================
    
    function getModuleCommands(module) {
        if (typeof AdaptiveCommandSystem === 'undefined') return [];
        var commands = AdaptiveCommandSystem.getCommandsForModule(module);
        if (!commands) return [];
        return Object.entries(commands).map(function(entry) {
            var key = entry[0];
            var cmd = entry[1];
            return {
                command: key,
                name: cmd.name || key,
                icon: cmd.icon || '📋',
                category: cmd.category || 'general'
            };
        });
    }
    
    // ================================================================
    // 7. START FLOW
    // ================================================================
    
    function startFlow(commandPath) {
        if (typeof AdaptiveCommandSystem === 'undefined') {
            showToast('Sistema adaptativo no disponible', 'err');
            return;
        }
        var stepData = AdaptiveCommandSystem.startCommandFlow(commandPath);
        if (!stepData) {
            showToast('Comando no disponible', 'err');
            return;
        }
        if (stepData.direct) {
            if (typeof SmartFlowCommands !== 'undefined' && SmartFlowCommands.executeCommand) {
                SmartFlowCommands.executeCommand(stepData.command);
                showToast('✅ ' + stepData.name + ' ejecutado', 'ok');
            }
            return;
        }
        _currentFlow = stepData;
        renderWizard();
    }
    
    // ================================================================
    // 8. RENDER WIZARD
    // ================================================================
    
    function renderWizard() {
        if (!_assistantBody || !_currentFlow) return;
        var stepData = _currentFlow;
        var html = '';
        
        html += '<div style="background:rgba(255,255,255,0.05);border-radius:4px;height:3px;margin-bottom:8px;overflow:hidden;"><div style="background:linear-gradient(90deg,#00f2ff,#1e4eb8);height:100%;width:' + (stepData.progress || 0) + '%;transition:width 0.3s ease;border-radius:4px;"></div></div>';
        html += '<div style="font-size:0.85em;font-weight:600;color:#e0e6ed;margin-bottom:6px;display:flex;align-items:center;gap:6px;">' + (stepData.title || '') + '<span style="font-size:0.6em;color:#64748b;font-weight:400;">' + (stepData.stepIndex !== undefined ? (stepData.stepIndex + 1) + '/' + (stepData.totalSteps || 0) : '') + '</span></div>';
        if (stepData.description) html += '<div style="font-size:0.65em;color:#94a3b8;margin-bottom:6px;">' + stepData.description + '</div>';
        
        switch (stepData.type) {
            case 'select':
            case 'dynamicSelect':
                html += renderSelect(stepData);
                break;
            case 'text':
                html += renderTextInput(stepData);
                break;
            case 'number':
                html += renderNumberInput(stepData);
                break;
            case 'slider':
                html += renderSlider(stepData);
                break;
            case 'coordinate':
                html += renderCoordinate(stepData);
                break;
            case 'coordinateList':
                html += renderCoordinateList(stepData);
                break;
            case 'form':
                html += renderForm(stepData);
                break;
            case 'confirm':
                html += renderConfirm(stepData);
                break;
            case 'info':
                html += renderInfo(stepData);
                break;
            default:
                html += '<p style="color:#94a3b8;font-size:0.8em;">Paso: ' + (stepData.type || 'desconocido') + '</p>';
        }
        
        if (stepData.isFinal && stepData.command) {
            html += '<div style="margin-top:8px;padding:6px 10px;background:rgba(0,0,0,0.3);border-radius:6px;border:1px solid rgba(255,255,255,0.04);"><div style="font-size:0.55em;color:#64748b;margin-bottom:2px;">📝 Comando a ejecutar:</div><code style="color:#00f2ff;font-family:Courier New,monospace;font-size:0.7em;word-break:break-all;display:block;">' + stepData.command + '</code></div>';
        }
        
        _assistantBody.innerHTML = html;
        setupStepEvents(stepData);
        
        var isFinal = stepData.isFinal || false;
        var hasPrev = (stepData.stepIndex || 0) > 0;
        
        if (_assistantFooter) {
            _assistantFooter.style.display = 'flex';
            _assistantFooter.innerHTML = '<div style="display:flex;gap:4px;flex-wrap:wrap;"><button class="assistant-btn" onclick="AdaptiveCommandsUI.goPrev()" ' + (!hasPrev ? 'disabled' : '') + '>← Anterior</button><button class="assistant-btn assistant-btn-danger" onclick="AdaptiveCommandsUI.cancelFlow()">✖ Cancelar</button></div><div>' + (isFinal ? '<button class="assistant-btn assistant-btn-success" onclick="AdaptiveCommandsUI.executeFlow()">✅ Ejecutar</button>' : '<button class="assistant-btn assistant-btn-primary" onclick="AdaptiveCommandsUI.goNext()">Siguiente →</button>') + '</div>';
        }
    }
    
    // ================================================================
    // 9. RENDER TIPOS DE PASOS
    // ================================================================
    
    function renderSelect(stepData) {
        var options = stepData.options || [];
        var html = '<div style="display:flex;flex-direction:column;gap:3px;max-height:160px;overflow-y:auto;">';
        options.forEach(function(opt) {
            html += '<div class="assistant-select-item" data-value="' + opt.value + '" style="display:flex;align-items:center;gap:6px;padding:6px 10px;background:rgba(30,41,59,0.4);border:1px solid rgba(255,255,255,0.04);border-radius:6px;cursor:pointer;transition:all 0.15s;min-height:32px;" onclick="AdaptiveCommandsUI.selectOption(\'' + opt.value + '\', this)">' + (opt.icon ? '<span style="font-size:1em;">' + opt.icon + '</span>' : '') + '<div style="flex:1;min-width:0;"><div style="font-size:0.75em;font-weight:500;color:#e0e6ed;">' + opt.label + '</div>' + (opt.description ? '<div style="font-size:0.6em;color:#64748b;">' + opt.description + '</div>' : '') + '</div>' + (opt.status === 'open' ? '<span style="color:#3fb950;font-size:0.7em;">🟢</span>' : '') + '</div>';
        });
        html += '</div>';
        return html;
    }
    
    function renderTextInput(stepData) {
        return '<div style="margin-bottom:4px;"><input type="text" id="assistant-text-input" placeholder="' + (stepData.placeholder || '') + '" value="' + (stepData.default || '') + '" style="width:100%;padding:6px 10px;background:rgba(15,23,42,0.8);border:1px solid rgba(255,255,255,0.08);border-radius:6px;color:#e0e6ed;font-size:0.8em;outline:none;min-height:32px;"></div>';
    }
    
    function renderNumberInput(stepData) {
        return '<div style="margin-bottom:4px;"><input type="number" id="assistant-number-input" value="' + (stepData.default || 0) + '" min="' + (stepData.min || '') + '" max="' + (stepData.max || '') + '" step="' + (stepData.step || '1') + '" style="width:100%;padding:6px 10px;background:rgba(15,23,42,0.8);border:1px solid rgba(255,255,255,0.08);border-radius:6px;color:#e0e6ed;font-size:0.8em;outline:none;min-height:32px;"></div>';
    }
    
    function renderSlider(stepData) {
        var val = stepData.default || 0.5;
        return '<div style="margin-bottom:4px;"><div style="display:flex;align-items:center;gap:8px;"><input type="range" id="assistant-slider" min="' + (stepData.min || 0) + '" max="' + (stepData.max || 1) + '" step="' + (stepData.step || 0.01) + '" value="' + val + '" style="flex:1;min-height:28px;cursor:pointer;accent-color:#00f2ff;"><span id="assistant-slider-val" style="color:#00f2ff;font-weight:700;font-size:0.8em;min-width:30px;text-align:center;">' + val + '</span></div></div>';
    }
    
    function renderCoordinate(stepData) {
        var def = stepData.default || { x: 0, y: 0, z: 0 };
        return '<div style="margin-bottom:4px;"><div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;"><input type="number" id="coord-x" placeholder="X" value="' + (def.x || 0) + '" step="1" style="padding:4px 6px;background:rgba(15,23,42,0.8);border:1px solid rgba(255,255,255,0.08);border-radius:4px;color:#e0e6ed;font-size:0.75em;text-align:center;min-height:28px;"><input type="number" id="coord-y" placeholder="Y" value="' + (def.y || 0) + '" step="1" style="padding:4px 6px;background:rgba(15,23,42,0.8);border:1px solid rgba(255,255,255,0.08);border-radius:4px;color:#e0e6ed;font-size:0.75em;text-align:center;min-height:28px;"><input type="number" id="coord-z" placeholder="Z" value="' + (def.z || 0) + '" step="1" style="padding:4px 6px;background:rgba(15,23,42,0.8);border:1px solid rgba(255,255,255,0.08);border-radius:4px;color:#e0e6ed;font-size:0.75em;text-align:center;min-height:28px;"></div></div>';
    }
    
    function renderCoordinateList(stepData) {
        var pts = stepData.default || [{ x: 0, y: 0, z: 0 }, { x: 1000, y: 0, z: 0 }];
        var html = '<div style="margin-bottom:4px;"><div style="font-size:0.65em;color:#94a3b8;margin-bottom:4px;">' + (stepData.description || 'Agregue puntos') + ' (mín: ' + (stepData.minPoints || 2) + ')</div><div id="assistant-coord-list">';
        pts.forEach(function(p, i) {
            html += '<div class="assistant-coord-row" style="display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:4px;margin-bottom:4px;"><input type="number" placeholder="X" value="' + (p.x || 0) + '" step="1" data-axis="x" style="padding:3px 4px;background:rgba(15,23,42,0.8);border:1px solid rgba(255,255,255,0.08);border-radius:4px;color:#e0e6ed;font-size:0.7em;text-align:center;min-height:26px;"><input type="number" placeholder="Y" value="' + (p.y || 0) + '" step="1" data-axis="y" style="padding:3px 4px;background:rgba(15,23,42,0.8);border:1px solid rgba(255,255,255,0.08);border-radius:4px;color:#e0e6ed;font-size:0.7em;text-align:center;min-height:26px;"><input type="number" placeholder="Z" value="' + (p.z || 0) + '" step="1" data-axis="z" style="padding:3px 4px;background:rgba(15,23,42,0.8);border:1px solid rgba(255,255,255,0.08);border-radius:4px;color:#e0e6ed;font-size:0.7em;text-align:center;min-height:26px;"><button onclick="this.parentElement.remove()" style="padding:2px 6px;border-radius:4px;border:1px solid rgba(255,255,255,0.08);background:transparent;color:#64748b;font-size:0.7em;cursor:pointer;min-height:26px;">✕</button></div>';
        });
        html += '</div><button onclick="AdaptiveCommandsUI.addCoordRow()" style="width:100%;padding:3px;border-radius:4px;border:1px dashed rgba(255,255,255,0.1);background:transparent;color:#64748b;font-size:0.65em;cursor:pointer;min-height:26px;">+ Agregar Punto</button></div>';
        return html;
    }
    
    function renderForm(stepData) {
        var fields = stepData.fields || [];
        var html = '';
        fields.forEach(function(field) {
            html += '<div style="margin-bottom:4px;">';
            if (field.type === 'checkbox') {
                html += '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:0.75em;color:#e0e6ed;"><input type="checkbox" id="field-' + field.id + '" data-field="' + field.id + '" ' + (field.default ? 'checked' : '') + ' style="accent-color:#00f2ff;width:16px;height:16px;cursor:pointer;"> ' + field.label + '</label>';
            } else {
                html += '<label style="display:block;font-size:0.6em;color:#94a3b8;margin-bottom:2px;">' + field.label + '</label>';
                if (field.type === 'select') {
                    html += '<select id="field-' + field.id + '" data-field="' + field.id + '" style="width:100%;padding:4px 8px;background:rgba(15,23,42,0.8);border:1px solid rgba(255,255,255,0.08);border-radius:4px;color:#e0e6ed;font-size:0.75em;min-height:28px;">';
                    var opts = typeof field.options === 'function' ? field.options() : (field.options || []);
                    opts.forEach(function(opt) {
                        var val = typeof opt === 'object' ? opt.value : opt;
                        var lbl = typeof opt === 'object' ? (opt.label || opt.value) : opt;
                        html += '<option value="' + val + '">' + lbl + '</option>';
                    });
                    html += '</select>';
                } else {
                    html += '<input type="' + field.type + '" id="field-' + field.id + '" data-field="' + field.id + '" value="' + (field.default || '') + '" placeholder="' + (field.placeholder || '') + '" min="' + (field.min || '') + '" max="' + (field.max || '') + '" step="' + (field.step || '') + '" style="width:100%;padding:4px 8px;background:rgba(15,23,42,0.8);border:1px solid rgba(255,255,255,0.08);border-radius:4px;color:#e0e6ed;font-size:0.75em;min-height:28px;">';
                }
            }
            html += '</div>';
        });
        return html;
    }
    
    function renderConfirm(stepData) {
        return '<div style="text-align:center;padding:12px;background:rgba(248,81,73,0.06);border:1px solid rgba(248,81,73,0.15);border-radius:6px;color:#fca5a5;font-size:0.75em;line-height:1.5;white-space:pre-line;text-align:left;">' + (stepData.message || '¿Confirmar esta acción?') + '</div>';
    }
    
    function renderInfo(stepData) {
        return '<div style="text-align:center;padding:12px;background:rgba(0,242,255,0.04);border-radius:6px;border:1px solid rgba(0,242,255,0.08);color:#00f2ff;font-size:0.8em;line-height:1.5;white-space:pre-line;">' + (stepData.message || '') + '</div>';
    }
    
    // ================================================================
    // 10. EVENTOS DE PASOS
    // ================================================================
    
    function setupStepEvents(stepData) {
        var textInput = document.getElementById('assistant-text-input');
        if (textInput) {
            textInput.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    var value = this.value.trim();
                    if (stepData.validate) {
                        var error = stepData.validate(value);
                        if (error) {
                            showToast(error, 'err');
                            return;
                        }
                    }
                    goNextWithValue(value);
                }
            });
        }
        
        var numInput = document.getElementById('assistant-number-input');
        if (numInput) {
            numInput.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    var value = parseFloat(this.value);
                    if (isNaN(value)) {
                        showToast('Ingrese un número válido', 'err');
                        return;
                    }
                    goNextWithValue(value);
                }
            });
        }
        
        var slider = document.getElementById('assistant-slider');
        if (slider) {
            var valDisplay = document.getElementById('assistant-slider-val');
            slider.addEventListener('input', function() {
                if (valDisplay) valDisplay.textContent = this.value;
            });
            slider.addEventListener('change', function() {
                goNextWithValue(parseFloat(this.value));
            });
        }
        
        var coordInputs = document.querySelectorAll('#coord-x, #coord-y, #coord-z');
        if (coordInputs.length === 3) {
            coordInputs.forEach(function(input) {
                input.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter') {
                        var x = parseFloat(document.getElementById('coord-x').value) || 0;
                        var y = parseFloat(document.getElementById('coord-y').value) || 0;
                        var z = parseFloat(document.getElementById('coord-z').value) || 0;
                        goNextWithValue({ x: x, y: y, z: z });
                    }
                });
            });
        }
    }
    
    // ================================================================
    // 11. NAVEGACIÓN
    // ================================================================
    
    function selectOption(value, element) {
        if (!element) return;
        var parent = element.parentElement;
        if (parent) {
            parent.querySelectorAll('.assistant-select-item').forEach(function(el) {
                el.style.borderColor = 'rgba(255,255,255,0.04)';
                el.style.background = 'rgba(30,41,59,0.4)';
            });
        }
        element.style.borderColor = '#00f2ff';
        element.style.background = 'rgba(0,242,255,0.08)';
        goNextWithValue(value);
    }
    
    function addCoordRow() {
        var container = document.getElementById('assistant-coord-list');
        if (!container) return;
        var row = document.createElement('div');
        row.className = 'assistant-coord-row';
        row.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:4px;margin-bottom:4px;';
        row.innerHTML = '<input type="number" placeholder="X" value="0" step="1" data-axis="x" style="padding:3px 4px;background:rgba(15,23,42,0.8);border:1px solid rgba(255,255,255,0.08);border-radius:4px;color:#e0e6ed;font-size:0.7em;text-align:center;min-height:26px;"><input type="number" placeholder="Y" value="0" step="1" data-axis="y" style="padding:3px 4px;background:rgba(15,23,42,0.8);border:1px solid rgba(255,255,255,0.08);border-radius:4px;color:#e0e6ed;font-size:0.7em;text-align:center;min-height:26px;"><input type="number" placeholder="Z" value="0" step="1" data-axis="z" style="padding:3px 4px;background:rgba(15,23,42,0.8);border:1px solid rgba(255,255,255,0.08);border-radius:4px;color:#e0e6ed;font-size:0.7em;text-align:center;min-height:26px;"><button onclick="this.parentElement.remove()" style="padding:2px 6px;border-radius:4px;border:1px solid rgba(255,255,255,0.08);background:transparent;color:#64748b;font-size:0.7em;cursor:pointer;min-height:26px;">✕</button>';
        container.appendChild(row);
    }
    
    function goNext() {
        if (!_currentFlow) return;
        var stepData = _currentFlow;
        var value = null;
        
        switch (stepData.type) {
            case 'select':
            case 'dynamicSelect': {
                var selected = document.querySelector('.assistant-select-item[style*="border-color:#00f2ff"]');
                if (selected) value = selected.dataset.value;
                break;
            }
            case 'text': {
                var input = document.getElementById('assistant-text-input');
                if (input) value = input.value.trim();
                break;
            }
            case 'number': {
                var input = document.getElementById('assistant-number-input');
                if (input) value = parseFloat(input.value) || 0;
                break;
            }
            case 'slider': {
                var slider = document.getElementById('assistant-slider');
                if (slider) value = parseFloat(slider.value);
                break;
            }
            case 'coordinate': {
                var x = parseFloat(document.getElementById('coord-x')?.value) || 0;
                var y = parseFloat(document.getElementById('coord-y')?.value) || 0;
                var z = parseFloat(document.getElementById('coord-z')?.value) || 0;
                value = { x: x, y: y, z: z };
                break;
            }
            case 'coordinateList': {
                var points = [];
                document.querySelectorAll('#assistant-coord-list .assistant-coord-row').forEach(function(row) {
                    var x = parseFloat(row.querySelector('[data-axis="x"]')?.value) || 0;
                    var y = parseFloat(row.querySelector('[data-axis="y"]')?.value) || 0;
                    var z = parseFloat(row.querySelector('[data-axis="z"]')?.value) || 0;
                    points.push({ x: x, y: y, z: z });
                });
                var minPoints = stepData.minPoints || 2;
                if (points.length < minPoints) {
                    showToast('Agregue al menos ' + minPoints + ' puntos', 'err');
                    return;
                }
                value = points;
                break;
            }
            case 'form': {
                value = {};
                document.querySelectorAll('[data-field]').forEach(function(input) {
                    var field = input.dataset.field;
                    if (input.type === 'checkbox') {
                        value[field] = input.checked;
                    } else if (input.type === 'number') {
                        value[field] = parseFloat(input.value) || 0;
                    } else {
                        value[field] = input.value;
                    }
                });
                break;
            }
            case 'confirm':
            case 'info': {
                value = true;
                break;
            }
            default: {
                showToast('Paso no soportado', 'err');
                return;
            }
        }
        
        if (value === null || value === undefined || value === '') {
            showToast('Seleccione o ingrese un valor', 'err');
            return;
        }
        if (stepData.validate && typeof stepData.validate === 'function') {
            var error = stepData.validate(value);
            if (error) {
                showToast(error, 'err');
                return;
            }
        }
        goNextWithValue(value);
    }
    
    function goNextWithValue(value) {
        if (typeof AdaptiveCommandSystem.nextStep === 'function') {
            var nextData = AdaptiveCommandSystem.nextStep(value);
            handleNextStep(nextData);
        }
    }
    
    function goPrev() {
        if (typeof AdaptiveCommandSystem.previousStep === 'function') {
            var prevData = AdaptiveCommandSystem.previousStep();
            if (prevData) {
                _currentFlow = prevData;
                renderWizard();
            } else {
                _currentFlow = null;
                renderCommandGrid();
                if (_assistantFooter) _assistantFooter.style.display = 'none';
            }
        }
    }
    
    function handleNextStep(nextData) {
        if (!nextData) {
            _currentFlow = null;
            renderCommandGrid();
            if (_assistantFooter) _assistantFooter.style.display = 'none';
            return;
        }
        if (nextData.finished) {
            if (nextData.executeImmediately && nextData.command) {
                if (typeof SmartFlowCommands !== 'undefined' && SmartFlowCommands.executeCommand) {
                    SmartFlowCommands.executeCommand(nextData.command);
                    showToast('✅ Comando ejecutado', 'ok');
                }
                _currentFlow = null;
                AdaptiveCommandSystem.resetFlow();
                renderCommandGrid();
                if (_assistantFooter) _assistantFooter.style.display = 'none';
                return;
            } else if (nextData.command) {
                _currentFlow = {
                    type: 'confirm',
                    title: 'Confirmar ejecución',
                    isFinal: true,
                    command: nextData.command,
                    progress: 100
                };
                renderWizard();
                return;
            }
            _currentFlow = null;
            renderCommandGrid();
            if (_assistantFooter) _assistantFooter.style.display = 'none';
            return;
        }
        _currentFlow = nextData;
        renderWizard();
    }
    
    function cancelFlow() {
        _currentFlow = null;
        AdaptiveCommandSystem.resetFlow();
        renderCommandGrid();
        if (_assistantFooter) _assistantFooter.style.display = 'none';
    }
    
    function executeFlow() {
        if (_currentFlow && _currentFlow.command) {
            if (typeof SmartFlowCommands !== 'undefined' && SmartFlowCommands.executeCommand) {
                SmartFlowCommands.executeCommand(_currentFlow.command);
                showToast('✅ Comando ejecutado', 'ok');
            }
            _currentFlow = null;
            AdaptiveCommandSystem.resetFlow();
            renderCommandGrid();
            if (_assistantFooter) _assistantFooter.style.display = 'none';
        } else {
            showToast('❌ No se pudo ejecutar el comando', 'err');
        }
    }
    
    // ================================================================
    // 12. TOAST
    // ================================================================
    
    function showToast(msg, type) {
        var existing = document.querySelector('.adaptive-toast');
        if (existing) existing.remove();
        var toast = document.createElement('div');
        toast.className = 'adaptive-toast ' + (type || 'info');
        toast.textContent = msg;
        document.body.appendChild(toast);
        setTimeout(function() { toast.remove(); }, 2500);
    }
    
    // ================================================================
    // 13. OPEN / CLOSE / TOGGLE
    // ================================================================
    
    function open(module) {
        _currentModule = module || 'pfd';
        _isOpen = true;
        var panel = document.getElementById('commandPanel');
        if (panel) {
            panel.style.display = 'block';
        } else {
            crearPanelCompleto();
            panel = document.getElementById('commandPanel');
            if (panel) panel.style.display = 'block';
        }
        setModule(_currentModule);
        if (_commandText) {
            setTimeout(function() { _commandText.focus(); }, 200);
        }
    }
    
    function close() {
        _isOpen = false;
        var panel = document.getElementById('commandPanel');
        if (panel) panel.style.display = 'none';
        _currentFlow = null;
        AdaptiveCommandSystem.resetFlow();
    }
    
    function toggle() {
        if (_isOpen) {
            close();
        } else {
            open(window.currentModule || 'pfd');
        }
    }
    
    // ================================================================
    // 14. API PÚBLICA - USANDO UNA VARIABLE ÚNICA
    // ================================================================
    
    // Solo una declaración de AdaptiveCommandsUI
    var API = {
        init: init,
        open: open,
        close: close,
        toggle: toggle,
        setModule: setModule,
        getModule: function() { return _currentModule; },
        isOpen: function() { return _isOpen; },
        startFlow: startFlow,
        selectOption: selectOption,
        addCoordRow: addCoordRow,
        goNext: goNext,
        goPrev: goPrev,
        cancelFlow: cancelFlow,
        executeFlow: executeFlow,
        showToast: showToast,
        renderCommandGrid: renderCommandGrid
    };
    
    // Exponer globalmente SOLO UNA VEZ
    if (typeof window !== 'undefined' && !window.AdaptiveCommandsUI) {
        window.AdaptiveCommandsUI = API;
    }
    
    console.log('✅ AdaptiveCommandsUI v2.0 cargado');
    
})();
