import { fileURLToPath, URL } from 'node:url'
import { resolve } from 'node:path'
import {
  existsSync,
  readFileSync,
  readdirSync,
  mkdirSync,
  copyFileSync,
} from 'node:fs'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import vueDevTools from 'vite-plugin-vue-devtools'

const root = process.cwd()

/**
 * dev 模式：拦截 /ocr/ 请求，直接从 node_modules 读文件返回。
 * 不依赖任何第三方复制插件，路径由映射表精确控制。
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

/**
 * build 模式：把 OCR 资源按扁平路径复制到 dist/ocr/。
 * 用 copyFileSync 显式指定目标路径，不依赖任何插件的路径推断，
 * 不会出现 node_modules 嵌套。
 */
function tesseractBuildAssets() {
  return {
    name: 'tesseract-build-assets',
    apply: 'build',
    closeBundle() {
      const distOcr = resolve(root, 'dist/ocr')
      const distLang = resolve(distOcr, 'lang')
      mkdirSync(distOcr, { recursive: true })
      mkdirSync(distLang, { recursive: true })

      // worker
      const workerSrc = resolve(root, 'node_modules/tesseract.js/dist/worker.min.js')
      if (existsSync(workerSrc)) {
        copyFileSync(workerSrc, resolve(distOcr, 'worker.min.js'))
      } else {
        console.warn('[tesseract-build-assets] 缺 worker.min.js，请先执行 pnpm install')
      }

      // core 的 4 个 wasm.js
      const coreDir = resolve(root, 'node_modules/tesseract.js-core')
      if (existsSync(coreDir)) {
        for (const f of readdirSync(coreDir)) {
          if (f.endsWith('.wasm.js')) {
            copyFileSync(resolve(coreDir, f), resolve(distOcr, f))
          }
        }
      } else {
        console.warn('[tesseract-build-assets] 缺 tesseract.js-core，请先执行 pnpm install')
      }

      // 语言包
      for (const [pkg, file] of [
        ['eng', 'eng.traineddata.gz'],
        ['chi_sim', 'chi_sim.traineddata.gz'],
      ]) {
        const src = resolve(root, `node_modules/@tesseract.js-data/${pkg}/4.0.0_best_int/${file}`)
        if (existsSync(src)) {
          copyFileSync(src, resolve(distLang, file))
        } else {
          console.warn(`[tesseract-build-assets] 缺 ${file}，请先执行 pnpm add @tesseract.js-data/${pkg}`)
        }
      }

      console.log('[tesseract-build-assets] 已复制 OCR 资源到 dist/ocr/')
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
    tesseractBuildAssets(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})