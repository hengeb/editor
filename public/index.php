<?php

declare(strict_types=1);

require __DIR__ . '/../vendor/autoload.php';

use App\Api\FileController;
use App\Api\Router;
use App\Api\TreeController;
use App\Api\UploadController;
use App\Auth\AuthException;
use App\Auth\ForwardAuth;
use App\Config;
use App\FileSystem\FileRepository;
use App\FileSystem\PathResolver;
use App\HttpStatusException;

function respond(int $status, mixed $data): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
}

// Alle API-Antworten sind dynamisch (Dateiinhalte ändern sich, Security-Header
// wie X-Frame-Options sollen nicht aus einem alten Cache-Eintrag nachwirken -
// das führte z.B. dazu, dass Firefox einen /api/raw-Request für eine
// PDF-Vorschau gar nicht erst losschickte, weil er den früheren
// X-Frame-Options: DENY einer gecachten Antwort weiterverwendete).
header('Cache-Control: no-store');

/** @var array<string, string> $headers */
$headers = [];
foreach ($_SERVER as $key => $value) {
    if (str_starts_with($key, 'HTTP_') && is_string($value)) {
        $headers[str_replace('_', '-', substr($key, 5))] = $value;
    }
}

$config = Config::fromEnv();

try {
    (new ForwardAuth($config))->authenticate($headers);
} catch (AuthException $e) {
    respond($e->statusCode(), ['error' => $e->getMessage()]);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if (in_array($method, ['POST', 'PUT', 'PATCH', 'DELETE'], true)) {
    if (($headers['X-REQUESTED-WITH'] ?? '') !== 'XMLHttpRequest') {
        respond(400, ['error' => "Fehlender oder falscher 'X-Requested-With'-Header"]);
        exit;
    }
}

$path = (string) (parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?? '/');
$resource = preg_replace('#^/api/#', '', $path, 1) ?? $path;

parse_str($_SERVER['QUERY_STRING'] ?? '', $query);

$body = null;
$rawBody = null;

if (trim($resource, '/') === 'upload' && $method === 'PUT') {
    $rawBody = file_get_contents('php://input');
    $rawBody = $rawBody === false ? '' : $rawBody;
} elseif (in_array($method, ['POST', 'PUT', 'PATCH'], true)) {
    $raw = file_get_contents('php://input');
    $decoded = $raw === '' || $raw === false ? [] : json_decode($raw, true);

    if (!is_array($decoded)) {
        respond(400, ['error' => 'Ungültiges JSON']);
        exit;
    }

    $body = $decoded;
}

$paths = new PathResolver(Config::ROOT_DIR);
$files = new FileRepository($paths);
$router = new Router(new TreeController($files), new FileController($files), new UploadController($files));

try {
    $response = $router->dispatch($method, $resource, $query, $body, $rawBody);

    if ($response->rawBody !== null) {
        http_response_code($response->status);
        header('Content-Type: ' . $response->rawContentType);
        echo $response->rawBody;
    } else {
        respond($response->status, $response->data);
    }
} catch (HttpStatusException $e) {
    respond($e->statusCode(), ['error' => $e->getMessage()]);
} catch (\Throwable) {
    respond(500, ['error' => 'Interner Serverfehler']);
}
