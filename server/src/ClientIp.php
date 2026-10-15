<?php
declare(strict_types=1);
namespace Devoski\Contact;

final class ClientIp
{
    public static function get(array $server, array $trustedCidrs): string
    {
        $remote = $server['REMOTE_ADDR'] ?? '';
        if (!filter_var($remote, FILTER_VALIDATE_IP)) throw new HttpError(400, 'invalid_request', 'Invalid request.');
        // Only a directly connected, explicitly trusted proxy may supply this header.
        foreach ($trustedCidrs as $cidr) {
            if (self::contains($remote, $cidr)) {
                $forwarded = $server['HTTP_CF_CONNECTING_IP'] ?? '';
                if (filter_var($forwarded, FILTER_VALIDATE_IP)) return $forwarded;
            }
        }
        return $remote;
    }

    private static function contains(string $ip, string $cidr): bool
    {
        [$network, $prefix] = array_pad(explode('/', $cidr, 2), 2, null);
        $ipBytes = inet_pton($ip); $networkBytes = @inet_pton($network);
        if ($ipBytes === false || $networkBytes === false || strlen($ipBytes) !== strlen($networkBytes)) return false;
        $bits = $prefix === null ? strlen($ipBytes) * 8 : (int)$prefix;
        if ($bits < 0 || $bits > strlen($ipBytes) * 8) return false;
        $whole = intdiv($bits, 8); $remaining = $bits % 8;
        if (substr($ipBytes, 0, $whole) !== substr($networkBytes, 0, $whole)) return false;
        return !$remaining || ((ord($ipBytes[$whole]) ^ ord($networkBytes[$whole])) & (0xff << (8 - $remaining))) === 0;
    }
}
