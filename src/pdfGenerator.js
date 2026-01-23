import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// 1. SANITIZER: Keeps text clean
const cleanText = (str) => {
  if (!str) return "";
  return String(str).replace(/[^\x00-\x7F]/g, "").trim();
};

// 2. HELPER: Converts 2026-01-23 -> 23-01-2026
const formatDateIN = (dateStr) => {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split('-');
  return `${d}-${m}-${y}`;
};

export const generatePDFData = (donations, filterDetails) => {
  const doc = new jsPDF();

  // 3. HEADER - BOLD & CENTERED
  doc.setFont("helvetica", "bold"); 
  doc.setFontSize(14); 
  doc.setTextColor(220, 80, 0); // Orange

  // Auto-wrap the long title if it exceeds page width
  const title = "LIST OF DONARS FOR THE CONSTRUCTION OF SRI VENKATESWRA SWAMY TEMPLE, YANAM -533464";
  const splitTitle = doc.splitTextToSize(title, 180); // Wrap at 180mm width
  doc.text(splitTitle, 105, 15, { align: "center" });

  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text("Receipt Register Report", 105, 28, { align: "center" });

  // 4. FILTER INFO
  doc.setFont("helvetica", "normal"); 
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  const dateStr = new Date().toLocaleDateString('en-IN'); // System date in DD/MM/YYYY
  doc.text(`Generated on: ${dateStr}`, 14, 38);
  doc.text(`Filter: ${filterDetails}`, 14, 43);

  // 5. PREPARE DATA
  const sortedData = [...donations].sort((a, b) => a.date.localeCompare(b.date));
  
  const tableRows = sortedData.map(item => [
    formatDateIN(item.date), // <--- DATE FIXED (DD-MM-YYYY)
    item.sl_no || "-",
    item.receipt_no || "-",
    cleanText(item.donor_name),
    // AMOUNT FIXED (Indian format: 2,95,000)
    parseFloat(item.amount).toLocaleString('en-IN') 
  ]);

  const totalAmount = donations.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

  // 6. DRAW TABLE - BOLD & VISIBLE
  autoTable(doc, {
    startY: 48,
    head: [['Date', 'Sl No', 'Rcpt No', 'Name & Address', 'Amount (Rs)']],
    body: tableRows,
    theme: 'grid',
    headStyles: { 
        fillColor: [220, 80, 0], 
        textColor: 255, 
        fontStyle: 'bold', // Header Bold
        halign: 'center'
    },
    styles: { 
      fontSize: 10, // Increased size for visibility
      cellPadding: 3, 
      valign: 'middle', 
      overflow: 'linebreak',
      fontStyle: 'bold', // <--- BODY BOLD (As requested)
      textColor: 20 // Dark gray/black
    },
    columnStyles: {
      0: { cellWidth: 25 }, 
      1: { cellWidth: 15 }, 
      2: { cellWidth: 25 }, 
      3: { cellWidth: 'auto' }, 
      4: { cellWidth: 30, halign: 'right' } 
    },
    // FOOTER with Indian Currency Format
    foot: [['', '', '', 'GRAND TOTAL', `Rs ${totalAmount.toLocaleString('en-IN')}`]],
    footStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold', halign: 'right', fontSize: 11 }
  });

  return doc.output('datauristring');
};