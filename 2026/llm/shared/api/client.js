(function createMinigameApi(global) {
  'use strict';

  function getClientId() {
    var key = 'minigames-client-id';
    try {
      var existing = window.localStorage.getItem(key);
      if (existing) return existing;
      var generated =
        window.crypto && window.crypto.randomUUID
          ? window.crypto.randomUUID()
          : 'browser-' + Math.random().toString(36).slice(2) + Date.now();
      window.localStorage.setItem(key, generated);
      return generated;
    } catch {
      return 'browser-session';
    }
  }

  async function request(route, payload, options) {
    var settings = options || {};
    var root =
      (global.MINIGAMES_CONFIG && global.MINIGAMES_CONFIG.workerRoot) || '';
    if (!root) throw new Error('پیکربندی سرویس در دسترس نیست.');

    var controller = new AbortController();
    var signal = controller.signal;
    var timeout = settings.timeoutMs || 60000;
    var timer = setTimeout(function abortRequest() {
      controller.abort();
    }, timeout);
    var forwardAbort = function forwardAbort() {
      controller.abort();
    };
    if (settings.signal) {
      if (settings.signal.aborted) controller.abort();
      else
        settings.signal.addEventListener('abort', forwardAbort, { once: true });
    }

    try {
      var response = await fetch(
        root.replace(/\/$/, '') + '/' + route.replace(/^\//, ''),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Client-Id': getClientId(),
          },
          body: JSON.stringify(payload),
          signal: signal,
        }
      );
      var body = await response.json().catch(function invalidJson() {
        return {};
      });
      if (!response.ok) {
        throw new Error(body.error || 'پاسخ سرویس ناموفق بود.');
      }
      return body;
    } catch (error) {
      if (error && error.name === 'AbortError') {
        throw error;
      }
      throw new Error(
        error && error.message ? error.message : 'ارتباط با سرویس برقرار نشد.'
      );
    } finally {
      clearTimeout(timer);
      if (settings.signal)
        settings.signal.removeEventListener('abort', forwardAbort);
    }
  }

  async function respond(game, mode, input, options) {
    var body = await request(
      '/api/respond',
      { version: 1, game: game, mode: mode, input: input },
      options
    );
    if (!body || body.ok !== true || !body.data) {
      throw new Error((body && body.error) || 'پاسخ سرویس نامعتبر بود.');
    }
    return body;
  }

  global.MinigameApi = Object.freeze({ request: request, respond: respond });
})(window);
