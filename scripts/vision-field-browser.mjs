import assert from 'node:assert/strict';

// CDP evaluates this fixture in the isolated game, never in published files.
export async function InstallFieldGrowth(game, selector) {
  await game(`(() => {
    const style = document.createElement('style');
    style.textContent = ${JSON.stringify(selector)} + '{width:120px!important;height:120px!important;min-height:0!important;flex:none!important}';
    document.head.append(style);
    window.fieldGrowth = { small: null, grown: false, errors: [], sizes: [] };
    const observer = new MutationObserver(() => {
      const field = document.querySelector(${JSON.stringify(selector)});
      if (!field || window.fieldGrowth.small) return;
      const rect = field.getBoundingClientRect();
      window.fieldGrowth.small = { width: rect.width, height: rect.height };
      const sizes = new ResizeObserver(() => { const r = field.getBoundingClientRect(); window.fieldGrowth.sizes.push({ width: r.width, height: r.height, trial: field.dataset.trial, state: field.dataset.state }); });
      sizes.observe(field);
      setTimeout(() => { style.remove(); window.fieldGrowth.grown = true; observer.disconnect(); }, 300);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    const errors = new MutationObserver(() => {
      const panel = document.querySelector('.search-rest, .saccade-layout-error');
      if (panel && /請調整|Adjust/.test(panel.textContent)) window.fieldGrowth.errors.push(panel.textContent);
    });
    errors.observe(document.body, { childList: true, subtree: true });
    window.fieldGrowth.stop = () => errors.disconnect();
  })()`);
}

export async function CheckFieldGrowth(game, until) {
  await until(() => game('window.fieldGrowth.grown'), 'late fullscreen field growth');
  assert.deepEqual(await game('window.fieldGrowth.small'), { width: 120, height: 120 });
  assert.deepEqual(await game('window.fieldGrowth.errors'), [], 'Late growth must not show an adjust panel.');
  await game('window.fieldGrowth.stop()');
}

export async function ResizeField(game, selector, shrink = true) {
  await game(`(() => { const field = document.querySelector(${JSON.stringify(selector)});
    if (${shrink}) { const width = field.getBoundingClientRect().width; field.style.width = (width - 8) + 'px'; }
    else field.style.removeProperty('width');
    return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  })()`);
}

export async function CheckSmallSearchField({ game, until, tap }) {
  await until(() => game(`document.querySelector('.search-field')?.dataset.trial === '1'`), 'first search block prepared');
  await game(`(() => { const field = document.querySelector('.search-running .search-field'); field.style.width = '120px'; field.style.height = '120px'; })()`);
  await until(() => game(`Boolean(document.querySelector('.search-rest'))`), 'a genuinely small field expires the retry window');
  assert.match(await game(`document.querySelector('.search-rest').textContent`), /請調整畫面|Adjust the window/);
  await game(`(() => { const field = document.querySelector('.search-running .search-field'); field.style.removeProperty('width'); field.style.removeProperty('height'); })()`);
  assert.ok(await game(`Boolean(document.querySelector('.search-rest'))`));
  await tap('.search-continue');
  await until(() => game(`!document.querySelector('.search-rest')`), 'Continue retries after enlargement');
}
