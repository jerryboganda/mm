<?php
require "/var/www/html/core/vendor/autoload.php";
$app = require "/var/www/html/core/bootstrap/app.php";
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();
$template = App\Models\Template::find(4);
$account = App\Models\WhatsappAccount::find(2);
$lib = new App\Lib\WhatsApp\WhatsAppLib();
$component = $lib->buildTemplateImageHeaderComponent($template, $account);
echo json_encode($component, JSON_PRETTY_PRINT), PHP_EOL;