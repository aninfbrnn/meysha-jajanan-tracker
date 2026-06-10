'use client';

import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import Link from 'next/link';

const SELLER_OPTIONS = [
  "Sukwa GO (WA)", "Sleepyhead GO (LINE 1)", "Warung KPOP PAJI (WA)", 
  "GO TEUMET (LINE 1)", "LUMIYOSA GO (LINE 1)", "TEUVER:D GO (LINE 2)", 
  "CHIOMY (WA)", "MASHKIES GO (LINE 2)", "DEAR NADIYA (WA)", 
  "GO KAMCAJI (LINE 2)", "GO WOOKY (LINE 2)", "RUWPY GO (LINE)", 
  "LALULELANG HARTAKARUN (LINE 2)", "TEUMEN JAJAN (LINE 2)", 
  "TEUBROKE (LINE 2)", "TEUMEDEUL (LINE 2)", "GO BY BLOOM (WA)", 
  "LECY SOULGO (WA)", "KANEYOSH (WA)", "CHINGU TITIP GO (WA)", 
  "X/Twitter", "Shopee", "AYAJO GO (LINE 2)"
];

export default function JajananTrackerPage() {
  const formRef = useRef<HTMLDivElement>(null);
  const [daftarJajanan, setDaftarJajanan] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // State Modal untuk Lihat Gambar
  const [activeImageUrl, setActiveImageUrl] = useState<string | null>(null);

  // State Form Input
  const [form, setForm] = useState({
    kode: '',
    seller: '',
    nama_barang: '',
    jumlah_barang: '1',
    status: 'BELUM UPNOTES',
    harga_dasar: '',
    tax: '0',
    sudah_bayar: '',
    last_payment: '',
    max_tgl_co: '',
    notes: '',
    image_url: '' // Menyimpan link gambar
  });

  // Teks Tanggal Dibuat (Hanya untuk Tampilan Baca saat Edit)
  const [viewCreatedAt, setViewCreatedAt] = useState<string | null>(null);

  // State Filter & Sorting
  const [searchSeller, setSearchSeller] = useState('');
  const [filterStatusList, setFilterStatusList] = useState<string[]>([]);
  const [filterStatusMode, setFilterStatusMode] = useState<'include' | 'exclude'>('include');
  const [filterPelunasan, setFilterPelunasan] = useState('SEMUA'); 
  const [sortBy, setSortBy] = useState('created_at'); 
  const [sortOrder, setSortOrder] = useState('desc'); 

  // Fungsi pembantu tanggal
  const dapatkanTanggalHariIni = () => {
    const sekarang = new Date();
    return `${sekarang.getFullYear()}-${String(sekarang.getMonth() + 1).padStart(2, '0')}-${String(sekarang.getDate()).padStart(2, '0')}`;
  };

  const dapatkanTanggalSatuBulanLagi = () => {
    const sekarang = new Date();
    sekarang.setMonth(sekarang.getMonth() + 1);
    return `${sekarang.getFullYear()}-${String(sekarang.getMonth() + 1).padStart(2, '0')}-${String(sekarang.getDate()).padStart(2, '0')}`;
  };

  const tglHariIni = dapatkanTanggalHariIni();
  const tglSatuBulanLagi = dapatkanTanggalSatuBulanLagi();

  const isAutoLunas = ['UPNOTES PELUNASAN', 'UPNOTES LANGSUNG LUNAS', 'OS'].includes(form.status);
  const isTanpaCo = ['OS', 'UPNOTES LANGSUNG LUNAS'].includes(form.status);

  const muatDataJajanan = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('jajanan')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error(error.message);
    } else if (data) {
      setDaftarJajanan(data);
    }
    setIsLoading(false);
  };

  const handleToggleFilterStatus = (status: string) => {
    setFilterStatusList(prev =>
      prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]
    );
  };

  useEffect(() => {
    muatDataJajanan();
  }, []);

  // Handler Upload Gambar ke Supabase Storage Bucket
  const handleUploadGambar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      // Buat nama file unik memakai timestamp agar tidak bentrok
      const namaFile = `${Date.now()}_${file.name.replace(/\s+/g, '_')}`;

      // Upload file ke bucket 'bukti_jajanan'
      const { data, error } = await supabase.storage
        .from('bukti_jajanan')
        .upload(namaFile, file);

      if (error) throw error;

      // Ambil Public URL dari file yang berhasil di-upload
      const { data: publicUrlData } = supabase.storage
        .from('bukti_jajanan')
        .getPublicUrl(namaFile);

      setForm((prev) => ({ ...prev, image_url: publicUrlData.publicUrl }));
      alert('Gambar berhasil di-upload!');
    } catch (err: any) {
      alert('Gagal upload gambar: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  // Fungsi Submit (INSERT / UPDATE)
  const handleInsertAtauUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!form.nama_barang || !form.kode) {
      alert('Kode dan Nama Barang wajib diisi!');
      return;
    }

    let finalHargaDasar = Number(form.harga_dasar) || 0;
    let finalJumlahBarang = Number(form.jumlah_barang) || 1;
    let finalTax = Number(form.tax) || 0;
    let finalSudahBayar = Number(form.sudah_bayar) || 0;
    let finalMaxTglCo = form.max_tgl_co || '-';
    let finalNotes = form.notes || '-';
    let finalLastPayment = form.last_payment || '-';

    const sekarang = new Date();
    const formatWaktu = new Intl.DateTimeFormat('id-ID', {
      timeZone: 'Asia/Jakarta',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false
    }).format(sekarang);

    if (editingId) {
      const dataAsli = daftarJajanan.find(i => i.id === editingId);
      if (form.status === 'MASUK LIST CO') {
        const cekSisa = (finalHargaDasar + finalTax) - finalSudahBayar;
        if (cekSisa > 0) {
          alert('Gagal! Barang harus LUNAS terlebih dahulu sebelum masuk LIST CO.');
          return;
        }
      }
      if (form.status === 'ARRIVE HOME' && dataAsli?.status !== 'MASUK LIST CO') {
        alert('Gagal! Status harus MASUK LIST CO terlebih dahulu sebelum ke ARRIVE HOME.');
        return;
      }
    }

    if (form.status === 'UPNOTES PELUNASAN') {
      finalSudahBayar = finalHargaDasar + finalTax;
      finalLastPayment = tglHariIni;
      finalMaxTglCo = tglSatuBulanLagi;
      const stamp = `[Lunas Pelunasan pada ${formatWaktu} WIB]`;
      finalNotes = form.notes && form.notes !== '-' ? `${form.notes} ${stamp}` : stamp;
    } 
    else if (form.status === 'UPNOTES LANGSUNG LUNAS') {
      finalSudahBayar = finalHargaDasar + finalTax;
      finalLastPayment = tglHariIni;
      // finalMaxTglCo = '-'; // HAPUS/COMMENT BARIS INI agar nilai dari input form tetap tersimpan
      const stamp = `[Lunas Langsung pada ${formatWaktu} WIB]`;
      finalNotes = form.notes && form.notes !== '-' ? `${form.notes} ${stamp}` : stamp;
    }
    else if (form.status === 'OS') {
      finalSudahBayar = finalHargaDasar + finalTax;
      finalLastPayment = tglHariIni;
      finalMaxTglCo = '-';
      const stamp = `[OS Lunas pada ${formatWaktu} WIB]`;
      finalNotes = form.notes && form.notes !== '-' ? `${form.notes} ${stamp}` : stamp;
    }

    // Payload dikirim tanpa kolom created_at karena dihandle otomatis oleh database Supabase
    const payloadData = {
      kode: form.kode,
      seller: form.seller,
      nama_barang: form.nama_barang,
      jumlah_barang: finalJumlahBarang,
      status: form.status,
      harga_dasar: finalHargaDasar,
      tax: finalTax,
      sudah_bayar: finalSudahBayar,
      last_payment: finalLastPayment,
      max_tgl_co: finalMaxTglCo,
      notes: finalNotes,
      image_url: form.image_url || null
    };

    if (editingId) {
      const { error } = await supabase.from('jajanan').update(payloadData).eq('id', editingId);
      if (error) {
        alert('Gagal memperbarui data: ' + error.message);
      } else {
        setEditingId(null);
        muatDataJajanan();
        resetForm();
      }
    } else {
      const { error } = await supabase.from('jajanan').insert([payloadData]);
      if (error) {
        alert('Gagal menyimpan data: ' + error.message);
      } else {
        muatDataJajanan();
        resetForm();
      }
    }
  };

  const handlePicuEdit = (item: any) => {
    const regexTanggal = /^\d{4}-\d{2}-\d{2}$/;
    setEditingId(item.id);
    
    // Format tanggal input otomatis buatan database untuk ditampilkan di form (Read-Only)
    const tglDibuat = item.created_at ? new Date(item.created_at).toLocaleString('id-ID') : '-';
    setViewCreatedAt(tglDibuat);

    setForm({
      kode: item.kode || '',
      seller: item.seller || 'Sukwa GO (WA)',
      nama_barang: item.nama_barang || '',
      jumlah_barang: String(item.jumlah_barang || '1'),
      status: item.status || 'BELUM UPNOTES',
      harga_dasar: String(item.harga_dasar || ''),
      tax: String(item.tax || '0'),
      sudah_bayar: String(item.sudah_bayar || '0'),
      last_payment: regexTanggal.test(item.last_payment) ? item.last_payment : '',
      max_tgl_co: item.max_tgl_co === '-' ? '' : item.max_tgl_co,
      notes: item.notes || '',
      image_url: item.image_url || ''
    });

    formRef.current?.scrollIntoView({ 
      behavior: 'smooth', 
      block: 'start' 
    });
  };

  const handleHapusData = async (id: number, nama: string) => {
    const konfirmasi = confirm(`Apakah kamu yakin ingin menghapus "${nama}"?`);
    if (!konfirmasi) return;

    const { error } = await supabase.from('jajanan').delete().eq('id', id);
    if (error) {
      alert('Gagal menghapus: ' + error.message);
    } else {
      if (editingId === id) setEditingId(null);
      muatDataJajanan();
    }
  };

  const resetForm = () => {
    setViewCreatedAt(null);
    setForm({
      kode: '', seller: '', nama_barang: '', jumlah_barang: '', status: 'BELUM UPNOTES',
      harga_dasar: '', tax: '0', sudah_bayar: '0', last_payment: '', max_tgl_co: '', notes: '', image_url: ''
    });
  };

    const getStatusBadgeStyle = (status: string) => {
      switch (status) {
        case 'BELUM UPNOTES': return 'bg-red-600 text-white font-bold';
        case 'UPNOTES PERTAMA/DP': return 'bg-blue-600 text-white font-bold';
        case 'UPNOTES LANGSUNG LUNAS': return 'bg-yellow-500 text-white font-bold';
        case 'UPNOTES PELUNASAN': return 'bg-sky-500 text-white font-bold';
        case 'OS': return 'bg-slate-900 text-slate-100 font-bold border border-slate-600';
        case 'MASUK LIST CO': return 'bg-green-700 text-white font-bold';
        case 'ARRIVE HOME': return 'bg-gray-500 text-white font-bold';
        default: return 'bg-gray-200 text-gray-800';
      }
    };

  // ================= LOGIKA BLOCK WARNA BARIS TABEL (UPDATED) =================
  const getRowStyle = (status: string) => {
    switch (status) {
      case 'BELUM UPNOTES':
        return 'bg-red-100 text-red-900 hover:bg-red-200 border-red-200'; // Merah
      case 'UPNOTES PERTAMA/DP':
        return 'bg-blue-200 text-blue-900 hover:bg-blue-300 border-blue-300'; // Biru 
      case 'UPNOTES PELUNASAN':
      case 'UPNOTES LANGSUNG LUNAS':
        return 'bg-yellow-100 text-yellow-900 hover:bg-yellow-200 border-yellow-200'; // kuning
      case 'OS': 
        return 'bg-gray-700 text-gray-100 hover:bg-gray-600 border-gray-600'; // Abu-abu tua
      case 'MASUK LIST CO': 
        return 'bg-green-100 text-green-950 hover:bg-green-200 border-green-200'; // Hijau muda
      case 'ARRIVE HOME': 
        return 'bg-gray-200 text-gray-800 hover:bg-gray-300 border-gray-300'; // Abu-abu muda
      default: 
        return 'bg-white text-gray-700 hover:bg-gray-50 border-gray-100'; // Putih Bersih
    }
  };

  const processedData = daftarJajanan
    .filter((item) => {
      const matchSeller = item.seller?.toLowerCase().includes(searchSeller.toLowerCase());
      const matchStatus = filterStatusList.length === 0
        ? true
        : filterStatusMode === 'include'
          ? filterStatusList.includes(item.status)
          : !filterStatusList.includes(item.status);
      
      const totalTagihan = Number(item.harga_dasar || 0) + Number(item.tax || 0);
      const sisaPelunasan = totalTagihan - Number(item.sudah_bayar || 0);
      const matchPelunasan = filterPelunasan === 'BELUM_LUNAS' ? sisaPelunasan > 0 : true;

      return matchSeller && matchStatus && matchPelunasan;
    })
    .sort((a, b) => {
      let valA: any = a[sortBy];
      let valB: any = b[sortBy];

      if (sortBy === 'harga_dasar') {
        valA = Number(valA || 0); valB = Number(valB || 0);
      }
      if (sortBy === 'max_tgl_co') {
        if (valA === '-') valA = sortOrder === 'asc' ? '9999-12-31' : '0000-00-00';
        if (valB === '-') valB = sortOrder === 'asc' ? '9999-12-31' : '0000-00-00';
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

  return (
    <div className="min-h-screen bg-pink-50 p-6 font-sans text-gray-800">
      <div className="max-w-7xl mx-auto">
        
      <header className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-pink-600">🎀JAJANAN MEYSHA🎀</h1>
            <p className="text-gray-500 text-sm">INGAT RBUY PLIS!</p>
          </div>
          <Link 
            href="/dashboard" 
            className="bg-pink-100 text-pink-700 hover:bg-pink-200 px-4 py-2 rounded-lg font-bold text-sm transition-colors shadow-sm whitespace-nowrap"
          >
            📈 Buka Dashboard
          </Link>
        </header>

        {/* FORM INPUT */}
        <div 
          ref={formRef} 
          className={`p-5 rounded-xl border transition-all duration-300 mb-6 ${
            editingId ? 'bg-amber-50 border-amber-300 shadow-md' : 'bg-white border-gray-100 shadow-xs'
          }`}
        >
          <div className="flex justify-between items-center mb-4">
            <h2 className={`text-sm font-bold uppercase tracking-wider ${editingId ? 'text-amber-700' : 'text-pink-500'}`}>
              {editingId ? `✏️ Mode Edit (Mengubah Kode: ${form.kode})` : '➕ Tambah Rekaman Jajanan'}
            </h2>
            {editingId && (
              <button 
                type="button" 
                onClick={() => { setEditingId(null); resetForm(); }}
                className="text-xs font-bold text-red-600 hover:underline bg-red-100 px-2 py-1 rounded"
              >
                Batal Edit
              </button>
            )}
        </div>

          <form onSubmit={handleInsertAtauUpdate} className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* INPUT OTOMATIS TANGGAL ADD */}
            {editingId && (
                <div className="md:col-span-4 bg-pink-50 border border-pink-200 text-pink-900 p-3 rounded-lg text-xs font-medium flex justify-between">
                  <span>📅 <strong>Tanggal Ditambahkan ke Sistem:</strong> {viewCreatedAt}</span>
                  <span className="text-red-600 font-bold">🔒 Sistem Lock (Tidak Dapat Diubah)</span>
                </div>
              )}

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Kode Barang</label>
              <input
                type="text"
                value={form.kode}
                onChange={(e) => setForm({...form, kode: e.target.value})}
                className="w-full border border-gray-200 rounded-lg p-2 text-sm bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Nama Seller / GO</label>
              <select
                required // Menambahkan atribut wajib diisi
                value={form.seller}
                onChange={(e) => setForm({...form, seller: e.target.value})}
                className="w-full border border-gray-200 rounded-lg p-2 text-sm bg-white"
              >
                <option value="">-- Pilih Seller --</option>
                {SELLER_OPTIONS.map((opt, idx) => (
                  <option key={idx} value={opt}>{opt}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Nama Barang</label>
              <input
                type="text"
                value={form.nama_barang}
                onChange={(e) => setForm({...form, nama_barang: e.target.value})}
                className="w-full border border-gray-200 rounded-lg p-2 text-sm bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Jumlah (Qty)</label>
              <input
                type="number"
                min="1"
                value={form.jumlah_barang}
                onChange={(e) => setForm({...form, jumlah_barang: e.target.value})}
                className="w-full border border-pink-200 rounded-lg p-2 text-sm bg-pink-50 font-bold text-pink-700 focus:outline-pink-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Status Barang</label>
              <select
                value={form.status}
                onChange={(e) => setForm({...form, status: e.target.value})}
                className="w-full border border-gray-200 rounded-lg p-2 text-sm bg-white font-medium"
              >
                <option value="BELUM UPNOTES">BELUM UPNOTES</option>
                <option value="UPNOTES PERTAMA/DP">UPNOTES PERTAMA/DP</option>
                <option value="UPNOTES LANGSUNG LUNAS">UPNOTES LANGSUNG LUNAS</option>
                <option value="UPNOTES PELUNASAN">UPNOTES PELUNASAN</option>
                <option value="OS">OS</option>
                {editingId && (
                  <>
                    <option value="MASUK LIST CO">MASUK LIST CO</option>
                    <option value="ARRIVE HOME">ARRIVE HOME</option>
                  </>
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Harga Dasar (Rp)</label>
              <input
                type="number"
                value={form.harga_dasar}
                onChange={(e) => setForm({...form, harga_dasar: e.target.value})}
                className="w-full border border-gray-200 rounded-lg p-2 text-sm bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Tax / Pajak (Rp)</label>
              <input
                type="number"
                value={form.tax}
                onChange={(e) => setForm({...form, tax: e.target.value})}
                className="w-full border border-gray-200 rounded-lg p-2 text-sm bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">DP / Sudah Bayar (Rp)</label>
              <input
                type="number"
                value={isAutoLunas ? (Number(form.harga_dasar || 0) + Number(form.tax || 0)) : form.sudah_bayar}
                disabled={isAutoLunas}
                onChange={(e) => setForm({...form, sudah_bayar: e.target.value})}
                className="w-full border border-gray-200 rounded-lg p-2 text-sm bg-white disabled:bg-gray-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Last Payment</label>
              <input
                type="date"
                disabled={isAutoLunas}
                value={isAutoLunas ? tglHariIni : form.last_payment}
                onChange={(e) => setForm({...form, last_payment: e.target.value})}
                className="w-full border border-gray-200 rounded-lg p-2 text-sm bg-white disabled:bg-gray-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Max Tanggal CO</label>
              <input
                type="date"
                disabled={isTanpaCo} 
                  value={form.max_tgl_co} 
                  onChange={(e) => setForm({...form, max_tgl_co: e.target.value})}
                  className="w-full border border-gray-200 rounded-lg p-2 text-sm bg-white disabled:bg-gray-100"
                />
            </div>

            {/* INPUT FILE MEDIA UPLOAD GAMBAR */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Upload Bukti Gambar</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleUploadGambar}
                disabled={isUploading}
                className="w-full text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-pink-50 file:text-pink-700 hover:file:bg-pink-100 cursor-pointer disabled:opacity-50"
              />
              {form.image_url && (
                <p className="text-[11px] text-green-600 mt-1 truncate">✓ Gambar siap disimpan</p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-gray-500 mb-1">Notes / Keterangan</label>
              <input
                type="text"
                placeholder="Keterangan tambahan..."
                value={form.notes}
                onChange={(e) => setForm({...form, notes: e.target.value})}
                className="w-full border border-gray-200 rounded-lg p-2 text-sm bg-white"
              />
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                disabled={isUploading}
                className={`w-full font-bold py-2 px-4 rounded-lg text-sm transition-colors text-white cursor-pointer ${
                  editingId ? 'bg-amber-600 hover:bg-amber-700' : 'bg-pink-600 hover:bg-pink-700'
                } disabled:bg-gray-400`}
              >
                {isUploading ? 'Mengunggah...' : (editingId ? '💾 Simpan Perubahan' : '☁️ Simpan Sekarang')}
              </button>
            </div>
          </form>
        </div>

        {/* PANEL FILTER & SORTING */}
        <div className="bg-white p-5 rounded-xl shadow-xs border border-gray-100 mb-6 flex flex-col gap-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Filter Nama Seller</label>
              <select 
                value={searchSeller} 
                onChange={(e) => setSearchSeller(e.target.value)} 
                className="w-full border border-gray-200 rounded-lg p-2 text-sm bg-white"
              >
                <option value="">Semua Seller</option>
                {SELLER_OPTIONS.map((opt, idx) => (
                  <option key={idx} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-5">
              <div className="flex items-center gap-3 mb-2">
                <label className="text-xs font-semibold text-gray-500">Filter Status Tagihan</label>
                <button
                  type="button"
                  onClick={() => setFilterStatusMode(prev => prev === 'include' ? 'exclude' : 'include')}
                  className={`text-xs font-bold px-3 py-1 rounded-full border transition-colors cursor-pointer ${
                    filterStatusMode === 'include'
                      ? 'bg-pink-600 text-white border-pink-600'
                      : 'bg-orange-500 text-white border-orange-500'
                  }`}
                >
                  {filterStatusMode === 'include' ? '✅ Tampilkan Yang Dipilih' : '🚫 Kecuali Yang Dipilih'}
                </button>
                {filterStatusList.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setFilterStatusList([])}
                    className="text-xs text-gray-400 hover:text-red-500 underline cursor-pointer"
                  >
                    Reset
                  </button>
                )}
                {filterStatusList.length === 0 && (
                  <span className="text-xs text-gray-400 italic">Semua status ditampilkan</span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {[
                  'BELUM UPNOTES',
                  'UPNOTES PERTAMA/DP',
                  'UPNOTES LANGSUNG LUNAS',
                  'UPNOTES PELUNASAN',
                  'OS',
                  'MASUK LIST CO',
                  'ARRIVE HOME'
                ].map((status) => {
                  const isSelected = filterStatusList.includes(status);
                  return (
                    <button
                      key={status}
                      type="button"
                      onClick={() => handleToggleFilterStatus(status)}
                      className={`text-xs font-bold px-3 py-1.5 rounded-full border transition-all cursor-pointer ${
                        isSelected
                          ? getStatusBadgeStyle(status) + ' ring-2 ring-offset-1 ring-pink-400 scale-105'
                          : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'
                      }`}
                    >
                      {isSelected ? '✓ ' : ''}{status}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Status Pelunasan</label>
              <select value={filterPelunasan} onChange={(e) => setFilterPelunasan(e.target.value)} className="w-full border border-gray-200 rounded-lg p-2 text-sm bg-white">
                <option value="SEMUA">Semua Data Belanja</option>
                <option value="BELUM_LUNAS">⚠️ Masih Sisa Pelunasan</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Urutkan Berdasarkan</label>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="w-full border border-gray-200 rounded-lg p-2 text-sm bg-white">
                <option value="created_at">⏰ Otomatis Waktu Input</option>
                <option value="max_tgl_co">📅 Max Tanggal CO</option>
                <option value="harga_dasar">💰 Harga Dasar</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Arah Urutan</label>
              <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} className="w-full border border-gray-200 rounded-lg p-2 text-sm bg-white">
                <option value="desc">Descending (Terbaru / Besar)</option>
                <option value="asc">Ascending (Lama / Kecil)</option>
              </select>
            </div>
          </div>
        </div>

        {/* TABEL DATA DISPLAY */}
        <div className="bg-white rounded-xl shadow-xs border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[1350px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-500 uppercase tracking-wider">
                  <th className="p-4">Kode</th>
                  <th className="p-4">Waktu Add</th>
                  <th className="p-4">Seller / GO</th>
                  <th className="p-4">Nama Barang</th>
                  <th className="p-4 text-center">Jumlah Barang</th>
                  <th className="p-4 text-center">Aksi</th>
                  <th className="p-4 text-center">Gambar</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4 text-right">Harga Dasar</th>
                  <th className="p-4 text-right">Tax</th>
                  <th className="p-4 text-right">Sudah Bayar</th>
                  <th className="p-4 text-center">Last Payment</th>
                  <th className="p-4 text-center">Max Tgl CO</th>
                  <th className="p-4 text-right">Sisa Pelunasan</th>
                  <th className="p-4">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y text-sm">
                {isLoading ? (
                  <tr><td colSpan={13} className="p-8 text-center text-gray-400 bg-white">Menyinkronkan data... ☁️</td></tr>
                ) : processedData.length === 0 ? (
                  <tr><td colSpan={13} className="p-8 text-center text-gray-400 bg-white">Tidak ada data jajanan yang cocok.</td></tr>
                ) : (
                  processedData.map((item) => {
                    const totalTagihan = Number(item.harga_dasar || 0) + Number(item.tax || 0);
                    const sisaPelunasan = totalTagihan - Number(item.sudah_bayar || 0);
                    
                    const isDarkRow = item.status === 'OS';
                    const isBelumUpnotes = item.status === 'BELUM UPNOTES';

                    return (
                      <tr key={item.id} className={`border-b transition-colors ${getRowStyle(item.status)}`}>
                        <td className="p-4 font-mono font-bold truncate max-w-[150px]">{item.kode || '-'}</td>
                        
                        <td className="p-4 text-xs font-medium opacity-80">
                          {/* Waktu Add Otomatis Terpampang Nyata & Read-Only */}
                          {item.created_at ? new Date(item.created_at).toLocaleDateString('id-ID') : '-'}
                          <span className="block text-[10px] font-mono opacity-60">
                            {item.created_at ? new Date(item.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : ''}
                          </span>
                        </td>
  
                        <td className="p-4 font-semibold">{item.seller}</td>
                        <td className="p-4">{item.nama_barang}</td>
                        <td className="p-4 text-center">
                          {item.jumlah_barang || 1}
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex justify-center gap-2">
                            <button onClick={() => handlePicuEdit(item)} className="px-2 py-1 bg-amber-500 text-white font-bold text-xs rounded hover:bg-amber-600 cursor-pointer">✏️ Edit</button>
                            <button onClick={() => handleHapusData(item.id, item.nama_barang)} className="px-2 py-1 bg-red-600 text-white font-bold text-xs rounded hover:bg-red-700 cursor-pointer">🗑️ Hapus</button>
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          {/* INTEGRASI LINK VIEW IMAGE MODAL */}
                          {item.image_url ? (
                            <button
                            onClick={() => setActiveImageUrl(item.image_url)}
                            className="px-2 py-1 bg-pink-500 hover:bg-pink-600 text-white text-xs font-bold rounded shadow-xs transition-transform transform active:scale-95 cursor-pointer"
                            >
                              👁️ View
                            </button>
                          ) : (
                            <span className="text-gray-400 text-xs italic">No Image</span>
                          )}
                        </td>
  
                        <td className="p-4 text-center">
                          <span className={`inline-block px-3 py-1 text-xs rounded-full ${getStatusBadgeStyle(item.status)}`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="p-4 text-right font-mono">Rp {Number(item.harga_dasar || 0).toLocaleString('id-ID')}</td>
                        <td className="p-4 text-right font-mono opacity-80">Rp {Number(item.tax || 0).toLocaleString('id-ID')}</td>
                        <td className="p-4 text-right font-mono font-semibold">Rp {Number(item.sudah_bayar || 0).toLocaleString('id-ID')}</td>
                        <td className="p-4 text-center font-medium">{item.last_payment || '-'}</td>
                        <td className="p-4 text-center text-xs">{item.max_tgl_co || '-'}</td>
                        <td className="p-4 text-right font-mono font-black">Rp {sisaPelunasan.toLocaleString('id-ID')}</td>
                        <td className="p-4 text-sm text-gray-600 max-w-[200px] truncate" title={item.notes}>{item.notes || '-'}</td>
                      </tr>
                      );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* ================= LIGHTBOX / MODAL POPUP UNTUK LIHAT GAMBAR ================= */}
      {activeImageUrl && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="relative max-w-3xl w-full bg-white rounded-2xl overflow-hidden shadow-2xl p-3 flex flex-col items-center">
            <button
              onClick={() => setActiveImageUrl(null)}
              className="absolute top-4 right-4 bg-red-600 hover:bg-red-700 text-white rounded-full p-2 font-bold w-10 h-10 flex items-center justify-center transition-colors text-lg shadow-md cursor-pointer z-10"
            >
              ✕
            </button>
            <div className="max-h-[80vh] w-full flex items-center justify-center overflow-auto rounded-lg bg-gray-100">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={activeImageUrl}
                alt="Bukti Pembayaran / Jajanan"
                className="object-contain max-w-full max-h-[75vh] transition-transform shadow-sm"
              />
            </div>
            <p className="text-xs text-gray-400 mt-3 font-mono break-all text-center px-6">{activeImageUrl}</p>
          </div>
        </div>
      )}
    </div>
  );
}