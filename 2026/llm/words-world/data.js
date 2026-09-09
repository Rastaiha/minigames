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
  if (!header || !['word','pca_x','pca_y','pca_z','tsne_x','tsne_y','tsne_z'].every(k => header.includes(k))) throw new Error('CSV must contain word, pca_x/y/z and tsne_x/y/z columns.');
  return rows.map((r, id) => ({ id, word:r[header.indexOf('word')], pca:['x','y','z'].map(a => Number(r[header.indexOf('pca_'+a)] || NaN)), tsne:['x','y','z'].map(a => Number(r[header.indexOf('tsne_'+a)] || NaN)) })).filter(r => r.word && [...r.pca,...r.tsne].every(Number.isFinite));
}
export function nearest(words, selected, mode, count = 5) {
  return words.filter(w => w.id !== selected.id).map(w => ({ word:w, distance: Math.hypot(...w[mode].map((n,i) => n-selected[mode][i])) })).sort((a,b) => a.distance-b.distance || a.word.id-b.word.id).slice(0,count);
}
export const normalizeWord = text => text.normalize('NFKC').replace(/ي/g,'ی').replace(/ك/g,'ک').replace(/[\u200c\u200d\u064b-\u065f]/g,'').trim().toLowerCase();
