#!/bin/sh
set -e

PUID="${PUID:-1000}"
PGID="${PGID:-1000}"

groupmod -o -g "$PGID" www-data
usermod -o -u "$PUID" www-data

chown -R www-data:www-data /var/www/html

exec "$@"
