import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import {
  Truck,
  Navigation,
  MapPin,
  Clock,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Check,
  Send,
  Radio
} from 'lucide-react'

export default function DeliveryStart({ selectedDate, readOnly = false, refreshTrigger = 0 }) {
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
      let query = supabase
        .from('pengantaran')
        .select('id, pasien_id, urutan, jarak_km, waktu_mulai, status, pasien!inner ( nama, alamat, tanggal_operasional )')
        .eq('status', 'DALAM_PENGANTARAN')

      if (selectedDate) {
        query = query.eq('pasien.tanggal_operasional', selectedDate)
      }

      const { data, error } = await query.order('urutan', { ascending: true })
      if (error) throw error
      setOngoingDeliveries(data || [])
    } catch (err) {
      console.error('Gagal mengambil pengantaran berjalan:', err)
      setOngoingDeliveries([])
    }
  }

  // Fetch ongoing deliveries on mount and whenever selectedDate or refreshTrigger changes
  useEffect(() => {
    let ignore = false
    let query = supabase
      .from('pengantaran')
      .select('id, pasien_id, urutan, jarak_km, waktu_mulai, status, pasien!inner ( nama, alamat, tanggal_operasional )')
      .eq('status', 'DALAM_PENGANTARAN')

    if (selectedDate) {
      query = query.eq('pasien.tanggal_operasional', selectedDate)
    }

    query.order('urutan', { ascending: true }).then(({ data, error }) => {
      if (!ignore && !error) {
        setOngoingDeliveries(data || [])
      }
    })
    return () => { ignore = true }
  }, [selectedDate, refreshTrigger])

  const handleStartDelivery = () => {
    setErrorMsg('')
    setActionSuccessMsg('')
    setNearbyPatients(null)

    if (!navigator.geolocation) {
      setErrorMsg('Browser Anda tidak mendukung fitur geolokasi GPS.')
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

          // Filter di frontend jika data mengembalikan tanggal_operasional
          let patients = data || []
          if (selectedDate) {
            patients = patients.filter((p) => !p.tanggal_operasional || p.tanggal_operasional === selectedDate)
          }

          setNearbyPatients(patients)
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
            setErrorMsg('Izin akses lokasi ditolak. Silakan izinkan akses lokasi pada browser untuk mendeteksi rute terdekat.')
            break
          case error.POSITION_UNAVAILABLE:
            setErrorMsg('Lokasi perangkat GPS tidak tersedia saat ini.')
            break
          case error.TIMEOUT:
            setErrorMsg('Pengambilan lokasi GPS memakan waktu terlalu lama. Silakan coba lagi.')
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
      let patients = data || []
      if (selectedDate) {
        patients = patients.filter((p) => !p.tanggal_operasional || p.tanggal_operasional === selectedDate)
      }
      setNearbyPatients(patients)
    } catch (err) {
      console.error('Gagal memperbarui daftar pasien terdekat:', err)
    }
  }

  const handleMulaiAntar = async (pasien, urutan) => {
    setErrorMsg('')
    setActionSuccessMsg('')

    if (!pasien || !pasien.id) return

    const confirmStart = window.confirm(`Mulai pengantaran obat untuk pasien: "${pasien.nama}"?`)
    if (!confirmStart) return

    setStartingId(pasien.id)

    try {
      const { data, error } = await supabase.rpc('mulai_pengantaran', {
        p_pasien_id: pasien.id,
        p_jarak_km: pasien.jarak_km,
        p_urutan: urutan
      })

      if (error) {
        throw error
      }

      if (data && data.success === true) {
        setActionSuccessMsg(`Pengantaran untuk ${pasien.nama} berhasil dimulai.`)
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

    const confirmComplete = window.confirm(`Konfirmasi: Selesaikan pengantaran obat untuk "${namaPasien}"?`)
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
        setActionSuccessMsg(`Pengantaran untuk ${namaPasien} telah diselesaikan.`)
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
    <div className="delivery-panel mb-4">
      {/* Header Panel Operasional */}
      <div className="delivery-panel-header d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center gap-3">
        <div className="d-flex align-items-center gap-2.5">
          <div className="p-2 bg-primary-100 text-primary-600 rounded-3 d-flex align-items-center justify-content-center">
            <Truck size={20} />
          </div>
          <div>
            <h5 className="mb-0 fw-bold text-navy-900 fs-6 fs-sm-5">
              Panel Operasional Pengantaran
            </h5>
            <small className="text-navy-500">
              Optimalisasi urutan rute &amp; pemantauan kurir
            </small>
          </div>
        </div>

        {/* Indikator Status GPS Kurir */}
        <div>
          {courierLocation ? (
            <span className="gps-badge-active" title={`Lat: ${courierLocation.latitude}, Lng: ${courierLocation.longitude}`}>
              <span className="pulse-dot"></span>
              <span>GPS Aktif ({courierLocation.latitude.toFixed(3)}, {courierLocation.longitude.toFixed(3)})</span>
            </span>
          ) : (
            <span className="gps-badge-inactive">
              <Radio size={13} className="text-navy-400" />
              <span>GPS Kurir Belum Diaktifkan</span>
            </span>
          )}
        </div>
      </div>

      <div className="p-3 p-sm-4">
        {readOnly && (
          <div className="alert alert-secondary py-2 px-3 small d-flex align-items-center gap-2 mb-3 rounded-3 border">
            <Lock size={15} className="text-navy-600 flex-shrink-0" />
            <span className="fw-medium">Mode Riwayat (Read-Only): Operasi rute dan pengantaran dinonaktifkan untuk tanggal ini.</span>
          </div>
        )}

        {/* Action Banner */}
        <div className="p-3 p-md-3.5 bg-light rounded-3 border d-flex flex-column flex-md-row align-items-start align-items-md-center justify-content-between gap-3 mb-3">
          <div>
            <h6 className="fw-bold text-navy-900 mb-1">Kalkulasi Rute Terdekat</h6>
            <p className="text-navy-600 small mb-0">
              Gunakan lokasi GPS perangkat kurir saat ini untuk mengurutkan daftar pengantaran dari jarak yang paling efisien.
            </p>
          </div>
          <div className="w-100 w-md-auto flex-shrink-0">
            <button
              type="button"
              className="btn btn-primary btn-touch w-100 w-md-auto px-4 py-2 fw-bold"
              onClick={handleStartDelivery}
              disabled={loading || readOnly}
              title={readOnly ? 'Tidak dapat memulai rute pada hari yang sudah ditutup' : 'Mulai Pengantaran'}
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="spinner-border-sm animate-spin" />
                  <span>
                    {loadingStep === 'gps' ? 'Membaca GPS Kurir...' : 'Menghitung Rute Terdekat...'}
                  </span>
                </>
              ) : (
                <>
                  <Navigation size={16} />
                  <span>Mulai Pengantaran</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Feedback Alerts */}
        {errorMsg && (
          <div className="alert alert-danger py-2.5 px-3 small mb-3 text-break-word d-flex align-items-center gap-2 rounded-3" role="alert">
            <AlertCircle size={16} className="text-danger flex-shrink-0" />
            <div>{errorMsg}</div>
          </div>
        )}

        {actionSuccessMsg && (
          <div className="alert alert-success py-2.5 px-3 small mb-3 text-break-word d-flex align-items-center gap-2 rounded-3" role="alert">
            <Check size={16} className="text-success flex-shrink-0" />
            <div>{actionSuccessMsg}</div>
          </div>
        )}

        {/* Subbagian 1: Urutan Pasien Terdekat */}
        {nearbyPatients !== null && (
          <div className="mt-4 pt-3 border-top">
            <div className="d-flex align-items-center justify-content-between mb-3">
              <h6 className="fw-bold text-navy-900 mb-0 d-flex align-items-center gap-2">
                <MapPin size={17} className="text-primary-600" />
                <span>Rekomendasi Urutan Pengantaran</span>
              </h6>
              <span className="badge bg-primary-50 text-primary-700 border border-primary-100 px-2.5 py-1">
                {nearbyPatients.length} Pasien Siap
              </span>
            </div>

            {nearbyPatients.length === 0 ? (
              <div className="p-4 bg-light rounded-3 text-center border">
                <MapPin size={28} className="text-navy-400 mb-2" />
                <h6 className="text-navy-800 fw-bold mb-1">Belum Ada Pasien yang Siap Diantar</h6>
                <p className="text-navy-500 small mb-0">
                  Semua pasien belum mengisi titik lokasi atau paket sudah dalam perjalanan.
                </p>
              </div>
            ) : (
              <div className="row row-cols-1 row-cols-md-2 g-3">
                {nearbyPatients.map((pasien, idx) => (
                  <div className="col" key={pasien.id || idx}>
                    <div className="card h-100 border p-3 bg-white">
                      <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                        <div className="d-flex align-items-center gap-2">
                          <span className="sequence-number-pill">{idx + 1}</span>
                          <h6 className="card-title fw-bold mb-0 text-navy-900 text-break-word">
                            {pasien.nama}
                          </h6>
                        </div>
                        <span className="status-badge status-badge-siap">Siap Diantar</span>
                      </div>

                      <p className="text-navy-600 small mb-3 flex-grow-1 text-break-word">
                        <strong>Alamat:</strong> {pasien.alamat}
                      </p>

                      <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center pt-2.5 border-top mt-auto gap-2">
                        <div className="small fw-semibold text-primary-700 d-flex align-items-center gap-1.5">
                          <Navigation size={14} />
                          <span>Jarak: {formatDistance(pasien.jarak_km)} km</span>
                        </div>

                        <div className="d-flex gap-2 w-100 w-sm-auto">
                          {pasien.latitude && pasien.longitude && (
                            <button
                              type="button"
                              className="btn btn-outline-primary btn-sm btn-touch flex-fill flex-sm-grow-0"
                              onClick={() => handleOpenRoute(pasien.latitude, pasien.longitude)}
                              title="Buka rute navigasi Google Maps"
                            >
                              <ExternalLink size={14} />
                              <span>Buka Rute</span>
                            </button>
                          )}

                          <button
                            type="button"
                            className="btn btn-success btn-sm btn-touch flex-fill flex-sm-grow-0 fw-bold"
                            onClick={() => handleMulaiAntar(pasien, idx + 1)}
                            disabled={startingId === pasien.id || readOnly}
                            title={readOnly ? 'Mode read-only aktif' : 'Mulai Antar'}
                          >
                            {startingId === pasien.id ? (
                              <>
                                <Loader2 size={14} className="spinner-border-sm animate-spin" />
                                <span>Memulai...</span>
                              </>
                            ) : (
                              <>
                                <Send size={14} />
                                <span>Mulai Antar</span>
                              </>
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
        )}

        {/* Subbagian 2: Pengantaran Sedang Berlangsung */}
        <div className="mt-4 pt-3 border-top">
          <div className="d-flex align-items-center justify-content-between mb-3">
            <h6 className="fw-bold text-navy-900 mb-0 d-flex align-items-center gap-2">
              <Truck size={17} className="text-primary-600" />
              <span>Pengantaran Berlangsung</span>
            </h6>
            <span className="badge bg-warning-subtle text-warning-emphasis border border-warning-subtle px-2.5 py-1">
              {ongoingDeliveries.length} Dalam Perjalanan
            </span>
          </div>

          {ongoingDeliveries.length === 0 ? (
            <div className="p-4 bg-light rounded-3 text-center border">
              <Truck size={28} className="text-navy-400 mb-2" />
              <h6 className="text-navy-800 fw-bold mb-1">Tidak Ada Pengantaran Aktif</h6>
              <p className="text-navy-500 small mb-0">
                Pilih pasien dari daftar rute di atas lalu klik &quot;Mulai Antar&quot; untuk memulai proses pengantaran.
              </p>
            </div>
          ) : (
            <div className="row row-cols-1 row-cols-md-2 g-3">
              {ongoingDeliveries.map((peng, idx) => (
                <div className="col" key={peng.id || idx}>
                  <div className="card h-100 border p-3 bg-white" style={{ borderColor: 'var(--status-dalam-border)' }}>
                    <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                      <div className="d-flex align-items-center gap-2">
                        <span className="sequence-number-pill" style={{ backgroundColor: '#0284c7' }}>
                          {peng.urutan}
                        </span>
                        <h6 className="card-title fw-bold mb-0 text-navy-900 text-break-word">
                          {peng.pasien?.nama || '-'}
                        </h6>
                      </div>
                      <span className="status-badge status-badge-dalam">
                        Dalam Pengantaran
                      </span>
                    </div>

                    <p className="text-navy-600 small mb-2 flex-grow-1 text-break-word">
                      <strong>Alamat:</strong> {peng.pasien?.alamat || '-'}
                    </p>

                    <div className="d-flex flex-column flex-sm-row justify-content-between align-items-start align-items-sm-center pt-2.5 border-top mt-auto gap-2">
                      <div className="small text-navy-600">
                        <div className="fw-semibold text-primary-700">
                          Jarak: {formatDistance(peng.jarak_km)} km
                        </div>
                        <div className="d-flex align-items-center gap-1 text-navy-500 mt-0.5">
                          <Clock size={12} />
                          <span>Mulai: {peng.waktu_mulai ? new Date(peng.waktu_mulai).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="btn btn-outline-danger btn-sm btn-touch w-100 w-sm-auto fw-bold"
                        onClick={() => handleSelesaikanPengantaran(peng)}
                        disabled={completingId === peng.id || readOnly}
                        title={readOnly ? 'Mode read-only aktif' : 'Selesaikan Pengantaran'}
                      >
                        {completingId === peng.id ? (
                          <>
                            <Loader2 size={14} className="spinner-border-sm animate-spin" />
                            <span>Menyelesaikan...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 size={15} />
                            <span>Selesaikan Pengantaran</span>
                          </>
                        )}
                      </button>
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
