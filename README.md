# Devoski Systems — React website

React/Vite website for **devoskisystems.com**, preserving all 53 pages, the reviewed design, original local images and the gold/indigo WebGL pointer effect. Navigation, page content, contact and quote forms are rendered by React.

```bash
npm ci
# Copy .env.example to .env.local and add the PUBLIC reCAPTCHA v2 site key.
npm run dev
composer install --working-dir=server --no-dev --optimize-autoloader
npm run build
npm run check
npm test
php tests/backend.php
```

Follow **[DEPLOYMENT.md](DEPLOYMENT.md)** for complete Namecheap deployment, file structure, private PHP configuration, SMTP, Google reCAPTCHA v2, dependencies and testing instructions.

For GitHub Actions deployment over SSH, follow **[GITHUB-DEPLOYMENT.md](GITHUB-DEPLOYMENT.md)**. Automatic production deployment stays disabled until the owner configures the required Actions secrets and enables it.

The PHP backend uses PHPMailer authenticated SMTP, server-side reCAPTCHA v2 Siteverify, validation, honeypot, request limits, SQLite rate limiting and duplicate protection. Production needs PHP 8.2+ and the documented extensions; Node.js is needed only for development/building. No paid form service or monthly submission quota is used.

Upload `dist/` contents to the web root and `server/` contents to a separate private home directory. The supplied reCAPTCHA v2 keys are saved in ignored local configuration; the secret stays in server/config.php, outside the public build. SMTP credentials still need configuring privately before live delivery can work. No live site has been changed or deployed.

Edit layout in `src/App.jsx`, forms in `src/components/`, styling in `src/site.css`, and content in `src/data/pages.json`. Build splits content into lazy-loaded page chunks. `server/config.example.php` is the private configuration template. Automated checks are in `tests/`.

Typography uses self-hosted Space Grotesk headings and Manrope body text in `src/typography.css`. `src/lib/motion.js` coordinates GSAP/ScrollTrigger reveals, hero entrances, image parallax and Locomotive Scroll v5 desktop smoothing on one shared ticker. Mobile touch scrolling stays native. Animations and smoothing respect reduced-motion settings and clean up across React route changes. Styling for motion is in `src/motion.css`; font licenses ship under `public/licenses/`.

The header's Let's talk button calls +92 335 211 0200. Desktop automatic fluid bursts are disabled; pointer interaction remains active. Mobile (up to 900px) keeps arrival/navigation bursts and ambient bursts every five seconds. Paused, hidden-tab, lost-context and reduced-motion states suppress bursts. Timing is controlled in `FluidBackground` in `src/App.jsx`.

The branded first-visit preloader in `src/components/Preloader.jsx` appears once per browser tab session (sessionStorage key `devoski:intro-seen`). It waits for initial page content/fonts, has a short maximum wait and a Skip intro button, and respects reduced motion. It does not repeat on route changes or reloads in the same session. Clear that sessionStorage key or use a fresh tab session to preview it again.

During local development, `/?intro=1` previews the intro even if the session has already seen it. This override is disabled in the production build. On mobile, a fresh fluid burst plays when the intro reveals the page.

Earlier static HTML is preserved locally in ignored `legacy-static/`; original WordPress snapshots remain in `.source/`. Those and the historical static import/build scripts are migration references, not production assets. Do not re-run the one-time migration over the React project.

Packages remains coming soon. Final business Terms and a privacy notice aligned with the deployed contact system still need supplying.

The fluid effect is adapted from Pavel Dobryakov's MIT-licensed WebGL Fluid Simulation. Preserve `LICENSE.txt`. Composer includes PHPMailer's upstream license.
