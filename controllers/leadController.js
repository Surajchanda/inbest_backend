import mongoose from "mongoose";
import LeadModel from "../models/Lead.model.js";
import UserModel from "../models/User.model.js";
import moment from "moment-timezone";

const handleError = (res, error, statusCode = 500) => {
  console.error("Lead Controller Error:", error);
  return res.status(statusCode).json({
    success: false,
    message: error.message || "Internal server error",
  });
};

const validateLeadInput = (data, isUpdate = false) => {
  const errors = [];

  if (!isUpdate) {
    if (!data.name || !data.name.trim()) errors.push("Name is required");
    else if (data.name.length < 2)
      errors.push("Name must be at least 2 characters");
    else if (data.name.length > 100)
      errors.push("Name cannot exceed 100 characters");

    if (!data.email || !data.email.trim()) errors.push("Email is required");
    else if (
      !/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(data.email)
    ) {
      errors.push("Invalid email format");
    }

    if (!data.phone || !data.phone.trim())
      errors.push("Phone number is required");
    else if (!/^[0-9+\-\s()]{10,15}$/.test(data.phone)) {
      errors.push("Invalid phone number format");
    }
  } else {
    if (
      data.name !== undefined &&
      (!data.name.trim() || data.name.length < 2)
    ) {
      errors.push("Name must be at least 2 characters");
    }
    if (
      data.email !== undefined &&
      !/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(data.email)
    ) {
      errors.push("Invalid email format");
    }
    if (data.phone !== undefined && !/^[0-9+\-\s()]{10,15}$/.test(data.phone)) {
      errors.push("Invalid phone number format");
    }
  }

  if (
    data.source &&
    ![
      "website",
      "referral",
      "cold_call",
      "social_media",
      "email_campaign",
      "other",
    ].includes(data.source)
  ) {
    errors.push("Invalid source type");
  }

  if (
    data.status &&
    ![
      "new",
      "contacted",
      "qualified",
      "proposal",
      "negotiation",
      "converted",
      "lost",
    ].includes(data.status)
  ) {
    errors.push("Invalid status");
  }

  if (
    data.priority &&
    !["low", "medium", "high", "urgent"].includes(data.priority)
  ) {
    errors.push("Invalid priority");
  }

  return { isValid: errors.length === 0, errors };
};

export const getLeads = async (req, res) => {
  try {
    console.log(
      `Fetching leads for user: ${req.user.email} (${req.user.role})`,
    );

    const {
      status,
      source,
      city,
      priority,
      startDate,
      endDate,
      search,
      sortBy,
      sortOrder,
      page = 1,
      limit = 20,
    } = req.query;

    let query = {};

    if (req.user.role === "sales_rep") query.assignedTo = req.user.id;
    if (status) query.status = status;
    if (source) query.source = source;
    if (priority) query.priority = priority;
    if (city) query.city = { $regex: city, $options: "i" };

    if (startDate && endDate) {
      query.createdAt = { $gte: parseInt(startDate), $lte: parseInt(endDate) };
    }

    if (search) {
      const searchRegex = { $regex: search, $options: "i" };
      query.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
        { company: searchRegex },
      ];
    }

    const currentPage = parseInt(page);
    const itemsPerPage = parseInt(limit);
    const skip = (currentPage - 1) * itemsPerPage;
    const sortField = sortBy || "createdAt";
    const sortOrderNum = sortOrder === "asc" ? 1 : -1;

    const pipeline = [
      { $match: query },
      { $sort: { [sortField]: sortOrderNum } },
      { $skip: skip },
      { $limit: itemsPerPage },
      {
        $lookup: {
          from: "users",
          localField: "assignedTo",
          foreignField: "_id",
          as: "assignedTo",
        },
      },
      { $unwind: { path: "$assignedTo", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "users",
          localField: "createdBy",
          foreignField: "_id",
          as: "createdBy",
        },
      },
      { $unwind: { path: "$createdBy", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "users",
          localField: "assignedBy",
          foreignField: "_id",
          as: "assignedBy",
        },
      },
      { $unwind: { path: "$assignedBy", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          "assignedTo.password": 0,
          "createdBy.password": 0,
          "assignedBy.password": 0,
        },
      },
    ];

    console.log("pipeline===>", JSON.stringify(pipeline));

    // 1. Get total count
    const total = await LeadModel.countDocuments(query);

    // 2. Get paginated leads with lookups
    const leads = await LeadModel.aggregate(pipeline);

    console.log(`Found ${total} leads for user ${req.user.email}`);

    return res.status(200).json({
      success: true,
      data: leads,
      pagination: {
        page: currentPage,
        limit: itemsPerPage,
        total,
        totalPages: Math.ceil(total / itemsPerPage),
      },
    });
  } catch (error) {
    console.error("Error in getLeads:", error);
    return handleError(res, error);
  }
};

