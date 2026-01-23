import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { initDB, getDB, getAllDonations, deleteDonation } from './db/database';
import { generatePDFData } from './pdfGenerator'; 
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

// HELPER: Display Date as DD-MM-YYYY
const formatDateIN = (dateStr) => {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split('-');
  return `${d}-${m}-${y}`;
};

// ==========================================
// 1. POPUP COMPONENT 
// ==========================================
const TransactionPopup = ({ formMode, formData, setFormData, setFormMode, handleSave, DENOMINATIONS }) => {
  const isAdd = formMode === 'ADD';
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm my-8">
        <h3 className="text-xl font-bold mb-4 text-orange-600">{isAdd ? 'New Receipt Entry' : 'Edit Receipt'}</h3>
        <form onSubmit={handleSave} className="flex flex-col gap-3">
          <label className="text-sm font-bold text-gray-700">Select Category (Denomination)</label>
          <select 
            value={formData.denomination}
            onChange={(e) => {
              const val = e.target.value;
              setFormData(prev => ({...prev, denomination: val, amount: val}));
            }}
            className="border-2 border-orange-200 p-3 rounded text-xl font-bold text-orange-700 bg-orange-50"
          >
            {DENOMINATIONS.map(d => <option key={d} value={d}>₹ {d.toLocaleString('en-IN')}</option>)}
          </select>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs font-bold text-gray-500">Sl No</label>
              <input type="text" value={formData.sl_no} onChange={(e) => setFormData({...formData, sl_no: e.target.value})} className="border p-2 rounded w-full"/>
            </div>
            <div className="flex-1">
              <label className="text-xs font-bold text-gray-500">Receipt No</label>
              <input type="text" value={formData.receipt_no} onChange={(e) => setFormData({...formData, receipt_no: e.target.value})} className="border p-2 rounded w-full"/>
            </div>
          </div>
          <label className="text-sm font-bold text-gray-700">Actual Amount (₹)</label>
          <input type="number" value={formData.amount} onChange={(e) => setFormData({...formData, amount: e.target.value})} className="border p-2 rounded text-lg font-bold"/>
          <label className="text-sm font-bold text-gray-700">Name & Address</label>
          <textarea rows="2" value={formData.donor_name} onChange={(e) => setFormData({...formData, donor_name: e.target.value})} className="border p-2 rounded text-lg"></textarea>
          <label className="text-sm font-bold text-gray-700">Date</label>
          {/* Note: Input Type Date MUST use YYYY-MM-DD for value, but user sees system format */}
          <input type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} className="border p-2 rounded"/>
          <div className="flex gap-2 mt-4">
            <button type="button" onClick={() => setFormMode(null)} className="flex-1 bg-gray-200 py-3 rounded font-bold">Cancel</button>
            <button type="submit" className="flex-1 bg-orange-600 text-white py-3 rounded font-bold">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ==========================================
