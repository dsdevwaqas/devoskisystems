<?php
declare(strict_types=1);
namespace Devoski\Contact;

interface Mailer
{
    public function send(array $data): void;
}
