import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function DeliveryStart() {
  const [loading, setLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState('') // 'gps' | 'rpc'
  const [startingId, setStartingId] = useState(null) // ID pasien yang sedang diproses mulai pengantaran
  const [completingId, setCompletingId] = useState(null) // ID pengantaran yang sedang diselesaikan
  const [errorMsg, setErrorMsg] = useState('')
  const [actionSuccessMsg, setActionSuccessMsg] = useState('')
  const [courierLocation, setCourierLocation] = useState(null)
  const [nearbyPatients, setNearbyPatients] = useState(null) // null = not queried yet, [] = empty state
  const [ongoingDeliveries, setOngoingDeliveries] = useState([]) // daftar pengantaran DALAM_PENGANTARAN

  // Fetch ongoing deliveries (status DALAM_PENGANTARAN) with joined pasien data
  const fetchOngoingDeliveries = async () => {
    try {
      const { data, error } = await supabase
        .from('pengantaran')
        .select('id, pasien_id, urutan, jarak_km, waktu_mulai, status, pasien ( nama, alamat )')
        .eq('status', 'DALAM_PENGANTARAN')
        .order('urutan', { ascending: true })
      if (error) throw error
      setOngoingDeliveries(data || [])
    } catch (err) {
      console.error('Gagal mengambil pengantaran berjalan:', err)
      setOngoingDeliveries([])
    }
  }

  // Fetch ongoing deliveries on mount
  useEffect(() => {
    let ignore = false
    supabase
      .from('pengantaran')
      .select('id, pasien_id, urutan, jarak_km, waktu_mulai, status, pasien ( nama, alamat )')
      .eq('status', 'DALAM_PENGANTARAN')
      .order('urutan', { ascending: true })
      .then(({ data, error }) => {
        if (!ignore && !error) {
          setOngoingDeliveries(data || [])
        }
      })
    return () => { ignore = true }
  }, [])

  const handleStartDelivery = () => {
    setErrorMsg('')
    setActionSuccessMsg('')
    setNearbyPatients(null)

    if (!navigator.geolocation) {
      setErrorMsg('Browser tidak mendukung fitur lokasi.')
      return
    }

    setLoading(true)
    setLoadingStep('gps')

    const options = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const latitude = position.coords.latitude
        const longitude = position.coords.longitude

        setCourierLocation({ latitude, longitude })
        setLoadingStep('rpc')

        try {
          // Panggil RPC get_pasien_terdekat dengan parameter p_latitude dan p_longitude
          const { data, error } = await supabase.rpc('get_pasien_terdekat', {
            p_latitude: latitude,
            p_longitude: longitude
          })

          if (error) {
            throw error
          }

          setNearbyPatients(data || [])
        } catch (err) {
          setErrorMsg(err.message || 'Gagal mengambil daftar pasien terdekat.')
        } finally {
          setLoading(false)
        }
      },
      (error) => {
        setLoading(false)
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setErrorMsg('Lokasi kurir tidak diizinkan. Silakan aktifkan izin lokasi.')
            break
          case error.POSITION_UNAVAILABLE:
            setErrorMsg('Lokasi kurir tidak dapat ditemukan.')
            break
          case error.TIMEOUT:
            setErrorMsg('Pengambilan lokasi kurir terlalu lama. Silakan coba lagi.')
            break
          default:
            setErrorMsg('Gagal mengambil lokasi kurir dari perangkat Anda.')
            break
        }
      },
      options
    )
  }

  const refreshNearbyPatients = async () => {
    if (!courierLocation) return
    try {
      const { data } = await supabase.rpc('get_pasien_terdekat', {
        p_latitude: courierLocation.latitude,
        p_longitude: courierLocation.longitude
      })
      setNearbyPatients(data || [])
    } catch (err) {
      console.error('Gagal memperbarui daftar pasien terdekat:', err)
    }
  }

  const handleMulaiAntar = async (pasien, urutan) => {
    setErrorMsg('')
    setActionSuccessMsg('')

    if (!pasien || !pasien.id) return

    const confirmStart = window.confirm(`Mulai pengantaran untuk ${pasien.nama}?`)
    if (!confirmStart) return

    setStartingId(pasien.id)

    try {
      // Panggil RPC mulai_pengantaran (HANYA signature 3 parameter: p_pasien_id, p_jarak_km, p_urutan)
      const { data, error } = await supabase.rpc('mulai_pengantaran', {
        p_pasien_id: pasien.id,
        p_jarak_km: pasien.jarak_km,
        p_urutan: urutan
      })

      if (error) {
        throw error
      }

      if (data && data.success === true) {
        setActionSuccessMsg(`✅ Pengantaran untuk ${pasien.nama} dimulai.`)
        await refreshNearbyPatients()
        await fetchOngoingDeliveries()
      } else {
        setErrorMsg((data && data.message) || 'Pasien tidak tersedia untuk diantar.')
        await refreshNearbyPatients()
      }
    } catch (err) {
      setErrorMsg(err.message || 'Terjadi kesalahan saat memulai pengantaran.')
      await refreshNearbyPatients()
    } finally {
      setStartingId(null)
    }
  }

  const handleSelesaikanPengantaran = async (peng) => {
    setErrorMsg('')
    setActionSuccessMsg('')

    const namaPasien = peng.pasien?.nama || 'Pasien'

    const confirmComplete = window.confirm(`Selesaikan pengantaran untuk ${namaPasien}?`)
    if (!confirmComplete) return

    setCompletingId(peng.id)

    try {
      const { data, error } = await supabase.rpc('selesaikan_pengantaran', {
        p_pengantaran_id: peng.id
      })

      if (error) {
        throw error
      }

      if (data && data.success === true) {
        setActionSuccessMsg(`✅ Pengantaran untuk ${namaPasien} selesai.`)
        await fetchOngoingDeliveries()
        await refreshNearbyPatients()
      } else {
        setErrorMsg((data && data.message) || 'Gagal menyelesaikan pengantaran.')
      }
    } catch (err) {
      setErrorMsg(err.message || 'Terjadi kesalahan saat menyelesaikan pengantaran.')
    } finally {
      setCompletingId(null)
    }
  }

  const handleOpenRoute = (latitude, longitude) => {
    if (!latitude || !longitude) return
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`
    window.open(mapsUrl, '_blank', 'noopener,noreferrer')
  }

  const formatDistance = (dist) => {
    if (typeof dist !== 'number') return '-'
    return dist.toFixed(2)
  }

  return (
    <div className="card border-primary-subtle shadow-sm mb-4">
      <div className="card-header bg-primary-subtle text-primary-emphasis d-flex justify-content-between align-items-center">
        <h5 className="mb-0 fw-bold d-flex align-items-center gap-2">
          <span>🚚</span> Mulai Pengantaran &amp; Urutan Rute
        </h5>
        {courierLocation && (
          <span className="badge bg-success-subtle text-success border border-success-subtle small font-monospace">
            GPS Kurir Aktif
          </span>
        )}
      </div>

      <div className="card-body">
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-3 mb-3">
          <div>
            <p className="card-text text-secondary mb-0">
              Dapatkan urutan pasien yang siap diantar berdasarkan lokasi kurir saat ini.
            </p>
          </div>
          <div>
            <button
              type="button"
              className="btn btn-success d-inline-flex align-items-center gap-2 fw-bold px-4 py-2 shadow-sm"
              onClick={handleStartDelivery}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                  {loadingStep === 'gps' ? 'Mengambil GPS Kurir...' : 'Mencari Pasien Terdekat...'}
                </>
              ) : (
                <>
                  <span>🚚</span> Mulai Pengantaran
                </>
              )}
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="alert alert-danger py-2 small mb-3" role="alert">
            {errorMsg}
          </div>
        )}

        {actionSuccessMsg && (
          <div className="alert alert-success py-2 small mb-3" role="alert">
            {actionSuccessMsg}
          </div>
        )}

        {/* Hasil RPC Pasien Terdekat */}
        {nearbyPatients !== null && (
          <div className="mt-4 pt-3 border-top">
            <h6 className="fw-bold text-dark mb-3 d-flex align-items-center gap-2">
              <span>📍</span> Urutan Pengantaran Pasien
            </h6>

            {nearbyPatients.length === 0 ? (
              <div className="alert alert-info py-3 mb-0 text-center" role="alert">
                <span>ℹ️</span> Tidak ada pasien yang siap diantar.
              </div>
            ) : (
              <div className="row row-cols-1 row-cols-md-2 g-3">
                {nearbyPatients.map((pasien, idx) => (
                  <div className="col" key={pasien.id || idx}>
                    <div className="card h-100 border border-success-subtle bg-light">
                      <div className="card-body d-flex flex-column">
                        <div className="d-flex justify-content-between align-items-start mb-2">
                          <h6 className="card-title fw-bold mb-0 text-dark">
                            <span className="badge bg-primary me-2">{idx + 1}</span>
                            {pasien.nama}
                          </h6>
                          <span className="badge bg-success">Siap Diantar</span>
                        </div>

                        <p className="card-text text-secondary small mb-2 flex-grow-1" style={{ whiteSpace: 'pre-line' }}>
                          <strong>Alamat:</strong> {pasien.alamat}
                        </p>

                        <div className="d-flex justify-content-between align-items-center pt-2 border-top mt-auto flex-wrap gap-2">
                          <div className="small fw-semibold text-primary">
                            <span>📏</span> Jarak: {formatDistance(pasien.jarak_km)} km
                          </div>

                          <div className="d-flex gap-2">
                            {pasien.latitude && pasien.longitude && (
                              <button
                                type="button"
                                className="btn btn-outline-primary btn-sm d-inline-flex align-items-center gap-1"
                                onClick={() => handleOpenRoute(pasien.latitude, pasien.longitude)}
                              >
                                <span>🗺️</span> Buka Rute
                              </button>
                            )}

                            <button
                              type="button"
                              className="btn btn-success btn-sm d-inline-flex align-items-center gap-1 shadow-sm"
                              onClick={() => handleMulaiAntar(pasien, idx + 1)}
                              disabled={startingId === pasien.id}
                            >
                              {startingId === pasien.id ? (
                                <>
                                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                                  ⏳ Memulai...
                                </>
                              ) : (
                                <>
                                  <span>🚚</span> Mulai Antar
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Pengantaran Berlangsung */}
        <div className="mt-4 pt-3 border-top">
          <h6 className="fw-bold text-dark mb-3 d-flex align-items-center gap-2">
            <span>🚚</span> Pengantaran Berlangsung
          </h6>

          {ongoingDeliveries.length === 0 ? (
            <div className="alert alert-info py-3 mb-0 text-center" role="alert">
              <span>ℹ️</span> Tidak ada pengantaran yang sedang berlangsung.
            </div>
          ) : (
            <div className="row row-cols-1 row-cols-md-2 g-3">
              {ongoingDeliveries.map((peng, idx) => (
                <div className="col" key={peng.id || idx}>
                  <div className="card h-100 border border-warning-subtle bg-light">
                    <div className="card-body d-flex flex-column">
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <h6 className="card-title fw-bold mb-0 text-dark">
                          <span className="badge bg-warning text-dark me-2">{peng.urutan}</span>
                          {peng.pasien?.nama || '-'}
                        </h6>
                        <span className="badge bg-warning text-dark">Dalam Pengantaran</span>
                      </div>

                      <p className="card-text text-secondary small mb-2 flex-grow-1" style={{ whiteSpace: 'pre-line' }}>
                        <strong>Alamat:</strong> {peng.pasien?.alamat || '-'}
                      </p>

                      <div className="d-flex justify-content-between align-items-center pt-2 border-top mt-auto flex-wrap gap-2">
                        <div>
                          <div className="small fw-semibold text-primary">
                            <span>📏</span> Jarak: {formatDistance(peng.jarak_km)} km
                          </div>
                          <div className="small text-muted mt-1">
                            <span>🕒</span> Mulai: {peng.waktu_mulai ? new Date(peng.waktu_mulai).toLocaleString() : '-'}
                          </div>
                        </div>

                        <button
                          type="button"
                          className="btn btn-outline-danger btn-sm d-inline-flex align-items-center gap-1 fw-bold"
                          onClick={() => handleSelesaikanPengantaran(peng)}
                          disabled={completingId === peng.id}
                        >
                          {completingId === peng.id ? (
                            <>
                              <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                              ⏳ Menyelesaikan...
                            </>
                          ) : (
                            <>🏁 Selesaikan Pengantaran</>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
