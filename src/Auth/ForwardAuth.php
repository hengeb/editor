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
     * Authentifizierung selbst übernimmt die Traefik-forwardauth-Middleware;
     * hier wird nur optional geprüft, ob der Nutzer einer erlaubten Gruppe
     * angehört (falls AUTH_ALLOWED_GROUP konfiguriert ist).
     *
     * @param array<string, string> $headers Header-Name => Wert (case-insensitive Lookup wird intern erledigt)
     *
     * @throws AuthException falls die Gruppenprüfung fehlschlägt
     */
    public function authenticate(array $headers): void
    {
        if ($this->config->authAllowedGroup === '') {
            return;
        }

        $groupsHeader = $this->header($headers, $this->config->authGroupsHeader) ?? '';
        $groups = array_map('trim', explode(',', $groupsHeader));

        if (!in_array($this->config->authAllowedGroup, $groups, true)) {
            throw new AuthException('Kein Zugriff für diese Gruppe', 403);
        }
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
