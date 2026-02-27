import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
    root: 'src/gui/renderer',
    base: '',
    plugins: [vue()],
    optimizeDeps: {
        include: ['neverthrow'],
    },
    build: {
        outDir: '../../../build/gui/renderer',
        emptyOutDir: false,
        rollupOptions: {
            input: {
                index: resolve(__dirname, 'src/gui/renderer/index.html'),
                login: resolve(__dirname, 'src/gui/renderer/login.html')
            },
        },
    },
});
