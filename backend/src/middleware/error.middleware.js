const PRISMA_STATUS = {
    P2002: [409, 'That record already exists.'],
    P2003: [400, 'A related record is missing.'],
    P2025: [404, 'Record not found.'],
};

export const errorHandler = (err, req, res, _next) => {
    const isProd = process.env.NODE_ENV === 'production';
    let statusCode = err.statusCode || err.status || 500;
    let message = err.message || 'Internal Server Error';

    if (err.name === 'MulterError') {
        statusCode = 400;
    } else if (err.code && PRISMA_STATUS[err.code]) {
        [statusCode, message] = PRISMA_STATUS[err.code];
    } else if (err.type === 'entity.parse.failed') {
        statusCode = 400;
        message = 'Malformed JSON body.';
    }

    if (statusCode >= 500) {
        console.error(`[ERROR] ${req.method} ${req.path}:`, err);
        // Internal details (Prisma, provider errors, stack) never leave the server in production.
        if (isProd && !err.expose) message = 'Something went wrong. Please try again.';
    } else if (!isProd) {
        console.error(`[ERROR] ${req.method} ${req.path}:`, err.message);
    }

    res.status(statusCode).json({
        success: false,
        message,
        ...(err.errorCode && { code: err.errorCode }),
        ...(!isProd && { stack: err.stack }),
    });
};
