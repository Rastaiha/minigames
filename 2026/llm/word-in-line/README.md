# کلمات روی خط · Word in line

A Persian, one-dimensional version of Word in Space. Plain HTML, CSS, and JavaScript; no build or dependencies.

Run `npm run dev` and open http://localhost:5173, or open `index.html` directly. The optional Persian font uses the sibling `fonts/vazir.ttf`, with Tahoma as fallback.

Drag a word from the list into the line area, or select it and click/tap a position. Every word is stored as a single X coordinate: vertical pointer movement never changes its position. Pin tips mark the exact position on the horizontal axis, with a marked zero origin. Colliding labels automatically stack above and below the line without moving their anchors.

Drag pins horizontally to reposition them; drag back to the sidebar to return them. Drag empty space or scroll to pan horizontally. Use the +/− buttons or Ctrl-wheel to zoom, “بازگشت به مبدأ” to recenter zero, and “دیدن همه” to frame the words and origin.

Keyboard: select a list word, Tab to the axis, then Enter/Space to place it at the view center. Focus a pin and use Left/Right (Shift for larger steps); Delete/Backspace returns it to the list. Escape cancels a drag or selection. Mouse, touch, and pen use pointer events.

Positions and view are saved in browser storage under `word-in-line-layout-v1`, independently of Word in Space. Reset clears this game's layout. `npm run check` checks JavaScript syntax.
