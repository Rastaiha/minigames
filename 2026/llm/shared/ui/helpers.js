(function createMinigameUi(global) {
  'use strict';

  function setStatus(element, message, state) {
    if (!element) return;
    element.textContent = message || '';
    if (state) element.dataset.state = state;
    else delete element.dataset.state;
  }

  function wireReset(button, reset) {
    if (!button || typeof reset !== 'function') return function noop() {};
    var handler = function handleReset(event) {
      event.preventDefault();
      reset();
    };
    button.addEventListener('click', handler);
    return function removeReset() {
      button.removeEventListener('click', handler);
    };
  }

  global.MinigameUi = Object.freeze({
    setStatus: setStatus,
    wireReset: wireReset,
  });
})(window);
