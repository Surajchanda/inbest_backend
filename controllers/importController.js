import multer from "multer";
import path from "path";
import moment from "moment-timezone";
import ImportBatchModel from "../models/ImportBatch.model.js";
import LeadModel from "../models/Lead.model.js";
import { processImport } from "../services/importService.js";
import mongoose from "mongoose";

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [".xlsx", ".xls"];
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Only .xlsx and .xls files are allowed"));
    }
  },
}).single("file");

const handleError = (res, error, statusCode = 500) => {
  console.error("Import Controller Error:", error);
  return res.status(statusCode).json({
    success: false,
    message: error.message || "Internal server error",
  });
};

export const uploadLeads = async (req, res) => {
  upload(req, res, async (err) => {
    if (err) {
      console.log(`Upload error: ${err.message}`);
      return res.status(400).json({
        success: false,
        message: err.message,
      });
    }

    if (!req.file) {
      console.log("No file uploaded");
      return res.status(400).json({
        success: false,
        message: "Please upload a file",
      });
    }

    console.log(
      `Processing upload: ${req.file.originalname} by ${req.user.email}`,
    );
    try {
      const result = await processImport(
        req.file.buffer,
        req.file.originalname,
        req.user.id,
      );

      console.log(
        `Import completed: ${result.successfulRows} successful, ${result.failedRows} failed`,
      );
      return res.status(200).json({
        success: true,
        message: "Import completed",
        data: result,
      });
    } catch (error) {
      console.error("Upload processing error:", error);
      return handleError(res, error);
    }
  });
};

export const getImportBatches = async (req, res) => {
  try {
    console.log(
      `Fetching import batches for ${req.user.email} (${req.user.role})`,
    );

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const matchStage = {};

    if (req.user.role !== "admin") {
      matchStage.uploadedBy = new mongoose.Types.ObjectId(req.user.id);
    }

    const pipeline = [
      { $match: matchStage },
      {
        $lookup: {
          from: "users",
          localField: "uploadedBy",
          foreignField: "_id",
          as: "uploadedBy",
        },
      },
      { $unwind: { path: "$uploadedBy", preserveNullAndEmptyArrays: true } },
      {
        $facet: {
          metadata: [{ $count: "total" }],
          data: [
            { $sort: { uploadedAt: -1 } },
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                _id: 1,
                fileName: 1,
                totalRows: 1,
                successfulRows: 1,
                failedRows: 1,
                status: 1,
                failures: 1,
                uploadedAt: 1,
                completedAt: 1,
                createdAt: 1,
                updatedAt: 1,
                uploadedBy: {
                  _id: "$uploadedBy._id",
                  name: "$uploadedBy.name",
                  email: "$uploadedBy.email",
                },
              },
            },
          ],
        },
      },
    ];

    const results = await ImportBatchModel.aggregate(pipeline);

    const total = results[0]?.metadata[0]?.total || 0;
    const batches = results[0]?.data || [];
    const totalPages = Math.ceil(total / limit);

    console.log(`Found ${total} import batches`);
    return res.status(200).json({
      success: true,
      data: batches,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("Get import batches error:", error);
    return handleError(res, error);
  }
};

