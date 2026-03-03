declare module "pdf-parse/lib/pdf-parse.js" {
  export interface PdfParseResult {
    text: string;
  }

  export default function pdfParse(buffer: Buffer): Promise<PdfParseResult>;
}
