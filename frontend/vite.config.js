import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const cmsOrigin = env.VITE_CMS_ORIGIN || 'http://localhost:3000'

  return {
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        '/api': {
          target: cmsOrigin,
          changeOrigin: true,
        },
      },
    },
  }
})
