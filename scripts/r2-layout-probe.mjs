function MeasureLayout(viewportMode) {
  const root = document.documentElement;
  const scroller = document.scrollingElement || root;
  const verticalScroll = scroller.scrollHeight > innerHeight + 1 &&
    !['hidden', 'clip'].includes(getComputedStyle(scroller).overflowY);
  const interactive = 'button,a[href],input:not([type=hidden]),select,textarea,summary,[role=button],[role=tab],[tabindex]:not([tabindex="-1"])';
  const report = {
    viewportMode, width: innerWidth, height: innerHeight,
    horizontalOverflow: { pixels: Math.max(0, root.scrollWidth - innerWidth), elements: [] },
    clippedTargets: [], smallTargets: [], crowdedTargets: [], clippedText: [],
    chartText: { elements: [], min: null, median: null }, smallText: { count: 0, examples: [] },
  };
  if (report.horizontalOverflow.pixels <= 1) report.horizontalOverflow.pixels = 0;
  const targets = [];
  function Selector(element) {
    const parts = [];
    while (element) {
      if (element.id) {
        parts.unshift('#' + CSS.escape(element.id));
        break;
      }
      let index = 1;
      for (let sibling = element.previousElementSibling; sibling; sibling = sibling.previousElementSibling) {
        if (sibling.localName === element.localName) index++;
      }
      parts.unshift(element.localName + ':nth-of-type(' + index + ')');
      element = element.parentElement;
    }
    return parts.join(' > ');
  }
  for (const element of document.querySelectorAll('body, body *')) {
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height || element.closest('[inert]') ||
        !element.checkVisibility({ visibilityProperty: true, opacityProperty: true })) continue;
    const closed = element.closest('details:not([open])');
    if (closed && closed !== element && !closed.querySelector(':scope > summary')?.contains(element)) continue;
    const outsideX = rect.left < 0 || rect.right > innerWidth;
    const entry = { selector: Selector(element), rect: rect.toJSON() };
    if (report.horizontalOverflow.pixels && outsideX) report.horizontalOverflow.elements.push(entry);
    if (element.matches(interactive) && !element.matches('canvas,input[type=hidden]')) {
      let clipX = Math.max(0, -rect.left, rect.right - innerWidth);
      let clipY = verticalScroll ? 0 : Math.max(0, -rect.top, rect.bottom - innerHeight);
      for (let parent = element.parentElement; parent && (clipX || clipY); parent = parent.parentElement) {
        const style = getComputedStyle(parent);
        if (['auto', 'scroll'].includes(style.overflowX) && parent.scrollWidth > parent.clientWidth + 1) clipX = 0;
        if (['auto', 'scroll'].includes(style.overflowY) && parent.scrollHeight > parent.clientHeight + 1) clipY = 0;
      }
      if (clipX || clipY) report.clippedTargets.push({ ...entry, clipX, clipY });
      if (rect.width < 44 || rect.height < 44) {
        let { left, top, right, bottom } = rect;
        if (element.localName === 'input') {
          for (const label of element.labels || []) {
            const bounds = label.getBoundingClientRect();
            if (!bounds.width || !bounds.height || !label.checkVisibility({ visibilityProperty: true, opacityProperty: true })) continue;
            left = Math.min(left, bounds.left);
            top = Math.min(top, bounds.top);
            right = Math.max(right, bounds.right);
            bottom = Math.max(bottom, bounds.bottom);
          }
        }
        const effectiveRect = { x: left, y: top, left, top, right, bottom, width: right - left, height: bottom - top };
        if (effectiveRect.width < 44 || effectiveRect.height < 44) report.smallTargets.push({ ...entry, effectiveRect });
      }
      for (const previous of targets) {
        const other = previous.rect;
        const dx = Math.max(0, rect.left - other.right, other.left - rect.right);
        const dy = Math.max(0, rect.top - other.bottom, other.top - rect.bottom);
        const gap = Math.hypot(dx, dy);
        if (gap < 8) report.crowdedTargets.push({ selector: entry.selector, other: previous.selector, gap });
      }
      targets.push(entry);
    }
    if (element.matches('.score-chart svg text,svg.score-chart text')) report.chartText.elements.push(entry);
    if (![...element.childNodes].some(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim())) continue;
    const style = getComputedStyle(element);
    const clipX = ['hidden', 'clip'].includes(style.overflowX) ? element.scrollWidth - element.clientWidth : 0;
    const clipY = ['hidden', 'clip'].includes(style.overflowY) ? element.scrollHeight - element.clientHeight : 0;
    if (clipX > 1 || clipY > 1) report.clippedText.push({ ...entry, clipX, clipY });
    const fontSize = parseFloat(style.fontSize);
    if (fontSize < 14) {
      report.smallText.count++;
      if (report.smallText.examples.length < 10) report.smallText.examples.push({ ...entry, fontSize });
    }
  }
  report.horizontalOverflow.elements.sort((a, b) => b.rect.width - a.rect.width).splice(5);
  const heights = report.chartText.elements.map(entry => entry.rect.height).sort((a, b) => a - b);
  if (heights.length) {
    report.chartText.min = heights[0];
    report.chartText.median = (heights[Math.floor((heights.length - 1) / 2)] + heights[Math.floor(heights.length / 2)]) / 2;
  }
  return report;
}

export function LayoutProbeExpression(viewportMode) {
  return '(' + MeasureLayout.toString() + ')(' + JSON.stringify(viewportMode) + ')';
}
