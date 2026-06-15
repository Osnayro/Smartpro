
const AdaptiveCommandUI = (function() {
    
    let currentMode = 'assisted';
    let currentFlow = null;
    let activeCategory = 'all';

    function injectStyles() {
        const styleId = 'adaptive-command-styles';
        if (document.getElementById(styleId)) return;
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = '#adaptive-overlay{position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(2,6,23,0.85);z-index:8000;display:flex;justify-content:center;align-items:center;backdrop-filter:blur(6px);animation:fadeIn .2s ease}@keyframes fadeIn{from{opacity:0}to{opacity:1}}#adaptive-panel{width:95%;max-width:520px;max-height:85vh;background:rgba(15,23,42,0.98);border:1px solid var(--accent-cyan,#00f2ff);border-radius:16px;display:flex;flex-direction:column;box-shadow:0 20px 60px rgba(0,0,0,0.7);overflow:hidden}.adaptive-header{display:flex;justify-content:space-between;align-items:center;padding:14px 18px;border-bottom:1px solid rgba(0,242,255,0.2);background:rgba(0,242,255,0.03);flex-shrink:0}.adaptive-header h3{color:var(--accent-cyan,#00f2ff);font-size:1em;margin:0;display:flex;align-items:center;gap:8px}.adaptive-close{background:none;border:1px solid rgba(255,255,255,0.2);color:#fff;width:32px;height:32px;border-radius:50%;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;flex-shrink:0}.adaptive-close:hover{background:#ef4444;border-color:#ef4444}.adaptive-body{flex:1;overflow-y:auto;padding:16px;-webkit-overflow-scrolling:touch}.adaptive-footer{padding:12px 16px;border-top:1px solid rgba(0,242,255,0.15);display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;flex-shrink:0}.mode-tabs{display:flex;background:rgba(255,255,255,0.05);border-radius:20px;padding:3px;margin-bottom:14px}.mode-tab{flex:1;text-align:center;padding:8px 12px;border-radius:18px;border:none;background:transparent;color:#94a3b8;font-size:.8em;font-weight:600;cursor:pointer;transition:all .2s;white-space:nowrap}.mode-tab.active{background:var(--accent-cyan,#00f2ff);color:#000}.mode-tab:hover:not(.active){color:#fff}.cmd-categories{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:12px}.cmd-cat{padding:5px 10px;border-radius:14px;font-size:.7em;border:1px solid rgba(255,255,255,0.15);background:transparent;color:#94a3b8;cursor:pointer;transition:all .2s;white-space:nowrap}.cmd-cat.active{background:var(--accent-blue,#1e4eb8);border-color:var(--accent-cyan,#00f2ff);color:#fff}.cmd-cat:hover{border-color:var(--accent-cyan,#00f2ff)}.cmd-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:8px}@media(max-width:400px){.cmd-grid{grid-template-columns:repeat(2,1fr);gap:6px}}.cmd-card{background:rgba(30,41,59,0.7);border:1px solid rgba(255,255,255,0.1);border-radius:10px;padding:10px;cursor:pointer;transition:all .2s;text-align:center}.cmd-card:hover{border-color:var(--accent-cyan,#00f2ff);transform:translateY(-1px)}.cmd-card .cmd-icon{font-size:1.5em;margin-bottom:4px}.cmd-card .cmd-name{font-size:.75em;font-weight:600;color:#e0e6ed}.flow-progress{background:rgba(255,255,255,0.08);border-radius:6px;height:3px;margin-bottom:14px;overflow:hidden}.flow-progress-fill{background:linear-gradient(90deg,var(--accent-cyan,#00f2ff),var(--accent-blue,#1e4eb8));height:100%;transition:width .3s ease}.flow-back-btn{background:none;border:1px solid rgba(255,255,255,0.2);color:#94a3b8;padding:6px 12px;border-radius:6px;font-size:.8em;cursor:pointer;margin-bottom:12px}.flow-back-btn:hover{color:#fff;border-color:#fff}.flow-title{font-size:.95em;font-weight:600;color:#e0e6ed;margin-bottom:12px;display:flex;align-items:center;gap:8px}.flow-select-list{display:flex;flex-direction:column;gap:4px;max-height:45vh;overflow-y:auto}.flow-select-item{display:flex;align-items:center;gap:10px;padding:10px 12px;background:rgba(30,41,59,0.6);border:1px solid rgba(255,255,255,0.08);border-radius:8px;cursor:pointer;transition:all .15s}.flow-select-item:active{background:rgba(0,242,255,0.1);border-color:var(--accent-cyan,#00f2ff)}.flow-select-item.selected{border-color:var(--accent-blue,#1e4eb8);background:rgba(30,78,184,0.2)}.flow-select-item .fsi-icon{font-size:1.2em;flex-shrink:0}.flow-select-item .fsi-info{flex:1;min-width:0}.flow-select-item .fsi-label{font-weight:500;font-size:.85em}.flow-select-item .fsi-desc{font-size:.7em;color:#64748b}.flow-cat-header{padding:6px 10px;font-size:.7em;color:var(--accent-cyan,#00f2ff);font-weight:700;text-transform:uppercase;background:rgba(0,242,255,0.05);border-radius:4px;margin:6px 0 2px 0;position:sticky;top:0;z-index:1}.flow-form-group{margin-bottom:10px}.flow-form-group label{display:block;font-size:.75em;color:#94a3b8;margin-bottom:4px}.flow-form-group input,.flow-form-group select{width:100%;padding:10px 12px;background:#0f172a;border:1px solid #334155;border-radius:8px;color:#e0e6ed;font-size:.9em;outline:none}.flow-form-group input:focus,.flow-form-group select:focus{border-color:var(--accent-cyan,#00f2ff)}.flow-coords{display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:6px;margin-bottom:6px}.flow-coords input{text-align:center}.flow-slider-row{display:flex;align-items:center;gap:8px}.flow-slider-row input[type="range"]{flex:1}.flow-slider-val{color:var(--accent-cyan,#00f2ff);font-weight:600;font-size:.85em;min-width:30px}.flow-confirm{text-align:center;padding:20px;background:rgba(248,81,73,0.08);border:1px solid rgba(248,81,73,0.3);border-radius:10px;color:#fca5a5;font-size:.9em;line-height:1.5;white-space:pre-line}.flow-preview{margin-top:12px;padding:10px 14px;background:rgba(0,0,0,0.4);border-radius:8px;border:1px solid rgba(255,255,255,0.08)}.flow-preview .fp-label{font-size:.7em;color:#64748b;margin-bottom:3px}.flow-preview code{color:var(--accent-cyan,#00f2ff);font-family:\'Courier New\',monospace;font-size:.8em;word-break:break-all}.flow-search{width:100%;padding:8px 12px;background:#0f172a;border:1px solid #334155;border-radius:8px;color:#e0e6ed;font-size:.85em;margin-bottom:8px;outline:none}.flow-search:focus{border-color:var(--accent-cyan,#00f2ff)}.text-console-output{background:rgba(0,0,0,0.4);border-radius:8px;padding:10px;max-height:25vh;overflow-y:auto;margin-bottom:10px;font-family:\'Courier New\',monospace;font-size:.75em}.text-console-output .tco-line{padding:1px 0}.text-console-output .tco-cmd{color:var(--accent-cyan,#00f2ff)}.text-console-output .tco-ok{color:#3fb950}.text-console-output .tco-err{color:#f85149}.text-console-output .tco-info{color:#8b949e}.text-input-area{display:flex;gap:6px}.text-input-area input{flex:1;padding:10px 12px;background:#0f172a;border:1px solid #334155;border-radius:8px;color:#e0e6ed;font-family:\'Courier New\',monospace;font-size:.85em;outline:none}.text-input-area input:focus{border-color:var(--accent-cyan,#00f2ff)}.text-input-area button{padding:10px 14px;background:var(--accent-blue,#1e4eb8);border:none;border-radius:8px;color:#fff;font-weight:600;cursor:pointer;font-size:.85em}.text-hints{font-size:.7em;color:#64748b;margin-top:8px;padding:8px;background:rgba(0,242,255,0.03);border-radius:6px;line-height:1.5}.text-hints strong{color:var(--accent-cyan,#00f2ff)}.af-btn{padding:8px 16px;border-radius:6px;border:none;font-size:.8em;font-weight:600;cursor:pointer;transition:all .2s}.af-btn-primary{background:var(--accent-blue,#1e4eb8);color:#fff}.af-btn-primary:hover{background:#2563eb}.af-btn-success{background:#238636;color:#fff}.af-btn-ghost{background:transparent;color:#94a3b8;border:1px solid rgba(255,255,255,0.15)}.af-btn-danger{background:transparent;color:#f87171;border:1px solid rgba(248,113,113,0.3)}.af-btn:disabled{opacity:.4;cursor:not-allowed}.adaptive-toast{position:fixed;bottom:80px;left:50%;transform:translateX(-50%);padding:10px 20px;border-radius:8px;z-index:9000;font-size:.85em;font-weight:600;pointer-events:none;animation:slideUp .3s ease}.adaptive-toast.ok{background:#1a3a2a;color:#3fb950;border:1px solid #3fb950}.adaptive-toast.err{background:#3a1a1a;color:#f85149;border:1px solid #f85149}@keyframes slideUp{from{transform:translate(-50%,20px);opacity:0}to{transform:translate(-50%,0);opacity:1}}';
        document.head.appendChild(style);
    }

    function createOverlay() {
        const existing = document.getElementById('adaptive-overlay');
        if (existing) existing.remove();
        const overlay = document.createElement('div');
        overlay.id = 'adaptive-overlay';
        overlay.innerHTML = '<div id="adaptive-panel"><div class="adaptive-header"><h3>🤖 <span id="adaptive-title">Comandos Inteligentes</span></h3><button class="adaptive-close" id="adaptive-close">✕</button></div><div class="adaptive-body" id="adaptive-body"></div><div class="adaptive-footer" id="adaptive-footer"></div></div>';
        document.body.appendChild(overlay);
        document.getElementById('adaptive-close').addEventListener('click', closeOverlay);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) closeOverlay(); });
        return overlay;
    }

    function closeOverlay() {
        const overlay = document.getElementById('adaptive-overlay');
        if (overlay) { overlay.style.opacity = '0'; setTimeout(() => overlay.remove(), 200); }
        currentFlow = null;
        AdaptiveCommandSystem.resetFlow();
    }

    function openPanel(mode) {
        mode = mode || 'assisted';
        injectStyles();
        createOverlay();
        currentMode = mode;
        if (currentFlow) { renderFlowStep(); }
        else { if (mode === 'assisted') renderAssistedGrid(); else renderTextMode(); }
    }

    function updateTitle(title) {
        const el = document.getElementById('adaptive-title');
        if (el) el.textContent = title || 'Comandos Inteligentes';
    }

    function getModuleCommands() {
        var module = window.currentModule || 'pfd';
        if (module === 'pfd') {
            return { title: 'PFD - Diagrama de Flujo', icon: '📊', categories: {
                'pfd_equipos': { name: '🏗️ Equipos Lógicos', cmds: [
                    { command: 'create_equipo_tanque_v', icon: '🛢️', name: 'Tanque Vertical', category: 'pfd_equipos' },
                    { command: 'create_equipo_bomba', icon: '⚙️', name: 'Bomba', category: 'pfd_equipos' },
                    { command: 'create_equipo_intercambiador', icon: '🔥', name: 'Intercambiador', category: 'pfd_equipos' },
                    { command: 'create_equipo_tanque_h', icon: '🛢️', name: 'Tanque Horizontal', category: 'pfd_equipos' },
                    { command: 'create_equipo_reactor', icon: '⚗️', name: 'Reactor', category: 'pfd_equipos' },
                    { command: 'create_equipo_torre', icon: '🗼', name: 'Torre', category: 'pfd_equipos' },
                    { command: 'create_equipo_compresor', icon: '💨', name: 'Compresor', category: 'pfd_equipos' },
                    { command: 'create_equipo_separador', icon: '🔻', name: 'Separador', category: 'pfd_equipos' }
                ]},
                'pfd_streams': { name: '🔗 Corrientes', cmds: [
                    { command: 'create_stream', icon: '➡️', name: 'Nueva Corriente', category: 'pfd_streams' }
                ]},
                'pfd_query': { name: '🔍 Consultas PFD', cmds: [
                    { command: 'list_streams', icon: '📋', name: 'Listar Corrientes', category: 'pfd_query' },
                    { command: 'list_equipos', icon: '📦', name: 'Listar Equipos', category: 'pfd_query' },
                    { command: 'balance_masa', icon: '⚖️', name: 'Balance de Masa', category: 'pfd_query' },
                    { command: 'validate_pfd', icon: '🔍', name: 'Validar PFD', category: 'pfd_query' },
                    { command: 'autolink', icon: '🔗', name: 'Auto-Vincular', category: 'pfd_query' }
                ]}
            }};
        }
        if (module === 'dti') {
            return { title: 'DTI - Tubería e Instrumentación', icon: '🔧', categories: {
                'dti_field': { name: '⭕ Instrumentos Campo', cmds: [
                    { command: 'create_instrument_pressure_gauge', icon: '📟', name: 'Manómetro (PG)', category: 'dti_field' },
                    { command: 'create_instrument_temperature_gauge', icon: '🌡️', name: 'Termómetro (TG)', category: 'dti_field' },
                    { command: 'create_instrument_pressure_transmitter', icon: '📡', name: 'Transmisor Presión (PT)', category: 'dti_field' },
                    { command: 'create_instrument_flow_transmitter', icon: '📡', name: 'Transmisor Flujo (FT)', category: 'dti_field' },
                    { command: 'create_instrument_level_switch', icon: '📏', name: 'Switch Nivel (LS)', category: 'dti_field' },
                    { command: 'create_instrument_control_valve', icon: '🔧', name: 'Válvula Control (CV)', category: 'dti_field' }
                ]},
                'dti_panel': { name: '📋 Instrumentos Panel', cmds: [
                    { command: 'create_instrument_pressure_controller', icon: '🎛️', name: 'Controlador Presión (PIC)', category: 'dti_panel' },
                    { command: 'create_instrument_flow_controller', icon: '🎛️', name: 'Controlador Flujo (FIC)', category: 'dti_panel' }
                ]},
                'dti_loops': { name: '🔄 Lazos de Control', cmds: [
                    { command: 'create_loop', icon: '🔁', name: 'Nuevo Lazo PID', category: 'dti_loops' }
                ]},
                'dti_query': { name: '🔍 Consultas DTI', cmds: [
                    { command: 'list_instruments', icon: '📋', name: 'Listar Instrumentos', category: 'dti_query' },
                    { command: 'list_loops', icon: '🔄', name: 'Listar Lazos', category: 'dti_query' },
                    { command: 'list_instrument_types', icon: '📁', name: 'Tipos Disponibles', category: 'dti_query' },
                    { command: 'validate_dti', icon: '🔍', name: 'Validar DTI', category: 'dti_query' }
                ]}
            }};
        }
        var isoCommands = AdaptiveCommandSystem.getCommandsByCategory();
        return { title: 'ISO - Isométrico 3D', icon: '🧊', categories: {
            'iso_update': { name: '📍 Posicionar Equipos (desde PFD)', cmds: [
                { command: 'UPDATE_EQUIPMENT', icon: '📍', name: 'Posicionar Equipo Existente', category: 'iso_update' }
            ]},
            ...isoCommands
        }};
    }

    function renderAssistedGrid() {
        var moduleData = getModuleCommands();
        updateTitle(moduleData.icon + ' ' + moduleData.title);
        currentFlow = null;
        AdaptiveCommandSystem.resetFlow();
        var categories = moduleData.categories;
        var allCmds = [];
        Object.values(categories).forEach(function(cat) { if (cat.cmds) allCmds = allCmds.concat(cat.cmds); });
        var bodyHtml = '<div class="mode-tabs"><button class="mode-tab active" data-mode="assisted" onclick="AdaptiveCommandUI.switchTab(\'assisted\')">🧭 Asistido</button><button class="mode-tab" data-mode="text" onclick="AdaptiveCommandUI.switchTab(\'text\')">⌨️ Texto</button></div>';
        bodyHtml += '<div class="cmd-categories" style="margin-bottom:8px;">';
        var modules = [{ id: 'pfd', name: '📊 PFD', color: '#10b981' },{ id: 'dti', name: '🔧 DTI', color: '#8b5cf6' },{ id: 'iso', name: '🧊 ISO', color: '#00f2ff' }];
        var currentMod = window.currentModule || 'pfd';
        modules.forEach(function(mod) { var isActive = mod.id === currentMod; bodyHtml += '<button class="cmd-cat' + (isActive ? ' active' : '') + '" style="' + (isActive ? 'border-color:' + mod.color + ';color:' + mod.color : '') + '" onclick="AdaptiveCommandUI.switchModule(\'' + mod.id + '\')">' + mod.name + '</button>'; });
        bodyHtml += '</div><div class="cmd-categories"><button class="cmd-cat active" data-cat="all" onclick="AdaptiveCommandUI.filterCategory(\'all\')">📋 Todos (' + allCmds.length + ')</button>';
        Object.entries(categories).forEach(function(entry) { var catKey = entry[0]; var catData = entry[1]; bodyHtml += '<button class="cmd-cat" data-cat="' + catKey + '" onclick="AdaptiveCommandUI.filterCategory(\'' + catKey + '\')">' + catData.name + ' (' + (catData.cmds ? catData.cmds.length : 0) + ')</button>'; });
        bodyHtml += '</div><div class="cmd-grid" id="cmdGrid">' + renderCmdCards(allCmds) + '</div>';
        document.getElementById('adaptive-body').innerHTML = bodyHtml;
        document.getElementById('adaptive-footer').innerHTML = '<button class="af-btn af-btn-ghost" onclick="AdaptiveCommandUI.runQuickCommand(\'undo\')">↩️ Deshacer</button><button class="af-btn af-btn-ghost" onclick="AdaptiveCommandUI.runQuickCommand(\'redo\')">↪️ Rehacer</button><button class="af-btn af-btn-ghost" onclick="AdaptiveCommandUI.runQuickCommand(\'help\')">❓ Ayuda</button><button class="af-btn af-btn-ghost" onclick="AdaptiveCommandUI.runQuickCommand(\'validate all\')">🔍 Validar</button><button class="af-btn af-btn-danger" onclick="AdaptiveCommandUI.closeOverlay()">Cerrar</button>';
    }

    function renderCmdCards(cmds) {
        if (!cmds || cmds.length === 0) return '<p style="color:#64748b;text-align:center;">Sin comandos disponibles</p>';
        return cmds.map(function(cmd) { return '<div class="cmd-card" data-category="' + cmd.category + '" onclick="AdaptiveCommandUI.startFlow(\'' + cmd.command + '\')"><div class="cmd-icon">' + (cmd.icon || '📋') + '</div><div class="cmd-name">' + cmd.name + '</div></div>'; }).join('');
    }

    function filterCategory(cat) {
        activeCategory = cat;
        document.querySelectorAll('.cmd-cat').forEach(function(btn) { btn.classList.toggle('active', btn.dataset.cat === cat); });
        document.querySelectorAll('.cmd-card').forEach(function(card) { card.style.display = (cat === 'all' || card.dataset.category === cat) ? '' : 'none'; });
    }

    function switchTab(mode) {
        currentMode = mode;
        document.querySelectorAll('.mode-tab').forEach(function(tab) { tab.classList.toggle('active', tab.dataset.mode === mode); });
        if (mode === 'assisted') renderAssistedGrid(); else renderTextMode();
    }

    function startFlow(commandPath) {
        var directMap = {
            'list_streams': 'list streams', 'list_equipos': 'list equipos', 'validate_pfd': 'validate pfd',
            'autolink': 'autolink', 'list_instruments': 'list instruments', 'list_loops': 'list loops',
            'list_instrument_types': 'list instrument types', 'validate_dti': 'validate dti',
            'validate_all': 'validate all', 'project_summary': 'project summary', 'autofix': 'autofix',
            'export_db': 'export db', 'export_pcf': 'export pcf', 'export_mto': 'export mto',
            'balance_masa': 'balance masa '
        };
        if (directMap[commandPath]) { executeTextCommand(directMap[commandPath]); return; }
        if (AdaptiveCommandSystem.COMMAND_FLOWS[commandPath] && AdaptiveCommandSystem.COMMAND_FLOWS[commandPath].steps) {
            var stepData = AdaptiveCommandSystem.startCommandFlow(commandPath);
            if (!stepData) { showToast('Comando no disponible', 'err'); return; }
            if (stepData.direct) { executeTextCommand(stepData.command); return; }
            currentFlow = stepData; renderFlowStep(); return;
        }
        if (AdaptiveCommandSystem.DIRECT_COMMANDS[commandPath]) { executeTextCommand(AdaptiveCommandSystem.DIRECT_COMMANDS[commandPath].command); return; }
        showToast('Comando no disponible', 'err');
    }

    function renderFlowStep() {
        if (!currentFlow) { renderAssistedGrid(); return; }
        updateTitle((currentFlow.commandIcon || '📋') + ' ' + (currentFlow.commandName || ''));
        var bodyHtml = '<div class="flow-progress"><div class="flow-progress-fill" style="width:' + (currentFlow.progress || 0) + '%"></div></div><button class="flow-back-btn" onclick="AdaptiveCommandUI.flowBack()">← Volver a comandos</button><div class="flow-title">' + (currentFlow.title || '') + '</div>';
        switch (currentFlow.type) {
            case 'select': bodyHtml += renderFlowSelect(currentFlow); break;
            case 'dynamicSelect': bodyHtml += renderFlowSelect(currentFlow); break;
            case 'multiSelect': bodyHtml += renderFlowMultiSelect(currentFlow); break;
            case 'multiComponentSelect': bodyHtml += renderFlowComponentMultiSelect(currentFlow); break;
            case 'form': bodyHtml += renderFlowForm(currentFlow); break;
            case 'coordinate': bodyHtml += renderFlowCoordinate(currentFlow); break;
            case 'coordinateList': bodyHtml += renderFlowCoordinateList(currentFlow); break;
            case 'text': bodyHtml += renderFlowText(currentFlow); break;
            case 'number': bodyHtml += renderFlowNumber(currentFlow); break;
            case 'slider': bodyHtml += renderFlowSlider(currentFlow); break;
            case 'confirm': bodyHtml += renderFlowConfirm(currentFlow); break;
            case 'info': bodyHtml += renderFlowInfo(currentFlow); break;
            case 'conditional': flowNext(); return;
            case 'dynamic': bodyHtml += renderFlowDynamic(currentFlow); break;
            default: bodyHtml += '<p style="color:#94a3b8">Paso: ' + currentFlow.type + '</p>';
        }
        if (currentFlow.isFinal && currentFlow.command) { bodyHtml += '<div class="flow-preview"><div class="fp-label">📝 Comando a ejecutar:</div><code>' + currentFlow.command + '</code></div>'; }
        document.getElementById('adaptive-body').innerHTML = bodyHtml;
        var isFinalStep = currentFlow.isFinal;
        if (typeof isFinalStep === 'function') { isFinalStep = isFinalStep(AdaptiveCommandSystem.getSelections ? AdaptiveCommandSystem.getSelections() : {}); }
        var footerHtml = '<button class="af-btn af-btn-ghost" onclick="AdaptiveCommandUI.flowBack()" ' + ((currentFlow.stepIndex || 0) === 0 ? 'disabled' : '') + '>← Anterior</button><button class="af-btn af-btn-danger" onclick="AdaptiveCommandUI.cancelFlow()">Cancelar</button>';
        if (isFinalStep) { footerHtml += '<button class="af-btn af-btn-success" onclick="AdaptiveCommandUI.executeFlowCommand()">✅ Ejecutar</button>'; }
        else { footerHtml += '<button class="af-btn af-btn-primary" onclick="AdaptiveCommandUI.flowNext()">Siguiente →</button>'; }
        document.getElementById('adaptive-footer').innerHTML = footerHtml;
        setTimeout(function() { var searchInput = document.getElementById('flow-search'); if (searchInput) searchInput.focus(); }, 100);
    }

    function renderFlowSelect(stepData) {
        var options = typeof stepData.options === 'function' ? stepData.options() : (stepData.options || []);
        var html = '<div class="flow-select-list" id="flowSelectList">';
        options.forEach(function(opt) {
            html += '<div class="flow-select-item" data-value="' + opt.value + '" onclick="AdaptiveCommandUI.selectFlowOption(\'' + opt.value + '\', this)">' + (opt.icon ? '<span class="fsi-icon">' + opt.icon + '</span>' : '') + '<div class="fsi-info"><div class="fsi-label">' + opt.label + '</div>' + (opt.description ? '<div class="fsi-desc">' + opt.description + '</div>' : '') + '</div>' + (opt.status === 'open' ? '<span style="color:#3fb950">🟢</span>' : '') + '</div>';
        });
        html += '</div>';
        return html;
    }

    function renderFlowMultiSelect(stepData) {
        var html = '<p style="font-size:0.8em;color:#94a3b8;margin-bottom:8px">Seleccione ' + (stepData.minSelect || 2) + '+ elementos</p><div class="flow-select-list" id="flowMultiSelectList">';
        (stepData.options || []).forEach(function(opt) { html += '<div class="flow-select-item" data-value="' + opt.value + '" onclick="AdaptiveCommandUI.toggleMultiSelect(\'' + opt.value + '\', this)">' + (opt.icon ? '<span class="fsi-icon">' + opt.icon + '</span>' : '') + '<div class="fsi-label">' + opt.label + '</div><span class="multi-check" style="display:none;color:#3fb950">✅</span></div>'; });
        html += '</div><button class="af-btn af-btn-primary" onclick="AdaptiveCommandUI.confirmMultiSelect()" style="margin-top:8px;width:100%">Confirmar Selección</button>';
        return html;
    }

    function renderFlowComponentMultiSelect(stepData) {
        var options = stepData.options || [];
        var html = '<p style="font-size:0.8em;color:#94a3b8;margin-bottom:8px">Seleccione los componentes deseados</p><div class="flow-select-list" id="flowMultiSelectList">';
        options.forEach(function(opt) { html += '<div class="flow-select-item" data-value="' + opt.value + '" onclick="AdaptiveCommandUI.toggleMultiSelect(\'' + opt.value + '\', this)">🔩<div class="fsi-info"><div class="fsi-label">' + opt.label + '</div></div><span class="multi-check" style="display:none;color:#3fb950">✅</span></div>'; });
        html += '</div><button class="af-btn af-btn-primary" onclick="AdaptiveCommandUI.confirmMultiSelect()" style="margin-top:8px;width:100%">Confirmar Selección</button>';
        return html;
    }

    function renderFlowForm(stepData) {
        var html = '';
        (stepData.fields || []).forEach(function(field) {
            html += '<div class="flow-form-group"><label>' + field.label + '</label>';
            if (field.type === 'select') {
                html += '<select id="field-' + field.id + '" data-field="' + field.id + '"><option value="">Seleccionar...</option>';
                var opts = typeof field.options === 'function' ? field.options() : (field.options || []);
                opts.forEach(function(opt) { var val = typeof opt === 'object' ? opt.value : opt; var lbl = typeof opt === 'object' ? (opt.label || opt.value) : opt; html += '<option value="' + val + '">' + lbl + '</option>'; });
                html += '</select>';
            } else if (field.type === 'checkbox') {
                html += '<input type="checkbox" id="field-' + field.id + '" data-field="' + field.id + '" style="width:auto">';
            } else {
                html += '<input type="' + field.type + '" id="field-' + field.id + '" data-field="' + field.id + '" value="' + (field.default || '') + '" placeholder="' + (field.placeholder || '') + '" min="' + (field.min || '') + '" max="' + (field.max || '') + '" step="' + (field.step || '') + '">';
            }
            html += '</div>';
        });
        return html;
    }

    function renderFlowCoordinate(stepData) {
        var def = stepData.default || { x: 0, y: 0, z: 0 };
        return '<div class="flow-form-group"><label>Coordenadas (X, Y, Z) en mm</label><div class="flow-coords" style="grid-template-columns:1fr 1fr 1fr"><input type="number" id="coord-x" placeholder="X" value="' + (def.x || 0) + '"><input type="number" id="coord-y" placeholder="Y" value="' + (def.y || 0) + '"><input type="number" id="coord-z" placeholder="Z" value="' + (def.z || 0) + '"></div></div>';
    }

    function renderFlowCoordinateList(stepData) {
        var html = '<p style="font-size:0.8em;color:#94a3b8;margin-bottom:8px">' + (stepData.description || 'Agregue puntos') + ' (mín: ' + (stepData.minPoints || 2) + ')</p><div id="coordListContainer">';
        var pts = stepData.default || [{ x: 0, y: 0, z: 0 }, { x: 1000, y: 0, z: 0 }];
        pts.forEach(function(p, i) { html += '<div class="flow-coords" data-cidx="' + i + '"><input type="number" placeholder="X" value="' + (p.x || 0) + '" data-axis="x"><input type="number" placeholder="Y" value="' + (p.y || 0) + '" data-axis="y"><input type="number" placeholder="Z" value="' + (p.z || 0) + '" data-axis="z"><button class="af-btn af-btn-ghost" onclick="this.parentElement.remove()" style="padding:4px 6px;font-size:.7em">✕</button></div>'; });
        html += '</div><button class="af-btn af-btn-ghost" onclick="AdaptiveCommandUI.addCoordRow()" style="margin-top:6px">+ Agregar Punto</button>';
        return html;
    }

    function renderFlowText(stepData) {
        return '<div class="flow-form-group"><input type="text" id="flow-text-input" placeholder="' + (stepData.placeholder || '') + '" value="' + (stepData.default || '') + '" class="flow-search"></div>';
    }

    function renderFlowNumber(stepData) {
        return '<div class="flow-form-group"><input type="number" id="flow-number-input" value="' + (stepData.default || 0) + '" min="' + (stepData.min || '') + '" max="' + (stepData.max || '') + '" step="' + (stepData.step || '1') + '"></div>';
    }

    function renderFlowSlider(stepData) {
        return '<div class="flow-form-group"><label>' + (stepData.title || 'Valor') + '</label><div class="flow-slider-row"><input type="range" id="flow-slider" min="' + (stepData.min || 0) + '" max="' + (stepData.max || 1) + '" step="' + (stepData.step || 0.01) + '" value="' + (stepData.default || 0.5) + '" oninput="document.getElementById(\'flow-slider-val\').textContent = this.value"><span class="flow-slider-val" id="flow-slider-val">' + (stepData.default || 0.5) + '</span></div></div>';
    }

    function renderFlowConfirm(stepData) {
        return '<div class="flow-confirm">' + (stepData.message || '¿Confirmar esta acción?') + '</div>';
    }

    function renderFlowInfo(stepData) {
        return '<div style="text-align:center;padding:20px;color:var(--accent-cyan,#00f2ff);white-space:pre-line;font-size:.9em">' + (stepData.message || '') + '</div>';
    }

    function renderFlowDynamic(stepData) {
        if (stepData.resolver) {
            var flowData = AdaptiveCommandSystem.getCurrentStepData();
            var selections = flowData ? flowData.selections : {};
            var resolved = stepData.resolver(selections);
            if (resolved.type === 'coordinate') return renderFlowCoordinate({ default: resolved.default });
            else if (resolved.type === 'number') return renderFlowNumber({ default: resolved.default, min: resolved.min, max: resolved.max, step: resolved.step });
        }
        return renderFlowText(stepData);
    }

    function selectFlowOption(value, element) {
        document.querySelectorAll('#flowSelectList .flow-select-item').forEach(function(item) { item.classList.remove('selected'); });
        if (element) element.classList.add('selected');
        var nextData = AdaptiveCommandSystem.nextStep(value);
        handleNextStep(nextData);
    }

    function toggleMultiSelect(value, element) {
        element.classList.toggle('selected');
        var check = element.querySelector('.multi-check');
        if (check) check.style.display = element.classList.contains('selected') ? 'inline' : 'none';
    }

    function confirmMultiSelect() {
        var selected = [];
        document.querySelectorAll('#flowMultiSelectList .flow-select-item.selected').forEach(function(item) { selected.push(item.dataset.value); });
        var minSelect = currentFlow ? (currentFlow.minSelect || 1) : 1;
        if (selected.length < minSelect) { showToast('Seleccione al menos ' + minSelect + ' elemento(s)', 'err'); return; }
        var nextData = AdaptiveCommandSystem.nextStep(selected);
        handleNextStep(nextData);
    }

    function flowNext() {
        if (!currentFlow) return;
        var value = null;
        if (currentFlow.type === 'form') {
            value = {};
            document.querySelectorAll('[data-field]').forEach(function(input) {
                var field = input.dataset.field;
                if (input.type === 'checkbox') value[field] = input.checked;
                else value[field] = input.type === 'number' ? (parseFloat(input.value) || 0) : input.value;
            });
        } else if (currentFlow.type === 'coordinate') {
            value = { x: parseFloat((document.getElementById('coord-x')||{}).value || 0), y: parseFloat((document.getElementById('coord-y')||{}).value || 0), z: parseFloat((document.getElementById('coord-z')||{}).value || 0) };
        } else if (currentFlow.type === 'coordinateList') {
            value = [];
            document.querySelectorAll('#coordListContainer .flow-coords').forEach(function(row) { value.push({ x: parseFloat((row.querySelector('[data-axis="x"]')||{}).value || 0), y: parseFloat((row.querySelector('[data-axis="y"]')||{}).value || 0), z: parseFloat((row.querySelector('[data-axis="z"]')||{}).value || 0) }); });
        } else if (currentFlow.type === 'text') {
            var textInput = document.getElementById('flow-text-input');
            value = textInput ? textInput.value : '';
        } else if (currentFlow.type === 'number') {
            var numInput = document.getElementById('flow-number-input');
            value = numInput ? (parseFloat(numInput.value) || 0) : 0;
        } else if (currentFlow.type === 'slider') {
            var slider = document.getElementById('flow-slider');
            value = slider ? slider.value : '0.5';
        } else if (currentFlow.type === 'confirm') {
            value = true;
        }
        var nextData = AdaptiveCommandSystem.nextStep(value);
        handleNextStep(nextData);
    }

    function handleNextStep(nextData) {
        if (!nextData) { renderAssistedGrid(); return; }
        if (nextData.finished) {
            if (nextData.executeImmediately && nextData.command) { executeTextCommand(nextData.command); renderAssistedGrid(); }
            else if (nextData.command) {
                currentFlow = { type: 'confirm', title: nextData.title || 'Confirmar', commandPath: currentFlow ? currentFlow.commandPath : '', isFinal: true, command: nextData.command, executeImmediately: nextData.executeImmediately, commandName: nextData.commandName || (currentFlow ? currentFlow.commandName : ''), commandIcon: nextData.commandIcon || (currentFlow ? currentFlow.commandIcon : ''), progress: 100 };
                renderFlowStep(); return;
            }
            renderAssistedGrid(); return;
        }
        currentFlow = nextData;
        renderFlowStep();
    }

    function flowBack() {
        if (!currentFlow) { renderAssistedGrid(); return; }
        var prevData = AdaptiveCommandSystem.previousStep();
        if (prevData) { currentFlow = prevData; renderFlowStep(); }
        else { renderAssistedGrid(); }
    }

    function cancelFlow() { AdaptiveCommandSystem.resetFlow(); currentFlow = null; renderAssistedGrid(); }

    function executeFlowCommand() {
        var cmd = null;
        if (currentFlow && currentFlow.command) { cmd = currentFlow.command; }
        else {
            var stepData = AdaptiveCommandSystem.getCurrentStepData();
            if (stepData && stepData.command) cmd = stepData.command;
        }
        if (!cmd && currentFlow && currentFlow.commandPath) {
            var flow = AdaptiveCommandSystem.COMMAND_FLOWS[currentFlow.commandPath];
            if (flow) {
                var finalStep = flow.steps.find(function(s) { return s.isFinal && s.buildCommand; });
                if (finalStep && finalStep.buildCommand) { var selections = AdaptiveCommandSystem.getSelections ? AdaptiveCommandSystem.getSelections() : {}; cmd = finalStep.buildCommand(null, selections); }
            }
        }
        if (cmd) { executeTextCommand(cmd); showToast('✅ Comando ejecutado', 'ok'); renderAssistedGrid(); }
        else { showToast('❌ No se pudo construir el comando', 'err'); }
    }

    function filterFlowItems() {
        var search = (document.getElementById('flow-search')||{}).value || '';
        document.querySelectorAll('#flowSelectList .flow-select-item, #flowMultiSelectList .flow-select-item').forEach(function(item) { item.style.display = (item.dataset.search || '').includes(search.toLowerCase()) ? '' : 'none'; });
    }

    function addCoordRow() {
        var container = document.getElementById('coordListContainer');
        if (!container) return;
        var row = document.createElement('div');
        row.className = 'flow-coords';
        row.innerHTML = '<input type="number" placeholder="X" value="0" data-axis="x"><input type="number" placeholder="Y" value="0" data-axis="y"><input type="number" placeholder="Z" value="0" data-axis="z"><button class="af-btn af-btn-ghost" onclick="this.parentElement.remove()" style="padding:4px 6px;font-size:.7em">✕</button>';
        container.appendChild(row);
    }

    function renderTextMode() {
        updateTitle('Comandos de Texto');
        currentFlow = null;
        document.getElementById('adaptive-body').innerHTML = '<div class="mode-tabs"><button class="mode-tab" data-mode="assisted" onclick="AdaptiveCommandUI.switchTab(\'assisted\')">🧭 Asistido</button><button class="mode-tab active" data-mode="text" onclick="AdaptiveCommandUI.switchTab(\'text\')">⌨️ Texto</button></div><div class="text-console-output" id="textConsoleOutput"><div class="tco-line tco-info">💡 Consola de comandos. Escriba y presione Enter o ▶</div><div class="tco-line tco-info">   Escriba "help" para ver todos los comandos disponibles.</div></div><div class="text-input-area"><input type="text" id="textCommandInput" placeholder="PFD: create stream S1 from TK-01 to B-01 fluid WATER&#10;DTI: create instrument PI-101 type PRESSURE_GAUGE on L-1 at 0.3&#10;3D:  create tanque_v TK-01 at (5000,1450,0) diam 2380 altura 2900&#10;VAL: validate all | project summary | export db" onkeydown="if(event.key===\'Enter\')AdaptiveCommandUI.executeTextInput()"><button onclick="AdaptiveCommandUI.executeTextInput()">▶</button></div><div class="text-hints"><strong>📊 PFD:</strong> create equipo TIPO TAG | create stream TAG from X to Y fluid Z flow N<br><strong>🔧 DTI:</strong> create instrument TAG type TIPO on LINEA at POS range RANGO<br><strong>🧊 3D:</strong> create [tipo] [tag] at (x,y,z) diam D altura H<br><strong>🔗 Conectar:</strong> connect ORIGEN PUERTO to DESTINO PUERTO diameter D<br><strong>🔍 Validar:</strong> validate all | validate pfd | validate dti | project summary<br><strong>📁 Exportar:</strong> export pcf | export mto | export json | export db</div>';
        document.getElementById('adaptive-footer').innerHTML = '<button class="af-btn af-btn-ghost" onclick="AdaptiveCommandUI.runQuickCommand(\'help\')">❓ Ayuda</button><button class="af-btn af-btn-ghost" onclick="AdaptiveCommandUI.runQuickCommand(\'validate all\')">🔍 Validar</button><button class="af-btn af-btn-ghost" onclick="AdaptiveCommandUI.runQuickCommand(\'project summary\')">📋 Resumen</button><button class="af-btn af-btn-danger" onclick="AdaptiveCommandUI.closeOverlay()">Cerrar</button>';
        setTimeout(function() { var input = document.getElementById('textCommandInput'); if (input) input.focus(); }, 100);
    }

    function executeTextInput() {
        var input = document.getElementById('textCommandInput');
        if (!input) return;
        var cmd = input.value.trim();
        if (!cmd) return;
        addConsoleLine(cmd, 'cmd');
        executeTextCommand(cmd);
        input.value = '';
        input.focus();
    }

    function addConsoleLine(text, type) {
        var consoleEl = document.getElementById('textConsoleOutput');
        if (!consoleEl) return;
        var line = document.createElement('div');
        line.className = 'tco-line tco-' + (type || 'info');
        line.textContent = (type === 'cmd' ? '> ' : '') + text;
        consoleEl.appendChild(line);
        consoleEl.scrollTop = consoleEl.scrollHeight;
    }

    function executeTextCommand(cmd) {
        if (!cmd) return;
        if (typeof SmartFlowCommands !== 'undefined' && typeof SmartFlowCommands.executeCommand === 'function') {
            var result = SmartFlowCommands.executeCommand(cmd);
            if (result) { addConsoleLine('✅ Ejecutado correctamente', 'ok'); showToast('Comando ejecutado', 'ok'); }
            else { addConsoleLine('❌ Comando no reconocido', 'err'); showToast('Comando no reconocido', 'err'); }
        } else {
            var textarea = document.getElementById('commandText');
            if (textarea) { textarea.value = cmd; var runBtn = document.getElementById('runCommands'); if (runBtn) runBtn.click(); }
        }
    }

    function runQuickCommand(cmd) { executeTextCommand(cmd); }

    function showToast(msg, type) {
        var existing = document.querySelector('.adaptive-toast');
        if (existing) existing.remove();
        var toast = document.createElement('div');
        toast.className = 'adaptive-toast ' + type;
        toast.textContent = msg;
        document.body.appendChild(toast);
        setTimeout(function() { toast.remove(); }, 2500);
    }

    return {
        openPanel: openPanel, closeOverlay: closeOverlay, switchTab: switchTab,
        filterCategory: filterCategory, startFlow: startFlow, flowNext: flowNext,
        flowBack: flowBack, cancelFlow: cancelFlow, executeFlowCommand: executeFlowCommand,
        selectFlowOption: selectFlowOption, toggleMultiSelect: toggleMultiSelect,
        confirmMultiSelect: confirmMultiSelect, filterFlowItems: filterFlowItems,
        addCoordRow: addCoordRow, executeTextInput: executeTextInput,
        executeTextCommand: executeTextCommand, runQuickCommand: runQuickCommand,
        showToast: showToast, getModuleCommands: getModuleCommands,
        switchModule: function(module) {
            if (typeof window.switchModule === 'function') window.switchModule(module);
            window.currentModule = module;
            setTimeout(function() { renderAssistedGrid(); }, 150);
        }
    };
})();
