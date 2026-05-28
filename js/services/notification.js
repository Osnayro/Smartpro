
// ============================================================
// SMARTFLOW - Servicio de Notificaciones Unificado
// Archivo: js/services/notification.js
// ============================================================
const NotificationService = (function() {
  var _statusBarElement = null;
  var _toastContainer = null;
  var _voiceEnabled = true;
  var _toastEnabled = true;
  var _statusBarEnabled = true;

  // ============================================================
  // INICIALIZACIÓN
  // ============================================================

  function init(options) {
    options = options || {};
    
    // Barra de estado
    var statusId = options.statusBarId || 'statusMsg';
    _statusBarElement = document.getElementById(statusId);
    if (!_statusBarElement) {
      _statusBarElement = document.createElement('div');
      _statusBarElement.id = statusId;
      _statusBarElement.style.cssText = [
        'position: fixed; bottom: 8px; left: 12px; z-index: 300;',
        'background: rgba(2, 6, 23, 0.7); padding: 4px 12px; font-size: 10px;',
        'border-radius: 4px; color: #00f2ff; pointer-events: none;',
        'backdrop-filter: blur(4px); border: 1px solid rgba(0,242,255,0.2);'
      ].join(' ');
      document.body.appendChild(_statusBarElement);
    }

    // Contenedor de toasts
    var toastId = options.toastContainerId || 'toastContainer';
    _toastContainer = document.getElementById(toastId);
    if (!_toastContainer) {
      _toastContainer = document.createElement('div');
      _toastContainer.id = toastId;
      _toastContainer.style.cssText = [
        'position: fixed; top: 16px; right: 16px;',
        'display: flex; flex-direction: column; gap: 8px;',
        'z-index: 10000; pointer-events: none;'
      ].join(' ');
      document.body.appendChild(_toastContainer);
    }

    // Inyectar estilos de animación
    if (!document.getElementById('toastStyles')) {
      var style = document.createElement('style');
      style.id = 'toastStyles';
      style.textContent = '@keyframes slideInRight { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }';
      document.head.appendChild(style);
    }
  }

  // ============================================================
  // FUNCIÓN PRINCIPAL
  // ============================================================

  function notify(message, options) {
    options = options || {};
    var voice = options.voice !== undefined ? options.voice : !options.isError;
    var toast = options.toast || false;
    var statusBar = options.statusBar !== undefined ? options.statusBar : true;
    var isError = options.isError || false;
    var duration = options.duration || 4000;

    // 1. Voz
    if (voice && _voiceEnabled && typeof VoiceService !== 'undefined') {
      VoiceService.speak(message);
    }

    // 2. Barra de estado
    if (statusBar && _statusBarEnabled && _statusBarElement) {
      _statusBarElement.textContent = message;
      _statusBarElement.style.color = isError ? '#ef4444' : '#00f2ff';
    }

    // 3. Toast
    if (toast && _toastEnabled && _toastContainer) {
      showToast(message, isError, duration);
    }
  }

  // ============================================================
  // TOAST
  // ============================================================

  function showToast(message, isError, duration) {
    if (!_toastContainer) return;

    var toast = document.createElement('div');
    toast.style.cssText = [
      'background: ' + (isError ? 'rgba(185, 28, 28, 0.95)' : 'rgba(15, 23, 42, 0.95)') + ';',
      'border: 1px solid ' + (isError ? '#ef4444' : '#0ea5e9') + ';',
      'border-left: 4px solid ' + (isError ? '#ef4444' : '#00f2ff') + ';',
      'border-radius: 6px; padding: 10px 16px; max-width: 400px;',
      'font-family: "Segoe UI", sans-serif; font-size: 13px;',
      'color: ' + (isError ? '#fca5a5' : '#e2e8f0') + ';',
      'box-shadow: 0 4px 20px rgba(0,0,0,0.5);',
      'backdrop-filter: blur(8px); pointer-events: auto;',
      'animation: slideInRight 0.3s ease-out;',
      'transition: opacity 0.3s ease-out, transform 0.3s ease-out;'
    ].join(' ');

    toast.textContent = message;
    _toastContainer.appendChild(toast);

    setTimeout(function() {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(function() {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }, duration);
  }

  // ============================================================
  // CONTROL
  // ============================================================

  function setVoiceEnabled(enabled) {
    _voiceEnabled = enabled;
    if (typeof VoiceService !== 'undefined') VoiceService.setEnabled(enabled);
  }

  function isVoiceEnabled() {
    return _voiceEnabled;
  }

  function setToastEnabled(enabled) {
    _toastEnabled = enabled;
  }

  function setStatusBarEnabled(enabled) {
    _statusBarEnabled = enabled;
    if (_statusBarElement) {
      _statusBarElement.style.display = enabled ? 'block' : 'none';
    }
  }

  // ============================================================
  // API
  // ============================================================

  return {
    init: init,
    notify: notify,
    setVoiceEnabled: setVoiceEnabled,
    isVoiceEnabled: isVoiceEnabled,
    setToastEnabled: setToastEnabled,
    setStatusBarEnabled: setStatusBarEnabled
  };
})();
