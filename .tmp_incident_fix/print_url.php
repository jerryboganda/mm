<?php
require "/var/www/html/core/vendor/autoload.php";
$app = require "/var/www/html/core/bootstrap/app.php";
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();
echo "APP_URL=" . config("app.url") . PHP_EOL;
echo "URL_HELPER=" . url("assets/images/template_header/6994b09389cc31771352211.jpg") . PHP_EOL;