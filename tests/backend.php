<?php
declare(strict_types=1);

spl_autoload_register(function (string $class): void {
    $prefix = 'Devoski\\Contact\\';
    if (str_starts_with($class, $prefix)) require __DIR__ . '/../server/src/' . substr($class, strlen($prefix)) . '.php';
});
if (is_file(__DIR__ . '/../server/vendor/autoload.php')) require __DIR__ . '/../server/vendor/autoload.php';

use Devoski\Contact\{Application, Store, Validation, HttpError, Verifier, Mailer, Siteverify, ClientIp, SmtpMailer};

$checks = 0;
function check(bool $condition, string $message): void { global $checks; $checks++; if (!$condition) throw new RuntimeException($message); }
function payload(array $overrides = []): array {
    return array_replace(['firstName' => 'Ali', 'lastName' => 'Khan', 'email' => 'ali@example.com', 'phone' => '', 'country' => '', 'company' => '', 'website' => '', 'industry' => '', 'budget' => 'Not Sure', 'referral' => 'Google Search', 'message' => 'I need a website for my business.', 'websiteConfirm' => '', 'formType' => 'contact', 'requestId' => '11111111-1111-4111-8111-111111111111', 'recaptchaToken' => 'test-token'], $overrides);
}
function headers(array $overrides = []): array { return array_replace(['REQUEST_METHOD' => 'POST', 'HTTP_ORIGIN' => 'https://devoskisystems.com', 'CONTENT_TYPE' => 'application/json', 'REMOTE_ADDR' => '192.0.2.8'], $overrides); }
function fixture(array $override = [], bool $rejectVerification = false, bool $failMail = false): array {
    $dir = sys_get_temp_dir() . '/devoski-test-' . bin2hex(random_bytes(6)); mkdir($dir, 0700);
    $config = ['allowed_origins' => ['https://devoskisystems.com'], 'allowed_hostnames' => ['devoskisystems.com'], 'max_request_bytes' => 16384, 'trusted_proxy_cidrs' => [], 'rate' => ['ip_attempts' => 100, 'ip_window_seconds' => 600, 'email_attempts' => 100, 'email_window_seconds' => 3600, 'global_send_attempts_per_hour' => 0]];
    $config = array_replace_recursive($config, $override);
    $verifier = new class($rejectVerification) implements Verifier { public int $calls = 0; public function __construct(private bool $reject) {} public function verify(string $token, string $ip): void { $this->calls++; if ($this->reject) throw new HttpError(422, 'verification_failed', 'Verification failed.'); } };
    $mailer = new class($failMail) implements Mailer { public int $calls = 0; public array $last = []; public function __construct(private bool $fail) {} public function send(array $data): void { $this->calls++; $this->last = $data; if ($this->fail) throw new RuntimeException('Secret SMTP diagnostics must not be returned'); } };
    $store = new Store($dir, str_repeat('x', 64));
    register_shutdown_function(function () use ($dir) { foreach (glob($dir . '/*') ?: [] as $file) @unlink($file); @rmdir($dir); });
    return [new Application($config, $store, $verifier, $mailer), $verifier, $mailer, $store];
}

[$app, $verifier, $mailer] = fixture();
foreach (['GET', 'PUT', 'DELETE', 'OPTIONS'] as $method) check($app->handle(headers(['REQUEST_METHOD' => $method]), '{}')['status'] === 405, 'Method rejected');
check($app->handle(headers(['HTTP_ORIGIN' => 'https://attacker.test']), '{}')['status'] === 403, 'Cross-site origin rejected');
check($app->handle(headers(['HTTP_ORIGIN' => '']), '{}')['status'] === 403, 'Missing Origin rejected');
check($app->handle(headers(['CONTENT_TYPE' => 'text/plain']), '{}')['status'] === 415, 'Non-JSON rejected');
check($app->handle(headers(), str_repeat('x', 16385))['status'] === 413, 'Oversized request rejected');
check($app->handle(headers(), '{')['status'] === 400, 'Malformed JSON rejected');
check($app->handle(headers(), '[]')['status'] === 400, 'Root array rejected');
foreach ([['firstName' => []], ['email' => 'bad'], ['email' => "a@example.com\r\nBcc: x@example.com"], ['firstName' => "Ali\r\nBcc: x@example.com"], ['message' => 'short'], ['message' => str_repeat('x', 5001)], ['website' => 'javascript:alert(1)'], ['website' => 'https://user:pass@example.com'], ['budget' => 'fake'], ['referral' => 'fake'], ['recaptchaToken' => ''], ['requestId' => '../../config.php'], ['injected' => 'unexpected']] as $change) {
    check($app->handle(headers(), json_encode(payload($change)))['status'] === 422, 'Invalid field rejected: ' . array_key_first($change));
}
check($app->handle(headers(), json_encode(payload(['websiteConfirm' => 'spam'])))['status'] === 422, 'Honeypot rejected');
check($verifier->calls === 0 && $mailer->calls === 0, 'Invalid requests never verify or send mail');
$response = $app->handle(headers(), json_encode(payload(['firstName' => '<b>Ali</b>'])));
check($response['status'] === 200 && $mailer->calls === 1, 'Valid enquiry sent');
check($mailer->last['firstName'] === 'Ali', 'HTML stripped from plain text field');
$response = $app->handle(headers(), json_encode(payload()));
check($response['status'] === 200 && $mailer->calls === 1 && $verifier->calls === 1, 'Sent request replay acknowledged without remailing');
$response = $app->handle(headers(), json_encode(payload(['recaptchaToken' => 'fresh-test-token'])));
check($response['status'] === 200 && $mailer->calls === 1 && $verifier->calls === 1, 'Fresh CAPTCHA replay acknowledged without remailing');
check($app->handle(headers(), json_encode(payload(['message' => 'Changed message for same ID.'])))['status'] === 409, 'Changed payload cannot reuse a request ID');

