<?php
declare(strict_types=1);
namespace Devoski\Contact;

final class Siteverify implements Verifier
{
    public function __construct(private readonly array $config) {}

    public function verify(string $token, string $ip): void
    {
        $handle = curl_init('https://www.google.com/recaptcha/api/siteverify');
        curl_setopt_array($handle, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => http_build_query(['secret' => $this->config['recaptcha_secret'], 'response' => $token, 'remoteip' => $ip]),
            CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded'],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_TIMEOUT => 10,
            CURLOPT_PROTOCOLS => CURLPROTO_HTTPS,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
        ]);
        $body = curl_exec($handle); $status = curl_getinfo($handle, CURLINFO_HTTP_CODE); curl_close($handle);
        if (!is_string($body) || $status !== 200) throw new HttpError(503, 'verification_unavailable', 'Verification is temporarily unavailable. Please try again.');
        try { $result = json_decode($body, true, 16, JSON_THROW_ON_ERROR); } catch (\JsonException) { throw new HttpError(503, 'verification_unavailable', 'Verification is temporarily unavailable. Please try again.'); }
        self::validateResult($result, $this->config['allowed_hostnames']);
    }

    public static function validateResult(mixed $result, array $hosts): void
    {
        if (is_array($result) && array_intersect($result['error-codes'] ?? [], ['internal-error', 'missing-input-secret', 'invalid-input-secret'])) throw new HttpError(503, 'verification_unavailable', 'Verification is temporarily unavailable. Please try again later.');
        if (!is_array($result) || ($result['success'] ?? false) !== true) throw new HttpError(422, 'verification_failed', 'Please complete verification again.', ['recaptchaToken' => 'Verification failed or expired. Please retry.']);
        if (!in_array(strtolower($result['hostname'] ?? ''), $hosts, true)) throw new HttpError(422, 'verification_failed', 'Please complete verification on this website.', ['recaptchaToken' => 'Verification did not match this website.']);
        $timestamp = strtotime($result['challenge_ts'] ?? '');
        if (!$timestamp || $timestamp > time() + 30) throw new HttpError(422, 'verification_failed', 'Verification expired. Please verify again.', ['recaptchaToken' => 'Please verify again.']);
    }
}
