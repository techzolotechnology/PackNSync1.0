import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

// GitHub Pages needs e.g. "/PickAndSync1.0/" — set VITE_BASE in CI
const base = process.env.VITE_BASE || './';
const backendOrigin = process.env.VITE_DEV_BACKEND_ORIGIN || 'https://packandsync-api.onrender.com';

export default defineConfig({
    base,
    plugins: [react()],
    resolve: {
        alias: {
            '@': resolve(__dirname, 'src'),
        },
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (!id.includes('node_modules')) return undefined;
                    if (id.includes('framer-motion')) return 'framer-motion';
                    if (id.includes('socket.io') || id.includes('engine.io')) return 'socketio';
                    if (id.includes('date-fns')) return 'date-fns';
                    // React core + router change rarely; keeping them together avoids init-order issues.
                    if (
                        id.includes('/react/') ||
                        id.includes('/react-dom/') ||
                        id.includes('/scheduler/') ||
                        id.includes('react-router') ||
                        id.includes('@remix-run')
                    ) {
                        return 'react-vendor';
                    }
                    return 'vendor';
                },
            },
        },
    },
    server: {
        port: 5173,
        proxy: {
            '/api': {
                target: backendOrigin,
                changeOrigin: true,
            },
            '/uploads': {
                target: backendOrigin,
                changeOrigin: true,
            },
            '/socket.io': {
                target: backendOrigin,
                changeOrigin: true,
                ws: true,
            },
        },
    },
});
