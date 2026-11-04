export function startVersionChecks(buildId: string, onUpdate: () => void) {
  let disposed = false;
  let checking = false;
  const check = async () => {
    if (checking || document.visibilityState !== 'visible') return;
    checking = true;
    try {
      const response = await fetch('/version.json', {cache: 'no-store', credentials: 'omit'});
      if (!response.ok) return;
      const data: unknown = await response.json();
      if (!disposed && data && typeof data === 'object' && 'buildId' in data &&
          typeof data.buildId === 'string' && data.buildId.length > 0 && data.buildId !== buildId) onUpdate();
    } catch { /* Keep the current interface on network or response errors. */ }
    finally { checking = false; }
  };
  const onVisibility = () => { if (document.visibilityState === 'visible') void check(); };
  void check();
  document.addEventListener('visibilitychange', onVisibility);
  const timer = window.setInterval(() => { void check(); }, 60 * 60 * 1000);
  return () => { disposed = true; document.removeEventListener('visibilitychange', onVisibility); window.clearInterval(timer); };
}
