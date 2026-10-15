<?php
declare(strict_types=1);
namespace Devoski\Contact;

interface Verifier
{
    public function verify(string $token, string $ip): void;
}
