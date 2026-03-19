import { Electroview } from 'electrobun/view';
import type { ConivaRPC } from '../shared/rpc-types';

const rpc = Electroview.defineRPC<ConivaRPC>({
  handlers: {
    requests: {},
    messages: {
      menuTriggered: (payload) => {
        window.dispatchEvent(new CustomEvent('coniva:desktop-command', { detail: payload }));
        window.dispatchEvent(new CustomEvent('coniva:menu', { detail: payload }));
      },
      projectSaved: (payload) => {
        window.dispatchEvent(new CustomEvent('coniva:project-saved', { detail: payload }));
      },
      projectOpenedFromDisk: (payload) => {
        window.dispatchEvent(new CustomEvent('coniva:project-opened-from-disk', { detail: payload }));
      },
      confirmQuit: (payload) => {
        window.dispatchEvent(new CustomEvent('coniva:confirm-quit', { detail: payload }));
      },
      updateAvailable: (payload) => {
        window.dispatchEvent(new CustomEvent('coniva:update-available', { detail: payload }));
      },
    },
  },
});

(
  window as Window & {
    electrobun?: typeof window.__electrobun;
  }
).electrobun = window.__electrobun;
new Electroview({ rpc });
rpc.send('webviewReady', undefined);
