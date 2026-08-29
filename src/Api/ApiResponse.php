<?php

declare(strict_types=1);

namespace App\Api;

final class ApiResponse
{
    private function __construct(
        public readonly int $status,
        public readonly mixed $data,
    ) {
    }

    public static function json(mixed $data, int $status = 200): self
    {
        return new self($status, $data);
    }
}
