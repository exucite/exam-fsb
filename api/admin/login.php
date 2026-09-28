<?php
require dirname(__DIR__) . '/bootstrap.php';
requireMethod('POST');
$data = inputJson();
$password = $data['password'] ?? null;
if (!is_string($password) || $password === '') jsonResponse(['error' => 'Укажите пароль'], 400);
if ((string)$config['admin_password_hash'] === '' || (string)$config['admin_session_secret'] === '' || !password_verify($password, (string)$config['admin_password_hash'])) jsonResponse(['error' => 'Неверный пароль'], 401);
setcookie(ADMIN_COOKIE, newSessionToken(), cookieOptions(time() + ADMIN_TTL_SECONDS));
jsonResponse(['ok' => true]);
