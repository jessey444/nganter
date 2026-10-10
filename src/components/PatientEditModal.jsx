import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { User, MapPin, Phone, Globe, Check, AlertCircle, X, ShieldAlert, Loader2 } from 'lucide-react'

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
        style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)' }}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-dialog modal-md modal-dialog-centered">
          <div className="modal-content border-0 shadow-lg rounded-4">
            <div className="modal-header bg-danger-subtle border-0 py-3 px-4 d-flex justify-content-between align-items-center">
              <div className="d-flex align-items-center gap-2 text-danger fw-bold">
                <ShieldAlert size={20} />
                <h6 className="modal-title mb-0 fw-bold">Data Pasien Terkunci</h6>
              </div>
              <button
                type="button"
                className="btn-close"
                aria-label="Tutup"
                onClick={onClose}
              ></button>
            </div>
            <div className="modal-body p-4 text-center">
              <div className="p-3 bg-light rounded-3 border mb-3">
                <p className="mb-1 text-navy-800 fw-bold">{pasien.nama}</p>
                <span className="status-badge status-badge-selesai">Status: Selesai</span>
              </div>
              <p className="mb-0 text-navy-600 small">
                Paket pengantaran ini telah <strong>SELESAI</strong>. Sesuai prosedur operasional, data pasien yang sudah selesai tidak dapat diubah kembali.
              </p>
            </div>
            <div className="modal-footer border-0 bg-transparent px-4 pb-4 pt-0">
              <button type="button" className="btn btn-secondary btn-touch w-100" onClick={onClose}>
                Kembali ke Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (loading) return

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
        setSuccessMsg(data.message || 'Data pasien berhasil diperbarui.')
        setTimeout(() => {
          if (onSuccess) onSuccess()
        }, 800)
      } else {
        setErrorMsg((data && data.message) || 'Gagal memperbarui data pasien.')
      }
    } catch (err) {
      console.error('Error edit_pasien:', err)
      if (err.code === '42501' || err.message?.includes('permission denied')) {
        setErrorMsg('Izin akses RPC edit_pasien belum diberikan ke role anon/authenticated di Supabase.')
      } else {
        setErrorMsg(err.message || 'Terjadi kesalahan saat mengupdate data pasien.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="modal fade show d-block"
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)' }}
      role="dialog"
      aria-modal="true"
    >
      <div className="modal-dialog modal-lg modal-dialog-centered">
        <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
          <div className="modal-header bg-white border-bottom py-3 px-4 d-flex justify-content-between align-items-center">
            <div>
              <h5 className="modal-title fw-bold text-navy-900 mb-0">Edit Data Pasien</h5>
              <small className="text-navy-500">Perbarui identitas atau alamat pengantaran</small>
            </div>
            <button
              type="button"
              className="btn btn-sm btn-light border p-1 rounded-circle"
              aria-label="Tutup"
              onClick={onClose}
              disabled={loading}
            >
              <X size={18} />
            </button>
          </div>

          <div className="modal-body p-4">
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
                <label htmlFor="edit-nama" className="form-label d-flex align-items-center gap-1.5">
                  <User size={15} className="text-navy-500" />
                  <span>Nama Pasien</span>
                  <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  id="edit-nama"
                  className="form-control"
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>

              <div className="mb-3">
                <label htmlFor="edit-alamat" className="form-label d-flex align-items-center gap-1.5">
                  <MapPin size={15} className="text-navy-500" />
                  <span>Alamat Lengkap</span>
                  <span className="text-danger">*</span>
                </label>
                <textarea
                  id="edit-alamat"
                  className="form-control"
                  rows="3"
                  value={alamat}
                  onChange={(e) => setAlamat(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>

              <div className="mb-3">
                <label htmlFor="edit-nomorWa" className="form-label d-flex align-items-center gap-1.5">
                  <Phone size={15} className="text-navy-500" />
                  <span>Nomor WhatsApp</span>
                  <span className="text-danger">*</span>
                </label>
                <input
                  type="tel"
                  id="edit-nomorWa"
                  className="form-control"
                  value={nomorWa}
                  onChange={(e) => setNomorWa(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>

              <div className="mb-4">
                <label htmlFor="edit-alamatGoogleMaps" className="form-label d-flex align-items-center gap-1.5">
                  <Globe size={15} className="text-navy-500" />
                  <span>Link Google Maps</span>
                  <span className="badge bg-light text-navy-600 border fw-normal ms-1">Opsional</span>
                </label>
                <input
                  type="url"
                  id="edit-alamatGoogleMaps"
                  className="form-control font-monospace small"
                  value={alamatGoogleMaps}
                  onChange={(e) => setAlamatGoogleMaps(e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="d-flex flex-column-reverse flex-sm-row justify-content-sm-end gap-2 pt-3 border-top">
                <button
                  type="button"
                  className="btn btn-secondary btn-touch px-4"
                  onClick={onClose}
                  disabled={loading}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-touch px-4"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 size={16} className="spinner-border-sm animate-spin" />
                      <span>Menyimpan Perubahan...</span>
                    </>
                  ) : (
                    <>
                      <Check size={16} />
                      <span>Simpan Perubahan</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
