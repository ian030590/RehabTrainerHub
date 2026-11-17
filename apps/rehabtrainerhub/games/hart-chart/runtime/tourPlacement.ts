interface Size { width: number; height: number }
interface Rect { left: number; top: number; right: number; bottom: number }

export function PlaceTourPanel(viewport: Size, target: Rect | null, panel: Size, preferred: string) {
  const edge = 8;
  const gap = 20;
  const width = Math.max(0, Math.min(panel.width, viewport.width - edge * 2));
  const height = Math.max(0, Math.min(panel.height, viewport.height - edge * 2));
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
  if (target) {
    const regionsFor = (margin: number, separation: number) => ({
      above: { left: margin, top: margin, right: viewport.width - margin, bottom: Math.min(viewport.height - margin, target.top - separation) },
      below: { left: margin, top: Math.max(margin, target.bottom + separation), right: viewport.width - margin, bottom: viewport.height - margin },
      left: { left: margin, top: margin, right: Math.min(viewport.width - margin, target.left - separation), bottom: viewport.height - margin },
      right: { left: Math.max(margin, target.right + separation), top: margin, right: viewport.width - margin, bottom: viewport.height - margin },
    });
    let regions = regionsFor(edge, gap);
    const vertical = preferred === 'bottom' ? ['below', 'above'] as const : ['above', 'below'] as const;
    const all = [...vertical, 'left', 'right'] as const;
    const size = (region: Rect) => ({ width: Math.max(0, region.right - region.left), height: Math.max(0, region.bottom - region.top) });
    const full = vertical.find(key => size(regions[key]).height >= height);
    let usable = all.filter(key => { const space = size(regions[key]); return space.width >= 140 && space.height >= 120; });
    if (!full && usable.length === 0) {
      regions = regionsFor(0, 0);
      usable = all.filter(key => { const space = size(regions[key]); return space.width >= 140 && space.height >= 120; });
    }
    const chosen = full ?? usable.sort((a, b) => {
      const x = size(regions[a]); const y = size(regions[b]);
      return y.width * y.height - x.width * x.height;
    })[0];
    if (chosen) {
      const region = regions[chosen];
      const available = size(region);
      const fittedWidth = Math.min(width, available.width);
      const fittedHeight = Math.min(height, available.height);
      return {
        left: clamp((target.left + target.right - fittedWidth) / 2, region.left, region.right - fittedWidth),
        top: chosen === 'above' ? region.bottom - fittedHeight : chosen === 'below' ? region.top :
          clamp((target.top + target.bottom - fittedHeight) / 2, region.top, region.bottom - fittedHeight),
        width: fittedWidth, height: fittedHeight,
        maxHeight: fittedHeight,
      };
    }
  }
  return { left: Math.max(0, (viewport.width - width) / 2), top: Math.max(0, (viewport.height - height) / 2), width, height, maxHeight: Math.max(0, viewport.height - edge * 2) };
}
