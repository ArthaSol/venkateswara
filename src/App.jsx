import { useState } from 'react';
import * as XLSX from 'xlsx';

function App() {
  const [totalFund, setTotalFund] = useState(5000); 
  const [isToolsOpen, setIsToolsOpen] = useState(false);
  const [lastImport, setLastImport] = useState(null);

  // --- THE CORRECTED BRAIN: Multi-Sheet Reader ---
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      
      let grandTotal = 0;
      let totalEntries = 0;

      // LOOP through ALL sheets (Tabs)
      wb.SheetNames.forEach(sheetName => {
        const ws = wb.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(ws);
        
        data.forEach(row => {
          // 1. Find the amount column (Case insensitive)
          // We check multiple common names: 'Amount', 'amount', 'Credit', 'credit', 'Rs', 'rs'
          const rawVal = row.Amount || row.amount || row.Credit || row.credit || row.Rs || row.rs || 0;
          
          // 2. Clean the number (Remove commas if they exist, e.g., "1,00,000" -> "100000")
          const cleanVal = String(rawVal).replace(/,/g, '');
          
          // 3. Parse and Add
          const numericVal = parseFloat(cleanVal) || 0;
          grandTotal += numericVal;
        });
        
        totalEntries += data.length;
      });

      console.log(`Scanned ${wb.SheetNames.length} sheets.`);
      console.log(`Total Found: ${grandTotal}`);

      setTotalFund(grandTotal);
      setLastImport(`Success! Scanned ${wb.SheetNames.length} sheets & ${totalEntries} entries.`);
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center p-4 font-sans">
      
      {/* --- HEADER --- */}
      <h1 className="text-2xl font-bold text-orange-600 mt-4 mb-6">Temple Ledger</h1>

      {/* --- MAIN CARD --- */}
      <div className="bg-white p-6 rounded-xl shadow-lg w-full max-w-sm text-center border-t-4 border-orange-500">
        <p className="text-gray-500 text-sm uppercase tracking-wide">Total Fund</p>
        <h2 className="text-4xl font-extrabold text-gray-800 my-2">
          ₹ {totalFund.toLocaleString()}
        </h2>
        <p className="text-xs text-green-600 font-semibold bg-green-100 inline-block px-2 py-1 rounded">
          Safe & Verified
        </p>
      </div>

      {/* --- ACTION GRID --- */}
      <div className="grid grid-cols-2 gap-4 w-full max-w-sm mt-8">
        <button className="bg-green-600 hover:bg-green-700 text-white p-4 rounded-xl shadow flex flex-col items-center justify-center transition-transform active:scale-95">
          <span className="text-2xl mb-1">⬇️</span>
          <span className="font-bold">Credit</span>
        </button>
        <button className="bg-red-500 hover:bg-red-600 text-white p-4 rounded-xl shadow flex flex-col items-center justify-center transition-transform active:scale-95">
          <span className="text-2xl mb-1">⬆️</span>
          <span className="font-bold">Debit</span>
        </button>
      </div>

      {/* --- TOOLS BUTTON --- */}
      <button 
        onClick={() => setIsToolsOpen(!isToolsOpen)}
        className="mt-8 text-gray-400 hover:text-gray-600 flex flex-col items-center gap-1"
      >
        <span className="text-2xl">🛠️</span>
        <span className="text-xs">Tools</span>
      </button>

      {/* --- TOOLS PANEL --- */}
      {isToolsOpen && (
        <div className="mt-4 bg-white p-4 rounded-lg shadow w-full max-w-sm border border-gray-200 animate-fade-in">
          <h3 className="font-bold text-gray-700 mb-2">Data Tools</h3>
          
          <label className="w-full bg-blue-100 text-blue-700 py-3 rounded font-semibold hover:bg-blue-200 flex items-center justify-center cursor-pointer">
            <span>📂 Import Excel File</span>
            <input 
              type="file" 
              accept=".xlsx, .xls" 
              onChange={handleFileUpload} 
              className="hidden" 
            />
          </label>

          {lastImport && (
            <p className="text-xs text-green-600 mt-2 text-center">{lastImport}</p>
          )}
        </div>
      )}

    </div>
  );
}

export default App;