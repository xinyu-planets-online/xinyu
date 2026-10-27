import { ref } from 'vue'

let workerPromise = null

const STATUS_MAP = {
    'loading tesseract core': '加载 OCR 引擎',
    'initializing tesseract': '初始化引擎',
    'loading language traineddata': '加载语言包',
    'initializing api': '准备识别',
    'recognizing text': '识别文字',
}

async function getWorker(lang, onProgress) {
    if (workerPromise) return workerPromise

    workerPromise = (async () => {
        const { createWorker, OEM } = await import('tesseract.js')
        const origin = window.location.origin

        return createWorker(lang, OEM.LSTM_ONLY, {
            workerPath: `${origin}/ocr/worker.min.js`,
            corePath: `${origin}/ocr`,
            langPath: `${origin}/ocr/lang`,
            workerBlobURL: false,
            logger: (m) => {
                if (!m) return
                onProgress?.({
                    status: STATUS_MAP[m.status] || m.status || '',
                    progress: typeof m.progress === 'number' ? m.progress : null,
                })
            },
        })
    })()

    return workerPromise
}

export function useLocalOcr() {
    const isRecognizing = ref(false)
    const ocrStatus = ref('')
    const ocrProgress = ref(0)

    async function recognize(imageSource, lang = 'chi_sim+eng') {
        isRecognizing.value = true
        ocrStatus.value = '准备中'
        ocrProgress.value = 0

        try {
            const worker = await getWorker(lang, ({ status, progress }) => {
                if (status) ocrStatus.value = status
                if (progress != null) ocrProgress.value = Math.round(progress * 100)
            })
            const { data } = await worker.recognize(imageSource)
            return (data?.text || '').trim()
        } finally {
            isRecognizing.value = false
            ocrStatus.value = ''
        }
    }

    async function terminate() {
        if (!workerPromise) return
        try {
            const w = await workerPromise
            await w.terminate()
        } finally {
            workerPromise = null
        }
    }

    return { isRecognizing, ocrStatus, ocrProgress, recognize, terminate }
}