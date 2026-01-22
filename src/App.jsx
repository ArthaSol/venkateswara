import { useState, useEffect } from 'react';
import { initDB, getDB } from './db/database';

function App() {
  const [totalFund, setTotalFund] = useState(0);
  const [isToolsOpen, setIsToolsOpen] = useState(false);

  useEffect(() => {
    // Load Database on Start
    const setup = async () => {
      try {
        await initDB();
        fetchTotal();
      } catch (e) {
        console.error("DB Init Failed", e);
      }
    };
    setup();
  }, []);

  const fetchTotal = async () => {
    try {
      const db = getDB();
      // Simulation Query
      const res = await db.query("SELECT SUM(amount) as t FROM donations");
      if (res.values && res.values.length > 0) {
        setTotalFund(res.values[0].t || 5000); // Default to 5000 for simulator
      }
    } catch (e) {
      console.log("Using Simulator Default");
      setTotalFund(5000);
    }
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

      {/* --- TOOLS PANEL (Import Excel) --- */}
      {isToolsOpen && (
        <div className="mt-4 bg-white p-4 rounded-lg shadow w-full max-w-sm border border-gray-200 animate-fade-in">
          <h3 className="font-bold text-gray-700 mb-2">Data Tools</h3>
          <button className="w-full bg-blue-100 text-blue-700 py-2 rounded font-semibold hover:bg-blue-200">
            📂 Import Excel Data
          </button>
        </div>
      )}

    </div>
  );
}

export default App;