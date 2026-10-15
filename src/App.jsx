import { createElement, lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import pages from './data/routes.json';
import ContactForm from './components/ContactForm.jsx';
import Preloader, { needsIntro } from './components/Preloader.jsx';
import { initFluid } from './lib/fluid.js';
import { gsap, scrollPageTo, usePageMotion, useSiteMotion } from './lib/motion.js';

const nav = [['/', 'Home'], ['/about-us/', 'About'], ['/services/', 'Services'], ['/packages/', 'Packages'], ['/portfolio/', 'Portfolio'], ['/blog/', 'Journal'], ['/contact-us/', 'Contact']];
const names = { class: 'className', for: 'htmlFor', tabindex: 'tabIndex', autocomplete: 'autoComplete', readonly: 'readOnly', srcset: 'srcSet', fetchpriority: 'fetchPriority' };

// Content is trusted, local, structured data imported from the reviewed design.
// React creates each element; no raw HTML is injected at runtime.
function Content({ nodes }) {
  return nodes.map((node, i) => {
    if (typeof node === 'string') return node;
    if (node.tag === 'form') return <ContactForm key={i} quote={node.attrs['data-kind'] === 'Project quote'} />;
    const props = { key: i };
    for (const [key, value] of Object.entries(node.attrs)) {
      if (/^on/i.test(key) || key === 'style') continue;
      props[names[key] || key] = value;
    }
    const internal = node.tag === 'a' && /^\/(?!\/)/.test(props.href || '');
    if (internal) { props.to = props.href; delete props.href; }
    let children = node.children.length ? <Content nodes={node.children} /> : undefined;
    if (node.tag === 'h1') {
      const lines = [[]];
      node.children.forEach(child => { if (child?.tag === 'br') lines.push([]); else lines.at(-1).push(child); });
      children = lines.map((line, index) => <span className="heading-line" key={index}><span className="heading-line-inner"><Content nodes={line} /></span></span>);
    }
    return createElement(internal ? Link : node.tag, props, children);
  });
}

function PageContent({ nodes }) {
  const { hash } = useLocation();
  const root = useRef(null);
  usePageMotion(root, nodes);
  useEffect(() => {
    if (!hash) return;
    let id;
    try { id = decodeURIComponent(hash.slice(1)); } catch { return; }
    const followAnchor = () => { const target = document.getElementById(id); if (target && !document.querySelector('.site-preloader')) scrollPageTo(target); };
    followAnchor();
    window.addEventListener('devoski:intro-complete', followAnchor);
    return () => window.removeEventListener('devoski:intro-complete', followAnchor);
  }, [hash, nodes]);
  return <div className="page-content" ref={root}><Content nodes={nodes} /></div>;
}

const loaders = import.meta.glob('./data/content/*.json', { import: 'default' });
const pageComponents = Object.fromEntries(Object.entries(pages).map(([route, page]) => [route, lazy(async () => {
  const nodes = await loaders[`./data/content/${page.key}.json`]();
  return { default: () => <PageContent nodes={nodes} /> };
})]));

function FluidBackground() {
  const ref = useRef(null);
  const { pathname } = useLocation();
  useEffect(() => initFluid(ref.current), []);
  useEffect(() => {
    const burst = strength => {
      const api = window.studioFluid;
      if (document.hidden || !api || api.paused || matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
      api.burst(strength);
      return true;
    };
    const isMobile = () => matchMedia('(max-width: 900px)').matches;
    const arrive = () => {
      if (isMobile()) burst(0.65);
    };
    // Automatic arrival and ambient bursts are mobile-only.
    const arrival = setTimeout(() => { if (!document.querySelector('.site-preloader')) arrive(); }, 200);
    const introArrival = arrive;
    window.addEventListener('devoski:intro-complete', introArrival);
    const ambient = setInterval(() => { if (isMobile()) burst(0.35); }, 5000);
    return () => { clearTimeout(arrival); clearInterval(ambient); window.removeEventListener('devoski:intro-complete', introArrival); };
  }, [pathname]);
  return <canvas id="site-fluid" ref={ref} aria-hidden="true" />;
}

function MotionControl() {
  const [paused, setPaused] = useState(false);
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => { setAvailable(Boolean(window.studioFluid) && !media.matches); setPaused(Boolean(window.studioFluid?.paused)); };
    sync(); media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);
  return <button className="motion-toggle" disabled={!available} aria-pressed={paused} onClick={() => { window.studioFluid?.setPaused(!paused); setPaused(!paused); }}>{available ? paused ? 'Resume effect' : 'Pause effect' : 'Static background'}</button>;
}

function Header() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    if (!open) return;
    const media = gsap.matchMedia();
    media.add('(max-width: 900px) and (prefers-reduced-motion: no-preference)', () => {
      gsap.from('#navigation > a', { y: 10, opacity: 0, duration: 0.3, stagger: 0.035, clearProps: 'transform,opacity' });
    });
    return () => media.revert();
  }, [open]);
  useEffect(() => { const escape = e => { if (e.key === 'Escape') setOpen(false); }; document.addEventListener('keydown', escape); return () => document.removeEventListener('keydown', escape); }, []);
  return <><a className="skip" href="#main">Skip to content</a><header className="site-header">
    <Link className="brand" to="/" aria-label="Devoski Systems home"><img src="/assets/logo.png" alt="Devoski Systems" width="200" height="36" /></Link>
    <button className="menu-toggle" aria-expanded={open} aria-controls="navigation" aria-label="Toggle navigation" onClick={() => setOpen(!open)}>Menu <span>☰</span></button>
    <nav id="navigation" className={open ? 'is-open' : ''} aria-label="Main navigation">{nav.map(([to, label]) => <NavLink to={to} end key={to}>{label}</NavLink>)}</nav>
    <a href="tel:+923352110200" className="button header-cta">Let’s talk <span>↗</span></a>
  </header></>;
}

