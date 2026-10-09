type VoidFn = () => void;

let _show: VoidFn = () => {};
let _hide: VoidFn = () => {};
let visible = false;

export function registerFabFns(show: VoidFn, hide: VoidFn): void {
  _show = show;
  _hide = hide;
}

export function showFab(): void {
  visible = true;
  _show();
}

export function hideFab(): void {
  visible = false;
  _hide();
}

export function isFabVisible(): boolean {
  return visible;
}
