<?php
// Local PHP built-in-server router only. Not copied into the public build.
declare(strict_types=1);
$root = realpath($_SERVER['DOCUMENT_ROOT']);
$path = rawurldecode(parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?: '/');
if (str_contains($path, '..') || str_contains($path, "\0")) { http_response_code(400); exit; }
if ($path === '/api/contact.php') { require $root . '/api/contact.php'; exit; }
if (str_starts_with($path, '/api/')) { http_response_code(404); header('Content-Type: application/json'); echo '{"ok":false,"message":"Not found"}'; exit; }
if (preg_match('/\.php$/i', $path)) { http_response_code(404); exit; }
if ($path !== '/' && is_file($root . $path)) return false;
if (is_file($root . '/index.html')) { header('Content-Type: text/html; charset=utf-8'); readfile($root . '/index.html'); }
else { http_response_code(404); }
