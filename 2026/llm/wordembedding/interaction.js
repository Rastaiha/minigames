(function createWordEmbeddingInteraction(global) {
  'use strict';

  function isTap(start, end, threshold) {
    var limit = threshold || 8;
    return Math.hypot(end.x - start.x, end.y - start.y) <= limit;
  }

  function bindTap(element, callback) {
    var start = null;
    element.addEventListener('pointerdown', function onPointerDown(event) {
      if (event.button !== 0) return;
      start = { x: event.clientX, y: event.clientY };
      element.setPointerCapture(event.pointerId);
    });
    element.addEventListener('pointerup', function onPointerUp(event) {
      if (start && isTap(start, { x: event.clientX, y: event.clientY }))
        callback(event);
      start = null;
    });
    element.addEventListener('pointercancel', function onPointerCancel() {
      start = null;
    });
  }

  global.WordEmbeddingInteraction = Object.freeze({
    bindTap: bindTap,
    isTap: isTap,
  });
})(window);
