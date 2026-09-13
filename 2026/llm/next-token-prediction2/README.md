# Next-token prediction

`tokenize_static.html` uses the same public Worker as the jailbreak game, configured
in `config.js`. No provider key is accepted or stored in the browser.

## Live mode

Deploy the updated `minigames-backend` with:

- `LLM_BASE_URL`: the existing OpenAI-compatible chat completions endpoint.
- `LLM_API_KEY`: uses the same backend credential resolution as the other games.
- `TOKEN_MODEL`: configured in `wrangler.toml` as
  `cf/@cf/meta/llama-3.1-8b-instruct-fp8-fast`.

Deploy from `minigames-backend` with `npm run deploy`. No additional provider
credential is required. An existing `LLM_API_KEY` Worker secret takes precedence
over the existing shared backend credential.

The route requests an instruction-following model to continue the text. These are
probabilities for its first response token given those chat messages, not raw
base-model prompt-completion probabilities. Tokens may include spaces or partial
words. Guesses must match exactly. Top-five probabilities are not renormalized;
an absent guess has unknown probability, not zero or “less than 0.1%”. A matching
guess above 0.1% is appended; otherwise the provider's sampled token is appended.
Models producing incomplete UTF-8 byte tokens are currently unsupported.

## API failures

Every prediction requires the real API. Missing configuration, connection failures,
HTTP errors, and missing or invalid logprobs produce a visible error. The text and
guess are preserved so the player can retry. Failed requests never append a token
or display invented probabilities. There is no local simulation or offline fallback;
the preset buttons only fill the starting text.

## Verification status

On 2026-09-13, curl verified HTTP 200 with complete JSON, Persian output, and
`logprobs.content[0].top_logprobs` from the configured Llama model using
`logprobs: true`, `top_logprobs: 5`, and `max_tokens: 1`. Local curl checks used
IPv4, explicit DNS resolution, and HTTP/1.0. The public Worker still needs deployment
of the new `/next-token` route before the browser game can use it.