export const getLead = async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`Fetching lead details: ${id} for user ${req.user.email}`);

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid lead ID format",
      });
    }

    const lead = await LeadModel.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(id),
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "assignedTo",
          foreignField: "_id",
          as: "assignedToInfo",
        },
      },
      {
        $unwind: {
          path: "$assignedToInfo",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "createdBy",
          foreignField: "_id",
          as: "createdByInfo",
        },
      },
      {
        $unwind: {
          path: "$createdByInfo",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "assignedBy",
          foreignField: "_id",
          as: "assignedByInfo",
        },
      },
      {
        $unwind: {
          path: "$assignedByInfo",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "activityLog.actor",
          foreignField: "_id",
          as: "activityActors",
        },
      },
      {
        $addFields: {
          activityLog: {
            $map: {
              input: "$activityLog",
              as: "log",
              in: {
                $mergeObjects: [
                  "$$log",
                  {
                    actor: {
                      $arrayElemAt: [
                        {
                          $filter: {
                            input: "$activityActors",
                            cond: {
                              $eq: ["$$this._id", "$$log.actor"],
                            },
                          },
                        },
                        0,
                      ],
                    },
                  },
                ],
              },
            },
          },
        },
      },
      {
        $project: {
          _id: 1,
          name: 1,
          phone: 1,
          email: 1,
          source: 1,
          company: 1,
          city: 1,
          remarks: 1,
          status: 1,
          priority: 1,
          assignedTo: {
            _id: "$assignedToInfo._id",
            name: "$assignedToInfo.name",
            email: "$assignedToInfo.email",
            role: "$assignedToInfo.role",
          },
          assignedBy: {
            _id: "$assignedByInfo._id",
            name: "$assignedByInfo.name",
            email: "$assignedByInfo.email",
            role: "$assignedByInfo.role",
          },
          assignedAt: 1,
          createdBy: {
            _id: "$createdByInfo._id",
            name: "$createdByInfo.name",
            email: "$createdByInfo.email",
            role: "$createdByInfo.role",
          },
          importBatchId: 1,
          activityLog: {
            $map: {
              input: "$activityLog",
              as: "log",
              in: {
                _id: "$$log._id",
                action: "$$log.action",
                actor: {
                  _id: "$$log.actor._id",
                  name: "$$log.actor.name",
                  email: "$$log.actor.email",
                  role: "$$log.actor.role",
                },
                timestamp: "$$log.timestamp",
                metadata: "$$log.metadata",
                notes: "$$log.notes",
              },
            },
          },
          nextFollowUp: 1,
          lastContacted: 1,
          value: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      },
    ]);

    if (!lead || lead.length === 0) {
      console.log(`Lead not found: ${id}`);
      return res.status(404).json({
        success: false,
        message: "Lead not found",
      });
    }

    const leadData = lead[0];

    if (
      req.user.role === "sales_rep" &&
      leadData.assignedTo?._id?.toString() !== req.user.id
    ) {
      console.log(`Unauthorized access attempt by ${req.user.email}`);
      return res.status(403).json({
        success: false,
        message: "Not authorized to view this lead",
      });
    }

    console.log(`Lead fetched successfully: ${leadData.name}`);
    return res.status(200).json({
      success: true,
      data: leadData,
    });
  } catch (error) {
    console.error("Get lead error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

export const createLead = async (req, res) => {
  try {
    console.log(`Creating lead by user: ${req.user.email}`);

    const validation = validateLeadInput(req.body);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.errors,
      });
    }

    const existingLead = await LeadModel.findOne({
      $or: [{ email: req.body.email.toLowerCase() }, { phone: req.body.phone }],
    });

    if (existingLead) {
      console.log(`Duplicate lead attempt: ${req.body.email}`);
      return res.status(409).json({
        success: false,
        message: "Lead with this email or phone already exists",
      });
    }

    const now = moment().valueOf();
    const lead = await LeadModel.create({
      name: req.body.name.trim(),
      email: req.body.email.toLowerCase().trim(),
      phone: req.body.phone,
      source: req.body.source || "other",
      company: req.body.company?.trim() || "",
      city: req.body.city?.trim() || "",
      remarks: req.body.remarks?.trim() || "",
      status: req.body.status || "new",
      priority: req.body.priority || "medium",
      createdBy: req.user.id,
      createdAt: now,
      updatedAt: now,
      activityLog: [
        {
          action: "created",
          actor: req.user.id,
          timestamp: now,
          metadata: req.body,
          notes: "Lead created",
        },
      ],
    });

    console.log(`Lead created successfully: ${lead.name}`);
    return res.status(201).json({
      success: true,
      message: "Lead created successfully",
      data: lead,
    });
  } catch (error) {
    if (error.code === 11000) {
      console.log(`Duplicate key error: ${error.keyValue}`);
      return res.status(409).json({
        success: false,
        message: "Lead with this email or phone already exists",
      });
    }
    console.error("Create lead error:", error);
    return handleError(res, error);
  }
};

