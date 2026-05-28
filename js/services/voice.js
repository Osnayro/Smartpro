
const VoiceService = (function() {
  var _enabled = true;
  var _rate = 0.95;
  var _lang = 'es-ES';
  var _currentUtterance = null;

  function isAvailable() {
    return typeof window !== 'undefined' && typeof window.speechSynthesis !== 'undefined';
  }

  function speak(text) {
    if (!_enabled) return;
    if (!isAvailable()) return;
    window.speechSynthesis.cancel();
    _currentUtterance = new SpeechSynthesisUtterance(text);
    _currentUtterance.lang = _lang;
    _currentUtterance.rate = _rate;
    window.speechSynthesis.speak(_currentUtterance);
  }

  function cancel() {
    if (!isAvailable()) return;
    window.speechSynthesis.cancel();
    _currentUtterance = null;
  }

  function setEnabled(enabled) {
    _enabled = enabled;
    if (!enabled) cancel();
  }

  function isEnabled() {
    return _enabled;
  }

  function setRate(rate) {
    _rate = Math.max(0.5, Math.min(2.0, rate));
  }

  function setLang(lang) {
    _lang = lang;
  }

  return {
    speak: speak,
    cancel: cancel,
    setEnabled: setEnabled,
    isEnabled: isEnabled,
    isAvailable: isAvailable,
    setRate: setRate,
    setLang: setLang
  };
})();
