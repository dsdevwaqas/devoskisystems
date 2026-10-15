<?php
declare(strict_types=1);

ini_set('display_errors', '0');
ini_set('log_errors', '1');
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('Allow: POST');

function respond(int $status, array $body)
{
    http_response_code($status);
    if ($status === 429) header('Retry-After: ' . max(1, (int)($body['retryAfter'] ?? 60)));
    echo json_encode($body, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') respond(405, ['ok' => false, 'code' => 'method_not_allowed', 'message' => 'Use POST to submit this form.']);
// Fail with clean JSON before Composer can print its PHP-version diagnostic.
if (PHP_VERSION_ID < 80200) respond(503, ['ok' => false, 'code' => 'php_upgrade_required', 'message' => 'The contact form is temporarily unavailable. Please email info@devoskisystems.com.']);
// Hard ceiling applies even before private configuration can be loaded.
if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 65536) respond(413, ['ok' => false, 'code' => 'request_too_large', 'message' => 'This enquiry is too large.']);

try {
    // /home/USER/public_html/api -> /home/USER/devoski-private.
    // Addon domains may set DEVOSKI_PRIVATE_DIR to an absolute private path.
    $private = getenv('DEVOSKI_PRIVATE_DIR') ?: dirname(__DIR__, 2) . '/devoski-private';
    $app = require $private . '/bootstrap.php';
    $raw = file_get_contents('php://input', false, null, 0, 65537);
    if ($raw === false) respond(400, ['ok' => false, 'code' => 'invalid_request', 'message' => 'Invalid request.']);
    $result = $app->handle($_SERVER, $raw);
    respond($result['status'], $result['body']);
} catch (Throwable $error) {
    error_log('devoski_contact configuration_or_runtime_unavailable');
    respond(503, ['ok' => false, 'code' => 'service_unavailable', 'message' => 'The form is temporarily unavailable. Please email info@devoskisystems.com.']);
}
