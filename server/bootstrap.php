<?php
declare(strict_types=1);

use Devoski\Contact\Application;
use Devoski\Contact\Config;
use Devoski\Contact\Store;
use Devoski\Contact\Siteverify;
use Devoski\Contact\SmtpMailer;

// Loaded from the private directory by public_html/api/contact.php.
require __DIR__ . '/vendor/autoload.php';
$config = Config::load(__DIR__ . '/config.php');
return new Application($config, new Store($config['storage_path'], $config['rate_key']), new Siteverify($config), new SmtpMailer($config['smtp']));
