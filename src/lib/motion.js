import { useEffect, useLayoutEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import LocomotiveScroll from 'locomotive-scroll';

gsap.registerPlugin(ScrollTrigger);

let smoothScroll = null;
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

export function scrollPageTo(target, { immediate = false } = {}) {
  const offset = typeof target === 'number' ? 0 : -(parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0);
  if (smoothScroll) {
    smoothScroll.lenisInstance?.resize();
    smoothScroll.scrollTo(target, { immediate: immediate || reducedMotion(), offset, duration: 0.85, force: true });
  }
  else if (typeof target === 'number') window.scrollTo({ top: target, behavior: immediate || reducedMotion() ? 'instant' : 'smooth' });
  else target?.scrollIntoView({ behavior: immediate || reducedMotion() ? 'instant' : 'smooth', block: 'start' });
}

export function useSiteMotion() {
  useEffect(() => {
    const media = gsap.matchMedia();
    media.add('(min-width: 901px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)', () => {
      let instance;
      // Defer construction so StrictMode can cancel its first setup before
      // Locomotive's own asynchronous initialization starts.
      const frame = requestAnimationFrame(() => {
        instance = new LocomotiveScroll({
          lenisOptions: {
            lerp: 0.085, smoothWheel: true, syncTouch: false, autoRaf: false,
            prevent: node => Boolean(node.closest('input, textarea, select, [data-native-scroll]')),
          },
          scrollCallback: () => ScrollTrigger.update(),
          initCustomTicker: render => gsap.ticker.add(render),
          destroyCustomTicker: render => gsap.ticker.remove(render),
        });
        smoothScroll = instance;
        document.documentElement.dataset.smoothScroll = 'locomotive';
      });
      return () => {
        cancelAnimationFrame(frame);
        if (smoothScroll === instance) smoothScroll = null;
        instance?.destroy();
        delete document.documentElement.dataset.smoothScroll;
      };
    });
    media.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.from('.site-header .brand, .site-header nav > a, .site-header .header-cta', {
        y: -10, opacity: 0, duration: 0.55, stagger: 0.045, ease: 'power2.out', clearProps: 'transform,opacity',
      });
      gsap.fromTo('.reading-progress', { scaleX: 0 }, { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: 0.2 } });
    });
    return () => media.revert();
  }, []);
}

export function usePageMotion(ref, dependency) {
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const media = gsap.matchMedia();
    let refreshFrame = 0;
    const refresh = () => {
      cancelAnimationFrame(refreshFrame);
      refreshFrame = requestAnimationFrame(() => { smoothScroll?.resize(); ScrollTrigger.refresh(); });
    };
    media.add('(prefers-reduced-motion: no-preference)', () => {
      let revealHero;
      const hero = root.querySelector('.home-hero, .page-hero');
      if (hero) {
        const timeline = gsap.timeline({ paused: Boolean(document.querySelector('.site-preloader')), defaults: { ease: 'power3.out' } });
        revealHero = () => timeline.play(0);
        window.addEventListener('devoski:intro-complete', revealHero, { once: true });
        const entrance = (selector, options, position) => {
          const targets = [...hero.querySelectorAll(selector)];
          if (targets.length) timeline.from(targets, options, position);
        };
        entrance('.breadcrumb, .eyebrow', { y: 12, autoAlpha: 0, duration: 0.5, stagger: 0.07 }, 0);
        entrance('.heading-line-inner', { yPercent: 105, duration: 0.95, stagger: 0.11, clearProps: 'transform' }, 0.08);
        entrance('.hero-copy > p, .page-hero > div > p, .hero-actions, .hero-note, .page-hero .button', { y: 18, autoAlpha: 0, duration: 0.65, stagger: 0.08, clearProps: 'transform,opacity,visibility' }, 0.36);
        entrance('.hero-art', { y: 28, autoAlpha: 0, duration: 1, clearProps: 'transform,opacity,visibility' }, 0.2);
      }
      const reveal = (targets, trigger, stagger = 0) => {
        if (!targets.length) return;
        gsap.from(targets, {
          y: 28, autoAlpha: 0, duration: 0.75, stagger, ease: 'power3.out',
          clearProps: 'transform,opacity,visibility',
          scrollTrigger: { trigger, start: 'top 93%', once: true },
        });
      };
      root.querySelectorAll('.section-heading, .about-preview > div, .contact-layout > aside, .about-purpose, .cta > div, .article-content > h2').forEach(el => reveal([el], el));
      root.querySelectorAll('.card-grid, .portfolio-grid, .values-grid, .testimonials-grid, .service-links').forEach(group => reveal([...group.children], group, 0.075));
      // Forms move gently without fading or obscuring their controls/validation.
      root.querySelectorAll('.enquiry-form').forEach(form => gsap.from(form, { y: 18, duration: 0.65, clearProps: 'transform', scrollTrigger: { trigger: form, start: 'top 95%', once: true } }));
      return () => { if (revealHero) window.removeEventListener('devoski:intro-complete', revealHero); };
    }, root);
    media.add('(min-width: 901px) and (hover: hover) and (prefers-reduced-motion: no-preference)', () => {
      root.querySelectorAll('.hero-art > img, .about-visual > img').forEach(image => {
        gsap.fromTo(image, { yPercent: -2 }, { yPercent: 5, ease: 'none', scrollTrigger: { trigger: image.parentElement, start: 'top bottom', end: 'bottom top', scrub: 1 } });
      });
    }, root);
    // Lazy images, responsive reflow and variable-font loading can all move triggers.
    const observer = new ResizeObserver(refresh);
    observer.observe(root);
    const images = [...root.querySelectorAll('img')];
    images.forEach(image => image.addEventListener('load', refresh));
    let active = true;
    document.fonts.ready.then(() => { if (active) refresh(); });
    refresh();
    return () => {
      active = false; observer.disconnect(); images.forEach(image => image.removeEventListener('load', refresh));
      cancelAnimationFrame(refreshFrame); media.revert();
    };
  }, [ref, dependency]);
}

export { gsap };
