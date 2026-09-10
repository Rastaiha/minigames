# واژه‌چین · Word in space

A small Persian word-placement game built with HTML, CSS, and JavaScript. No build or dependencies required.

Run `npm run dev` and open http://localhost:5173, or open `index.html` directly.

Drag the ten words from the sidebar onto the grid, reposition them, or drag them back to the word list. Mouse and touch are supported. You can also select a word and click the sheet. With a keyboard, select a sidebar word, focus the sheet and press Enter; use arrow keys to move a placed word (Shift for larger steps), and Delete to return it. Layouts are saved locally in your browser. The reset button clears the sheet.

The grid has equal spacing and no axes, coordinates, or marked origin. The Persian font is loaded from Google Fonts with a local Tahoma fallback.

Words use one neutral style and appear in a mixed list without category labels. Drag on empty sheet space to select multiple words, then drag any selected word to move the whole group. Shift-drag adds to the selection; Shift-click toggles individual words. Click empty space or press Escape to clear selection. Arrow keys move the selected group, and Delete returns it to the sidebar. Group movement stops at the sheet edge while preserving spacing.
