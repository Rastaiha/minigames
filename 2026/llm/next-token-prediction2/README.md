# Next-word prediction

The game is fully static. `tokenize_static.html` reads the finite continuation
tree in `word-tree.js`; it makes no network requests and contains no API key.

The checked-in tree contains four rounds for each preset sentence. At every
node, it starts with Llama's real top-five token log probabilities at temperature
1. Each candidate token is then forced into the assistant response and greedily
continued at temperature 0 until the token pieces form a visible word. A word's
probability is the product of the probabilities along that token path. Different
token paths that produce the same word are merged.

When a player's word is present in the stored choices, the game follows that
word's branch. Otherwise it samples one of the stored word branches using their
relative probabilities. Some nodes contain fewer than five words because invalid
fragments are removed or multiple token paths form the same word.

## Regenerating the tree

Install `generator-requirements.txt`, then run:

```sh
LLM_API_KEY=... LLM_BASE_URL=... python generate_word_tree.py
```

The generator uses `cf/@cf/meta/llama-3.1-8b-instruct-fp8-fast` by default and
stores its resumable API cache under `/tmp`. Credentials are read only by the
generator and are never written into the generated JavaScript.
