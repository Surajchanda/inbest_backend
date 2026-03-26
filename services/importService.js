import moment from "moment-timezone";
import LeadModel from "../models/Lead.model.js";
import ImportBatchModel from "../models/ImportBatch.model.js";
import { parseExcelFile } from "./excelParser.js";
import { validateLeadRow, validateExcelHeaders } from "./validationService.js";

export const processImport = async (fileBuffer, fileName, userId) => {
  const now = moment().valueOf();

  const importBatch = await ImportBatchModel.create({
    fileName,
    uploadedBy: userId,
    totalRows: 0,
    successfulRows: 0,
    failedRows: 0,
    status: "processing",
    failures: [],
    uploadedAt: now,
  });

  try {
    const parsedData = await parseExcelFile(fileBuffer);

    const headerValidation = validateExcelHeaders(parsedData.headers);
    if (!headerValidation.isValid) {
      importBatch.status = "failed";
      importBatch.failures = [
        { rowNumber: 0, reason: headerValidation.message, data: {} },
      ];
      importBatch.completedAt = moment().valueOf();
      await importBatch.save();

      throw new Error(headerValidation.message);
    }

    importBatch.totalRows = parsedData.totalRows;
    await importBatch.save();

    const emailsInFile = parsedData.rows
      .map((row) => row.data.email?.toLowerCase())
      .filter((e) => e);
    const phonesInFile = parsedData.rows
      .map((row) => row.data.phone)
      .filter((p) => p);

    const existingLeads = await LeadModel.find({
      $or: [{ email: { $in: emailsInFile } }, { phone: { $in: phonesInFile } }],
    });

    const existingEmails = new Set(existingLeads.map((lead) => lead.email));
    const existingPhones = new Set(existingLeads.map((lead) => lead.phone));

    const validLeads = [];
    const failures = [];
    const fileEmails = new Set();
    const filePhones = new Set();

    for (const row of parsedData.rows) {
      const rowErrors = [];

      if (existingEmails.has(row.data.email?.toLowerCase())) {
        rowErrors.push("Email already exists in database");
      }
      if (existingPhones.has(row.data.phone)) {
        rowErrors.push("Phone number already exists in database");
      }

      const validation = validateLeadRow(
        row.data,
        [...fileEmails],
        [...filePhones],
      );

      if (!validation.isValid) {
        rowErrors.push(...validation.errors);
      }

      if (rowErrors.length > 0) {
        failures.push({
          rowNumber: row.rowNumber,
          reason: rowErrors.join(", "),
          data: row.data,
        });
      } else {
        fileEmails.add(validation.cleanedData.email);
        filePhones.add(validation.cleanedData.phone);

        validLeads.push({
          ...validation.cleanedData,
          createdBy: userId,
          importBatchId: importBatch._id,
          status: "new",
          priority: "medium",
          createdAt: now,
          updatedAt: now,
          activityLog: [
            {
              action: "created",
              actor: userId,
              timestamp: now,
              metadata: { source: "excel_import", fileName },
              notes: "Lead imported from Excel file",
            },
          ],
        });
      }
    }

    let successfulInsert = 0;
    const batchSize = 500;

    for (let i = 0; i < validLeads.length; i += batchSize) {
      const batch = validLeads.slice(i, i + batchSize);
      const inserted = await LeadModel.insertMany(batch, { ordered: false });
      successfulInsert += inserted.length;
    }

    importBatch.successfulRows = successfulInsert;
    importBatch.failedRows = failures.length;
    importBatch.status = "completed";
    importBatch.failures = failures;
    importBatch.completedAt = moment().valueOf();
    await importBatch.save();

    return {
      importBatchId: importBatch._id,
      fileName,
      totalRows: parsedData.totalRows,
      successfulRows: successfulInsert,
      failedRows: failures.length,
      failures: failures.slice(0, 100),
      hasMoreFailures: failures.length > 100,
    };
  } catch (error) {
    importBatch.status = "failed";
    importBatch.failures = [{ rowNumber: 0, reason: error.message, data: {} }];
    importBatch.completedAt = moment().valueOf();
    await importBatch.save();
    throw error;
  }
};
