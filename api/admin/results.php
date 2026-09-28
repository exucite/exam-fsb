<?php
require dirname(__DIR__) . '/bootstrap.php';
requireMethod('GET');
requireAdmin();
$query = trim((string)($_GET['q'] ?? ''));
$sql = 'SELECT id, first_name, last_name, static_id, score, total, percentage, created_at FROM attempts';
$params = [];
if ($query !== '') { $sql .= ' WHERE first_name LIKE ? OR last_name LIKE ? OR static_id LIKE ?'; $like = '%' . $query . '%'; $params = [$like, $like, $like]; }
$sql .= ' ORDER BY created_at DESC LIMIT 1000';
$stmt = $pdo->prepare($sql); $stmt->execute($params); $results = [];
foreach ($stmt as $row) $results[] = ['attemptId' => (int)$row['id'], 'firstName' => $row['first_name'], 'lastName' => $row['last_name'], 'staticId' => $row['static_id'], 'score' => (int)$row['score'], 'total' => (int)$row['total'], 'percentage' => (int)$row['percentage'], 'createdAt' => date(DATE_ATOM, strtotime($row['created_at']))];
jsonResponse(['results' => $results]);
