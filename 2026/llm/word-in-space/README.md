# واژه‌چین · Word in space

A small Persian word-placement game built with HTML, CSS, and JavaScript. No build or dependencies required.

Run `npm run dev` and open http://localhost:5173, or open `index.html` directly.

Open `vectors.html` directly after arranging words in the main game. Use the same browser and origin so the saved layout is available. This companion game keeps the cached word positions fixed and never writes to the main game's storage. Tap/click a word, or focus it and press Enter/Space, to show its column vector beside it; selecting another word replaces the selection. Click empty space or press Escape to deselect. Pan by dragging the sheet or scrolling; pinch or Ctrl-wheel to zoom; all words are fitted into view on load and resize.

The vector origin is `((min(x) + max(x)) / 2, (min(y) + max(y)) / 2)` over the placed words' saved anchors (their top-left positions). Each small grid square is 0.2 units (24 saved CSS pixels). Components are `(0.2 * (x - origin.x) / 24, 0.2 * (origin.y - y) / 24)`, with positive y upward, displayed to two decimal places. Unplaced words are omitted; an empty or unavailable cache displays a reminder to play the main game. Both games share the word list in `words.js`.

Drag the ten words from the sidebar onto the grid, reposition them, or drag them back to the word list. Mouse and touch are supported. You can also select a word and click the sheet. With a keyboard, select a sidebar word, focus the sheet and press Enter; use arrow keys to move a placed word (Shift for larger steps), and Delete to return it. Layouts are saved locally in your browser. The reset button clears the sheet.

The grid has equal spacing and no axes, coordinates, or marked origin. The Persian font is loaded from Google Fonts with a local Tahoma fallback. On phones, pinch with two fingers on the sheet to zoom only the grid and placed words (50–400%). Move both fingers together to pan the infinite sheet in any direction at any zoom level; the sidebar stays fixed. On desktop, use a trackpad or mouse wheel to pan (Shift-wheel pans horizontally). Rectangle selection is disabled on touch-capable devices; individual words can still be dragged.

Words use one neutral style and appear in a mixed list without category labels. Drag on empty sheet space to select multiple words, then drag any selected word to move the whole group. Shift-drag adds to the selection; Shift-click toggles individual words. Click empty space or press Escape to clear selection. Arrow keys move the selected group, and Delete returns it to the sidebar. The sheet has no edges: words and groups can occupy any position, including negative coordinates. Word positions and the current view are saved together, and existing layouts are migrated automatically.
