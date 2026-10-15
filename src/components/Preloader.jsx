import { useLayoutEffect, useRef } from 'react';
import gsap from 'gsap';

const storageKey = 'devoski:intro-seen';
export function needsIntro() {
  if (import.meta.env.DEV && new URLSearchParams(location.search).get('intro') === '1') return true;
  try { return sessionStorage.getItem(storageKey) !== '1'; } catch { return true; }
}

export default function Preloader({ onComplete }) {
  const root = useRef(null);
  const skip = useRef(null);
  useLayoutEffect(() => {
    const overlay = root.current;
    const number = overlay.querySelector('.preloader-number');
    const bar = overlay.querySelector('.preloader-bar-fill');
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    let alive = true, exiting = false, observer, limit;
    const timers = [];
    const progress = { value: 0 };
    const paint = () => { number.textContent = String(Math.round(progress.value)).padStart(2, '0'); bar.style.transform = `scaleX(${progress.value / 100})`; };
    const context = gsap.context(() => {
      if (!reduce) {
        gsap.from('.preloader-identity', { y: 16, opacity: 0, duration: 0.65, ease: 'power2.out' });
        gsap.to('.preloader-orbit', { rotation: 360, duration: 14, repeat: -1, ease: 'none' });
        gsap.to(progress, { value: 86, duration: 1.4, ease: 'power2.out', onUpdate: paint });
      }
    }, overlay);
    const exit = () => {
      if (!alive || exiting) return;
      exiting = true;
      clearTimeout(limit); observer?.disconnect();
      try { sessionStorage.setItem(storageKey, '1'); } catch { /* Intro still finishes without storage. */ }
      gsap.killTweensOf(progress);
      context.add(() => {
        const timeline = gsap.timeline({ onComplete: () => { if (alive) onComplete(); } });
        timeline.to(progress, { value: 100, duration: reduce ? 0 : 0.25, ease: 'power1.out', onUpdate: paint });
        timeline.to('.preloader-identity, .preloader-bottom, .preloader-skip', { opacity: 0, y: reduce ? 0 : -12, duration: reduce ? 0 : 0.3 }, '+=0.08');
        timeline.to(overlay, { clipPath: 'inset(0 0 100% 0)', duration: reduce ? 0 : 0.65, ease: 'power4.inOut' }, reduce ? '>' : '-=0.08');
      });
    };
    const start = performance.now();
    const pageReady = new Promise(resolve => {
      const check = () => { if (document.querySelector('#main .page-content, #main .page-hero')) { observer?.disconnect(); resolve(); } };
      observer = new MutationObserver(check);
      observer.observe(document.getElementById('main'), { childList: true, subtree: true });
      check();
    });
    Promise.all([pageReady, document.fonts.ready]).then(() => {
      if (alive && !exiting) timers.push(setTimeout(exit, Math.max(0, (reduce ? 0 : 1000) - (performance.now() - start))));
    });
    limit = setTimeout(exit, 4500);
    const escape = event => { if (event.key === 'Escape') exit(); };
    document.addEventListener('keydown', escape);
    skip.current.addEventListener('click', exit);
    const skipButton = skip.current;
    return () => {
      alive = false; observer?.disconnect(); clearTimeout(limit); timers.forEach(clearTimeout);
      document.removeEventListener('keydown', escape); skipButton.removeEventListener('click', exit);
      context.revert(); gsap.killTweensOf(progress);
      document.documentElement.style.overflow = previousOverflow;
    };
  }, [onComplete]);
  return <div className="site-preloader" ref={root} aria-label="Loading Devoski Systems">
    <div className="preloader-glow preloader-glow-gold" aria-hidden="true" /><div className="preloader-glow preloader-glow-indigo" aria-hidden="true" />
    <div className="preloader-identity">
      <div className="preloader-emblem"><span className="preloader-orbit" aria-hidden="true" /><div className="preloader-logo"><img src="/assets/logo.png" alt="Devoski Systems" width="280" height="50" /></div></div>
      <p className="preloader-tagline">IDEAS INTO EXPERIENCES</p>
      <p className="preloader-status" role="status">A little creativity is loading.</p>
    </div>
    <button ref={skip} type="button" className="preloader-skip">Skip intro <span aria-hidden="true">↗</span></button>
    <div className="preloader-bottom" aria-hidden="true"><div className="preloader-meta"><span>DESIGN. DEVELOP. DELIVER.</span><span><b className="preloader-number">00</b><i>%</i></span></div><div className="preloader-bar"><div className="preloader-bar-fill" /></div><span className="preloader-caption">DEVOSKI SYSTEMS / DIGITAL POSSIBILITIES</span></div>
  </div>;
}
