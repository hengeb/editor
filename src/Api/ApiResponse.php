<?php

declare(strict_types=1);

namespace App\Api;

final class ApiResponse
{
    private function __construct(
        public readonly int $status,
        public readonly mixed $data,
        public readonly ?string $rawBody = null,
        public readonly ?string $rawContentType = null,
    ) {
    }

    public static function json(mixed $data, int $status = 200): self
    {
        return new self($status, $data);
    }

    public static function raw(string $body, string $contentType, int $status = 200): self
    {
        return new self($status, null, $body, $contentType);
    }
}
