import assert from 'node:assert/strict';
import { GetBullsAndCowsLayout } from '../src/pages/thinking/cognitive/bullsAndCowsLayout.ts';

for (const [width, height] of [[390, 844], [844, 390], [320, 200]]) {
  const bounds = { left: width * 0.2, top: height * 0.2, width: width * 0.6, height: height * 0.6 };
  const layout = GetBullsAndCowsLayout(bounds, 8);
  const historyBottom = layout.history.y + layout.history.visibleRows * layout.history.rowHeight;
  const inputBottom = layout.input.y + layout.input.cell;
  const paletteBottom = layout.palette.y + layout.palette.cell * 2 + layout.palette.rowGap;
  const submitBottom = layout.submit.y + layout.submit.height;

  assert.ok(layout.history.visibleRows > 0);
  assert.ok(historyBottom <= layout.input.y);
  assert.ok(inputBottom <= layout.palette.y);
  assert.ok(paletteBottom <= layout.submit.y);
  assert.ok(submitBottom <= bounds.top + bounds.height);

  if (height >= 390) {
    assert.ok(layout.input.cell >= 38);
    assert.ok(layout.palette.cell >= 38);
    assert.ok(layout.submit.height >= 38);
  }
}

assert.equal(GetBullsAndCowsLayout({ left: 0, top: 0, width: 234, height: 506 }, 0).history.visibleRows, 0);

console.log('Bulls and Cows mobile layout check passed.');
