<?php
declare(strict_types=1);
namespace Devoski\Contact;

final class Application
{
    public function __construct(private readonly array $config, private readonly Store $store, private readonly Verifier $verifier, private readonly Mailer $mailer) {}

    public function handle(array $server, string $raw): array
    {
        $claimed = false; $sending = false; $id = '';
        try {
            if (($server['REQUEST_METHOD'] ?? '') !== 'POST') throw new HttpError(405, 'method_not_allowed', 'Use POST to submit this form.');
            if (!in_array($server['HTTP_ORIGIN'] ?? '', $this->config['allowed_origins'], true) || ($server['HTTP_SEC_FETCH_SITE'] ?? '') === 'cross-site') throw new HttpError(403, 'origin_not_allowed', 'Please submit the form from this website.');
            $ip = ClientIp::get($server, $this->config['trusted_proxy_cidrs'] ?? []);
            $rate = $this->config['rate'];
            $this->store->limit('ip', $ip, $rate['ip_attempts'], $rate['ip_window_seconds']);
            if (strtolower(trim(explode(';', $server['CONTENT_TYPE'] ?? '')[0])) !== 'application/json' || !in_array(strtolower($server['HTTP_CONTENT_ENCODING'] ?? ''), ['', 'identity'], true)) throw new HttpError(415, 'unsupported_media_type', 'Send JSON data.');
            if (strlen($raw) > $this->config['max_request_bytes'] || (int)($server['CONTENT_LENGTH'] ?? 0) > $this->config['max_request_bytes']) throw new HttpError(413, 'request_too_large', 'This enquiry is too large. Please shorten the message.');
            try { $input = json_decode($raw, false, 8, JSON_THROW_ON_ERROR); } catch (\JsonException) { throw new HttpError(400, 'invalid_json', 'Invalid request data.'); }
            if (!$input instanceof \stdClass) throw new HttpError(400, 'invalid_json', 'Send a JSON object.');
            $input = (array)$input;
            if (isset($input['websiteConfirm']) && (!is_string($input['websiteConfirm']) || trim($input['websiteConfirm']) !== '')) throw new HttpError(422, 'spam_detected', 'This enquiry could not be accepted.');
            $data = Validation::fields($input);
            $id = $data['requestId'];
            if ($this->store->claim($id, $this->store->fingerprint($data)) === 'sent') return $this->success();
            $claimed = true;
            $this->verifier->verify($data['recaptchaToken'], $ip);
            $this->store->limit('email', strtolower($data['email']), $rate['email_attempts'], $rate['email_window_seconds']);
            $this->store->limit('global', 'send', $rate['global_send_attempts_per_hour'], 3600);
            // Mark before touching SMTP. A crash/timeout must not cause automatic remailing.
            $this->store->mark($id, 'sending');
            $sending = true;
            $this->mailer->send($data);
            $this->store->mark($id, 'sent');
            return $this->success();
        } catch (HttpError $error) {
            if ($claimed && !$sending) $this->store->mark($id, 'failed');
            return ['status' => $error->status, 'body' => ['ok' => false, 'code' => $error->publicCode, 'message' => $error->getMessage(), 'errors' => (object)$error->errors, 'retryAfter' => $error->retryAfter]];
        } catch (\Throwable $error) {
            // Do not log payloads, CAPTCHA tokens, email credentials or raw SMTP diagnostics.
            error_log('devoski_contact ' . ($sending ? 'smtp_delivery_unconfirmed' : 'service_error') . ' reference=' . $id);
            if ($claimed) { try { $this->store->mark($id, $sending ? 'unknown' : 'failed'); } catch (\Throwable) {} }
            return ['status' => $sending ? 502 : 503, 'body' => ['ok' => false, 'code' => $sending ? 'delivery_unknown' : 'service_unavailable', 'message' => $sending ? 'Delivery could not be confirmed. Please contact info@devoskisystems.com before submitting again.' : 'The form is temporarily unavailable. Please try again later or email info@devoskisystems.com.']];
        }
    }

    private function success(): array { return ['status' => 200, 'body' => ['ok' => true, 'code' => 'sent', 'message' => 'Thank you. Your enquiry has been sent to our team.']]; }
}
