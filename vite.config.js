import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  // Load environment variables
  const env = loadEnv(mode, '.', '')
  // Get BASE_PATH from environment variable, default to './' for relative paths
  // Using './' ensures the app works when deployed at any sub-path without configuration
  // Ensure base path ends with slash for proper URL construction
  let base = env.BASE_PATH || './'
  if (!base.endsWith('/')) {
    base = base + '/'
  }

  return {
    base,
    define: {
      // Make BASE_PATH available to client-side code through import.meta.env
      'import.meta.env.BASE_PATH': JSON.stringify(base)
    },
    plugins: [
      vue(),
      vueJsx(),
      VitePWA({
        registerType: 'autoUpdate',
        base: base, // Make sure PWA respects the base path
        includeAssets: [
          'app_icons/web/favicon.ico',
          'app_icons/web/splash-750x1334@2x.png',
          'app_icons/web/splash-1170x2532@3x.png',
          'app_icons/web/splash-1290x2796@3x.png',
          'app_icons/web/splash-2048x2732@2x.png'
        ],
        manifest: {
          name: 'MiniQR',
          short_name: 'MiniQR',
          description: 'A minimal QR code generator and scanner',
          theme_color: '#ffffff',
          background_color: '#ffffff',
          display: 'standalone',
          orientation: 'portrait',
          start_url: base, // Use the base path as start URL
          icons: [
            {
              src: 'app_icons/web/icon-192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'app_icons/web/icon-192-maskable.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'maskable'
            },
            {
              src: 'app_icons/web/icon-512.png',
              sizes: '512x512',
              type: 'image/png'
            },
            {
              src: 'app_icons/web/icon-512-maskable.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable'
            }
          ],
          screenshots: [
            {
              src: 'app_icons/web/screenshot-narrow.png',
              sizes: '3510x7596',
              type: 'image/png',
              form_factor: 'narrow'
            },
            {
              src: 'app_icons/web/screenshot-wide.png',
              sizes: '7596x3510',
              type: 'image/png',
              form_factor: 'wide'
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,svg,png,jpg,jpeg,gif,ico,woff,woff2}'], // Removed html from patterns
          // Exclude large files from precaching and HTML files to avoid base path issues.
          //
          // The feature chunks are left out on purpose. Somebody opening a share
          // link needs the PDF renderer within a second or two, and while the
          // service worker was installing that chunk had to be fetched in
          // competition with 4.5 MB of precache traffic on the same origin - the
          // preview sat on its spinner for twenty seconds on a first visit. Off
          // the precache list they load on demand at the priority the page asked
          // for, and the runtime cache below still keeps them afterwards.
          globIgnores: [
            '**/app_preview.*',
            '**/presets/*.svg',
            '**/*.html',
            '**/assets/pdf-*.js',
            '**/assets/xlsx-*.js',
            '**/app_icons/web/splash-*.png',
            '**/miniqr_extract.png'
          ],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024, // 5MB limit
          // Don't precache index.html to avoid base path issues
          dontCacheBustURLsMatching: /\.\w{8}\./,
          navigateFallback: null, // Disable navigate fallback to avoid issues
          navigateFallbackDenylist: [/^\/_/, /\/[^/?]+\.[^/]+$/],
          // Remove modifyURLPrefix as it's causing conflicts with the base path
          runtimeCaching: [
            {
              urlPattern: ({ request }) => request.destination === 'document',
              handler: 'NetworkFirst',
              options: {
                cacheName: 'pages',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 86400 // 1 day
                }
              }
            },
            {
              // The chunks kept off the precache list, plus the pdf.js worker,
              // which was never precached because globPatterns does not cover
              // .mjs. Cached on first use, so only the very first visit pays.
              urlPattern: /\/assets\/(pdf|xlsx)[-.][^/]*\.(js|mjs)$/,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'feature-chunks',
                expiration: {
                  maxEntries: 12,
                  maxAgeSeconds: 2592000 // 30 days
                }
              }
            }
          ]
        },
        devOptions: {
          // enabled: true,
          type: 'module'
        }
      })
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      }
    }
  }
})