export const updateLead = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`Updating lead ${id} by ${req.user.email} (${req.user.role})`);

    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid lead ID format" });
    }

    const lead = await LeadModel.findById(id);
    if (!lead)
      return res
        .status(404)
        .json({ success: false, message: "Lead not found" });

    let allowedFields = [];

    if (req.user.role === "admin" || req.user.role === "manager") {
      allowedFields = [
        "name",
        "email",
        "phone",
        "source",
        "company",
        "city",
        "remarks",
        "status",
        "priority",
        "value",
      ];
    } else if (req.user.role === "sales_rep") {
      if (lead.assignedTo?.toString() !== req.user.id) {
        console.log(`Unauthorized update attempt by ${req.user.email}`);
        return res.status(403).json({
          success: false,
          message: "Not authorized to update this lead",
        });
      }
      allowedFields = ["status", "remarks", "priority", "nextFollowUp"];
    }

    const changes = {};
    const updateData = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined && req.body[field] !== lead[field]) {
        changes[field] = { old: lead[field], new: req.body[field] };
        updateData[field] = req.body[field];
      }
    }

    if (Object.keys(changes).length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No changes detected" });
    }

    if (updateData.email && updateData.email !== lead.email) {
      const existing = await LeadModel.findOne({
        email: updateData.email.toLowerCase(),
      });
      if (existing && existing._id.toString() !== id) {
        return res
          .status(409)
          .json({ success: false, message: "Email already in use" });
      }
      updateData.email = updateData.email.toLowerCase().trim();
    }

    if (updateData.phone && updateData.phone !== lead.phone) {
      const existing = await LeadModel.findOne({ phone: updateData.phone });
      if (existing && existing._id.toString() !== id) {
        return res
          .status(409)
          .json({ success: false, message: "Phone already in use" });
      }
    }

    updateData.updatedAt = moment().valueOf();
    const updatedLead = await LeadModel.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    updatedLead.activityLog.push({
      action: "updated",
      actor: req.user.id,
      timestamp: moment().valueOf(),
      metadata: { changes },
      notes: `Lead updated by ${req.user.role}`,
    });
    await updatedLead.save();

    console.log(`Lead ${id} updated successfully`);
    return res.status(200).json({
      success: true,
      message: "Lead updated successfully",
      data: updatedLead,
    });
  } catch (error) {
    console.error("Update lead error:", error);
    return handleError(res, error);
  }
};

export const deleteLead = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`Deleting lead ${id} by ${req.user.email}`);

    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid lead ID format" });
    }

    const lead = await LeadModel.findById(id);
    if (!lead)
      return res
        .status(404)
        .json({ success: false, message: "Lead not found" });

    lead.activityLog.push({
      action: "deleted",
      actor: req.user.id,
      timestamp: moment().valueOf(),
      metadata: { name: lead.name, email: lead.email },
      notes: `Lead deleted by ${req.user.role}`,
    });
    await lead.save();
    await LeadModel.findByIdAndDelete(id);

    console.log(`Lead ${id} deleted successfully`);
    return res
      .status(200)
      .json({ success: true, message: "Lead deleted successfully" });
  } catch (error) {
    console.error("Delete lead error:", error);
    return handleError(res, error);
  }
};

