import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        devOptions: {
          enabled: true,
        },
        manifest: {
          name: 'SafaiConnect',
          short_name: 'Safai',
          description: 'Smart Waste Management System',
          start_url: '/',
          display: 'standalone',
          background_color: '#ffffff',
          theme_color: '#059669',
          orientation: 'portrait',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ]
        }
      }),
      // Dev-only middleware that mirrors api/geocode.ts for local testing
      {
        name: 'api-geocode-dev',
        configureServer(server) {
          server.middlewares.use('/api/geocode', async (req: any, res: any) => {
            const url = new URL(req.url, 'http://localhost')
            const lat = url.searchParams.get('lat')
            const lng = url.searchParams.get('lng')

            res.setHeader('Content-Type', 'application/json')

            if (!lat || !lng) {
              res.statusCode = 400
              res.end(JSON.stringify({ error: 'lat and lng required' }))
              return
            }

            try {
              // Use Nominatim (OpenStreetMap) — free, no API key required
              const upstream = await fetch(
                `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`,
                { headers: { 'User-Agent': 'SafaiConnect/1.0' } }
              )
              if (!upstream.ok) {
                res.statusCode = 502
                res.end(JSON.stringify({ error: 'Nominatim error', message: `HTTP ${upstream.status}` }))
                return
              }
              const data = await upstream.json() as any
              const addr = data.address ?? {}

              res.end(JSON.stringify({
                city:             addr.city ?? addr.town ?? addr.county ?? null,
                district:         addr.suburb ?? addr.neighbourhood ?? addr.village ?? null,
                state:            addr.state ?? null,
                formattedAddress: data.display_name ?? null,
              }))
            } catch (err) {
              res.statusCode = 500
              res.end(JSON.stringify({ error: 'Internal geocoding error' }))
            }
          })
        }
      }
    ],
    server: {
      port: process.env.PORT ? parseInt(process.env.PORT) : 5173,
      host: true,
      watch: {
        ignored: ['**/api/**']
      }
    },
    optimizeDeps: {
      exclude: ['@vercel/node']
    },
    esbuild: {
      exclude: ['**/api/**']
    }
  }
})
