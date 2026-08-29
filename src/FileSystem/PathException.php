<?php

declare(strict_types=1);

namespace App\FileSystem;

use App\HttpStatusException;
use RuntimeException;

final class PathException extends RuntimeException implements HttpStatusException
{
    public function __construct(string $message, private readonly int $statusCode)
    {
        parent::__construct($message);
    }

    public function statusCode(): int
    {
        return $this->statusCode;
    }
}
