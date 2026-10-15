<?php
// CLI-only authentication test. Does not send an email or print credentials.
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require __DIR__ . '/../server/vendor/autoload.php';
$config = require __DIR__ . '/../server/config.php';
$smtp = new PHPMailer\PHPMailer\SMTP();
$smtp->do_debug = 0;
$smtp->Timeout = 15;
$smtp->Timelimit = 15;
try {
    $settings = $config['smtp'];
    $host = ($settings['encryption'] === 'smtps' ? 'ssl://' : '') . $settings['host'];
    if (!$smtp->connect($host, $settings['port'], 15)) throw new RuntimeException('connection_failed');
    if (!$smtp->hello('devoskisystems.com')) throw new RuntimeException('handshake_failed');
    if ($settings['encryption'] === 'tls') {
        if (!$smtp->startTLS() || !$smtp->hello('devoskisystems.com')) throw new RuntimeException('tls_failed');
    }
    if (!$smtp->authenticate($settings['username'], $settings['password'])) throw new RuntimeException('authentication_failed');
    echo "PASS: encrypted SMTP connection and authentication. No email sent.\n";
} catch (Throwable $error) {
    $safe = in_array($error->getMessage(), ['connection_failed', 'handshake_failed', 'tls_failed', 'authentication_failed'], true) ? $error->getMessage() : 'smtp_test_failed';
    fwrite(STDERR, "FAIL: $safe. Credentials were not printed.\n");
    exit(1);
} finally {
    if ($smtp->connected()) $smtp->quit();
    $smtp->close();
}
