<?php
declare(strict_types=1);
namespace Devoski\Contact;

final class Validation
{
    public const BUDGETS = ['Not Sure', 'USD $0 - $100', 'USD $100 - $500', 'USD $500 - $1,000', 'USD $1,000 - $2,500', 'USD $2,500 - $5,000', 'USD $5,000 - $10,000', 'USD $10,000 - $25,000', 'More Than USD $25,000'];
    public const REFERRALS = ['Google Search', 'Social Media', 'Recommendation', 'Other'];
    public const LIMITS = ['firstName' => 80, 'lastName' => 80, 'email' => 254, 'phone' => 40, 'country' => 80, 'company' => 120, 'website' => 2048, 'industry' => 120, 'message' => 5000, 'budget' => 60, 'referral' => 40, 'formType' => 10, 'websiteConfirm' => 200, 'recaptchaToken' => 8192, 'requestId' => 36];

    public static function fields(array $input): array
    {
        $errors = []; $data = [];
        if (array_diff(array_keys($input), array_keys(self::LIMITS))) $errors['form'] = 'Unexpected fields were submitted.';
        foreach (self::LIMITS as $key => $max) {
            $value = $input[$key] ?? '';
            if (!is_string($value)) { $errors[$key] = 'Enter a text value.'; $value = ''; }
            if (!mb_check_encoding($value, 'UTF-8') || mb_strlen($value, 'UTF-8') > $max) $errors[$key] = 'This value is invalid or too long.';
            if ($key === 'message') $value = str_replace(["\r\n", "\r"], "\n", $value);
            $control = $key === 'message' ? '/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/' : '/[\x00-\x1f\x7f]/';
            if (preg_match($control, $value)) $errors[$key] = 'Remove invalid control characters.';
            // Plain text only. Validate email and security identifiers without transforming them.
            $data[$key] = trim(in_array($key, ['email', 'recaptchaToken', 'requestId', 'website'], true) ? $value : strip_tags($value));
        }
        foreach (['firstName', 'lastName', 'email', 'message'] as $field) if ($data[$field] === '') $errors[$field] = 'This field is required.';
        if (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) $errors['email'] = 'Enter a valid email address.';
        if (mb_strlen($data['message'], 'UTF-8') < 10) $errors['message'] = 'Please enter at least 10 characters.';
        if ($data['website'] !== '') {
            $url = parse_url($data['website']);
            if (!filter_var($data['website'], FILTER_VALIDATE_URL) || !$url || !in_array(strtolower($url['scheme'] ?? ''), ['http', 'https'], true) || isset($url['user']) || isset($url['pass'])) $errors['website'] = 'Enter a full HTTP or HTTPS website URL.';
        }
        if (!in_array($data['formType'], ['contact', 'quote'], true)) $errors['formType'] = 'Choose a valid form.';
        if (!in_array($data['budget'], self::BUDGETS, true)) $errors['budget'] = 'Choose a valid budget.';
        if (!in_array($data['referral'], self::REFERRALS, true)) $errors['referral'] = 'Choose a valid referral source.';
        if (!preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iD', $data['requestId'])) $errors['requestId'] = 'Reload the form and try again.';
        if ($data['recaptchaToken'] === '') $errors['recaptchaToken'] = 'Please complete the verification.';
        if ($errors) throw new HttpError(422, 'validation_failed', 'Please check the highlighted fields.', $errors);
        return $data;
    }
}
