import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const IDEAL_ACCURACY_METERS = 100
const MAX_ACCURACY_METERS = 5000

export default function PatientLocation() {
  const { token } = useParams()

  const [loading, setLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState('') // 'getting' | 'sending'
  const [errorMsg, setErrorMsg] = useState('')
  const [accuracyInfo, setAccuracyInfo] = useState(null)
  const [coords, setCoords] = useState(null) // { latitude, longitude }
  const [isSuccess, setIsSuccess] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')

  const sendLocationToServer = async (latitude, longitude) => {
    setLoading(true)
    setLoadingStep('sending')
    setErrorMsg('')

    try {
      const { data, error } = await supabase.rpc('simpan_lokasi_pasien', {
        p_token: token,
        p_latitude: latitude,
        p_longitude: longitude
      })

      if (error) {
        throw error
      }

      if (data && data.success === true) {
        setIsSuccess(true)
        setSuccessMsg(
          data.message ||
          'Terima kasih. Lokasi Anda sudah diterima dan pengantaran obat akan diproses.'
        )
      } else {
        setErrorMsg(
          (data && data.message) ||
          'Gagal menyimpan lokasi. Pasien atau token tidak ditemukan.'
        )
      }
    } catch (err) {
      console.error('Error simpan_lokasi_pasien:', err)
      setErrorMsg(err.message || 'Terjadi kesalahan saat mengirim lokasi ke server.')
    } finally {
      setLoading(false)
    }
  }

  const handleGetLocation = () => {
    setErrorMsg('')
    setSuccessMsg('')
    setAccuracyInfo(null)
    setCoords(null)

    if (!token) {
      setErrorMsg('Token lokasi tidak ditemukan pada URL.')
      return
    }

    if (!navigator.geolocation) {
      setErrorMsg('Browser Anda tidak mendukung fitur lokasi.')
      return
    }

    setLoading(true)
    setLoadingStep('getting')

    const options = {
      enableHighAccuracy: true,
      timeout: 20000,
      maximumAge: 0
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords
        const accuracyRounded = Math.round(accuracy)
        setAccuracyInfo(accuracyRounded)
        setCoords({ latitude, longitude })

        // Validasi koordinat
        if (
          typeof latitude !== 'number' ||
          typeof longitude !== 'number' ||
          latitude < -90 ||
          latitude > 90 ||
          longitude < -180 ||
          longitude > 180
        ) {
          setErrorMsg('Koordinat lokasi yang diterima tidak valid.')
          setLoading(false)
          return
        }

        // Jika akurasi melebihi batas maksimal 5km
        if (accuracy > MAX_ACCURACY_METERS) {
          setErrorMsg(
            `Lokasi Anda terlalu jauh/tidak presisi (±${accuracyRounded} meter). Silakan aktifkan GPS/Lokasi perangkat, lalu coba lagi.`
          )
          setLoading(false)
          return
        }

        // Jika akurasi bagus (<= 100m), langsung kirim ke server
        if (accuracy <= IDEAL_ACCURACY_METERS) {
          await sendLocationToServer(latitude, longitude)
        } else {
          // Akurasi sedang/Wi-Fi (100m - 5000m): tampilkan peringatan tetapi izinkan kirim lokasi
          setLoading(false)
        }
      },
      (error) => {
        setLoading(false)
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setErrorMsg(
              'Lokasi tidak diizinkan. Silakan aktifkan izin lokasi pada browser/perangkat Anda.'
            )
            break
          case error.POSITION_UNAVAILABLE:
            setErrorMsg(
              'Lokasi tidak tersedia. Pastikan GPS/Lokasi aktif dan coba lagi.'
            )
            break
          case error.TIMEOUT:
            setErrorMsg(
              'Pengambilan lokasi terlalu lama. Pastikan GPS/Lokasi aktif dan coba lagi.'
            )
            break
          default:
            setErrorMsg('Gagal mendapatkan lokasi. Silakan coba lagi.')
            break
        }
      },
      options
    )
  }

  const handleForceSend = async () => {
    if (coords && coords.latitude && coords.longitude) {
      await sendLocationToServer(coords.latitude, coords.longitude)
    }
  }

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-md-8 col-lg-6">
          <div className="card shadow border-0">
            <div className="card-header bg-primary text-white py-3 text-center">
              <h5 className="mb-0 fw-bold">Sistem Pengantaran Obat</h5>
              <small className="opacity-75">Konfirmasi Lokasi Pasien</small>
            </div>

            <div className="card-body p-4 text-center">
              {isSuccess ? (
                /* Success State */
                <div className="py-3">
                  <div className="fs-1 text-success mb-3">✅</div>
                  <h4 className="fw-bold text-success mb-2">Lokasi Berhasil Dikirim</h4>
                  {accuracyInfo !== null && (
                    <span className="badge bg-success-subtle text-success border border-success-subtle mb-3 px-3 py-2">
                      Akurasi lokasi: ±{accuracyInfo} meter
                    </span>
                  )}
                  <p className="card-text text-secondary mb-0">
                    {successMsg}
                  </p>
                </div>
              ) : (
                /* Initial & Action State */
                <>
                  <div className="mb-3">
                    <span className="fs-1">📍</span>
                  </div>
                  <h4 className="fw-bold mb-2">Kirim Lokasi Anda</h4>
                  <p className="card-text text-secondary mb-3">
                    Untuk membantu kami mengantarkan obat ke alamat yang presisi,
                    silakan kirim lokasi Anda saat ini.
                  </p>
                  <p className="small text-muted mb-4 bg-light p-2 rounded border">
                    💡 Pastikan Anda berada di lokasi pasien dan GPS/Lokasi perangkat aktif.
                  </p>

                  {/* Informasi Akurasi */}
                  {accuracyInfo !== null && (
                    <div className="mb-3">
                      {accuracyInfo <= IDEAL_ACCURACY_METERS ? (
                        <span className="badge bg-success-subtle text-success border border-success-subtle px-3 py-2">
                          Akurasi lokasi sangat baik: ±{accuracyInfo} meter
                        </span>
                      ) : (
                        <div className="alert alert-warning py-2 px-3 mb-0 small text-start">
                          <div className="fw-bold mb-1">
                            ⚠️ Akurasi Lokasi: ±{accuracyInfo} meter
                          </div>
                          <p className="mb-1 text-secondary">
                            Akurasi kurang presisi (biasanya terjadi jika membuka dari Laptop/PC atau Wi-Fi tanpa hardware GPS).
                          </p>
                          <p className="mb-0 text-muted fst-italic">
                            💡 Untuk akurasi terbaik (±10m), silakan buka link ini melalui Smartphone dengan GPS aktif.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {errorMsg && (
                    <div className="alert alert-danger py-2 small mb-4" role="alert">
                      {errorMsg}
                    </div>
                  )}

                  {!loading && !errorMsg && accuracyInfo === null && (
                    <p className="text-muted small mb-3 fst-italic">
                      Status: Menunggu Anda mengirim lokasi.
                    </p>
                  )}

                  <div className="d-grid gap-2">
                    {/* Tombol kirim paksa jika akurasi > 100m tetapi <= 5000m */}
                    {accuracyInfo !== null && accuracyInfo > IDEAL_ACCURACY_METERS && coords && !loading ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-warning btn-lg py-3 fw-bold shadow-sm text-dark"
                          onClick={handleForceSend}
                        >
                          📍 Tetap Kirim Lokasi Ini (±{accuracyInfo}m)
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline-secondary btn-sm py-2"
                          onClick={handleGetLocation}
                        >
                          🔄 Ambil Ulang GPS
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-primary btn-lg py-3 fw-bold shadow-sm"
                        onClick={handleGetLocation}
                        disabled={loading}
                      >
                        {loading ? (
                          <>
                            <span
                              className="spinner-border spinner-border-sm me-2"
                              role="status"
                              aria-hidden="true"
                            ></span>
                            {loadingStep === 'getting'
                              ? '📍 Mengambil lokasi GPS...'
                              : 'Mengirim lokasi...'}
                          </>
                        ) : errorMsg ? (
                          '📍 Coba Lagi'
                        ) : (
                          '📍 Kirim Lokasi Saya Saat Ini'
                        )}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="card-footer bg-light text-muted text-center py-2 small">
              Layanan Pengantaran Obat Pintar
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
