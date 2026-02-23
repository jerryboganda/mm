<?php
require "/var/www/html/core/vendor/autoload.php";
$app = require "/var/www/html/core/bootstrap/app.php";
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();
$vals = [
  'broadcast.default' => config('broadcasting.default'),
  'app.PUSHER_APP_KEY' => config('app.PUSHER_APP_KEY'),
  'app.PUSHER_APP_ID' => config('app.PUSHER_APP_ID'),
  'app.PUSHER_APP_CLUSTER' => config('app.PUSHER_APP_CLUSTER'),
];
foreach ($vals as $k => $v) {
  echo $k . '=' . (is_scalar($v) ? (string)$v : json_encode($v)) . PHP_EOL;
}