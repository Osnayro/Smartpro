
// ============================================================
// SMARTFLOW ASSISTANT UI v2.0
// Interfaz visual del sistema de comandos asistido
// Dependencias: SmartFlowAssistant.js, SmartFlowCommands.js
// ============================================================

const SmartFlowAssistantUI = (function() {
    
    let currentMode = 'assisted';
    let currentFlow = null;
    let activeCategory = 'all';

    function injectStyles() {
        const styleId = 'smartflow-assistant-styles';
        if (document.getElementById(styleId)) return;
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            #assistant-overlay {
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(2, 6, 23, 0.85); z-index: 8000;
                display: flex; justify-content: center; align-items: center;
                backdrop-filter: blur(6px); animation: fadeIn 0.2s ease;
            }
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            #assistant-panel {
                width: 95%; max-width: 520px; max-height: 85vh;
                background: rgba(15, 23, 42, 0.98);
                border: 1px solid var(--accent-cyan, #00f2ff);
                border-radius: 16px; display: flex; flex-direction: column;
                box-shadow: 0 20px 60px rgba(0,0,0,0.7); overflow: hidden;
            }
            .assistant-header {
                display: flex; justify-content: space-between; align-items: center;
                padding: 14px 18px; border-bottom: 1px solid rgba(0,242,255,0.2);
                background: rgba(0,242,255,0.03); flex-shrink: 0;
            }
            .assistant-header h3 {
                color: var(--accent-cyan, #00f2ff); font-size: 1em; margin: 0;
                display: flex; align-items: center; gap: 8px;
            }
            .assistant-close {
                background: none; border: 1px solid rgba(255,255,255,0.2); color: #fff;
                width: 32px; height: 32px; border-radius: 50%; font-size: 18px;
                cursor: pointer; display: flex; align-items: center; justify-content: center;
                transition: all 0.2s; flex-shrink: 0;
            }
            .assistant-close:hover { background: #ef4444; border-color: #ef4444; }
            .assistant-body { flex: 1; overflow-y: auto; padding: 16px; -webkit-overflow-scrolling: touch; }
            .assistant-footer {
                padding: 12px 16px; border-top: 1px solid rgba(0,242,255,0.15);
                display: flex; justify-content: space-between; gap: 8px; flex-wrap: wrap; flex-shrink: 0;
            }
            .module-indicator {
                margin-bottom: 12px; padding: 8px 12px; background: rgba(0,242,255,0.1);
                border-radius: 8px; font-size: 0.75em; text-align: center;
            }
            .mode-tabs {
                display: flex; background: rgba(255,255,255,0.05);
                border-radius: 20px; padding: 3px; margin-bottom: 14px;
            }
            .mode-tab {
                flex: 1; text-align: center; padding: 8px 12px; border-radius: 18px;
                border: none; background: transparent; color: #94a3b8;
                font-size: 0.8em; font-weight: 600; cursor: pointer; transition: all 0.2s;
            }
            .mode-tab.active { background: var(--accent-cyan, #00f2ff); color: #000; }
            .mode-tab:hover:not(.active) { color: #fff; }
            .cmd-categories {
                display: flex; flex-wrap: wrap; gap: 5px; margin-bottom: 12px;
            }
            .cmd-cat {
                padding: 5px 10px; border-radius: 14px; font-size: 0.7em;
                border: 1px solid rgba(255,255,255,0.15); background: transparent;
                color: #94a3b8; cursor: pointer; transition: all 0.2s;
            }
            .cmd-cat.active { background: var(--accent-blue, #1e4eb8); border-color: var(--accent-cyan, #00f2ff); color: #fff; }
            .cmd-cat:hover { border-color: var(--accent-cyan, #00f2ff); }
            .cmd-grid {
                display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px;
            }
            .cmd-card {
                background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(255,255,255,0.1);
                border-radius: 10px; padding: 10px; cursor: pointer; transition: all 0.2s; text-align: center;
            }
            .cmd-card:hover { border-color: var(--accent-cyan, #00f2ff); transform: translateY(-1px); }
            .cmd-card .cmd-icon { font-size: 1.5em; margin-bottom: 4px; }
            .cmd-card .cmd-name { font-size: 0.75em; font-weight: 600; color: #e0e6ed; }
            .flow-progress {
                background: rgba(255,255,255,0.08); border-radius: 6px; height: 3px; margin-bottom: 14px; overflow: hidden;
            }
            .flow-progress-fill {
                background: linear-gradient(90deg, var(--accent-cyan, #00f2ff), var(--accent-blue, #1e4eb8));
                height: 100%; transition: width 0.3s ease;
            }
            .flow-back-btn {
                background: none; border: 1px solid rgba(255,255,255,0.2); color: #94a3b8;
                padding: 6px 12px; border-radius: 6px; font-size: 0.8em; cursor: pointer; margin-bottom: 12px;
            }
            .flow-back-btn:hover { color: #fff; border-color: #fff; }
            .flow-title { font-size: 0.95em; font-weight: 600; color: #e0e6ed; margin-bottom: 12px; }
            .flow-select-list { display: flex; flex-direction: column; gap: 4px; max-height: 45vh; overflow-y: auto; }
            .flow-select-item {
                display: flex; align-items: center; gap: 10px; padding: 10px 12px;
                background: rgba(30,41,59,0.6); border: 1px solid rgba(255,255,255,0.08);
                border-radius: 8px; cursor: pointer; transition: all 0.15s;
            }
            .flow-select-item:hover { background: rgba(0,242,255,0.1); border-color: var(--accent-cyan, #00f2ff); }
            .flow-select-item.selected { border-color: var(--accent-blue, #1e4eb8); background: rgba(30,78,184,0.2); }
            .flow-form-group { margin-bottom: 10px; }
            .flow-form-group label { display: block; font-size: 0.75em; color: #94a3b8; margin-bottom: 4px; }
            .flow-form-group input, .flow-form-group select {
                width: 100%; padding: 10px 12px; background: #0f172a;
                border: 1px solid #334155; border-radius: 8px; color: #e0e6ed;
                font-size: 0.9em; outline: none;
            }
            .flow-form-group input:focus, .flow-form-group select:focus { border-color: var(--accent-cyan, #00f2ff); }
            .flow-coords {
                display: grid; grid-template-columns: 1fr 1fr 1fr auto; gap: 6px; margin-bottom: 6px;
            }
            .flow-coords input { text-align: center; }
            .flow-slider-row { display: flex; align-items: center; gap: 8px; }
            .flow-slider-row input[type="range"] { flex: 1; }
            .flow-slider-val { color: var(--accent-cyan, #00f2ff); font-weight: 600; font-size: 0.85em; min-width: 30px; }
            .flow-confirm {
                text-align: center; padding: 20px; background: rgba(248,81,73,0.08);
                border: 1px solid rgba(248,81,73,0.3); border-radius: 10px;
                color: #fca5a5; font-size: 0.9em; line-height: 1.5; white-space: pre-line;
            }
            .flow-preview {
                margin-top: 12px; padding: 10px 14px; background: rgba(0,0,0,0.4);
                border-radius: 8px; border: 1px solid rgba(255,255,255,0.08);
            }
            .flow-preview code { color: var(--accent-cyan, #00f2ff); font-family: monospace; font-size: 0.8em; }
            .flow-search {
                width: 100%; padding: 8px 12px; background: #0f172a;
                border: 1px solid #334155; border-radius: 8px; color: #e0e6ed;
                font-size: 0.85em; margin-bottom: 8px; outline: none;
            }
            .flow-search:focus { border-color: var(--accent-cyan, #00f2ff); }
            .text-console-output {
                background: rgba(0,0,0,0.4); border-radius: 8px; padding: 10px;
                max-height: 25vh; overflow-y: auto; margin-bottom: 10px;
                font-family: monospace; font-size: 0.75em;
            }
            .text-console-output .tco-cmd { color: var(--accent-cyan, #00f2ff); }
            .text-console-output .tco-ok { color: #3fb950; }
            .text-console-output .tco-err { color: #f85149; }
            .text-input-area { display: flex; gap: 6px; }
            .text-input-area input {
                flex: 1; padding: 10px 12px; background: #0f172a;
                border: 1px solid #334155; border-radius: 8px; color: #e0e6ed;
                font-family: monospace; font-size: 0.85em; outline: none;
            }
            .text-input-area input:focus { border-color: var(--accent-cyan, #00f2ff); }
            .text-input-area button {
                padding: 10px 14px; background: var(--accent-blue, #1e4eb8);
                border: none; border-radius: 8px; color: #fff; font-weight: 600; cursor: pointer;
            }
            .af-btn {
                padding: 8px 16px; border-radius: 6px; border: none;
                font-size: 0.8em; font-weight: 600; cursor: pointer; transition: all 0.2s;
            }
            .af-btn-primary { background: var(--accent-blue, #1e4eb8); color: #fff; }
            .af-btn-primary:hover { background: #2563eb; }
            .af-btn-success { background: #238636; color: #fff; }
            .af-btn-success:hover { background: #2ea043; }
            .af-btn-ghost { background: transparent; color: #94a3b8; border: 1px solid rgba(255,255,255,0.15); }
            .af-btn-ghost:hover { color: #fff; border-color: #fff; }
            .af-btn-danger { background: transparent; color: #f87171; border: 1px solid rgba(248,113,113,0.3); }
            .af-btn-danger:hover { background: rgba(248,113,113,0.1); }
            .assistant-toast {
                position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
                padding: 10px 20px; border-radius: 8px; z-index: 9000;
                font-size: 0.85em; font-weight: 600; pointer-events: none;
                animation: slideUp 0.3s ease;
            }
            .assistant-toast.ok { background: #1a3a2a; color: #3fb950; border: 1px solid #3fb950; }
            .assistant-toast.err { background: #3a1a1a; color: #f85149; border: 1px solid #f85149; }
            @keyframes slideUp { from { transform: translate(-50%, 20px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
        `;
        document.head.appendChild(style);
    }

    function createOverlay() {
        const existing = document.getElementById('assistant-overlay');
        if (existing) existing.remove();
        const overlay = document.createElement('div');
        overlay.id = 'assistant-overlay';
        overlay.innerHTML = `
            <div id="assistant-panel">
                <div class="assistant-header">
                    <h3>🤖 <span id="assistant-title">Comandos Inteligentes</span></h3>
                    <button class="assistant-close" id="assistant-close">✕</button>
                </div>
                <div class="assistant-body" id="assistant-body"></div>
                <div class="assistant-footer" id="assistant-footer"></div>
            </div>
        `;
        document.body.appendChild(overlay);
        document.getElementById('assistant-close').addEventListener('click', closeOverlay);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) closeOverlay(); });
        return overlay;
    }

    function closeOverlay() {
        const overlay = document.getElementById('assistant-overlay');
        if (overlay) {
            overlay.style.opacity = '0';
            setTimeout(() => overlay.remove(), 200);
        }
        currentFlow = null;
        if (typeof SmartFlowAssistant !== 'undefined') SmartFlowAssistant.resetFlow();
    }

    function openPanel() {
        injectStyles();
        createOverlay();
        currentMode = 'assisted';
        currentFlow = null;
        if (typeof SmartFlowAssistant !== 'undefined') SmartFlowAssistant.resetFlow();
        renderAssistedGrid();
    }

    function updateTitle(title) {
        const el = document.getElementById('assistant-title');
        if (el) el.textContent = title || 'Comandos Inteligentes';
    }

    function getAvailableCommandsFiltered() {
        if (typeof SmartFlowAssistant === 'undefined') return [];
        return SmartFlowAssistant.getAvailableCommands();
    }

    function renderAssistedGrid() {
        updateTitle('Comandos Inteligentes');
        currentFlow = null;
        if (typeof SmartFlowAssistant !== 'undefined') SmartFlowAssistant.resetFlow();

        const currentModule = (typeof SmartFlowAssistant !== 'undefined') ? SmartFlowAssistant.getModule() : 'ISOMETRIC';
        const commandsByCat = (typeof SmartFlowAssistant !== 'undefined') ? SmartFlowAssistant.getCommandsByCategory() : {};
        const allCmds = getAvailableCommandsFiltered();

        const catNames = {
            'config': '⚙️ Configuración', 'create': '🏗️ Crear', 'connect': '🔗 Conectar',
            'edit': '✏️ Editar', 'query': '🔍 Consultar', 'utility': '📦 Utilidades',
            'direct': '⚡ Rápidos', 'pfd': '📊 P&ID', 'dti': '🔧 DTI'
        };

        let bodyHtml = `
            <div class="module-indicator">
                📁 Módulo actual: <strong>${currentModule}</strong>
                ${currentModule !== 'ISOMETRIC' ? '<span style="color: #f59e0b;"> (Comandos filtrados)</span>' : ''}
            </div>
            <div class="mode-tabs">
                <button class="mode-tab active" data-mode="assisted" onclick="SmartFlowAssistantUI.switchTab('assisted')">🧭 Asistido</button>
                <button class="mode-tab" data-mode="text" onclick="SmartFlowAssistantUI.switchTab('text')">⌨️ Texto</button>
            </div>
            <div class="cmd-categories">
                <button class="cmd-cat active" data-cat="all" onclick="SmartFlowAssistantUI.filterCategory('all')">📋 Todos (${allCmds.length})</button>
        `;

        Object.entries(commandsByCat).forEach(([cat, cmds]) => {
            bodyHtml += `<button class="cmd-cat" data-cat="${cat}" onclick="SmartFlowAssistantUI.filterCategory('${cat}')">${catNames[cat] || cat} (${cmds.length})</button>`;
        });

        bodyHtml += `</div><div class="cmd-grid" id="cmdGrid">${renderCmdCards(allCmds)}</div>`;
        document.getElementById('assistant-body').innerHTML = bodyHtml;

        document.getElementById('assistant-footer').innerHTML = `
            <button class="af-btn af-btn-ghost" onclick="SmartFlowAssistantUI.runQuickCommand('undo')">↩️ Deshacer</button>
            <button class="af-btn af-btn-ghost" onclick="SmartFlowAssistantUI.runQuickCommand('redo')">↪️ Rehacer</button>
            <button class="af-btn af-btn-ghost" onclick="SmartFlowAssistantUI.runQuickCommand('help')">❓ Ayuda</button>
            <button class="af-btn af-btn-danger" onclick="SmartFlowAssistantUI.closeOverlay()">Cerrar</button>
        `;
    }

    function renderCmdCards(cmds) {
        return cmds.map(cmd => `
            <div class="cmd-card" data-category="${cmd.category}" onclick="SmartFlowAssistantUI.startFlow('${cmd.command}')">
                <div class="cmd-icon">${cmd.icon}</div>
                <div class="cmd-name">${cmd.name}</div>
            </div>
        `).join('');
    }

    function filterCategory(cat) {
        activeCategory = cat;
        document.querySelectorAll('.cmd-cat').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.cat === cat);
        });
        document.querySelectorAll('.cmd-card').forEach(card => {
            card.style.display = (cat === 'all' || card.dataset.category === cat) ? '' : 'none';
        });
    }

    function switchTab(mode) {
        currentMode = mode;
        document.querySelectorAll('.mode-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.mode === mode);
        });
        if (mode === 'assisted') renderAssistedGrid();
        else renderTextMode();
    }

    function startFlow(commandPath) {
        if (typeof SmartFlowAssistant === 'undefined') return;
        if (SmartFlowAssistant.DIRECT_COMMANDS && SmartFlowAssistant.DIRECT_COMMANDS[commandPath]) {
            const cmd = SmartFlowAssistant.DIRECT_COMMANDS[commandPath].command;
            executeTextCommand(cmd);
            return;
        }
        const stepData = SmartFlowAssistant.startCommandFlow(commandPath);
        if (!stepData) { showToast('Comando no disponible', 'err'); return; }
        if (stepData.direct) { executeTextCommand(stepData.command); return; }
        currentFlow = stepData;
        renderFlowStep();
    }

    function renderFlowStep() {
        if (!currentFlow) { renderAssistedGrid(); return; }
        updateTitle(`${currentFlow.commandIcon} ${currentFlow.commandName}`);
        let bodyHtml = `
            <div class="flow-progress"><div class="flow-progress-fill" style="width:${currentFlow.progress || 0}%"></div></div>
            <button class="flow-back-btn" onclick="SmartFlowAssistantUI.flowBack()">← Volver</button>
            <div class="flow-title">${currentFlow.title || ''}</div>
        `;
        switch (currentFlow.type) {
            case 'select': bodyHtml += renderFlowSelect(currentFlow, false); break;
            case 'dynamicSelect': bodyHtml += renderFlowSelect(currentFlow, true); break;
            case 'form': bodyHtml += renderFlowForm(currentFlow); break;
            case 'coordinate': bodyHtml += renderFlowCoordinate(currentFlow); break;
            case 'coordinateList': bodyHtml += renderFlowCoordinateList(currentFlow); break;
            case 'text': bodyHtml += renderFlowText(currentFlow); break;
            case 'slider': bodyHtml += renderFlowSlider(currentFlow); break;
            case 'confirm': bodyHtml += renderFlowConfirm(currentFlow); break;
            case 'info': bodyHtml += renderFlowInfo(currentFlow); break;
            default: bodyHtml += `<p style="color:#94a3b8">Paso: ${currentFlow.type}</p>`;
        }
        if (currentFlow.isFinal && currentFlow.command) {
            bodyHtml += `<div class="flow-preview"><code>📝 ${currentFlow.command}</code></div>`;
        }
        document.getElementById('assistant-body').innerHTML = bodyHtml;
        
        let isFinalStep = currentFlow.isFinal || false;
        document.getElementById('assistant-footer').innerHTML = `
            <button class="af-btn af-btn-ghost" onclick="SmartFlowAssistantUI.flowBack()" ${(currentFlow.stepIndex || 0) === 0 ? 'disabled' : ''}>← Anterior</button>
            <button class="af-btn af-btn-danger" onclick="SmartFlowAssistantUI.cancelFlow()">Cancelar</button>
            ${isFinalStep ? '<button class="af-btn af-btn-success" onclick="SmartFlowAssistantUI.executeFlowCommand()">✅ Ejecutar</button>' : '<button class="af-btn af-btn-primary" onclick="SmartFlowAssistantUI.flowNext()">Siguiente →</button>'}
        `;
        
        setTimeout(() => { const search = document.getElementById('flow-search'); if (search) search.focus(); }, 100);
        
        setTimeout(() => {
            const materialField = document.getElementById('field-material');
            if (materialField) {
                materialField.addEventListener('change', function() { refreshSpecField(); });
            }
        }, 50);
    }

    function renderFlowSelect(stepData, searchable) {
        const options = stepData.options || [];
        let html = searchable ? `<input type="text" class="flow-search" id="flow-search" placeholder="🔍 Buscar... (${options.length} opciones)" oninput="SmartFlowAssistantUI.filterFlowItems()">` : '';
        html += `<div class="flow-select-list" id="flowSelectList">`;
        options.forEach(opt => {
            const statusClass = opt.status === 'open' ? '🟢' : (opt.connectedTo ? '🔴' : '');
            html += `<div class="flow-select-item" data-value="${opt.value}" data-search="${(opt.label || '').toLowerCase()}" onclick="SmartFlowAssistantUI.selectFlowOption('${opt.value}', this)">
                        ${opt.icon ? `<span class="fsi-icon">${opt.icon}</span>` : '<span class="fsi-icon">📦</span>'}
                        <div class="fsi-label">${opt.label} ${statusClass}</div>
                        ${opt.description ? `<div class="fsi-desc">${opt.description}</div>` : ''}
                    </div>`;
        });
        html += `</div>`;
        return html;
    }

    function renderFlowForm(stepData) {
        let html = '';
        (stepData.fields || []).forEach(field => {
            html += `<div class="flow-form-group"><label>${field.label}</label>`;
            if (field.type === 'select') {
                html += `<select id="field-${field.id}" data-field="${field.id}">`;
                let opts = field.options;
                if (typeof opts === 'function') opts = opts(null, stepData.selections || {});
                (opts || []).forEach(opt => {
                    const val = typeof opt === 'object' ? opt.value : opt;
                    const lbl = typeof opt === 'object' ? (opt.label || opt.value) : opt;
                    html += `<option value="${val}">${lbl}</option>`;
                });
                html += `</select>`;
            } else if (field.type === 'checkbox') {
                html += `<input type="checkbox" id="field-${field.id}" data-field="${field.id}" ${field.default ? 'checked' : ''}>`;
            } else {
                html += `<input type="${field.type}" id="field-${field.id}" data-field="${field.id}" value="${field.default || ''}" placeholder="${field.placeholder || ''}" ${field.min !== undefined ? `min="${field.min}"` : ''} ${field.max !== undefined ? `max="${field.max}"` : ''}>`;
            }
            html += `</div>`;
        });
        return html;
    }

    function renderFlowCoordinate(stepData) {
        const def = stepData.default || { x: 0, y: 0, z: 0 };
        return `<div class="flow-form-group"><label>Coordenadas (X, Y, Z) mm</label>
                <div class="flow-coords"><input type="number" id="coord-x" placeholder="X" value="${def.x || 0}">
                <input type="number" id="coord-y" placeholder="Y" value="${def.y || 0}">
                <input type="number" id="coord-z" placeholder="Z" value="${def.z || 0}"></div></div>`;
    }

    function renderFlowCoordinateList(stepData) {
        let html = `<p style="font-size:0.8em;color:#94a3b8;margin-bottom:8px">${stepData.description || 'Agregue puntos'} (mín: ${stepData.minPoints || 2})</p><div id="coordListContainer">`;
        const pts = stepData.default || [{ x: 0, y: 0, z: 0 }, { x: 1000, y: 0, z: 0 }];
        pts.forEach((p, i) => {
            html += `<div class="flow-coords" data-cidx="${i}"><input type="number" placeholder="X" value="${p.x || 0}" data-axis="x">
                    <input type="number" placeholder="Y" value="${p.y || 0}" data-axis="y">
                    <input type="number" placeholder="Z" value="${p.z || 0}" data-axis="z">
                    <button class="af-btn af-btn-ghost" onclick="this.parentElement.remove()" style="padding:4px 6px;font-size:0.7em">✕</button></div>`;
        });
        html += `</div><button class="af-btn af-btn-ghost" onclick="SmartFlowAssistantUI.addCoordRow()" style="margin-top:6px">+ Agregar Punto</button>`;
        return html;
    }

    function renderFlowText(stepData) {
        return `<div class="flow-form-group"><input type="text" id="flow-text-input" placeholder="${stepData.placeholder || ''}" value="${stepData.default || ''}" class="flow-search"></div>`;
    }

    function renderFlowSlider(stepData) {
        return `<div class="flow-form-group"><label>${stepData.title || 'Valor'}</label>
                <div class="flow-slider-row"><input type="range" id="flow-slider" min="${stepData.min || 0}" max="${stepData.max || 1}" step="${stepData.step || 0.01}" value="${stepData.default || 0.5}" oninput="document.getElementById('flow-slider-val').textContent = this.value">
                <span class="flow-slider-val" id="flow-slider-val">${stepData.default || 0.5}</span></div></div>`;
    }

    function renderFlowConfirm(stepData) {
        return `<div class="flow-confirm">${stepData.message || '¿Confirmar esta acción?'}</div>`;
    }

    function renderFlowInfo(stepData) {
        return `<div style="text-align:center;padding:20px;color:var(--accent-cyan, #00f2ff);white-space:pre-line;font-size:0.9em">${stepData.message || ''}</div>`;
    }

    function selectFlowOption(value, element) {
        document.querySelectorAll('#flowSelectList .flow-select-item').forEach(item => item.classList.remove('selected'));
        if (element) element.classList.add('selected');
        if (typeof SmartFlowAssistant !== 'undefined') {
            const nextData = SmartFlowAssistant.nextStep(value);
            handleNextStep(nextData);
        }
    }

    function handleNextStep(nextData) {
        if (!nextData) { renderAssistedGrid(); return; }
        if (nextData.finished) {
            if (nextData.executeImmediately && nextData.command) {
                executeTextCommand(nextData.command);
                renderAssistedGrid();
            } else if (nextData.command) {
                currentFlow = {
                    ...currentFlow,
                    isFinal: true,
                    command: nextData.command,
                    commandName: nextData.commandName || currentFlow.commandName,
                    commandIcon: nextData.commandIcon || currentFlow.commandIcon,
                    progress: 100
                };
                renderFlowStep();
                return;
            }
            renderAssistedGrid();
            return;
        }
        currentFlow = nextData;
        renderFlowStep();
    }

    function flowNext() {
        if (!currentFlow) return;
        let value = null;
        if (currentFlow.type === 'form') {
            value = {};
            document.querySelectorAll('[data-field]').forEach(input => {
                const field = input.dataset.field;
                if (input.type === 'checkbox') value[field] = input.checked;
                else if (input.type === 'number') value[field] = parseFloat(input.value) || 0;
                else value[field] = input.value;
            });
        } else if (currentFlow.type === 'coordinate') {
            value = {
                x: parseFloat(document.getElementById('coord-x')?.value || 0),
                y: parseFloat(document.getElementById('coord-y')?.value || 0),
                z: parseFloat(document.getElementById('coord-z')?.value || 0)
            };
        } else if (currentFlow.type === 'coordinateList') {
            value = [];
            document.querySelectorAll('#coordListContainer .flow-coords').forEach(row => {
                value.push({
                    x: parseFloat(row.querySelector('[data-axis="x"]')?.value || 0),
                    y: parseFloat(row.querySelector('[data-axis="y"]')?.value || 0),
                    z: parseFloat(row.querySelector('[data-axis="z"]')?.value || 0)
                });
            });
        } else if (currentFlow.type === 'text') {
            value = document.getElementById('flow-text-input')?.value || '';
        } else if (currentFlow.type === 'slider') {
            value = document.getElementById('flow-slider')?.value || '0.5';
        } else if (currentFlow.type === 'confirm') {
            value = true;
        }
        if (typeof SmartFlowAssistant !== 'undefined') {
            const nextData = SmartFlowAssistant.nextStep(value);
            handleNextStep(nextData);
        }
    }

    function flowBack() {
        if (!currentFlow) { renderAssistedGrid(); return; }
        if (typeof SmartFlowAssistant !== 'undefined') {
            const prevData = SmartFlowAssistant.previousStep();
            if (prevData) { currentFlow = prevData; renderFlowStep(); }
            else renderAssistedGrid();
        }
    }

    function cancelFlow() {
        if (typeof SmartFlowAssistant !== 'undefined') SmartFlowAssistant.resetFlow();
        currentFlow = null;
        renderAssistedGrid();
    }

    function executeFlowCommand() {
        let cmd = currentFlow?.command;
        if (!cmd && typeof SmartFlowAssistant !== 'undefined') {
            const stepData = SmartFlowAssistant.getCurrentStepData();
            if (stepData && stepData.command) cmd = stepData.command;
        }
        if (cmd) {
            executeTextCommand(cmd);
            showToast('✅ Comando ejecutado', 'ok');
            renderAssistedGrid();
        } else {
            showToast('❌ No se pudo construir el comando', 'err');
        }
    }

    function filterFlowItems() {
        const search = document.getElementById('flow-search')?.value?.toLowerCase() || '';
        document.querySelectorAll('#flowSelectList .flow-select-item').forEach(item => {
            const searchText = item.dataset.search || '';
            item.style.display = searchText.includes(search) ? '' : 'none';
        });
        document.querySelectorAll('.flow-cat-header').forEach(header => {
            let hasVisible = false;
            let next = header.nextElementSibling;
            while (next && !next.classList.contains('flow-cat-header')) {
                if (next.style.display !== 'none') hasVisible = true;
                next = next.nextElementSibling;
            }
            header.style.display = hasVisible ? '' : 'none';
        });
    }

    function addCoordRow() {
        const container = document.getElementById('coordListContainer');
        if (!container) return;
        const idx = container.children.length;
        const row = document.createElement('div');
        row.className = 'flow-coords';
        row.dataset.cidx = idx;
        row.innerHTML = `<input type="number" placeholder="X" value="0" data-axis="x">
                        <input type="number" placeholder="Y" value="0" data-axis="y">
                        <input type="number" placeholder="Z" value="0" data-axis="z">
                        <button class="af-btn af-btn-ghost" onclick="this.parentElement.remove()" style="padding:4px 6px;font-size:0.7em">✕</button>`;
        container.appendChild(row);
    }

    function refreshSpecField() {
        const materialField = document.getElementById('field-material');
        const specSelect = document.getElementById('field-spec');
        if (!specSelect || !materialField) return;
        const material = materialField.value;
        let specs = [];
        if (typeof SmartFlowAssistant !== 'undefined') specs = SmartFlowAssistant.getSpecOptions(material);
        specSelect.innerHTML = '<option value="">Seleccionar...</option>';
        specs.forEach(spec => {
            const opt = document.createElement('option');
            opt.value = spec.value;
            opt.textContent = spec.label;
            specSelect.appendChild(opt);
        });
    }

    function renderTextMode() {
        updateTitle('Comandos de Texto');
        currentFlow = null;
        document.getElementById('assistant-body').innerHTML = `
            <div class="mode-tabs">
                <button class="mode-tab" data-mode="assisted" onclick="SmartFlowAssistantUI.switchTab('assisted')">🧭 Asistido</button>
                <button class="mode-tab active" data-mode="text" onclick="SmartFlowAssistantUI.switchTab('text')">⌨️ Texto</button>
            </div>
            <div class="text-console-output" id="textConsoleOutput">
                <div class="tco-cmd">💡 Consola de comandos. Escriba y presione Enter o ▶</div>
                <div class="tco-cmd">   Escriba "help" para ver todos los comandos disponibles.</div>
                <div class="tco-cmd">   Ej: create tanque_v TK-01 at (1000,2000,0) diam 1500 altura 2000</div>
            </div>
            <div class="text-input-area">
                <input type="text" id="textCommandInput" placeholder="Ej: create tanque_v TK-01 at (1000,2000,0) diam 1500" onkeydown="if(event.key==='Enter')SmartFlowAssistantUI.executeTextInput()">
                <button onclick="SmartFlowAssistantUI.executeTextInput()">▶</button>
            </div>
            <div class="flow-preview" style="margin-top:12px">
                <code>💡 Atajos: undo | redo | help | bom | audit | list equipos | list lineas</code>
            </div>
        `;
        document.getElementById('assistant-footer').innerHTML = `
            <button class="af-btn af-btn-ghost" onclick="SmartFlowAssistantUI.runQuickCommand('help')">❓ Ayuda</button>
            <button class="af-btn af-btn-ghost" onclick="SmartFlowAssistantUI.runQuickCommand('audit')">🔍 Auditar</button>
            <button class="af-btn af-btn-ghost" onclick="SmartFlowAssistantUI.runQuickCommand('bom')">📊 BOM</button>
            <button class="af-btn af-btn-ghost" onclick="SmartFlowAssistantUI.runQuickCommand('list equipos')">📋 Equipos</button>
            <button class="af-btn af-btn-danger" onclick="SmartFlowAssistantUI.closeOverlay()">Cerrar</button>
        `;
        setTimeout(() => document.getElementById('textCommandInput')?.focus(), 100);
    }

    function executeTextInput() {
        const input = document.getElementById('textCommandInput');
        if (!input) return;
        const cmd = input.value.trim();
        if (!cmd) return;
        addConsoleLine(`> ${cmd}`, 'cmd');
        executeTextCommand(cmd);
        input.value = '';
        input.focus();
    }

    function addConsoleLine(text, type) {
        const consoleEl = document.getElementById('textConsoleOutput');
        if (!consoleEl) return;
        const line = document.createElement('div');
        line.className = `tco-${type || 'cmd'}`;
        line.textContent = text;
        consoleEl.appendChild(line);
        consoleEl.scrollTop = consoleEl.scrollHeight;
    }

    function executeTextCommand(cmd) {
        if (typeof SmartFlowCommands !== 'undefined' && SmartFlowCommands.executeCommand) {
            const result = SmartFlowCommands.executeCommand(cmd);
            if (result) {
                addConsoleLine('✅ Ejecutado correctamente', 'ok');
                showToast('Comando ejecutado', 'ok');
            } else {
                addConsoleLine('❌ Comando no reconocido o sin efecto', 'err');
                showToast('Comando no reconocido', 'err');
            }
        } else {
            addConsoleLine('❌ Motor de comandos no disponible', 'err');
            showToast('Motor de comandos no disponible', 'err');
        }
    }

    function runQuickCommand(cmd) {
        executeTextCommand(cmd);
    }

    function showToast(msg, type) {
        const existing = document.querySelector('.assistant-toast');
        if (existing) existing.remove();
        const toast = document.createElement('div');
        toast.className = `assistant-toast ${type}`;
        toast.textContent = msg;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2500);
    }

    function refreshCommands() {
        if (document.getElementById('assistant-overlay')) {
            const activeMode = document.querySelector('.mode-tab.active')?.dataset.mode || 'assisted';
            if (activeMode === 'assisted') renderAssistedGrid();
        }
    }

    function getCurrentModule() {
        if (typeof SmartFlowAssistant !== 'undefined') return SmartFlowAssistant.getModule();
        return 'ISOMETRIC';
    }

    return {
        openPanel,
        closeOverlay,
        switchTab,
        filterCategory,
        startFlow,
        flowNext,
        flowBack,
        cancelFlow,
        executeFlowCommand,
        selectFlowOption,
        filterFlowItems,
        addCoordRow,
        executeTextInput,
        executeTextCommand,
        runQuickCommand,
        showToast,
        refreshSpecField,
        refreshCommands,
        getCurrentModule
    };
})();
