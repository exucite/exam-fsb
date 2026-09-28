<?php
declare(strict_types=1);

const API_ORIGIN = 'https://exucite.github.io';
const BROWSER_COOKIE = 'fsb_browser';
const ADMIN_COOKIE = 'admin_session';
const COOLDOWN_SECONDS = 3600;
const ADMIN_TTL_SECONDS = 28800;
const MAX_NAME = 50;
const MAX_STATIC_ID = 64;
const MAX_ANSWERS = 500;

date_default_timezone_set('UTC');

$configFile = getenv('FSB_CONFIG_FILE') ?: __DIR__ . '/../backend/config.php';
$config = is_file($configFile) ? require $configFile : [];
$config += [
    'db_dsn' => getenv('DB_DSN') ?: '',
    'db_user' => getenv('DB_USER') ?: '',
    'db_password' => getenv('DB_PASSWORD') ?: '',
    'admin_password_hash' => getenv('ADMIN_PASSWORD_HASH') ?: '',
    'admin_session_secret' => getenv('ADMIN_SESSION_SECRET') ?: '',
    'cookie_domain' => '',
];

function jsonResponse(mixed $data, int $status = 200): never {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($origin === API_ORIGIN) {
    header('Access-Control-Allow-Origin: ' . API_ORIGIN);
    header('Access-Control-Allow-Credentials: true');
    header('Vary: Origin');
}
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
if ($origin !== '' && $origin !== API_ORIGIN) jsonResponse(['error' => 'Origin запрещён'], 403);

try {
    $pdo = new PDO((string)$config['db_dsn'], (string)$config['db_user'], (string)$config['db_password'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
} catch (Throwable $e) {
    error_log($e->getMessage());
    jsonResponse(['error' => 'Сервис временно недоступен'], 503);
}

function requireMethod(string $method): void {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== $method) jsonResponse(['error' => 'Метод не поддерживается'], 405);
}

function inputJson(): array {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw ?: '', true);
    if (!is_array($data)) jsonResponse(['error' => 'Тело запроса должно быть корректным JSON'], 400);
    return $data;
}

function cleanText(mixed $value, int $max, string $message): string {
    if (!is_string($value)) jsonResponse(['error' => $message], 400);
    $value = trim((string)preg_replace('/[\x00-\x1F\x7F]+/u', ' ', $value));
    $value = (string)preg_replace('/\s+/u', ' ', $value);
    if ($value === '' || mb_strlen($value) > $max) jsonResponse(['error' => $message], 400);
    return $value;
}

function browserId(): string {
    if (!empty($_COOKIE[BROWSER_COOKIE]) && preg_match('/^[a-f0-9]{64}$/', $_COOKIE[BROWSER_COOKIE])) return $_COOKIE[BROWSER_COOKIE];
    $id = bin2hex(random_bytes(32));
    setcookie(BROWSER_COOKIE, $id, cookieOptions(time() + 365 * 86400));
    return $id;
}

function cookieOptions(int $expires): array {
    global $config;
    return ['expires' => $expires, 'path' => '/', 'domain' => (string)$config['cookie_domain'], 'secure' => true, 'httponly' => true, 'samesite' => 'None'];
}

function cooldownRemaining(PDO $pdo, string $staticId, string $browserId): int {
    $stmt = $pdo->prepare('SELECT submitted_at FROM attempts WHERE static_id = ? AND browser_id = ? ORDER BY submitted_at DESC LIMIT 1');
    $stmt->execute([$staticId, $browserId]);
    $last = $stmt->fetchColumn();
    if (!$last) return 0;
    $reset = $pdo->prepare('SELECT created_at FROM cooldown_resets WHERE static_id = ? ORDER BY created_at DESC LIMIT 1');
    $reset->execute([$staticId]);
    $resetAt = $reset->fetchColumn();
    if ($resetAt && strtotime((string)$resetAt) > strtotime((string)$last)) return 0;
    return max(0, COOLDOWN_SECONDS * 1000 - (int)((microtime(true) - strtotime((string)$last)) * 1000));
}

function remainingMessage(int $ms): string {
    $minutes = (int)ceil($ms / 60000);
    if ($minutes >= 60) return intdiv($minutes, 60) . ' ч' . ($minutes % 60 ? ' ' . ($minutes % 60) . ' мин' : '');
    return $minutes . ' мин';
}

function sessionToken(): string {
    global $config;
    $parts = explode('.', (string)($_COOKIE[ADMIN_COOKIE] ?? ''), 3);
    if (count($parts) !== 3 || $parts[0] !== 'v1' || !ctype_digit($parts[1]) || (int)$parts[1] <= time()) return '';
    $expected = hash_hmac('sha256', $parts[0] . '.' . $parts[1], (string)$config['admin_session_secret'], true);
    $provided = base64_decode(strtr($parts[2], '-_', '+/') . str_repeat('=', (4 - strlen($parts[2]) % 4) % 4), true);
    return $provided !== false && hash_equals($expected, $provided) ? (string)$_COOKIE[ADMIN_COOKIE] : '';
}

function requireAdmin(): void { if (sessionToken() === '') jsonResponse(['error' => 'Требуется авторизация'], 401); }

function newSessionToken(): string {
    global $config;
    $expires = time() + ADMIN_TTL_SECONDS;
    $payload = 'v1.' . $expires;
    $sig = hash_hmac('sha256', $payload, (string)$config['admin_session_secret'], true);
    return $payload . '.' . rtrim(strtr(base64_encode($sig), '+/', '-_'), '=');
}

function csvCell(mixed $value): string { return '"' . str_replace('"', '""', (string)$value) . '"'; }
