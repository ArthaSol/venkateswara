import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { initDB, getDB, getAllDonations, deleteDonation } from './db/database';

function App() {
  const [view, setView] = useState('dashboard'); // 'dashboard' or 'history'
  const [totalFund, setTotalFund] = useState(0);
  const [donations, setDonations] = useState([]); // Stores the list
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  useEffect(() => {
    const setup = async () => {
      try {
        await initDB();
        refreshData();
      } catch (e) { console.error("DB Error:", e); }
    };
    setup();
  }, []);

  // Refresh both Total and List
  const refreshData = async () => {
    const db = await getDB();
    const res = await db.query("SELECT SUM(amount) as t FROM donations WHERE type='CREDIT'");
    setTotalFund(res.values[0].t || 0);
    
    // Fetch list for the History View
    const all = await getAllDonations();
    setDonations(all);
  };

  const handleDelete = async (id) => {
    const confirm = window.confirm("Are you sure you want to delete this entry?");
    if (confirm) {
      await deleteDonation(id);
      refreshData(); // Refresh list and total immediately
    }
  };

  // ... (Keep handleFileUpload logic exactly as it was) ...
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      setStatusMsg("Reading file...");
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const db = await getDB();
      let count = 0;
      for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(ws);
        for (const row of data) {
          const rawVal = row.Amount || row.amount || row.Credit || row.credit || 0;
          const cleanVal = String(rawVal).replace(/,/g, '');
          const amount = parseFloat(cleanVal) || 0;
          const date = row.Date || new Date().toISOString().split('T')[0];
          const name = row.Name || row.Donor || "Imported Entry";
          if (amount > 0) {
            await db.run(`INSERT INTO donations (date, donor_name, amount, type) VALUES (?, ?, ?, ?)`, 
              [date, name, amount, 'CREDIT']);
            count++;
          }
        }
      }
      setStatusMsg(`Success! Saved ${count} entries.`);
      refreshData();
    };
    reader.readAsBinaryString(file);
  };

  // --- SCREEN 1: DASHBOARD ---
  const Dashboard = () => (
    <div className="flex flex-col items-center w-full max-w-sm">
      <div className="bg-white p-6 rounded-xl shadow-lg w-full text-center border-t-4 border-orange-500">
        <p className="text-gray-500 text-sm uppercase tracking-wide">Total Fund</p>
        <h2 className="text-4xl font-extrabold text-gray-800 my-2">
          ₹ {totalFund.toLocaleString()}
        </h2>
        <p className="text-xs text-green-600 font-semibold bg-green-100 inline-block px-2 py-1 rounded">Safe & Verified</p>
      </div>

      <div className="grid grid-cols-2 gap-4 w-full mt-8">
        <button className="bg-green-600 text-white p-4 rounded-xl shadow font-bold active:scale-95 transition-transform">⬇️ Credit</button>
        <button className="bg-red-500 text-white p-4 rounded-xl shadow font-bold active:scale-95 transition-transform">⬆️ Debit</button>
      </div>

      {/* NEW: View History Button */}
      <button 
        onClick={() => setView('history')}
        className="mt-6 bg-white text-orange-600 border border-orange-100 py-3 px-8 rounded-full shadow-sm font-semibold hover:bg-orange-50 w-full"
      >
        📜 View All History
      </button>

      <button onClick={() => setIsToolsOpen(!isToolsOpen)} className="mt-8 text-gray-400">🛠️ Tools</button>
      {isToolsOpen && (
        <div className="mt-4 bg-white p-4 rounded-lg shadow w-full">
          <label className="block w-full bg-blue-100 text-blue-700 py-3 rounded text-center font-bold cursor-pointer">
            📂 Import Excel
            <input type="file" accept=".xlsx" onChange={handleFileUpload} className="hidden" />
          </label>
          <p className="text-xs text-green-600 mt-2 text-center">{statusMsg}</p>
        </div>
      )}
    </div>
  );

  // --- SCREEN 2: HISTORY LIST ---
  const HistoryList = () => (
    <div className="w-full max-w-sm flex flex-col h-screen pb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setView('dashboard')} className="text-gray-500 font-bold text-lg">← Back</button>
        <h2 className="text-xl font-bold text-gray-800">Transactions</h2>
        <div className="w-8"></div> {/* Spacer to center title */}
      </div>

      {/* The Scrollable List */}
      <div className="flex-1 overflow-y-auto bg-white rounded-xl shadow-inner p-2 space-y-2">
        {donations.length === 0 ? (
          <p className="text-center text-gray-400 mt-10">No records found.</p>
        ) : (
          donations.map((item) => (
            <div key={item.id} className="flex items-center justify-between p-3 border-b border-gray-100 hover:bg-gray-50">
              
              {/* Left: Info */}
              <div className="flex flex-col">
                <span className="font-bold text-gray-800 text-lg">{item.donor_name}</span>
                <span className="text-xs text-gray-400">{item.date}</span>
              </div>

              {/* Right: Amount & Actions */}
              <div className="flex items-center gap-3">
                <span className="font-bold text-green-600">₹{item.amount.toLocaleString()}</span>
                
                {/* Actions */}
                <div className="flex gap-2 ml-2">
                  <button className="p-1 bg-blue-100 text-blue-600 rounded text-xs">✏️</button>
                  <button 
                    onClick={() => handleDelete(item.id)}
                    className="p-1 bg-red-100 text-red-600 rounded text-xs"
                  >
                    🗑️
                  </button>
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
    </div>
  );
}

export default App;