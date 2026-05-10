/** Shared helpers for invoice/purchase composer keyboard shortcuts. */

export function isComposerTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.closest('[data-composer-shortcuts-ignore]')) return true;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  return target.isContentEditable;
}

/** Block Ctrl/Cmd+Shift+Enter submit/post — still allow from line inputs; never from textarea. */
export function blockComposerSubmitShortcut(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.closest('[data-composer-shortcuts-ignore]')) return true;
  return target.tagName === 'TEXTAREA';
}
