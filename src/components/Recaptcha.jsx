import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

let scriptPromise;
function loadScript() {
  if (window.grecaptcha?.render) return Promise.resolve(window.grecaptcha);
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const failed = message => { clearTimeout(timeout); script.remove(); delete window.devoskiRecaptchaLoaded; scriptPromise = null; reject(Error(message)); };
    const timeout = setTimeout(() => failed('Verification did not load. Please retry.'), 15000);
    window.devoskiRecaptchaLoaded = () => { clearTimeout(timeout); delete window.devoskiRecaptchaLoaded; resolve(window.grecaptcha); };
    script.src = 'https://www.google.com/recaptcha/api.js?onload=devoskiRecaptchaLoaded&render=explicit';
    script.async = true; script.defer = true;
    script.onerror = () => failed('Verification could not load. Check your connection and retry.');
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export default forwardRef(function Recaptcha({ onToken, onError }, ref) {
  const container = useRef(null), widget = useRef(null), callbacks = useRef({ onToken, onError });
  callbacks.current = { onToken, onError };
  const [retry, setRetry] = useState(0), [loadError, setLoadError] = useState('');
  const siteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
  useImperativeHandle(ref, () => ({ reset() { callbacks.current.onToken(''); if (widget.current !== null) window.grecaptcha?.reset(widget.current); } }), []);
  useEffect(() => {
    if (!siteKey) { callbacks.current.onError('The form is not configured yet. Please email info@devoskisystems.com.'); return; }
    let cancelled = false;
    let host;
    setLoadError('');
    loadScript().then(api => {
      if (cancelled) return;
      // Google v2 has reset(), but no remove(). Give each mount a new host so
      // retries and React StrictMode never render twice into the same element.
      host = document.createElement('div');
      container.current.replaceChildren(host);
      widget.current = api.render(host, {
        sitekey: siteKey, theme: 'dark', size: container.current.clientWidth < 304 ? 'compact' : 'normal',
        callback: token => { if (!cancelled) callbacks.current.onToken(token); },
        'expired-callback': () => { if (!cancelled) { callbacks.current.onToken(''); callbacks.current.onError('Verification expired. Please verify again.'); } },
        'error-callback': () => { if (!cancelled) { callbacks.current.onToken(''); callbacks.current.onError('Verification failed. Please retry verification.'); } },
      });
    }).catch(error => { if (!cancelled) { setLoadError(error.message); callbacks.current.onError(error.message); } });
    return () => {
      cancelled = true;
      if (widget.current !== null) { try { window.grecaptcha?.reset(widget.current); } catch { /* Widget already detached. */ } widget.current = null; }
      host?.remove();
    };
  }, [siteKey, retry]);
  return <div className="verification"><div ref={container} />{siteKey && <button className="verification-retry" type="button" onClick={() => { onToken(''); setRetry(v => v + 1); }}>Retry verification</button>}{loadError && <p>{loadError}</p>}</div>;
});
