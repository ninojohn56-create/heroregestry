# =====================================================================
# Global Hero Registration Authority Management System (GHRMS)
# Production Container Image (Alpine Linux + PHP 8.3 CLI/Server)
# =====================================================================

FROM php:8.3-cli-alpine

LABEL maintainer="GHRMS Operations <ops@ghrms.gov>"
LABEL description="Global Hero Registration & Management System Production Container"

# Install production dependencies and build tools for extensions
RUN apk add --no-cache \
    curl \
    libpng-dev \
    libjpeg-turbo-dev \
    libwebp-dev \
    freetype-dev \
    oniguruma-dev \
    libzip-dev \
    openssl \
    openssl-dev \
    tzdata \
    ca-certificates

# Configure and compile PHP core extensions
RUN docker-php-ext-configure gd --with-freetype --with-jpeg --with-webp \
    && docker-php-ext-install -j$(nproc) \
        mbstring \
        curl \
        gd \
        zip \
        fileinfo

# Set up dedicated application working directory
WORKDIR /var/www/html

# Copy custom production php.ini
COPY php.ini /usr/local/etc/php/php.ini

# Copy entire application codebase
COPY . /var/www/html/

# Ensure runtime directories exist with proper permissions
RUN mkdir -p \
        /var/www/html/backend/data/documents \
        /var/www/html/backend/data/ratelimit \
        /var/www/html/frontend/uploads/avatars \
    && chown -R www-data:www-data /var/www/html \
    && chmod -R 775 /var/www/html/backend/data /var/www/html/frontend/uploads

# Declare persistent volumes for stateful data and uploaded assets
VOLUME ["/var/www/html/backend/data", "/var/www/html/frontend/uploads"]

# Expose HTTP port
EXPOSE 8000

# Container health check using diagnostic engine
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD php check_system.php --json >/dev/null 2>&1 || exit 1

# Switch to non-root www-data user
USER www-data

# Default command: launch hardened PHP server via router.php front controller
CMD ["php", "-S", "0.0.0.0:8000", "-t", "/var/www/html", "router.php"]
