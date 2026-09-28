<?php
require __DIR__ . '/bootstrap.php';
requireMethod('POST');
$data = inputJson();
$participant = is_array($data['participant'] ?? null) ? $data['participant'] : [];
$firstName = cleanText($participant['firstName'] ?? null, MAX_NAME, 'Укажите имя');
$lastName = cleanText($participant['lastName'] ?? null, MAX_NAME, 'Укажите фамилию');
$staticId = cleanText($participant['staticId'] ?? null, MAX_STATIC_ID, 'Укажите Static ID');
$answers = $data['answers'] ?? null;
if (!is_array($answers) || count($answers) < 1 || count($answers) > MAX_ANSWERS) jsonResponse(['error' => 'Некорректный список ответов'], 400);
$seen = [];
foreach ($answers as $answer) {
    if (!is_array($answer) || filter_var($answer['questionId'] ?? null, FILTER_VALIDATE_INT) === false) jsonResponse(['error' => 'Некорректный вопрос'], 400);
    $qid = (int)$answer['questionId'];
    if (isset($seen[$qid])) jsonResponse(['error' => 'Вопрос повторяется'], 400);
    $seen[$qid] = $answer['optionId'] === null ? null : (int)$answer['optionId'];
    if ($answer['optionId'] !== null && filter_var($answer['optionId'] ?? null, FILTER_VALIDATE_INT) === false) jsonResponse(['error' => 'Некорректный вариант ответа'], 400);
}
$browser = browserId();
$remaining = cooldownRemaining($pdo, $staticId, $browser);
if ($remaining > 0) jsonResponse(['error' => 'Следующая попытка будет доступна через ' . remainingMessage($remaining), 'retryAfterMs' => $remaining], 429);
$questions = $pdo->query('SELECT q.id, o.id AS option_id, o.correct FROM questions q LEFT JOIN options o ON o.question_id = q.id ORDER BY q.id')->fetchAll();
$byQuestion = [];
foreach ($questions as $row) { $byQuestion[(int)$row['id']][] = $row['option_id'] === null ? null : ['id' => (int)$row['option_id'], 'correct' => (bool)$row['correct']]; }
if (!$byQuestion) jsonResponse(['error' => 'Вопросы не найдены'], 409);
$score = 0; $scored = [];
foreach ($byQuestion as $qid => $options) {
    $optionId = $seen[$qid] ?? null; $isCorrect = false; $storedOption = null;
    foreach ($options as $option) if ($option && $option['id'] === $optionId) { $storedOption = $optionId; $isCorrect = $option['correct']; break; }
    if ($isCorrect) $score++;
    $scored[] = [$qid, $storedOption, $isCorrect];
}
$total = count($byQuestion); $percentage = (int)round($score / $total * 100);
try {
    $pdo->beginTransaction();
    $stmt = $pdo->prepare('INSERT INTO attempts (first_name,last_name,static_id,browser_id,score,total,percentage) VALUES (?,?,?,?,?,?,?)');
    $stmt->execute([$firstName, $lastName, $staticId, $browser, $score, $total, $percentage]);
    $attemptId = (int)$pdo->lastInsertId();
    $answerStmt = $pdo->prepare('INSERT INTO attempt_answers (attempt_id,question_id,option_id,is_correct) VALUES (?,?,?,?)');
    foreach ($scored as [$qid, $optionId, $isCorrect]) $answerStmt->execute([$attemptId, $qid, $optionId, $isCorrect ? 1 : 0]);
    $pdo->commit();
} catch (Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack(); error_log($e->getMessage()); jsonResponse(['error' => 'Не удалось сохранить результат'], 500); }
jsonResponse(['attemptId' => $attemptId, 'score' => $score, 'total' => $total, 'percentage' => $percentage], 201);
