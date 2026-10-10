import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { User, MapPin, Phone, Globe, Check, AlertCircle, Loader2 } from 'lucide-react'

export default function PatientForm({ onSuccess, onCancel }) {
  const [nama, setNama] = useState('')
  const [alamat, setAlamat] = useState('')
  const [nomorWa, setNomorWa] = useState('')
  const [alamatGoogleMaps, setAlamatGoogleMaps] = useState('')

  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (loading) return

    setErrorMsg('')
    setSuccessMsg('')

    // Validasi input
    if (!nama.trim()) {
      setErrorMsg('Nama pasien wajib diisi.')
      return
    }
    if (!alamat.trim()) {
      setErrorMsg('Alamat pasien wajib diisi.')
      return
    }
    if (!nomorWa.trim()) {
      setErrorMsg('Nomor WhatsApp wajib diisi.')
      return
    }

    setLoading(true)

    try {
      const { error } = await supabase
        .from('pasien')
        .insert([
          {
            nama: nama.trim(),
            alamat: alamat.trim(),
            nomor_wa: nomorWa.trim(),
            alamat_google_maps: alamatGoogleMaps.trim() || null
          }
        ])

      if (error) {
        throw error
      }

      setSuccessMsg('Data pasien berhasil ditambahkan ke daftar operasional.')
      setNama('')
      setAlamat('')
      setNomorWa('')
      setAlamatGoogleMaps('')

      setTimeout(() => {
        if (onSuccess) onSuccess()
      }, 600)
    } catch (err) {
      setErrorMsg(err.message || 'Gagal menyimpan data pasien.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      {errorMsg && (
        <div className="alert alert-danger py-2.5 px-3 small text-break-word d-flex align-items-center gap-2 mb-3 rounded-3" role="alert">
          <AlertCircle size={16} className="text-danger flex-shrink-0" />
          <div>{errorMsg}</div>
        </div>
      )}
      {successMsg && (
        <div className="alert alert-success py-2.5 px-3 small text-break-word d-flex align-items-center gap-2 mb-3 rounded-3" role="alert">
          <Check size={16} className="text-success flex-shrink-0" />
          <div>{successMsg}</div>
        </div>
      )}

      <div className="mb-3">
        <label htmlFor="nama" className="form-label d-flex align-items-center gap-1.5">
          <User size={15} className="text-navy-500" />
          <span>Nama Pasien</span>
          <span className="text-danger">*</span>
        </label>
        <input
          type="text"
          id="nama"
          className="form-control"
          placeholder="Contoh: Budi Santoso"
          value={nama}
          onChange={(e) => setNama(e.target.value)}
          disabled={loading}
          required
          autoFocus
        />
      </div>

      <div className="mb-3">
        <label htmlFor="alamat" className="form-label d-flex align-items-center gap-1.5">
          <MapPin size={15} className="text-navy-500" />
          <span>Alamat Lengkap</span>
          <span className="text-danger">*</span>
        </label>
        <textarea
          id="alamat"
          className="form-control"
          rows="3"
          placeholder="Contoh: Jl. Merdeka No. 45, RT 02/RW 03, Kel. Suka Maju"
          value={alamat}
          onChange={(e) => setAlamat(e.target.value)}
          disabled={loading}
          required
        />
      </div>

      <div className="mb-3">
        <label htmlFor="nomorWa" className="form-label d-flex align-items-center gap-1.5">
          <Phone size={15} className="text-navy-500" />
          <span>Nomor WhatsApp</span>
          <span className="text-danger">*</span>
        </label>
        <input
          type="tel"
          id="nomorWa"
          className="form-control"
          placeholder="Contoh: 081234567890"
          value={nomorWa}
          onChange={(e) => setNomorWa(e.target.value)}
          disabled={loading}
          required
        />
        <div className="form-text text-navy-500 small mt-1">
          Nomor aktif yang digunakan untuk mengirim link konfirmasi lokasi pengantaran.
        </div>
      </div>

      <div className="mb-4">
        <label htmlFor="alamatGoogleMaps" className="form-label d-flex align-items-center gap-1.5">
          <Globe size={15} className="text-navy-500" />
          <span>Link Google Maps</span>
          <span className="badge bg-light text-navy-600 border fw-normal ms-1">Opsional</span>
        </label>
        <input
          type="url"
          id="alamatGoogleMaps"
          className="form-control font-monospace small"
          placeholder="https://maps.google.com/..."
          value={alamatGoogleMaps}
          onChange={(e) => setAlamatGoogleMaps(e.target.value)}
          disabled={loading}
        />
      </div>

      <div className="d-flex flex-column-reverse flex-sm-row justify-content-sm-end gap-2 pt-2 border-top">
        {onCancel && (
          <button
            type="button"
            className="btn btn-secondary btn-touch px-4"
            onClick={onCancel}
            disabled={loading}
          >
            Batal
          </button>
        )}
        <button
          type="submit"
          className="btn btn-primary btn-touch px-4"
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 size={16} className="spinner-border-sm animate-spin" />
              <span>Menyimpan Data...</span>
            </>
          ) : (
            <>
              <Check size={16} />
              <span>Simpan Pasien</span>
            </>
          )}
        </button>
      </div>
    </form>
  )
}
