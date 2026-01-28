import { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { initDB, getDB, getAllDonations, deleteDonation } from './db/database';
import { generatePDFData } from './pdfGenerator'; 
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

// --- UTILS ---
const getTodayStr = () => {
  const d = new Date();
  const offset = d.getTimezoneOffset() * 60000;
  return (new Date(d - offset)).toISOString().slice(0, 10);
};

const formatDateIN = (dateStr) => {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split('-');
  return `${d}-${m}-${y}`;
};

const formatCurrencyIN = (amount) => {
  if (!amount) return "0";
  const str = Math.round(amount).toString();
  let lastThree = str.substring(str.length - 3);
  let otherNumbers = str.substring(0, str.length - 3);
  if (otherNumbers !== '') lastThree = ',' + lastThree;
  return otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + lastThree;
};

// HELPER: Fix Excel Dates
const parseExcelDate = (input) => {
  if (!input) return "2000-01-01"; 
  if (typeof input === 'number') {
    const date = new Date(Math.round((input - 25569) * 86400 * 1000));
    return date.toISOString().split('T')[0];
  }
  const str = String(input).trim();
  const parts = str.match(/(\d{1,2})[\.\/\-](\d{1,2})[\.\/\-](\d{2,4})/);
  if (parts) {
    let day = parts[1].padStart(2, '0');
    let month = parts[2].padStart(2, '0');
    let year = parts[3];
    if (year.length === 2) year = "20" + year;
    return `${year}-${month}-${day}`; 
  }
  return "2000-01-01"; 
};

const triggerHaptic = async () => {
  try { await Haptics.impact({ style: ImpactStyle.Medium }); } catch (e) { console.log('Haptics not available'); }
};

// --- ICONS ---
const Icons = {
  Home: () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
  List: () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>,
  Chart: () => <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z" /></svg>,
  Edit: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
  Trash: () => <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
  Plus: () => <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>,
};

// ==========================================
// TOAST NOTIFICATION (RE-DESIGNED: BOTTOM & GLASS)
// ==========================================
const Toast = ({ show, message, type }) => {
  if (!show) return null;
  // Green border for success, Red for error. White background with Blur.
  const borderClass = type === 'error' ? 'border-red-500 text-red-700' : 'border-green-500 text-green-800';
  
  return (
    // Moved to BOTTOM-24 (Just above nav bar)
    <div className={`fixed bottom-24 left-4 right-4 z-[100] flex items-center gap-3 px-6 py-4 rounded-xl shadow-[0_10px_40px_-10px_rgba(0,0,0,0.2)] bg-white/95 backdrop-blur-md border-l-8 ${borderClass} animate-slide-up`}>
      <span className="text-xl">{type === 'error' ? '⚠️' : '✅'}</span>
      <span className="font-bold text-sm tracking-wide">{message}</span>
    </div>
  );
};

// ==========================================
// COMPONENT: HOME SCREEN
// ==========================================
const HomeScreen = ({ totalFund, todayTotal, donations }) => (
  <div className="flex flex-col gap-6 pb-24">
     <div className="relative overflow-hidden bg-gradient-to-br from-orange-600 to-amber-500 rounded-3xl p-6 shadow-xl text-white">
        <div className="absolute -right-10 -bottom-10 opacity-10 text-9xl">🕉️</div>
        <p className="text-orange-100 text-sm font-medium tracking-widest uppercase">Total Temple Fund</p>
        <h1 className="text-4xl font-black mt-2 mb-1">₹ {formatCurrencyIN(totalFund)}</h1>
        <div className="flex items-center gap-2 mt-4 bg-white/20 w-max px-3 py-1 rounded-full backdrop-blur-sm">
           <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
           <span className="text-xs font-bold">Safe & Verified</span>
        </div>
     </div>

     <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-orange-50">
           <p className="text-gray-400 text-xs font-bold uppercase">Today</p>
           <p className="text-2xl font-bold text-gray-800">₹ {formatCurrencyIN(todayTotal)}</p>
        </div>
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-orange-50">
           <p className="text-gray-400 text-xs font-bold uppercase">Reciepts</p>
           <p className="text-2xl font-bold text-gray-800">{donations.length}</p>
        </div>
     </div>

     <div>
       <h3 className="text-gray-500 font-bold text-sm mb-3 ml-2 uppercase tracking-wide">Recent Entries</h3>
       <div className="flex flex-col gap-3">
         {donations.slice(0, 3).map(item => (
           <div key={item.id} className="bg-white p-4 rounded-xl border border-gray-100 flex justify-between items-center shadow-sm">
              <div>
                 <p className="font-bold text-gray-800 truncate w-48">{item.donor_name}</p>
                 <p className="text-xs text-gray-400">{formatDateIN(item.date)}</p>
              </div>
              <span className="font-bold text-orange-600">₹{formatCurrencyIN(item.amount)}</span>
           </div>
         ))}
       </div>
     </div>
  </div>
);

// ==========================================
// COMPONENT: LEDGER SCREEN
// ==========================================
const LedgerScreen = ({ donations, DENOMINATIONS, handleDelete, openEdit }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDenom, setFilterDenom] = useState("");

  const filtered = useMemo(() => {
    return donations.filter(d => 
       (filterDenom ? d.denomination == filterDenom : true) && 
       (d.donor_name.toLowerCase().includes(searchTerm.toLowerCase()) || d.receipt_no.toString().includes(searchTerm))
    );
  }, [donations, searchTerm, filterDenom]);

  return (
    <div className="flex flex-col h-full pb-24">
      <div className="sticky top-0 bg-orange-50 pt-2 pb-4 z-10">
         <input 
           type="text" 
           placeholder="Search Name or Receipt No..." 
           value={searchTerm} 
           onChange={e => setSearchTerm(e.target.value)} 
           className="w-full bg-white border-none shadow-sm p-4 rounded-xl font-medium text-gray-700 outline-none focus:ring-2 focus:ring-orange-200"
         />
         <div className="flex gap-2 mt-3 overflow-x-auto no-scrollbar">
            <button onClick={()=>setFilterDenom("")} className={`px-4 py-1 rounded-full text-xs font-bold whitespace-nowrap ${filterDenom==="" ? 'bg-orange-600 text-white' : 'bg-white text-gray-500'}`}>All</button>
            {DENOMINATIONS.map(d => (
               <button key={d} onClick={()=>setFilterDenom(d)} className={`px-4 py-1 rounded-full text-xs font-bold whitespace-nowrap ${filterDenom==d ? 'bg-orange-600 text-white' : 'bg-white text-gray-500'}`}>₹ {d}</button>
            ))}
         </div>
      </div>

      <div className="flex flex-col gap-3">
        {filtered.map(item => (
          <div key={item.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 relative overflow-hidden group">
             <button onClick={()=>handleDelete(item.id)} className="absolute top-0 right-0 p-3 bg-red-50 text-red-500 rounded-bl-xl opacity-0 group-hover:opacity-100 transition-opacity">
                <Icons.Trash />
             </button>
             <div className="flex justify-between items-start mb-2 pr-10">
                <div>
                  <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded mr-2">#{item.receipt_no}</span>
                  <h3 className="font-bold text-gray-800 text-lg leading-tight mt-1">{item.donor_name}</h3>
                </div>
                <div className="text-right">
                  <span className="block font-black text-xl text-green-700">₹{formatCurrencyIN(item.amount)}</span>
                  <span className="text-xs text-gray-400 whitespace-nowrap">{formatDateIN(item.date)}</span>
                </div>
             </div>
             <button onClick={()=>openEdit(item)} className="w-full mt-2 py-2 bg-blue-50 text-blue-600 font-bold rounded-lg text-sm flex items-center justify-center gap-2 hover:bg-blue-100">
                <Icons.Edit /> Edit Details
             </button>
          </div>
        ))}
      </div>
    </div>
  );
};

// ==========================================
// COMPONENT: REPORT FILTER SHEET
// ==========================================
const ReportFilterSheet = ({ isOpen, onClose, DENOMINATIONS, onGenerate }) => {
  if (!isOpen) return null;
  const [denom, setDenom] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const handleGen = () => {
    onGenerate(denom, startDate, endDate);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black bg-opacity-60 backdrop-blur-sm">
      <div className="w-full bg-white rounded-t-2xl p-6 animate-slide-up shadow-2xl">
        <h3 className="text-xl font-bold mb-4 text-orange-700">📄 Generate PDF Report</h3>
        <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Denomination</label>
        <select value={denom} onChange={(e) => setDenom(e.target.value)} className="w-full border p-3 rounded-xl mb-4 font-bold bg-gray-50">
          <option value="ALL">All Denominations (Full)</option>
          {DENOMINATIONS.map(d => <option key={d} value={d}>₹ {formatCurrencyIN(d)}</option>)}
        </select>
        <label className="text-xs font-bold text-gray-500 uppercase block mb-2">Date Range (Optional)</label>
        <div className="flex gap-2 mb-6">
          <input type="date" className="border p-3 rounded-xl w-full" value={startDate} onChange={e => setStartDate(e.target.value)} />
          <input type="date" className="border p-3 rounded-xl w-full" value={endDate} onChange={e => setEndDate(e.target.value)} />
        </div>
        <button onClick={handleGen} className="w-full bg-orange-600 text-white font-bold py-4 rounded-xl shadow-lg text-lg">Download PDF</button>
        <button onClick={onClose} className="w-full py-4 text-gray-500 font-bold mt-2">Cancel</button>
      </div>
    </div>
  );
};

// ==========================================
// COMPONENT: TRANSACTION SHEET
// ==========================================
const TransactionSheet = ({ formMode, formData, setFormData, setFormMode, handleSave, DENOMINATIONS }) => {
  if (!formMode) return null;
  const isAdd = formMode === 'ADD';

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black bg-opacity-60 backdrop-blur-sm transition-opacity">
      <div className="w-full bg-white rounded-t-2xl p-6 animate-slide-up shadow-2xl h-[90vh] flex flex-col">
        <div className="flex justify-between items-center mb-6 border-b pb-4">
          <h3 className="text-2xl font-bold text-orange-700">{isAdd ? 'New Donation' : 'Edit Receipt'}</h3>
          <button onClick={() => setFormMode(null)} className="p-2 bg-gray-100 rounded-full text-gray-500 font-bold">✕</button>
        </div>
        <form onSubmit={handleSave} className="flex flex-col gap-5 overflow-y-auto flex-1 pb-20">
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1 block">Quick Select</label>
            <div className="flex overflow-x-auto gap-2 py-2 no-scrollbar">
              {DENOMINATIONS.map(d => (
                <button 
                  key={d} 
                  type="button"
                  onClick={() => setFormData(prev => ({...prev, denomination: d, amount: d}))}
                  className={`flex-shrink-0 px-4 py-2 rounded-full font-bold border ${formData.denomination == d ? 'bg-orange-600 text-white border-orange-600 shadow-lg' : 'bg-white text-gray-600 border-gray-200'}`}
                >
                  ₹{d}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">Amount (₹)</label>
            <input 
              type="number" 
              value={formData.amount} 
              onChange={(e) => setFormData({...formData, amount: e.target.value})} 
              className="w-full text-5xl font-black text-orange-600 border-b-2 border-orange-200 focus:border-orange-600 outline-none py-2 bg-transparent"
            />
          </div>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-xs font-bold text-gray-500 uppercase">Sl No</label>
              <input type="text" value={formData.sl_no} onChange={(e) => setFormData({...formData, sl_no: e.target.value})} className="w-full border-2 border-gray-100 bg-gray-50 p-3 rounded-xl font-bold text-gray-700"/>
            </div>
            <div className="flex-1">
              <label className="text-xs font-bold text-gray-500 uppercase">Receipt No</label>
              <input type="text" value={formData.receipt_no} onChange={(e) => setFormData({...formData, receipt_no: e.target.value})} className="w-full border-2 border-gray-100 bg-gray-50 p-3 rounded-xl font-bold text-gray-700"/>
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase">Donor Name & Address</label>
            <textarea 
              rows="3" 
              value={formData.donor_name} 
              onChange={(e) => setFormData({...formData, donor_name: e.target.value})} 
              className="w-full border-2 border-gray-200 p-3 rounded-xl text-lg font-medium focus:border-orange-500 outline-none"
              placeholder="Enter name..."
            ></textarea>
          </div>
          <div>
            <label className="text-xs font-bold text-gray-500 uppercase">Date</label>
            <input type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} className="w-full border-2 border-gray-200 p-3 rounded-xl font-medium"/>
          </div>
          <button type="submit" className="w-full bg-gradient-to-r from-orange-600 to-amber-500 text-white py-4 rounded-xl font-black text-xl shadow-lg active:scale-95 transition-transform mt-4">
            {isAdd ? 'SAVE RECEIPT' : 'UPDATE RECEIPT'}
          </button>
        </form>
      </div>
    </div>
  );
};

// ==========================================
// MAIN APP COMPONENT
// ==========================================
function App() {
  const [activeTab, setActiveTab] = useState('home'); 
  const [totalFund, setTotalFund] = useState(0);
  const [todayTotal, setTodayTotal] = useState(0);
  const [donations, setDonations] = useState([]);
  
  // Toast State
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  
  const [formMode, setFormMode] = useState(null);
  const [formData, setFormData] = useState({ id: null, donor_name: '', denomination: '100', amount: '100', sl_no: '', receipt_no: '', date: '' });
  const [isReportSheetOpen, setIsReportSheetOpen] = useState(false);

  const DENOMINATIONS = [100, 200, 500, 1000, 2000, 5000, 10000, 25000, 50000, 100000];

  useEffect(() => {
    const setup = async () => { try { await initDB(); refreshData(); } catch (e) { console.error("DB Error:", e); } };
    setup();
  }, []);

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast(prev => ({ ...prev, show: false })), 3000);
  };

  const refreshData = async () => {
    const db = await getDB();
    const resTotal = await db.query("SELECT SUM(amount) as t FROM donations WHERE type='CREDIT'");
    setTotalFund(resTotal.values[0].t || 0);

    const todayStr = getTodayStr(); 
    const resToday = await db.query(`SELECT SUM(amount) as t FROM donations WHERE date = '${todayStr}'`);
    setTodayTotal(resToday.values[0].t || 0);

    const all = await getAllDonations();
    setDonations(all);
  };

  const openAdd = () => {
    triggerHaptic();
    setFormData({ id: null, donor_name: '', denomination: '100', amount: '100', sl_no: '', receipt_no: '', date: getTodayStr() });
    setFormMode('ADD');
  };

  const openEdit = (item) => {
    triggerHaptic();
    setFormData({ ...item });
    setFormMode('EDIT'); 
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const db = await getDB();
    const { id, donor_name, denomination, sl_no, receipt_no, date, amount } = formData;
    const finalAmount = parseFloat(amount) || 0;
    
    if (formMode === 'EDIT') {
      await db.run("UPDATE donations SET donor_name=?, amount=?, denomination=?, sl_no=?, receipt_no=?, date=? WHERE id=?", [donor_name, finalAmount, denomination, sl_no, receipt_no, date, id]);
      showToast('Receipt Updated!');
    } else {
      await db.run("INSERT INTO donations (date, donor_name, amount, type, denomination, sl_no, receipt_no) VALUES (?, ?, ?, ?, ?, ?, ?)", [date, donor_name, finalAmount, 'CREDIT', denomination, sl_no, receipt_no]);
      showToast('Receipt Saved Successfully!');
    }
    triggerHaptic();
    setFormMode(null);
    refreshData();
  };

  const handleDelete = async (id) => {
    triggerHaptic();
    if (window.confirm("Delete this receipt permanently?")) {
      await deleteDonation(id);
      showToast('Receipt Deleted', 'error');
      refreshData();
    }
  };

  const handleGeneratePDF = async (denom, startDate, endDate) => {
    try {
      let filtered = donations;
      let filterTxt = "All Denominations";
      if (denom !== "ALL") { 
        filtered = filtered.filter(d => d.denomination == denom); 
        filterTxt = `Denomination: ${denom}`; 
      }
      if (startDate && endDate) { 
        filtered = filtered.filter(d => d.date >= startDate && d.date <= endDate); 
        filterTxt += ` | Date: ${formatDateIN(startDate)} to ${formatDateIN(endDate)}`; 
      }
      const pdfDataUri = generatePDFData(filtered, filterTxt);
      const base64Data = pdfDataUri.split(',')[1];
      const fileName = `Temple_Report_${Date.now()}.pdf`;
      const savedFile = await Filesystem.writeFile({ path: fileName, data: base64Data, directory: Directory.Documents, recursive: true });
      await Share.share({ title: 'Temple Report', url: savedFile.uri });
      showToast('PDF Generated!');
    } catch (error) { showToast(error.message, 'error'); }
  };

  const handleExportBackup = async () => {
    try {
        const wb = XLSX.utils.book_new();
        const uniqueDenoms = [...new Set(donations.map(d => d.denomination))].sort((a, b) => a - b);
        if (uniqueDenoms.length === 0) { showToast("No data to export!", 'error'); return; }
        uniqueDenoms.forEach(denom => {
            const sheetRows = donations.filter(d => d.denomination == denom).map(d => ({
                "Date": formatDateIN(d.date), "Sl No": d.sl_no, "Receipt No": d.receipt_no, "Name & Address": d.donor_name, "Amount": d.amount
            }));
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sheetRows), String(denom));
        });
        const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
        const fileName = `Temple_Backup_${getTodayStr()}.xlsx`;
        const savedFile = await Filesystem.writeFile({ path: fileName, data: wbout, directory: Directory.Cache, recursive: true });
        await Share.share({ title: 'Temple Backup', url: savedFile.uri });
        showToast('Backup Created!');
    } catch (error) { showToast("Export Failed", 'error'); }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
          const bstr = evt.target.result;
          const wb = XLSX.read(bstr, { type: 'binary' });
          const db = await getDB();
          let count = 0;
          for (const sheetName of wb.SheetNames) {
            const cleanSheetName = sheetName.replace(/,/g, '').trim();
            const sheetDenomFallback = parseInt(cleanSheetName);
            const ws = wb.Sheets[sheetName];
            const data = XLSX.utils.sheet_to_json(ws);
            for (const row of data) {
              const sl = row['Sl No'] || row['Sl.No'] || row['Sl. No'];
              const rcpt = row['Receipt No'] || row['Receipt no'] || 'Pending';
              const name = row['Name & Address'] || row.Name || "To be updated"; 
              const rawDate = row.Date; 
              const date = parseExcelDate(rawDate);
              let finalDenom = 0;
              if (row['Denomination']) finalDenom = parseInt(row['Denomination']);
              else if (!isNaN(sheetDenomFallback)) finalDenom = sheetDenomFallback;
              if (!finalDenom || finalDenom === 0) continue;
              let finalAmount = 0;
              let hasAmountInExcel = false;
              if (row.Amount !== undefined) {
                 const cleanAmt = String(row.Amount).replace(/,/g, '');
                 const parsed = parseFloat(cleanAmt);
                 if (parsed > 0) { finalAmount = parsed; hasAmountInExcel = true; }
              }
              if (!hasAmountInExcel && sl) { finalAmount = finalDenom; }
              if (!sl && !hasAmountInExcel) continue;
              if (finalAmount > 0) {
                await db.run(`INSERT INTO donations (date, donor_name, amount, type, denomination, sl_no, receipt_no) VALUES (?, ?, ?, ?, ?, ?, ?)`, 
                  [date, name, finalAmount, 'CREDIT', finalDenom, sl || 'Pending', rcpt]);
                count++;
              }
            }
          }
          triggerHaptic();
          showToast(`Success! Imported ${count} receipts.`);
          refreshData();
      } catch(err) { showToast("Import Error: " + err.message, 'error'); }
    };
    reader.readAsBinaryString(file);
  };

  // --- SCREEN: REPORTS ---
  const ReportsScreen = () => (
    <div className="flex flex-col gap-4 pb-24">
       <h2 className="text-2xl font-bold text-gray-800 px-2">Tools & Reports</h2>
       <div onClick={() => setIsReportSheetOpen(true)} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 active:scale-95 transition-transform">
          <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-2xl">📄</div>
          <div>
             <h3 className="font-bold text-gray-800">PDF Report</h3>
             <p className="text-xs text-gray-500">Generate printable list</p>
          </div>
       </div>
       <div onClick={handleExportBackup} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 active:scale-95 transition-transform">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-2xl">📊</div>
          <div>
             <h3 className="font-bold text-gray-800">Excel Backup</h3>
             <p className="text-xs text-gray-500">Multi-sheet export (Safe)</p>
          </div>
       </div>
       <label className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 active:scale-95 transition-transform cursor-pointer">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-2xl">📥</div>
          <div>
             <h3 className="font-bold text-gray-800">Import Data</h3>
             <p className="text-xs text-gray-500">Restore from Excel file</p>
          </div>
          <input type="file" accept=".xlsx" onChange={handleFileUpload} className="hidden" />
       </label>
    </div>
  );

  return (
    <div className="min-h-screen bg-orange-50 font-sans text-gray-900">
      <Toast show={toast.show} message={toast.message} type={toast.type} />

      {/* HEADER: UPDATED WITH CUSTOM LOGO & SERIF FONT */}
      <div className="sticky top-0 bg-white/90 backdrop-blur-md z-20 pt-12 pb-3 px-4 border-b border-orange-100 flex items-center gap-3 shadow-sm">
         {/* CUSTOM LOGO: Place 'logo.png' in public folder. If missing, it falls back to 🕉️ */}
         <img 
           src="/logo.png" 
           alt="Logo"
           onError={(e) => {e.target.style.display='none'; e.target.nextSibling.style.display='flex'}}
           className="w-10 h-10 object-contain"
         />
         <div className="w-8 h-8 bg-orange-600 rounded-lg hidden items-center justify-center text-white font-bold">🕉️</div>
         
         {/* TITLE: UPDATED TO SERIF & MAROON */}
         <h1 className="font-serif font-bold text-orange-900 text-lg tracking-wide">Sri Venkateswara Swamy Temple</h1>
      </div>

      <div className="p-4 max-w-md mx-auto min-h-screen">
        {activeTab === 'home' && <HomeScreen totalFund={totalFund} todayTotal={todayTotal} donations={donations} />}
        {activeTab === 'ledger' && (
           <LedgerScreen 
              donations={donations} 
              DENOMINATIONS={DENOMINATIONS} 
              handleDelete={handleDelete} 
              openEdit={openEdit} 
           />
        )}
        {activeTab === 'reports' && <ReportsScreen />}
      </div>

      {activeTab !== 'reports' && (
        <button onClick={openAdd} className="fixed bottom-24 right-6 w-16 h-16 bg-orange-600 rounded-full text-white shadow-2xl flex items-center justify-center hover:bg-orange-700 active:scale-90 transition-transform z-30">
           <Icons.Plus />
        </button>
      )}

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 pb-safe pt-2 px-6 flex justify-between items-center z-40 h-20 shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
         <button onClick={()=>{triggerHaptic(); setActiveTab('home')}} className={`flex flex-col items-center gap-1 w-16 ${activeTab==='home' ? 'text-orange-600' : 'text-gray-400'}`}>
            <Icons.Home />
            <span className="text-[10px] font-bold">Home</span>
         </button>
         <button onClick={()=>{triggerHaptic(); setActiveTab('ledger')}} className={`flex flex-col items-center gap-1 w-16 ${activeTab==='ledger' ? 'text-orange-600' : 'text-gray-400'}`}>
            <Icons.List />
            <span className="text-[10px] font-bold">Ledger</span>
         </button>
         <button onClick={()=>{triggerHaptic(); setActiveTab('reports')}} className={`flex flex-col items-center gap-1 w-16 ${activeTab==='reports' ? 'text-orange-600' : 'text-gray-400'}`}>
            <Icons.Chart />
            <span className="text-[10px] font-bold">Reports</span>
         </button>
      </div>

      <TransactionSheet formMode={formMode} formData={formData} setFormData={setFormData} setFormMode={setFormMode} handleSave={handleSave} DENOMINATIONS={DENOMINATIONS}/>
      <ReportFilterSheet isOpen={isReportSheetOpen} onClose={() => setIsReportSheetOpen(false)} DENOMINATIONS={DENOMINATIONS} onGenerate={handleGeneratePDF}/>
    </div>
  );
}

export default App;