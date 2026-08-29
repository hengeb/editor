<?php

declare(strict_types=1);

namespace App;

interface HttpStatusException extends \Throwable
{
    public function statusCode(): int;
}
