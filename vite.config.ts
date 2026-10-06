/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Aviation Weather Center API — CORS 미지원, dev 서버에서 프록시
      '/aviationweather': {
        target: 'https://aviationweather.gov',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/aviationweather/, ''),
        secure: true,
      },
      // FAA NMS API — CORS 미지원으로 dev 서버에서 프록시
      '/nms-auth': {
        target: 'https://api-nms.aim.faa.gov',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/nms-auth/, ''),
        secure: true,
      },
      '/nmsapi': {
        target: 'https://api-nms.aim.faa.gov',
        changeOrigin: true,
        secure: true,
      },
      // FAA NMS Test Environment (staging) — /nms-auth* prefix 충돌 회피를 위해 /nms-staging-* 사용
      '/nms-staging-auth': {
        target: 'https://api-staging.cgifederal-aim.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/nms-staging-auth/, ''),
        secure: true,
      },
      '/nms-staging-api': {
        target: 'https://api-staging.cgifederal-aim.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/nms-staging-api/, '/nmsapi'),
        secure: true,
      },
    },
  },
  test: {
    globals: true,
    environment: 'node',
  },
  build: {
    minify: 'terser',
    terserOptions: {
      compress: {
        passes: 3,
        drop_console: false,
        drop_debugger: true,
        reduce_funcs: true,
        reduce_vars: true,
        hoist_funs: true,
        hoist_vars: true,
        pure_getters: true,
        unsafe: true,
        unsafe_math: true,
        unsafe_methods: true,
        unsafe_proto: true,
        unsafe_regexp: true,
        unsafe_undefined: true,
      },
      mangle: {
        toplevel: true,
        properties: {
          regex: /^_/,
        },
      },
      format: {
        comments: false,
      },
    },
    reportCompressedSize: true,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        manualChunks: undefined,
        inlineDynamicImports: true,
      },
    },
  },
})
