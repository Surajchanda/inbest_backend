import {
  comparePassword,
  hashPassword,
  validatePassword,
} from "../utils/passwordHelper.js";
import { createToken } from "../utils/jwtHelper.js";
import moment from "moment-timezone";
import UserModel from "../models/User.model.js";

const handleError = (res, error, statusCode = 500) => {
  console.error("Auth Controller Error:", error);

  return res.status(statusCode).json({
    success: false,
    message: error.message || "Internal server error",
    ...(process.env.NODE_ENV === "development" && { stack: error.stack }),
  });
};

const validateLoginInput = (email, password) => {
  const errors = [];

  if (!email || !email.trim()) {
    errors.push("Email is required");
  } else if (!/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(email)) {
    errors.push("Invalid email format");
  }

  if (!password || !password.trim()) {
    errors.push("Password is required");
  } else if (password.length < 6) {
    errors.push("Password must be at least 6 characters");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

const validateCreateUserInput = (name, email, password, role) => {
  const errors = [];

  if (!name || !name.trim()) {
    errors.push("Name is required");
  } else if (name.length < 2) {
    errors.push("Name must be at least 2 characters");
  } else if (name.length > 100) {
    errors.push("Name cannot exceed 100 characters");
  }

  if (!email || !email.trim()) {
    errors.push("Email is required");
  } else if (!/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(email)) {
    errors.push("Invalid email format");
  }

  if (!password) {
    errors.push("Password is required");
  }

  if (role && !["admin", "manager", "sales_rep"].includes(role)) {
    errors.push("Invalid role. Must be admin, manager, or sales_rep");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

export const login = async (req, res) => {
  try {
    console.log(`Login attempt for: ${req.body.email}`);

    const { email, password } = req.body;

    const validation = validateLoginInput(email, password);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.errors,
      });
    }

    const user = await UserModel.findOne({ email }).select("+password");

    if (!user) {
      console.log(`Login failed: User not found - ${email}`);
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    if (!user.isActive) {
      console.log(`Login blocked: Account disabled - ${email}`);
      return res.status(401).json({
        success: false,
        message: "Account has been disabled. Please contact administrator.",
      });
    }

    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      console.log(`Login failed: Invalid password - ${email}`);
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    user.lastLogin = moment().valueOf();
    user.updatedAt = moment().valueOf();
    await user.save({ validateBeforeSave: false });

    const token = createToken(user._id, user.email, user.role);

    console.log(`Login successful: ${email} (${user.role})`);

    const userData = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt,
    };

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      data: userData,
    });
  } catch (error) {
    console.error("Login error:", error);
    return handleError(res, error);
  }
};

export const createUser = async (req, res) => {
  try {
    console.log(`Create user attempt by: ${req.user?.email}`);

    const { name, email, password, role } = req.body;

    const validation = validateCreateUserInput(name, email, password, role);
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        errors: validation.errors,
      });
    }

    const existingUser = await UserModel.findOne({ email });
    if (existingUser) {
      console.log(`Create user failed: Email exists - ${email}`);
      return res.status(409).json({
        success: false,
        message: "User with this email already exists",
      });
    }

    const passwordStrength = validatePassword(password);
    if (!passwordStrength.isValid) {
      return res.status(400).json({
        success: false,
        message: "Password does not meet security requirements",
        errors: passwordStrength.errors,
      });
    }

    const hashedPassword = await hashPassword(password);
    const now = moment().valueOf();

    const user = await UserModel.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
      role: role || "sales_rep",
      createdBy: req.user?.id || null,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    const token = createToken(user._id, user.email, user.role);

    console.log(`User created successfully: ${email} (${user.role})`);

    const userData = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };

    return res.status(201).json({
      success: true,
      message: "User created successfully",
      data: userData,
      token,
    });
  } catch (error) {
    if (error.code === 11000) {
      console.log(`Duplicate email error: ${req.body.email}`);
      return res.status(409).json({
        success: false,
        message: "User with this email already exists",
      });
    }

    console.error("Create user error:", error);
    return handleError(res, error);
  }
};

export const getMe = async (req, res) => {
  try {
    const user = await UserModel.findById(req.user.id).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error("Get me error:", error);
    return handleError(res, error);
  }
};

export const getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.query.role) filter.role = req.query.role;
    if (req.query.isActive !== undefined)
      filter.isActive = req.query.isActive === "true";

    const sortField = req.query.sortBy || "createdAt";
    const sortOrder = req.query.sortOrder === "asc" ? 1 : -1;
    const sort = { [sortField]: sortOrder };

    const [users, total] = await Promise.all([
      UserModel.find(filter)
        .select("-password")
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      UserModel.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      success: true,
      data: users,
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
    console.error("Get all users error:", error);
    return handleError(res, error);
  }
};

export const updateUser = async (req, res) => {
  try {
    const { name, email, role, isActive } = req.body;
    const userId = req.params.id;

    console.log(`Updating user: ${userId} by ${req.user.email}`);

    if (!userId || !userId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format",
      });
    }

    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (userId === req.user.id && role && role !== req.user.role) {
      console.log(`User ${req.user.email} tried to change own role`);
      return res.status(403).json({
        success: false,
        message: "You cannot change your own role",
      });
    }

    if (email && email !== user.email) {
      const existingUser = await UserModel.findOne({ email });
      if (existingUser) {
        return res.status(409).json({
          success: false,
          message: "Email already in use by another account",
        });
      }
      user.email = email.toLowerCase().trim();
    }

    if (name) user.name = name.trim();
    if (role) user.role = role;
    if (isActive !== undefined) user.isActive = isActive;
    user.updatedAt = moment().valueOf();

    await user.save();

    console.log(`User updated: ${user.email} (${user.role})`);

    return res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    console.error("Update user error:", error);
    return handleError(res, error);
  }
};

export const deleteUser = async (req, res) => {
  try {
    const userId = req.params.id;

    console.log(`Deleting user: ${userId} by ${req.user.email}`);

    if (!userId || !userId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID format",
      });
    }

    if (userId === req.user.id) {
      console.log(`User ${req.user.email} tried to delete own account`);
      return res.status(403).json({
        success: false,
        message: "You cannot delete your own account",
      });
    }

    const user = await UserModel.findByIdAndDelete(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    console.log(`User deleted: ${user.email}`);

    return res.status(200).json({
      success: true,
      message: "User deleted successfully",
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Delete user error:", error);
    return handleError(res, error);
  }
};
