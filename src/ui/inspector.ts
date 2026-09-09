/** An overlay: opening the inspector never resizes the canvas or moves the model. */
export function setInspectorOpen(panel: HTMLElement, open: boolean) {
  panel.inert = !open;
  panel.setAttribute('aria-hidden', String(!open));
}
