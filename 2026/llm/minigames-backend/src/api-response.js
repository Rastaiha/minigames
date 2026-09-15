import { json } from './http.js';

export function apiRespondError(message, status, cors) {
  return json(
    { ok: false, data: null, meta: {}, error: message },
    status,
    cors
  );
}

export function apiRespondSuccess(data, meta, cors) {
  return json({ ok: true, data, meta: meta || {}, error: null }, 200, cors);
}
