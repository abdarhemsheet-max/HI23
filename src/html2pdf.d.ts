declare module 'html2pdf.js' {
  interface Html2PdfOptions {
    margin?: number | [number, number, number, number];
    filename?: string;
    image?: { type?: string; quality?: number };
    html2canvas?: Record<string, unknown>;
    jsPDF?: Record<string, unknown>;
  }

  interface Html2PdfWorker {
    set(opts: Html2PdfOptions): Html2PdfWorker;
    from(src: string | HTMLElement, type?: 'string' | 'element'): Html2PdfWorker;
    outputPdf(type: 'blob'): Promise<Blob>;
    save(): Promise<void>;
  }

  function html2pdf(): Html2PdfWorker;
  export default html2pdf;
}
