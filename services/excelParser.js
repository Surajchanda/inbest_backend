import ExcelJS from "exceljs";

export const parseExcelFile = async (fileBuffer) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(fileBuffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new Error("Excel file has no worksheets");
  }

  // Get headers from first row
  const headers = [];
  const headerRow = worksheet.getRow(1);
  headerRow.eachCell((cell, colNumber) => {
    let headerValue = cell.value?.toString().toLowerCase().trim();
    // Map common variations to standard headers
    const headerMap = {
      "full name": "name",
      fullname: "name",
      "customer name": "name",
      contact: "name",
      mobile: "phone",
      "contact number": "phone",
      telephone: "phone",
      "e-mail": "email",
      "email address": "email",
      mail: "email",
      "lead source": "source",
      lead_source: "source",
      organisation: "company",
      organization: "company",
      business: "company",
      location: "city",
      address: "city",
      note: "remarks",
      notes: "remarks",
      comment: "remarks",
    };

    if (headerMap[headerValue]) {
      headers[colNumber] = headerMap[headerValue];
    } else {
      headers[colNumber] = headerValue;
    }
  });

  const requiredHeaders = ["name", "phone", "email"];
  const missingHeaders = requiredHeaders.filter(
    (h) => !Object.values(headers).includes(h),
  );

  if (missingHeaders.length > 0) {
    throw new Error(`Missing required columns: ${missingHeaders.join(", ")}`);
  }

  // Parse rows
  const rows = [];
  const errors = [];

  for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    const rowData = {};

    let isEmpty = true;
    row.eachCell((cell) => {
      if (cell.value && cell.value.toString().trim()) {
        isEmpty = false;
      }
    });

    if (isEmpty) continue;

    // Extract data based on headers
    headers.forEach((header, colIndex) => {
      if (header) {
        const cell = row.getCell(colIndex);
        rowData[header] = cell.value ? cell.value.toString().trim() : "";
      }
    });

    rows.push({
      rowNumber,
      data: rowData,
    });
  }

  return {
    headers,
    rows,
    totalRows: rows.length,
  };
};
