import jsPDF from "jspdf";
import "jspdf-autotable";

export const generatePDF = (donations, filterDetails) => {
  const doc = new jsPDF();

  // 1. HEADER
  doc.setFontSize(18);
  doc.setTextColor(220, 80, 0); // Orange color
  doc.text("SRI VENKATESWARA TEMPLE", 105, 15, { align: "center" });
  
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text("Receipt Register Report", 105, 22, { align: "center" });

  // 2. FILTER INFO
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  const dateStr = new Date().toLocaleDateString('en-GB');
  doc.text(`Generated on: ${dateStr}`, 14, 30);
  doc.text(`Filter: ${filterDetails}`, 14, 35);

  // 3. PREPARE DATA
  const sortedData = [...donations].sort((a, b) => new Date(a.date) - new Date(b.date));
  
  const tableRows = sortedData.map(item => [
    item.date,
    item.sl_no || "-",
    item.receipt_no || "-",
    item.donor_name, 
    item.amount.toLocaleString()
  ]);

  // 4. TOTAL
  const totalAmount = donations.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

  // 5. DRAW TABLE
  doc.autoTable({
    startY: 40,
    head: [['Date', 'Sl No', 'Rcpt No', 'Name & Address', 'Amount (Rs)']],
    body: tableRows,
    theme: 'grid',
    headStyles: { fillColor: [220, 80, 0], textColor: 255 },
    styles: { fontSize: 9, cellPadding: 3, valign: 'middle' },
    columnStyles: {
      0: { cellWidth: 25 },
      1: { cellWidth: 15 },
      2: { cellWidth: 25 },
      3: { cellWidth: 'auto' }, 
      4: { cellWidth: 25, halign: 'right' }
    },
    foot: [['', '', '', 'GRAND TOTAL', `Rs ${totalAmount.toLocaleString()}`]],
    footStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold', halign: 'right' }
  });

  doc.save(`Temple_Report_${dateStr}.pdf`);
};