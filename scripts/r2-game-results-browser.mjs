import assert from 'node:assert/strict';

export async function CheckResultsPresentation(game, { defaultMetric, alternateMetric, english = false, capture }) {
  assert.equal(await game('document.querySelectorAll(".score-key-grid > div").length'), 3);
  assert.equal(await game('Boolean(document.querySelector(".score-context dl"))'), true);
  assert.equal(await game('document.querySelector(".score-analysis select").value'), defaultMetric);
  assert.equal(await game('Boolean(document.querySelector(".score-chart svg[role=img]"))'), true);
  assert.ok(await game(`document.querySelector(".score-analysis").textContent.includes(${JSON.stringify(english ? 'Round details' : '逐回合細節')})`));
  const before = await game('document.querySelectorAll(".score-analysis tbody tr").length');
  await game(`(() => {
    const select = document.querySelector('.score-analysis select');
    select.value = ${JSON.stringify(alternateMetric)};
    select.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  assert.equal(await game('document.querySelector(".score-analysis select").value'), alternateMetric);
  assert.equal(await game('document.querySelectorAll(".score-analysis tbody tr").length'), before);
  assert.equal(await game('document.querySelector(".score-analysis svg").getAttribute("aria-label").includes(document.querySelector(".score-analysis select option:checked").textContent.trim().replace(/ [s%]$/, ""))'), true);
  await game(`(() => {
    const select = document.querySelector('.score-analysis select');
    select.value = ${JSON.stringify(defaultMetric)};
    select.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  assert.ok(await game('document.documentElement.scrollWidth <= innerWidth'), 'Results must fit the viewport; wide tables scroll within their own region.');
  assert.ok(await game('Array.from(document.querySelectorAll(".results-table th")).every(cell => cell.getBoundingClientRect().width >= 48)'), 'Round columns remain readable.');
  assert.equal(await game('document.querySelectorAll(".experiment-results > button").length >= 1'), true);
  if (capture) {
    for (const [name, selector] of [['results', '.experiment-results h1'], ['results-analysis', '.score-analysis'], ['results-details', '#score-details-title']]) {
      await game(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({ block: 'start' })`);
      await capture(name);
    }
    await game('document.querySelector(".experiment-container").scrollTop = 0');
  }
}
