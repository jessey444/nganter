import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function PatientEditModal({ pasien, onSuccess, onClose }) {
  const [nama, setNama] = useState(pasien?.nama || '')
  const [alamat, setAlamat] = useState(pasien?.alamat || '')
  const [nomorWa, setNomorWa] = useState(pasien?.nomor_wa || '')
  const [alamatGoogleMaps, setAlamatGoogleMaps] = useState(pasien?.alamat_google_maps || '')

  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  if (!pasien) return null

  // Pasien berstatus SELESAI tidak boleh diedit
  if (pasien.status === 'SELESAI') {
    return (
      <div
        className="modal fade show d-block"
        style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-dialog modal-md modal-dialog-centered">
          <div className="modal-content shadow-lg border-0">
            <div className="modal-header bg-danger text-white">
              <h5 className="modal-title fw-bold">⚠️ Pasien Selesai</h5>
              <button
                type="button"
                className="btn-close btn-close-white"
                aria-label="Close"
                onClick={onClose}
              ></button>
            </div>
            <div className="modal-body p-4 text-center">
              <p className="mb-0 text-danger fw-semibold">
                Pasien yang berstatus <strong>SELESAI</strong> tidak dapat diedit data identitasnya.
              </p>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Tutup
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')

    const cleanNama = nama.trim()
    const cleanAlamat = alamat.trim()
    const cleanWa = nomorWa.trim()
    const cleanMaps = alamatGoogleMaps.trim() || null

    if (!cleanNama) {
      setErrorMsg('Nama pasien wajib diisi.')
      return
    }
    if (!cleanAlamat) {
      setErrorMsg('Alamat pasien wajib diisi.')
      return
    }
    if (!cleanWa) {
      setErrorMsg('Nomor WhatsApp wajib diisi.')
      return
    }

    setLoading(true)

    try {
      const { data, error } = await supabase.rpc('edit_pasien', {
        p_pasien_id: pasien.id,
        p_nama: cleanNama,
        p_alamat: cleanAlamat,
        p_nomor_wa: cleanWa,
        p_alamat_google_maps: cleanMaps
      })

      if (error) {
        throw error
      }

      if (data && data.success === true) {
        setSuccessMsg(data.message || 'Data pasien berhasil diperbarui!')
        setTimeout(() => {
          if (onSuccess) onSuccess()
        }, 1000)
      } else {
        setErrorMsg((data && data.message) || 'Gagal memperbarui data pasien.')
      }
    } catch (err) {
      console.error('Error edit_pasien:', err)
      if (err.code === '42501' || err.message?.includes('permission denied')) {
        setErrorMsg('Izin akses RPC edit_pasien belum diberikan ke role anon/authenticated di Supabase. Silakan jalankan script GRANT EXECUTE.')
      } else {
        setErrorMsg(err.message || 'Terjadi kesalahan saat menyimpan perubahan.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="modal fade show d-block"
      style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      role="dialog"
      aria-modal="true"
    >
      <div className="modal-dialog modal-lg modal-dialog-centered">
        <div className="modal-content shadow-lg border-0">
          <div className="modal-header bg-primary text-white">
            <h5 className="modal-title fw-bold">✏️ Edit Data Pasien</h5>
            <button
              type="button"
              className="btn-close btn-close-white"
              aria-label="Close"
              onClick={onClose}
              disabled={loading}
            ></button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="modal-body p-4">
              {errorMsg && (
                <div className="alert alert-danger py-2 small mb-3" role="alert">
                  {errorMsg}
                </div>
              )}
              {successMsg && (
                <div className="alert alert-success py-2 small mb-3" role="alert">
                  {successMsg}
                </div>
              )}

              <div className="mb-3">
                <label htmlFor="editNama" className="form-label fw-bold">
                  Nama Pasien <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  id="editNama"
                  className="form-control"
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>

              <div className="mb-3">
                <label htmlFor="editAlamat" className="form-label fw-bold">
                  Alamat Pasien <span className="text-danger">*</span>
                </label>
                <textarea
                  id="editAlamat"
                  className="form-control"
                  rows="3"
                  value={alamat}
                  onChange={(e) => setAlamat(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>

              <div className="mb-3">
                <label htmlFor="editNomorWa" className="form-label fw-bold">
                  Nomor WhatsApp <span className="text-danger">*</span>
                </label>
                <input
                  type="tel"
                  id="editNomorWa"
                  className="form-control"
                  value={nomorWa}
                  onChange={(e) => setNomorWa(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>

              <div className="mb-3">
                <label htmlFor="editAlamatMaps" className="form-label fw-bold">
                  Alamat Google Maps <span className="text-muted font-monospace fs-7">(Opsional)</span>
                </label>
                <input
                  type="url"
                  id="editAlamatMaps"
                  className="form-control"
                  placeholder="https://maps.google.com/..."
                  value={alamatGoogleMaps}
                  onChange={(e) => setAlamatGoogleMaps(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="modal-footer bg-light">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
                disabled={loading}
              >
                Batal
              </button>
              <button type="submit" className="btn btn-primary fw-bold" disabled={loading}>
                {loading ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm me-2"
                      role="status"
                      aria-hidden="true"
                    ></span>
                    Menyimpan...
                  </>
                ) : (
                  '💾 Simpan Perubahan'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
