<?php
declare(strict_types=1);
namespace Devoski\Contact;

use RuntimeException;

final class Config
{
    public static function load(string $file): array
    {
        if (!is_file($file)) throw new RuntimeException('configuration_missing');
        $config = require $file;
        if (!is_array($config)) throw new RuntimeException('configuration_invalid');
        foreach (['curl', 'mbstring', 'openssl', 'pdo_sqlite'] as $extension) {
            if (!extension_loaded($extension)) throw new RuntimeException('extension_missing');
        }
        if (strlen($config['recaptcha_secret'] ?? '') < 20 || strlen($config['rate_key'] ?? '') < 32) throw new RuntimeException('secrets_missing');
        if (!is_array($config['allowed_origins'] ?? null) || !$config['allowed_origins'] || !is_array($config['allowed_hostnames'] ?? null) || !$config['allowed_hostnames']) throw new RuntimeException('origins_missing');
        foreach ($config['allowed_origins'] as $origin) {
            if (!is_string($origin) || !preg_match('~^https?://[a-z0-9.-]+(?::[0-9]+)?$~iD', $origin)) throw new RuntimeException('origin_invalid');
        }
        foreach ($config['allowed_hostnames'] as $hostname) {
            if (!is_string($hostname) || !preg_match('/^[a-z0-9.-]+$/iD', $hostname)) throw new RuntimeException('hostname_invalid');
        }
        $smtp = $config['smtp'] ?? [];
        if (!filter_var($smtp['username'] ?? '', FILTER_VALIDATE_EMAIL) || !filter_var($smtp['recipient'] ?? '', FILTER_VALIDATE_EMAIL)) throw new RuntimeException('smtp_address_invalid');
        if (!is_string($smtp['password'] ?? null) || $smtp['password'] === '') throw new RuntimeException('smtp_password_missing');
        if (!preg_match('/^[a-z0-9.-]+$/iD', $smtp['host'] ?? '')) throw new RuntimeException('smtp_host_invalid');
        if (!(($smtp['encryption'] ?? '') === 'smtps' && ($smtp['port'] ?? 0) === 465) && !(($smtp['encryption'] ?? '') === 'tls' && ($smtp['port'] ?? 0) === 587)) throw new RuntimeException('smtp_tls_invalid');
        if (!is_string($smtp['from_name'] ?? null) || preg_match('/[\x00-\x1f\x7f]/', $smtp['from_name'])) throw new RuntimeException('smtp_name_invalid');
        if (($smtp['timeout_seconds'] ?? 0) < 5 || $smtp['timeout_seconds'] > 20) throw new RuntimeException('smtp_timeout_invalid');
        if (($config['max_request_bytes'] ?? 0) < 8192 || $config['max_request_bytes'] > 65536) throw new RuntimeException('request_limit_invalid');
        foreach (['ip_attempts', 'ip_window_seconds', 'email_attempts', 'email_window_seconds'] as $key) {
            if (!is_int($config['rate'][$key] ?? null) || $config['rate'][$key] < 1) throw new RuntimeException('rate_invalid');
        }
        if (!is_int($config['rate']['global_send_attempts_per_hour'] ?? null) || $config['rate']['global_send_attempts_per_hour'] < 0) throw new RuntimeException('rate_invalid');
        $parent = realpath(dirname($file));
        $public = realpath($_SERVER['DOCUMENT_ROOT'] ?? '') ?: null;
        if ($public && ($parent === $public || str_starts_with($parent . DIRECTORY_SEPARATOR, $public . DIRECTORY_SEPARATOR))) throw new RuntimeException('config_inside_public_root');
        $storage = $config['storage_path'] ?? '';
        if (!is_string($storage) || !is_dir($storage) || !is_writable($storage)) throw new RuntimeException('storage_unavailable');
        $storage = realpath($storage);
        if ($public && ($storage === $public || str_starts_with($storage . DIRECTORY_SEPARATOR, $public . DIRECTORY_SEPARATOR))) throw new RuntimeException('storage_inside_public_root');
        $config['storage_path'] = $storage;
        return $config;
    }
}
