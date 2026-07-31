import jwt from 'jsonwebtoken';

export const signAccessToken = (userId) =>
    jwt.sign({ sub: userId }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    });

export const signRefreshToken = (userId) =>
    jwt.sign({ sub: userId }, process.env.JWT_REFRESH_SECRET, {
        expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    });

/**
 * The site and the API live on different domains in production, so the auth
 * cookies must be SameSite=None (which browsers only accept with Secure).
 * With SameSite=Strict the refresh cookie is never sent and every expired
 * access token turns into a forced logout.
 */
const cookieOptions = () => {
    const isProd = process.env.NODE_ENV === 'production';
    const sameSite = (process.env.COOKIE_SAMESITE || (isProd ? 'none' : 'lax')).toLowerCase();
    return {
        httpOnly: true,
        // SameSite=None is rejected by browsers unless the cookie is Secure.
        secure: isProd || sameSite === 'none',
        sameSite,
        path: '/',
    };
};

export const setCookies = (res, accessToken, refreshToken) => {
    const base = cookieOptions();

    res.cookie('access_token', accessToken, {
        ...base,
        maxAge: 15 * 60 * 1000, // 15 min
    });

    res.cookie('refresh_token', refreshToken, {
        ...base,
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });
};

export const clearCookies = (res) => {
    // Options must match the ones used to set them or the cookies survive.
    const base = cookieOptions();
    res.clearCookie('access_token', base);
    res.clearCookie('refresh_token', base);
};
