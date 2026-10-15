# Devoski Systems: React + PHP on Namecheap

Production domain: **https://devoskisystems.com**. React builds to static files. PHP handles `/api/contact.php` on the same hosting account; no Node.js process is needed in production. No paid form-submission service or monthly submission quota is used.

## Files and prerequisites

```text
project/
  src/App.jsx                     shared React layout and routes
  src/data/pages.json             editable content for all 53 pages
  src/components/ContactForm.jsx  contact and quote forms
  src/components/Recaptcha.jsx    widget lifecycle
  src/lib/contact.js              frontend validation
  src/lib/fluid.js                existing gold/indigo pointer effect
  public/assets/                  logo and original images
  public/api/contact.php          public PHP entry point
  public/api/.htaccess            request-size and access restrictions
  public/.htaccess                React deep-link routing
  public/.user.ini                PHP request/error settings
  server/                        PRIVATE backend
    composer.json, composer.lock
    vendor/                      Composer dependencies
    bootstrap.php
    config.example.php
    config.php                   create privately; ignored by Git
    src/                         PHP application classes
    storage/                     writable SQLite state
  tests/                         never deploy
  dist/                          generated public build
```

Local build: Node 22.12+ or current Node 24 LTS, npm, PHP 8.2+ and Composer 2. Hosting: supported PHP 8.3/8.4 with `curl`, `mbstring`, `openssl`, `PDO`, `pdo_sqlite`, and standard JSON/filter support. SQLite requires no database server. In cPanel select PHP and enable extensions using [Namecheap's PHP selector](https://www.namecheap.com/support/knowledgebase/article.aspx/9417/2219/how-to-change-php-version-and-update-php-extensions-on-shared-servers/).

## Install and build

```bash
npm ci
composer install --working-dir=server --no-dev --optimize-autoloader
cp .env.example .env.local
```

Only the PUBLIC widget site key belongs in `.env.local`:

```dotenv
VITE_RECAPTCHA_SITE_KEY=YOUR_PUBLIC_SITE_KEY
```

```bash
npm run build
npm run check
npm test
php tests/backend.php
```

Keep both dependency lockfiles in Git. Actual `server/config.php`, `server/vendor/`, environment files, SQLite state, test results and `dist/` are ignored. Every Vite `VITE_*` value is public: never create a frontend variable for an SMTP password or reCAPTCHA v2 secret. The ignored `.tools/` contains local verification tools for this workspace only; do not deploy it.

If cPanel lacks Composer, run Composer locally with compatible PHP and upload the resulting `vendor/` with the other private backend files. Production needs neither Composer nor npm running.

## Private configuration and hosting layout

```text
/home/CPANEL_USER/
  devoski-private/                 CONTENTS of server/
    bootstrap.php
    config.php
    config.example.php
    composer.json
    composer.lock
    vendor/
    src/
    storage/
  public_html/                     CONTENTS of dist/
    index.html
    assets/
    api/contact.php
    api/.htaccess
    .htaccess
    .user.ini
    LICENSE.txt
```

Create `config.php` by copying the example in the PRIVATE directory. Fill the SMTP credentials, recipient, reCAPTCHA v2 secret and random `rate_key`. Keep `storage/` writable by the account's PHP process and persistent across deployments. The backend refuses config/storage inside the public document root. Its private `.htaccess` is only a backup restriction.

Generate `rate_key` once:

```bash
php -r "echo bin2hex(random_bytes(32)), PHP_EOL;"
```

Owner-only `700` private directories and `600` config/database files work where PHP runs as the hosting account owner. Adjust for the actual PHP handler if necessary; do not use `777`. Public files can use normal hosting permissions.

The endpoint defaults to `/home/CPANEL_USER/devoski-private` for `/home/CPANEL_USER/public_html/api/contact.php`. For an addon domain, use an absolute private path through `DEVOSKI_PRIVATE_DIR`, or change only the path in the deployed endpoint:

```apache
# Optional, only if your PHP handler receives SetEnv:
SetEnv DEVOSKI_PRIVATE_DIR /home/CPANEL_USER/devoski-private
```

No secrets belong in `.htaccess`. If `SetEnv` is unavailable, use the absolute directory path in PHP. If `open_basedir` blocks home-directory access, ask Namecheap to permit a private directory rather than placing secrets in public files. Never upload the whole repository into the web root.

## Namecheap authenticated SMTP

Confirm that the real mailbox, for example `info@devoskisystems.com`, works in webmail. Identify your email product:

| Product | SMTP host | Encryption and port | Username |
| --- | --- | --- | --- |
| Namecheap Private Email | `mail.privateemail.com` | `smtps` / 465 or `tls` / 587 | Full mailbox address |
| cPanel hosting email | Exact secure outgoing hostname shown in **Email Accounts → Connect Devices**, or the hosting welcome email | `smtps` / 465 or `tls` / 587 | Full mailbox address |

Do not guess a cPanel hostname from the website domain: it must match the server certificate. See [Private Email settings](https://www.namecheap.com/support/knowledgebase/article.aspx/1179/2175/general-private-email-configuration-for-mail-clients-and-mobile-devices/) and [cPanel mailbox settings](https://www.namecheap.com/support/knowledgebase/article.aspx/9142/2186/general-configuration-for-mail-clients-and-mobile-devices/).

Fill these entries in private `config.php` while retaining the other example settings:

```php
'recaptcha_secret' => 'YOUR_PRIVATE_RECAPTCHA_SECRET',
'rate_key' => 'YOUR_RANDOM_64_CHARACTER_HEX_VALUE',
'smtp' => [
    'host' => 'mail.privateemail.com', // replace for cPanel email
    'port' => 465,
    'encryption' => 'smtps',
    'username' => 'info@devoskisystems.com',
    'password' => 'YOUR_MAILBOX_OR_APPLICATION_PASSWORD',
    'from_name' => 'Devoski Systems Website',
    'recipient' => 'info@devoskisystems.com', // your configured recipient
    'timeout_seconds' => 15,
],
```

Use the password type required by the mailbox, including an application password where required. The From address is always the authenticated username. The visitor's validated email/name is Reply-To. The recipient and subject are controlled by PHP. Messages are plain text, with no attachments or automatic visitor emails. TLS peer/hostname verification stays enabled; fix the hostname/certificate instead of disabling verification.

Apply the exact MX/SPF/DKIM records supplied for your email product and review DMARC. Do not invent records or mix unrelated email providers' MX/SPF configuration. Confirm your plan's current sending allowance with [Namecheap's sending policy](https://www.namecheap.com/support/knowledgebase/article.aspx/133/31/do-you-have-any-restrictions-on-sending-out-emails/).

## Google reCAPTCHA v2

1. Open the Google reCAPTCHA Admin Console and register a **reCAPTCHA v2 - "I am not a robot" Checkbox** site, not v3 or Enterprise.
2. Allow devoskisystems.com and www.devoskisystems.com. Add localhost/127.0.0.1 only to a separate development registration when needed. Keep domain validation enabled.
3. The supplied public site key is saved locally in ignored .env.local as VITE_RECAPTCHA_SITE_KEY; rebuild after changing it.
4. The supplied secret is saved only in ignored server/config.php. Upload it to the PRIVATE backend directory, never public_html. SMTP credentials still need filling in that private file.
5. Retain matching allowed_origins and allowed_hostnames in PHP config. Origins include https://; hostnames do not.

PHP sends each new response token to Google's Siteverify endpoint and requires success plus an allowed hostname. Google enforces single-use response tokens and their two-minute validity. V2 does not return a v3 action/score. Its challenge_ts is challenge-load time, so PHP does not treat that timestamp as the token-creation time. React resets verification after attempts and handles expiry/errors. See [Google server verification](https://developers.google.com/recaptcha/docs/verify) and [v2 explicit rendering](https://developers.google.com/recaptcha/docs/display).

If adding a Content Security Policy, follow [Google's CSP instructions](https://developers.google.com/recaptcha/docs/faq#im-using-content-security-policy-csp-on-my-website-how-can-i-configure-it-to-work-with-recaptcha): permit the documented Google/reCAPTCHA script, frame and connection sources, including gstatic where required. No DNS move is needed and there is no production CAPTCHA bypass setting.

## Protection and limits

- Only POST JSON from explicitly configured Origins is accepted. Invalid methods receive 405; no permissive CORS is enabled.
- The hard webserver/read ceiling is 64 KiB; the application defaults to 16 KiB. Fields have independent type/length/email/URL/enum/control-character checks. Message length is 10–5000 characters subject to the total byte ceiling. Unknown fields are rejected.
- PHP checks the honeypot and CAPTCHA, not just React. Failed/unavailable verification never sends mail.
- Defaults: 8 attempts per IP per 10 minutes, 3 verified email attempts per address per hour. These are configurable short-window anti-spam limits, not a monthly quota. There is **no 250-submission limit**.
- The optional global sending guard defaults to `0` (disabled). If enabled, set it below your actual provider allowance, reserving capacity for other mail. Provider sending limits still apply.
- SQLite transactions coordinate concurrent PHP workers. Stored data consists of keyed hashes, counters, random request IDs and delivery states. The database does not store messages, raw email addresses/IPs, CAPTCHA tokens or passwords. Expired rate buckets and submissions older than 24 hours are pruned during requests.
- A completed request ID is acknowledged without resending. Changed data with that ID is rejected. If SMTP times out, mail may already have been accepted: the UI reports uncertainty, locks resubmission and directs the visitor to contact the team. Check delivery before creating a new enquiry. SMTP cannot guarantee exactly-once inbox delivery across failures.
- PHP logs only generic operational categories and a reference, not raw SMTP diagnostics or credentials. Responses do not expose stack traces or private config.

The default client IP is `REMOTE_ADDR`; spoofable forwarded headers are ignored. Behind Cloudflare proxy, have the host restore client IPs or set `trusted_proxy_cidrs` to the **current official ranges** from https://www.cloudflare.com/ips/ and restrict direct origin ingress appropriately. Only explicitly trusted direct proxies may supply `CF-Connecting-IP`. Never trust all IP ranges or arbitrary forwarded headers. Test that real visitors do not all share one proxy bucket.

## Deploy

1. Back up the existing site's files and `.htaccess`.
2. Configure valid HTTPS for apex and `www`, using cPanel's supported HTTPS redirect option. Website HTTPS and SMTP TLS are separate settings.
3. Upload the **contents of `dist/`** into the domain's document root, including hidden `.htaccess` and `.user.ini`. Enable Show Hidden Files in File Manager.
4. Upload `server/` contents to the private sibling directory, including `vendor/`, config and writable storage.
5. Keep only public build files in the document root. Leftover WordPress `index.php` or old `.html` files must not override React. Merge required host-managed PHP directives when replacing WordPress rewrite rules with this project's routing rules.
6. Directly open/refresh `/`, `/services/`, `/contact-us/`, `/get-a-quote/`, `/web-design/` and `/web-design.html`. The rewrite rules preserve `/api/` rather than sending it to React.

Public site-key changes need a React rebuild. SMTP credentials, recipient, secret and rate-setting changes need only a private config update.

## Local testing

```bash
npm run build
npm run check
npm test
php tests/backend.php
npm run test:browser
```

The browser suite uses installed Edge on this Windows workspace. On another OS set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to an installed Chromium/Chrome/Edge binary. Tests use isolated widget and mail doubles, never included in `dist/`.

Use two terminals for local development. Create ignored `server/config.php` with local credentials and explicit local origins such as `http://localhost:5173` and `http://127.0.0.1:5173`. Configure a separate local reCAPTCHA v2 registration, or use Google's documented v2 testing key pair only in isolated development. Never deploy testing keys. Keep hostname checking enabled and configure only the explicit testing hostname for local tests. Browser automation uses a test-only widget double and never solves a real CAPTCHA.

```bash
# Terminal 1, macOS/Linux:
DEVOSKI_PRIVATE_DIR="/absolute/project/server" php -S 127.0.0.1:8080 -t public scripts/php-router.php
# Terminal 2:
npm run dev
```

PowerShell equivalent for terminal 1:

```powershell
$env:DEVOSKI_PRIVATE_DIR = (Resolve-Path server).Path
php -S 127.0.0.1:8080 -t public scripts/php-router.php
```

Vite proxies `/api/` to PHP on 8080. `npm run preview` previews static assets only and does not execute PHP. To test the actual production build locally, use `-t dist` instead of `-t public` and add `http://127.0.0.1:8080` to local allowed origins. PHP's built-in server is only for local tests.

## Production checks

1. GET `/api/contact.php` returns JSON 405, not HTML, a download or a stack trace.
2. Malformed JSON, bad email/URL, missing fields, nonempty honeypot, missing/expired CAPTCHA or cross-site Origin fails without sending mail. Large bodies fail with 413 (Apache may produce its own response for the hard ceiling).
3. Send a real contact and quote through the live widget. Check loading/disabled state, success, receipt in inbox/spam, correct From and Reply-To, and the actual reply address.
4. Test double-click/retry behavior and temporary low rate settings in staging; confirm 429/Retry-After and restore normal rates.
5. In staging test invalid SMTP credentials: expect a safe error, never false success. Restore credentials and check mailbox/host delivery logs before resending uncertain mail.
6. Fetching `/config.php`, `/server/config.php`, `/devoski-private/config.php` or storage paths must never expose the real private files. Search browser-loaded JS/network responses for actual secrets.
7. Update the inherited privacy notice for real contact data handling, Namecheap email and Google reCAPTCHA v2. Replace the original Terms contact prompt with final business wording.

| Problem | Check |
| --- | --- |
| Widget/form unavailable | Public key, allowed widget hostname, script/frame blocking, connection |
| 503 | Private path/config/vendor, PHP extensions, storage permissions, PHP error log |
| 422 verification error | Matching site/secret pair, hostname, token expiry; verify again |
| 403 | Exact browser Origin including protocol and `www` |
| 429 | Retry-After, limits, proxy IP handling |
| 502 / delivery unknown | SMTP hostname/port/auth/certificate, mailbox/provider logs before retrying |
| PHP source displayed/downloaded | Fix the cPanel PHP handler before enabling the form |
| Deep-route 404 | Missing hidden .htaccess, old files/WordPress rules or disabled rewrites |
| SMTP accepted but no inbox mail | Recipient/spam, provider logs, SPF/DKIM/DMARC and provider limits |

Automated local checks do not verify real SMTP credentials, the actual Google reCAPTCHA v2 widget or Namecheap runtime. Final live delivery testing requires those private values configured on hosting.
