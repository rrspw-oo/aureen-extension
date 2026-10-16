/**
 * Confirmations and notices used by the shared UI. The extension uses the browser's own
 * dialogs; the desktop app (whose WebView ignores window.confirm / alert) installs its own.
 */
export interface ConfirmOptions {
  danger?: boolean;
  // Label of the confirming button (defaults to Delete for danger, OK otherwise).
  confirmLabel?: string;
}

type ConfirmFn = (message: string, options?: ConfirmOptions) => Promise<boolean>;
type NotifyFn = (message: string) => void;

let confirmImpl: ConfirmFn = async (message) => window.confirm(message);
let notifyImpl: NotifyFn = (message) => window.alert(message);

export function setDialogHandlers(handlers: { confirm: ConfirmFn; notify: NotifyFn }): void {
  confirmImpl = handlers.confirm;
  notifyImpl = handlers.notify;
}

export function confirmAction(message: string, options?: ConfirmOptions): Promise<boolean> {
  return confirmImpl(message, options);
}

export function notify(message: string): void {
  notifyImpl(message);
}
