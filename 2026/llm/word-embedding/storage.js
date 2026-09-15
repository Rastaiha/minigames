(function createWordEmbeddingStorage(global) {
  'use strict';

  function finiteNumber(value, fallback) {
    return Number.isFinite(value) ? value : fallback;
  }

  function read(key) {
    try {
      var raw = global.localStorage.getItem(key);
      if (!raw) return null;
      var value = JSON.parse(raw);
      if (!value || typeof value !== 'object') return null;
      var placedNodes = Array.isArray(value.placedNodes)
        ? value.placedNodes
            .filter(function validNode(node) {
              return (
                node &&
                typeof node.word === 'string' &&
                Number.isFinite(Number(node.left)) &&
                Number.isFinite(Number(node.top))
              );
            })
            .map(function normalizeNode(node) {
              return {
                word: node.word.slice(0, 120),
                left: finiteNumber(Number(node.left), 0),
                top: finiteNumber(Number(node.top), 0),
              };
            })
        : [];
      return {
        maxUnlockedStep: Math.min(
          4,
          Math.max(
            1,
            Math.trunc(finiteNumber(Number(value.maxUnlockedStep), 1))
          )
        ),
        projectionAngleDeg: Math.min(
          180,
          Math.max(0, finiteNumber(Number(value.projectionAngleDeg), 45))
        ),
        axisXTitle:
          typeof value.axisXTitle === 'string'
            ? value.axisXTitle.slice(0, 80)
            : '',
        axisYTitle:
          typeof value.axisYTitle === 'string'
            ? value.axisYTitle.slice(0, 80)
            : '',
        placedNodes: placedNodes,
      };
    } catch {
      return null;
    }
  }

  function write(key, value) {
    try {
      global.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Persistence is optional; the workshop remains usable in private mode.
    }
  }

  function remove(key) {
    try {
      global.localStorage.removeItem(key);
    } catch {
      // Ignore storage failures during reset.
    }
  }

  function readStep(hash, maximum) {
    var match = /^#step([1-4])$/.exec(hash || '');
    if (!match) return null;
    return Math.min(Number(match[1]), maximum);
  }

  global.WordEmbeddingStorage = Object.freeze({
    read: read,
    write: write,
    remove: remove,
    readStep: readStep,
  });
})(window);
