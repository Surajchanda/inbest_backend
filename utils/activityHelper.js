import moment from "moment-timezone";
import LeadModel from "../models/LeadModel.js";

export const addLeadActivity = async (
  leadId,
  action,
  actorId,
  metadata = {},
  notes = "",
) => {
  const lead = await LeadModel.findById(leadId);
  if (!lead) {
    return false;
  }

  if (!lead.activityLog) {
    lead.activityLog = [];
  }

  lead.activityLog.push({
    action,
    actor: actorId,
    timestamp: moment().valueOf(),
    metadata,
    notes,
  });

  await lead.save();
  return true;
};

export const formatActivityLog = (activity) => {
  return {
    action: activity.action,
    actor: activity.actor,
    timestamp: activity.timestamp,
    date: moment(activity.timestamp).format("YYYY-MM-DD HH:mm:ss"),
    metadata: activity.metadata,
    notes: activity.notes,
  };
};

export const getLeadTimeline = async (leadId) => {
  const lead = await LeadModel.findById(leadId).populate(
    "activityLog.actor",
    "name email",
  );

  if (!lead) return [];

  return lead.activityLog.map((log) => formatActivityLog(log));
};
