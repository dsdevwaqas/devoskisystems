<?php
declare(strict_types=1);
namespace Devoski\Contact;

use PDO;
use RuntimeException;

final class Store
{
    private PDO $db;
    public function __construct(string $directory, private readonly string $key)
    {
        $previous = umask(0077);
        try {
            $this->db = new PDO('sqlite:' . $directory . '/contact.sqlite', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
        } finally { umask($previous); }
        $this->db->exec('PRAGMA busy_timeout = 5000');
        $this->db->exec('CREATE TABLE IF NOT EXISTS rate_limits (bucket TEXT PRIMARY KEY, hits INTEGER NOT NULL, reset_at INTEGER NOT NULL)');
        $this->db->exec('CREATE TABLE IF NOT EXISTS submissions (id TEXT PRIMARY KEY, payload_hash TEXT NOT NULL, status TEXT NOT NULL, updated_at INTEGER NOT NULL)');
        $this->db->exec('CREATE INDEX IF NOT EXISTS rate_expiry ON rate_limits(reset_at)');
        $this->db->exec('CREATE INDEX IF NOT EXISTS submission_expiry ON submissions(updated_at)');
        $now = time();
        $this->db->exec('DELETE FROM rate_limits WHERE reset_at < ' . $now);
        $this->db->exec('DELETE FROM submissions WHERE updated_at < ' . ($now - 86400));
    }

    public function limit(string $group, string $identity, int $max, int $seconds): void
    {
        if ($max === 0) return;
        $bucket = hash_hmac('sha256', $group . ':' . $identity, $this->key);
        $this->db->exec('BEGIN IMMEDIATE');
        try {
            $now = time();
            $query = $this->db->prepare('SELECT hits, reset_at FROM rate_limits WHERE bucket = ?'); $query->execute([$bucket]); $row = $query->fetch(PDO::FETCH_ASSOC);
            if ($row && (int)$row['reset_at'] > $now && (int)$row['hits'] >= $max) {
                throw new HttpError(429, 'rate_limited', 'Too many attempts. Please try again later.', [], max(1, (int)$row['reset_at'] - $now));
            }
            $active = $row && (int)$row['reset_at'] > $now;
            $query = $this->db->prepare('INSERT OR REPLACE INTO rate_limits (bucket, hits, reset_at) VALUES (?, ?, ?)');
            $query->execute([$bucket, $active ? (int)$row['hits'] + 1 : 1, $active ? (int)$row['reset_at'] : $now + $seconds]);
            $this->db->exec('COMMIT');
        } catch (\Throwable $e) { $this->db->exec('ROLLBACK'); throw $e; }
    }

    public function fingerprint(array $data): string
    {
        unset($data['turnstileToken'], $data['requestId'], $data['websiteConfirm']);
        ksort($data);
        return hash_hmac('sha256', json_encode($data, JSON_THROW_ON_ERROR), $this->key);
    }

    /** Atomic reservation prevents two workers from mailing the same request ID. */
    public function claim(string $id, string $hash): string
    {
        $this->db->exec('BEGIN IMMEDIATE');
        try {
            $query = $this->db->prepare('SELECT payload_hash, status FROM submissions WHERE id = ?'); $query->execute([$id]); $row = $query->fetch(PDO::FETCH_ASSOC);
            if ($row && !hash_equals($row['payload_hash'], $hash)) throw new HttpError(409, 'submission_changed', 'This enquiry changed after an attempt. Reload the page to start a new enquiry.');
            if ($row && $row['status'] === 'sent') { $this->db->exec('COMMIT'); return 'sent'; }
            if ($row && in_array($row['status'], ['processing', 'sending', 'unknown'], true)) throw new HttpError(409, $row['status'] === 'unknown' ? 'delivery_unknown' : 'submission_processing', 'This enquiry may already be processing or sent. Please contact info@devoskisystems.com before submitting again.');
            $query = $this->db->prepare('INSERT OR REPLACE INTO submissions (id, payload_hash, status, updated_at) VALUES (?, ?, ?, ?)'); $query->execute([$id, $hash, 'processing', time()]);
            $this->db->exec('COMMIT');
            return 'claimed';
        } catch (\Throwable $e) { $this->db->exec('ROLLBACK'); throw $e; }
    }

    public function mark(string $id, string $status): void
    {
        if (!in_array($status, ['failed', 'sending', 'sent', 'unknown'], true)) throw new RuntimeException('invalid_status');
        $query = $this->db->prepare('UPDATE submissions SET status = ?, updated_at = ? WHERE id = ?'); $query->execute([$status, time(), $id]);
    }
}
