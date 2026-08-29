<?php

declare(strict_types=1);

namespace App\Auth;

use App\Config;

final class ForwardAuth
{
    public function __construct(private readonly Config $config)
    {
    }

    /**
     * @param array<string, string> $headers Header-Name => Wert (case-insensitive Lookup wird intern erledigt)
     *
     * @throws AuthException falls der Zugriff verweigert werden muss
     */
    public function authenticate(array $headers): string
    {
        $user = $this->header($headers, $this->config->authUserHeader);

        if ($user === null || $user === '') {
            throw new AuthException('Nicht authentifiziert', 401);
        }

        if ($this->config->authAllowedGroup !== '') {
            $groupsHeader = $this->header($headers, $this->config->authGroupsHeader) ?? '';
            $groups = array_map('trim', explode(',', $groupsHeader));

            if (!in_array($this->config->authAllowedGroup, $groups, true)) {
                throw new AuthException('Kein Zugriff für diese Gruppe', 403);
            }
        }

        return $user;
    }

    /**
     * @param array<string, string> $headers
     */
    private function header(array $headers, string $name): ?string
    {
        foreach ($headers as $key => $value) {
            if (strcasecmp($key, $name) === 0) {
                return $value;
            }
        }

        return null;
    }
}
