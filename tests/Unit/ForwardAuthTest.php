<?php

declare(strict_types=1);

namespace App\Tests\Unit;

use App\Auth\AuthException;
use App\Auth\ForwardAuth;
use App\Config;
use PHPUnit\Framework\TestCase;

final class ForwardAuthTest extends TestCase
{
    public function testAllowsAccessWithoutAnyHeadersWhenNoGroupRestriction(): void
    {
        $auth = new ForwardAuth(new Config());

        $auth->authenticate([]);

        $this->expectNotToPerformAssertions();
    }

    public function testThrows403WhenGroupNotAllowed(): void
    {
        $auth = new ForwardAuth(new Config(authAllowedGroup: 'admins'));

        try {
            $auth->authenticate(['Remote-Groups' => 'users,editors']);
            self::fail('Erwartete AuthException wurde nicht geworfen');
        } catch (AuthException $e) {
            self::assertSame(403, $e->statusCode());
        }
    }

    public function testThrows403WhenGroupsHeaderMissingButGroupRequired(): void
    {
        $auth = new ForwardAuth(new Config(authAllowedGroup: 'admins'));

        try {
            $auth->authenticate([]);
            self::fail('Erwartete AuthException wurde nicht geworfen');
        } catch (AuthException $e) {
            self::assertSame(403, $e->statusCode());
        }
    }

    public function testAllowsUserInAllowedGroup(): void
    {
        $auth = new ForwardAuth(new Config(authAllowedGroup: 'admins'));

        $auth->authenticate(['Remote-Groups' => 'users, admins, editors']);

        $this->expectNotToPerformAssertions();
    }

    public function testGroupsHeaderLookupIsCaseInsensitive(): void
    {
        $auth = new ForwardAuth(new Config(authAllowedGroup: 'admins'));

        $auth->authenticate(['remote-groups' => 'admins']);

        $this->expectNotToPerformAssertions();
    }
}
