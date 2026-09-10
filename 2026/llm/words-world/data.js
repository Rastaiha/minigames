export function parseCSV(text) {
  const rows = []; let row = [], field = '', quoted = false;
  for (const char of text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n') + '\n') {
    if (char === '"') { quoted = !quoted; field += char; }
    else if ((char === ',' || char === '\n') && !quoted) {
      row.push(field.replace(/^"|"$/g, '').replace(/""/g, '"').trim()); field = '';
      if (char === '\n') { if (row.some(Boolean)) rows.push(row); row = []; }
    } else field += char;
  }
  const header = rows.shift();
  if (!header || !['word','tsne_x','tsne_y','tsne_z'].every(k => header.includes(k))) throw new Error('فایل باید شامل واژه و سه ستون مختصات نقشه باشد.');
  return rows.map((r, id) => ({ id, word:r[header.indexOf('word')], tsne:['x','y','z'].map(a => Number(r[header.indexOf('tsne_'+a)] || NaN)) })).filter(r => r.word && r.tsne.every(Number.isFinite));
}
export function nearest(words, selected, count = 5) {
  return words.filter(w => w.id !== selected.id).map(w => ({ word:w, distance: Math.hypot(...w.tsne.map((n,i) => n-selected.tsne[i])) })).sort((a,b) => a.distance-b.distance || a.word.id-b.word.id).slice(0,count);
}
