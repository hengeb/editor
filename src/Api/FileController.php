<?php

declare(strict_types=1);

namespace App\Api;

use App\FileSystem\FileRepository;

final class FileController
{
    public function __construct(private readonly FileRepository $files)
    {
    }

    /**
     * @param array<string, mixed> $query
     */
    public function get(array $query): ApiResponse
    {
        $path = $this->requireStringQuery($query, 'path');

        return ApiResponse::json($this->files->read($path));
    }

    /**
     * @param array<string, mixed> $body
     */
    public function post(array $body): ApiResponse
    {
        $path = $this->requireStringBody($body, 'path');
        $type = $this->requireStringBody($body, 'type');

        $this->files->create($path, $type);

        return ApiResponse::json(['path' => $path, 'type' => $type], 201);
    }

    /**
     * @param array<string, mixed> $body
     */
    public function put(array $body): ApiResponse
    {
        $path = $this->requireStringBody($body, 'path');

        if (!isset($body['content']) || !is_string($body['content'])) {
            throw new ApiException("Feld 'content' fehlt oder ist ungültig", 400);
        }

        $mtime = null;
        if (array_key_exists('mtime', $body) && $body['mtime'] !== null) {
            if (!is_int($body['mtime'])) {
                throw new ApiException("Feld 'mtime' muss eine Zahl sein", 400);
            }
            $mtime = $body['mtime'];
        }

        $newMtime = $this->files->update($path, $body['content'], $mtime);

        return ApiResponse::json(['path' => $path, 'mtime' => $newMtime]);
    }

    /**
     * @param array<string, mixed> $body
     */
    public function patch(array $body): ApiResponse
    {
        $path = $this->requireStringBody($body, 'path');
        $newPath = $this->requireStringBody($body, 'newPath');

        $resultPath = $this->files->rename($path, $newPath);

        return ApiResponse::json(['path' => $resultPath]);
    }

    /**
     * @param array<string, mixed> $query
     */
    public function delete(array $query): ApiResponse
    {
        $path = $this->requireStringQuery($query, 'path');

        $this->files->delete($path);

        return ApiResponse::json(['deleted' => true]);
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

    /**
     * @param array<string, mixed> $body
     */
    private function requireStringBody(array $body, string $key): string
    {
        if (!isset($body[$key]) || !is_string($body[$key]) || $body[$key] === '') {
            throw new ApiException("Feld '{$key}' fehlt oder ist ungültig", 400);
        }

        return $body[$key];
    }
}
