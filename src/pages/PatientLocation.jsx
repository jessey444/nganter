import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  MapPin,
  CheckCircle2,
  Navigation,
  RefreshCw,
  AlertTriangle,
  AlertCircle,
  Truck,
  Loader2,
  ShieldCheck,
  Smartphone
} from 'lucide-react'

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
          'Terima kasih. Titik koordinat Anda telah berhasil diterima dan pengantaran obat akan segera diproses.'
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
      setErrorMsg('Browser Anda tidak mendukung fitur lokasi GPS.')
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
            `Lokasi perangkat Anda kurang presisi (toleransi ±${accuracyRounded} meter). Silakan aktifkan GPS/Lokasi perangkat berpresisi tinggi lalu coba lagi.`
          )
          setLoading(false)
          return
        }

        // Jika akurasi bagus (<= 100m), langsung kirim ke server
        if (accuracy <= IDEAL_ACCURACY_METERS) {
          await sendLocationToServer(latitude, longitude)
        } else {
          // Akurasi sedang (100m - 5000m): izinkan kirim dengan tombol konfirmasi
          setLoading(false)
        }
      },
      (error) => {
        setLoading(false)
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setErrorMsg(
              'Akses lokasi ditolak. Silakan aktifkan izin lokasi di peramban (browser) Anda agar kurir dapat menemukan alamat Anda.'
            )
            break
          case error.POSITION_UNAVAILABLE:
            setErrorMsg(
              'Sinyal GPS lokasi tidak terdeteksi. Pastikan GPS/Lokasi perangkat telah aktif.'
            )
            break
          case error.TIMEOUT:
            setErrorMsg(
              'Waktu pencarian lokasi GPS habis. Pastikan GPS aktif lalu klik coba lagi.'
            )
            break
          default:
            setErrorMsg('Gagal membaca lokasi perangkat. Silakan coba kembali.')
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
    <div className="min-vh-100 d-flex flex-column align-items-center justify-content-center p-3" style={{ backgroundColor: 'var(--navy-50)' }}>
      <div className="w-100" style={{ maxWidth: '480px' }}>
        {/* Brand Header */}
        <div className="text-center mb-4">
          <div className="brand-badge mx-auto mb-2.5">
            <Truck size={24} />
          </div>
          <h4 className="fw-bold text-navy-900 mb-0">Nganter</h4>
          <span className="text-navy-500 small">Konfirmasi Lokasi Pengantaran Obat</span>
        </div>

        {/* Card Main */}
        <div className="card shadow-md border rounded-4 overflow-hidden bg-white">
          <div className="card-body p-4 text-center">
            {isSuccess ? (
              /* Success State */
              <div className="py-3">
                <div className="p-3 bg-success-subtle text-success rounded-circle d-inline-flex mb-3">
                  <CheckCircle2 size={42} />
                </div>
                <h4 className="fw-bold text-navy-900 mb-2">Lokasi Berhasil Diterima</h4>
                {accuracyInfo !== null && (
                  <div className="mb-3">
                    <span className="badge bg-success-subtle text-success border border-success-subtle px-3 py-1.5 font-monospace">
                      Akurasi GPS: ±{accuracyInfo} meter
                    </span>
                  </div>
                )}
                <p className="text-navy-600 small mb-0 px-2">
                  {successMsg}
                </p>
                <div className="mt-4 p-3 bg-light rounded-3 text-start small border">
                  <div className="d-flex align-items-center gap-2 text-navy-700 fw-semibold mb-1">
                    <ShieldCheck size={16} className="text-success" />
                    <span>Langkah Selanjutnya:</span>
                  </div>
                  <p className="text-navy-500 mb-0">
                    Kurir kami akan menghitung rute tercepat dan mengantarkan paket obat langsung ke alamat Anda. Anda dapat menutup halaman ini.
                  </p>
                </div>
              </div>
            ) : (
              /* Initial & Action State */
              <>
                <div className="p-3 bg-primary-50 text-primary-600 rounded-circle d-inline-flex mb-3">
                  <MapPin size={38} />
                </div>
                <h5 className="fw-bold text-navy-900 mb-1.5">Bagikan Lokasi Anda</h5>
                <p className="text-navy-600 small mb-3">
                  Tekan tombol di bawah ini agar kurir dapat mengetahui titik temu pengantaran obat dengan presisi.
                </p>

                <div className="p-2.5 bg-light rounded-3 border text-start small mb-3 text-navy-600 d-flex align-items-start gap-2">
                  <Smartphone size={16} className="text-navy-400 flex-shrink-0 mt-0.5" />
                  <span>
                    Pastikan GPS di HP Anda sudah aktif dan Anda berada di lokasi penerimaan obat.
                  </span>
                </div>

                {/* Informasi Akurasi Sedang */}
                {accuracyInfo !== null && (
                  <div className="mb-3">
                    {accuracyInfo <= IDEAL_ACCURACY_METERS ? (
                      <span className="badge bg-success-subtle text-success border border-success-subtle px-3 py-1.5 font-monospace">
                        Akurasi sangat baik: ±{accuracyInfo} m
                      </span>
                    ) : (
                      <div className="alert alert-warning py-2.5 px-3 mb-0 small text-start rounded-3">
                        <div className="d-flex align-items-center gap-1.5 fw-bold text-warning-emphasis mb-1">
                          <AlertTriangle size={15} />
                          <span>Akurasi GPS: ±{accuracyInfo} meter</span>
                        </div>
                        <p className="mb-0 text-navy-600 fs-7">
                          Akurasi belum optimal. Jika Anda membuka tautan ini dari PC/Laptop, disarankan membuka dari HP dengan GPS menyala.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {errorMsg && (
                  <div className="alert alert-danger py-2.5 px-3 small mb-3 text-start rounded-3 d-flex align-items-center gap-2" role="alert">
                    <AlertCircle size={16} className="text-danger flex-shrink-0" />
                    <div>{errorMsg}</div>
                  </div>
                )}

                <div className="d-grid gap-2 pt-2">
                  {/* Tombol kirim paksa jika akurasi > 100m tetapi <= 5000m */}
                  {accuracyInfo !== null && accuracyInfo > IDEAL_ACCURACY_METERS && coords && !loading ? (
                    <>
                      <button
                        type="button"
                        className="btn btn-primary btn-touch py-2.5 fw-bold"
                        onClick={handleForceSend}
                      >
                        <Navigation size={16} />
                        <span>Kirim Titik Ini (±{accuracyInfo}m)</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-touch py-2"
                        onClick={handleGetLocation}
                      >
                        <RefreshCw size={15} />
                        <span>Pindai Ulang GPS</span>
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-primary btn-touch py-2.5 fw-bold shadow-sm"
                      onClick={handleGetLocation}
                      disabled={loading}
                    >
                      {loading ? (
                        <>
                          <Loader2 size={16} className="spinner-border-sm animate-spin" />
                          <span>
                            {loadingStep === 'getting'
                              ? 'Membaca Lokasi GPS...'
                              : 'Mengirim Titik Lokasi...'}
                          </span>
                        </>
                      ) : errorMsg ? (
                        <>
                          <RefreshCw size={16} />
                          <span>Coba Kirim Ulang</span>
                        </>
                      ) : (
                        <>
                          <Navigation size={16} />
                          <span>Kirim Lokasi Saya Sekarang</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="card-footer bg-light text-navy-400 text-center py-2.5 small border-top">
            <span className="fs-7">Nganter Healthcare Logistics &bull; Aman &amp; Terenkripsi</span>
          </div>
        </div>
      </div>
    </div>
  )
}
