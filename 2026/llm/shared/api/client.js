(function createMinigameApi(global) {
  'use strict';

  function getClientId() {
    var key = 'minigames-client-id';
    try {
      var existing = window.localStorage.getItem(key);
      if (existing) return existing;
      var generated = window.crypto && window.crypto.randomUUID
        ? window.crypto.randomUUID()
        : 'browser-' + Math.random().toString(36).slice(2) + Date.now();
      window.localStorage.setItem(key, generated);
      return generated;
    } catch (error) {
      return 'browser-session';
    }
  }

  async function request(route, payload, options) {
    var settings = options || {};
    var root = (global.MINIGAMES_CONFIG && global.MINIGAMES_CONFIG.workerRoot) || '';
    if (!root) throw new Error('پیکربندی سرویس در دسترس نیست.');

    var controller = settings.signal ? null : new AbortController();
    var signal = settings.signal || controller.signal;
    var timer = controller && setTimeout(function abortRequest() {
      controller.abort();
    }, settings.timeoutMs || 60000);

    try {
      var response = await fetch(root.replace(/\/$/, '') + '/' + route.replace(/^\//, ''), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Id': getClientId()
        },
        body: JSON.stringify(payload),
        signal: signal
      });
      var body = await response.json().catch(function invalidJson() { return {}; });
      if (!response.ok) {
        throw new Error(body.error || 'پاسخ سرویس ناموفق بود.');
      }
      return body;
    } catch (error) {
      if (error && error.name === 'AbortError') {
        throw error;
      }
      throw new Error(error && error.message ? error.message : 'ارتباط با سرویس برقرار نشد.');
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  global.MinigameApi = Object.freeze({ request: request });
}(window));
