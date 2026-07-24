// Walk a value's provenance back to the original tiles that produced it.
export function traceTiles(intermediates, source) {
  const tiles = new Set();
  if (!source) return tiles;
  const seen = new Set();
  const walk = (i) => {
    if (seen.has(i)) return;
    seen.add(i);
    const im = intermediates[i];
    if (!im) return;
    for (const s of im.sources) {
      if (s.type === "number") tiles.add(s.index);
      else walk(s.index);
    }
  };
  if (source.type === "number") tiles.add(source.index);
  else walk(source.index);
  return tiles;
}
