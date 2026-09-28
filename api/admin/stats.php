<?php
require dirname(__DIR__) . '/bootstrap.php';
requireMethod('GET');
requireAdmin();
$now = new DateTimeImmutable('now', new DateTimeZone('UTC'));
$startToday = $now->setTime(0, 0); $startWeek = $startToday->modify('-6 days'); $startMonth = $startToday->modify('-29 days'); $start24 = $now->modify('-24 hours');
$count = function (string $from) use ($pdo): int { $s = $pdo->prepare('SELECT COUNT(*) FROM attempts WHERE submitted_at >= ?'); $s->execute([$from]); return (int)$s->fetchColumn(); };
$todayCount = $count($startToday->format('Y-m-d H:i:s.v')); $weekCount = $count($startWeek->format('Y-m-d H:i:s.v')); $monthCount = $count($startMonth->format('Y-m-d H:i:s.v'));
$totalCount = (int)$pdo->query('SELECT COUNT(*) FROM attempts')->fetchColumn();
$uniqueParticipants = (int)$pdo->query('SELECT COUNT(DISTINCT static_id) FROM attempts')->fetchColumn();
$avg = (float)$pdo->query('SELECT COALESCE(AVG(percentage),0) FROM attempts')->fetchColumn();
$s = $pdo->prepare('SELECT submitted_at, percentage FROM attempts WHERE submitted_at >= ? ORDER BY submitted_at'); $s->execute([$start24->format('Y-m-d H:i:s.v')]); $buckets = [];
for ($i = 23; $i >= 0; $i--) { $hour = $now->modify('-' . $i . ' hours')->setTime((int)$now->modify('-' . $i . ' hours')->format('H'), 0); $buckets[$hour->format('Y-m-d H')] = ['count' => 0, 'sum' => 0]; }
foreach ($s as $row) { $key = date('Y-m-d H', strtotime($row['submitted_at'])); if (isset($buckets[$key])) { $buckets[$key]['count']++; $buckets[$key]['sum'] += (int)$row['percentage']; } }
$last24h = []; foreach ($buckets as $date => $bucket) $last24h[] = ['date' => $date, 'count' => $bucket['count'], 'avgPercentage' => $bucket['count'] ? (int)round($bucket['sum'] / $bucket['count']) : 0];
jsonResponse(['todayCount' => $todayCount, 'weekCount' => $weekCount, 'monthCount' => $monthCount, 'totalCount' => $totalCount, 'uniqueParticipants' => $uniqueParticipants, 'avgPercentage' => (int)round($avg), 'last24h' => $last24h]);
