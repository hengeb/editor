<?php

declare(strict_types=1);

namespace App;

final class Config
{
    public const ROOT_DIR = '/files';

    public function __construct(
        public readonly string $authUserHeader = 'Remote-User',
        public readonly string $authGroupsHeader = 'Remote-Groups',
        public readonly string $authAllowedGroup = '',
    ) {
    }

    public static function fromEnv(): self
    {
        return new self(
            authUserHeader: self::env('AUTH_USER_HEADER', 'Remote-User'),
            authGroupsHeader: self::env('AUTH_GROUPS_HEADER', 'Remote-Groups'),
            authAllowedGroup: self::env('AUTH_ALLOWED_GROUP', ''),
        );
    }

    private static function env(string $name, string $default): string
    {
        $value = getenv($name);

        return $value === false || $value === '' ? $default : $value;
    }
}
