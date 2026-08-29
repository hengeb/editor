<?php

declare(strict_types=1);

namespace App\FileSystem;

final class PathResolver
{
    private readonly string $root;

    public function __construct(string $root)
    {
        $real = realpath($root);
        $this->root = rtrim($real !== false ? $real : $root, '/');
    }

    public function root(): string
    {
        return $this->root;
    }

    /**
     * Löst einen relativen Pfad auf, der bereits existieren muss (Datei oder Verzeichnis).
     */
    public function resolveExisting(string $relativePath): string
    {
        $normalized = $this->normalizeRelative($relativePath);
        $absolute = $normalized === '' ? $this->root : $this->root . '/' . $normalized;

        $real = realpath($absolute);
        if ($real === false) {
            throw new PathException('Pfad nicht gefunden', 404);
        }

        if (!$this->isWithinRoot($real)) {
            throw new PathException('Zugriff außerhalb des Wurzelverzeichnisses', 400);
        }

        return $real;
    }

    /**
     * Löst einen relativen Pfad auf, dessen Ziel noch nicht existieren muss (z. B. für Create/Rename).
     * Das übergeordnete Verzeichnis muss existieren und innerhalb der Wurzel liegen.
     */
    public function resolveNew(string $relativePath): string
    {
        $normalized = $this->normalizeRelative($relativePath);
        if ($normalized === '') {
            throw new PathException('Ungültiger Pfad', 400);
        }

        $parentRelative = dirname($normalized);
        $name = basename($normalized);

        if ($name === '' || $name === '.' || $name === '..') {
            throw new PathException('Ungültiger Dateiname', 400);
        }

        $parentAbsolute = $parentRelative === '.' ? $this->root : $this->resolveExisting($parentRelative);

        if (!is_dir($parentAbsolute)) {
            throw new PathException('Übergeordnetes Verzeichnis existiert nicht', 404);
        }

        return $parentAbsolute . '/' . $name;
    }

    public function toRelative(string $absolute): string
    {
        if ($absolute === $this->root) {
            return '';
        }

        return ltrim(substr($absolute, strlen($this->root)), '/');
    }

    public function isWithinRoot(string $real): bool
    {
        return $real === $this->root || str_starts_with($real, $this->root . '/');
    }

    private function normalizeRelative(string $relativePath): string
    {
        $relativePath = str_replace('\\', '/', $relativePath);
        $relativePath = trim($relativePath, '/');

        $segments = array_filter(
            explode('/', $relativePath),
            static fn (string $segment): bool => $segment !== '' && $segment !== '.',
        );

        foreach ($segments as $segment) {
            if ($segment === '..') {
                throw new PathException('Ungültiger Pfad', 400);
            }
        }

        return implode('/', $segments);
    }
}
