<?php

declare(strict_types=1);

namespace App\Api;

use App\FileSystem\FileRepository;

final class TreeController
{
    public function __construct(private readonly FileRepository $files)
    {
    }

    /**
     * @param array<string, mixed> $query
     */
    public function get(array $query): ApiResponse
    {
        $path = isset($query['path']) && is_string($query['path']) ? $query['path'] : '';
        $depth = isset($query['depth']) ? max(1, min(5, (int) $query['depth'])) : 2;

        $entries = $this->files->tree($path, $depth);

        return ApiResponse::json(['path' => $path, 'entries' => $entries]);
    }
}
