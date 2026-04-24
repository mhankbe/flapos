const router = require('express').Router();
const db = require('../database');
const XLSX = require('xlsx');

function rupiahNum(n){ return Math.round(n||0); }

router.get('/export', async (req, res) => {
  const role = req.headers['x-admin-role'];
  if(!['pembukuan'].includes(role)) return res.status(403).json({error:'Hanya Admin Pembukuan'});
  const { dari, sampai } = req.query;
  const d = dari || new Date().toISOString().split('T')[0];
  const s = sampai || d;

  const transaksi = await db.all('SELECT * FROM transaksi WHERE tanggal>=$1 AND tanggal<=$2 ORDER BY tanggal,created_at', [d,s]);
  const items = await db.all('SELECT * FROM transaksi_item WHERE invoice IN (SELECT invoice FROM transaksi WHERE tanggal>=$1 AND tanggal<=$2)', [d,s]);
  const produk = await db.all('SELECT * FROM produk ORDER BY nama');
  const stokLog = await db.all('SELECT * FROM stok_log WHERE tanggal>=$1 AND tanggal<=$2 ORDER BY tanggal,created_at', [d,s]);
  const karyawan = await db.all('SELECT * FROM karyawan ORDER BY nama');
  const absensi = await db.all('SELECT * FROM absensi WHERE tanggal>=$1 AND tanggal<=$2 ORDER BY tanggal', [d,s]);

  const totalOmzet = transaksi.reduce((a,t)=>a+(t.total||0),0);
  const totalProfit = transaksi.reduce((a,t)=>a+(t.profit||0),0);

  const wb = XLSX.utils.book_new();

  // Sheet 1: Ringkasan
  const ring = [
    ['FLa POS SYSTEM — REKAP LAPORAN'],
    ['Periode:', `${d} s/d ${s}`],
    ['Dibuat:', new Date().toLocaleString('id-ID')],
    [],
    ['RINGKASAN KASIR'],
    ['Total Transaksi', transaksi.length],
    ['Total Omzet', rupiahNum(totalOmzet)],
    ['Total Profit', rupiahNum(totalProfit)],
    ['Margin (%)', totalOmzet>0 ? +((totalProfit/totalOmzet)*100).toFixed(2) : 0],
    ['Rata-rata/Transaksi', transaksi.length ? rupiahNum(totalOmzet/transaksi.length) : 0],
    [],
    ['RINGKASAN STOK'],
    ['Total Produk', produk.length],
    ['Nilai Stok Total', rupiahNum(produk.reduce((a,p)=>a+p.stok*p.harga_jual,0))],
    ['Stok Habis', produk.filter(p=>p.stok<=0).length],
    ['Stok Menipis', produk.filter(p=>p.stok>0&&p.stok<=(p.stok_min||5)).length],
    [],
    ['RINGKASAN KARYAWAN'],
    ['Total Karyawan Aktif', karyawan.filter(k=>k.status==='aktif').length],
    ['Total Absensi Tercatat', absensi.length],
    ['Total Hadir', absensi.filter(a=>a.status==='hadir').length],
    ['Total Alpha', absensi.filter(a=>a.status==='alpha').length],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(ring);
  ws1['!cols'] = [{wch:30},{wch:25}];
  XLSX.utils.book_append_sheet(wb, ws1, 'RINGKASAN');

  // Sheet 2: Transaksi Kasir
  const trxRows = transaksi.map((t,i) => ({
    'No': i+1, 'Invoice': t.invoice, 'Tanggal': t.tanggal, 'Jam': t.jam,
    'Subtotal (Rp)': rupiahNum(t.subtotal), 'Diskon (Rp)': rupiahNum(t.diskon),
    'Pajak (Rp)': rupiahNum(t.pajak), 'Total (Rp)': rupiahNum(t.total),
    'Kembalian (Rp)': rupiahNum(t.kembalian), 'Metode Bayar': t.metode_bayar,
    'Profit (Rp)': rupiahNum(t.profit), 'Kasir': t.kasir
  }));
  const ws2 = XLSX.utils.json_to_sheet(trxRows.length ? trxRows : [{'Keterangan':'Tidak ada data'}]);
  ws2['!cols'] = Object.keys(trxRows[0]||{}).map(()=>({wch:18}));
  XLSX.utils.book_append_sheet(wb, ws2, 'TRANSAKSI KASIR');

  // Sheet 3: Detail Item Terjual
  const itemRows = items.map((it,i) => ({
    'No': i+1, 'Invoice': it.invoice, 'Produk': it.produk_nama,
    'Barcode': it.barcode||'', 'Kategori': it.kategori||'',
    'Qty': it.qty, 'Harga Jual (Rp)': rupiahNum(it.harga_jual),
    'HPP (Rp)': rupiahNum(it.hpp), 'Subtotal (Rp)': rupiahNum(it.subtotal),
    'Profit (Rp)': rupiahNum(it.profit)
  }));
  const ws3 = XLSX.utils.json_to_sheet(itemRows.length ? itemRows : [{'Keterangan':'Tidak ada data'}]);
  XLSX.utils.book_append_sheet(wb, ws3, 'DETAIL PENJUALAN');

  // Sheet 4: Data Produk & Stok
  const prodRows = produk.map((p,i) => ({
    'No': i+1, 'Barcode': p.barcode||'', 'Nama Produk': p.nama,
    'Kategori': p.kategori||'', 'HPP (Rp)': rupiahNum(p.hpp),
    'Harga Jual (Rp)': rupiahNum(p.harga_jual),
    'Margin (%)': p.hpp>0 ? +((p.harga_jual-p.hpp)/p.hpp*100).toFixed(2) : 0,
    'Stok Saat Ini': p.stok, 'Stok Min': p.stok_min||5,
    'Satuan': p.satuan||'pcs',
    'Status Stok': p.stok<=0?'HABIS':p.stok<=(p.stok_min||5)?'TIPIS':'AMAN',
    'Nilai Stok (Rp)': rupiahNum(p.stok*p.harga_jual)
  }));
  const ws4 = XLSX.utils.json_to_sheet(prodRows.length ? prodRows : [{'Keterangan':'Tidak ada data'}]);
  XLSX.utils.book_append_sheet(wb, ws4, 'DATA PRODUK');

  // Sheet 5: Kartu Stok
  const stokRows = stokLog.map((s,i) => ({
    'No': i+1, 'Tanggal': s.tanggal, 'Produk': s.produk_nama,
    'Jenis': s.jenis, 'Qty': s.qty,
    'Stok Sebelum': s.stok_sebelum, 'Stok Sesudah': s.stok_sesudah,
    'Harga Sat. (Rp)': rupiahNum(s.harga_satuan),
    'Total Nilai (Rp)': rupiahNum(s.harga_satuan*s.qty),
    'Supplier': s.supplier||'', 'Keterangan': s.keterangan||'', 'Admin': s.admin||''
  }));
  const ws5 = XLSX.utils.json_to_sheet(stokRows.length ? stokRows : [{'Keterangan':'Tidak ada data'}]);
  XLSX.utils.book_append_sheet(wb, ws5, 'KARTU STOK');

  // Sheet 6: Data Karyawan
  const karywRows = karyawan.map((k,i) => ({
    'No': i+1, 'NIK': k.nik||'', 'Nama': k.nama,
    'Jabatan': k.jabatan||'', 'Departemen': k.departemen||'',
    'Gaji Pokok (Rp)': rupiahNum(k.gaji_pokok),
    'Tunjangan (Rp)': rupiahNum(k.tunjangan),
    'Lembur/Jam (Rp)': rupiahNum(k.lembur_per_jam),
    'BPJS (%)': k.bpjs_pct||2,
    'Tgl Masuk': k.tanggal_masuk||'', 'No HP': k.no_hp||'', 'Status': k.status||''
  }));
  const ws6 = XLSX.utils.json_to_sheet(karywRows.length ? karywRows : [{'Keterangan':'Tidak ada data'}]);
  XLSX.utils.book_append_sheet(wb, ws6, 'DATA KARYAWAN');

  // Sheet 7: Rekap Absensi
  const abRows = absensi.map((a,i) => ({
    'No': i+1, 'Tanggal': a.tanggal, 'Jam Absen': a.jam_absen||'',
    'NIK': a.nik||'', 'Nama': a.nama, 'Jabatan': a.jabatan||'',
    'Shift': a.shift||'', 'Status': a.status.toUpperCase(),
    'Lembur (Jam)': a.lembur_jam||0,
    'Face Match (%)': a.face_match ? +(a.face_match*100).toFixed(1) : '-',
    'Keterangan': a.keterangan||''
  }));
  const ws7 = XLSX.utils.json_to_sheet(abRows.length ? abRows : [{'Keterangan':'Tidak ada data'}]);
  XLSX.utils.book_append_sheet(wb, ws7, 'REKAP ABSENSI');

  // Sheet 8: Gaji
  const settings = {};
  const settingRows = await db.all('SELECT key,value FROM settings');
  settingRows.forEach(r=>settings[r.key]=r.value);
  const hariKerja = parseInt(settings.hari_kerja_per_bulan)||26;
  const potAlpha = parseFloat(settings.potongan_alpha_per_hari)||50000;
  const bonusHadir = parseFloat(settings.bonus_hadir_penuh)||100000;
  const gajiRows = karyawan.filter(k=>k.status==='aktif').map((k,i) => {
    const myAb = absensi.filter(a=>a.karyawan_id===k.id);
    const hadir = myAb.filter(a=>a.status==='hadir').length;
    const alpha = myAb.filter(a=>a.status==='alpha').length;
    const lemburJam = myAb.reduce((a,x)=>a+(x.lembur_jam||0),0);
    const gj = k.gaji_pokok||0;
    const tunj = k.tunjangan||0;
    const lemburNom = (k.lembur_per_jam||0)*lemburJam;
    const bonusNom = alpha===0&&hadir>=hariKerja ? bonusHadir : 0;
    const potAlphaNom = alpha*potAlpha;
    const bpjsNom = gj*(( k.bpjs_pct||2)/100);
    const bruto = gj+tunj+lemburNom+bonusNom;
    const pkp = Math.max(0, bruto-4500000);
    const pph21 = pkp*0.05;
    const bersih = bruto-potAlphaNom-bpjsNom-pph21;
    return {
      'No': i+1, 'NIK': k.nik||'', 'Nama': k.nama, 'Jabatan': k.jabatan||'',
      'Gaji Pokok (Rp)': rupiahNum(gj), 'Tunjangan (Rp)': rupiahNum(tunj),
      'Lembur (Jam)': lemburJam, 'Nilai Lembur (Rp)': rupiahNum(lemburNom),
      'Hari Hadir': hadir, 'Hari Alpha': alpha,
      'Bonus Hadir (Rp)': rupiahNum(bonusNom),
      'Pot. Alpha (Rp)': rupiahNum(potAlphaNom),
      'Pot. BPJS (Rp)': rupiahNum(bpjsNom),
      'Pot. PPh21 (Rp)': rupiahNum(pph21),
      'Total Bruto (Rp)': rupiahNum(bruto),
      'Gaji Bersih (Rp)': rupiahNum(bersih)
    };
  });
  const ws8 = XLSX.utils.json_to_sheet(gajiRows.length ? gajiRows : [{'Keterangan':'Tidak ada data'}]);
  const totalBersih = gajiRows.reduce((a,r)=>a+(r['Gaji Bersih (Rp)']||0),0);
  XLSX.utils.sheet_add_aoa(ws8, [['','','','','TOTAL PENGGAJIAN',totalBersih]], {origin:-1});
  XLSX.utils.book_append_sheet(wb, ws8, 'SLIP GAJI');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const filename = `FLaPOS_Rekap_${d}_${s}.xlsx`;
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buf);
});

