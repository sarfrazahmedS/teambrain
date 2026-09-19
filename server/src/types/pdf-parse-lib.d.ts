// pdf-parse's main entry (index.js) runs a debug block on import that reads a
// local test PDF — which throws under ESM. We import the lib file directly and
// declare its (untyped) shape here.
declare module "pdf-parse/lib/pdf-parse.js" {
  const pdfParse: (dataBuffer: Buffer) => Promise<{ text: string; numpages: number }>;
  export default pdfParse;
}
