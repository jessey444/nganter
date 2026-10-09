import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import PatientForm from '../components/PatientForm'
import RequestLocationButton from '../components/RequestLocationButton'
import DeliveryStart from '../components/DeliveryStart'
import PatientEditModal from '../components/PatientEditModal'
import { getJakartaDateString } from '../lib/utils'

export default function Dashboard() {
  const [pasienList, setPasienList] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingPasien, setEditingPasien] = useState(null)

  // Penutupan Hari Operasional State
  const [currentDate] = useState(() => getJakartaDateString())
  const [dayStatus, setDayStatus] = useState(null) // 'BUKA' | 'TUTUP' | null
  const [closingDay, setClosingDay] = useState(false)
  const [closureAlert, setClosureAlert] = useState(null) // { type: 'success' | 'danger' | 'warning', text: '' }

  const fetchPasien = async (showLoadingSpinner = true) => {
    if (showLoadingSpinner) {
      setLoading(true)
    }
    setErrorMsg('')
    try {
      const { data, error } = await supabase
        .from('pasien')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        throw error
      }

      setPasienList(data || [])
    } catch (err) {
      setErrorMsg(err.message || 'Gagal mengambil data pasien.')
    } finally {
      setLoading(false)
    }
  }

  const fetchDayStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('hari_operasional')
        .select('status')
        .eq('tanggal_operasional', currentDate)
        .maybeSingle()

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching day status:', error)
        return
      }

      if (data && data.status) {
        setDayStatus(data.status)
      } else {
        setDayStatus('BUKA')
      }
    } catch (err) {
      console.error('Error fetching day status:', err)
      setDayStatus('BUKA')
    }
  }

  useEffect(() => {
    let isSubscribed = true

    const loadInitialData = async () => {
      setErrorMsg('')
      try {
        const [pasienRes, dayRes] = await Promise.all([
          supabase.from('pasien').select('*').order('created_at', { ascending: false }),
          supabase.from('hari_operasional').select('status').eq('tanggal_operasional', currentDate).maybeSingle()
        ])

        if (pasienRes.error) {
          throw pasienRes.error
        }

        if (isSubscribed) {
          setPasienList(pasienRes.data || [])
          if (dayRes.data && dayRes.data.status) {
            setDayStatus(dayRes.data.status)
          } else {
            setDayStatus('BUKA')
          }
        }
      } catch (err) {
        if (isSubscribed) {
          setErrorMsg(err.message || 'Gagal mengambil data pasien.')
        }
      } finally {
        if (isSubscribed) {
          setLoading(false)
        }
      }
    }

    loadInitialData()

    return () => {
      isSubscribed = false
    }
  }, [currentDate])


  const handleTutupHari = async () => {
    setClosureAlert(null)
    const confirmClose = window.confirm(
      `Apakah Anda yakin ingin menyelesaikan hari operasional untuk tanggal (${currentDate})?\n\nHari operasional hanya boleh ditutup jika semua paket berstatus SELESAI.`
    )
    if (!confirmClose) return

    setClosingDay(true)

    try {
      const { data, error } = await supabase.rpc('tutup_hari_operasional', {
        p_tanggal: currentDate
      })

      if (error) {
        throw error
      }

      if (data && data.success === true) {
        setClosureAlert({
          type: 'success',
          text: data.message || `Hari operasional ${currentDate} berhasil ditutup.`
        })
        setDayStatus('TUTUP')
        await fetchPasien(false)
      } else {
        const unfinishedCount = data?.jumlah_belum_selesai || data?.unfinished_count
        let detailText = (data && data.message) || 'Gagal menutup hari operasional.'
        if (unfinishedCount) {
          detailText += ` (Terdapat ${unfinishedCount} paket yang belum SELESAI).`
        }
        setClosureAlert({
          type: 'danger',
          text: detailText
        })
      }
    } catch (err) {
      console.error('Error tutup_hari_operasional:', err)
      if (err.code === '42501' || err.message?.includes('permission denied')) {
        setClosureAlert({
          type: 'danger',
          text: 'Izin akses RPC tutup_hari_operasional belum diberikan ke role anon/authenticated di Supabase. Silakan jalankan script GRANT EXECUTE di Supabase SQL Editor.'
        })
      } else {
        setClosureAlert({
          type: 'danger',
          text: err.message || 'Terjadi kesalahan saat menutup hari operasional.'
        })
      }
    } finally {
      setClosingDay(false)
    }
  }

  const renderStatusBadge = (status) => {
    switch (status) {
      case 'MENUNGGU_LOKASI':
        return <span className="badge bg-warning text-dark">Menunggu Lokasi</span>
      case 'SIAP_ANTAR':
        return <span className="badge bg-primary">Siap Diantar</span>
      case 'DALAM_PENGANTARAN':
        return <span className="badge bg-info text-dark">Dalam Pengantaran</span>
      case 'SELESAI':
        return <span className="badge bg-success">Selesai</span>
      default:
        return <span className="badge bg-secondary">{status || 'Tidak Diketahui'}</span>
    }
  }

  const handleFormSuccess = () => {
    setShowForm(false)
    fetchPasien(false)
    fetchDayStatus()
  }

  const handleEditSuccess = () => {
    setEditingPasien(null)
    fetchPasien(false)
  }

  return (
    <div className="container py-4">
      {/* Header Application */}
      <header className="pb-3 mb-4 border-bottom d-flex justify-content-between align-items-center flex-wrap gap-2">
        <div>
          <h1 className="h3 mb-1 text-primary fw-bold">Sistem Pengantaran Obat</h1>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            <span className="text-muted small">Manajemen Pasien &amp; Pengantaran</span>
            <span className="badge bg-light text-dark border font-monospace">
              📅 {currentDate} (WIB)
            </span>
            {dayStatus === 'TUTUP' ? (
              <span className="badge bg-danger">🔒 Hari Ini Ditutup</span>
            ) : (
              <span className="badge bg-success">🟢 Hari Operasional Buka</span>
            )}
          </div>
        </div>

        <div className="d-flex align-items-center gap-2">
          {/* Tombol Selesaikan Hari Ini */}
          <button
            type="button"
            className="btn btn-outline-danger d-inline-flex align-items-center gap-1 shadow-sm fw-bold"
            onClick={handleTutupHari}
            disabled={closingDay || dayStatus === 'TUTUP'}
            title={dayStatus === 'TUTUP' ? 'Hari operasional ini sudah ditutup' : 'Selesaikan dan tutup hari ini'}
          >
            {closingDay ? (
              <>
                <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                Menutup Hari...
              </>
            ) : dayStatus === 'TUTUP' ? (
              <>🔒 Hari Ditutup</>
            ) : (
              <>🔒 Selesaikan Hari Ini</>
            )}
          </button>

          {/* Tombol Tambah Pasien */}
          <button
            type="button"
            className="btn btn-primary d-inline-flex align-items-center gap-1 shadow-sm fw-bold"
            onClick={() => setShowForm(true)}
            disabled={dayStatus === 'TUTUP'}
            title={dayStatus === 'TUTUP' ? 'Hari operasional sudah ditutup, paket baru tidak dapat dibuat.' : 'Tambah Pasien Baru'}
          >
            <span className="fs-5 lh-1">+</span> Tambah Pasien
          </button>
        </div>
      </header>

      {/* Alert Notifikasi Penutupan Hari */}
      {closureAlert && (
        <div className={`alert alert-${closureAlert.type} alert-dismissible fade show mb-4`} role="alert">
          <div>{closureAlert.text}</div>
          <button
            type="button"
            className="btn-close"
            onClick={() => setClosureAlert(null)}
            aria-label="Close"
          ></button>
        </div>
      )}

      {/* Modal Form Tambah Pasien */}
      {showForm && (
        <div
          className="modal fade show d-block"
          style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
          role="dialog"
          aria-modal="true"
        >
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content shadow-lg border-0">
              <div className="modal-header bg-primary text-white">
                <h5 className="modal-title fw-bold">Tambah Pasien Baru</h5>
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  aria-label="Close"
                  onClick={() => setShowForm(false)}
                ></button>
              </div>
              <div className="modal-body p-4">
                <PatientForm
                  onSuccess={handleFormSuccess}
                  onCancel={() => setShowForm(false)}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Edit Pasien */}
      {editingPasien && (
        <PatientEditModal
          pasien={editingPasien}
          onSuccess={handleEditSuccess}
          onClose={() => setEditingPasien(null)}
        />
      )}

      {/* Main Content Area */}
      <main>
        {/* Fitur Delivery Start / GPS Kurir & Pasien Terdekat */}
        <DeliveryStart />

        {/* Error State */}
        {errorMsg && (
          <div className="alert alert-danger d-flex align-items-center mb-4" role="alert">
            <div>
              <strong>Error: </strong>{errorMsg}
            </div>
          </div>
        )}

        {/* Header Daftar Seluruh Pasien */}
        <div className="d-flex justify-content-between align-items-center mb-3 mt-4">
          <h5 className="fw-bold mb-0 text-dark">📋 Daftar Seluruh Pasien</h5>
          <span className="badge bg-secondary">{pasienList.length} Pasien</span>
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Memuat...</span>
            </div>
            <p className="mt-2 text-muted">Memuat data pasien...</p>
          </div>
        ) : pasienList.length === 0 ? (
          /* Empty State */
          <div className="card text-center p-5 border-dashed my-4">
            <div className="card-body">
              <div className="fs-1 text-muted mb-3">📋</div>
              <h5 className="card-title text-muted">Belum ada data pasien.</h5>
              <p className="card-text text-secondary mb-4">
                Klik tombol di bawah ini untuk menambahkan data pasien pertama.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setShowForm(true)}
                disabled={dayStatus === 'TUTUP'}
              >
                + Tambah Pasien
              </button>
            </div>
          </div>
        ) : (
          /* Patient List View */
          <div className="row row-cols-1 row-cols-md-2 row-cols-lg-3 g-3">
            {pasienList.map((pasien) => (
              <div className="col" key={pasien.id}>
                <div className="card h-100 shadow-sm border-0 bg-light-subtle">
                  <div className="card-body d-flex flex-column">
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <h5 className="card-title mb-0 text-dark fw-bold text-truncate" title={pasien.nama}>
                        {pasien.nama}
                      </h5>
                      <div>{renderStatusBadge(pasien.status)}</div>
                    </div>

                    <p className="card-text text-secondary small mb-2 flex-grow-1" style={{ whiteSpace: 'pre-line' }}>
                      <strong>Alamat:</strong> {pasien.alamat}
                    </p>

                    <div className="border-top pt-2 mt-auto small">
                      <div className="mb-1">
                        <span className="text-muted">WhatsApp: </span>
                        <a
                          href={`https://wa.me/${pasien.nomor_wa.replace(/[^0-9]/g, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-decoration-none fw-semibold text-success"
                        >
                          {pasien.nomor_wa}
                        </a>
                      </div>

                      {pasien.alamat_google_maps && (
                        <div className="text-truncate mb-1">
                          <span className="text-muted">Google Maps: </span>
                          <a
                            href={pasien.alamat_google_maps}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-decoration-none text-primary"
                          >
                            Buka Peta
                          </a>
                        </div>
                      )}

                      {pasien.tanggal_operasional && (
                        <div className="text-muted fs-7">
                          <span>📅 Tgl Operasional: </span>
                          <span className="font-monospace">{pasien.tanggal_operasional}</span>
                        </div>
                      )}
                    </div>

                    {/* Action Bar (Edit & Minta Lokasi) */}
                    <div className="pt-2 mt-2 border-top d-flex gap-2">
                      {/* Tombol Edit Pasien hanya untuk status belum SELESAI */}
                      {pasien.status !== 'SELESAI' && (
                        <button
                          type="button"
                          className="btn btn-outline-primary btn-sm d-inline-flex align-items-center gap-1 shadow-sm flex-fill justify-content-center"
                          onClick={() => setEditingPasien(pasien)}
                          title="Edit data pasien"
                        >
                          <span>✏️</span> Edit
                        </button>
                      )}

                      {/* Tombol Minta Lokasi hanya untuk status MENUNGGU_LOKASI */}
                      {pasien.status === 'MENUNGGU_LOKASI' && (
                        <div className="flex-fill">
                          <RequestLocationButton pasien={pasien} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
