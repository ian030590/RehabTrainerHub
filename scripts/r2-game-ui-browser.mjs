import assert from 'node:assert/strict';

export async function CheckSettingsPresentation(game) {
  const layout = await game(`(() => {
    const form = document.querySelector('form.training-config');
    if (!form) return null;
    const header = form.querySelector('.training-config-header');
    const body = form.querySelector('.training-config-body');
    const footer = form.querySelector('footer.config-actions');
    const primary = footer?.querySelector('.btn-primary');
    const secondary = footer?.querySelector('.btn-ghost');
    const rect = form.getBoundingClientRect();
    window.settingsPresentation = { fontSize: getComputedStyle(form).fontSize,
      titleSize: getComputedStyle(header.querySelector('h2')).fontSize,
      bodyPadding: getComputedStyle(body).padding, radius: getComputedStyle(form).borderRadius };
    return { ...window.settingsPresentation, weight: getComputedStyle(form).fontWeight,
      bodyScroll: getComputedStyle(body).overflowY, sections: body.querySelectorAll('.training-setting h3').length,
      primary: primary && getComputedStyle(primary).backgroundColor,
      secondary: secondary && getComputedStyle(secondary).backgroundColor,
      footerBottom: footer?.getBoundingClientRect().bottom, bottom: rect.bottom,
      left: rect.left, right: rect.right, top: rect.top, width: innerWidth, height: innerHeight };
  })()`);
  assert.ok(layout, 'Settings must use the training-config form.');
  assert.equal(layout.fontSize, '18.4px');
  assert.equal(layout.radius, '8px');
  assert.equal(layout.titleSize, layout.width >= 640 ? '34.5px' : '27.6px');
  assert.equal(layout.bodyPadding, layout.width >= 640 ? '24px 32px' : '20px');
  assert.ok(Number(layout.weight) >= 700);
  assert.equal(layout.bodyScroll, 'auto');
  assert.ok(layout.sections >= 1);
  assert.ok(layout.primary && layout.secondary && layout.primary !== layout.secondary);
  assert.ok(layout.left >= 15 && layout.right <= layout.width - 15 && layout.top >= 15 && layout.bottom <= layout.height - 15,
    JSON.stringify(layout));
  assert.ok(Math.abs(layout.footerBottom - layout.bottom) <= 2, 'Actions remain at the bottom of the panel.');
}

export async function CheckConfirmationPresentation(game) {
  const layout = await game(`(() => {
    const panel = document.querySelector('.training-confirmation');
    if (!panel) return null;
    const body = panel.querySelector('.training-config-body');
    const rect = panel.getBoundingClientRect();
    return { fontSize: getComputedStyle(panel).fontSize,
      titleSize: getComputedStyle(panel.querySelector('h2')).fontSize,
      bodyPadding: getComputedStyle(body).padding, radius: getComputedStyle(panel).borderRadius,
      baseline: window.settingsPresentation, bodyScroll: getComputedStyle(body).overflowY,
      rows: panel.querySelectorAll('.training-config-summary-item').length,
      unnamed: panel.querySelectorAll('div:not([class])').length,
      weight: getComputedStyle(panel.querySelector('.training-config-summary-item')).fontWeight,
      start: Boolean(panel.querySelector('footer .btn-primary')), back: Boolean(panel.querySelector('footer .btn-ghost')),
      left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: innerWidth, height: innerHeight };
  })()`);
  assert.ok(layout, 'Final settings must use a training-confirmation panel.');
  for (const property of ['fontSize', 'titleSize', 'bodyPadding', 'radius']) assert.equal(layout[property], layout.baseline[property], property);
  assert.equal(layout.bodyScroll, 'auto');
  assert.ok(layout.rows > 0 && Number(layout.weight) >= 700);
  assert.equal(layout.unnamed, 0);
  assert.ok(layout.start && layout.back);
  assert.ok(layout.left >= 15 && layout.right <= layout.width - 15 && layout.top >= 15 && layout.bottom <= layout.height - 15,
    JSON.stringify(layout));
  assert.ok(await game('document.documentElement.scrollWidth <= innerWidth'));
}
