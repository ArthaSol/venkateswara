import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { initDB, getDB } from './db/database';

function App() {
  const [totalFund, setTotalFund] = useState(0);
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  // 1. Load Data on Startup (The "Memory" Check)
  useEffect(() => {
    const setup = async () => {
      try {
        await initDB();
        updateTotalFromDB();
      } catch (e) {
        console.error("DB Error:", e);
      }
    };
    setup();
  }, []);

  // 2. Helper: Calculate Total from Database (Source of Truth)
  const updateTotalFromDB = async () => {
    try {
      const db = await getDB();
      // Sum all CREDIT amounts
      const res = await db.query("SELECT SUM(amount) as t FROM donations WHERE type='CREDIT'");
      const total = res.values[0].t || 0;
      setTotalFund(total);
    } catch (e) {
      console.error("Calc Error:", e);
    }
  };

  // 3. The Import Logic (Now saves to DB)
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

      // Loop through ALL sheets
      for (const sheetName of wb.SheetNames) {
        const ws = wb.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(ws);
        
        for (const row of data) {
          // Clean the Amount
          const rawVal = row.Amount || row.amount || row.Credit || row.credit || 0;
          const cleanVal = String(rawVal).replace(/,/g, '');
          const amount = parseFloat(cleanVal) || 0;
          
          // Clean the Date & Name (Optional, prevents crashes)
          const date = row.Date || new Date().toISOString().split('T')[0];
          const name = row.Name || row.Donor || "Imported Entry";

          if (amount > 0) {
            // INSERT INTO DATABASE
            await db.run(`INSERT INTO donations (date, donor_name, amount, type) VALUES (?, ?, ?, ?)`, 
              [date, name, amount, 'CREDIT']
            );
            count++;
          }
        }
      }

      setStatusMsg(`Success! Saved ${count} entries to Database.`);
      updateTotalFromDB(); // Refresh the Orange Card
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center p-4 font-sans">
      
      {/* HEADER */}
      <h1 className="text-2xl font-bold text-orange-600 mt-4 mb-6">Temple Ledger</h1>

      {/* TOTAL CARD */}
      <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-sm text-center border-t-4 border-orange-500">
        <p className="text-gray-500 text-sm uppercase tracking-wide">Total Fund</p>
        <h2 className="text-4xl font-extrabold text-gray-800 my-2">
          ₹ {totalFund.toLocaleString()}
        </h2>
        <p className="text-xs text-green-600 font-semibold bg-green-100 inline-block px-2 py-1 rounded">
          Safe & Verified
        </p>
      </div>

      {/* BUTTONS */}
      <div className="grid grid-cols-2 gap-4 w-full max-w-sm mt-8">
        <button className="bg-green-600 text-white p-4 rounded-xl shadow font-bold">⬇️ Credit</button>
        <button className="bg-red-500 text-white p-4 rounded-xl shadow font-bold">⬆️ Debit</button>
      </div>

      {/* TOOLS */}
      <button onClick={() => setIsToolsOpen(!isToolsOpen)} className="mt-8 text-gray-400">
        🛠️ Tools
      </button>

      {isToolsOpen && (
        <div className="mt-4 bg-white p-4 rounded-lg shadow w-full max-w-sm">
          <label className="block w-full bg-blue-100 text-blue-700 py-3 rounded text-center font-bold cursor-pointer">
            📂 Import Excel to DB
            <input type="file" accept=".xlsx" onChange={handleFileUpload} className="hidden" />
          </label>
          <p className="text-xs text-green-600 mt-2 text-center">{statusMsg}</p>
        </div>
      )}

    </div>
  );
}

export default App;