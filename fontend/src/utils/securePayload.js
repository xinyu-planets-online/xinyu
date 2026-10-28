// src/utils/securePayload.js
import pako from 'pako'
import CryptoJS from 'crypto-js'

/* ===================== 参数 ===================== */
const PBKDF2_ITERATIONS = 10000
const SALT_SIZE = 16
const IV_SIZE = 16

/* ===================== 二进制 <-> Base64 ===================== */
function bytesToBase64(bytes) {
    const CHUNK = 0x8000
    let binary = ''
    for (let i = 0; i < bytes.length; i += CHUNK) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK))
    }
    return btoa(binary)
}

function base64ToBytes(b64) {
    const binary = atob(b64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return bytes
}

/* ===================== 派生密钥 ===================== */
function deriveKey(password, saltWordArray) {
    return CryptoJS.PBKDF2(password, saltWordArray, {
        keySize: 256 / 32,
        iterations: PBKDF2_ITERATIONS,
        hasher: CryptoJS.algo.SHA256,
    })
}

/* ===================== 压缩 / 解压（内部用） ===================== */
function gzipToBase64(data) {
    const json = typeof data === 'string' ? data : JSON.stringify(data)
    return bytesToBase64(pako.gzip(json))
}

function ungzipFromBase64(b64) {
    return pako.ungzip(base64ToBytes(b64), { to: 'string' })
}

/* ===================== 对外：加密 ===================== */
/**
 * 明文 JSON -> gzip -> base64 -> AES-CBC 加密 -> 自包含密文字符串
 * @param {any} data
 * @param {string} password 用户输入的加密密码（独立于账户密码，仅内存）
 * @returns {string} { salt, iv, data } 的 JSON 字符串
 */
export function encryptPayload(data, password) {
    if (!password) throw new Error('加密密码不能为空')

    const compressedB64 = gzipToBase64(data)

    const salt = CryptoJS.lib.WordArray.random(SALT_SIZE)
    const iv = CryptoJS.lib.WordArray.random(IV_SIZE)
    const key = deriveKey(password, salt)

    const encrypted = CryptoJS.AES.encrypt(compressedB64, key, {
        iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
    })

    return JSON.stringify({
        salt: salt.toString(CryptoJS.enc.Base64),
        iv: iv.toString(CryptoJS.enc.Base64),
        data: encrypted.toString(),
    })
}

/* ===================== 对外：解密 ===================== */
/**
 * 自包含密文字符串 + 密码 -> 解密 -> 解压 -> JSON
 * 密码错误或数据被篡改时抛异常
 */
export function decryptPayload(payload, password) {
    if (!password) throw new Error('加密密码不能为空')

    const { salt, iv, data } = typeof payload === 'string' ? JSON.parse(payload) : payload

    const key = deriveKey(password, CryptoJS.enc.Base64.parse(salt))

    let compressedB64
    try {
        const decrypted = CryptoJS.AES.decrypt(data, key, {
            iv: CryptoJS.enc.Base64.parse(iv),
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7,
        })
        compressedB64 = decrypted.toString(CryptoJS.enc.Utf8)
    } catch (e) {
        throw new Error('解密失败：密码错误或数据被篡改')
    }
    if (!compressedB64) throw new Error('解密失败：密码错误或数据被篡改')

    try {
        return JSON.parse(ungzipFromBase64(compressedB64))
    } catch (e) {
        throw new Error('解压失败：密码错误或数据损坏')
    }
}