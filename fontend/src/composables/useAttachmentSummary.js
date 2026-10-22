export function formatSize(n) {
    if (!n || n < 0) return '0 B'
    if (n < 1024) return `${n} B`
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
    if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
    return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`
}

export function unwrapFile(f) {
    if (typeof File !== 'undefined' && f instanceof File) return f
    return f?.file || f?.raw || f?.blob || null
}

/**
 * 对文件只生成摘要，不读取全量内容。
 * - 文本类文件（<=256KB）读前 400 字作为摘要
 * - 其他类型只存元信息摘要
 */
export async function summarizeFile(raw) {
    const base = {
        id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: raw.name || '未命名文件',
        size: raw.size || 0,
        type: raw.type || '',
        summary: '',
        createdAt: Date.now(),
    }

    const isText =
        (raw.type && raw.type.startsWith('text/')) ||
        /\.(txt|md|markdown|json|csv|log|yaml|yml|xml|html|htm|js|ts|jsx|tsx|css|scss|py|java|go|rs|c|cpp|h|sh|sql)$/i.test(
            raw.name || ''
        )

    if (isText && raw.size > 0 && raw.size < 256 * 1024) {
        try {
            const text = await raw.text()
            const compact = text.replace(/\s+/g, ' ').trim()
            if (compact) {
                base.summary = compact.length > 400 ? compact.slice(0, 400) + '…' : compact
            }
        } catch { }
    }

    if (!base.summary) {
        const parts = [base.name, formatSize(base.size)]
        if (base.type) parts.push(base.type)
        base.summary = parts.join(' · ')
    }

    return base
}