import { useState } from 'react'
import { formatWhatsAppNumber } from '../lib/utils'

export default function RequestLocationButton({ pasien }) {
  const [errorMsg, setErrorMsg] = useState('')

  if (!pasien) return null

  const handleRequestLocation = () => {
    setErrorMsg('')

    if (!pasien.token_lokasi) {
      setErrorMsg('Token lokasi pasien tidak ditemukan.')
      return
    }

    const formattedPhone = formatWhatsAppNumber(pasien.nomor_wa)
    if (!formattedPhone || formattedPhone.length < 8) {
      setErrorMsg('Nomor WhatsApp pasien tidak valid.')
      return
    }

    const locationUrl = `${window.location.origin}/lokasi/${pasien.token_lokasi}`
    const message = `Halo ${pasien.nama},\n\nKami dari layanan pengantaran obat.\n\nUntuk membantu kami mengantarkan obat ke lokasi Anda, silakan buka link berikut dan kirimkan lokasi Anda saat ini:\n\n${locationUrl}\n\nTerima kasih.`

    const waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`
    window.open(waUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <div>
      {errorMsg && (
        <div className="alert alert-danger py-1 px-2 small mb-2" role="alert">
          {errorMsg}
        </div>
      )}
      <button
        type="button"
        className="btn btn-outline-success btn-sm d-inline-flex align-items-center gap-1 shadow-sm w-100 justify-content-center"
        onClick={handleRequestLocation}
        title="Kirim permintaan lokasi melalui WhatsApp"
      >
        <span>💬</span> Minta Lokasi
      </button>
    </div>
  )
}
