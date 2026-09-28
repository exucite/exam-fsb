<?php
require __DIR__ . '/bootstrap.php';
requireMethod('GET');
$staticId = cleanText($_GET['staticId'] ?? '', MAX_STATIC_ID, 'Укажите Static ID');
$remaining = cooldownRemaining($pdo, $staticId, browserId());
if ($remaining > 0) jsonResponse(['error' => 'Тест уже пройден с этого браузера. Повторный доступ будет открыт через ' . remainingMessage($remaining), 'retryAfterMs' => $remaining], 403);
$stmt = $pdo->query('SELECT q.id, q.text, o.id AS option_id, o.text AS option_text FROM questions q LEFT JOIN options o ON o.question_id = q.id ORDER BY q.sort_order, o.sort_order');
$questions = [];
foreach ($stmt as $row) {
    $id = (int)$row['id'];
    if (!isset($questions[$id])) $questions[$id] = ['id' => $id, 'text' => $row['text'], 'options' => []];
    if ($row['option_id'] !== null) $questions[$id]['options'][] = ['id' => (int)$row['option_id'], 'text' => $row['option_text']];
}
if (!$questions) jsonResponse(['error' => 'Вопросы не найдены'], 409);
foreach ($questions as &$question) { shuffle($question['options']); }
unset($question);
jsonResponse(['questions' => array_values($questions)]);
