import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { initDB, getDB, getAllDonations, deleteDonation } from './db/database';

function App() {
  const [view, setView] = useState('dashboard');
  const [totalFund, setTotalFund] = useState(0);
  const [donations, setDonations] = useState([]);
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  // FILTERS
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDenom, setFilterDenom] = useState("");

  // FORM STATE
  const [formMode, setFormMode] = useState(null); // 'ADD' or 'EDIT'
  const [formData, setFormData] = useState({ 
    id: null, 
    donor_name: '', 
    denomination: '100', // Default to 100
    sl_no: '', 
    receipt_no: '', 
    date: '' 
  });

  const DENOMINATIONS = [100, 200, 500, 1000, 2000, 5000, 10000, 25000, 50000, 100000];

  useEffect(() => {
    const setup = async () => {
      try {
        await initDB();
        refreshData();
      } catch (e) { console.error("DB Error:", e); }
    };
    setup();
  }, []);

  const refreshData = async () => {
    const db = await getDB();
    const res = await db.query("SELECT SUM(amount) as t FROM donations WHERE type='CREDIT'");
    setTotalFund(res.values[0].t || 0);
    const all = await getAllDonations();
    setDonations(all);
  };

  // --- OPEN FORMS ---
  const openAdd = () => {
    setFormData({ 
      id: null, 
      donor_name: '', 
      denomination: '100', 
      sl_no: '', 
      receipt_no: '', 
      date: new Date().toISOString().split('T')[0] 
    });
    setFormMode('ADD');
  };

  const openEdit = (item) => {
    setFormData({ 
      id: item.id, 
      donor_name: item.donor_name, 
      denomination: item.denomination, 
      sl_no: item.sl_no, 
      receipt_no: item.receipt_no, 
      date: item.date 
    });
    setFormMode('EDIT'); 
  };

  // --- SAVE LOGIC ---
  const handleSave = async (e) => {
    e.preventDefault();
    const db = await getDB();
    const { id, donor_name, denomination, sl_no, receipt_no, date } = formData;
    
    // Amount is AUTOMATIC based on denomination
    const amount = parseInt(denomination); 

    if (formMode === 'EDIT') {
      await db.run(
        "UPDATE donations SET donor_name=?, amount=?, denomination=?, sl_no=?, receipt_no=?, date=? WHERE id=?", 
        [donor_name, amount, denomination, sl_no, receipt_no, date, id]
      );
    } else {
      await db.run(
        "INSERT INTO donations (date, donor_name, amount, type, denomination, sl_no, receipt_no) VALUES (?, ?, ?, ?, ?, ?, ?)", 
        [date, donor_name, amount, 'CREDIT', denomination, sl_no, receipt_no]
      );
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

  // --- IMPORT LOGIC (The Receipt Book Reader) ---
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
        // 1. DETERMINE DENOMINATION FROM SHEET NAME
        // Remove commas (e.g., "1,00,000" -> "100000")
        const cleanSheetName = sheetName.replace(/,/g, '').trim();
        const sheetDenom = parseInt(cleanSheetName);

        // Skip sheets that aren't numbers (like "Summary" or "Report")
        if (isNaN(sheetDenom)) continue;

        const ws = wb.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(ws);
        
        for (const row of data) {
          // 2. MAP COLUMNS STRICTLY
          const sl = row['Sl No'] || row['Sl.No'] || row['Sl. No'] || '';
          const rcpt = row['Receipt No'] || row['Receipt no'] || '';
          const name = row['Name & Address'] || row.Name || "Unknown";
          
          // 3. DATE HANDLING (Default to Today if missing)
          const date = row.Date || new Date().toISOString().split('T')[0];

          if (sheetDenom > 0) {
            await db.run(
              `INSERT INTO donations (date, donor_name, amount, type, denomination, sl_no, receipt_no) VALUES (?, ?, ?, ?, ?, ?, ?)`, 
              [date, name, sheetDenom, 'CREDIT', sheetDenom, sl, rcpt]
            );
            count++;
          }
        }
      }
      setStatusMsg(`Success! Imported ${count} receipts.`);
      refreshData();
    };
    reader.readAsBinaryString(file);
  };

  // --- FILTERS ---
  const filteredDonations = donations.filter(item => {
    const matchesSearch = item.donor_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (item.receipt_no && item.receipt_no.toString().includes(searchTerm));
    const matchesDenom = filterDenom ? item.denomination == filterDenom : true;
    return matchesSearch && matchesDenom;
  });

  // --- UI COMPONENTS ---
  const TransactionPopup = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50 animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm my-8">
        <h3 className="text-xl font-bold mb-4 text-orange-600">
          {formMode === 'ADD' ? 'New Receipt Entry' : 'Edit Receipt'}
        </h3>
        
        <form onSubmit={handleSave} className="flex flex-col gap-3">
          
          <label className="text-sm font-bold text-gray-700">Select Denomination</label>
          <select 
            value={formData.denomination}
            onChange={(e) => setFormData({...formData, denomination: e.target.value})}
            className="border-2 border-orange-200 p-3 rounded text-xl font-bold text-orange-700 bg-orange-50"
          >
            {DENOMINATIONS.map(d => (
              <option key={d} value={d}>₹ {d.toLocaleString()}</option>
            ))}
          </select>

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs font-bold text-gray-500">Sl No</label>
              <input 
                type="text" 
                value={formData.sl_no} 
                onChange={(e) => setFormData({...formData, sl_no: e.target.value})}
                className="border p-2 rounded w-full"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs font-bold text-gray-500">Receipt No</label>
              <input 
                type="text" 
                value={formData.receipt_no} 
                onChange={(e) => setFormData({...formData, receipt_no: e.target.value})}
                className="border p-2 rounded w-full"
              />
            </div>
          </div>

          <label className="text-sm font-bold text-gray-700">Name & Address</label>
          <textarea 
            rows="2"
            value={formData.donor_name} 
            onChange={(e) => setFormData({...formData, donor_name: e.target.value})}
            className="border p-2 rounded text-lg"
          ></textarea>

          <label className="text-sm font-bold text-gray-700">Date</label>
          <input 
            type="date" 
            value={formData.date} 
            onChange={(e) => setFormData({...formData, date: e.target.value})}
            className="border p-2 rounded"
          />

          <div className="flex gap-2 mt-4">
            <button type="button" onClick={() => setFormMode(null)} className="flex-1 bg-gray-200 py-3 rounded font-bold">Cancel</button>
            <button type="submit" className="flex-1 bg-orange-600 text-white py-3 rounded font-bold">Save Receipt</button>
          </div>
        </form>
      </div>
    </div>
  );

  const Dashboard = () => (
    <div className="flex flex-col items-center w-full max-w-sm">
      <div className="bg-white p-6 rounded-xl shadow-lg w-full text-center border-t-4 border-orange-500">
        <p className="text-gray-500 text-sm uppercase tracking-wide">Total Fund</p>
        <h2 className="text-4xl font-extrabold text-gray-800 my-2">₹ {totalFund.toLocaleString()}</h2>
        <p className="text-xs text-green-600 font-semibold bg-green-100 inline-block px-2 py-1 rounded">Safe & Verified</p>
      </div>

      <div className="w-full mt-8">
        <button 
          onClick={openAdd}
          className="bg-orange-600 hover:bg-orange-700 text-white w-full p-4 rounded-xl shadow-lg font-bold text-xl active:scale-95 transition-transform flex items-center justify-center gap-3"
        >
          <span className="text-3xl">+</span>
          <span>Add Receipt</span>
        </button>
      </div>

      <button onClick={() => setView('history')} className="mt-6 bg-white text-orange-600 border border-orange-100 py-3 px-8 rounded-full shadow-sm font-semibold w-full">📜 View Receipt Book</button>
      
      <button onClick={() => setIsToolsOpen(!isToolsOpen)} className="mt-8 text-gray-400">🛠️ Tools</button>
      {isToolsOpen && (
        <div className="mt-4 bg-white p-4 rounded-lg shadow w-full">
          <label className="block w-full bg-blue-100 text-blue-700 py-3 rounded text-center font-bold cursor-pointer">
            📂 Import Receipt Excel
            <input type="file" accept=".xlsx" onChange={handleFileUpload} className="hidden" />
          </label>
          <p className="text-xs text-green-600 mt-2 text-center">{statusMsg}</p>
        </div>
      )}
    </div>
  );

  const HistoryList = () => (
    <div className="w-full max-w-sm flex flex-col h-screen pb-4">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setView('dashboard')} className="text-gray-500 font-bold text-lg">← Back</button>
        <h2 className="text-xl font-bold text-gray-800">Receipt Book</h2>
        <div className="w-8"></div>
      </div>

      {/* FILTERS */}
      <div className="bg-white p-3 rounded-lg shadow-sm mb-4 space-y-2">
        <div className="flex gap-2">
          <input 
            type="text" 
            placeholder="Search Name or Rcpt No..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 border p-2 rounded text-sm"
          />
          <select 
            value={filterDenom}
            onChange={(e) => setFilterDenom(e.target.value)}
            className="border p-2 rounded text-sm w-24 font-bold text-gray-600"
          >
            <option value="">All</option>
            {DENOMINATIONS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-white rounded-xl shadow-inner p-2 space-y-2">
        {filteredDonations.length === 0 ? (
          <p className="text-center text-gray-400 mt-10">No receipts found.</p>
        ) : (
          filteredDonations.map((item) => (
            <div key={item.id} className="flex items-center justify-between p-3 border-b border-gray-100">
              <div className="flex flex-col">
                <span className="font-bold text-gray-800 text-lg">{item.donor_name}</span>
                <span className="text-xs text-gray-400">
                  Rcpt: <b className="text-gray-600">{item.receipt_no || 'N/A'}</b> • Sl: {item.sl_no}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <span className="block font-bold text-green-600 text-lg">₹{item.amount.toLocaleString()}</span>
                  <span className="block text-xs text-gray-400">{item.date}</span>
                </div>
                <div className="flex gap-2 ml-2">
                  <button onClick={() => openEdit(item)} className="p-1 bg-blue-100 text-blue-600 rounded text-xs">✏️</button>
                  <button onClick={() => handleDelete(item.id)} className="p-1 bg-red-100 text-red-600 rounded text-xs">🗑️</button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center p-4 font-sans">
      <h1 className="text-2xl font-bold text-orange-600 mt-2 mb-4">Temple Ledger</h1>
      {view === 'dashboard' ? <Dashboard /> : <HistoryList />}
      {formMode && <TransactionPopup />}
    </div>
  );
}

export default App;