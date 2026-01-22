import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { initDB, getDB, getAllDonations, deleteDonation } from './db/database';

function App() {
  const [view, setView] = useState('dashboard');
  const [totalFund, setTotalFund] = useState(0);
  const [donations, setDonations] = useState([]);
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  
  // EDITING STATE
  const [editingItem, setEditingItem] = useState(null); // The item being edited

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

  // --- DATABASE UPDATE FUNCTION (For Edit) ---
  const handleUpdate = async (e) => {
    e.preventDefault(); // Stop page reload
    const { id, donor_name, amount, date } = editingItem;
    
    const db = await getDB();
    await db.run(
      "UPDATE donations SET donor_name = ?, amount = ?, date = ? WHERE id = ?",
      [donor_name, amount, date, id]
    );
    
    setEditingItem(null); // Close the popup
    refreshData(); // Refresh the list
  };

  const handleDelete = async (id) => {
    if (window.confirm("Delete this entry permanently?")) {
      await deleteDonation(id);
      refreshData();
    }
  };

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
          
          // --- FIX: LOOK FOR 'Name & Address' ---
          const name = row['Name & Address'] || row.Name || row.Donor || "Imported Entry";
          
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

  // --- SCREEN: EDIT POPUP ---
  const EditPopup = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-xs">
        <h3 className="text-xl font-bold mb-4 text-orange-600">Edit Donation</h3>
        <form onSubmit={handleUpdate} className="flex flex-col gap-3">
          
          <label className="text-sm font-bold text-gray-700">Name</label>
          <input 
            type="text" 
            value={editingItem.donor_name} 
            onChange={(e) => setEditingItem({...editingItem, donor_name: e.target.value})}
            className="border p-2 rounded text-lg"
          />

          <label className="text-sm font-bold text-gray-700">Amount (₹)</label>
          <input 
            type="number" 
            value={editingItem.amount} 
            onChange={(e) => setEditingItem({...editingItem, amount: e.target.value})}
            className="border p-2 rounded text-lg"
          />

          <label className="text-sm font-bold text-gray-700">Date</label>
          <input 
            type="text" 
            value={editingItem.date} 
            onChange={(e) => setEditingItem({...editingItem, date: e.target.value})}
            className="border p-2 rounded"
          />

          <div className="flex gap-2 mt-4">
            <button 
              type="button" 
              onClick={() => setEditingItem(null)} 
              className="flex-1 bg-gray-200 py-3 rounded font-bold"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="flex-1 bg-orange-500 text-white py-3 rounded font-bold"
            >
              Save
            </button>
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
      <div className="grid grid-cols-2 gap-4 w-full mt-8">
        <button className="bg-green-600 text-white p-4 rounded-xl shadow font-bold">⬇️ Credit</button>
        <button className="bg-red-500 text-white p-4 rounded-xl shadow font-bold">⬆️ Debit</button>
      </div>
      <button onClick={() => setView('history')} className="mt-6 bg-white text-orange-600 border border-orange-100 py-3 px-8 rounded-full shadow-sm font-semibold w-full">📜 View All History</button>
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

  const HistoryList = () => (
    <div className="w-full max-w-sm flex flex-col h-screen pb-4">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setView('dashboard')} className="text-gray-500 font-bold text-lg">← Back</button>
        <h2 className="text-xl font-bold text-gray-800">Transactions</h2>
        <div className="w-8"></div>
      </div>
      <div className="flex-1 overflow-y-auto bg-white rounded-xl shadow-inner p-2 space-y-2">
        {donations.map((item) => (
          <div key={item.id} className="flex items-center justify-between p-3 border-b border-gray-100">
            <div className="flex flex-col">
              <span className="font-bold text-gray-800 text-lg">{item.donor_name}</span>
              <span className="text-xs text-gray-400">{item.date}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-bold text-green-600">₹{item.amount.toLocaleString()}</span>
              <div className="flex gap-2 ml-2">
                <button 
                  onClick={() => setEditingItem(item)} // OPEN THE POPUP
                  className="p-1 bg-blue-100 text-blue-600 rounded text-xs"
                >
                  ✏️
                </button>
                <button onClick={() => handleDelete(item.id)} className="p-1 bg-red-100 text-red-600 rounded text-xs">🗑️</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center p-4 font-sans">
      <h1 className="text-2xl font-bold text-orange-600 mt-2 mb-4">Temple Ledger</h1>
      {view === 'dashboard' ? <Dashboard /> : <HistoryList />}
      {editingItem && <EditPopup />} {/* SHOW POPUP IF EDITING */}
    </div>
  );
}

export default App;