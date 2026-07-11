export interface DisplaySettings {
  fontSizePx: number;
  defaultFontSizePx: number;
  fontBold: boolean;
  uiTheme?: string;
}

export function applyDisplaySettings({
  fontSizePx,
  defaultFontSizePx,
  fontBold,
  uiTheme,
}: DisplaySettings) {
  const fontScale = fontSizePx / defaultFontSizePx;
  const root = document.documentElement;

  root.style.setProperty('--ui-font-size', `${fontSizePx}px`);
  root.style.setProperty('--ui-font-scale', String(fontScale));
  root.style.setProperty('--ui-font-weight', fontBold ? '700' : '500');
  root.style.setProperty('--ui-font-medium-weight', fontBold ? '800' : '700');
  root.style.setProperty('--ui-font-heading-weight', fontBold ? '900' : '800');

  document.body.dataset.uiFontBold = fontBold ? 'true' : 'false';
  document.body.dataset.uiFontSize = String(fontSizePx);

  if (uiTheme !== undefined) {
    document.body.dataset.uiTheme = uiTheme;
  }
}
