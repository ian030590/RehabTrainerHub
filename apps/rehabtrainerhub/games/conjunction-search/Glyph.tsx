import { glyphs, type Stimulus } from './logic/levels';

export function Glyph({ stimulus }: { stimulus: Stimulus }) {
  const glyph = glyphs[stimulus.glyph];
  return <svg className="search-glyph" data-tone={stimulus.tone} viewBox="0 0 100 100" aria-hidden="true">
    <path d={glyph.path} transform={glyph.transform} />
  </svg>;
}
