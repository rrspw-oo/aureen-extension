import { invoke } from '@tauri-apps/api/core';

// Hands exports (PDF / JSON / Markdown) to Rust, which writes them to ~/Downloads and reveals them.
(globalThis as unknown as { __aureenSaveFile: (blob: Blob, filename: string) => void }).__aureenSaveFile = (blob, filename) => {
  void blob.arrayBuffer().then((buffer) =>
    invoke('save_download', new Uint8Array(buffer), { headers: { 'x-filename': encodeURIComponent(filename) } })
  ).catch((e) => alert(`Save failed: ${e}`));
};
