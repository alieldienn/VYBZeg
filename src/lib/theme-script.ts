/** Where the theme choice is saved on this device. */
export const THEME_KEY = "vybz:theme";

/**
 * Runs in <head> before the page paints: applies the saved theme (dark, light,
 * or "system" = follow the device) to <html data-theme>, so there's no flash
 * of the wrong theme. Anything unknown or missing means dark, the default.
 */
export const APPLY_THEME_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");var r=t==="light"?"light":t==="system"&&matchMedia("(prefers-color-scheme: light)").matches?"light":"dark";document.documentElement.dataset.theme=r}catch(e){}})()`;