function Footer() {
  return <footer className="site-footer"><div className="footer-top"><div><Link className="brand" to="/"><img src="/assets/logo.png" alt="Devoski Systems" width="200" height="36" /></Link><p>Your ideas. Our expertise.<br />Extraordinary digital possibilities.</p><div className="socials"><a href="https://www.facebook.com/devoski.systems">Facebook ↗</a><a href="https://www.instagram.com/devoski.systems/">Instagram ↗</a><a href="https://www.linkedin.com/company/devoskisystems">LinkedIn ↗</a></div></div><div><h3>Explore</h3>{nav.slice(1).map(([to, label]) => <Link to={to} key={to}>{label}</Link>)}</div><div><h3>What we do</h3>{['design', 'develop', 'promote', 'support'].map(v => <Link key={v} to={'/services/#we-' + v}>We {v}</Link>)}</div><div><h3>Have something in mind?</h3><a className="footer-email" href="mailto:info@devoskisystems.com">info@devoskisystems.com ↗</a><a href="tel:+923352110200">+92 335 211 0200</a><a href="https://maps.app.goo.gl/e4HGgtS65QnP8JnB8">B8, Blk B, Gulshan e Jamal<br />Karachi, Pakistan 75260</a></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} Devoski Systems.</span><div><Link to="/privacy-policy/">Privacy Policy</Link><Link to="/terms-conditions/">Terms &amp; Conditions</Link><MotionControl /></div></div></footer>;
}

export default function App() {
  const [intro, setIntro] = useState(needsIntro);
  const finishIntro = useCallback(() => {
    setIntro(false);
    requestAnimationFrame(() => { window.dispatchEvent(new Event('resize')); window.dispatchEvent(new Event('devoski:intro-complete')); });
  }, []);
  useSiteMotion();
  const { pathname, hash } = useLocation();
  const route = pathname === '/index.html' ? '/' : '/' + pathname.replace(/^\/+|\/+$/g, '').replace(/\.html$/, '') + '/';
  const page = pages[pathname === '/' ? '/' : route];
  const Page = pageComponents[pathname === '/' ? '/' : route];
  useEffect(() => {
    document.title = page ? `${page.title} | Devoski Systems` : 'Page not found | Devoski Systems';
    document.querySelector('meta[name="description"]').content = page?.description || 'Devoski Systems';
    let canonical = document.querySelector('link[rel="canonical"]');
    if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.append(canonical); }
    canonical.href = 'https://devoskisystems.com' + (pathname === '/' ? '/' : route);
    if (!hash) scrollPageTo(0, { immediate: true });
  }, [pathname, hash, page, route]);
  return <>{intro && <Preloader onComplete={finishIntro} />}<div className="site-shell" inert={intro} aria-busy={intro}><div className="reading-progress" aria-hidden="true" /><FluidBackground /><Header /><main id="main" key={pathname}>{Page ? <Suspense fallback={<section className="section" role="status">Loading page…</section>}><Page /></Suspense> : <section className="section page-hero"><span className="eyebrow">404</span><h1>Page not found.</h1><Link to="/" className="button">Back to home ↗</Link></section>}</main><Footer /></div></>;
}
