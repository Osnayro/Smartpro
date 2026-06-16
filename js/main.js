

// ============================================================
// ADAPTIVE COMMANDS UI v2.0 - INTEGRADA CON PANEL DE TEXTO
// Archivo: js/adaptiveCommandsUI.js
// 
// CARACTERÍSTICAS:
//   - Se integra en el panel de comandos existente
//   - No reemplaza, se suma al modo texto
//   - Persiste hasta que el usuario cierre el panel
// ============================================================

const AdaptiveCommandsUI = (function() {
    
    // ================================================================
    // 1. ESTADO
    // ================================================================
    
    let _currentModule = 'pfd';
    let _currentFlow = null;
    let _isOpen = false;
    let _commandHistory = [];
    let _isTextMode = false;
    let _panelContainer = null;
    let _isInitialized = false;
    
    // Referencias al DOM
    let _assistantContainer = null;
    let _assistantBody = null;
    let _assistantFooter = null;
    let _commandText = null;
    let _consoleOutput = null;
    
    // ================================================================
    // 2. INICIALIZACIÓN - INTEGRAR EN EL PANEL EXISTENTE
    // ================================================================
    
    function init() {
        if (_isInitialized) return;
        _isInitialized = true;
        
        // Buscar el panel de comandos existente
        var panel = document.getElementById('commandPanel');
        if (!panel) {
            console.warn('⚠️ Panel de comandos no encontrado. Creando uno nuevo...');
            crearPanelCompleto();
            return;
        }
        
        // ============================================================
        // REESTRUCTURAR EL PANEL EXISTENTE
        // ============================================================
        
        // 1. Obtener elementos existentes
        var header = panel.querySelector('.command-header');
        var textarea = document.getElementById('commandText');
        var historyIndicator = document.getElementById('historyIndicator');
        var commandButtons = panel.querySelector('.command-buttons');
        var closeBtn = document.getElementById('closeCommand');
        
        // 2. Crear contenedor para el asistente
        var assistantContainer = document.createElement('div');
        assistantContainer.id = 'adaptive-assistant-container';
        assistantContainer.className = 'adaptive-assistant-container';
        assistantContainer.style.cssText = `
            margin-top: 12px;
            border-top: 1px solid rgba(0, 242, 255, 0.15);
            padding-top: 12px;
            display: none;
        `;
        
        // 3. Título del asistente
        var assistantTitle = document.createElement('div');
        assistantTitle.className = 'adaptive-assistant-title';
        assistantTitle.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
            color: var(--accent-cyan, #00f2ff);
            font-weight: 700;
            font-size: 13px;
            letter-spacing: 0.5px;
        `;
        assistantTitle.innerHTML = `
            <span>🧭 ASISTENTE PASO A PASO</span>
            <span style="font-size:10px;color:#64748b;font-weight:400;">
                Módulo: <span id="assistant-module-badge">PFD</span>
            </span>
        `;
        
        // 4. Tabs de módulo para el asistente
        var moduleTabs = document.createElement('div');
        moduleTabs.className = 'assistant-module-tabs';
        moduleTabs.style.cssText = `
            display: flex;
            gap: 4px;
            margin-bottom: 10px;
            flex-wrap: wrap;
        `;
        moduleTabs.innerHTML = `
            <button class="assistant-tab active" data-module="pfd" style="padding:4px 12px;border-radius:12px;border:1px solid rgba(255,255,255,0.1);background:rgba(16,185,129,0.15);color:#10b981;font-size:11px;font-weight:600;cursor:pointer;transition:all 0.2s;">📊 PFD</button>
            <button class="assistant-tab" data-module="dti" style="padding:4px 12px;border-radius:12px;border:1px solid rgba(255,255,255,0.06);background:transparent;color:#94a3b8;font-size:11px;font-weight:600;cursor:pointer;transition:all 0.2s;">🔧 DTI</button>
            <button class="assistant-tab" data-module="iso" style="padding:4px 12px;border-radius:12px;border:1px solid rgba(255,255,255,0.06);background:transparent;color:#94a3b8;font-size:11px;font-weight:600;cursor:pointer;transition:all 0.2s;">🧊 ISO</button>
            <span style="flex:1;text-align:right;font-size:9px;color:#64748b;">
                💡 Haz clic en un comando para iniciar el asistente
            </span>
        `;
        
        // 5. Contenido del asistente
        var assistantBody = document.createElement('div');
        assistantBody.id = 'assistant-body';
        assistantBody.className = 'assistant-body';
        assistantBody.style.cssText = `
            max-height: 300px;
            overflow-y: auto;
            padding: 4px 0;
            -webkit-overflow-scrolling: touch;
        `;
        assistantBody.innerHTML = '<p style="color:#64748b;font-size:12px;text-align:center;padding:20px 0;">Seleccione un comando para comenzar el asistente</p>';
        
        // 6. Footer del asistente
        var assistantFooter = document.createElement('div');
        assistantFooter.id = 'assistant-footer';
        assistantFooter.className = 'assistant-footer';
        assistantFooter.style.cssText = `
            display: none;
            justify-content: space-between;
            gap: 6px;
            flex-wrap: wrap;
            margin-top: 8px;
            padding-top: 8px;
            border-top: 1px solid rgba(255,255,255,0.06);
        `;
        
        // 7. Ensamblar
        assistantContainer.appendChild(assistantTitle);
        assistantContainer.appendChild(moduleTabs);
        assistantContainer.appendChild(assistantBody);
        assistantContainer.appendChild(assistantFooter);
        
        // 8. Insertar después de los botones de comandos
        if (commandButtons) {
            commandButtons.parentNode.insertBefore(assistantContainer, commandButtons.nextSibling);
        } else if (textarea) {
            textarea.parentNode.insertBefore(assistantContainer, textarea.nextSibling);
        } else {
            panel.appendChild(assistantContainer);
        }
        
        // 9. Guardar referencias
        _assistantContainer = assistantContainer;
        _assistantBody = assistantBody;
        _assistantFooter = assistantFooter;
        _commandText = textarea;
        
        // 10. Conectar eventos de tabs
        moduleTabs.querySelectorAll('.assistant-tab').forEach(function(tab) {
            tab.addEventListener('click', function() {
                var module = this.dataset.module;
                setModule(module);
                // Actualizar tabs visualmente
                moduleTabs.querySelectorAll('.assistant-tab').forEach(function(t) {
                    t.classList.remove('active');
                    t.style.background = 'transparent';
                    t.style.color = '#94a3b8';
                    t.style.borderColor = 'rgba(255,255,255,0.06)';
                });
                this.classList.add('active');
                this.style.background = module === 'pfd' ? 'rgba(16,185,129,0.15)' : 
                                       module === 'dti' ? 'rgba(139,92,246,0.15)' : 
                                       'rgba(0,242,255,0.15)';
                this.style.color = module === 'pfd' ? '#10b981' : 
                                  module === 'dti' ? '#8b5cf6' : 
                                  '#00f2ff';
                this.style.borderColor = module === 'pfd' ? '#10b981' : 
                                        module === 'dti' ? '#8b5cf6' : 
                                        '#00f2ff';
            });
        });
        
        // 11. Conectar el botón de cerrar
        if (closeBtn) {
            // Ya existe, mantener su funcionalidad original
            console.log('✅ Panel de comandos integrado con asistente');
        }
        
        // 12. Inicializar el módulo actual
        setModule('pfd');
        
        // 13. Mostrar el asistente por defecto
        if (_assistantContainer) {
            _assistantContainer.style.display = 'block';
        }
        
        console.log('✅ AdaptiveCommandsUI integrado en el panel de comandos');
        console.log('   📝 Arriba: Consola de texto');
        console.log('   🧭 Abajo: Asistente paso a paso');
    }
    
    // ================================================================
    // 3. CREAR PANEL COMPLETO (SI NO EXISTE)
    // ================================================================
    
    function crearPanelCompleto() {
        // Crear panel si no existe
        var panel = document.createElement('div');
        panel.id = 'commandPanel';
        panel.className = 'command-panel';
        panel.style.cssText = `
            position: fixed;
            left: 50%;
            bottom: 20px;
            transform: translateX(-50%);
            width: 90%;
            max-width: 620px;
            max-height: 80vh;
            background: rgba(15, 23, 42, 0.95);
            border-radius: 12px;
            border: 1px solid var(--accent-cyan, #00f2ff);
            z-index: 1000;
            backdrop-filter: blur(10px);
            padding: 12px 16px;
            display: none;
            overflow-y: auto;
        `;
        
        panel.innerHTML = `
            <div class="command-header" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;color:var(--accent-cyan,#00f2ff);">
                <strong>🤖 COMANDOS SMARTENGP</strong>
                <button id="closeCommand" style="background:none;border:none;color:#fff;font-size:20px;padding:0 8px;cursor:pointer;">✖</button>
            </div>
            <div style="margin-bottom:8px;">
                <label style="font-size:10px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">📝 CONSOLA DE TEXTO</label>
                <textarea id="commandText" rows="3" style="width:100%;margin:4px 0;background:#0f0f17;color:#eee;border:1px solid #3a3a4a;border-radius:8px;padding:8px 10px;font-family:'Courier New',monospace;font-size:12px;resize:vertical;" placeholder="Escriba comandos aquí..."></textarea>
                <div id="historyIndicator" style="font-size:9px;color:#64748b;text-align:right;min-height:16px;"></div>
                <div class="command-buttons" style="display:flex;gap:6px;flex-wrap:wrap;">
                    <button id="runCommands" style="background:var(--accent-blue,#1e4eb8);border:none;color:#fff;padding:4px 14px;border-radius:4px;font-size:11px;font-weight:600;cursor:pointer;">▶ Ejecutar</button>
                    <button id="clearCommand" style="background:#334155;border:none;color:#fff;padding:4px 14px;border-radius:4px;font-size:11px;font-weight:600;cursor:pointer;">🗑️ Limpiar</button>
                    <span style="font-size:9px;color:#64748b;display:flex;align-items:center;margin-left:4px;">⬆⬇ Historial | Ctrl+Enter</span>
                </div>
            </div>
            <div id="adaptive-assistant-container" style="border-top:1px solid rgba(0,242,255,0.15);padding-top:10px;margin-top:4px;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;color:var(--accent-cyan,#00f2ff);font-weight:700;font-size:12px;letter-spacing:0.3px;">
                    <span>🧭 ASISTENTE PASO A PASO</span>
                    <span style="font-size:9px;color:#64748b;font-weight:400;">Módulo: <span id="assistant-module-badge">PFD</span></span>
                </div>
                <div class="assistant-module-tabs" style="display:flex;gap:4px;margin-bottom:8px;flex-wrap:wrap;">
                    <button class="assistant-tab active" data-module="pfd" style="padding:3px 12px;border-radius:12px;border:1px solid rgba(16,185,129,0.3);background:rgba(16,185,129,0.12);color:#10b981;font-size:10px;font-weight:600;cursor:pointer;">📊 PFD</button>
                    <button class="assistant-tab" data-module="dti" style="padding:3px 12px;border-radius:12px;border:1px solid rgba(255,255,255,0.06);background:transparent;color:#94a3b8;font-size:10px;font-weight:600;cursor:pointer;">🔧 DTI</button>
                    <button class="assistant-tab" data-module="iso" style="padding:3px 12px;border-radius:12px;border:1px solid rgba(255,255,255,0.06);background:transparent;color:#94a3b8;font-size:10px;font-weight:600;cursor:pointer;">🧊 ISO</button>
                </div>
                <div id="assistant-body" style="max-height:250px;overflow-y:auto;padding:4px 0;-webkit-overflow-scrolling:touch;">
                    <p style="color:#64748b;font-size:11px;text-align:center;padding:15px 0;">Seleccione un comando para comenzar el asistente</p>
                </div>
                <div id="assistant-footer" style="display:none;justify-content:space-between;gap:6px;flex-wrap:wrap;margin-top:6px;padding-top:6px;border-top:1px solid rgba(255,255,255,0.06);"></div>
            </div>
        `;
        
        document.body.appendChild(panel);
        
        // Guardar referencias
        _assistantContainer = document.getElementById('adaptive-assistant-container');
        _assistantBody = document.getElementById('assistant-body');
        _assistantFooter = document.getElementById('assistant-footer');
        _commandText = document.getElementById('commandText');
        
        // Conectar eventos
        document.getElementById('closeCommand').addEventListener('click', function() {
            if (panel) panel.style.display = 'none';
            _isOpen = false;
        });
        
        document.getElementById('runCommands').addEventListener('click', ejecutarComandoTexto);
        document.getElementById('clearCommand').addEventListener('click', function() {
            if (_commandText) _commandText.value = '';
            var consoleEl = document.getElementById('console-output');
            if (consoleEl) consoleEl.innerHTML = '';
        });
        
        if (_commandText) {
            _commandText.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' && e.ctrlKey) {
                    e.preventDefault();
                    ejecutarComandoTexto();
                }
            });
        }
        
        // Tabs de módulo
        document.querySelectorAll('.assistant-tab').forEach(function(tab) {
            tab.addEventListener('click', function() {
                var module = this.dataset.module;
                setModule(module);
                document.querySelectorAll('.assistant-tab').forEach(function(t) {
                    t.classList.remove('active');
                    t.style.background = 'transparent';
                    t.style.color = '#94a3b8';
                    t.style.borderColor = 'rgba(255,255,255,0.06)';
                });
                this.classList.add('active');
                this.style.background = module === 'pfd' ? 'rgba(16,185,129,0.15)' : 
                                       module === 'dti' ? 'rgba(139,92,246,0.15)' : 
                                       'rgba(0,242,255,0.15)';
                this.style.color = module === 'pfd' ? '#10b981' : 
                                  module === 'dti' ? '#8b5cf6' : 
                                  '#00f2ff';
                this.style.borderColor = module === 'pfd' ? '#10b981' : 
                                        module === 'dti' ? '#8b5cf6' : 
                                        '#00f2ff';
            });
        });
        
        setModule('pfd');
        if (_assistantContainer) _assistantContainer.style.display = 'block';
        
        console.log('✅ Panel de comandos creado con modo texto + asistente');
    }
    
    // ================================================================
    // 4. EJECUCIÓN DE COMANDOS DESDE EL PANEL DE TEXTO
    // ================================================================
    
    function ejecutarComandoTexto() {
        if (!_commandText) return;
        var txt = _commandText.value.trim();
        if (!txt) return;
        
        var lineas = txt.split('\n').filter(function(l) { return l.trim(); });
        var ok = lineas.length === 1 ? 
            SmartFlowCommands.executeCommand(lineas[0]) !== false : 
            SmartFlowCommands.executeBatch(lineas.join('\n')) > 0;
        
        if (ok) {
            // Agregar al historial
            var historyIndicator = document.getElementById('historyIndicator');
            if (historyIndicator) {
                var count = parseInt(historyIndicator.textContent.match(/\d+/) || 0) + 1;
                historyIndicator.textContent = '⏺ Historial: ' + count + ' comandos';
            }
        }
        
        // No limpiar el texto para permitir múltiples comandos
        // Solo limpiar si se ejecutó correctamente
        if (ok) {
            // Opcional: mantener el texto para edición
        }
        
        scheduleRender();
    }
    
    function scheduleRender() {
        var m = window.currentModule || 'pfd';
        if (m === 'pfd' && typeof SmartFlowPFDRenderer !== 'undefined') SmartFlowPFDRenderer.render();
        else if (m === 'dti' && typeof SmartFlowDTIRenderer !== 'undefined') SmartFlowDTIRenderer.render();
        else if (m === 'iso' && window.SmartFlowRenderer) window.SmartFlowRenderer.render();
    }
    
    // ================================================================
    // 5. FUNCIONES DE UTILIDAD
    // ================================================================
    
    function getEquiposList() {
        if (typeof SmartFlowCore === 'undefined') return [];
        var equipos = SmartFlowCore.getEquipos();
        if (!equipos || equipos.length === 0) return [];
        return equipos.map(function(eq) {
            return {
                value: eq.tag,
                label: eq.tag + ' (' + (eq.tipo || '?') + ')',
                icon: getEquipmentIcon(eq.tipo),
                description: (eq.tipo || 'Equipo') + (eq.material ? ' | ' + eq.material : '')
            };
        });
    }
    
    function getLineasList() {
        if (typeof SmartFlowCore === 'undefined') return [];
        var lines = SmartFlowCore.getLines();
        if (!lines || lines.length === 0) return [];
        return lines.map(function(line) {
            return {
                value: line.tag,
                label: line.tag + ' ⌀' + (line.diameter || '?') + '" ' + (line.material || ''),
                icon: '📏',
                description: (line.diameter || '?') + '" | ' + (line.material || 'STD')
            };
        });
    }
    
    function getPuertosLibres(equipoTag) {
        if (typeof SmartFlowCore === 'undefined') return [];
        var eq = SmartFlowCore.findObjectByTag(equipoTag);
        if (!eq || !eq.puertos) return [];
        return eq.puertos
            .filter(function(p) { return p.status === 'open' || !p.connectedTo; })
            .map(function(p) {
                return {
                    value: p.id,
                    label: p.id + ' ⌀' + (p.diametro || '?') + '" 🟢',
                    icon: '🟢',
                    description: '⌀' + (p.diametro || '?') + '" | Disponible',
                    status: 'open'
                };
            });
    }
    
    function getPuertosTodos(equipoTag) {
        if (typeof SmartFlowCore === 'undefined') return [];
        var eq = SmartFlowCore.findObjectByTag(equipoTag);
        if (!eq || !eq.puertos) return [];
        return eq.puertos.map(function(p) {
            var isFree = p.status === 'open' || !p.connectedTo;
            return {
                value: p.id,
                label: p.id + (p.diametro ? ' ⌀' + p.diametro + '"' : '') + (isFree ? ' 🟢' : ' 🔴'),
                icon: isFree ? '🟢' : '🔴',
                description: isFree ? '🟢 Disponible' : '🔴 Conectado'
            };
        });
    }
    
    function getPosicionesLinea() {
        return [
            { value: '0', label: '0 (Inicio)', icon: '🔵' },
            { value: '0.25', label: '0.25', icon: '🔵' },
            { value: '0.5', label: '0.5 (Centro)', icon: '🔵' },
            { value: '0.75', label: '0.75', icon: '🔵' },
            { value: '1', label: '1 (Final)', icon: '🔵' }
        ];
    }
    
    function getEquipmentIcon(tipo) {
        var icons = {
            'tanque_v': '🛢️', 'tanque_h': '🛢️', 'bomba': '⚡', 'bomba_z': '⚡',
            'intercambiador': '🔥', 'torre': '🗼', 'reactor': '⚗️',
            'compresor': '💨', 'separador': '🔀', 'caldera': '🔥',
            'plataforma': '🏗️', 'antorcha': '🔥', 'filtro_arena': '🔍',
            'osmosis': '💧', 'clarificador': '💧', 'desgasificador': '💨',
            'suavizador': '🧪', 'reactor_encamisado': '⚗️', 'autoclave': '🧪',
            'centrifuga': '🔄', 'agitador': '🔄', 'filtro_prensa': '🔍',
            'evaporador': '🌡️', 'cristalizador': '💎', 'secador_rotativo': '🌀',
            'absorbedor': '🧪', 'stripper': '🧪', 'pasteurizador': '🌡️',
            'homogeneizador': '🔄', 'tanque_acero': '🛢️', 'llenadora': '📦'
        };
        return icons[tipo] || '📦';
    }
    
    function getMaterialOptions() {
        return [
            { value: 'PPR', label: 'PPR' },
            { value: 'HDPE', label: 'HDPE' },
            { value: 'ACERO_AL_CARBONO', label: 'Acero al Carbono' },
            { value: 'ACERO_INOXIDABLE', label: 'Acero Inoxidable' },
            { value: 'PVC', label: 'PVC' },
            { value: 'CPVC', label: 'CPVC' }
        ];
    }
    
    function pipeDiameters() {
        return ['2', '3', '4', '6', '8', '10', '12', '16', '20', '24'].map(function(d) {
            return { value: d, label: d + '"' };
        });
    }
    
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
                category: cmd.category || 'general',
                description: cmd.description || ''
            };
        });
    }
    
    // ================================================================
    // 6. SET MODULE
    // ================================================================
    
    function setModule(module) {
        _currentModule = module;
        if (typeof AdaptiveCommandSystem !== 'undefined') {
            AdaptiveCommandSystem.setActiveModule(module);
        }
        
        // Actualizar badge
        var badge = document.getElementById('assistant-module-badge');
        if (badge) {
            var labels = { 'pfd': 'PFD', 'dti': 'DTI', 'iso': 'ISO' };
            badge.textContent = labels[module] || module.toUpperCase();
        }
        
        // Renderizar comandos del módulo
        renderCommandGrid();
    }
    
    // ================================================================
    // 7. RENDERIZAR COMANDOS
    // ================================================================
    
    function renderCommandGrid() {
        if (!_assistantBody) return;
        
        var commands = getModuleCommands(_currentModule);
        if (!commands || commands.length === 0) {
            _assistantBody.innerHTML = '<p style="color:#64748b;font-size:11px;text-align:center;padding:15px 0;">No hay comandos disponibles para este módulo</p>';
            return;
        }
        
        var html = '';
        html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:6px;">';
        
        commands.forEach(function(cmd) {
            html += `
                <div class="assistant-cmd-card" data-command="${cmd.command}" 
                     style="background:rgba(30,41,59,0.5);border:1px solid rgba(255,255,255,0.04);border-radius:8px;padding:8px 6px;cursor:pointer;text-align:center;transition:all 0.15s;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:56px;"
                     onmouseover="this.style.borderColor='rgba(0,242,255,0.3)';this.style.background='rgba(30,41,59,0.7)';"
                     onmouseout="this.style.borderColor='rgba(255,255,255,0.04)';this.style.background='rgba(30,41,59,0.5)';"
                     onclick="AdaptiveCommandsUI.startFlow('${cmd.command}')">
                    <span style="font-size:1.4em;line-height:1.2;">${cmd.icon || '📋'}</span>
                    <span style="font-size:0.6em;font-weight:600;color:#e0e6ed;margin-top:2px;line-height:1.2;">${cmd.name}</span>
                    ${cmd.description ? `<span style="font-size:0.5em;color:#64748b;margin-top:1px;line-height:1.1;display:none;">${cmd.description}</span>` : ''}
                </div>
            `;
        });
        
        html += '</div>';
        _assistantBody.innerHTML = html;
    }
    
    // ================================================================
    // 8. START FLOW (Asistente)
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
            // Ejecutar comando directo
            if (typeof SmartFlowCommands !== 'undefined' && SmartFlowCommands.executeCommand) {
                SmartFlowCommands.executeCommand(stepData.command);
                showToast('✅ ' + stepData.name + ' ejecutado', 'ok');
            }
            return;
        }
        
        // Guardar flujo actual
        _currentFlow = stepData;
        renderWizard();
    }
    
    // ================================================================
    // 9. RENDER WIZARD
    // ================================================================
    
    function renderWizard() {
        if (!_assistantBody || !_currentFlow) return;
        
        var stepData = _currentFlow;
        var html = '';
        
        // Barra de progreso
        html += `
            <div style="background:rgba(255,255,255,0.05);border-radius:4px;height:3px;margin-bottom:8px;overflow:hidden;">
                <div style="background:linear-gradient(90deg,#00f2ff,#1e4eb8);height:100%;width:${stepData.progress || 0}%;transition:width 0.3s ease;border-radius:4px;"></div>
            </div>
        `;
        
        // Título
        html += `
            <div style="font-size:0.85em;font-weight:600;color:#e0e6ed;margin-bottom:6px;display:flex;align-items:center;gap:6px;">
                ${stepData.title || ''}
                <span style="font-size:0.6em;color:#64748b;font-weight:400;">${stepData.stepIndex !== undefined ? (stepData.stepIndex + 1) + '/' + (stepData.totalSteps || 0) : ''}</span>
            </div>
        `;
        
        // Descripción
        if (stepData.description) {
            html += `<div style="font-size:0.65em;color:#94a3b8;margin-bottom:6px;">${stepData.description}</div>`;
        }
        
        // Contenido según tipo
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
                html += `<p style="color:#94a3b8;font-size:0.8em;">Paso: ${stepData.type || 'desconocido'}</p>`;
        }
        
        // Preview del comando
        if (stepData.isFinal && stepData.command) {
            html += `
                <div style="margin-top:8px;padding:6px 10px;background:rgba(0,0,0,0.3);border-radius:6px;border:1px solid rgba(255,255,255,0.04);">
                    <div style="font-size:0.55em;color:#64748b;margin-bottom:2px;text-transform:uppercase;letter-spacing:0.3px;">📝 Comando a ejecutar:</div>
                    <code style="color:#00f2ff;font-family:'Courier New',monospace;font-size:0.7em;word-break:break-all;display:block;">${stepData.command}</code>
                </div>
            `;
        }
        
        _assistantBody.innerHTML = html;
        
        // Configurar eventos según tipo
        setupStepEvents(stepData);
        
        // Footer
        var isFinal = stepData.isFinal || false;
        var hasPrev = (stepData.stepIndex || 0) > 0;
        
        if (_assistantFooter) {
            _assistantFooter.style.display = 'flex';
            _assistantFooter.innerHTML = `
                <div style="display:flex;gap:4px;flex-wrap:wrap;">
                    <button class="assistant-btn" data-action="prev" ${!hasPrev ? 'disabled' : ''} 
                            style="padding:4px 12px;border-radius:4px;border:1px solid rgba(255,255,255,0.08);background:transparent;color:#94a3b8;font-size:0.65em;font-weight:600;cursor:pointer;min-height:28px;${!hasPrev ? 'opacity:0.4;cursor:not-allowed;' : ''}">
                        ← Anterior
                    </button>
                    <button class="assistant-btn" data-action="cancel" 
                            style="padding:4px 12px;border-radius:4px;border:1px solid rgba(248,113,113,0.2);background:transparent;color:#f87171;font-size:0.65em;font-weight:600;cursor:pointer;min-height:28px;">
                        ✖ Cancelar
                    </button>
                </div>
                <div style="display:flex;gap:4px;">
                    ${isFinal ? 
                        `<button class="assistant-btn" data-action="execute" 
                                 style="padding:4px 14px;border-radius:4px;border:none;background:#238636;color:#fff;font-size:0.65em;font-weight:600;cursor:pointer;min-height:28px;">
                            ✅ Ejecutar
                        </button>` :
                        `<button class="assistant-btn" data-action="next" 
                                 style="padding:4px 14px;border-radius:4px;border:none;background:#1e4eb8;color:#fff;font-size:0.65em;font-weight:600;cursor:pointer;min-height:28px;">
                            Siguiente →
                        </button>`
                    }
                </div>
            `;
            
            // Eventos del footer
            _assistantFooter.querySelectorAll('.assistant-btn').forEach(function(btn) {
                btn.addEventListener('click', function() {
                    var action = this.dataset.action;
                    if (action === 'prev') goPrev();
                    else if (action === 'cancel') cancelFlow();
                    else if (action === 'next') goNext();
                    else if (action === 'execute') executeFlow();
                });
            });
        }
    }
    
    // ================================================================
    // 10. RENDERIZADO DE TIPOS DE PASOS
    // ================================================================
    
    function renderSelect(stepData) {
        var options = stepData.options || [];
        var html = `<div style="display:flex;flex-direction:column;gap:3px;max-height:160px;overflow-y:auto;">`;
        options.forEach(function(opt) {
            html += `
                <div class="assistant-select-item" data-value="${opt.value}" 
                     style="display:flex;align-items:center;gap:6px;padding:6px 10px;background:rgba(30,41,59,0.4);border:1px solid rgba(255,255,255,0.04);border-radius:6px;cursor:pointer;transition:all 0.15s;min-height:32px;"
                     onclick="AdaptiveCommandsUI.selectOption('${opt.value}', this)">
                    ${opt.icon ? `<span style="font-size:1em;">${opt.icon}</span>` : ''}
                    <div style="flex:1;min-width:0;">
                        <div style="font-size:0.75em;font-weight:500;color:#e0e6ed;">${opt.label}</div>
                        ${opt.description ? `<div style="font-size:0.6em;color:#64748b;">${opt.description}</div>` : ''}
                    </div>
                    ${opt.status === 'open' ? `<span style="color:#3fb950;font-size:0.7em;">🟢</span>` : ''}
                </div>
            `;
        });
        html += '</div>';
        return html;
    }
    
    function renderTextInput(stepData) {
        return `
            <div style="margin-bottom:4px;">
                <input type="text" id="assistant-text-input" 
                       placeholder="${stepData.placeholder || ''}" 
                       value="${stepData.default || ''}"
                       style="width:100%;padding:6px 10px;background:rgba(15,23,42,0.8);border:1px solid rgba(255,255,255,0.08);border-radius:6px;color:#e0e6ed;font-size:0.8em;outline:none;min-height:32px;">
            </div>
        `;
    }
    
    function renderNumberInput(stepData) {
        return `
            <div style="margin-bottom:4px;">
                <input type="number" id="assistant-number-input" 
                       value="${stepData.default || 0}" 
                       min="${stepData.min || ''}" 
                       max="${stepData.max || ''}" 
                       step="${stepData.step || '1'}"
                       style="width:100%;padding:6px 10px;background:rgba(15,23,42,0.8);border:1px solid rgba(255,255,255,0.08);border-radius:6px;color:#e0e6ed;font-size:0.8em;outline:none;min-height:32px;">
            </div>
        `;
    }
    
    function renderSlider(stepData) {
        var val = stepData.default || 0.5;
        return `
            <div style="margin-bottom:4px;">
                <div style="display:flex;align-items:center;gap:8px;">
                    <input type="range" id="assistant-slider" 
                           min="${stepData.min || 0}" 
                           max="${stepData.max || 1}" 
                           step="${stepData.step || 0.01}" 
                           value="${val}"
                           style="flex:1;min-height:28px;cursor:pointer;accent-color:#00f2ff;">
                    <span id="assistant-slider-val" style="color:#00f2ff;font-weight:700;font-size:0.8em;min-width:30px;text-align:center;">${val}</span>
                </div>
            </div>
        `;
    }
    
    function renderCoordinate(stepData) {
        var def = stepData.default || { x: 0, y: 0, z: 0 };
        return `
            <div style="margin-bottom:4px;">
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;">
                    <input type="number" id="coord-x" placeholder="X" value="${def.x || 0}" step="1" style="padding:4px 6px;background:rgba(15,23,42,0.8);border:1px solid rgba(255,255,255,0.08);border-radius:4px;color:#e0e6ed;font-size:0.75em;text-align:center;min-height:28px;">
                    <input type="number" id="coord-y" placeholder="Y" value="${def.y || 0}" step="1" style="padding:4px 6px;background:rgba(15,23,42,0.8);border:1px solid rgba(255,255,255,0.08);border-radius:4px;color:#e0e6ed;font-size:0.75em;text-align:center;min-height:28px;">
                    <input type="number" id="coord-z" placeholder="Z" value="${def.z || 0}" step="1" style="padding:4px 6px;background:rgba(15,23,42,0.8);border:1px solid rgba(255,255,255,0.08);border-radius:4px;color:#e0e6ed;font-size:0.75em;text-align:center;min-height:28px;">
                </div>
            </div>
        `;
    }
    
    function renderCoordinateList(stepData) {
        var pts = stepData.default || [{ x: 0, y: 0, z: 0 }, { x: 1000, y: 0, z: 0 }];
        var html = `
            <div style="margin-bottom:4px;">
                <div style="font-size:0.65em;color:#94a3b8;margin-bottom:4px;">${stepData.description || 'Agregue puntos'} (mín: ${stepData.minPoints || 2})</div>
                <div id="assistant-coord-list">
        `;
        pts.forEach(function(p, i) {
            html += `
                <div class="assistant-coord-row" style="display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:4px;margin-bottom:4px;">
                    <input type="number" placeholder="X" value="${p.x || 0}" step="1" data-axis="x" style="padding:3px 4px;background:rgba(15,23,42,0.8);border:1px solid rgba(255,255,255,0.08);border-radius:4px;color:#e0e6ed;font-size:0.7em;text-align:center;min-height:26px;">
                    <input type="number" placeholder="Y" value="${p.y || 0}" step="1" data-axis="y" style="padding:3px 4px;background:rgba(15,23,42,0.8);border:1px solid rgba(255,255,255,0.08);border-radius:4px;color:#e0e6ed;font-size:0.7em;text-align:center;min-height:26px;">
                    <input type="number" placeholder="Z" value="${p.z || 0}" step="1" data-axis="z" style="padding:3px 4px;background:rgba(15,23,42,0.8);border:1px solid rgba(255,255,255,0.08);border-radius:4px;color:#e0e6ed;font-size:0.7em;text-align:center;min-height:26px;">
                    <button onclick="this.parentElement.remove()" style="padding:2px 6px;border-radius:4px;border:1px solid rgba(255,255,255,0.08);background:transparent;color:#64748b;font-size:0.7em;cursor:pointer;min-height:26px;">✕</button>
                </div>
            `;
        });
        html += `
                </div>
                <button onclick="AdaptiveCommandsUI.addCoordRow()" style="width:100%;padding:3px;border-radius:4px;border:1px dashed rgba(255,255,255,0.1);background:transparent;color:#64748b;font-size:0.65em;cursor:pointer;min-height:26px;">+ Agregar Punto</button>
            </div>
        `;
        return html;
    }
    
    function renderForm(stepData) {
        var fields = stepData.fields || [];
        var html = '';
        fields.forEach(function(field) {
            html += `<div style="margin-bottom:4px;">`;
            if (field.type === 'checkbox') {
                html += `
                    <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:0.75em;color:#e0e6ed;">
                        <input type="checkbox" id="field-${field.id}" data-field="${field.id}" ${field.default ? 'checked' : ''} style="accent-color:#00f2ff;width:16px;height:16px;cursor:pointer;">
                        ${field.label}
                    </label>
                `;
            } else {
                html += `<label style="display:block;font-size:0.6em;color:#94a3b8;margin-bottom:2px;">${field.label}</label>`;
                if (field.type === 'select') {
                    html += `<select id="field-${field.id}" data-field="${field.id}" style="width:100%;padding:4px 8px;background:rgba(15,23,42,0.8);border:1px solid rgba(255,255,255,0.08);border-radius:4px;color:#e0e6ed;font-size:0.75em;min-height:28px;">`;
                    var opts = typeof field.options === 'function' ? field.options() : (field.options || []);
                    opts.forEach(function(opt) {
                        var val = typeof opt === 'object' ? opt.value : opt;
                        var lbl = typeof opt === 'object' ? (opt.label || opt.value) : opt;
                        html += `<option value="${val}">${lbl}</option>`;
                    });
                    html += `</select>`;
                } else {
                    html += `<input type="${field.type}" id="field-${field.id}" data-field="${field.id}" 
                                   value="${field.default || ''}" placeholder="${field.placeholder || ''}"
                                   min="${field.min || ''}" max="${field.max || ''}" step="${field.step || ''}"
                                   style="width:100%;padding:4px 8px;background:rgba(15,23,42,0.8);border:1px solid rgba(255,255,255,0.08);border-radius:4px;color:#e0e6ed;font-size:0.75em;min-height:28px;">`;
                }
            }
            html += `</div>`;
        });
        return html;
    }
    
    function renderConfirm(stepData) {
        return `<div style="text-align:center;padding:12px;background:rgba(248,81,73,0.06);border:1px solid rgba(248,81,73,0.15);border-radius:6px;color:#fca5a5;font-size:0.75em;line-height:1.5;white-space:pre-line;text-align:left;">${stepData.message || '¿Confirmar esta acción?'}</div>`;
    }
    
    function renderInfo(stepData) {
        return `<div style="text-align:center;padding:12px;background:rgba(0,242,255,0.04);border-radius:6px;border:1px solid rgba(0,242,255,0.08);color:#00f2ff;font-size:0.8em;line-height:1.5;white-space:pre-line;">${stepData.message || ''}</div>`;
    }
    
    // ================================================================
    // 11. FUNCIONES DE NAVEGACIÓN DEL ASISTENTE
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
        row.innerHTML = `
            <input type="number" placeholder="X" value="0" step="1" data-axis="x" style="padding:3px 4px;background:rgba(15,23,42,0.8);border:1px solid rgba(255,255,255,0.08);border-radius:4px;color:#e0e6ed;font-size:0.7em;text-align:center;min-height:26px;">
            <input type="number" placeholder="Y" value="0" step="1" data-axis="y" style="padding:3px 4px;background:rgba(15,23,42,0.8);border:1px solid rgba(255,255,255,0.08);border-radius:4px;color:#e0e6ed;font-size:0.7em;text-align:center;min-height:26px;">
            <input type="number" placeholder="Z" value="0" step="1" data-axis="z" style="padding:3px 4px;background:rgba(15,23,42,0.8);border:1px solid rgba(255,255,255,0.08);border-radius:4px;color:#e0e6ed;font-size:0.7em;text-align:center;min-height:26px;">
            <button onclick="this.parentElement.remove()" style="padding:2px 6px;border-radius:4px;border:1px solid rgba(255,255,255,0.08);background:transparent;color:#64748b;font-size:0.7em;cursor:pointer;min-height:26px;">✕</button>
        `;
        container.appendChild(row);
    }
    
    function setupStepEvents(stepData) {
        // Text input
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
        
        // Number input
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
        
        // Slider
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
        
        // Coordinate
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
        
        // Confirm - se maneja con el botón Ejecutar
        if (stepData.type === 'confirm' || stepData.type === 'info') {
            // No hacer nada especial, el usuario hace clic en Siguiente o Ejecutar
        }
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
    // 12. TOAST NOTIFICATIONS
    // ================================================================
    
    function showToast(msg, type) {
        var existing = document.querySelector('.adaptive-toast');
        if (existing) existing.remove();
        var toast = document.createElement('div');
        toast.className = 'adaptive-toast';
        toast.style.cssText = `
            position: fixed;
            bottom: 100px;
            left: 50%;
            transform: translateX(-50%);
            padding: 8px 20px;
            border-radius: 8px;
            z-index: 10001;
            font-size: 0.8em;
            font-weight: 600;
            pointer-events: none;
            animation: toastSlideUp 0.3s ease;
            max-width: 90vw;
            text-align: center;
            background: ${type === 'err' ? '#3a1a1a' : type === 'ok' ? '#1a3a2a' : '#1a2a3a'};
            color: ${type === 'err' ? '#f85149' : type === 'ok' ? '#3fb950' : '#58a6ff'};
            border: 1px solid ${type === 'err' ? '#f85149' : type === 'ok' ? '#3fb950' : '#58a6ff'};
        `;
        toast.textContent = msg;
        document.body.appendChild(toast);
        setTimeout(function() { toast.remove(); }, 2500);
    }
    
    // ================================================================
    // 13. ABRIR/CERRAR PANEL
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
        
        // Enfocar el textarea
        if (_commandText) {
            setTimeout(function() { _commandText.focus(); }, 200);
        }
        
        // Mostrar el asistente
        if (_assistantContainer) {
            _assistantContainer.style.display = 'block';
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
    // 14. API PÚBLICA
    // ================================================================
    
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
        // Utilidades expuestas
        getEquiposList: getEquiposList,
        getLineasList: getLineasList,
        getPuertosLibres: getPuertosLibres,
        getPuertosTodos: getPuertosTodos,
        getPosicionesLinea: getPosicionesLinea,
        getMaterialOptions: getMaterialOptions,
        pipeDiameters: pipeDiameters,
        // Para integración con el panel de texto
        ejecutarComandoTexto: ejecutarComandoTexto
    };
    
    // Exponer globalmente
    if (typeof window !== 'undefined') {
        window.AdaptiveCommandsUI = API;
    }
    
    console.log('✅ AdaptiveCommandsUI v2.0 - Integrado con panel de texto');
    console.log('   📝 Arriba: Consola de texto tradicional');
    console.log('   🧭 Abajo: Asistente paso a paso (GUI)');
    console.log('💡 Ambos modos conviven y no se cierran al ejecutar comandos');
    
    return API;
    
})();

// ============================================================
// INICIALIZACIÓN AUTOMÁTICA
// ============================================================
document.addEventListener('DOMContentLoaded', function() {
    if (typeof AdaptiveCommandsUI !== 'undefined' && AdaptiveCommandsUI.init) {
        // Esperar a que el DOM esté listo
        setTimeout(function() {
            AdaptiveCommandsUI.init();
        }, 500);
    }
});
