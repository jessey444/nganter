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