// Stats dashboard
router.get('/stats', async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const bulan = today.substring(0,7);
  const todayTrx = await db.all('SELECT * FROM transaksi WHERE tanggal=$1', [today]);
  const bulanTrx = await db.all("SELECT * FROM transaksi WHERE TO_CHAR(tanggal,'YYYY-MM')=$1", [bulan]);
  const produk = await db.all('SELECT * FROM produk');
  const karyawan = await db.all("SELECT * FROM karyawan WHERE status='aktif'");
  const absensiToday = await db.all('SELECT * FROM absensi WHERE tanggal=$1', [today]);

  // 7 hari
  const days7 = [];
  for(let i=6;i>=0;i--){
    const d=new Date();d.setDate(d.getDate()-i);
    const ds=d.toISOString().split('T')[0];
    const trx=await db.get('SELECT SUM(total) as t FROM transaksi WHERE tanggal=$1', [ds]);
    days7.push({tanggal:ds,omzet:trx?.t||0});
  }

  const itemsRes = await db.get('SELECT SUM(qty) as q FROM transaksi_item WHERE invoice IN (SELECT invoice FROM transaksi WHERE tanggal=$1)', [today]);

  res.json({
    today:{
      trx:todayTrx.length,
      omzet:todayTrx.reduce((a,t)=>a+(t.total||0),0),
      profit:todayTrx.reduce((a,t)=>a+(t.profit||0),0),
      items:itemsRes?.q||0
    },
    bulan:{
      trx:bulanTrx.length,
      omzet:bulanTrx.reduce((a,t)=>a+(t.total||0),0)
    },
    produk:{
      total:produk.length,
      habis:produk.filter(p=>p.stok<=0).length,
      tipis:produk.filter(p=>p.stok>0&&p.stok<=(p.stok_min||5)).length,
      nilai:produk.reduce((a,p)=>a+p.stok*p.harga_jual,0)
    },
    karyawan:{
      aktif:karyawan.length,
      hadir:absensiToday.filter(a=>a.status==='hadir').length,
      alpha:absensiToday.filter(a=>a.status==='alpha').length,
      belumAbsen:karyawan.length-absensiToday.length
    },
    days7,
    topProduk: await db.all("SELECT produk_nama as nama, SUM(qty) as total FROM transaksi_item GROUP BY produk_nama ORDER BY total DESC LIMIT 5")
  });
});

module.exports = router;
