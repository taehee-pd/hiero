/**
 * Keychain abstraction for secure token storage.
 *
 * Desktop: uses OS keychain via Electrobun RPC.
 * Web: returns null (web uses server-side env vars via API proxy).
 *
 * @module
 */

import { isDesktop } from './bridge';

// We can't import electrobunRequest directly (it's module-private),
// so we use dynamic import of bridge functions. The keychain RPC
// methods are routed through the bridge's generic request mechanism.

/**
 * Retrieve an npm token from the platform keychain.
 * Returns null on web or if no token is stored.
 */
export async function getNpmToken(targetId: string): Promise<string | null> {
  if (!isDesktop()) return null;

  try {
    // Dynamic import to avoid circular dependency
    const bridge = await import('./bridge');
    const request = (bridge as Record<string, unknown>)['electrobunRequest'] as
      | (<T>(method: string, params: unknown) => Promise<T>)
      | undefined;

    // Fall back to a direct RPC call pattern if electrobunRequest isn't exported
    if (!request) {
      // The bridge module doesn't export electrobunRequest directly.
      // For keychain ops, we'll use a lightweight fetch-from-self pattern
      // or rely on the native bridge being available via window.
      return keychainViaWindow('keychain-get', {
        service: 'coniva-npm',
        account: targetId,
      });
    }

    return await request<string | null>('keychain-get', {
      service: 'coniva-npm',
      account: targetId,
    });
  } catch {
    return null;
  }
}

/**
 * Store an npm token in the platform keychain.
 * Desktop only — throws on web.
 */
export async function setNpmToken(targetId: string, token: string): Promise<void> {
  if (!isDesktop()) {
    throw new Error('Keychain is only available in the desktop environment.');
  }

  await keychainViaWindow('keychain-set', {
    service: 'coniva-npm',
    account: targetId,
    token,
  });
}

/**
 * Remove an npm token from the platform keychain.
 */
export async function clearNpmToken(targetId: string): Promise<void> {
  if (!isDesktop()) return;

  await keychainViaWindow('keychain-delete', {
    service: 'coniva-npm',
    account: targetId,
  });
}

// ---------------------------------------------------------------------------
// Internal: direct window bridge call for keychain ops
// ---------------------------------------------------------------------------

let keychainRequestId = 9000;

function keychainViaWindow<T>(method: string, params: unknown): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    if (
      typeof window === 'undefined' ||
      !window.__electrobunBunBridge
    ) {
      reject(new Error('Electrobun bridge is unavailable for keychain operation.'));
      return;
    }

    const id = ++keychainRequestId;
    const timeout = setTimeout(() => {
      reject(new Error(`Keychain request timed out: ${method}`));
    }, 10_000);

    // Temporarily listen for the response
    const originalHandler = window.electrobun?.receiveMessageFromBun;
    const handler = (message: unknown) => {
      if (!message || typeof message !== 'object') {
        originalHandler?.(message);
        return;
      }
      const packet = message as { type?: string; id?: number; success?: boolean; payload?: unknown; error?: string };
      if (packet.type === 'response' && packet.id === id) {
        clearTimeout(timeout);
        // Restore original handler
        if (window.electrobun && originalHandler) {
          window.electrobun.receiveMessageFromBun = originalHandler;
        }
        if (packet.success) {
          resolve(packet.payload as T);
        } else {
          reject(new Error(packet.error ?? 'Keychain request failed.'));
        }
      } else {
        // Not our packet — pass through to original handler
        originalHandler?.(message);
      }
    };

    if (window.electrobun) {
      window.electrobun.receiveMessageFromBun = handler;
    }

    window.__electrobunBunBridge.postMessage(
      JSON.stringify({
        type: 'request',
        id,
        method,
        params,
      }),
    );
  });
}