export const assignLead = async (req, res) => {
  try {
    const { id } = req.params;
    const { salesRepId } = req.body;

    console.log(`Assigning lead ${id} to ${salesRepId} by ${req.user.email}`);

    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid lead ID format" });
    }
    if (!salesRepId || !salesRepId.match(/^[0-9a-fA-F]{24}$/)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid sales representative ID" });
    }

    const lead = await LeadModel.findById(id);
    if (!lead)
      return res
        .status(404)
        .json({ success: false, message: "Lead not found" });

    const salesRep = await UserModel.findById(salesRepId);
    if (!salesRep || salesRep.role !== "sales_rep") {
      return res
        .status(400)
        .json({ success: false, message: "Invalid sales representative" });
    }

    const now = moment().valueOf();
    const previousAssignedTo = lead.assignedTo;

    lead.assignedTo = salesRepId;
    lead.assignedBy = req.user.id;
    lead.assignedAt = now;
    lead.updatedAt = now;
    lead.activityLog.push({
      action: "assigned",
      actor: req.user.id,
      timestamp: now,
      metadata: {
        assignedTo: { id: salesRep._id, name: salesRep.name },
        previousAssignedTo,
      },
      notes: `Lead assigned to ${salesRep.name}`,
    });
    await lead.save();

    console.log(`Lead ${id} assigned to ${salesRep.name}`);
    return res.status(200).json({
      success: true,
      message: `Lead assigned to ${salesRep.name}`,
      data: lead,
    });
  } catch (error) {
    console.error("Assign lead error:", error);
    return handleError(res, error);
  }
};

export const logInteraction = async (req, res) => {
  try {
    const { id } = req.params;
    const { interactionType, notes, nextFollowUp, status } = req.body;

    console.log(
      `Logging ${interactionType} for lead ${id} by ${req.user.email}`,
    );

    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid lead ID format" });
    }

    const validTypes = ["call", "follow_up", "meeting", "remark", "email"];
    if (!interactionType || !validTypes.includes(interactionType)) {
      return res.status(400).json({
        success: false,
        message: `Invalid type. Must be: ${validTypes.join(", ")}`,
      });
    }
    if (!notes || !notes.trim()) {
      return res
        .status(400)
        .json({ success: false, message: "Notes are required" });
    }

    const lead = await LeadModel.findById(id);
    if (!lead)
      return res
        .status(404)
        .json({ success: false, message: "Lead not found" });

    if (
      req.user.role === "sales_rep" &&
      lead.assignedTo?.toString() !== req.user.id
    ) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized" });
    }

    const now = moment().valueOf();
    const updateData = { lastContacted: now, updatedAt: now };
    if (
      status &&
      [
        "new",
        "contacted",
        "qualified",
        "proposal",
        "negotiation",
        "converted",
        "lost",
      ].includes(status)
    ) {
      updateData.status = status;
    }
    if (nextFollowUp) updateData.nextFollowUp = parseInt(nextFollowUp);

    const interactionNote = `[${interactionType.toUpperCase()}] ${notes} - ${moment(now).format("YYYY-MM-DD HH:mm")}`;
    updateData.remarks = lead.remarks
      ? `${lead.remarks}\n${interactionNote}`
      : interactionNote;

    const updatedLead = await LeadModel.findByIdAndUpdate(id, updateData, {
      new: true,
    });
    updatedLead.activityLog.push({
      action: "interaction",
      actor: req.user.id,
      timestamp: now,
      metadata: { interactionType, notes, status, nextFollowUp },
      notes: `${interactionType} logged`,
    });
    await updatedLead.save();

    console.log(`Interaction logged for lead ${id}`);
    return res.status(200).json({
      success: true,
      message: "Interaction logged",
      data: updatedLead,
    });
  } catch (error) {
    console.error("Log interaction error:", error);
    return handleError(res, error);
  }
};

