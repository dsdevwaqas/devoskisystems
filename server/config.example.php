<?php
declare(strict_types=1);

// Copy to config.php ONLY in /home/CPANEL_USER/devoski-private/.
// This example intentionally cannot send email until real credentials are set.
return [
    'allowed_origins' => ['https://devoskisystems.com', 'https://www.devoskisystems.com'],
    'allowed_hostnames' => ['devoskisystems.com', 'www.devoskisystems.com'],
    'recaptcha_secret' => '',
    // Generate once: php -r "echo bin2hex(random_bytes(32)), PHP_EOL;"
    'rate_key' => '',
    'storage_path' => __DIR__ . '/storage',
    'max_request_bytes' => 16384,
    'rate' => [
        'ip_attempts' => 8,
        'ip_window_seconds' => 600,
        'email_attempts' => 3,
        'email_window_seconds' => 3600,
        // Optional guard to match your actual hosting/mailbox sending allowance.
        // 0 means no global application cap. There is no monthly submission limit.
        'global_send_attempts_per_hour' => 0,
    ],
    // Never trust forwarded IP headers by default. Use REMOTE_ADDR.
    // If using Cloudflare proxy, see the trusted-proxy instructions in DEPLOYMENT.md.
    'trusted_proxy_cidrs' => [],
    'smtp' => [
        // Namecheap Private Email: mail.privateemail.com.
        // cPanel email: use the exact secure outgoing hostname shown in Connect Devices.
        'host' => 'mail.privateemail.com',
        'port' => 465,
        'encryption' => 'smtps', // 'smtps'/465 or 'tls'/587 (STARTTLS)
        'username' => 'info@devoskisystems.com',
        'password' => '',
        // From is always the authenticated username. Visitor becomes Reply-To.
        'from_name' => 'Devoski Systems Website',
        'recipient' => 'info@devoskisystems.com',
        'timeout_seconds' => 15,
    ],
];
