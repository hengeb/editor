<?php

declare(strict_types=1);

namespace App\Api;

final class Router
{
    public function __construct(
        private readonly TreeController $tree,
        private readonly FileController $file,
        private readonly UploadController $upload,
    ) {
    }

    /**
     * @param array<string, mixed> $query
     * @param array<string, mixed>|null $body
     */
    public function dispatch(string $method, string $resource, array $query, ?array $body, ?string $rawBody = null): ApiResponse
    {
        $method = strtoupper($method);
        $resource = trim($resource, '/');

        return match (true) {
            $resource === 'tree' && $method === 'GET' => $this->tree->get($query),
            $resource === 'file' && $method === 'GET' => $this->file->get($query),
            $resource === 'file' && $method === 'POST' => $this->file->post($body ?? []),
            $resource === 'file' && $method === 'PUT' => $this->file->put($body ?? []),
            $resource === 'file' && $method === 'PATCH' => $this->file->patch($body ?? []),
            $resource === 'file' && $method === 'DELETE' => $this->file->delete($query),
            $resource === 'raw' && $method === 'GET' => $this->file->getRaw($query),
            $resource === 'upload' && $method === 'PUT' => $this->upload->put($query, $rawBody ?? ''),
            default => throw new ApiException('Nicht gefunden', 404),
        };
    }
}