// 2. REPORT POPUP
// ==========================================
const ReportPopup = ({ isOpen, onClose, DENOMINATIONS, onGenerate }) => {
  if (!isOpen) return null;
  const [denom, setDenom] = useState("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const handleGen = () => {
    onGenerate(denom, startDate, endDate);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm">
        <h3 className="text-xl font-bold mb-4 text-orange-600">📄 Generate PDF Report</h3>
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-bold text-gray-700 block mb-1">Which Denomination?</label>
            <select value={denom} onChange={(e) => setDenom(e.target.value)} className="w-full border p-2 rounded bg-gray-50">
              <option value="ALL">All Denominations (Full Report)</option>
              {DENOMINATIONS.map(d => <option key={d} value={d}>₹ {d.toLocaleString('en-IN')}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-bold text-gray-700 block mb-1">Date Range (Optional)</label>
            <div className="flex gap-2">
              <input type="date" className="border p-2 rounded w-full text-xs" value={startDate} onChange={e => setStartDate(e.target.value)} />
              <span className="self-center">-</span>
              <input type="date" className="border p-2 rounded w-full text-xs" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>
            <p className="text-xs text-gray-400 mt-1">*Leave dates empty for "All Time"</p>
          </div>
          <button onClick={handleGen} className="w-full bg-orange-600 text-white font-bold py-3 rounded-lg shadow mt-2 hover:bg-orange-700">Download PDF</button>
          <button onClick={onClose} className="w-full text-gray-500 text-sm mt-2">Cancel</button>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// 3. DASHBOARD COMPONENT
// ==========================================
const Dashboard = ({ totalFund, openAdd, setView, isToolsOpen, setIsToolsOpen, handleFileUpload, statusMsg, openReport }) => (
  <div className="flex flex-col items-center w-full max-w-sm">
    <div className="bg-white p-6 rounded-xl shadow-lg w-full text-center border-t-4 border-orange-500">
      <p className="text-gray-500 text-sm uppercase tracking-wide">Total Fund</p>
      {/* INDIAN CURRENCY FORMAT */}
      <h2 className="text-4xl font-extrabold text-gray-800 my-2">₹ {totalFund.toLocaleString('en-IN')}</h2>
      <p className="text-xs text-green-600 font-semibold bg-green-100 inline-block px-2 py-1 rounded">Safe & Verified</p>
    </div>
    <div className="w-full mt-8">
      <button onClick={openAdd} className="bg-orange-600 hover:bg-orange-700 text-white w-full p-4 rounded-xl shadow-lg font-bold text-xl active:scale-95 transition-transform flex items-center justify-center gap-3">
        <span className="text-3xl">+</span><span>Add Receipt</span>
      </button>
    </div>
    <button onClick={() => setView('history')} className="mt-6 bg-white text-orange-600 border border-orange-100 py-3 px-8 rounded-full shadow-sm font-semibold w-full">📜 View Receipt Book</button>
    <button onClick={() => setIsToolsOpen(!isToolsOpen)} className="mt-8 text-gray-400">🛠️ Tools & Reports</button>
    {isToolsOpen && (
      <div className="mt-4 w-full space-y-3">
        <button onClick={openReport} className="w-full bg-blue-600 text-white py-3 rounded-lg shadow font-bold flex items-center justify-center gap-2">📄 Generate PDF Report</button>
        <div className="bg-white p-4 rounded-lg shadow w-full">
          <label className="block w-full bg-blue-50 text-blue-700 py-3 rounded text-center font-bold cursor-pointer text-sm">
            📂 Import Excel
            <input type="file" accept=".xlsx" onChange={handleFileUpload} className="hidden" />
          </label>
          <p className="text-xs text-green-600 mt-2 text-center">{statusMsg}</p>
        </div>
      </div>
    )}
  </div>
);

// ==========================================
// 4. HISTORY LIST COMPONENT
// ==========================================
const HistoryList = ({ setView, searchTerm, setSearchTerm, filterDenom, setFilterDenom, DENOMINATIONS, filteredDonations, openEdit, handleDelete }) => (
  <div className="w-full max-w-sm flex flex-col h-screen pb-4">
    <div className="flex items-center justify-between mb-4">
      <button onClick={() => setView('dashboard')} className="text-gray-500 font-bold text-lg">← Back</button>
      <h2 className="text-xl font-bold text-gray-800">Receipt Book</h2>
      <div className="w-8"></div>
    </div>
    <div className="bg-white p-3 rounded-lg shadow-sm mb-4 space-y-2">
      <div className="flex gap-2">
        <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="flex-1 border p-2 rounded text-sm"/>
        <select value={filterDenom} onChange={(e) => setFilterDenom(e.target.value)} className="border p-2 rounded text-sm w-24 font-bold text-gray-600">
          <option value="">All</option>
          {DENOMINATIONS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </div>
    </div>
    <div className="flex-1 overflow-y-auto bg-white rounded-xl shadow-inner p-2 space-y-2">
      {filteredDonations.length === 0 ? <p className="text-center text-gray-400 mt-10">No receipts found.</p> : filteredDonations.map((item) => (
        <div key={item.id} className="flex items-center justify-between p-3 border-b border-gray-100">
          <div className="flex flex-col">
            <span className="font-bold text-gray-800 text-lg">{item.donor_name}</span>
            <span className="text-xs text-gray-400">
              Rcpt: <b className="text-gray-600">{item.receipt_no}</b> • Sl: {item.sl_no}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              {/* INDIAN CURRENCY FORMAT */}
              <span className="block font-bold text-green-600 text-lg">₹{item.amount.toLocaleString('en-IN')}</span>
              {/* INDIAN DATE FORMAT (DD-MM-YYYY) */}
              <span className="block text-xs text-gray-400">{formatDateIN(item.date)}</span>
            </div>
            <div className="flex gap-2 ml-2">
              <button onClick={() => openEdit(item)} className="p-1 bg-blue-100 text-blue-600 rounded text-xs">✏️</button>
              <button onClick={() => handleDelete(item.id)} className="p-1 bg-red-100 text-red-600 rounded text-xs">🗑️</button>
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

// ==========================================
// 5. MAIN APP COMPONENT
// ==========================================
function App() {
  const [view, setView] = useState('dashboard');
  const [totalFund, setTotalFund] = useState(0);
  const [donations, setDonations] = useState([]);
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDenom, setFilterDenom] = useState("");
  const [formMode, setFormMode] = useState(null);
  const [formData, setFormData] = useState({ id: null, donor_name: '', denomination: '100', amount: '100', sl_no: '', receipt_no: '', date: '' });
  
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false); 

  const DENOMINATIONS = [100, 200, 500, 1000, 2000, 5000, 10000, 25000, 50000, 100000];

  useEffect(() => {
    const setup = async () => { try { await initDB(); refreshData(); } catch (e) { console.error("DB Error:", e); } };
    setup();
  }, []);

  const refreshData = async () => {
    const db = await getDB();
    const res = await db.query("SELECT SUM(amount) as t FROM donations WHERE type='CREDIT'");
    setTotalFund(res.values[0].t || 0);
    const all = await getAllDonations();
    setDonations(all);
  };

  const openAdd = () => {
    setFormData({ id: null, donor_name: '', denomination: '100', amount: '100', sl_no: '', receipt_no: '', date: new Date().toISOString().split('T')[0] });
    setFormMode('ADD');
  };

  const openEdit = (item) => {
    setFormData({ id: item.id, donor_name: item.donor_name, denomination: item.denomination, amount: item.amount, sl_no: item.sl_no, receipt_no: item.receipt_no, date: item.date });
    setFormMode('EDIT'); 
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const db = await getDB();
    const { id, donor_name, denomination, sl_no, receipt_no, date, amount } = formData;
    const finalAmount = parseFloat(amount) || 0;
    if (formMode === 'EDIT') {
      await db.run("UPDATE donations SET donor_name=?, amount=?, denomination=?, sl_no=?, receipt_no=?, date=? WHERE id=?", [donor_name, finalAmount, denomination, sl_no, receipt_no, date, id]);
    } else {
      await db.run("INSERT INTO donations (date, donor_name, amount, type, denomination, sl_no, receipt_no) VALUES (?, ?, ?, ?, ?, ?, ?)", [date, donor_name, finalAmount, 'CREDIT', denomination, sl_no, receipt_no]);
    }
    setFormMode(null);
    refreshData();
  };

  const handleDelete = async (id) => {
    if (window.confirm("Delete this receipt permanently?")) {
      await deleteDonation(id);
      refreshData();
    }
  };

  const handleGeneratePDF = async (denom, startDate, endDate) => {
    setIsGenerating(true); 
    
    setTimeout(async () => {
      try {
        let filtered = donations;
        let filterTxt = "All Denominations";
        if (denom !== "ALL") { 
          filtered = filtered.filter(d => d.denomination == denom); 
          filterTxt = `Denomination: ${denom}`; 
        }
        if (startDate && endDate) { 
          filtered = filtered.filter(d => d.date >= startDate && d.date <= endDate); 
          filterTxt += ` | Date: ${startDate} to ${endDate}`; 
        } else { 
          filterTxt += ` | Date: All Time`; 
        }

        const pdfDataUri = generatePDFData(filtered, filterTxt);
        const base64Data = pdfDataUri.split(',')[1];
        const fileName = `Temple_Report_${Date.now()}.pdf`;

        const savedFile = await Filesystem.writeFile({
          path: fileName,
          data: base64Data,
          directory: Directory.Documents,
          recursive: true
        });

        await Share.share({
          title: 'Temple Receipt Report',
          text: `Report generated on ${new Date().toLocaleDateString()}`,
          url: savedFile.uri,
          dialogTitle: 'Download Report'
        });

      } catch (error) {
        console.error("PDF Error:", error);
        alert("PDF Error: " + (error.message || JSON.stringify(error)));
      } finally {
        setIsGenerating(false);
      }
    }, 500);
  };

  const parseExcelDate = (input) => {
    if (!input) return new Date().toISOString().split('T')[0];
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
    return new Date().toISOString().split('T')[0];
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      setStatusMsg("Reading Receipt Books...");
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const db = await getDB();
      let count = 0;
      for (const sheetName of wb.SheetNames) {
        const cleanSheetName = sheetName.replace(/,/g, '').trim();
        const sheetDenom = parseInt(cleanSheetName);
        if (isNaN(sheetDenom)) continue;
        const ws = wb.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(ws);
        for (const row of data) {
          const sl = row['Sl No'] || row['Sl.No'] || row['Sl. No'];
          const rcpt = row['Receipt No'] || row['Receipt no'] || 'Pending';
          const name = row['Name & Address'] || row.Name || "To be updated"; 
          const rawDate = row.Date; 
          const date = parseExcelDate(rawDate);

          let finalAmount = 0;
          let hasAmountInExcel = false;
          if (row.Amount !== undefined) {
             const cleanAmt = String(row.Amount).replace(/,/g, '');
             const parsed = parseFloat(cleanAmt);
             if (parsed > 0) { finalAmount = parsed; hasAmountInExcel = true; }
          }
          if (!hasAmountInExcel && sl) { finalAmount = sheetDenom; }
          if (!sl && !hasAmountInExcel) continue;
          if (finalAmount > 0) {
            await db.run(`INSERT INTO donations (date, donor_name, amount, type, denomination, sl_no, receipt_no) VALUES (?, ?, ?, ?, ?, ?, ?)`, 
              [date, name, finalAmount, 'CREDIT', sheetDenom, sl || 'Pending', rcpt]);
            count++;
          }
        }
      }
      setStatusMsg(`Success! Imported ${count} receipts.`);
      refreshData();
    };
    reader.readAsBinaryString(file);
  };

  const filteredDonations = donations.filter(item => {
    const matchesSearch = item.donor_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (item.receipt_no && item.receipt_no.toString().includes(searchTerm)) ||
                          (item.sl_no && item.sl_no.toString().includes(searchTerm));
    const matchesDenom = filterDenom ? item.denomination == filterDenom : true;
    return matchesSearch && matchesDenom;
  });

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center p-4 font-sans">
      <h1 className="text-2xl font-bold text-orange-600 mt-2 mb-4">Temple Ledger</h1>
      {view === 'dashboard' ? (
        <Dashboard totalFund={totalFund} openAdd={openAdd} setView={setView} isToolsOpen={isToolsOpen} setIsToolsOpen={setIsToolsOpen} handleFileUpload={handleFileUpload} statusMsg={statusMsg} openReport={() => setIsReportOpen(true)}/>
      ) : (
        <HistoryList setView={setView} searchTerm={searchTerm} setSearchTerm={setSearchTerm} filterDenom={filterDenom} setFilterDenom={setFilterDenom} DENOMINATIONS={DENOMINATIONS} filteredDonations={filteredDonations} openEdit={openEdit} handleDelete={handleDelete}/>
      )}
      {formMode && ( <TransactionPopup formMode={formMode} formData={formData} setFormData={setFormData} setFormMode={setFormMode} handleSave={handleSave} DENOMINATIONS={DENOMINATIONS}/> )}
      <ReportPopup isOpen={isReportOpen} onClose={() => setIsReportOpen(false)} DENOMINATIONS={DENOMINATIONS} onGenerate={handleGeneratePDF}/>
      
      {isGenerating && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex flex-col items-center justify-center z-[60]">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-orange-500 mb-4"></div>
          <h2 className="text-white text-xl font-bold">Generating PDF...</h2>
          <p className="text-gray-300">Please wait...</p>
        </div>
      )}
    </div>
  );
}

export default App;