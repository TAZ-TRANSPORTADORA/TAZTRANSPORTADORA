import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const inputPath =
  "C:/Users/Neo Loc/OneDrive/Desktop/Consolidado_com_aba_financeiro.xlsx";
const input = await FileBlob.load(inputPath);
const workbook = await SpreadsheetFile.importXlsx(input);

const sheets = await workbook.inspect({
  kind: "sheet",
  include: "id,name",
  maxChars: 12000,
});
console.log("SHEETS");
console.log(sheets.ndjson);

const overview = await workbook.inspect({
  kind: "workbook,sheet,table",
  maxChars: 24000,
  tableMaxRows: 8,
  tableMaxCols: 20,
  tableMaxCellChars: 120,
});
console.log("OVERVIEW");
console.log(overview.ndjson);

for (const name of ["BASE", "REFERENCIA", "FINANCEIRO", "Financeiro"]) {
  try {
    const region = await workbook.inspect({
      kind: "region",
      sheetId: name,
      range: "A1:Z18",
      maxChars: 18000,
    });
    console.log(`REGION ${name}`);
    console.log(region.ndjson);
  } catch {
    // Sheet aliases are probed individually.
  }
}
