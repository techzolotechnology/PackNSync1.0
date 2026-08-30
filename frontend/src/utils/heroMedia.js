const CLOUDINARY_CLOUD = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME?.trim();
const HERO_VIDEO_ID = import.meta.env.VITE_HERO_VIDEO_ID?.trim() || 'packandsync/hero-bg';

export function getHeroMediaUrls() {
    if (!CLOUDINARY_CLOUD) return null;

    const base = `https://res.cloudinary.com/${CLOUDINARY_CLOUD}/video/upload`;
    return {
        video: `${base}/w_1280,q_auto,vc_auto,ac_none,f_auto/${HERO_VIDEO_ID}.mp4`,
        poster: `${base}/so_1,w_1280,q_auto,f_jpg/${HERO_VIDEO_ID}.jpg`,
    };
}

export const HERO_MEDIA = getHeroMediaUrls();
