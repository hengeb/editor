FROM node:22-alpine AS frontend-build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ .
RUN npm run build

FROM php:8.5-fpm-alpine

RUN apk add --no-cache nginx supervisor shadow \
    && mkdir -p /run/nginx /files

WORKDIR /var/www/html

COPY composer.json composer.lock ./
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer
RUN composer install --no-interaction --no-progress --no-scripts --no-autoloader

COPY src/ src/
COPY public/ public/
COPY tests/ tests/
COPY phpunit.xml phpunit.xml
COPY --from=frontend-build /app/dist/bundle.js public/assets/js/bundle.js
COPY --from=frontend-build /app/dist/bundle.js.map public/assets/js/bundle.js.map

RUN composer dump-autoload --no-interaction --optimize

COPY docker/nginx.conf /etc/nginx/http.d/default.conf
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY docker/php.ini /usr/local/etc/php/conf.d/99-custom.ini
COPY docker/php-fpm-pool.conf /usr/local/etc/php-fpm.d/zzz-app.conf
COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80

ENTRYPOINT ["/entrypoint.sh"]
CMD ["supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
