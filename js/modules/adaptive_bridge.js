
// ============================================================
// SMARTFLOW ADAPTIVE BRIDGE v1.0 - Puente de Comandos por Módulo
// Archivo: js/modules/adaptive_bridge.js
// Objetivo: Adaptar el sistema de comandos asistido según el
//           módulo activo (PFD, DTI, ISO) sin modificar los
//           archivos adaptiveCommands.js originales
// ============================================================

const AdaptiveBridge = (function() {
    
    let _currentModule = 'pfd';
    
    // ================================================================
    //  CATEGORÍAS DE COMANDOS POR MÓDULO
    // ================================================================
    const MODULE_COMMANDS = {
        // ═══════════════════════════════════════════
        //  PFD - DIAGRAMA DE FLUJO DE PROCESO
        // ═══════════════════════════════════════════
        'pfd': {
            title: 'Diagrama de Flujo de Proceso',
            icon: '📊',
            color: '#10b981',
            categories: [
                {
                    name: 'Equipos Lógicos',
                    icon: '📦',
                    commands: [
                        { 
                            label: 'Tanque Vertical', 
                            template: 'create equipo tanque_v {TAG}',
                            params: ['TAG'],
                            description: 'Crea un tanque vertical en el PFD'
                        },
                        { 
                            label: 'Tanque Horizontal', 
                            template: 'create equipo tanque_h {TAG}',
                            params: ['TAG'],
                            description: 'Crea un tanque horizontal en el PFD'
                        },
                        { 
                            label: 'Bomba Centrífuga', 
                            template: 'create equipo bomba {TAG}',
                            params: ['TAG'],
                            description: 'Crea una bomba en el PFD'
                        },
                        { 
                            label: 'Intercambiador de Calor', 
                            template: 'create equipo intercambiador {TAG}',
                            params: ['TAG'],
                            description: 'Crea un intercambiador en el PFD'
                        },
                        { 
                            label: 'Reactor', 
                            template: 'create equipo reactor {TAG}',
                            params: ['TAG'],
                            description: 'Crea un reactor en el PFD'
                        },
                        { 
                            label: 'Torre de Destilación', 
                            template: 'create equipo torre {TAG}',
                            params: ['TAG'],
                            description: 'Crea una torre en el PFD'
                        },
                        { 
                            label: 'Compresor', 
                            template: 'create equipo compresor {TAG}',
                            params: ['TAG'],
                            description: 'Crea un compresor en el PFD'
                        },
                        { 
                            label: 'Separador', 
                            template: 'create equipo separador {TAG}',
                            params: ['TAG'],
                            description: 'Crea un separador en el PFD'
                        }
                    ]
                },
                {
                    name: 'Corrientes de Proceso',
                    icon: '🔗',
                    commands: [
                        { 
                            label: 'Nueva Corriente', 
                            template: 'create stream {TAG} from {ORIGEN} to {DESTINO} fluid {FLUIDO} flow {CAUDAL} pressure {PRESION} temperature {TEMPERATURA}',
                            params: ['TAG', 'ORIGEN', 'DESTINO', 'FLUIDO', 'CAUDAL', 'PRESION', 'TEMPERATURA'],
                            defaults: { FLUIDO: 'WATER', CAUDAL: '50', PRESION: '2', TEMPERATURA: '25' },
                            description: 'Crea una corriente entre dos equipos'
                        }
                    ]
                },
                {
                    name: 'Consultas PFD',
                    icon: '🔍',
                    commands: [
                        { label: 'Listar Corrientes', template: 'list streams', params: [], description: 'Muestra todas las corrientes' },
                        { label: 'Listar Equipos', template: 'list equipos', params: [], description: 'Muestra todos los equipos' },
                        { label: 'Balance de Masa', template: 'balance masa {EQUIPO}', params: ['EQUIPO'], description: 'Verifica balance de masa' },
                        { label: 'Validar PFD', template: 'validate pfd', params: [], description: 'Valida integridad del PFD' }
                    ]
                }
            ]
        },
        
        // ═══════════════════════════════════════════
        //  DTI - DIAGRAMA DE TUBERÍAS E INSTRUMENTACIÓN
        // ═══════════════════════════════════════════
        'dti': {
            title: 'Diagrama de Tuberías e Instrumentación',
            icon: '🔧',
            color: '#8b5cf6',
            categories: [
                {
                    name: 'Instrumentos de Campo',
                    icon: '⭕',
                    commands: [
                        { 
                            label: 'Manómetro (PG)', 
                            template: 'create instrument {TAG} type PRESSURE_GAUGE on {LINEA} at {POSICION} range {RANGO}',
                            params: ['TAG', 'LINEA', 'POSICION', 'RANGO'],
                            defaults: { TAG: 'PI-101', POSICION: '0.3', RANGO: '0-10 bar' },
                            description: 'Crea un manómetro en una línea'
                        },
                        { 
                            label: 'Termómetro (TG)', 
                            template: 'create instrument {TAG} type TEMPERATURE_GAUGE on {LINEA} at {POSICION} range {RANGO}',
                            params: ['TAG', 'LINEA', 'POSICION', 'RANGO'],
                            defaults: { TAG: 'TI-101', POSICION: '0.5', RANGO: '0-100 °C' },
                            description: 'Crea un termómetro en una línea'
                        },
                        { 
                            label: 'Transmisor de Presión (PT)', 
                            template: 'create instrument {TAG} type PRESSURE_TRANSMITTER on {LINEA} at {POSICION} range {RANGO}',
                            params: ['TAG', 'LINEA', 'POSICION', 'RANGO'],
                            defaults: { TAG: 'PT-101', POSICION: '0.3', RANGO: '0-16 bar' },
                            description: 'Crea un transmisor de presión'
                        },
                        { 
                            label: 'Transmisor de Flujo (FT)', 
                            template: 'create instrument {TAG} type FLOW_TRANSMITTER on {LINEA} at {POSICION} range {RANGO}',
                            params: ['TAG', 'LINEA', 'POSICION', 'RANGO'],
                            defaults: { TAG: 'FT-101', POSICION: '0.5', RANGO: '0-100 m³/h' },
                            description: 'Crea un transmisor de flujo'
                        },
                        { 
                            label: 'Switch de Nivel (LS)', 
                            template: 'create instrument {TAG} type LEVEL_SWITCH on {LINEA} at {POSICION}',
                            params: ['TAG', 'LINEA', 'POSICION'],
                            defaults: { TAG: 'LS-101', POSICION: '0.8' },
                            description: 'Crea un switch de nivel'
                        },
                        { 
                            label: 'Válvula de Control (CV)', 
                            template: 'create instrument {TAG} type CONTROL_VALVE on {LINEA} at {POSICION}',
                            params: ['TAG', 'LINEA', 'POSICION'],
                            defaults: { TAG: 'LV-101', POSICION: '0.5' },
                            description: 'Crea una válvula de control'
                        }
                    ]
                },
                {
                    name: 'Instrumentos de Panel',
                    icon: '📋',
                    commands: [
                        { 
                            label: 'Controlador PID (PIC)', 
                            template: 'create instrument {TAG} type PRESSURE_CONTROLLER on {LINEA} at {POSICION} range {RANGO} location PANEL',
                            params: ['TAG', 'LINEA', 'POSICION', 'RANGO'],
                            defaults: { TAG: 'PIC-101', POSICION: '0.5', RANGO: '0-10 bar' },
                            description: 'Crea un controlador en panel'
                        },
                        { 
                            label: 'Controlador de Flujo (FIC)', 
                            template: 'create instrument {TAG} type FLOW_CONTROLLER on {LINEA} at {POSICION} range {RANGO} location PANEL',
                            params: ['TAG', 'LINEA', 'POSICION', 'RANGO'],
                            defaults: { TAG: 'FIC-101', POSICION: '0.5', RANGO: '0-100 m³/h' },
                            description: 'Crea un controlador de flujo en panel'
                        }
                    ]
                },
                {
                    name: 'Lazos de Control',
                    icon: '🔄',
                    commands: [
                        { 
                            label: 'Nuevo Lazo PID', 
                            template: 'create loop {TAG} sensor {SENSOR} controller {CONTROLADOR} valve {VALVULA} type FEEDBACK',
                            params: ['TAG', 'SENSOR', 'CONTROLADOR', 'VALVULA'],
                            defaults: { TAG: 'LIC-101' },
                            description: 'Crea un lazo de control PID'
                        }
                    ]
                },
                {
                    name: 'Consultas DTI',
                    icon: '🔍',
                    commands: [
                        { label: 'Listar Instrumentos', template: 'list instruments', params: [], description: 'Muestra todos los instrumentos' },
                        { label: 'Listar Lazos', template: 'list loops', params: [], description: 'Muestra todos los lazos' },
                        { label: 'Tipos de Instrumentos', template: 'list instrument types', params: [], description: 'Lista tipos disponibles' },
                        { label: 'Validar DTI', template: 'validate dti', params: [], description: 'Valida integridad del DTI' }
                    ]
                }
            ]
        },
        
        // ═══════════════════════════════════════════
        //  ISO - ISOMÉTRICO 3D (Comandos originales)
        // ═══════════════════════════════════════════
        'iso': {
            title: 'Isométrico 3D',
            icon: '🧊',
            color: '#00f2ff',
            categories: [
                {
                    name: 'Equipos 3D',
                    icon: '📦',
                    commands: [
                        { 
                            label: 'Tanque Vertical', 
                            template: 'create tanque_v {TAG} at ({X},{Y},{Z}) diam {DIAM} height {ALTURA} material {MATERIAL}',
                            params: ['TAG', 'X', 'Y', 'Z', 'DIAM', 'ALTURA', 'MATERIAL'],
                            defaults: { X: '0', Y: '1450', Z: '0', DIAM: '2380', ALTURA: '2900', MATERIAL: 'ACERO_CARBONO' },
                            description: 'Crea un tanque vertical en 3D'
                        },
                        { 
                            label: 'Bomba', 
                            template: 'create bomba {TAG} at ({X},{Y},{Z}) diam {DIAM} height {ALTURA}',
                            params: ['TAG', 'X', 'Y', 'Z', 'DIAM', 'ALTURA'],
                            defaults: { X: '5000', Y: '800', Z: '0', DIAM: '800', ALTURA: '800' },
                            description: 'Crea una bomba en 3D'
                        }
                    ]
                },
                {
                    name: 'Conexiones',
                    icon: '🔗',
                    commands: [
                        { 
                            label: 'Conectar Equipos', 
                            template: 'connect {ORIGEN} {PUERTO_O} to {DESTINO} {PUERTO_D} diametro {DIAM} material {MATERIAL} spec {SPEC}',
                            params: ['ORIGEN', 'PUERTO_O', 'DESTINO', 'PUERTO_D', 'DIAM', 'MATERIAL', 'SPEC'],
                            defaults: { DIAM: '6', MATERIAL: 'ACERO_CARBONO', SPEC: 'A1A' },
                            description: 'Conecta dos equipos con tubería'
                        }
                    ]
                },
                {
                    name: 'Consultas 3D',
                    icon: '🔍',
                    commands: [
                        { label: 'Listar Equipos', template: 'list equipos', params: [], description: 'Muestra todos los equipos' },
                        { label: 'Listar Líneas', template: 'list lineas', params: [], description: 'Muestra todas las líneas' },
                        { label: 'Auditar Modelo', template: 'audit', params: [], description: 'Audita el modelo 3D' }
                    ]
                }
            ]
        }
    };
    
    // ================================================================
    //  COMANDOS GLOBALES (disponibles en todos los módulos)
    // ================================================================
    const GLOBAL_COMMANDS = {
        name: 'Global',
        icon: '🌐',
        commands: [
            { label: 'Validar Todo', template: 'validate all', params: [], description: 'Validación cruzada PFD↔DTI↔3D' },
            { label: 'Resumen Proyecto', template: 'project summary', params: [], description: 'Resumen rápido del proyecto' },
            { label: 'Auto-Corregir', template: 'autofix', params: [], description: 'Auto-corrige issues comunes' },
            { label: 'Exportar DB Excel', template: 'export db', params: [], description: 'Exporta base de datos completa' },
            { label: 'Exportar PCF', template: 'export pcf', params: [], description: 'Exporta para SmartPlant/Aveva' },
            { label: 'Exportar MTO', template: 'export mto', params: [], description: 'Exporta lista de materiales' },
            { label: 'Ayuda', template: 'help', params: [], description: 'Muestra todos los comandos' }
        ]
    };
    
    // ================================================================
    //  DETECCIÓN DE MÓDULO ACTIVO
    // ================================================================
    
    function getActiveModule() {
        // Prioridad 1: Variable global
        if (window.currentModule) return window.currentModule;
        
        // Prioridad 2: Tab activo en el DOM
        var activeTab = document.querySelector('.module-tab.active');
        if (activeTab) {
            var module = activeTab.getAttribute('data-module');
            if (module) return module;
        }
        
        // Prioridad 3: Botón activo en toolbar
        var btnPFD = document.getElementById('btn-mode-pfd');
        var btnDTI = document.getElementById('btn-mode-dti');
        var btnISO = document.getElementById('btn-mode-iso');
        
        if (btnPFD && btnPFD.classList.contains('active')) return 'pfd';
        if (btnDTI && btnDTI.classList.contains('active')) return 'dti';
        if (btnISO && btnISO.classList.contains('active')) return 'iso';
        
        return 'pfd'; // Default
    }
    
    // ================================================================
    //  OBTENER COMANDOS PARA EL MÓDULO ACTIVO
    // ================================================================
    
    function getCommandsForActiveModule() {
        var module = getActiveModule();
        _currentModule = module;
        
        var moduleData = MODULE_COMMANDS[module] || MODULE_COMMANDS['pfd'];
        
        // Agregar comandos globales al final
        var allCategories = moduleData.categories.slice();
        allCategories.push(GLOBAL_COMMANDS);
        
        return {
            module: module,
            moduleData: moduleData,
            categories: allCategories
        };
    }
    
    // ================================================================
    //  INTERFAZ DE USUARIO FLOTANTE
    // ================================================================
    
    function openAssistedPanel() {
        var data = getCommandsForActiveModule();
        
        // Eliminar panel existente si hay
        var existingPanel = document.getElementById('adaptive-module-panel');
        if (existingPanel) existingPanel.remove();
        
        // Crear panel
        var panel = document.createElement('div');
        panel.id = 'adaptive-module-panel';
        panel.style.cssText = [
            'position: fixed',
            'top: 50%',
            'left: 50%',
            'transform: translate(-50%, -50%)',
            'width: 480px',
            'max-width: 90vw',
            'max-height: 80vh',
            'background: rgba(15, 23, 42, 0.97)',
            'border: 1px solid ' + data.moduleData.color,
            'border-radius: 16px',
            'z-index: 8000',
            'backdrop-filter: blur(12px)',
            'box-shadow: 0 20px 60px rgba(0,0,0,0.6)',
            'overflow-y: auto',
            'padding: 20px',
            'color: #e0e6ed',
            'font-family: Segoe UI, sans-serif'
        ].join(';');
        
        // Contenido
        var html = '';
        
        // Header
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">';
        html += '<span style="font-size:18px;font-weight:800;color:' + data.moduleData.color + ';">' + data.moduleData.icon + ' ' + data.moduleData.title + '</span>';
        html += '<button id="adaptive-close-btn" style="background:none;border:none;color:white;font-size:22px;cursor:pointer;padding:0 8px;">×</button>';
        html += '</div>';
        
        // Indicador de módulo
        html += '<div style="display:flex;gap:4px;margin-bottom:20px;">';
        ['pfd', 'dti', 'iso'].forEach(function(mod) {
            var modData = MODULE_COMMANDS[mod];
            var isActive = mod === data.module;
            html += '<button class="adaptive-mod-switch" data-module="' + mod + '" style="';
            html += 'flex:1;padding:8px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;';
            html += 'border-radius:6px;cursor:pointer;border:1px solid ' + (isActive ? modData.color : '#334155') + ';';
            html += 'background:' + (isActive ? modData.color : 'transparent') + ';';
            html += 'color:' + (isActive ? '#000' : modData.color) + ';';
            html += '">' + modData.icon + ' ' + mod.toUpperCase();
            html += '</button>';
        });
        html += '</div>';
        
        // Categorías y comandos
        data.categories.forEach(function(cat) {
            html += '<div style="margin-bottom:16px;">';
            html += '<div style="font-size:12px;font-weight:700;color:#94a3b8;margin-bottom:8px;text-transform:uppercase;letter-spacing:1px;">' + cat.icon + ' ' + cat.name + '</div>';
            
            cat.commands.forEach(function(cmd) {
                html += '<button class="adaptive-cmd-btn" data-template="' + escapeHtml(cmd.template) + '" data-params="' + (cmd.params || []).join(',') + '" style="';
                html += 'display:block;width:100%;text-align:left;padding:10px 14px;margin-bottom:4px;';
                html += 'background:#1e293b;border:1px solid #334155;border-radius:8px;color:#e0e6ed;';
                html += 'font-size:11px;cursor:pointer;transition:all 0.2s;';
                html += '">';
                html += '<span style="font-weight:600;">' + cmd.label + '</span>';
                if (cmd.description) {
                    html += '<br><span style="font-size:9px;color:#64748b;">' + cmd.description + '</span>';
                }
                html += '</button>';
            });
            
            html += '</div>';
        });
        
        panel.innerHTML = html;
        document.body.appendChild(panel);
        
        // Overlay de fondo
        var overlay = document.createElement('div');
        overlay.id = 'adaptive-overlay-bg';
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.6);z-index:7999;';
        overlay.onclick = closeAssistedPanel;
        document.body.appendChild(overlay);
        
        // Eventos
        document.getElementById('adaptive-close-btn').onclick = closeAssistedPanel;
        
        // Botones de cambio de módulo
        panel.querySelectorAll('.adaptive-mod-switch').forEach(function(btn) {
            btn.onclick = function() {
                var mod = this.getAttribute('data-module');
                window.currentModule = mod;
                if (typeof window.switchModule === 'function') {
                    window.switchModule(mod);
                }
                closeAssistedPanel();
                setTimeout(function() { openAssistedPanel(); }, 200);
            };
        });
        
        // Botones de comandos
        panel.querySelectorAll('.adaptive-cmd-btn').forEach(function(btn) {
            btn.onmouseenter = function() { this.style.background = '#334155'; this.style.borderColor = data.moduleData.color; };
            btn.onmouseleave = function() { this.style.background = '#1e293b'; this.style.borderColor = '#334155'; };
            btn.onclick = function() {
                var template = this.getAttribute('data-template');
                var params = this.getAttribute('data-params').split(',').filter(function(p) { return p; });
                
                if (params.length === 0) {
                    // Comando sin parámetros: ejecutar directamente
                    if (typeof SmartFlowCommands !== 'undefined') {
                        SmartFlowCommands.executeCommand(template);
                    }
                    closeAssistedPanel();
                } else {
                    // Comando con parámetros: abrir panel de parámetros
                    openParameterPanel(template, params);
                }
            };
        });
    }
    
    function openParameterPanel(template, params) {
        var data = getCommandsForActiveModule();
        
        // Eliminar panel existente
        var existing = document.getElementById('adaptive-param-panel');
        if (existing) existing.remove();
        
        var panel = document.createElement('div');
        panel.id = 'adaptive-param-panel';
        panel.style.cssText = [
            'position: fixed',
            'top: 50%',
            'left: 50%',
            'transform: translate(-50%, -50%)',
            'width: 420px',
            'max-width: 90vw',
            'background: rgba(15, 23, 42, 0.98)',
            'border: 1px solid ' + data.moduleData.color,
            'border-radius: 16px',
            'z-index: 8100',
            'padding: 20px',
            'color: #e0e6ed',
            'font-family: Segoe UI, sans-serif'
        ].join(';');
        
        var html = '<div style="font-size:16px;font-weight:700;color:' + data.moduleData.color + ';margin-bottom:16px;">⚙️ Parámetros del Comando</div>';
        html += '<div style="font-size:10px;color:#64748b;margin-bottom:16px;font-family:monospace;">' + escapeHtml(template) + '</div>';
        
        params.forEach(function(param) {
            if (!param) return;
            html += '<div style="margin-bottom:10px;">';
            html += '<label style="font-size:10px;color:#94a3b8;display:block;margin-bottom:4px;text-transform:uppercase;">' + param + '</label>';
            html += '<input type="text" class="adaptive-param-input" data-param="' + param + '" style="';
            html += 'width:100%;padding:10px;background:#0f172a;border:1px solid #334155;color:white;';
            html += 'border-radius:6px;font-size:13px;font-family:monospace;';
            html += '" placeholder="' + param + '">';
            html += '</div>';
        });
        
        html += '<div style="display:flex;gap:8px;margin-top:16px;">';
        html += '<button id="adaptive-execute-btn" style="flex:1;padding:12px;background:' + data.moduleData.color + ';color:#000;border:none;border-radius:8px;font-weight:700;cursor:pointer;font-size:13px;">▶ Ejecutar</button>';
        html += '<button id="adaptive-cancel-btn" style="padding:12px 20px;background:#334155;color:white;border:none;border-radius:8px;cursor:pointer;font-size:13px;">Cancelar</button>';
        html += '</div>';
        
        panel.innerHTML = html;
        document.body.appendChild(panel);
        
        document.getElementById('adaptive-execute-btn').onclick = function() {
            var cmd = template;
            panel.querySelectorAll('.adaptive-param-input').forEach(function(input) {
                var param = input.getAttribute('data-param');
                var value = input.value || param;
                cmd = cmd.replace('{' + param + '}', value);
            });
            
            if (typeof SmartFlowCommands !== 'undefined') {
                SmartFlowCommands.executeCommand(cmd);
            }
            
            panel.remove();
            var mainPanel = document.getElementById('adaptive-module-panel');
            if (mainPanel) mainPanel.remove();
            var overlay = document.getElementById('adaptive-overlay-bg');
            if (overlay) overlay.remove();
        };
        
        document.getElementById('adaptive-cancel-btn').onclick = function() {
            panel.remove();
        };
    }
    
    function closeAssistedPanel() {
        var panel = document.getElementById('adaptive-module-panel');
        if (panel) panel.remove();
        var paramPanel = document.getElementById('adaptive-param-panel');
        if (paramPanel) paramPanel.remove();
        var overlay = document.getElementById('adaptive-overlay-bg');
        if (overlay) overlay.remove();
    }
    
    function escapeHtml(str) {
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    
    // ================================================================
    //  INICIALIZACIÓN
    // ================================================================
    
    function init() {
        // Interceptar el botón de comandos para que abra el panel adaptativo
        document.addEventListener('DOMContentLoaded', function() {
            var btnCommand = document.getElementById('btnCommand');
            if (btnCommand) {
                var newBtn = btnCommand.cloneNode(true);
                btnCommand.parentNode.replaceChild(newBtn, btnCommand);
                newBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    openAssistedPanel();
                });
            }
            
            // Atajo Ctrl+Shift+C
            document.addEventListener('keydown', function(e) {
                if (e.ctrlKey && e.shiftKey && e.key === 'C') {
                    e.preventDefault();
                    openAssistedPanel();
                }
                if (e.key === 'Escape') {
                    closeAssistedPanel();
                }
            });
        });
        
        console.log('AdaptiveBridge v1.0 inicializado | Módulos: PFD, DTI, ISO');
    }
    
    // ================================================================
    //  API PÚBLICA
    // ================================================================
    
    return {
        init: init,
        openAssistedPanel: openAssistedPanel,
        closeAssistedPanel: closeAssistedPanel,
        getCommandsForActiveModule: getCommandsForActiveModule,
        getActiveModule: getActiveModule,
        MODULE_COMMANDS: MODULE_COMMANDS
    };
})();

// Auto-inicializar
AdaptiveBridge.init();
