import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// 1. SANITIZER HELPER: Removes symbols like ₹, ✓ that break the PDF
const cleanText = (str) => {
  if (!str) return "";
  // Keeps only standard English letters, numbers, and basic punctuation
  return String(str).replace(/[^\x00-\x7F]/g, "").trim();
};

export const generatePDFData = (donations, filterDetails) => {
  const doc = new jsPDF();

  // 2. HEADER
  doc.setFontSize(18);
  doc.setTextColor(220, 80, 0); 
  doc.text("SRI VENKATESWARA TEMPLE", 105, 15, { align: "center" });
  
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text("Receipt Register Report", 105, 22, { align: "center" });

  // 3. FILTER INFO
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  const dateStr = new Date().toLocaleDateString('en-GB');
  doc.text(`Generated on: ${dateStr}`, 14, 30);
  doc.text(`Filter: ${filterDetails}`, 14, 35);

  // 4. PREPARE DATA
  // Sort by Date (YYYY-MM-DD ensures correct sorting now)
  const sortedData = [...donations].sort((a, b) => a.date.localeCompare(b.date));
  
  const tableRows = sortedData.map(item => [
    item.date,
    item.sl_no || "-",
    item.receipt_no || "-",
    cleanText(item.donor_name), // <--- CLEANING APPLIED HERE (Fixes the Layout)
    item.amount.toLocaleString()
  ]);

  // 5. TOTAL
  const totalAmount = donations.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

  // 6. DRAW TABLE
  autoTable(doc, {
    startY: 40,
    head: [['Date', 'Sl No', 'Rcpt No', 'Name & Address', 'Amount (Rs)']],
    body: tableRows,
    theme: 'grid',
    headStyles: { fillColor: [220, 80, 0], textColor: 255 },
    styles: { 
      fontSize: 9, 
      cellPadding: 3, 
      valign: 'middle', 
      overflow: 'linebreak' // Ensures text wraps inside the box
    },
    columnStyles: {
      0: { cellWidth: 22 }, // Date
      1: { cellWidth: 15 }, // Sl No
      2: { cellWidth: 20 }, // Rcpt No
      3: { cellWidth: 'auto' }, // Name (Flexible)
      4: { cellWidth: 25, halign: 'right' } // Amount
    },
    foot: [['', '', '', 'GRAND TOTAL', `Rs ${totalAmount.toLocaleString()}`]],
    footStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold', halign: 'right' }
  });

  return doc.output('datauristring');
};