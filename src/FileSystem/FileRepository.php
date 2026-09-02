<?php

declare(strict_types=1);

namespace App\FileSystem;

final class FileRepository
{
    public function __construct(private readonly PathResolver $paths)
    {
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function tree(string $relativePath, int $depth): array
    {
        $absolute = $relativePath === '' ? $this->paths->root() : $this->paths->resolveExisting($relativePath);

        if (!is_dir($absolute)) {
            throw new PathException('Kein Verzeichnis', 400);
        }

        return $this->listDir($absolute, max(1, $depth));
    }

    /**
     * @return array<string, mixed>
     */
    public function read(string $relativePath): array
    {
        $absolute = $this->paths->resolveExisting($relativePath);

        if (is_dir($absolute)) {
            throw new PathException('Ist ein Verzeichnis', 400);
        }

        $raw = file_get_contents($absolute);
        if ($raw === false) {
            throw new PathException('Datei konnte nicht gelesen werden', 500);
        }

        $stat = stat($absolute);

        $result = [
            'path' => $this->paths->toRelative($absolute),
            'mtime' => $stat['mtime'],
            'size' => $stat['size'],
        ];

        if (mb_check_encoding($raw, 'UTF-8')) {
            $result['content'] = $raw;
        } else {
            $result['binary'] = true;
        }

        return $result;
    }

    /**
     * @return array{0: string, 1: string} [Inhalt, MIME-Type]
     */
    public function readRaw(string $relativePath): array
    {
        $absolute = $this->paths->resolveExisting($relativePath);

        if (is_dir($absolute)) {
            throw new PathException('Ist ein Verzeichnis', 400);
        }

        $content = file_get_contents($absolute);
        if ($content === false) {
            throw new PathException('Datei konnte nicht gelesen werden', 500);
        }

        $finfo = finfo_open(FILEINFO_MIME_TYPE);
        $mimeType = ($finfo !== false ? finfo_file($finfo, $absolute) : false) ?: 'application/octet-stream';

        return [$content, $mimeType];
    }

    /**
     * Legt eine Datei an oder überschreibt sie, falls sie bereits existiert
     * (im Gegensatz zu create()). Für Datei-Uploads per Drag & Drop.
     */
    public function upload(string $relativePath, string $content): int
    {
        $absolute = $this->paths->resolveNew($relativePath);

        if (is_dir($absolute)) {
            throw new PathException('Ist ein Verzeichnis', 400);
        }

        if (file_put_contents($absolute, $content) === false) {
            throw new PathException('Datei konnte nicht hochgeladen werden', 500);
        }

        clearstatcache(true, $absolute);
        $mtime = filemtime($absolute);

        return $mtime !== false ? $mtime : time();
    }

    public function create(string $relativePath, string $type): void
    {
        if ($type !== 'file' && $type !== 'dir') {
            throw new PathException('Ungültiger Typ', 400);
        }

        $absolute = $this->paths->resolveNew($relativePath);

        if (file_exists($absolute) || is_link($absolute)) {
            throw new PathException('Ziel existiert bereits', 409);
        }

        if ($type === 'dir') {
            if (!mkdir($absolute)) {
                throw new PathException('Verzeichnis konnte nicht angelegt werden', 500);
            }
        } elseif (file_put_contents($absolute, '') === false) {
            throw new PathException('Datei konnte nicht angelegt werden', 500);
        }
    }

    public function update(string $relativePath, string $content, ?int $expectedMtime): int
    {
        $absolute = $this->paths->resolveExisting($relativePath);

        if (is_dir($absolute)) {
            throw new PathException('Ist ein Verzeichnis', 400);
        }

        if ($expectedMtime !== null) {
            $current = filemtime($absolute);
            if ($current !== false && $current !== $expectedMtime) {
                throw new PathException('Datei wurde zwischenzeitlich geändert', 409);
            }
        }

        if (file_put_contents($absolute, $content) === false) {
            throw new PathException('Datei konnte nicht gespeichert werden', 500);
        }

        clearstatcache(true, $absolute);
        $mtime = filemtime($absolute);

        return $mtime !== false ? $mtime : time();
    }

    public function rename(string $relativePath, string $newRelativePath): string
    {
        if ($relativePath === '') {
            throw new PathException('Wurzelverzeichnis kann nicht umbenannt werden', 400);
        }

        $absolute = $this->paths->resolveExisting($relativePath);
        $newAbsolute = $this->paths->resolveNew($newRelativePath);

        if (file_exists($newAbsolute) || is_link($newAbsolute)) {
            throw new PathException('Ziel existiert bereits', 409);
        }

        if (!rename($absolute, $newAbsolute)) {
            throw new PathException('Umbenennen fehlgeschlagen', 500);
        }

        $real = realpath($newAbsolute);

        return $this->paths->toRelative($real !== false ? $real : $newAbsolute);
    }

    public function delete(string $relativePath): void
    {
        if ($relativePath === '') {
            throw new PathException('Wurzelverzeichnis kann nicht gelöscht werden', 400);
        }

        $absolute = $this->paths->resolveExisting($relativePath);

        if (is_dir($absolute)) {
            $this->deleteDirRecursive($absolute);
        } elseif (!unlink($absolute)) {
            throw new PathException('Löschen fehlgeschlagen', 500);
        }
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function listDir(string $absoluteDir, int $depth): array
    {
        $names = scandir($absoluteDir);
        if ($names === false) {
            throw new PathException('Verzeichnis konnte nicht gelesen werden', 500);
        }

        $dirs = [];
        $files = [];

        foreach ($names as $name) {
            if ($name === '.' || $name === '..') {
                continue;
            }

            $absoluteChild = $absoluteDir . '/' . $name;
            $real = realpath($absoluteChild);

            if ($real === false || !$this->paths->isWithinRoot($real)) {
                continue;
            }

            if (is_dir($real)) {
                $dirs[$name] = $real;
            } else {
                $files[$name] = $real;
            }
        }

        ksort($dirs, SORT_NATURAL | SORT_FLAG_CASE);
        ksort($files, SORT_NATURAL | SORT_FLAG_CASE);

        $entries = [];

        foreach ($dirs as $name => $real) {
            $entries[] = [
                'name' => $name,
                'path' => $this->paths->toRelative($real),
                'type' => 'dir',
                'children' => $depth > 1 ? $this->listDir($real, $depth - 1) : null,
            ];
        }

        foreach ($files as $name => $real) {
            $ext = pathinfo($name, PATHINFO_EXTENSION);

            $entries[] = [
                'name' => $name,
                'path' => $this->paths->toRelative($real),
                'type' => 'file',
                'ext' => $ext !== '' ? strtolower($ext) : null,
            ];
        }

        return $entries;
    }

    private function deleteDirRecursive(string $dir): void
    {
        $names = scandir($dir);
        if ($names === false) {
            throw new PathException('Verzeichnis konnte nicht gelesen werden', 500);
        }

        foreach ($names as $name) {
            if ($name === '.' || $name === '..') {
                continue;
            }

            $path = $dir . '/' . $name;

            if (is_dir($path) && !is_link($path)) {
                $this->deleteDirRecursive($path);
            } elseif (!unlink($path)) {
                throw new PathException('Löschen fehlgeschlagen', 500);
            }
        }

        if (!rmdir($dir)) {
            throw new PathException('Löschen fehlgeschlagen', 500);
        }
    }
}
