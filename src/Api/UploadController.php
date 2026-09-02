<?php

declare(strict_types=1);

namespace App\Api;

use App\FileSystem\FileRepository;

final class UploadController
{
    public function __construct(private readonly FileRepository $files)
    {
    }

    /**
     * @param array<string, mixed> $query
     */
    public function put(array $query, string $rawBody): ApiResponse
    {
        $path = $this->requireStringQuery($query, 'path');

        $mtime = $this->files->upload($path, $rawBody);

        return ApiResponse::json(['path' => $path, 'mtime' => $mtime]);
    }

    /**
     * @param array<string, mixed> $query
     */
    private function requireStringQuery(array $query, string $key): string
    {
        if (!isset($query[$key]) || !is_string($query[$key])) {
            throw new ApiException("Parameter '{$key}' fehlt", 400);
        }

        return $query[$key];
    }
}