export const getImportBatch = async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`Fetching import batch details: ${id} for ${req.user.email}`);

    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid import batch ID format",
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const pipeline = [
      {
        $match: {
          _id: new mongoose.Types.ObjectId(id),
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "uploadedBy",
          foreignField: "_id",
          as: "uploadedBy",
        },
      },
      {
        $unwind: {
          path: "$uploadedBy",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $facet: {
          batchInfo: [
            {
              $project: {
                _id: 1,
                fileName: 1,
                totalRows: 1,
                successfulRows: 1,
                failedRows: 1,
                status: 1,
                failures: 1,
                uploadedAt: 1,
                completedAt: 1,
                createdAt: 1,
                updatedAt: 1,
                uploadedBy: {
                  _id: "$uploadedBy._id",
                  name: "$uploadedBy.name",
                  email: "$uploadedBy.email",
                },
              },
            },
          ],
          successfulLeads: [
            {
              $lookup: {
                from: "leads",
                let: { batchId: "$_id" },
                pipeline: [
                  {
                    $match: {
                      $expr: { $eq: ["$importBatchId", "$$batchId"] },
                    },
                  },
                  {
                    $sort: { createdAt: 1 },
                  },
                  {
                    $skip: skip,
                  },
                  {
                    $limit: limit,
                  },
                  {
                    $project: {
                      name: 1,
                      email: 1,
                      phone: 1,
                      status: 1,
                      source: 1,
                      company: 1,
                      city: 1,
                      createdAt: 1,
                    },
                  },
                ],
                as: "items",
              },
            },
            {
              $addFields: {
                items: { $ifNull: [{ $arrayElemAt: ["$items", 0] }, []] },
              },
            },
            {
              $lookup: {
                from: "leads",
                let: { batchId: "$_id" },
                pipeline: [
                  {
                    $match: {
                      $expr: { $eq: ["$importBatchId", "$$batchId"] },
                    },
                  },
                  {
                    $count: "total",
                  },
                ],
                as: "countResult",
              },
            },
            {
              $addFields: {
                total: {
                  $ifNull: [{ $arrayElemAt: ["$countResult.total", 0] }, 0],
                },
                page: page,
                limit: limit,
                totalPages: {
                  $ceil: {
                    $divide: [
                      {
                        $ifNull: [
                          { $arrayElemAt: ["$countResult.total", 0] },
                          0,
                        ],
                      },
                      limit,
                    ],
                  },
                },
              },
            },
            {
              $project: {
                total: 1,
                page: 1,
                limit: 1,
                totalPages: 1,
                items: 1,
              },
            },
          ],
        },
      },
    ];

    const results = await ImportBatchModel.aggregate(pipeline);

    if (!results || results.length === 0 || !results[0].batchInfo.length) {
      console.log(`Import batch not found: ${id}`);
      return res.status(404).json({
        success: false,
        message: "Import batch not found",
      });
    }

    const batch = results[0].batchInfo[0];
    const successfulLeads = results[0].successfulLeads[0] || {
      total: 0,
      page: page,
      limit: limit,
      totalPages: 0,
      items: [],
    };

    if (
      req.user.role !== "admin" &&
      batch.uploadedBy?._id?.toString() !== req.user.id
    ) {
      console.log(`Unauthorized access to batch ${id} by ${req.user.email}`);
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this import batch",
      });
    }

    console.log(`Batch ${id} details fetched: ${batch.fileName}`);
    return res.status(200).json({
      success: true,
      data: {
        batch: {
          _id: batch._id,
          fileName: batch.fileName,
          totalRows: batch.totalRows,
          successfulRows: batch.successfulRows,
          failedRows: batch.failedRows,
          status: batch.status,
          failures: batch.failures,
          uploadedAt: batch.uploadedAt,
          completedAt: batch.completedAt,
          createdAt: batch.createdAt,
          updatedAt: batch.updatedAt,
          uploadedBy: batch.uploadedBy,
        },
        successfulLeads: successfulLeads,
        failures: batch.failures,
      },
    });
  } catch (error) {
    console.error("Get import batch error:", error);
    return handleError(res, error);
  }
};

export const getImportBatchFailures = async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`Fetching failures for import batch: ${id}`);

    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid import batch ID format",
      });
    }

    const pipeline = [
      {
        $match: {
          _id: new mongoose.Types.ObjectId(id),
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "uploadedBy",
          foreignField: "_id",
          as: "uploadedByInfo",
        },
      },
      {
        $unwind: {
          path: "$uploadedByInfo",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $project: {
          fileName: 1,
          failedRows: 1,
          failures: 1,
          uploadedBy: "$uploadedByInfo._id",
        },
      },
    ];

    const results = await ImportBatchModel.aggregate(pipeline);

    if (!results || results.length === 0) {
      console.log(`Import batch not found: ${id}`);
      return res.status(404).json({
        success: false,
        message: "Import batch not found",
      });
    }

    const batch = results[0];

    if (
      req.user.role !== "admin" &&
      batch.uploadedBy?.toString() !== req.user.id
    ) {
      console.log(`Unauthorized access to failures for batch ${id}`);
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this import batch",
      });
    }

    console.log(
      `Found ${batch.failures?.length || 0} failures for batch ${id}`,
    );
    return res.status(200).json({
      success: true,
      data: {
        fileName: batch.fileName,
        totalFailures: batch.failedRows,
        failures: batch.failures,
      },
    });
  } catch (error) {
    console.error("Get import batch failures error:", error);
    return handleError(res, error);
  }
};
