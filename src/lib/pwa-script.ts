/**
 * Catches the browser's "VYBZ can be installed" event before React loads and keeps
 * it on `window.__vybzInstall` for the Install buttons (see src/lib/pwa.ts).
 * Rendered as an inline <script> in the root layout's <head>.
 */
export const CATCH_INSTALL_PROMPT_SCRIPT = `addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__vybzInstall=e;dispatchEvent(new Event("vybz:installable"))});addEventListener("appinstalled",function(){window.__vybzInstall=null;window.__vybzInstalled=true;dispatchEvent(new Event("vybz:installable"))});`;
