import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import PatientForm from '../components/PatientForm'
import RequestLocationButton from '../components/RequestLocationButton'
import DeliveryStart from '../components/DeliveryStart'
import PatientEditModal from '../components/PatientEditModal'
import { getJakartaDateString } from '../lib/utils'
import {
  Package,
  Clock,
  Send,
  Truck,
  CheckCircle2,
  Plus,
  Lock,
  Calendar,
  Search,
  Pencil,
  MapPin,
  Phone,
  ExternalLink,
  AlertCircle,
  AlertTriangle,
  X,
  Loader2,
  Users,
  Compass,
  Check
} from 'lucide-react'

export default function Dashboard() {
  const [pasienList, setPasienList] = useState([])
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingPasien, setEditingPasien] = useState(null)

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')

  // Penutupan Hari Operasional State
  const [currentDate] = useState(() => getJakartaDateString())
  const [dayStatus, setDayStatus] = useState(null) // 'BUKA' | 'TUTUP' | null
  const [showCloseConfirmModal, setShowCloseConfirmModal] = useState(false)
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

  // Hitungan Statistik Real-Time
  const stats = useMemo(() => {
    const total = pasienList.length
    const menunggu = pasienList.filter((p) => p.status === 'MENUNGGU_LOKASI').length
    const siap = pasienList.filter((p) => p.status === 'SIAP_ANTAR').length
    const dalam = pasienList.filter((p) => p.status === 'DALAM_PENGANTARAN').length
    const selesai = pasienList.filter((p) => p.status === 'SELESAI').length
    const belumSelesai = total - selesai
    return { total, menunggu, siap, dalam, selesai, belumSelesai }
  }, [pasienList])

  // Filter & Search Pasien
  const filteredPasienList = useMemo(() => {
    return pasienList.filter((p) => {
      const matchSearch =
        p.nama.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.alamat && p.alamat.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (p.nomor_wa && p.nomor_wa.includes(searchTerm))
      const matchStatus = statusFilter === 'ALL' || p.status === statusFilter
      return matchSearch && matchStatus
    })
  }, [pasienList, searchTerm, statusFilter])

  const executeTutupHari = async () => {
    if (closingDay) return
    setClosureAlert(null)
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
        setShowCloseConfirmModal(false)
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
        setShowCloseConfirmModal(false)
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
      setShowCloseConfirmModal(false)
    } finally {
      setClosingDay(false)
    }
  }

  const renderStatusBadge = (status) => {
    switch (status) {
      case 'MENUNGGU_LOKASI':
        return (
          <span className="status-badge status-badge-menunggu">
            <Clock size={12} />
            <span>Menunggu Lokasi</span>
          </span>
        )
      case 'SIAP_ANTAR':
        return (
          <span className="status-badge status-badge-siap">
            <Send size={12} />
            <span>Siap Antar</span>
          </span>
        )
      case 'DALAM_PENGANTARAN':
        return (
          <span className="status-badge status-badge-dalam">
            <Truck size={12} />
            <span>Dalam Pengantaran</span>
          </span>
        )
      case 'SELESAI':
        return (
          <span className="status-badge status-badge-selesai">
            <CheckCircle2 size={12} />
            <span>Selesai</span>
          </span>
        )
      default:
        return (
          <span className="badge bg-secondary">
            {status || 'Tidak Diketahui'}
          </span>
        )
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
    <div className="min-vh-100 d-flex flex-column" style={{ backgroundColor: 'var(--navy-50)' }}>
      {/* ====================================================================
          App Header
          ==================================================================== */}
      <header className="app-header py-3 px-3 px-md-4">
        <div className="container-fluid px-0 px-lg-3">
          <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center gap-3">
            {/* Identity & Status */}
            <div className="d-flex align-items-center gap-3">
              <div className="brand-badge">
                <Truck size={24} />
              </div>
              <div>
                <div className="d-flex align-items-center gap-2">
                  <h1 className="h4 mb-0 fw-bold text-navy-900">Nganter</h1>
                  <span className="badge bg-primary-50 text-primary-700 border border-primary-100 fw-semibold fs-7">
                    Sistem Logistik Obat
                  </span>
                </div>
                <div className="d-flex align-items-center gap-2 flex-wrap mt-1">
                  <span className="header-date-badge">
                    <Calendar size={13} />
                    <span>{currentDate} (WIB)</span>
                  </span>

                  {dayStatus === 'TUTUP' ? (
                    <span className="header-status-pill header-status-closed">
                      <Lock size={12} />
                      <span>Operasional Ditutup</span>
                    </span>
                  ) : (
                    <span className="header-status-pill header-status-open">
                      <span className="pulse-dot"></span>
                      <span>Operasional Buka</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="d-flex flex-column flex-sm-row align-items-stretch align-items-sm-center gap-2 w-100 w-md-auto">
              {/* Tombol Selesaikan Hari Ini */}
              <button
                type="button"
                className="btn btn-outline-danger btn-touch px-3"
                onClick={() => setShowCloseConfirmModal(true)}
                disabled={closingDay || dayStatus === 'TUTUP'}
                title={dayStatus === 'TUTUP' ? 'Hari operasional ini sudah ditutup' : 'Selesaikan dan tutup hari operasional'}
              >
                <Lock size={15} />
                <span>{dayStatus === 'TUTUP' ? 'Hari Ditutup' : 'Selesaikan Hari Ini'}</span>
              </button>

              {/* Tombol Tambah Pasien (Primary) */}
              <button
                type="button"
                className="btn btn-primary btn-touch px-4 shadow-sm"
                onClick={() => setShowForm(true)}
                disabled={dayStatus === 'TUTUP'}
                title={dayStatus === 'TUTUP' ? 'Hari operasional sudah ditutup, paket baru tidak dapat dibuat.' : 'Tambah Pasien Baru'}
              >
                <Plus size={18} />
                <span>Tambah Pasien</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <div className="container-fluid px-3 px-md-4 py-4 flex-grow-1" style={{ maxWidth: '1400px' }}>
        {/* Alert Notifikasi Penutupan Hari */}
        {closureAlert && (
          <div className={`alert alert-${closureAlert.type} alert-dismissible fade show mb-4 d-flex align-items-center justify-content-between rounded-3 shadow-sm`} role="alert">
            <div className="d-flex align-items-center gap-2">
              {closureAlert.type === 'success' ? (
                <CheckCircle2 size={18} className="text-success flex-shrink-0" />
              ) : (
                <AlertCircle size={18} className="text-danger flex-shrink-0" />
              )}
              <span className="small fw-medium">{closureAlert.text}</span>
            </div>
            <button
              type="button"
              className="btn-close ms-2"
              onClick={() => setClosureAlert(null)}
              aria-label="Tutup"
            ></button>
          </div>
        )}

        {/* ====================================================================
            Ringkasan Statistik (5 KPI Cards with Real State Counts)
            ==================================================================== */}
        <section className="mb-4" aria-label="Ringkasan Statistik">
          <div className="row g-2 g-md-3">
            {/* Total Pasien */}
            <div className="col-6 col-md-4 col-xl">
              <div
                className={`stat-card h-100 ${statusFilter === 'ALL' ? 'stat-card-active' : ''}`}
                onClick={() => setStatusFilter('ALL')}
                title="Tampilkan seluruh pasien"
              >
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <span className="stat-label">Total Pasien</span>
                  <div className="stat-icon-wrapper bg-primary-50 text-primary-600">
                    <Package size={18} />
                  </div>
                </div>
                <div className="stat-number">{stats.total}</div>
              </div>
            </div>

            {/* Menunggu Lokasi */}
            <div className="col-6 col-md-4 col-xl">
              <div
                className={`stat-card h-100 ${statusFilter === 'MENUNGGU_LOKASI' ? 'stat-card-active' : ''}`}
                onClick={() => setStatusFilter(statusFilter === 'MENUNGGU_LOKASI' ? 'ALL' : 'MENUNGGU_LOKASI')}
                title="Filter: Menunggu Lokasi"
              >
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <span className="stat-label">Menunggu Lokasi</span>
                  <div className="stat-icon-wrapper" style={{ backgroundColor: 'var(--status-menunggu-bg)', color: 'var(--status-menunggu-text)' }}>
                    <Clock size={18} />
                  </div>
                </div>
                <div className="stat-number" style={{ color: 'var(--status-menunggu-text)' }}>
                  {stats.menunggu}
                </div>
              </div>
            </div>

            {/* Siap Antar */}
            <div className="col-6 col-md-4 col-xl">
              <div
                className={`stat-card h-100 ${statusFilter === 'SIAP_ANTAR' ? 'stat-card-active' : ''}`}
                onClick={() => setStatusFilter(statusFilter === 'SIAP_ANTAR' ? 'ALL' : 'SIAP_ANTAR')}
                title="Filter: Siap Antar"
              >
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <span className="stat-label">Siap Antar</span>
                  <div className="stat-icon-wrapper" style={{ backgroundColor: 'var(--status-siap-bg)', color: 'var(--status-siap-text)' }}>
                    <Send size={18} />
                  </div>
                </div>
                <div className="stat-number" style={{ color: 'var(--status-siap-text)' }}>
                  {stats.siap}
                </div>
              </div>
            </div>

            {/* Dalam Pengantaran */}
            <div className="col-6 col-md-6 col-xl">
              <div
                className={`stat-card h-100 ${statusFilter === 'DALAM_PENGANTARAN' ? 'stat-card-active' : ''}`}
                onClick={() => setStatusFilter(statusFilter === 'DALAM_PENGANTARAN' ? 'ALL' : 'DALAM_PENGANTARAN')}
                title="Filter: Dalam Pengantaran"
              >
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <span className="stat-label">Dalam Antar</span>
                  <div className="stat-icon-wrapper" style={{ backgroundColor: 'var(--status-dalam-bg)', color: 'var(--status-dalam-text)' }}>
                    <Truck size={18} />
                  </div>
                </div>
                <div className="stat-number" style={{ color: 'var(--status-dalam-text)' }}>
                  {stats.dalam}
                </div>
              </div>
            </div>

            {/* Selesai */}
            <div className="col-12 col-md-6 col-xl">
              <div
                className={`stat-card h-100 ${statusFilter === 'SELESAI' ? 'stat-card-active' : ''}`}
                onClick={() => setStatusFilter(statusFilter === 'SELESAI' ? 'ALL' : 'SELESAI')}
                title="Filter: Selesai"
              >
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <span className="stat-label">Selesai</span>
                  <div className="stat-icon-wrapper" style={{ backgroundColor: 'var(--status-selesai-bg)', color: 'var(--status-selesai-text)' }}>
                    <CheckCircle2 size={18} />
                  </div>
                </div>
                <div className="stat-number" style={{ color: 'var(--status-selesai-text)' }}>
                  {stats.selesai}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ====================================================================
            Panel Operasional Pengantaran (GPS & Routing)
            ==================================================================== */}
        <DeliveryStart />

        {/* Global Error Banner */}
        {errorMsg && (
          <div className="alert alert-danger d-flex align-items-center gap-2 mb-4 rounded-3 shadow-sm" role="alert">
            <AlertCircle size={18} className="text-danger flex-shrink-0" />
            <div>
              <strong>Terjadi Masalah: </strong>{errorMsg}
            </div>
          </div>
        )}

        {/* ====================================================================
            Daftar Pasien Section
            ==================================================================== */}
        <section className="mt-4" aria-label="Daftar Pasien">
          {/* Section Toolbar: Search, Filters & Counters */}
          <div className="card p-3 p-md-3.5 mb-3 border">
            <div className="d-flex flex-column flex-lg-row align-items-start align-items-lg-center justify-content-between gap-3">
              {/* Title & Total Count */}
              <div className="d-flex align-items-center gap-2">
                <Users size={20} className="text-primary-600" />
                <h5 className="fw-bold mb-0 text-navy-900 fs-6 fs-md-5">Daftar Pasien Hari Ini</h5>
                <span className="badge bg-navy-100 text-navy-700 border font-monospace px-2.5 py-1">
                  {filteredPasienList.length} / {pasienList.length}
                </span>
              </div>

              {/* Search Bar */}
              <div className="search-input-wrapper" style={{ maxWidth: '420px' }}>
                <Search size={16} className="search-icon" />
                <input
                  type="text"
                  className="form-control"
                  placeholder="Cari nama pasien, alamat, atau no. WA..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button
                    type="button"
                    className="btn btn-sm btn-link text-navy-400 position-absolute end-0 me-2 text-decoration-none"
                    onClick={() => setSearchTerm('')}
                    title="Hapus pencarian"
                  >
                    <X size={15} />
                  </button>
                )}
              </div>
            </div>

            {/* Filter Pills */}
            <div className="d-flex align-items-center gap-2 flex-wrap mt-3 pt-3 border-top">
              <span className="small text-navy-500 fw-semibold me-1">Filter Status:</span>
              <button
                type="button"
                className={`filter-pill ${statusFilter === 'ALL' ? 'active' : ''}`}
                onClick={() => setStatusFilter('ALL')}
              >
                <span>Semua</span>
                <span className="pill-count">{stats.total}</span>
              </button>

              <button
                type="button"
                className={`filter-pill ${statusFilter === 'MENUNGGU_LOKASI' ? 'active' : ''}`}
                onClick={() => setStatusFilter('MENUNGGU_LOKASI')}
              >
                <Clock size={12} />
                <span>Menunggu Lokasi</span>
                <span className="pill-count">{stats.menunggu}</span>
              </button>

              <button
                type="button"
                className={`filter-pill ${statusFilter === 'SIAP_ANTAR' ? 'active' : ''}`}
                onClick={() => setStatusFilter('SIAP_ANTAR')}
              >
                <Send size={12} />
                <span>Siap Antar</span>
                <span className="pill-count">{stats.siap}</span>
              </button>

              <button
                type="button"
                className={`filter-pill ${statusFilter === 'DALAM_PENGANTARAN' ? 'active' : ''}`}
                onClick={() => setStatusFilter('DALAM_PENGANTARAN')}
              >
                <Truck size={12} />
                <span>Dalam Pengantaran</span>
                <span className="pill-count">{stats.dalam}</span>
              </button>

              <button
                type="button"
                className={`filter-pill ${statusFilter === 'SELESAI' ? 'active' : ''}`}
                onClick={() => setStatusFilter('SELESAI')}
              >
                <CheckCircle2 size={12} />
                <span>Selesai</span>
                <span className="pill-count">{stats.selesai}</span>
              </button>
            </div>
          </div>

          {/* Patient List Content */}
          {loading ? (
            <div className="card text-center py-5 border">
              <div className="d-flex justify-content-center mb-2">
                <Loader2 size={32} className="text-primary-600 animate-spin" />
              </div>
              <p className="text-navy-600 fw-medium mb-0">Memuat data pasien...</p>
            </div>
          ) : filteredPasienList.length === 0 ? (
            /* Empty State */
            <div className="card text-center p-4 p-sm-5 border-dashed my-3">
              <div className="card-body">
                <div className="p-3 bg-navy-50 text-navy-400 rounded-circle d-inline-flex mb-3">
                  <Package size={36} />
                </div>
                <h5 className="fw-bold text-navy-900 mb-1">
                  {searchTerm || statusFilter !== 'ALL'
                    ? 'Tidak Ada Pasien yang Sesuai'
                    : 'Belum Ada Data Pasien Hari Ini'}
                </h5>
                <p className="text-navy-500 small mb-4" style={{ maxWidth: '440px', margin: '0 auto' }}>
                  {searchTerm || statusFilter !== 'ALL'
                    ? 'Silakan ubah kata kunci pencarian atau sesuaikan filter status di atas.'
                    : 'Mulai operasional hari ini dengan menambahkan data pasien dan resep obat yang akan diantarkan.'}
                </p>

                {searchTerm || statusFilter !== 'ALL' ? (
                  <button
                    type="button"
                    className="btn btn-secondary btn-touch px-4"
                    onClick={() => {
                      setSearchTerm('')
                      setStatusFilter('ALL')
                    }}
                  >
                    Reset Filter Pencarian
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary btn-touch px-4"
                    onClick={() => setShowForm(true)}
                    disabled={dayStatus === 'TUTUP'}
                  >
                    <Plus size={16} />
                    <span>Tambah Pasien Pertama</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* Patient Grid */
            <div className="row row-cols-1 row-cols-md-2 row-cols-lg-3 g-3">
              {filteredPasienList.map((pasien) => (
                <div className="col" key={pasien.id}>
                  <div className="patient-card card h-100">
                    <div className="card-body d-flex flex-column p-3 p-sm-4">
                      {/* Patient Card Header */}
                      <div className="d-flex justify-content-between align-items-start gap-2 mb-2">
                        <h5 className="card-title mb-0 text-navy-900 fw-bold text-break-word me-1 fs-6 fs-sm-5" title={pasien.nama}>
                          {pasien.nama}
                        </h5>
                        <div className="flex-shrink-0">{renderStatusBadge(pasien.status)}</div>
                      </div>

                      {/* Alamat */}
                      <div className="d-flex align-items-start gap-2 mb-3 text-navy-600 small flex-grow-1">
                        <MapPin size={15} className="text-navy-400 flex-shrink-0 mt-0.5" />
                        <span className="text-break-word" style={{ whiteSpace: 'pre-line' }}>
                          {pasien.alamat}
                        </span>
                      </div>

                      {/* Info Detail */}
                      <div className="border-top pt-2.5 mt-auto small">
                        {/* WhatsApp Link */}
                        <div className="d-flex align-items-center gap-2 mb-1.5 text-break-word">
                          <Phone size={14} className="text-success flex-shrink-0" />
                          <span className="text-navy-500">WhatsApp:</span>
                          <a
                            href={`https://wa.me/${pasien.nomor_wa.replace(/[^0-9]/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-decoration-none fw-semibold text-success ms-auto"
                          >
                            {pasien.nomor_wa}
                          </a>
                        </div>

                        {/* Google Maps Link if available */}
                        {pasien.alamat_google_maps && (
                          <div className="d-flex align-items-center gap-2 mb-1.5">
                            <Compass size={14} className="text-primary-600 flex-shrink-0" />
                            <span className="text-navy-500">Titik Maps:</span>
                            <a
                              href={pasien.alamat_google_maps}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-decoration-none text-primary-600 d-inline-flex align-items-center gap-1 ms-auto"
                            >
                              <span>Buka Peta</span>
                              <ExternalLink size={12} />
                            </a>
                          </div>
                        )}

                        {/* Tanggal Operasional */}
                        {pasien.tanggal_operasional && (
                          <div className="d-flex align-items-center gap-2 text-navy-400 fs-7 mt-1">
                            <Calendar size={13} className="flex-shrink-0" />
                            <span>Tgl Operasional:</span>
                            <span className="font-monospace ms-auto">{pasien.tanggal_operasional}</span>
                          </div>
                        )}
                      </div>

                      {/* Action Bar (Edit & Minta Lokasi) */}
                      <div className="pt-2.5 mt-2.5 border-top d-flex flex-wrap gap-2">
                        {/* Tombol Edit Pasien hanya untuk status belum SELESAI */}
                        {pasien.status !== 'SELESAI' && (
                          <button
                            type="button"
                            className="btn btn-outline-primary btn-sm btn-touch flex-fill"
                            onClick={() => setEditingPasien(pasien)}
                            title="Edit data pasien"
                          >
                            <Pencil size={14} />
                            <span>Edit</span>
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
        </section>
      </div>

      {/* ====================================================================
          Modal: Tambah Pasien Baru
          ==================================================================== */}
      {showForm && (
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
                  <h5 className="modal-title fw-bold text-navy-900 mb-0">Tambah Pasien Baru</h5>
                  <small className="text-navy-500">Input data pasien &amp; alamat pengantaran obat</small>
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-light border p-1 rounded-circle"
                  aria-label="Tutup"
                  onClick={() => setShowForm(false)}
                >
                  <X size={18} />
                </button>
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

      {/* ====================================================================
          Modal: Edit Data Pasien
          ==================================================================== */}
      {editingPasien && (
        <PatientEditModal
          pasien={editingPasien}
          onSuccess={handleEditSuccess}
          onClose={() => setEditingPasien(null)}
        />
      )}

      {/* ====================================================================
          Modal: Konfirmasi Selesaikan & Tutup Hari Operasional
          ==================================================================== */}
      {showCloseConfirmModal && (
        <div
          className="modal fade show d-block"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)' }}
          role="dialog"
          aria-modal="true"
        >
          <div className="modal-dialog modal-md modal-dialog-centered">
            <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
              <div className="modal-header bg-white border-bottom py-3 px-4 d-flex justify-content-between align-items-center">
                <div className="d-flex align-items-center gap-2 text-danger">
                  <AlertTriangle size={20} />
                  <h5 className="modal-title fw-bold text-navy-900 mb-0">Tutup Hari Operasional</h5>
                </div>
                <button
                  type="button"
                  className="btn btn-sm btn-light border p-1 rounded-circle"
                  aria-label="Tutup"
                  onClick={() => setShowCloseConfirmModal(false)}
                  disabled={closingDay}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="modal-body p-4">
                <p className="text-navy-800 mb-3">
                  Apakah Anda yakin ingin menyelesaikan dan menutup hari operasional untuk tanggal:
                </p>

                <div className="p-3 bg-light rounded-3 border mb-3 text-center">
                  <span className="fw-bold font-monospace fs-5 text-navy-900">
                    {currentDate}
                  </span>
                </div>

                {stats.belumSelesai > 0 ? (
                  <div className="alert alert-warning py-2.5 px-3 small d-flex align-items-start gap-2 rounded-3 mb-3">
                    <AlertTriangle size={18} className="text-warning-emphasis flex-shrink-0 mt-0.5" />
                    <div>
                      <strong>Perhatian:</strong> Masih terdapat <strong>{stats.belumSelesai} paket</strong> yang belum berstatus <strong>SELESAI</strong>. Penutupan hari akan ditolak oleh sistem sampai semua paket diselesaikan.
                    </div>
                  </div>
                ) : (
                  <div className="alert alert-success py-2.5 px-3 small d-flex align-items-center gap-2 rounded-3 mb-3">
                    <Check size={18} className="text-success flex-shrink-0" />
                    <div>
                      Semua paket obat hari ini telah berstatus <strong>SELESAI</strong>. Hari operasional siap ditutup.
                    </div>
                  </div>
                )}

                <p className="text-navy-500 small mb-0">
                  Setelah hari operasional ditutup, paket baru tidak dapat ditambahkan lagi ke tanggal ini dan data akan dikunci secara permanen.
                </p>
              </div>

              <div className="modal-footer border-top bg-light p-3 d-flex justify-content-end gap-2">
                <button
                  type="button"
                  className="btn btn-secondary btn-touch px-4"
                  onClick={() => setShowCloseConfirmModal(false)}
                  disabled={closingDay}
                >
                  Batal
                </button>
                <button
                  type="button"
                  className="btn btn-danger btn-touch px-4 fw-bold"
                  onClick={executeTutupHari}
                  disabled={closingDay}
                >
                  {closingDay ? (
                    <>
                      <Loader2 size={16} className="spinner-border-sm animate-spin" />
                      <span>Menutup Hari...</span>
                    </>
                  ) : (
                    <>
                      <Lock size={16} />
                      <span>Ya, Tutup Hari Ini</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
