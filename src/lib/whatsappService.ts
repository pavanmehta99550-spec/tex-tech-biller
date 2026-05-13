import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, setDoc } from 'firebase/firestore';
import { fireStorage, db } from './firebase';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export interface WhatsAppData {
  billNo: string;
  partyName: string;
  amount: string;
  phone: string;
  id: string;
}

export const whatsappService = {
  generatePDF: async (elementId: string): Promise<Blob> => {
    const element = document.getElementById(elementId);
    if (!element) throw new Error('Preview element not found for PDF generation');
    
    // Scale up for better quality
    const canvas = await html2canvas(element, { 
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    });
    
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ 
      orientation: 'portrait', 
      unit: 'mm', 
      format: 'a4' 
    });
    
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    return pdf.output('blob');
  },

  uploadPDF: async (blob: Blob, fileName: string): Promise<string> => {
    const storageRef = ref(fireStorage, `invoices/${fileName}.pdf`);
    const snapshot = await uploadBytes(storageRef, blob);
    return await getDownloadURL(snapshot.ref);
  },

  createRedirect: async (id: string, targetUrl: string) => {
    await setDoc(doc(db, "shortLinks", id), {
      targetUrl,
      createdAt: new Date().toISOString()
    });
  },

  sendWhatsApp: (data: WhatsAppData, maskedLink: string) => {
    const message = `📦 ANGAD SILK MILLS - INVOICE 📦
-----------------------------------
Bill No: ${data.billNo}
Party: ${data.partyName}
Total: ₹${data.amount}
🔗 Click to view PDF: ${maskedLink}`;

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${data.phone.startsWith('91') ? data.phone : '91' + data.phone}?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
  }
};
