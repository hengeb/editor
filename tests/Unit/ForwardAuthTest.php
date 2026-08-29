<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Auth\AuthException;
use App\Auth\ForwardAuth;
use App\Config;
use PHPUnit\Framework\TestCase;

final class ForwardAuthTest extends TestCase
{
    public function testThrows401WithoutUserHeader(): void
    {
        $auth = new ForwardAuth(new Config());

        try {
            $auth->authenticate([]);
            self::fail('Erwartete AuthException wurde nicht geworfen');
        } catch (AuthException $e) {
            self::assertSame(401, $e->statusCode());
        }
    }

    public function testAllowsAuthenticatedUserWithoutGroupRestriction(): void
    {
        $auth = new ForwardAuth(new Config());

        $user = $auth->authenticate(['Remote-User' => 'alice']);

        self::assertSame('alice', $user);
    }

    public function testHeaderLookupIsCaseInsensitive(): void
    {
        $auth = new ForwardAuth(new Config());

        $user = $auth->authenticate(['remote-user' => 'alice']);

        self::assertSame('alice', $user);
    }

    public function testThrows403WhenGroupNotAllowed(): void
    {
        $auth = new ForwardAuth(new Config(authAllowedGroup: 'admins'));

        try {
            $auth->authenticate(['Remote-User' => 'alice', 'Remote-Groups' => 'users,editors']);
            self::fail('Erwartete AuthException wurde nicht geworfen');
        } catch (AuthException $e) {
            self::assertSame(403, $e->statusCode());
        }
    }

    public function testAllowsUserInAllowedGroup(): void
    {
        $auth = new ForwardAuth(new Config(authAllowedGroup: 'admins'));

        $user = $auth->authenticate(['Remote-User' => 'alice', 'Remote-Groups' => 'users, admins, editors']);

        self::assertSame('alice', $user);
    }
}
