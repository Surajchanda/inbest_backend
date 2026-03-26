import mongoose from "mongoose";
import moment from "moment-timezone";

const leadSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Lead name is required"],
    trim: true,
    minlength: [2, "Name must be at least 2 characters"],
    maxlength: [100, "Name cannot exceed 100 characters"],
  },
  phone: {
    type: String,
    required: [true, "Phone number is required"],
    trim: true,
    match: [/^[0-9+\-\s()]{10,15}$/, "Please provide a valid phone number"],
    index: true,
  },
  email: {
    type: String,
    required: [true, "Email is required"],
    lowercase: true,
    trim: true,
    match: [
      /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
      "Please provide a valid email",
    ],
    index: true,
  },
  source: {
    type: String,
    enum: [
      "website",
      "referral",
      "cold_call",
      "social_media",
      "email_campaign",
      "other",
    ],
    default: "other",
  },
  company: {
    type: String,
    trim: true,
    maxlength: [200, "Company name cannot exceed 200 characters"],
  },
  city: {
    type: String,
    trim: true,
    maxlength: [100, "City name cannot exceed 100 characters"],
  },
  remarks: {
    type: String,
    maxlength: [1000, "Remarks cannot exceed 1000 characters"],
  },
  status: {
    type: String,
    enum: [
      "new",
      "contacted",
      "qualified",
      "proposal",
      "negotiation",
      "converted",
      "lost",
    ],
    default: "new",
  },
  priority: {
    type: String,
    enum: ["low", "medium", "high", "urgent"],
    default: "medium",
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  assignedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  assignedAt: {
    type: Number,
    default: null,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  importBatchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ImportBatch",
    default: null,
  },
  activityLog: [
    {
      action: {
        type: String,
        enum: [
          "created",
          "updated",
          "assigned",
          "status_changed",
          "interaction",
          "deleted",
        ],
      },
      actor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
      timestamp: {
        type: Number,
        default: () => moment().valueOf(),
      },
      metadata: {
        type: Map,
        of: mongoose.Schema.Types.Mixed,
        default: {},
      },
      notes: {
        type: String,
        maxlength: 500,
      },
    },
  ],
  nextFollowUp: {
    type: Number,
    default: null,
  },
  lastContacted: {
    type: Number,
    default: null,
  },
  value: {
    type: Number,
    min: 0,
    default: 0,
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

leadSchema.index({ assignedTo: 1, status: 1 });
leadSchema.index({ email: 1, phone: 1 });
leadSchema.index({ createdAt: -1 });
leadSchema.index({ status: 1, priority: 1 });

const LeadModel = mongoose.model("Lead", leadSchema);

export default LeadModel;
