/**
 * html2canvas parses stylesheet color functions poorly (Tailwind v4 emits oklch()).
 * Copy resolved RGB/RGBA paint from the live DOM onto the detached clone so capture matches the screen without hitting unsupported parsers.
 */
export function mirrorResolvedPaintOntoClone(originalRoot: HTMLElement, clonedRoot: HTMLElement): void {
  const orig = [originalRoot, ...originalRoot.querySelectorAll<HTMLElement>('*')];
  const clone = [clonedRoot, ...clonedRoot.querySelectorAll<HTMLElement>('*')];
  if (orig.length !== clone.length) return;

  for (let i = 0; i < orig.length; i++) {
    const o = orig[i];
    const c = clone[i];
    const cs = window.getComputedStyle(o);

    const bg = cs.backgroundColor;
    if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
      c.style.backgroundColor = bg;
    }

    const bgImg = cs.backgroundImage;
    if (bgImg && bgImg !== 'none') {
      c.style.backgroundImage = bgImg;
      c.style.backgroundRepeat = cs.backgroundRepeat;
      c.style.backgroundPosition = cs.backgroundPosition;
      c.style.backgroundSize = cs.backgroundSize;
      c.style.backgroundClip = cs.backgroundClip;
    }

    c.style.color = cs.color;

    for (const side of ['top', 'right', 'bottom', 'left'] as const) {
      const bw = cs.getPropertyValue(`border-${side}-width`);
      const bs = cs.getPropertyValue(`border-${side}-style`);
      const bc = cs.getPropertyValue(`border-${side}-color`);
      if (bs !== 'none' && bw !== '0px') {
        c.style.setProperty(`border-${side}-width`, bw);
        c.style.setProperty(`border-${side}-style`, bs);
        c.style.setProperty(`border-${side}-color`, bc);
      }
    }

    const sh = cs.boxShadow;
    if (sh && sh !== 'none') {
      c.style.boxShadow = sh;
    }

    const op = cs.opacity;
    if (op && op !== '1') {
      c.style.opacity = op;
    }
  }
}
