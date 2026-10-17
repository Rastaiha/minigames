const decoder = new TextDecoder('utf-8', { fatal: true })

export function decodeUtf8Binary(value) {
  const normalized = value
    .replaceAll('۰', '0')
    .replaceAll('۱', '1')

  if (!normalized.trim()) {
    return { ok: true, text: '' }
  }

  if (/[^01\s_]/u.test(normalized)) {
    return { ok: false, text: 'فقط ۰، ۱ و فاصله' }
  }

  const bits = normalized.replace(/[\s_]/gu, '')

  if (bits.length % 8 !== 0) {
    return { ok: false, text: 'هر بایت باید ۸ بیت باشد' }
  }

  const bytes = new Uint8Array(bits.length / 8)
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(bits.slice(index * 8, index * 8 + 8), 2)
  }

  try {
    return { ok: true, text: decoder.decode(bytes) }
  } catch {
    return { ok: false, text: 'UTF-8 نامعتبر است' }
  }
}
