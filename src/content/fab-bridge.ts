type VoidFn = () => void;

let _show: VoidFn = () => {};
let _hide: VoidFn = () => {};

export function registerFabFns(show: VoidFn, hide: VoidFn): void {
  _show = show;
  _hide = hide;
}

export function showFab(): void {
  _show();
}

export function hideFab(): void {
  _hide();
}
