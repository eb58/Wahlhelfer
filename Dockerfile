# Nur Apache und PHP. Frontend (dist/, per npm run watch) und API (server/) kommen per
# Bind-Mount aus dem Projekt, siehe compose.yaml und server/apache-docker.conf.
FROM php:8.4-apache
RUN docker-php-ext-install pdo_mysql \
    && a2enmod rewrite headers \
    && a2dismod -f autoindex \
    && mkdir -p /data/bilder && chown www-data:www-data /data/bilder
COPY server/apache-docker.conf /etc/apache2/sites-available/000-default.conf
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD php -r "exit(@file_get_contents('http://127.0.0.1/php-api/index.php/health') === false ? 1 : 0);"
