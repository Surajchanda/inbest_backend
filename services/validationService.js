export const validateLeadRow = (
  rowData,
  existingEmails = [],
  existingPhones = [],
) => {
  const errors = [];

  // Validate name
  if (!rowData.name || rowData.name.length < 2) {
    errors.push("Name must be at least 2 characters");
  } else if (rowData.name.length > 100) {
    errors.push("Name cannot exceed 100 characters");
  }

  // Validate phone
  const phoneRegex = /^[0-9+\-\s()]{10,15}$/;
  if (!rowData.phone) {
    errors.push("Phone number is required");
  } else if (!phoneRegex.test(rowData.phone)) {
    errors.push(
      "Invalid phone number format. Use 10-15 digits with optional +, -, (), spaces",
    );
  } else if (existingPhones.includes(rowData.phone)) {
    errors.push("Duplicate phone number in this file");
  }

  // Validate email
  const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
  if (!rowData.email) {
    errors.push("Email is required");
  } else if (!emailRegex.test(rowData.email)) {
    errors.push("Invalid email format");
  } else if (existingEmails.includes(rowData.email.toLowerCase())) {
    errors.push("Duplicate email in this file");
  }

  // Validate source
  const validSources = [
    "website",
    "referral",
    "cold_call",
    "social_media",
    "email_campaign",
    "other",
  ];
  if (rowData.source && !validSources.includes(rowData.source.toLowerCase())) {
    errors.push(`Source must be one of: ${validSources.join(", ")}`);
  }

  // Validate company length
  if (rowData.company && rowData.company.length > 200) {
    errors.push("Company name cannot exceed 200 characters");
  }

  // Validate city length
  if (rowData.city && rowData.city.length > 100) {
    errors.push("City name cannot exceed 100 characters");
  }

  return {
    isValid: errors.length === 0,
    errors,
    cleanedData: {
      name: rowData.name?.trim(),
      phone: rowData.phone?.trim(),
      email: rowData.email?.toLowerCase().trim(),
      source: rowData.source?.toLowerCase() || "other",
      company: rowData.company?.trim() || "",
      city: rowData.city?.trim() || "",
      remarks: rowData.remarks?.trim() || "",
    },
  };
};

export const validateExcelHeaders = (headers) => {
  const required = ["name", "phone", "email"];
  const missing = required.filter((r) => !headers.includes(r));

  if (missing.length > 0) {
    return {
      isValid: false,
      message: `Missing required columns: ${missing.join(", ")}`,
    };
  }

  return {
    isValid: true,
    message: "Headers are valid",
  };
};
