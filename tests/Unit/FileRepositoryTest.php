<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\FileSystem\FileRepository;
use App\FileSystem\PathException;
use App\FileSystem\PathResolver;
use PHPUnit\Framework\TestCase;

final class FileRepositoryTest extends TestCase
{
    private string $root;
    private FileRepository $files;

    protected function setUp(): void
    {
        $this->root = sys_get_temp_dir() . '/editor-test-' . uniqid();
        mkdir($this->root);
        $this->files = new FileRepository(new PathResolver($this->root));
    }

    protected function tearDown(): void
    {
        $this->removeRecursive($this->root);
    }

    public function testTreeListsDirsBeforeFilesAlphabetically(): void
    {
        mkdir($this->root . '/b-dir');
        mkdir($this->root . '/a-dir');
        file_put_contents($this->root . '/z-file.txt', '');
        file_put_contents($this->root . '/y-file.txt', '');

        $entries = $this->files->tree('', 1);

        self::assertSame(
            ['a-dir', 'b-dir', 'y-file.txt', 'z-file.txt'],
            array_column($entries, 'name'),
        );
        self::assertSame(['dir', 'dir', 'file', 'file'], array_column($entries, 'type'));
    }

    public function testTreePreloadsChildrenUpToDepth(): void
    {
        mkdir($this->root . '/a');
        mkdir($this->root . '/a/b');
        file_put_contents($this->root . '/a/b/file.txt', '');

        $entries = $this->files->tree('', 2);

        self::assertSame('a', $entries[0]['name']);
        self::assertIsArray($entries[0]['children']);
        self::assertSame('b', $entries[0]['children'][0]['name']);
        // depth=2 heißt: Kinder von 'a' sind geladen, aber deren Kinder ('b's Inhalt) noch nicht
        self::assertNull($entries[0]['children'][0]['children']);
    }

    public function testTreeFiltersOutSymlinkEscapes(): void
    {
        $outside = sys_get_temp_dir() . '/editor-test-outside-' . uniqid();
        mkdir($outside);
        symlink($outside, $this->root . '/escape');

        $entries = $this->files->tree('', 1);

        self::assertSame([], $entries);

        rmdir($outside);
    }

    public function testReadReturnsContentForTextFile(): void
    {
        file_put_contents($this->root . '/file.txt', 'hällo');

        $result = $this->files->read('file.txt');

        self::assertSame('hällo', $result['content']);
        self::assertArrayNotHasKey('binary', $result);
    }

    public function testReadFlagsInvalidUtf8AsBinary(): void
    {
        file_put_contents($this->root . '/file.bin', "\xFF\xFE\x00\x01");

        $result = $this->files->read('file.bin');

        self::assertTrue($result['binary']);
        self::assertArrayNotHasKey('content', $result);
    }

    public function testCreateFileAndDir(): void
    {
        $this->files->create('new-file.txt', 'file');
        $this->files->create('new-dir', 'dir');

        self::assertFileExists($this->root . '/new-file.txt');
        self::assertDirectoryExists($this->root . '/new-dir');
    }

    public function testCreateThrows409IfTargetExists(): void
    {
        file_put_contents($this->root . '/exists.txt', '');

        try {
            $this->files->create('exists.txt', 'file');
            self::fail('Erwartete PathException wurde nicht geworfen');
        } catch (PathException $e) {
            self::assertSame(409, $e->statusCode());
        }
    }

    public function testUpdateSavesContentAndReturnsMtime(): void
    {
        file_put_contents($this->root . '/file.txt', 'alt');

        $mtime = $this->files->update('file.txt', 'neu', null);

        self::assertSame('neu', file_get_contents($this->root . '/file.txt'));
        self::assertIsInt($mtime);
    }

    public function testUpdateThrows409OnMtimeConflict(): void
    {
        file_put_contents($this->root . '/file.txt', 'alt');
        $actualMtime = filemtime($this->root . '/file.txt');

        try {
            $this->files->update('file.txt', 'neu', $actualMtime - 1000);
            self::fail('Erwartete PathException wurde nicht geworfen');
        } catch (PathException $e) {
            self::assertSame(409, $e->statusCode());
        }
    }

    public function testRenameMovesFile(): void
    {
        file_put_contents($this->root . '/old.txt', 'inhalt');

        $newPath = $this->files->rename('old.txt', 'new.txt');

        self::assertSame('new.txt', $newPath);
        self::assertFileDoesNotExist($this->root . '/old.txt');
        self::assertSame('inhalt', file_get_contents($this->root . '/new.txt'));
    }

    public function testRenameThrows409IfTargetExists(): void
    {
        file_put_contents($this->root . '/a.txt', '');
        file_put_contents($this->root . '/b.txt', '');

        try {
            $this->files->rename('a.txt', 'b.txt');
            self::fail('Erwartete PathException wurde nicht geworfen');
        } catch (PathException $e) {
            self::assertSame(409, $e->statusCode());
        }
    }

    public function testRenameRootIsRejected(): void
    {
        try {
            $this->files->rename('', 'new-root');
            self::fail('Erwartete PathException wurde nicht geworfen');
        } catch (PathException $e) {
            self::assertSame(400, $e->statusCode());
        }
    }

    public function testDeleteRemovesFile(): void
    {
        file_put_contents($this->root . '/file.txt', '');

        $this->files->delete('file.txt');

        self::assertFileDoesNotExist($this->root . '/file.txt');
    }

    public function testDeleteRemovesDirRecursively(): void
    {
        mkdir($this->root . '/dir');
        mkdir($this->root . '/dir/sub');
        file_put_contents($this->root . '/dir/sub/file.txt', '');

        $this->files->delete('dir');

        self::assertDirectoryDoesNotExist($this->root . '/dir');
    }

    public function testDeleteRootIsRejected(): void
    {
        try {
            $this->files->delete('');
            self::fail('Erwartete PathException wurde nicht geworfen');
        } catch (PathException $e) {
            self::assertSame(400, $e->statusCode());
        }
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
