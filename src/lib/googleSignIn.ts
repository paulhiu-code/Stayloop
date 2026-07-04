const GSI_SCRIPT_URL = 'https://accounts.google.com/gsi/client';

type GoogleCredentialResponse = {
  credential: string;
  select_by?: string;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: Record<string, unknown>) => void;
          renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void;
          disableAutoSelect: () => void;
        };
      };
    };
  }
}

let scriptLoadPromise: Promise<void> | null = null;

function waitForGoogleAccounts(timeoutMs = 10_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const started = Date.now();

    const check = () => {
      if (window.google?.accounts?.id) {
        resolve();
        return;
      }
      if (Date.now() - started >= timeoutMs) {
        reject(new Error('Google Sign-In failed to initialize'));
        return;
      }
      window.requestAnimationFrame(check);
    };

    check();
  });
}

export function loadGoogleIdentityScript(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Sign-In is only available in the browser'));
  }

  if (window.google?.accounts?.id) {
    return Promise.resolve();
  }

  if (scriptLoadPromise) {
    return scriptLoadPromise;
  }

  scriptLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${GSI_SCRIPT_URL}"]`);
    if (existing) {
      waitForGoogleAccounts()
        .then(resolve)
        .catch(reject);
      return;
    }

    const script = document.createElement('script');
    script.src = GSI_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      waitForGoogleAccounts().then(resolve).catch(reject);
    };
    script.onerror = () => {
      scriptLoadPromise = null;
      reject(new Error('Failed to load Google Sign-In'));
    };
    document.head.appendChild(script);
  });

  return scriptLoadPromise;
}

export function getGoogleClientId(): string | null {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();
  return clientId || null;
}

export function preloadGoogleSignIn(): void {
  const clientId = getGoogleClientId();
  if (!clientId) return;
  loadGoogleIdentityScript().catch(() => {
    // Best-effort preload; sign-in flow handles errors explicitly.
  });
}

export async function requestGoogleIdToken(clientId: string): Promise<string> {
  await loadGoogleIdentityScript();

  if (!window.google?.accounts?.id) {
    throw new Error('Google Sign-In is unavailable');
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    let popupLikelyOpen = false;

    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    document.body.appendChild(container);

    const cleanup = () => {
      if (container.parentNode) {
        container.parentNode.removeChild(container);
      }
    };

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      window.removeEventListener('focus', onWindowFocus);
      window.clearTimeout(timeoutId);
      cleanup();
      fn();
    };

    const onWindowFocus = () => {
      if (!popupLikelyOpen || settled) return;

      window.setTimeout(() => {
        if (!settled) {
          finish(() => reject(new Error('Google sign-in was cancelled')));
        }
      }, 400);
    };

    const timeoutId = window.setTimeout(() => {
      finish(() => reject(new Error('Google sign-in timed out')));
    }, 120_000);

    window.google!.accounts.id.initialize({
      client_id: clientId,
      callback: (response: GoogleCredentialResponse) => {
        if (!response?.credential) {
          finish(() => reject(new Error('Google sign-in did not return a credential')));
          return;
        }
        finish(() => resolve(response.credential));
      },
      auto_select: false,
      cancel_on_tap_outside: true,
      context: 'signin',
      itp_support: true,
    });

    window.google!.accounts.id.renderButton(container, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
    });

    window.requestAnimationFrame(() => {
      const button = container.querySelector('[role="button"]') as HTMLElement | null;
      if (!button) {
        finish(() => reject(new Error('Could not start Google sign-in')));
        return;
      }

      popupLikelyOpen = true;
      window.addEventListener('focus', onWindowFocus);
      button.click();
    });
  });
}
