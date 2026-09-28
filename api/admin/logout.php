<?php
require dirname(__DIR__) . '/bootstrap.php';
requireMethod('POST');
setcookie(ADMIN_COOKIE, '', cookieOptions(time() - 3600));
jsonResponse(['ok' => true]);
