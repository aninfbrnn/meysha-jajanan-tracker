'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase'; // Sesuaikan path jika berbeda
import Link from 'next/link';

export default function DashboardPage() {
  const [dataJajanan, setDataJajanan] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // State untuk filter seller
  const [selectedSeller, setSelectedSeller] = useState('SEMUA');

  useEffect(() => {
    const fetchDashboardData = async () => {
      setIsLoading(true);
      const { data, error } = await supabase.from('jajanan').select('*');
      
      if (error) {
        console.error('Gagal mengambil data:', error.message);
      } else if (data) {
        setDataJajanan(data);
      }
      setIsLoading(false);
    };

    fetchDashboardData();
  }, []);

  // Ekstrak daftar nama seller unik untuk Dropdown
  const daftarSeller = Array.from(new Set(dataJajanan.map(item => item.seller))).filter(Boolean);

  // Filter data berdasarkan seller yang dipilih
  const filteredData = selectedSeller === 'SEMUA' 
    ? dataJajanan 
    : dataJajanan.filter(item => item.seller === selectedSeller);

  // ================= KALKULASI METRIK (Berdasarkan Data Terfilter) =================
  const totalBarang = filteredData.length;

  const totalBelanja = filteredData.reduce((acc, item) => {
    return acc + Number(item.harga_dasar || 0) + Number(item.tax || 0);
  }, 0);

  const totalSudahBayar = filteredData.reduce((acc, item) => {
    return acc + Number(item.sudah_bayar || 0);
  }, 0);

  const totalUtang = totalBelanja - totalSudahBayar;
  
  // Persentase Pelunasan untuk Infografis
  const persenLunas = totalBelanja === 0 ? 0 : Math.round((totalSudahBayar / totalBelanja) * 100);

  // Hitung Barang Berdasarkan Status
  const barangBelumUpnotes = filteredData.filter(i => i.status === 'BELUM UPNOTES').length;
  const barangSiapCo = filteredData.filter(i => i.status === 'MASUK LIST CO').length;
  const barangArriveHome = filteredData.filter(i => i.status === 'ARRIVE HOME').length;
  
  const itemBelumLunas = filteredData.filter(item => {
    const sisa = (Number(item.harga_dasar || 0) + Number(item.tax || 0)) - Number(item.sudah_bayar || 0);
    return sisa > 0;
  }).length;

  return (
    <div className="min-h-screen bg-pink-50 p-6 font-sans text-gray-800">
      <div className="max-w-7xl mx-auto">
        
        {/* Header & Navigasi */}
        <header className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-extrabold text-pink-600">📊 Dashboard Jajanan</h1>
            <p className="text-gray-500 text-sm">Ringkasan kondisi keuangan dan status barang belanjaanmu.</p>
          </div>
          <Link 
            href="/" 
            className="bg-pink-500 hover:bg-pink-600 text-white px-4 py-2 rounded-lg font-semibold transition-colors shadow-sm whitespace-nowrap"
          >
            ⬅️ Kembali ke Tabel Utama
          </Link>
        </header>

        {isLoading ? (
          <div className="text-center py-20 text-gray-400 font-medium animate-pulse">
            Menghitung data dari database... ☁️
          </div>
        ) : (
          <>
            {/* PANEL FILTER SELLER */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-pink-100 mb-6 flex flex-col md:flex-row items-center gap-4">
              <label className="font-bold text-pink-700 whitespace-nowrap">🔍 Filter Rangkuman:</label>
              <select 
                value={selectedSeller} 
                onChange={(e) => setSelectedSeller(e.target.value)}
                className="w-full md:w-auto flex-1 border-2 border-pink-200 rounded-lg p-2 text-sm bg-pink-50 text-pink-900 font-semibold focus:outline-none focus:border-pink-500 transition-colors"
              >
                <option value="SEMUA">🌸 Tampilkan Semua Seller 🌸</option>
                {daftarSeller.map((seller, idx) => (
                  <option key={idx} value={seller as string}>{seller as string}</option>
                ))}
              </select>
            </div>

            {/* ALERT PERINGATAN UTANG > 500 RIBU */}
            {totalUtang > 500000 && (
              <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl shadow-sm mb-6 flex items-start md:items-center gap-4 animate-pulse">
                <span className="text-4xl">🚨</span>
                <div>
                  <h4 className="font-extrabold text-red-900 text-lg">Peringatan Darurat: Utang Menumpuk!</h4>
                  <p className="text-sm mt-1">
                    Sisa pelunasanmu mencapai <strong>Rp {totalUtang.toLocaleString('id-ID')}</strong>. 
                    Tarik napas, tutup aplikasi e-commerce, dan segera lunasi tagihan ini sebelum makin membengkak ya!
                  </p>
                </div>
              </div>
            )}

            {/* Kartu Ringkasan Keuangan */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 border-l-4 border-l-pink-500">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-1">Total Nilai Jajanan</h3>
                <p className="text-3xl font-black text-gray-800">Rp {totalBelanja.toLocaleString('id-ID')}</p>
                <p className="text-xs text-gray-500 mt-2">Akumulasi seluruh barang (termasuk tax)</p>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 border-l-4 border-l-green-500">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-1">Sudah Dibayar</h3>
                <p className="text-3xl font-black text-green-600">Rp {totalSudahBayar.toLocaleString('id-ID')}</p>
                <p className="text-xs text-gray-500 mt-2">Uang yang sudah dikeluarkan (DP/Lunas)</p>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 border-l-4 border-l-red-500">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-1">Total Sisa Pelunasan</h3>
                <p className="text-3xl font-black text-red-600">Rp {totalUtang.toLocaleString('id-ID')}</p>
                <p className="text-xs text-red-400 font-semibold mt-2">⚠️ Berasal dari {itemBelumLunas} barang belum lunas</p>
              </div>
            </div>

            {/* INFOGRAFIS PELUNASAN */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-pink-100 mb-8">
              <div className="flex justify-between items-end mb-2">
                <h2 className="text-lg font-bold text-gray-800">Infografis Progress Pelunasan</h2>
                <span className="text-2xl font-black text-pink-600">{persenLunas}% Lunas</span>
              </div>
              <div className="w-full bg-pink-100 rounded-full h-6 overflow-hidden shadow-inner">
                <div 
                  className="bg-gradient-to-r from-pink-400 to-pink-600 h-6 rounded-full transition-all duration-1000 ease-out" 
                  style={{ width: `${persenLunas}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-400 mt-3 text-center">
                *Persentase dihitung berdasarkan total uang yang sudah dibayar dibanding total tagihan pada <strong>{selectedSeller === 'SEMUA' ? 'Semua Seller' : selectedSeller}</strong>.
              </p>
            </div>

            {/* Kartu Status Barang */}
            <h2 className="text-xl font-bold text-gray-800 mb-4">Statistik Barang {selectedSeller !== 'SEMUA' && `(${selectedSeller})`}</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              
              <div className="bg-white p-5 rounded-xl shadow-sm border border-pink-100 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase">Total Items</p>
                  <p className="text-2xl font-black text-gray-700">{totalBarang}</p>
                </div>
                <div className="text-3xl">📦</div>
              </div>

              <div className="bg-red-50 p-5 rounded-xl border border-red-200 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-red-700 uppercase">Belum Upnotes</p>
                  <p className="text-2xl font-black text-red-900">{barangBelumUpnotes}</p>
                </div>
                <div className="text-3xl">⏳</div>
              </div>

              <div className="bg-green-50 p-5 rounded-xl border border-green-200 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-green-700 uppercase">Siap Check Out</p>
                  <p className="text-2xl font-black text-green-900">{barangSiapCo}</p>
                </div>
                <div className="text-3xl">🛒</div>
              </div>

              <div className="bg-pink-100 p-5 rounded-xl border border-pink-200 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-pink-600 uppercase">Arrive Home</p>
                  <p className="text-2xl font-black text-pink-900">{barangArriveHome}</p>
                </div>
                <div className="text-3xl">🏠</div>
              </div>

            </div>
          </>
        )}
      </div>
    </div>
  );
}