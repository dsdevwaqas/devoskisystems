# GitHub to Namecheap over SSH

Source repository: https://github.com/dsdevwaqas/devoskisystems

The repository is public. The actual SMTP password/reCAPTCHA secret, `.env.local`, private config, dependency directories, runtime storage, original snapshots and deployment ZIPs are excluded. Keep them excluded. Never commit the private backend ZIP or actual `server/config.php`.

`Build and test` checks pushes and pull requests. `Deploy to Namecheap` is prepared but skips automatic deployment until `NAMECHEAP_DEPLOY_ENABLED=true` is configured. It can also be run manually from Actions after configuration. No workflow uses production credentials on pull requests.

## One-time setup

1. Keep the existing `/home/CPANEL_USER/devoski-private/config.php` on hosting. It already contains the private email/CAPTCHA values. Do not copy those to GitHub.
2. In cPanel → SSH Access → Manage SSH Keys, authorize the deployment public key. Use a dedicated SSH deployment key. Its private key belongs in GitHub Actions Secrets, not in the repository or a chat message. GitHub needs a noninteractive key; use the corresponding unencrypted private key for this dedicated automation identity and protect access to the secret.
3. Confirm the host, cPanel login and port. Namecheap shared hosting normally uses port **21098**; use the port actually supplied for the account. A key name such as `devoskiproduction` is not the SSH port or necessarily the login username.
4. Obtain the SSH server's known-hosts entry and verify its fingerprint with the hosting provider/trusted admin before saving it. Do not disable host-key verification. A collection command is `ssh-keyscan -p 21098 YOUR_HOST`; verify the result using `ssh-keygen -lf HOSTS_FILE` against a trusted fingerprint. The workflow never blindly trusts a scan.
5. In the GitHub repository, open **Settings → Secrets and variables → Actions**. Add the entries below. Environment secrets under an optional `production` environment can also be used. For a public repository, protect who can push to `main` and optionally require approval for the `production` environment.

### Repository variables

| Variable | Value |
| --- | --- |
| `VITE_RECAPTCHA_SITE_KEY` | Your public Google reCAPTCHA v2 site key (same as local `.env.local`) |
| `NAMECHEAP_DEPLOY_ENABLED` | Leave unset initially; set to `true` after a successful manual deployment |

### Actions secrets

| Secret | Value |
| --- | --- |
| `NAMECHEAP_SSH_HOST` | Hosting server IP/hostname |
| `NAMECHEAP_SSH_USER` | cPanel/SSH login username |
| `NAMECHEAP_SSH_PORT` | Actual SSH port, normally `21098` on shared hosting |
| `NAMECHEAP_SSH_PRIVATE_KEY` | Complete deployment private SSH key with BEGIN/END lines |
| `NAMECHEAP_SSH_KNOWN_HOSTS` | Verified known_hosts line(s), including `[host]:port` for a nonstandard port |
| `NAMECHEAP_PUBLIC_WEB_ROOT` | `/home/CPANEL_USER/public_html` or the domain's actual document root |
| `NAMECHEAP_PRIVATE_BACKEND_ROOT` | `/home/CPANEL_USER/devoski-private`, outside the public root |

Do not put the mailbox password or Google CAPTCHA secret in a Vite/GitHub variable. They remain in the private server config. A repository/environment owner must enter the SSH private key through GitHub's secret settings.

## First deployment

1. Confirm PHP 8.2+ is selected for the domain and the existing form's private config/storage are in place.
2. Open **Actions → Deploy to Namecheap → Run workflow → main**.
3. The workflow installs locked Node/PHP dependencies, builds static assets, runs checks and deploys over strictly verified SSH.
4. It uploads PHP classes/Composer dependencies to the private backend, preserving `config.php` and `storage/`.
5. It uploads frontend assets, then `index.html` last. It does not delete remote files. Existing `.htaccess` and `.user.ini` are preserved to protect cPanel PHP/HTTPS settings; missing ones are installed on first deployment. Apply later changes to these hosting files manually after reviewing host directives.
6. Check the website and submit a real contact enquiry with CAPTCHA. Confirm inbox receipt/Reply-To before enabling automatic deploys.
7. Set `NAMECHEAP_DEPLOY_ENABLED=true`. Subsequent pushes to `main` trigger deployment automatically.

The workflow needs `rsync` on hosting. If unavailable in the account's jailed shell, ask Namecheap to enable it before using this workflow. It does not copy the Git repository or private deployment archives into the web root.

For rollback, revert the source commit and push again. Older hashed assets remain available for cached pages; schedule asset cleanup separately once old builds are no longer needed. Back up production files/config before the first automated deployment.

Provider references: [Namecheap SSH access](https://www.namecheap.com/support/knowledgebase/article.aspx/1016/89/how-to-access-a-hosting-account-via-ssh/), [SSH keys](https://www.namecheap.com/support/knowledgebase/article.aspx/9428/89/how-to-connect-via-ssh-using-keys/).
