<?php
require dirname(__DIR__) . '/bootstrap.php';
requireMethod('POST');
requireAdmin();
$data = inputJson();
$staticId = cleanText($data['staticId'] ?? null, MAX_STATIC_ID, 'Укажите Static ID');
$stmt = $pdo->prepare('SELECT id FROM attempts WHERE static_id = ? LIMIT 1'); $stmt->execute([$staticId]);
if (!$stmt->fetchColumn()) jsonResponse(['error' => 'Попыток с таким Static ID не найдено — кулдауна нет'], 404);
$insert = $pdo->prepare('INSERT INTO cooldown_resets (static_id) VALUES (?)'); $insert->execute([$staticId]);
jsonResponse(['ok' => true, 'staticId' => $staticId]);
