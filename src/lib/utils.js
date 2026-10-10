/**
 * Helper untuk mengubah format nomor telepon menjadi format internasional WhatsApp (628xxx)
 * - Jika diawali 0 -> ubah ke 62
 * - Jika sudah diawali 62 -> tetap
 * - Hapus karakter non-digit (spasi, strip, (+), dll)
 */
export function formatWhatsAppNumber(phone) {
  if (!phone) return ''
  let cleaned = phone.toString().replace(/\D/g, '')
  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.slice(1)
  }
  return cleaned
}

/**
 * Helper untuk mendapatkan string tanggal YYYY-MM-DD pada zona waktu Asia/Jakarta
 */
export function getJakartaDateString(date = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
  return formatter.format(date)
}

/**
 * Format string tanggal YYYY-MM-DD menjadi format teks Indonesia (misal: 10 Oktober 2026)
 */
export function formatDateIndo(dateStr) {
  if (!dateStr) return '-'
  try {
    const [year, month, day] = dateStr.split('-').map(Number)
    const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0))
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      weekday: 'long',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(date)
  } catch {
    return dateStr
  }
}

