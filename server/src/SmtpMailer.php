<?php
declare(strict_types=1);
namespace Devoski\Contact;

use PHPMailer\PHPMailer\PHPMailer;

final class SmtpMailer implements Mailer
{
    public function __construct(private readonly array $smtp) {}

    // Exposed separately for MIME/header testing without making a network call.
    public function message(array $data): PHPMailer
    {
        $mail = new PHPMailer(true);
        $mail->isSMTP();
        $mail->Host = $this->smtp['host'];
        $mail->Port = $this->smtp['port'];
        $mail->SMTPAuth = true;
        $mail->Username = $this->smtp['username'];
        $mail->Password = $this->smtp['password'];
        $mail->SMTPSecure = $this->smtp['encryption'] === 'smtps' ? PHPMailer::ENCRYPTION_SMTPS : PHPMailer::ENCRYPTION_STARTTLS;
        $mail->SMTPAutoTLS = true;
        $mail->SMTPDebug = 0;
        $mail->Timeout = $this->smtp['timeout_seconds'];
        $mail->getSMTPInstance()->Timelimit = $this->smtp['timeout_seconds'];
        // PHPMailer's default peer and hostname certificate verification stays enabled.
        $mail->CharSet = 'UTF-8';
        $mail->XMailer = '';
        $mail->setFrom($this->smtp['username'], $this->smtp['from_name']);
        $mail->addAddress($this->smtp['recipient']);
        $mail->addReplyTo($data['email'], $data['firstName'] . ' ' . $data['lastName']);
        $mail->Subject = '[Devoski Systems] ' . ($data['formType'] === 'quote' ? 'Project quote' : 'Contact enquiry') . ' / ' . substr($data['requestId'], 0, 8);
        $labels = ['firstName' => 'First name', 'lastName' => 'Last name', 'email' => 'Email', 'phone' => 'Phone', 'country' => 'Country', 'company' => 'Company', 'website' => 'Website', 'industry' => 'Industry', 'budget' => 'Budget', 'referral' => 'Referral', 'message' => 'Message'];
        $body = ['New enquiry from https://devoskisystems.com', 'Reference: ' . $data['requestId'], 'Received (UTC): ' . gmdate('c')];
        foreach ($labels as $key => $label) if ($data[$key] !== '') $body[] = $label . ': ' . $data[$key];
        $mail->isHTML(false);
        $mail->Body = implode("\n\n", $body);
        return $mail;
    }

    public function send(array $data): void { $this->message($data)->send(); }
}
