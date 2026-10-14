<?php
declare(strict_types=1);

require __DIR__ . '/lib.php';

try {
    header('X-Content-Type-Options: nosniff');
    handleRequest($_SERVER['REQUEST_METHOD'] ?? 'GET', requestPath());
} catch (ApiResponse $response) {
    emitResponse($response);
} catch (ApiError $error) {
    emitResponse(errorResponse($error->getMessage(), $error->statusCode));
} catch (Throwable $error) {
    error_log((string) $error);
    emitResponse(errorResponse('Interner Serverfehler.', 500));
}