[$badCaptcha, $v, $m] = fixture([], true);
check($badCaptcha->handle(headers(), json_encode(payload()))['status'] === 422 && $m->calls === 0, 'Failed CAPTCHA never sends mail');
check($badCaptcha->handle(headers(), json_encode(payload(['recaptchaToken' => 'fresh-test-token'])))['status'] === 422 && $v->calls === 2 && $m->calls === 0, 'Failed CAPTCHA can be retried with a fresh token');
[$badSmtp, $v, $m] = fixture([], false, true);
$response = $badSmtp->handle(headers(), json_encode(payload()));
check($response['status'] === 502 && $response['body']['code'] === 'delivery_unknown', 'SMTP failure safely reported');
check(!str_contains(json_encode($response), 'Secret SMTP'), 'SMTP diagnostics not leaked');
check($badSmtp->handle(headers(), json_encode(payload()))['status'] === 409 && $m->calls === 1, 'Uncertain delivery cannot be sent twice');

[$limited, $v, $m] = fixture(['rate' => ['ip_attempts' => 1]]);
$limited->handle(headers(), json_encode(payload()));
$response = $limited->handle(headers(), json_encode(payload()));
check($response['status'] === 429 && $response['body']['retryAfter'] > 0, 'IP rate limit enforced');
[$limited, $v, $m] = fixture(['rate' => ['email_attempts' => 1]]);
$limited->handle(headers(), json_encode(payload()));
check($limited->handle(headers(['REMOTE_ADDR' => '192.0.2.9']), json_encode(payload(['requestId' => '22222222-2222-4222-8222-222222222222'])))['status'] === 429 && $m->calls === 1, 'Email limit enforced across IP addresses');
[$limited, $v, $m] = fixture(['rate' => ['global_send_attempts_per_hour' => 1]]);
$limited->handle(headers(), json_encode(payload()));
check($limited->handle(headers(), json_encode(payload(['email' => 'other@example.com', 'requestId' => '22222222-2222-4222-8222-222222222222'])))['status'] === 429 && $m->calls === 1, 'Optional provider sending guard enforced');

$validResult = ['success' => true, 'hostname' => 'devoskisystems.com', 'challenge_ts' => gmdate('c')];
Siteverify::validateResult($validResult, ['devoskisystems.com']); check(true, 'Valid Siteverify response accepted');
Siteverify::validateResult(array_replace($validResult, ['challenge_ts' => gmdate('c', time() - 600)]), ['devoskisystems.com']); check(true, 'Google success accepted for older challenge-load time');
foreach ([['success' => false], ['hostname' => 'attacker.test'], ['challenge_ts' => 'invalid-timestamp'], ['challenge_ts' => gmdate('c', time() + 120)]] as $change) {
    try { Siteverify::validateResult(array_replace($validResult, $change), ['devoskisystems.com']); check(false, 'Untrusted Siteverify response accepted'); }
    catch (HttpError $error) { check($error->status === 422, 'Untrusted Siteverify response rejected'); }
}
try { Siteverify::validateResult(['success' => false, 'error-codes' => ['invalid-input-secret']], ['devoskisystems.com']); check(false, 'Misconfigured verification accepted'); }
catch (HttpError $error) { check($error->status === 503, 'Verification configuration failure safely reported'); }
check(ClientIp::get(headers(['HTTP_CF_CONNECTING_IP' => '198.51.100.1']), []) === '192.0.2.8', 'Spoofed forwarded IP ignored');
check(ClientIp::get(headers(['HTTP_CF_CONNECTING_IP' => '198.51.100.1']), ['192.0.2.0/24']) === '198.51.100.1', 'Explicit trusted proxy accepted');
check(ClientIp::get(headers(['REMOTE_ADDR' => '2001:db8::2', 'HTTP_CF_CONNECTING_IP' => '198.51.100.1']), ['2001:db8::/32']) === '198.51.100.1', 'IPv6 trusted proxy accepted');
[$a, $v, $m, $store] = fixture();
$hash = $store->fingerprint(Validation::fields(payload()));
check($store->claim(payload()['requestId'], $hash) === 'claimed', 'Atomic reservation created');
try { $store->claim(payload()['requestId'], $hash); check(false, 'Concurrent reservation allowed'); } catch (HttpError $error) { check($error->status === 409, 'Concurrent reservation refused'); }

if (class_exists(\PHPMailer\PHPMailer\PHPMailer::class)) {
    $smtp = ['host' => 'mail.privateemail.com', 'port' => 465, 'encryption' => 'smtps', 'username' => 'info@devoskisystems.com', 'password' => 'test-not-a-real-password', 'from_name' => 'Devoski Systems', 'recipient' => 'recipient@example.com', 'timeout_seconds' => 15];
    $message = (new SmtpMailer($smtp))->message(Validation::fields(payload()));
    check($message->From === $smtp['username'], 'From is authenticated account');
    check(array_values($message->getReplyToAddresses())[0][0] === 'ali@example.com', 'Visitor address is Reply-To');
    check($message->getToAddresses()[0][0] === 'recipient@example.com', 'Recipient comes from private configuration');
    check($message->SMTPAuth && $message->SMTPSecure === 'ssl' && $message->SMTPDebug === 0, 'Authenticated encrypted SMTP configured');
    $message->preSend();
    check(str_contains($message->getSentMIMEMessage(), 'Reply-To: Ali Khan <ali@example.com>'), 'Generated MIME contains safe Reply-To header');
} else { throw new RuntimeException('Install Composer dependencies to test actual PHPMailer configuration.'); }
echo "PASS: $checks backend checks. No external mail sent.\n";
