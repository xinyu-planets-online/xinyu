import { fileURLToPath, URL } from 'node:url'
import { resolve } from 'node:path'
import { existsSync, readFileSync, readdirSync } from 'node:fs'

import { defineConfig, normalizePath } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import vueDevTools from 'vite-plugin-vue-devtools'
import { viteStaticCopy } from 'vite-plugin-static-copy'

const root = process.cwd()

/**
 * dev 模式专用：viteStaticCopy 在 dev 下只拦截不复制，且版本不匹配时会静默失效。
 * 这个插件在 dev 模式下直接拦截 /ocr/ 请求，从 node_modules 读文件返回，不依赖第三方插件行为。
 * 扫描目录拿到实际文件名，tesseract.js-core 换名字也不会 404。
 */
function tesseractDevAssets() {
  const mapping = {}

  const worker = resolve(root, 'node_modules/tesseract.js/dist/worker.min.js')
  if (existsSync(worker)) mapping['/ocr/worker.min.js'] = worker

  const coreDir = resolve(root, 'node_modules/tesseract.js-core')
  if (existsSync(coreDir)) {
    for (const f of readdirSync(coreDir)) {
      if (f.endsWith('.wasm.js')) {
        mapping[`/ocr/${f}`] = resolve(coreDir, f)
      }
    }
  }

  for (const [pkg, file] of [
    ['eng', 'eng.traineddata.gz'],
    ['chi_sim', 'chi_sim.traineddata.gz'],
  ]) {
    const p = resolve(root, `node_modules/@tesseract.js-data/${pkg}/4.0.0_best_int/${file}`)
    if (existsSync(p)) mapping[`/ocr/lang/${file}`] = p
  }

  return {
    name: 'tesseract-dev-assets',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split('?')[0]
        if (!url || !url.startsWith('/ocr/')) return next()

        const filePath = mapping[url]
        if (!filePath || !existsSync(filePath)) {
          console.warn(`[tesseract-dev-assets] 404 ${url}`)
          res.statusCode = 404
          res.setHeader('Content-Type', 'text/plain; charset=utf-8')
          res.end(`Not found: ${url}`)
          return
        }

        const mime = filePath.endsWith('.gz')
          ? 'application/gzip'
          : 'application/javascript; charset=utf-8'

        res.setHeader('Content-Type', mime)
        res.setHeader('Cache-Control', 'public, max-age=3600')
        res.end(readFileSync(filePath))
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue({
      template: {
        compilerOptions: {
          isCustomElement: (tag) => tag === 'llm-hub-config',
        },
      },
    }),
    vueJsx(),
    vueDevTools(),
    tesseractDevAssets(),
    viteStaticCopy({
      targets: [
        {
          src: normalizePath(resolve(root, 'node_modules/tesseract.js/dist/worker.min.js')),
          dest: 'ocr',
        },
        {
          src: normalizePath(resolve(root, 'node_modules/tesseract.js-core/tesseract-core*.wasm.js')),
          dest: 'ocr',
        },
        {
          src: normalizePath(resolve(root, 'node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz')),
          dest: 'ocr/lang',
        },
        {
          src: normalizePath(resolve(root, 'node_modules/@tesseract.js-data/chi_sim/4.0.0_best_int/chi_sim.traineddata.gz')),
          dest: 'ocr/lang',
        },
      ],
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
