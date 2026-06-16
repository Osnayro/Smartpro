// ============================================================
// ADAPTIVE COMMANDS UI v1.0 - INTERFAZ DE USUARIO ADAPTATIVA
// Archivo: js/adaptiveCommandsUI.js
// 
// CARACTERÍSTICAS:
//   - Diseño responsive (computadoras y móviles)
//   - Botones accesibles (tamaño mínimo 44px)
//   - Etiquetas ARIA para lectores de pantalla
//   - Soporte táctil (gestos y botones grandes)
//   - Tema oscuro consistente con SmartEngp
// ============================================================

const AdaptiveCommandsUI = (function() {
    
    // ================================================================
    // 1. CONFIGURACIÓN Y ESTADO
    // ================================================================
    
    let _currentModule = 'pfd';
    let _currentFlow = null;
    let _isOpen = false;
    let _commandHistory = [];
    let _isTextMode = false;
    
    // Referencias al DOM
    let _overlay = null;
    let _panel = null;
    let _body = null;
    let _footer = null;
    let _title = null;
    
    // ================================================================
    // 2. ESTILOS INYECTABLES (Responsive + Accesible)
    // ================================================================
    
    function injectStyles() {
        var styleId = 'adaptive-ui-styles';
        if (document.getElementById(styleId)) return;
        
        var style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            /* ============================================================
               OVERLAY Y PANEL PRINCIPAL
               ============================================================ */
            #adaptive-ui-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(2, 6, 23, 0.85);
                backdrop-filter: blur(8px);
                -webkit-backdrop-filter: blur(8px);
                z-index: 10000;
                display: none;
                justify-content: center;
                align-items: center;
                animation: adaptiveFadeIn 0.25s ease;
                padding: 16px;
            }
            
            #adaptive-ui-overlay.open {
                display: flex;
            }
            
            @keyframes adaptiveFadeIn {
                from { opacity: 0; transform: scale(0.96); }
                to { opacity: 1; transform: scale(1); }
            }
            
            #adaptive-ui-panel {
                width: 100%;
                max-width: 560px;
                max-height: 90vh;
                background: rgba(15, 23, 42, 0.98);
                border: 1px solid rgba(0, 242, 255, 0.3);
                border-radius: 16px;
                display: flex;
                flex-direction: column;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.7);
                overflow: hidden;
                position: relative;
            }
            
            /* ============================================================
               HEADER
               ============================================================ */
            .adaptive-ui-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 14px 18px;
                border-bottom: 1px solid rgba(0, 242, 255, 0.15);
                background: rgba(0, 242, 255, 0.03);
                flex-shrink: 0;
                min-height: 56px;
            }
            
            .adaptive-ui-header h3 {
                color: #00f2ff;
                font-size: 1em;
                margin: 0;
                display: flex;
                align-items: center;
                gap: 10px;
                font-weight: 700;
                letter-spacing: 0.5px;
            }
            
            .adaptive-ui-header h3 .module-badge {
                font-size: 0.6em;
                background: rgba(0, 242, 255, 0.15);
                padding: 2px 10px;
                border-radius: 12px;
                color: #94a3b8;
                font-weight: 600;
                letter-spacing: 0.5px;
            }
            
            .adaptive-ui-close {
                background: none;
                border: 1px solid rgba(255, 255, 255, 0.15);
                color: #fff;
                width: 44px;
                height: 44px;
                min-width: 44px;
                min-height: 44px;
                border-radius: 50%;
                font-size: 20px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.2s;
                flex-shrink: 0;
                touch-action: manipulation;
            }
            
            .adaptive-ui-close:hover,
            .adaptive-ui-close:focus-visible {
                background: #ef4444;
                border-color: #ef4444;
                outline: 2px solid #ef4444;
                outline-offset: 2px;
            }
            
            /* ============================================================
               TABS (Módulos)
               ============================================================ */
            .adaptive-ui-tabs {
                display: flex;
                gap: 4px;
                padding: 10px 16px 4px 16px;
                flex-shrink: 0;
                flex-wrap: wrap;
            }
            
            .adaptive-ui-tab {
                flex: 1;
                min-width: 60px;
                padding: 8px 12px;
                border-radius: 20px;
                border: 1px solid rgba(255, 255, 255, 0.08);
                background: transparent;
                color: #94a3b8;
                font-size: 0.75em;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
                text-align: center;
                min-height: 44px;
                touch-action: manipulation;
                letter-spacing: 0.3px;
            }
            
            .adaptive-ui-tab:focus-visible {
                outline: 2px solid #00f2ff;
                outline-offset: 2px;
            }
            
            .adaptive-ui-tab.active {
                background: rgba(0, 242, 255, 0.12);
                border-color: #00f2ff;
                color: #00f2ff;
                box-shadow: 0 0 20px rgba(0, 242, 255, 0.08);
            }
            
            .adaptive-ui-tab.pfd-tab.active { border-color: #10b981; color: #10b981; background: rgba(16, 185, 129, 0.12); }
            .adaptive-ui-tab.dti-tab.active { border-color: #8b5cf6; color: #8b5cf6; background: rgba(139, 92, 246, 0.12); }
            .adaptive-ui-tab.iso-tab.active { border-color: #00f2ff; color: #00f2ff; background: rgba(0, 242, 255, 0.12); }
            
            /* ============================================================
               MODO TABS (Asistido / Texto)
               ============================================================ */
            .adaptive-ui-mode-tabs {
                display: flex;
                gap: 4px;
                padding: 0 16px 10px 16px;
                flex-shrink: 0;
            }
            
            .adaptive-ui-mode-tab {
                flex: 1;
                padding: 8px 12px;
                border-radius: 16px;
                border: 1px solid rgba(255, 255, 255, 0.06);
                background: transparent;
                color: #94a3b8;
                font-size: 0.7em;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
                text-align: center;
                min-height: 40px;
                touch-action: manipulation;
            }
            
            .adaptive-ui-mode-tab.active {
                background: rgba(0, 242, 255, 0.1);
                border-color: #00f2ff;
                color: #00f2ff;
            }
            
            /* ============================================================
               BODY (Contenido)
               ============================================================ */
            .adaptive-ui-body {
                flex: 1;
                overflow-y: auto;
                padding: 12px 16px;
                -webkit-overflow-scrolling: touch;
                overscroll-behavior: contain;
            }
            
            .adaptive-ui-body::-webkit-scrollbar {
                width: 4px;
            }
            
            .adaptive-ui-body::-webkit-scrollbar-track {
                background: rgba(255, 255, 255, 0.05);
            }
            
            .adaptive-ui-body::-webkit-scrollbar-thumb {
                background: rgba(0, 242, 255, 0.3);
                border-radius: 4px;
            }
            
            /* ============================================================
               FOOTER
               ============================================================ */
            .adaptive-ui-footer {
                padding: 12px 16px;
                border-top: 1px solid rgba(0, 242, 255, 0.1);
                display: flex;
                justify-content: space-between;
                gap: 8px;
                flex-wrap: wrap;
                flex-shrink: 0;
                background: rgba(0, 0, 0, 0.2);
            }
            
            .adaptive-ui-footer .footer-left {
                display: flex;
                gap: 6px;
                flex-wrap: wrap;
            }
            
            .adaptive-ui-footer .footer-right {
                display: flex;
                gap: 6px;
                flex-wrap: wrap;
            }
            
            /* ============================================================
               GRID DE COMANDOS
               ============================================================ */
            .adaptive-ui-cmd-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
                gap: 8px;
                padding: 4px 0;
            }
            
            @media (max-width: 480px) {
                .adaptive-ui-cmd-grid {
                    grid-template-columns: repeat(2, 1fr);
                    gap: 6px;
                }
            }
            
            .adaptive-ui-cmd-card {
                background: rgba(30, 41, 59, 0.6);
                border: 1px solid rgba(255, 255, 255, 0.06);
                border-radius: 10px;
                padding: 12px 10px;
                cursor: pointer;
                transition: all 0.2s;
                text-align: center;
                min-height: 72px;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                touch-action: manipulation;
            }
            
            .adaptive-ui-cmd-card:hover {
                border-color: rgba(0, 242, 255, 0.3);
                transform: translateY(-1px);
                background: rgba(30, 41, 59, 0.8);
            }
            
            .adaptive-ui-cmd-card:focus-visible {
                outline: 2px solid #00f2ff;
                outline-offset: 2px;
            }
            
            .adaptive-ui-cmd-card .cmd-icon {
                font-size: 1.6em;
                margin-bottom: 4px;
                line-height: 1.2;
            }
            
            .adaptive-ui-cmd-card .cmd-name {
                font-size: 0.7em;
                font-weight: 600;
                color: #e0e6ed;
                line-height: 1.3;
            }
            
            .adaptive-ui-cmd-card .cmd-desc {
                font-size: 0.55em;
                color: #64748b;
                margin-top: 2px;
                line-height: 1.2;
                display: none;
            }
            
            @media (min-width: 768px) {
                .adaptive-ui-cmd-card .cmd-desc {
                    display: block;
                }
            }
            
            /* ============================================================
               CATEGORÍAS
               ============================================================ */
            .adaptive-ui-categories {
                display: flex;
                flex-wrap: wrap;
                gap: 4px;
                margin-bottom: 10px;
            }
            
            .adaptive-ui-cat {
                padding: 4px 12px;
                border-radius: 14px;
                font-size: 0.6em;
                border: 1px solid rgba(255, 255, 255, 0.06);
                background: transparent;
                color: #94a3b8;
                cursor: pointer;
                transition: all 0.2s;
                white-space: nowrap;
                min-height: 32px;
                touch-action: manipulation;
            }
            
            .adaptive-ui-cat.active {
                background: rgba(0, 242, 255, 0.08);
                border-color: #00f2ff;
                color: #00f2ff;
            }
            
            .adaptive-ui-cat:focus-visible {
                outline: 2px solid #00f2ff;
                outline-offset: 2px;
            }
            
            /* ============================================================
               BÚSQUEDA
               ============================================================ */
            .adaptive-ui-search {
                width: 100%;
                padding: 10px 14px;
                background: rgba(15, 23, 42, 0.8);
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 10px;
                color: #e0e6ed;
                font-size: 0.85em;
                margin-bottom: 10px;
                outline: none;
                min-height: 44px;
                transition: border-color 0.2s;
            }
            
            .adaptive-ui-search:focus {
                border-color: #00f2ff;
            }
            
            .adaptive-ui-search::placeholder {
                color: #64748b;
            }
            
            /* ============================================================
               WIZARD (Asistente)
               ============================================================ */
            .adaptive-ui-progress {
                background: rgba(255, 255, 255, 0.06);
                border-radius: 6px;
                height: 4px;
                margin-bottom: 14px;
                overflow: hidden;
            }
            
            .adaptive-ui-progress-fill {
                background: linear-gradient(90deg, #00f2ff, #1e4eb8);
                height: 100%;
                transition: width 0.4s ease;
                border-radius: 6px;
            }
            
            .adaptive-ui-step-title {
                font-size: 0.95em;
                font-weight: 700;
                color: #e0e6ed;
                margin-bottom: 12px;
                display: flex;
                align-items: center;
                gap: 8px;
                line-height: 1.4;
            }
            
            .adaptive-ui-step-desc {
                font-size: 0.75em;
                color: #94a3b8;
                margin-bottom: 12px;
                line-height: 1.5;
            }
            
            .adaptive-ui-back-btn {
                background: none;
                border: 1px solid rgba(255, 255, 255, 0.08);
                color: #94a3b8;
                padding: 8px 14px;
                border-radius: 8px;
                font-size: 0.75em;
                cursor: pointer;
                margin-bottom: 12px;
                min-height: 40px;
                touch-action: manipulation;
                transition: all 0.2s;
            }
            
            .adaptive-ui-back-btn:hover,
            .adaptive-ui-back-btn:focus-visible {
                color: #fff;
                border-color: #fff;
            }
            
            /* ============================================================
               SELECTORES
               ============================================================ */
            .adaptive-ui-select-list {
                display: flex;
                flex-direction: column;
                gap: 4px;
                max-height: 50vh;
                overflow-y: auto;
                -webkit-overflow-scrolling: touch;
            }
            
            .adaptive-ui-select-item {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 12px 14px;
                background: rgba(30, 41, 59, 0.5);
                border: 1px solid rgba(255, 255, 255, 0.04);
                border-radius: 10px;
                cursor: pointer;
                transition: all 0.15s;
                min-height: 48px;
                touch-action: manipulation;
            }
            
            .adaptive-ui-select-item:active {
                transform: scale(0.98);
            }
            
            .adaptive-ui-select-item:focus-visible {
                outline: 2px solid #00f2ff;
                outline-offset: 2px;
            }
            
            .adaptive-ui-select-item.selected {
                border-color: #00f2ff;
                background: rgba(0, 242, 255, 0.08);
            }
            
            .adaptive-ui-select-item .item-icon {
                font-size: 1.2em;
                flex-shrink: 0;
            }
            
            .adaptive-ui-select-item .item-info {
                flex: 1;
                min-width: 0;
            }
            
            .adaptive-ui-select-item .item-label {
                font-weight: 500;
                font-size: 0.85em;
                color: #e0e6ed;
            }
            
            .adaptive-ui-select-item .item-desc {
                font-size: 0.65em;
                color: #64748b;
                margin-top: 1px;
            }
            
            .adaptive-ui-select-item .item-check {
                color: #3fb950;
                font-size: 1em;
                flex-shrink: 0;
            }
            
            /* ============================================================
               FORMULARIOS
               ============================================================ */
            .adaptive-ui-form-group {
                margin-bottom: 12px;
            }
            
            .adaptive-ui-form-group label {
                display: block;
                font-size: 0.75em;
                color: #94a3b8;
                margin-bottom: 4px;
                font-weight: 600;
            }
            
            .adaptive-ui-form-group input,
            .adaptive-ui-form-group select {
                width: 100%;
                padding: 10px 14px;
                background: rgba(15, 23, 42, 0.8);
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 10px;
                color: #e0e6ed;
                font-size: 0.9em;
                outline: none;
                min-height: 44px;
                transition: border-color 0.2s;
                -webkit-appearance: none;
                appearance: none;
            }
            
            .adaptive-ui-form-group input:focus,
            .adaptive-ui-form-group select:focus {
                border-color: #00f2ff;
            }
            
            .adaptive-ui-form-group input[type="checkbox"] {
                width: 20px;
                height: 20px;
                min-height: 20px;
                accent-color: #00f2ff;
                cursor: pointer;
            }
            
            .adaptive-ui-form-group .checkbox-label {
                display: flex;
                align-items: center;
                gap: 10px;
                cursor: pointer;
                color: #e0e6ed;
                font-size: 0.85em;
            }
            
            /* ============================================================
               COORDENADAS
               ============================================================ */
            .adaptive-ui-coords {
                display: grid;
                grid-template-columns: 1fr 1fr 1fr auto;
                gap: 6px;
                margin-bottom: 6px;
            }
            
            @media (max-width: 480px) {
                .adaptive-ui-coords {
                    grid-template-columns: 1fr 1fr 1fr;
                }
            }
            
            .adaptive-ui-coords input {
                text-align: center;
                padding: 8px 6px;
                min-height: 40px;
                background: rgba(15, 23, 42, 0.8);
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 8px;
                color: #e0e6ed;
                font-size: 0.85em;
                outline: none;
            }
            
            .adaptive-ui-coords input:focus {
                border-color: #00f2ff;
            }
            
            /* ============================================================
               SLIDER
               ============================================================ */
            .adaptive-ui-slider-row {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 4px 0;
            }
            
            .adaptive-ui-slider-row input[type="range"] {
                flex: 1;
                min-height: 44px;
                cursor: pointer;
                accent-color: #00f2ff;
                background: transparent;
            }
            
            .adaptive-ui-slider-val {
                color: #00f2ff;
                font-weight: 700;
                font-size: 0.9em;
                min-width: 36px;
                text-align: center;
            }
            
            /* ============================================================
               CONFIRMACIÓN
               ============================================================ */
            .adaptive-ui-confirm {
                text-align: center;
                padding: 20px;
                background: rgba(248, 81, 73, 0.06);
                border: 1px solid rgba(248, 81, 73, 0.2);
                border-radius: 12px;
                color: #fca5a5;
                font-size: 0.9em;
                line-height: 1.6;
                white-space: pre-line;
                text-align: left;
            }
            
            .adaptive-ui-confirm strong {
                color: #00f2ff;
            }
            
            /* ============================================================
               INFO
               ============================================================ */
            .adaptive-ui-info {
                text-align: center;
                padding: 24px;
                color: #00f2ff;
                white-space: pre-line;
                font-size: 0.9em;
                line-height: 1.6;
                background: rgba(0, 242, 255, 0.04);
                border-radius: 12px;
                border: 1px solid rgba(0, 242, 255, 0.08);
            }
            
            /* ============================================================
               PREVIEW (Vista previa del comando)
               ============================================================ */
            .adaptive-ui-preview {
                margin-top: 12px;
                padding: 10px 14px;
                background: rgba(0, 0, 0, 0.3);
                border-radius: 10px;
                border: 1px solid rgba(255, 255, 255, 0.04);
            }
            
            .adaptive-ui-preview .preview-label {
                font-size: 0.6em;
                color: #64748b;
                margin-bottom: 3px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            
            .adaptive-ui-preview code {
                color: #00f2ff;
                font-family: 'Courier New', monospace;
                font-size: 0.75em;
                word-break: break-all;
                display: block;
                padding: 4px 0;
            }
            
            /* ============================================================
               CONSOLA (Modo Texto)
               ============================================================ */
            .adaptive-ui-console {
                background: rgba(0, 0, 0, 0.4);
                border-radius: 10px;
                padding: 12px;
                max-height: 40vh;
                overflow-y: auto;
                font-family: 'Courier New', monospace;
                font-size: 0.75em;
                margin-bottom: 10px;
                -webkit-overflow-scrolling: touch;
            }
            
            .adaptive-ui-console .console-line {
                padding: 2px 0;
                line-height: 1.5;
            }
            
            .adaptive-ui-console .console-cmd {
                color: #00f2ff;
            }
            
            .adaptive-ui-console .console-ok {
                color: #3fb950;
            }
            
            .adaptive-ui-console .console-err {
                color: #f85149;
            }
            
            .adaptive-ui-console .console-info {
                color: #8b949e;
            }
            
            .adaptive-ui-text-input {
                display: flex;
                gap: 8px;
            }
            
            .adaptive-ui-text-input input {
                flex: 1;
                padding: 10px 14px;
                background: rgba(15, 23, 42, 0.8);
                border: 1px solid rgba(255, 255, 255, 0.08);
                border-radius: 10px;
                color: #e0e6ed;
                font-family: 'Courier New', monospace;
                font-size: 0.85em;
                outline: none;
                min-height: 44px;
            }
            
            .adaptive-ui-text-input input:focus {
                border-color: #00f2ff;
            }
            
            .adaptive-ui-text-input button {
                padding: 10px 18px;
                min-height: 44px;
                min-width: 44px;
                border-radius: 10px;
                border: none;
                background: #1e4eb8;
                color: #fff;
                font-weight: 700;
                cursor: pointer;
                font-size: 0.85em;
                touch-action: manipulation;
                transition: background 0.2s;
            }
            
            .adaptive-ui-text-input button:hover {
                background: #2563eb;
            }
            
            .adaptive-ui-text-hints {
                font-size: 0.65em;
                color: #64748b;
                margin-top: 8px;
                padding: 8px 12px;
                background: rgba(0, 242, 255, 0.03);
                border-radius: 8px;
                line-height: 1.6;
            }
            
            .adaptive-ui-text-hints strong {
                color: #00f2ff;
            }
            
            /* ============================================================
               BOTONES DE ACCIÓN
               ============================================================ */
            .adaptive-ui-btn {
                padding: 8px 18px;
                border-radius: 8px;
                border: none;
                font-size: 0.75em;
                font-weight: 700;
                cursor: pointer;
                transition: all 0.2s;
                min-height: 40px;
                min-width: 44px;
                touch-action: manipulation;
                letter-spacing: 0.3px;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
            }
            
            .adaptive-ui-btn:focus-visible {
                outline: 2px solid #00f2ff;
                outline-offset: 2px;
            }
            
            .adaptive-ui-btn:disabled {
                opacity: 0.4;
                cursor: not-allowed;
            }
            
            .adaptive-ui-btn-primary {
                background: #1e4eb8;
                color: #fff;
            }
            
            .adaptive-ui-btn-primary:hover:not(:disabled) {
                background: #2563eb;
            }
            
            .adaptive-ui-btn-success {
                background: #238636;
                color: #fff;
            }
            
            .adaptive-ui-btn-success:hover:not(:disabled) {
                background: #2ea043;
            }
            
            .adaptive-ui-btn-ghost {
                background: transparent;
                color: #94a3b8;
                border: 1px solid rgba(255, 255, 255, 0.08);
            }
            
            .adaptive-ui-btn-ghost:hover:not(:disabled) {
                color: #fff;
                border-color: rgba(255, 255, 255, 0.2);
            }
            
            .adaptive-ui-btn-danger {
                background: transparent;
                color: #f87171;
                border: 1px solid rgba(248, 113, 113, 0.2);
            }
            
            .adaptive-ui-btn-danger:hover:not(:disabled) {
                background: rgba(248, 113, 113, 0.1);
            }
            
            .adaptive-ui-btn-danger-solid {
                background: #dc2626;
                color: #fff;
                border: 1px solid #dc2626;
            }
            
            .adaptive-ui-btn-danger-solid:hover:not(:disabled) {
                background: #ef4444;
            }
            
            /* ============================================================
               TOAST (Notificaciones)
               ============================================================ */
            .adaptive-ui-toast {
                position: fixed;
                bottom: 90px;
                left: 50%;
                transform: translateX(-50%);
                padding: 12px 24px;
                border-radius: 10px;
                z-index: 10001;
                font-size: 0.85em;
                font-weight: 600;
                pointer-events: none;
                animation: adaptiveToastSlideUp 0.3s ease;
                max-width: 90vw;
                text-align: center;
            }
            
            @keyframes adaptiveToastSlideUp {
                from { transform: translate(-50%, 20px); opacity: 0; }
                to { transform: translate(-50%, 0); opacity: 1; }
            }
            
            .adaptive-ui-toast.ok {
                background: #1a3a2a;
                color: #3fb950;
                border: 1px solid #3fb950;
            }
            
            .adaptive-ui-toast.err {
                background: #3a1a1a;
                color: #f85149;
                border: 1px solid #f85149;
            }
            
            .adaptive-ui-toast.info {
                background: #1a2a3a;
                color: #58a6ff;
                border: 1px solid #58a6ff;
            }
            
            /* ============================================================
               RESPONSIVE - MÓVILES
               ============================================================ */
            @media (max-width: 480px) {
                #adaptive-ui-panel {
                    max-height: 95vh;
                    border-radius: 12px;
                    margin: 0;
                }
                
                .adaptive-ui-header {
                    padding: 10px 14px;
                    min-height: 48px;
                }
                
                .adaptive-ui-header h3 {
                    font-size: 0.85em;
                }
                
                .adaptive-ui-body {
                    padding: 10px 12px;
                }
                
                .adaptive-ui-footer {
                    padding: 10px 12px;
                    gap: 6px;
                }
                
                .adaptive-ui-footer .footer-left,
                .adaptive-ui-footer .footer-right {
                    gap: 4px;
                }
                
                .adaptive-ui-btn {
                    padding: 6px 12px;
                    font-size: 0.65em;
                    min-height: 36px;
                }
                
                .adaptive-ui-select-item {
                    padding: 10px 12px;
                    min-height: 44px;
                }
                
                .adaptive-ui-select-item .item-label {
                    font-size: 0.8em;
                }
                
                .adaptive-ui-cmd-card {
                    padding: 10px 8px;
                    min-height: 64px;
                }
                
                .adaptive-ui-cmd-card .cmd-icon {
                    font-size: 1.3em;
                }
                
                .adaptive-ui-cmd-card .cmd-name {
                    font-size: 0.65em;
                }
                
                .adaptive-ui-tab {
                    font-size: 0.65em;
                    padding: 6px 8px;
                    min-height: 36px;
                }
            }
            
            /* ============================================================
               ACCESIBILIDAD - REDUCED MOTION
               ============================================================ */
            @media (prefers-reduced-motion: reduce) {
                #adaptive-ui-overlay {
                    animation: none;
                }
                .adaptive-ui-toast {
                    animation: none;
                }
                .adaptive-ui-progress-fill {
                    transition: none;
                }
            }
            
            /* ============================================================
               ALTO CONTRASTE
               ============================================================ */
            @media (prefers-contrast: high) {
                .adaptive-ui-cmd-card {
                    border-color: #fff;
                }
                .adaptive-ui-select-item {
                    border-color: #fff;
                }
                .adaptive-ui-btn {
                    border: 2px solid #fff;
                }
            }
        `;
        
        document.head.appendChild(style);
    }
    
    // ================================================================
    // 3. CREACIÓN DEL PANEL
    // ================================================================
    
    function createPanel() {
        // Limpiar overlay existente
        var existing = document.getElementById('adaptive-ui-overlay');
        if (existing) {
            existing.remove();
        }
        
        injectStyles();
        
        _overlay = document.createElement('div');
        _overlay.id = 'adaptive-ui-overlay';
        _overlay.setAttribute('role', 'dialog');
        _overlay.setAttribute('aria-modal', 'true');
        _overlay.setAttribute('aria-labelledby', 'adaptive-ui-title');
        
        _overlay.innerHTML = `
            <div id="adaptive-ui-panel" role="document">
                <div class="adaptive-ui-header">
                    <h3 id="adaptive-ui-title">
                        🤖 <span id="adaptive-ui-title-text">Comandos Inteligentes</span>
                        <span class="module-badge" id="adaptive-ui-badge">PFD</span>
                    </h3>
                    <button class="adaptive-ui-close" id="adaptive-ui-close" aria-label="Cerrar panel de comandos">
                        <span aria-hidden="true">✕</span>
                    </button>
                </div>
                <div class="adaptive-ui-tabs" id="adaptive-ui-tabs" role="tablist">
                    <button class="adaptive-ui-tab pfd-tab active" data-module="pfd" role="tab" aria-selected="true" aria-label="Módulo PFD - Diagrama de Flujo">
                        📊 PFD
                    </button>
                    <button class="adaptive-ui-tab dti-tab" data-module="dti" role="tab" aria-selected="false" aria-label="Módulo DTI - Tubería e Instrumentación">
                        🔧 DTI
                    </button>
                    <button class="adaptive-ui-tab iso-tab" data-module="iso" role="tab" aria-selected="false" aria-label="Módulo ISO - Isométrico 3D">
                        🧊 ISO
                    </button>
                </div>
                <div class="adaptive-ui-mode-tabs" id="adaptive-ui-mode-tabs">
                    <button class="adaptive-ui-mode-tab active" data-mode="assisted" aria-label="Modo asistido paso a paso">
                        🧭 Asistido
                    </button>
                    <button class="adaptive-ui-mode-tab" data-mode="text" aria-label="Modo texto - consola de comandos">
                        ⌨️ Texto
                    </button>
                </div>
                <div class="adaptive-ui-body" id="adaptive-ui-body" role="main">
                    <!-- Contenido dinámico -->
                </div>
                <div class="adaptive-ui-footer" id="adaptive-ui-footer">
                    <!-- Footer dinámico -->
                </div>
            </div>
        `;
        
        document.body.appendChild(_overlay);
        
        // Referencias
        _panel = document.getElementById('adaptive-ui-panel');
        _body = document.getElementById('adaptive-ui-body');
        _footer = document.getElementById('adaptive-ui-footer');
        _title = document.getElementById('adaptive-ui-title-text');
        var badge = document.getElementById('adaptive-ui-badge');
        
        // Eventos
        document.getElementById('adaptive-ui-close').addEventListener('click', close);
        _overlay.addEventListener('click', function(e) {
            if (e.target === _overlay) close();
        });
        
        // Tabs de módulos
        document.querySelectorAll('#adaptive-ui-tabs .adaptive-ui-tab').forEach(function(tab) {
            tab.addEventListener('click', function() {
                var module = this.dataset.module;
                setModule(module);
            });
        });
        
        // Tabs de modo
        document.querySelectorAll('#adaptive-ui-mode-tabs .adaptive-ui-mode-tab').forEach(function(tab) {
            tab.addEventListener('click', function() {
                var mode = this.dataset.mode;
                _isTextMode = (mode === 'text');
                document.querySelectorAll('#adaptive-ui-mode-tabs .adaptive-ui-mode-tab').forEach(function(t) {
                    t.classList.toggle('active', t === tab);
                });
                renderContent();
            });
        });
        
        // Tecla Escape
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && _isOpen) close();
        });
        
        return _overlay;
    }
    
    // ================================================================
    // 4. FUNCIONES DE RENDERIZADO
    // ================================================================
    
    function renderContent() {
        if (_isTextMode) {
            renderTextMode();
        } else if (_currentFlow) {
            renderWizard();
        } else {
            renderCommandGrid();
        }
    }
    
    function renderCommandGrid() {
        if (!_body) return;
        
        var module = _currentModule;
        var commands = getModuleCommands(module);
        var categories = groupCommandsByCategory(commands);
        
        var html = '';
        
        // Búsqueda
        html += `
            <input type="text" class="adaptive-ui-search" id="adaptive-ui-search" 
                   placeholder="🔍 Buscar comandos..." aria-label="Buscar comandos">
        `;
        
        // Categorías
        var catKeys = Object.keys(categories);
        html += `<div class="adaptive-ui-categories" id="adaptive-ui-categories" role="tablist">`;
        html += `<button class="adaptive-ui-cat active" data-cat="all" role="tab" aria-selected="true">📋 Todos (${commands.length})</button>`;
        catKeys.forEach(function(key) {
            var cat = categories[key];
            var label = getCategoryLabel(key);
            html += `<button class="adaptive-ui-cat" data-cat="${key}" role="tab" aria-selected="false">${label} (${cat.length})</button>`;
        });
        html += `</div>`;
        
        // Grid de comandos
        html += `<div class="adaptive-ui-cmd-grid" id="adaptive-ui-cmd-grid" role="list">`;
        commands.forEach(function(cmd) {
            html += `
                <div class="adaptive-ui-cmd-card" data-command="${cmd.command}" data-category="${cmd.category}" role="listitem" tabindex="0">
                    <div class="cmd-icon" aria-hidden="true">${cmd.icon || '📋'}</div>
                    <div class="cmd-name">${cmd.name}</div>
                    <div class="cmd-desc">${cmd.description || ''}</div>
                </div>
            `;
        });
        html += `</div>`;
        
        _body.innerHTML = html;
        
        // Eventos de búsqueda
        var search = document.getElementById('adaptive-ui-search');
        if (search) {
            search.addEventListener('input', function() {
                filterCommands(this.value);
            });
            search.addEventListener('keydown', function(e) {
                if (e.key === 'Escape') this.value = '';
                filterCommands(this.value);
            });
        }
        
        // Eventos de categorías
        document.querySelectorAll('.adaptive-ui-cat').forEach(function(cat) {
            cat.addEventListener('click', function() {
                document.querySelectorAll('.adaptive-ui-cat').forEach(function(c) {
                    c.classList.remove('active');
                    c.setAttribute('aria-selected', 'false');
                });
                this.classList.add('active');
                this.setAttribute('aria-selected', 'true');
                filterByCategory(this.dataset.cat);
            });
        });
        
        // Eventos de comandos
        document.querySelectorAll('.adaptive-ui-cmd-card').forEach(function(card) {
            card.addEventListener('click', function() {
                var cmd = this.dataset.command;
                startFlow(cmd);
            });
            card.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    var cmd = this.dataset.command;
                    startFlow(cmd);
                }
            });
        });
        
        // Footer
        _footer.innerHTML = `
            <div class="footer-left">
                <button class="adaptive-ui-btn adaptive-ui-btn-ghost" onclick="AdaptiveCommandsUI.executeDirect('undo')" aria-label="Deshacer última acción">↩️ Deshacer</button>
                <button class="adaptive-ui-btn adaptive-ui-btn-ghost" onclick="AdaptiveCommandsUI.executeDirect('redo')" aria-label="Rehacer acción">↪️ Rehacer</button>
            </div>
            <div class="footer-right">
                <button class="adaptive-ui-btn adaptive-ui-btn-ghost" onclick="AdaptiveCommandsUI.executeDirect('help')" aria-label="Mostrar ayuda">❓ Ayuda</button>
                <button class="adaptive-ui-btn adaptive-ui-btn-ghost" onclick="AdaptiveCommandsUI.executeDirect('validate all')" aria-label="Validar todo el proyecto">🔍 Validar</button>
            </div>
        `;
    }
    
    function renderWizard() {
        if (!_body || !_currentFlow) return;
        
        var stepData = _currentFlow;
        
        var html = '';
        
        // Barra de progreso
        html += `
            <div class="adaptive-ui-progress" role="progressbar" aria-valuenow="${stepData.progress || 0}" aria-valuemin="0" aria-valuemax="100">
                <div class="adaptive-ui-progress-fill" style="width: ${stepData.progress || 0}%"></div>
            </div>
        `;
        
        // Botón volver
        html += `
            <button class="adaptive-ui-back-btn" id="adaptive-ui-back" aria-label="Volver a la lista de comandos">
                ← Volver a comandos
            </button>
        `;
        
        // Título del paso
        html += `
            <div class="adaptive-ui-step-title">
                ${stepData.title || ''}
                ${stepData.stepIndex !== undefined ? `<span style="font-size:0.6em;color:#64748b;font-weight:400;">${stepData.stepIndex + 1}/${stepData.totalSteps || 0}</span>` : ''}
            </div>
        `;
        
        // Descripción
        if (stepData.description) {
            html += `<div class="adaptive-ui-step-desc">${stepData.description}</div>`;
        }
        
        // Renderizar según tipo
        switch (stepData.type) {
            case 'select':
            case 'dynamicSelect':
                html += renderSelect(stepData);
                break;
            case 'multiSelect':
                html += renderMultiSelect(stepData);
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
                html += `<p style="color:#94a3b8;">Paso: ${stepData.type || 'desconocido'}</p>`;
        }
        
        // Preview del comando
        if (stepData.isFinal && stepData.command) {
            html += `
                <div class="adaptive-ui-preview">
                    <div class="preview-label">📝 Comando a ejecutar:</div>
                    <code>${stepData.command}</code>
                </div>
            `;
        }
        
        _body.innerHTML = html;
        
        // Eventos
        var backBtn = document.getElementById('adaptive-ui-back');
        if (backBtn) {
            backBtn.addEventListener('click', function() {
                _currentFlow = null;
                AdaptiveCommandSystem.resetFlow();
                renderContent();
            });
        }
        
        // Configurar eventos según tipo
        setupStepEvents(stepData);
        
        // Footer
        var isFinal = stepData.isFinal || false;
        var hasPrev = (stepData.stepIndex || 0) > 0;
        
        _footer.innerHTML = `
            <div class="footer-left">
                <button class="adaptive-ui-btn adaptive-ui-btn-ghost" id="adaptive-ui-prev" ${!hasPrev ? 'disabled' : ''} aria-label="Paso anterior">
                    ← Anterior
                </button>
                <button class="adaptive-ui-btn adaptive-ui-btn-danger-solid" id="adaptive-ui-cancel" aria-label="Cancelar">
                    ✖ Cancelar
                </button>
            </div>
            <div class="footer-right">
                ${isFinal ? 
                    `<button class="adaptive-ui-btn adaptive-ui-btn-success" id="adaptive-ui-execute" aria-label="Ejecutar comando">✅ Ejecutar</button>` :
                    `<button class="adaptive-ui-btn adaptive-ui-btn-primary" id="adaptive-ui-next" aria-label="Siguiente paso">Siguiente →</button>`
                }
            </div>
        `;
        
        document.getElementById('adaptive-ui-prev').addEventListener('click', function() {
            if (!this.disabled) goPrev();
        });
        document.getElementById('adaptive-ui-cancel').addEventListener('click', cancelFlow);
        
        var nextBtn = document.getElementById('adaptive-ui-next');
        if (nextBtn) {
            nextBtn.addEventListener('click', function() {
                if (!this.disabled) goNext();
            });
        }
        
        var execBtn = document.getElementById('adaptive-ui-execute');
        if (execBtn) {
            execBtn.addEventListener('click', executeFlow);
        }
    }
    
    // ================================================================
    // 5. RENDERIZADO DE TIPOS DE PASOS
    // ================================================================
    
    function renderSelect(stepData) {
        var options = stepData.options || [];
        var html = `<div class="adaptive-ui-select-list" id="adaptive-ui-select-list" role="listbox">`;
        options.forEach(function(opt) {
            var isSelected = false;
            html += `
                <div class="adaptive-ui-select-item" data-value="${opt.value}" role="option" aria-selected="${isSelected}" tabindex="0">
                    ${opt.icon ? `<span class="item-icon" aria-hidden="true">${opt.icon}</span>` : ''}
                    <div class="item-info">
                        <div class="item-label">${opt.label}</div>
                        ${opt.description ? `<div class="item-desc">${opt.description}</div>` : ''}
                    </div>
                    ${opt.status === 'open' ? `<span class="item-check" aria-label="Disponible">🟢</span>` : ''}
                </div>
            `;
        });
        html += `</div>`;
        return html;
    }
    
    function renderMultiSelect(stepData) {
        var options = stepData.options || [];
        var html = `
            <p style="font-size:0.75em;color:#94a3b8;margin-bottom:8px;">Seleccione ${stepData.minSelect || 2}+ elementos</p>
            <div class="adaptive-ui-select-list" id="adaptive-ui-multi-select" role="listbox" aria-multiselectable="true">
        `;
        options.forEach(function(opt) {
            html += `
                <div class="adaptive-ui-select-item" data-value="${opt.value}" role="option" aria-selected="false" tabindex="0">
                    ${opt.icon ? `<span class="item-icon" aria-hidden="true">${opt.icon}</span>` : ''}
                    <div class="item-info">
                        <div class="item-label">${opt.label}</div>
                        ${opt.description ? `<div class="item-desc">${opt.description}</div>` : ''}
                    </div>
                    <span class="item-check" style="display:none;" aria-hidden="true">✅</span>
                </div>
            `;
        });
        html += `</div>
            <button class="adaptive-ui-btn adaptive-ui-btn-primary" id="adaptive-ui-confirm-multi" style="margin-top:8px;width:100%;">
                ✅ Confirmar Selección
            </button>
        `;
        return html;
    }
    
    function renderTextInput(stepData) {
        return `
            <div class="adaptive-ui-form-group">
                <input type="text" id="adaptive-ui-text-input" 
                       placeholder="${stepData.placeholder || ''}" 
                       value="${stepData.default || ''}"
                       aria-label="${stepData.title || 'Ingrese un valor'}"
                       autocomplete="off">
            </div>
        `;
    }
    
    function renderNumberInput(stepData) {
        return `
            <div class="adaptive-ui-form-group">
                <input type="number" id="adaptive-ui-number-input" 
                       value="${stepData.default || 0}" 
                       min="${stepData.min || ''}" 
                       max="${stepData.max || ''}" 
                       step="${stepData.step || '1'}"
                       aria-label="${stepData.title || 'Ingrese un número'}">
                ${stepData.description ? `<div style="font-size:0.65em;color:#64748b;margin-top:4px;">${stepData.description}</div>` : ''}
            </div>
        `;
    }
    
    function renderSlider(stepData) {
        var val = stepData.default || 0.5;
        return `
            <div class="adaptive-ui-form-group">
                <div class="adaptive-ui-slider-row">
                    <input type="range" id="adaptive-ui-slider" 
                           min="${stepData.min || 0}" 
                           max="${stepData.max || 1}" 
                           step="${stepData.step || 0.01}" 
                           value="${val}"
                           aria-label="${stepData.title || 'Deslizador'}"
                           aria-valuenow="${val}">
                    <span class="adaptive-ui-slider-val" id="adaptive-ui-slider-val">${val}</span>
                </div>
                ${stepData.description ? `<div style="font-size:0.65em;color:#64748b;margin-top:4px;">${stepData.description}</div>` : ''}
            </div>
        `;
    }
    
    function renderCoordinate(stepData) {
        var def = stepData.default || { x: 0, y: 0, z: 0 };
        return `
            <div class="adaptive-ui-form-group">
                <label>Coordenadas (X, Y, Z) en mm</label>
                <div class="adaptive-ui-coords">
                    <input type="number" id="coord-x" placeholder="X" value="${def.x || 0}" step="1" aria-label="Coordenada X">
                    <input type="number" id="coord-y" placeholder="Y" value="${def.y || 0}" step="1" aria-label="Coordenada Y">
                    <input type="number" id="coord-z" placeholder="Z" value="${def.z || 0}" step="1" aria-label="Coordenada Z">
                </div>
            </div>
        `;
    }
    
    function renderCoordinateList(stepData) {
        var pts = stepData.default || [{ x: 0, y: 0, z: 0 }, { x: 1000, y: 0, z: 0 }];
        var html = `
            <p style="font-size:0.75em;color:#94a3b8;margin-bottom:8px;">${stepData.description || 'Agregue puntos'} (mín: ${stepData.minPoints || 2})</p>
            <div id="adaptive-ui-coord-list">
        `;
        pts.forEach(function(p, i) {
            html += `
                <div class="adaptive-ui-coords" data-cidx="${i}">
                    <input type="number" placeholder="X" value="${p.x || 0}" step="1" data-axis="x" aria-label="Punto ${i+1} X">
                    <input type="number" placeholder="Y" value="${p.y || 0}" step="1" data-axis="y" aria-label="Punto ${i+1} Y">
                    <input type="number" placeholder="Z" value="${p.z || 0}" step="1" data-axis="z" aria-label="Punto ${i+1} Z">
                    <button class="adaptive-ui-btn adaptive-ui-btn-ghost" onclick="this.parentElement.remove()" style="padding:4px 8px;font-size:0.7em;min-height:32px;" aria-label="Eliminar punto">✕</button>
                </div>
            `;
        });
        html += `</div>
            <button class="adaptive-ui-btn adaptive-ui-btn-ghost" id="adaptive-ui-add-coord" style="margin-top:6px;width:100%;min-height:40px;">
                + Agregar Punto
            </button>
        `;
        return html;
    }
    
    function renderForm(stepData) {
        var fields = stepData.fields || [];
        var html = '';
        fields.forEach(function(field) {
            html += `<div class="adaptive-ui-form-group">`;
            if (field.type === 'checkbox') {
                html += `
                    <label class="checkbox-label">
                        <input type="checkbox" id="field-${field.id}" data-field="${field.id}" ${field.default ? 'checked' : ''}>
                        ${field.label}
                    </label>
                `;
            } else {
                html += `<label for="field-${field.id}">${field.label}</label>`;
                if (field.type === 'select') {
                    html += `<select id="field-${field.id}" data-field="${field.id}">`;
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
                                   min="${field.min || ''}" max="${field.max || ''}" step="${field.step || ''}">`;
                }
            }
            html += `</div>`;
        });
        return html;
    }
    
    function renderConfirm(stepData) {
        return `<div class="adaptive-ui-confirm">${stepData.message || '¿Confirmar esta acción?'}</div>`;
    }
    
    function renderInfo(stepData) {
        return `<div class="adaptive-ui-info">${stepData.message || ''}</div>`;
    }
    
    // ================================================================
    // 6. CONFIGURACIÓN DE EVENTOS DE PASOS
    // ================================================================
    
    function setupStepEvents(stepData) {
        // Select
        var selectList = document.getElementById('adaptive-ui-select-list');
        if (selectList) {
            selectList.querySelectorAll('.adaptive-ui-select-item').forEach(function(item) {
                item.addEventListener('click', function() {
                    selectList.querySelectorAll('.adaptive-ui-select-item').forEach(function(el) {
                        el.classList.remove('selected');
                        el.setAttribute('aria-selected', 'false');
                    });
                    this.classList.add('selected');
                    this.setAttribute('aria-selected', 'true');
                    var value = this.dataset.value;
                    if (stepData.isFinal) {
                        // Guardar selección para ejecución directa
                        _currentFlow = { ..._currentFlow, selection: value };
                    }
                });
                item.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        this.click();
                    }
                });
            });
        }
        
        // Multi Select
        var multiList = document.getElementById('adaptive-ui-multi-select');
        if (multiList) {
            multiList.querySelectorAll('.adaptive-ui-select-item').forEach(function(item) {
                item.addEventListener('click', function() {
                    this.classList.toggle('selected');
                    var isSelected = this.classList.contains('selected');
                    this.setAttribute('aria-selected', isSelected ? 'true' : 'false');
                    var check = this.querySelector('.item-check');
                    if (check) check.style.display = isSelected ? 'inline' : 'none';
                });
                item.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        this.click();
                    }
                });
            });
            
            var confirmBtn = document.getElementById('adaptive-ui-confirm-multi');
            if (confirmBtn) {
                confirmBtn.addEventListener('click', function() {
                    var selected = [];
                    multiList.querySelectorAll('.adaptive-ui-select-item.selected').forEach(function(el) {
                        selected.push(el.dataset.value);
                    });
                    var minSelect = stepData.minSelect || 1;
                    if (selected.length < minSelect) {
                        showToast('Seleccione al menos ' + minSelect + ' elemento(s)', 'err');
                        return;
                    }
                    goNextWithValue(selected);
                });
            }
        }
        
        // Text input
        var textInput = document.getElementById('adaptive-ui-text-input');
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
        var numInput = document.getElementById('adaptive-ui-number-input');
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
        var slider = document.getElementById('adaptive-ui-slider');
        if (slider) {
            var valDisplay = document.getElementById('adaptive-ui-slider-val');
            slider.addEventListener('input', function() {
                if (valDisplay) valDisplay.textContent = this.value;
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
        
        // Coordinate List
        var addCoordBtn = document.getElementById('adaptive-ui-add-coord');
        if (addCoordBtn) {
            addCoordBtn.addEventListener('click', function() {
                var container = document.getElementById('adaptive-ui-coord-list');
                if (!container) return;
                var idx = container.querySelectorAll('.adaptive-ui-coords').length;
                var row = document.createElement('div');
                row.className = 'adaptive-ui-coords';
                row.dataset.cidx = idx;
                row.innerHTML = `
                    <input type="number" placeholder="X" value="0" step="1" data-axis="x" aria-label="Punto ${idx+1} X">
                    <input type="number" placeholder="Y" value="0" step="1" data-axis="y" aria-label="Punto ${idx+1} Y">
                    <input type="number" placeholder="Z" value="0" step="1" data-axis="z" aria-label="Punto ${idx+1} Z">
                    <button class="adaptive-ui-btn adaptive-ui-btn-ghost" onclick="this.parentElement.remove()" style="padding:4px 8px;font-size:0.7em;min-height:32px;" aria-label="Eliminar punto">✕</button>
                `;
                container.appendChild(row);
            });
        }
        
        // Confirm (auto-next en confirmación)
        if (stepData.type === 'confirm') {
            // El usuario hace clic en ejecutar o next
        }
    }
    
    // ================================================================
    // 7. NAVEGACIÓN DEL ASISTENTE
    // ================================================================
    
    function goNext() {
        if (!_currentFlow) return;
        
        var stepData = _currentFlow;
        var value = null;
        
        // Obtener valor según tipo de paso
        switch (stepData.type) {
            case 'select': {
                var selected = document.querySelector('#adaptive-ui-select-list .adaptive-ui-select-item.selected');
                if (selected) value = selected.dataset.value;
                break;
            }
            case 'multiSelect': {
                // Ya se maneja con el botón confirmar
                return;
            }
            case 'text': {
                var input = document.getElementById('adaptive-ui-text-input');
                if (input) value = input.value.trim();
                break;
            }
            case 'number': {
                var input = document.getElementById('adaptive-ui-number-input');
                if (input) value = parseFloat(input.value) || 0;
                break;
            }
            case 'slider': {
                var slider = document.getElementById('adaptive-ui-slider');
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
                document.querySelectorAll('#adaptive-ui-coord-list .adaptive-ui-coords').forEach(function(row) {
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
            case 'confirm': {
                value = true;
                break;
            }
            case 'info': {
                value = true;
                break;
            }
            default: {
                showToast('Paso no soportado', 'err');
                return;
            }
        }
        
        // Validar
        if (value === null || value === undefined || value === '') {
            showToast('Seleccione o ingrese un valor', 'err');
            return;
        }
        
        // Validación personalizada
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
                renderContent();
            }
        }
    }
    
    function handleNextStep(nextData) {
        if (!nextData) {
            _currentFlow = null;
            renderContent();
            return;
        }
        
        if (nextData.finished) {
            if (nextData.executeImmediately && nextData.command) {
                executeTextCommand(nextData.command);
                _currentFlow = null;
                AdaptiveCommandSystem.resetFlow();
                renderContent();
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
            renderContent();
            return;
        }
        
        _currentFlow = nextData;
        renderWizard();
    }
    
    function cancelFlow() {
        _currentFlow = null;
        AdaptiveCommandSystem.resetFlow();
        renderContent();
    }
    
    function executeFlow() {
        if (_currentFlow && _currentFlow.command) {
            executeTextCommand(_currentFlow.command);
            showToast('✅ Comando ejecutado', 'ok');
            _currentFlow = null;
            AdaptiveCommandSystem.resetFlow();
            renderContent();
        } else {
            showToast('❌ No se pudo ejecutar el comando', 'err');
        }
    }
    
    // ================================================================
    // 8. MODO TEXTO (CONSOLA)
    // ================================================================
    
    function renderTextMode() {
        if (!_body) return;
        
        var html = `
            <div class="adaptive-ui-console" id="adaptive-ui-console" role="log" aria-label="Consola de comandos">
                <div class="console-line console-info">💡 Consola de comandos. Escriba y presione Enter o ▶</div>
                <div class="console-line console-info">   Escriba "help" para ver todos los comandos disponibles.</div>
                ${_commandHistory.map(function(line) {
                    var type = line.type || 'info';
                    return `<div class="console-line console-${type}">${line.text}</div>`;
                }).join('')}
            </div>
            <div class="adaptive-ui-text-input">
                <input type="text" id="adaptive-ui-text-cmd" 
                       placeholder="Escriba un comando..." 
                       aria-label="Entrada de comandos"
                       autocomplete="off"
                       spellcheck="false">
                <button id="adaptive-ui-text-execute" aria-label="Ejecutar comando">▶</button>
            </div>
            <div class="adaptive-ui-text-hints">
                <strong>📊 PFD:</strong> create equipo TIPO TAG | create stream TAG from X to Y fluid Z flow N<br>
                <strong>🔧 DTI:</strong> create instrument TAG type TIPO on LINEA at POS range RANGO<br>
                <strong>🧊 3D:</strong> create TIPO TAG at (x,y,z) diam D altura H<br>
                <strong>🔗 Conectar:</strong> connect ORIGEN PUERTO to DESTINO PUERTO diameter D<br>
                <strong>🔍 Validar:</strong> validate all | project summary
            </div>
        `;
        
        _body.innerHTML = html;
        
        // Eventos
        var input = document.getElementById('adaptive-ui-text-cmd');
        var execBtn = document.getElementById('adaptive-ui-text-execute');
        
        if (input) {
            input.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    var cmd = this.value.trim();
                    if (cmd) executeTextInput(cmd);
                }
            });
            setTimeout(function() { input.focus(); }, 100);
        }
        
        if (execBtn) {
            execBtn.addEventListener('click', function() {
                var input = document.getElementById('adaptive-ui-text-cmd');
                if (input) {
                    var cmd = input.value.trim();
                    if (cmd) executeTextInput(cmd);
                }
            });
        }
        
        // Footer
        _footer.innerHTML = `
            <div class="footer-left">
                <button class="adaptive-ui-btn adaptive-ui-btn-ghost" onclick="AdaptiveCommandsUI.executeDirect('help')" aria-label="Mostrar ayuda">❓ Ayuda</button>
                <button class="adaptive-ui-btn adaptive-ui-btn-ghost" onclick="AdaptiveCommandsUI.executeDirect('validate all')" aria-label="Validar todo">🔍 Validar</button>
            </div>
            <div class="footer-right">
                <button class="adaptive-ui-btn adaptive-ui-btn-ghost" onclick="AdaptiveCommandsUI.clearConsole()" aria-label="Limpiar consola">🗑️ Limpiar</button>
            </div>
        `;
    }
    
    function executeTextInput(cmd) {
        addConsoleLine('> ' + cmd, 'cmd');
        executeTextCommand(cmd);
        var input = document.getElementById('adaptive-ui-text-cmd');
        if (input) input.value = '';
        setTimeout(function() { if (input) input.focus(); }, 50);
    }
    
    function addConsoleLine(text, type) {
        var consoleEl = document.getElementById('adaptive-ui-console');
        if (!consoleEl) return;
        var line = document.createElement('div');
        line.className = 'console-line console-' + (type || 'info');
        line.textContent = text;
        consoleEl.appendChild(line);
        consoleEl.scrollTop = consoleEl.scrollHeight;
        _commandHistory.push({ text: text, type: type || 'info' });
        if (_commandHistory.length > 200) _commandHistory.shift();
    }
    
    function clearConsole() {
        var consoleEl = document.getElementById('adaptive-ui-console');
        if (consoleEl) {
            consoleEl.innerHTML = `
                <div class="console-line console-info">💡 Consola limpiada</div>
            `;
        }
        _commandHistory = [];
    }
    
    // ================================================================
    // 9. EJECUCIÓN DE COMANDOS
    // ================================================================
    
    function executeTextCommand(cmd) {
        if (typeof SmartFlowCommands !== 'undefined' && typeof SmartFlowCommands.executeCommand === 'function') {
            var result = SmartFlowCommands.executeCommand(cmd);
            if (result) {
                addConsoleLine('✅ Ejecutado correctamente', 'ok');
                showToast('✅ Comando ejecutado', 'ok');
            } else {
                addConsoleLine('❌ Comando no reconocido: ' + cmd, 'err');
                showToast('❌ Comando no reconocido', 'err');
            }
        } else {
            var textarea = document.getElementById('commandText');
            if (textarea) {
                textarea.value = cmd;
                var runBtn = document.getElementById('runCommands');
                if (runBtn) runBtn.click();
            }
            showToast('⚠️ Motor de comandos no disponible', 'info');
        }
    }
    
    function executeDirect(cmd) {
        executeTextCommand(cmd);
    }
    
    // ================================================================
    // 10. FUNCIONES DE UTILIDAD
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
                category: cmd.category || 'general',
                description: cmd.description || ''
            };
        });
    }
    
    function groupCommandsByCategory(commands) {
        var categories = {};
        commands.forEach(function(cmd) {
            var cat = cmd.category || 'general';
            if (!categories[cat]) categories[cat] = [];
            categories[cat].push(cmd);
        });
        return categories;
    }
    
    function getCategoryLabel(category) {
        var labels = {
            'pfd': '📊 PFD',
            'dti': '🔧 DTI',
            'iso': '🧊 ISO',
            'create': '🏗️ Crear',
            'connect': '🔌 Conectar',
            'edit': '✏️ Editar',
            'config': '⚙️ Config',
            'general': '📋 General',
            'pfd_create': '🏗️ Crear PFD',
            'pfd_query': '🔍 Consultas PFD',
            'dti_field': '⭕ Campo',
            'dti_panel': '📋 Panel',
            'dti_loops': '🔄 Lazos',
            'dti_query': '🔍 Consultas DTI',
            'iso_update': '📍 Posicionar',
            'iso_route': '🗺️ Ruteo',
            'iso_edit': '✏️ Editar ISO',
            'utility': '🔧 Utilidades'
        };
        return labels[category] || category;
    }
    
    function filterCommands(search) {
        var cards = document.querySelectorAll('.adaptive-ui-cmd-card');
        var searchLower = (search || '').toLowerCase();
        cards.forEach(function(card) {
            var text = card.textContent.toLowerCase();
            var show = !searchLower || text.includes(searchLower);
            card.style.display = show ? '' : 'none';
        });
    }
    
    function filterByCategory(category) {
        var cards = document.querySelectorAll('.adaptive-ui-cmd-card');
        cards.forEach(function(card) {
            var show = category === 'all' || card.dataset.category === category;
            card.style.display = show ? '' : 'none';
        });
    }
    
    function showToast(msg, type) {
        var existing = document.querySelector('.adaptive-ui-toast');
        if (existing) existing.remove();
        var toast = document.createElement('div');
        toast.className = 'adaptive-ui-toast ' + (type || 'info');
        toast.setAttribute('role', 'status');
        toast.setAttribute('aria-live', 'polite');
        toast.textContent = msg;
        document.body.appendChild(toast);
        setTimeout(function() { toast.remove(); }, 3000);
    }
    
    // ================================================================
    // 11. START FLOW
    // ================================================================
    
    function startFlow(commandPath) {
        if (typeof AdaptiveCommandSystem.startCommandFlow === 'function') {
            var stepData = AdaptiveCommandSystem.startCommandFlow(commandPath);
            if (!stepData) {
                showToast('Comando no disponible', 'err');
                return;
            }
            if (stepData.direct) {
                executeTextCommand(stepData.command);
                showToast('✅ ' + stepData.name + ' ejecutado', 'ok');
                return;
            }
            _currentFlow = stepData;
            _isTextMode = false;
            document.querySelectorAll('#adaptive-ui-mode-tabs .adaptive-ui-mode-tab').forEach(function(t) {
                t.classList.toggle('active', t.dataset.mode === 'assisted');
            });
            renderWizard();
        }
    }
    
    // ================================================================
    // 12. API PÚBLICA
    // ================================================================
    
    function open(module) {
        _currentModule = module || 'pfd';
        _isOpen = true;
        _currentFlow = null;
        _isTextMode = false;
        
        if (!_overlay || !_overlay.parentNode) {
            createPanel();
        }
        
        // Actualizar tabs
        document.querySelectorAll('#adaptive-ui-tabs .adaptive-ui-tab').forEach(function(tab) {
            var isActive = tab.dataset.module === _currentModule;
            tab.classList.toggle('active', isActive);
            tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
        });
        
        // Actualizar badge
        var badge = document.getElementById('adaptive-ui-badge');
        if (badge) {
            var labels = { 'pfd': 'PFD', 'dti': 'DTI', 'iso': 'ISO' };
            badge.textContent = labels[_currentModule] || _currentModule.toUpperCase();
        }
        
        // Resetear modo
        document.querySelectorAll('#adaptive-ui-mode-tabs .adaptive-ui-mode-tab').forEach(function(tab) {
            var isActive = tab.dataset.mode === 'assisted';
            tab.classList.toggle('active', isActive);
        });
        
        _overlay.classList.add('open');
        renderContent();
        
        // Enfocar
        setTimeout(function() {
            var search = document.getElementById('adaptive-ui-search');
            if (search) search.focus();
        }, 200);
    }
    
    function close() {
        _isOpen = false;
        _currentFlow = null;
        if (_overlay) {
            _overlay.classList.remove('open');
        }
        AdaptiveCommandSystem.resetFlow();
    }
    
    function setModule(module) {
        if (_currentModule !== module) {
            _currentModule = module;
            _currentFlow = null;
            AdaptiveCommandSystem.resetFlow();
            if (typeof AdaptiveCommandSystem.setActiveModule === 'function') {
                AdaptiveCommandSystem.setActiveModule(module);
            }
            renderContent();
            
            // Actualizar tabs
            document.querySelectorAll('#adaptive-ui-tabs .adaptive-ui-tab').forEach(function(tab) {
                var isActive = tab.dataset.module === module;
                tab.classList.toggle('active', isActive);
                tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
            });
            
            var badge = document.getElementById('adaptive-ui-badge');
            if (badge) {
                var labels = { 'pfd': 'PFD', 'dti': 'DTI', 'iso': 'ISO' };
                badge.textContent = labels[module] || module.toUpperCase();
            }
        }
    }
    
    function toggle() {
        if (_isOpen) {
            close();
        } else {
            open(_currentModule);
        }
    }
    
    // ================================================================
    // 13. EXPOSICIÓN GLOBAL
    // ================================================================
    
    var API = {
        open: open,
        close: close,
        toggle: toggle,
        setModule: setModule,
        getModule: function() { return _currentModule; },
        isOpen: function() { return _isOpen; },
        startFlow: startFlow,
        executeDirect: executeDirect,
        clearConsole: clearConsole,
        showToast: showToast,
        // Para uso interno
        _renderContent: renderContent,
        _renderWizard: renderWizard,
        _renderTextMode: renderTextMode,
        _goNext: goNext,
        _goPrev: goPrev,
        _cancelFlow: cancelFlow,
        _executeFlow: executeFlow,
        _executeTextCommand: executeTextCommand,
        _addConsoleLine: addConsoleLine
    };
    
    // Exponer globalmente
    if (typeof window !== 'undefined') {
        window.AdaptiveCommandsUI = API;
    }
    
    console.log('✅ AdaptiveCommandsUI v1.0 - Interfaz adaptativa cargada');
    console.log('💡 Usa AdaptiveCommandsUI.open("pfd"|"dti"|"iso") para abrir el panel.');
    
    return API;
    
})();

// ============================================================
// INICIALIZACIÓN AUTOMÁTICA
// ============================================================
if (typeof window !== 'undefined') {
    // Conectar con el botón de comandos existente
    document.addEventListener('DOMContentLoaded', function() {
        var cmdBtn = document.getElementById('btnCommand');
        if (cmdBtn) {
            cmdBtn.addEventListener('click', function() {
                var module = window.currentModule || 'pfd';
                AdaptiveCommandsUI.open(module);
            });
        }
        
        // Conectar con el sistema adaptativo
        if (typeof AdaptiveCommandSystem !== 'undefined') {
            AdaptiveCommandSystem.setCallbacks({
                onModuleChange: function(module) {
                    if (AdaptiveCommandsUI.isOpen()) {
                        AdaptiveCommandsUI.setModule(module);
                    }
                }
            });
        }
        
        console.log('🔗 AdaptiveCommandsUI integrado con el sistema principal');
    });
}
