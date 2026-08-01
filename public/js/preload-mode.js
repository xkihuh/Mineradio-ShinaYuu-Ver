try {
  document.documentElement.classList.add('startup-settling');
  // Record the fast-start preference without hiding the complete renderer.
  // The previous implementation added `startup-fast-skip-preload` here. If
  // any early visual module failed before the splash controller loaded, that
  // CSS gate stayed active forever and produced a fully black application.
  if (localStorage.getItem('mineradio-startup-fast-skip-v1') === '1') {
    document.documentElement.classList.add('startup-fast-skip-requested');
  }
  document.documentElement.classList.add(
    localStorage.getItem('mineradio-diy-player-mode-v1') === '1'
      ? 'diy-mode-preload'
      : 'simple-mode-preload'
  );
} catch (e) {
  document.documentElement.classList.add('simple-mode-preload');
}
