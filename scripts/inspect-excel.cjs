const XLSX = require('xlsx');
const fs = require('fs');

const latestFile = 'C:/Users/Kevin Avalos/.gemini/antigravity/brain/f0b1f1af-48ab-4706-9b0e-405cfb6e618e/.user_uploaded/media_1791066613252.xlsx';
console.log('Leyendo:', latestFile);

const wb = XLSX.readFile(latestFile);
console.log('Hojas en el libro:', wb.SheetNames);

for (const sheetName of wb.SheetNames) {
  console.log(`\n=== HOJA: ${sheetName} ===`);
  const ws = wb.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json(ws, { raw: false, defval: '' });
  console.log('Total filas encontradas:', rawRows.length);
  
  rawRows.forEach((row, i) => {
    console.log(`Fila ${i + 1}:`, JSON.stringify(row));
  });

  // Análisis de DNIs
  const dniCounts = new Map();
  rawRows.forEach((row, i) => {
    const dni = (row['DNI'] || row['dni'] || row['Dni'] || '').toString().trim();
    const nombre = (row['nmbre y apellidos'] || row['nombre y apellidos'] || row['Nombre'] || '').toString().trim();
    const cel = (row['CELULAR'] || row['celular'] || '').toString().trim();
    if (!dniCounts.has(dni)) {
      dniCounts.set(dni, []);
    }
    dniCounts.get(dni).push({ fila: i + 1, nombre, cel });
  });

  console.log(`\nTotal DNIs únicos en ${sheetName}:`, dniCounts.size);
  console.log('--- REVISIÓN DE DUPLICADOS O REPETIDOS ---');
  let duplicatesFound = false;
  for (const [dni, list] of dniCounts.entries()) {
    if (list.length > 1) {
      duplicatesFound = true;
      console.log(`⚠️ DNI DUPLICADO: ${dni} aparece ${list.length} veces:`);
      list.forEach(item => {
        console.log(`   - Fila ${item.fila}: ${item.nombre} | Cel: ${item.cel || '(sin celular)'}`);
      });
    }
  }
  if (!duplicatesFound) {
    console.log('✅ No hay ningún DNI duplicado en esta hoja.');
  }
}
