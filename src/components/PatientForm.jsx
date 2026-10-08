import { useState } from 'react'
import { supabase } from '../lib/supabase'

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
    setErrorMsg('')
    setSuccessMsg('')

    // Validasi minimal
    if (!nama.trim()) {
      setErrorMsg('Nama pasien wajib diisi.')
      return
    }
    if (!alamat.trim()) {
      setErrorMsg('Alamat wajib diisi.')
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

      setSuccessMsg('Pasien berhasil ditambahkan!')
      setNama('')
      setAlamat('')
      setNomorWa('')
      setAlamatGoogleMaps('')

      if (onSuccess) {
        onSuccess()
      }
    } catch (err) {
      setErrorMsg(err.message || 'Gagal menyimpan data pasien.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="needs-validation">
      {errorMsg && (
        <div className="alert alert-danger py-2 small" role="alert">
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div className="alert alert-success py-2 small" role="alert">
          {successMsg}
        </div>
      )}

      <div className="mb-3">
        <label htmlFor="nama" className="form-label fw-bold">
          Nama Pasien <span className="text-danger">*</span>
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
        />
      </div>

      <div className="mb-3">
        <label htmlFor="alamat" className="form-label fw-bold">
          Alamat Pasien <span className="text-danger">*</span>
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
        <label htmlFor="nomorWa" className="form-label fw-bold">
          Nomor WhatsApp <span className="text-danger">*</span>
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
      </div>

      <div className="mb-3">
        <label htmlFor="alamatGoogleMaps" className="form-label fw-bold">
          Alamat Google Maps <span className="text-muted font-monospace fs-7">(Opsional)</span>
        </label>
        <input
          type="url"
          id="alamatGoogleMaps"
          className="form-control"
          placeholder="https://maps.google.com/..."
          value={alamatGoogleMaps}
          onChange={(e) => setAlamatGoogleMaps(e.target.value)}
          disabled={loading}
        />
      </div>

      <div className="d-flex justify-content-end gap-2 pt-2">
        {onCancel && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
            disabled={loading}
          >
            Batal
          </button>
        )}
        <button
          type="submit"
          className="btn btn-primary"
          disabled={loading}
        >
          {loading ? (
            <>
              <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
              Menyimpan...
            </>
          ) : (
            'Simpan Pasien'
          )}
        </button>
      </div>
    </form>
  )
}
