import { Electroview } from 'electrobun/view';
import type { IcophoneRPC } from '../shared/rpc-types';

const rpc = Electroview.defineRPC<IcophoneRPC>({
  handlers: {
    requests: {},
    messages: {
      menuTriggered: (payload) => {
        window.dispatchEvent(new CustomEvent('icophone:desktop-command', { detail: payload }));
        window.dispatchEvent(new CustomEvent('icophone:menu', { detail: payload }));
      },
      projectSaved: (payload) => {
        window.dispatchEvent(new CustomEvent('icophone:project-saved', { detail: payload }));
      },
      projectOpenedFromDisk: (payload) => {
        window.dispatchEvent(new CustomEvent('icophone:project-opened-from-disk', { detail: payload }));
      },
      confirmQuit: (payload) => {
        window.dispatchEvent(new CustomEvent('icophone:confirm-quit', { detail: payload }));
      },
      updateAvailable: (payload) => {
        window.dispatchEvent(new CustomEvent('icophone:update-available', { detail: payload }));
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
rpc.send('webviewReady');
