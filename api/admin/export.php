<?php
require dirname(__DIR__) . '/bootstrap.php';
requireMethod('GET');
requireAdmin();
$query = trim((string)($_GET['q'] ?? '')); $sql = 'SELECT first_name,last_name,static_id,score,total,percentage,created_at FROM attempts'; $params = [];
if ($query !== '') { $sql .= ' WHERE first_name LIKE ? OR last_name LIKE ? OR static_id LIKE ?'; $like = '%' . $query . '%'; $params = [$like, $like, $like]; }
$sql .= ' ORDER BY created_at DESC LIMIT 1000'; $stmt = $pdo->prepare($sql); $stmt->execute($params);
$lines = [implode(',', array_map('csvCell', ['Фамилия', 'Имя', 'Static ID', 'Баллы', 'Всего', '% результата', 'Дата']))];
foreach ($stmt as $row) $lines[] = implode(',', array_map('csvCell', [$row['last_name'], $row['first_name'], $row['static_id'], $row['score'], $row['total'], $row['percentage'], date('d.m.Y H:i:s', strtotime($row['created_at']))]));
header('Content-Type: text/csv; charset=utf-8'); header('Content-Disposition: attachment; filename="results-' . gmdate('Y-m-d') . '.csv"'); echo "\xEF\xBB\xBF" . implode("\r\n", $lines);
