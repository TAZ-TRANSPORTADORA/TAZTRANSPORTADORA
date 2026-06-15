import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const inputPath =
  "C:/Users/Neo Loc/Documents/Codex/2026-06-10/ol-vamos-iniciar-um-novo-projeto/outputs/Consolidado_TAZ_integrado.xlsx";
const input = await FileBlob.load(inputPath);
const workbook = await SpreadsheetFile.importXlsx(input);

const summary = await workbook.inspect({
  kind: "sheet",
  include: "id,name",
  maxChars: 12000,
});
console.log(summary.ndjson);

for (const sheetName of [
  "APP_VIAGENS",
  "APP_ABASTECIMENTOS",
  "CAD_MOTORISTAS",
  "CAD_CAVALOS",
  "CAD_CARRETAS",
]) {
  const region = await workbook.inspect({
    kind: "region",
    sheetId: sheetName,
    range: "A1:N4",
    maxChars: 8000,
  });
  console.log(region.ndjson);
  const preview = await workbook.render({
    sheetName,
    range:
      sheetName === "APP_VIAGENS"
        ? "A1:N4"
        : sheetName === "APP_ABASTECIMENTOS"
          ? "A1:K4"
          : "A1:F4",
    scale: 1,
    format: "png",
  });
  await fs.writeFile(
    `C:/Users/Neo Loc/Documents/Codex/2026-06-10/ol-vamos-iniciar-um-novo-projeto/work/${sheetName}.png`,
    new Uint8Array(await preview.arrayBuffer()),
  );
}

const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 100 },
  summary: "formula error scan",
});
console.log(errors.ndjson);
