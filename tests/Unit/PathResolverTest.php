<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\FileSystem\PathException;
use App\FileSystem\PathResolver;
use PHPUnit\Framework\TestCase;

final class PathResolverTest extends TestCase
{
    private string $root;

    protected function setUp(): void
    {
        $this->root = sys_get_temp_dir() . '/editor-test-' . uniqid();
        mkdir($this->root);
        mkdir($this->root . '/sub');
        file_put_contents($this->root . '/sub/file.txt', 'hallo');
    }

    protected function tearDown(): void
    {
        $this->removeRecursive($this->root);
    }

    public function testResolveExistingReturnsRealPathForFile(): void
    {
        $resolver = new PathResolver($this->root);

        self::assertSame(
            realpath($this->root . '/sub/file.txt'),
            $resolver->resolveExisting('sub/file.txt'),
        );
    }

    public function testResolveExistingReturnsRootForEmptyPath(): void
    {
        $resolver = new PathResolver($this->root);

        self::assertSame($resolver->root(), $resolver->resolveExisting(''));
    }

    public function testResolveExistingThrows404ForMissingPath(): void
    {
        $resolver = new PathResolver($this->root);

        try {
            $resolver->resolveExisting('does/not/exist');
            self::fail('Erwartete PathException wurde nicht geworfen');
        } catch (PathException $e) {
            self::assertSame(404, $e->statusCode());
        }
    }

    public function testResolveExistingRejectsTraversal(): void
    {
        $resolver = new PathResolver($this->root);

        try {
            $resolver->resolveExisting('../../etc/passwd');
            self::fail('Erwartete PathException wurde nicht geworfen');
        } catch (PathException $e) {
            self::assertSame(400, $e->statusCode());
        }
    }

    public function testResolveExistingRejectsSymlinkEscape(): void
    {
        $outside = sys_get_temp_dir() . '/editor-test-outside-' . uniqid();
        mkdir($outside);
        symlink($outside, $this->root . '/escape');

        $resolver = new PathResolver($this->root);

        try {
            $resolver->resolveExisting('escape');
            self::fail('Erwartete PathException wurde nicht geworfen');
        } catch (PathException $e) {
            self::assertSame(400, $e->statusCode());
        } finally {
            rmdir($outside);
        }
    }

    public function testResolveNewReturnsPathInsideExistingParent(): void
    {
        $resolver = new PathResolver($this->root);

        $absolute = $resolver->resolveNew('sub/new-file.txt');

        self::assertSame(realpath($this->root . '/sub') . '/new-file.txt', $absolute);
    }

    public function testResolveNewThrowsIfParentMissing(): void
    {
        $resolver = new PathResolver($this->root);

        try {
            $resolver->resolveNew('missing-dir/new-file.txt');
            self::fail('Erwartete PathException wurde nicht geworfen');
        } catch (PathException $e) {
            self::assertSame(404, $e->statusCode());
        }
    }

    public function testToRelativeRoundTrip(): void
    {
        $resolver = new PathResolver($this->root);
        $absolute = $resolver->resolveExisting('sub/file.txt');

        self::assertSame('sub/file.txt', $resolver->toRelative($absolute));
    }

    private function removeRecursive(string $dir): void
    {
        if (!is_dir($dir)) {
            return;
        }

        foreach (scandir($dir) ?: [] as $name) {
            if ($name === '.' || $name === '..') {
                continue;
            }

            $path = $dir . '/' . $name;

            if (is_link($path)) {
                unlink($path);
            } elseif (is_dir($path)) {
                $this->removeRecursive($path);
            } else {
                unlink($path);
            }
        }

        rmdir($dir);
    }
}
