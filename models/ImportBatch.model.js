import mongoose from "mongoose";
import moment from "moment-timezone";

const importBatchSchema = new mongoose.Schema({
  fileName: {
    type: String,
    required: true,
    trim: true,
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  totalRows: {
    type: Number,
    default: 0,
    min: 0,
  },
  successfulRows: {
    type: Number,
    default: 0,
    min: 0,
  },
  failedRows: {
    type: Number,
    default: 0,
    min: 0,
  },
  status: {
    type: String,
    enum: ["processing", "completed", "failed"],
    default: "processing",
  },
  failures: [
    {
      rowNumber: {
        type: Number,
        required: true,
      },
      reason: {
        type: String,
        required: true,
      },
      data: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
      },
    },
  ],
  uploadedAt: {
    type: Number,
    default: () => moment().valueOf(),
  },
  completedAt: {
    type: Number,
    default: null,
  },
  createdAt: {
    type: Number,
    default: () => moment().valueOf(),
  },
  updatedAt: {
    type: Number,
    default: () => moment().valueOf(),
  },
});

importBatchSchema.index({ uploadedBy: 1, uploadedAt: -1 });
importBatchSchema.index({ status: 1 });

const ImportBatchModel = mongoose.model("ImportBatch", importBatchSchema);

export default ImportBatchModel;