export const getLeadTimeline = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`Fetching timeline for lead ${id} by ${req.user.email}`);

    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid lead ID format" });
    }

    const lead = await LeadModel.findById(id).populate(
      "activityLog.actor",
      "name email",
    );

    if (!lead)
      return res
        .status(404)
        .json({ success: false, message: "Lead not found" });

    if (
      req.user.role === "sales_rep" &&
      lead.assignedTo?.toString() !== req.user._id.toString()
    ) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized" });
    }

    const timeline = lead.activityLog
      .map((log) => ({
        id: log._id,
        action: log.action,
        actor: log.actor,
        timestamp: log.timestamp,
        date: moment(log.timestamp).format("YYYY-MM-DD HH:mm:ss"),
        metadata: log.metadata,
        notes: log.notes,
      }))
      .sort((a, b) => b.timestamp - a.timestamp);

    console.log(`Found ${timeline.length} timeline entries for lead ${id}`);
    return res.status(200).json({
      success: true,
      data: { leadName: lead.name, total: timeline.length, timeline },
    });
  } catch (error) {
    console.error("Get lead timeline error:", error);
    return handleError(res, error);
  }
};

export const getLeadStats = async (req, res) => {
  try {
    console.log(`Fetching lead stats for ${req.user.email} (${req.user.role})`);

    let matchQuery = {};
    if (req.user.role === "sales_rep") matchQuery.assignedTo = req.user.id;

    const [total, statusStats, sourceStats, priorityStats] = await Promise.all([
      LeadModel.countDocuments(matchQuery),
      LeadModel.aggregate([
        { $match: matchQuery },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      LeadModel.aggregate([
        { $match: matchQuery },
        { $group: { _id: "$source", count: { $sum: 1 } } },
      ]),
      LeadModel.aggregate([
        { $match: matchQuery },
        { $group: { _id: "$priority", count: { $sum: 1 } } },
      ]),
    ]);

    const byStatus = {},
      bySource = {},
      byPriority = {};
    statusStats.forEach((s) => (byStatus[s._id] = s.count));
    sourceStats.forEach((s) => (bySource[s._id] = s.count));
    priorityStats.forEach((p) => (byPriority[p._id] = p.count));

    console.log(`Stats fetched: Total leads ${total}`);
    return res
      .status(200)
      .json({ success: true, data: { total, byStatus, bySource, byPriority } });
  } catch (error) {
    console.error("Get lead stats error:", error);
    return handleError(res, error);
  }
};

export const getLeadActivity = async (req, res) => {
  try {
    let {
      page = 1,
      limit = 15,
      startDate,
      endDate,
      action,
      userId,
    } = req.query;

    page = parseInt(page);
    limit = parseInt(limit);
    const skip = (page - 1) * limit;

    // Build match conditions for activity logs
    const matchStage = {};

    if (startDate && endDate) {
      matchStage["activityLog.timestamp"] = {
        $gte: parseInt(startDate),
        $lte: parseInt(endDate),
      };
    }

    if (action) {
      matchStage["activityLog.action"] = action;
    }

    if (userId) {
      // Validate ObjectId before converting
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid userId format",
        });
      }
      matchStage["activityLog.actor"] = new mongoose.Types.ObjectId(userId);
    }

    const pipeline = [
      { $unwind: "$activityLog" },

      { $match: matchStage },

      {
        $lookup: {
          from: "users",
          localField: "activityLog.actor",
          foreignField: "_id",
          as: "actorDetails",
        },
      },
      { $unwind: { path: "$actorDetails", preserveNullAndEmptyArrays: true } },

      {
        $project: {
          lead: "$name",
          leadId: "$_id",
          action: "$activityLog.action",
          timestamp: "$activityLog.timestamp",
          user: "$actorDetails.name",
          actor: {
            _id: "$actorDetails._id",
            role: "$actorDetails.role",
          },
          desc: "$activityLog.notes",
        },
      },

      { $sort: { timestamp: -1 } },

      {
        $facet: {
          data: [{ $skip: skip }, { $limit: limit }],
          totalCount: [{ $count: "count" }],
        },
      },
    ];

    // console.log("json=======>", JSON.stringify(pipeline));

    const result = await LeadModel.aggregate(pipeline);

    const data = result[0]?.data || [];
    const total = result[0]?.totalCount[0]?.count || 0;

    return res.status(200).json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      message: "Successfully fetched activity logs",
    });
  } catch (error) {
    console.error("Error in getLeadActivity:", error);
    return handleError(res, error);
  }
};
