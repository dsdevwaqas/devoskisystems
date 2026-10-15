<?php
declare(strict_types=1);
namespace Devoski\Contact;

final class HttpError extends \RuntimeException
{
    public function __construct(public readonly int $status, public readonly string $publicCode, string $message, public readonly array $errors = [], public readonly int $retryAfter = 0)
    {
        parent::__construct($message);
    }
}
