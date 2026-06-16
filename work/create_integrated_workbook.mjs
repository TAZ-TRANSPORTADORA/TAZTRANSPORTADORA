import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const inputPath =
  "C:/Users/Neo Loc/OneDrive/Desktop/Consolidado_com_aba_financeiro.xlsx";
const outputPath =
  "C:/Users/Neo Loc/Documents/Codex/2026-06-10/ol-vamos-iniciar-um-novo-projeto/outputs/Consolidado_TAZ_integrado.xlsx";

const input = await FileBlob.load(inputPath);
const workbook = await SpreadsheetFile.importXlsx(input);

const tripHeaders = [
  "ID",
  "DataHora",
  "Data",
  "Motorista",
  "Empresa",
  "Placa Cavalo",
  "Placa Carreta",
  "Categoria",
  "KM Inicial",
  "KM Final",
  "KM Rodado",
  "Caixinha",
  "Quantidade Carregada",
  "Chave NF Carregamento",
];

const fuelHeaders = [
  "ID",
  "Viagem ID",
  "DataHora",
  "Data",
  "Motorista",
  "Empresa",
  "Placa Cavalo",
  "KM",
  "Litros",
  "Valor Diesel",
  "Chave NF",
];

const driverHeaders = ["ID", "Nome", "Empresa", "Categoria", "Ativo", "Atualizado em"];
const vehicleHeaders = ["ID", "Placa", "Ativo", "Atualizado em"];

function prepareSheet(name, headers, widths) {
  const existing = workbook.worksheets.items.find((sheet) => sheet.name === name);
  const sheet = existing || workbook.worksheets.add(name);
  const headerRange = sheet.getRangeByIndexes(0, 0, 1, headers.length);
  headerRange.values = [headers];
  headerRange.format = {
    fill: "#004B8D",
    font: { bold: true, color: "#FFFFFF" },
    wrapText: true,
    verticalAlignment: "center",
  };
  headerRange.format.rowHeightPx = 32;
  widths.forEach((width, index) => {
    sheet.getRangeByIndexes(0, index, 2000, 1).format.columnWidthPx = width;
  });
  sheet.freezePanes.freezeRows(1);
  sheet.showGridLines = false;
}

prepareSheet(
  "APP_VIAGENS",
  tripHeaders,
  [190, 170, 100, 160, 110, 110, 110, 170, 90, 90, 90, 90, 145, 265],
);
prepareSheet(
  "APP_ABASTECIMENTOS",
  fuelHeaders,
  [210, 190, 170, 100, 160, 110, 110, 90, 90, 110, 265],
);
prepareSheet(
  "CAD_MOTORISTAS",
  driverHeaders,
  [210, 200, 120, 180, 80, 170],
);
prepareSheet(
  "CAD_CAVALOS",
  vehicleHeaders,
  [210, 130, 80, 170],
);
prepareSheet(
  "CAD_CARRETAS",
  vehicleHeaders,
  [210, 130, 80, 170],
);

const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
console.log(outputPath);
