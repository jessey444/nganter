import { useState } from 'react'
import { formatWhatsAppNumber } from '../lib/utils'
import { MessageSquare, AlertCircle } from 'lucide-react'

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
    const message = `Halo ${pasien.nama},\n\nKami dari layanan pengantaran obat.\n\nUntuk membantu kami mengantarkan obat ke lokasi Anda, silakan buka tautan berikut dan kirimkan lokasi Anda saat ini:\n\n${locationUrl}\n\nTerima kasih.`

    const waUrl = `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`
    window.open(waUrl, '_blank', 'noopener,noreferrer')
  }

  return (
    <div>
      {errorMsg && (
        <div className="alert alert-danger py-1 px-2 small mb-2 text-break-word d-flex align-items-center gap-1" role="alert">
          <AlertCircle size={14} className="flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
      <button
        type="button"
        className="btn btn-outline-success btn-sm btn-touch w-100 fw-semibold"
        onClick={handleRequestLocation}
        title="Kirim permintaan lokasi melalui WhatsApp"
      >
        <MessageSquare size={15} />
        <span>Minta Lokasi</span>
      </button>
    </div>
  )
}
