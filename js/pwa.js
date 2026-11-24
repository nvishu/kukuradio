/* =========================================================================
   KUKU RADIO — js/pwa.js
   -------------------------------------------------------------------------
   WhatsApp "Request a Song" link, "Add to Home Screen" install prompt,
   and Service Worker registration.
   ========================================================================= */

const WHATSAPP_NUMBER = '919942933699';

const REQUEST_MESSAGE =
  'Hi KUKU RADIO 👋\n\nI want to request a song.\n\nSong name: \nStation / Playlist: \n\nPlease add it if possible. 🎵';

export function initSongRequestLink() {
  const link = document.getElementById('song-request-link');
  if (!link) return;
  link.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(REQUEST_MESSAGE)}`;
}

export function initServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((error) => {
      console.warn('[KUKU RADIO] Service worker registration failed:', error);
    });
  });
}

export function initInstallPrompt() {
  const installAppButton = document.getElementById('install-app-button');
  const installHint = document.getElementById('install-hint');
  if (!installAppButton) return;

  let deferredInstallPrompt = null;
  let hintTimer = null;

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    installAppButton.hidden = false;
  });

  installAppButton.addEventListener('click', async () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      installAppButton.hidden = true;
      return;
    }

    if (!installHint) return;

    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;

    if (isStandalone) {
      installHint.textContent = 'KUKU RADIO is already installed on this device.';
    } else if (isIOS) {
      installHint.textContent = 'On iPhone/iPad: tap Share → Add to Home Screen.';
    } else {
      installHint.textContent = 'On Android Chrome: open the browser menu (⋮) → Install app / Add to Home screen.';
    }

    installHint.hidden = false;
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => {
      installHint.hidden = true;
    }, 6500);
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    installAppButton.hidden = true;
  });
}
