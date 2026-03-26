import UserModel from "../models/User.model.js";
import { verifyToken } from "../utils/jwtHelper.js";

export const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Not authorized. Please login first.",
    });
  }

  const verification = verifyToken(token);

  if (!verification.isValid) {
    return res.status(401).json({
      success: false,
      message: verification.error,
    });
  }

  const user = await UserModel.findById(verification.decoded.id);

  if (!user) {
    return res.status(401).json({
      success: false,
      message: "User no longer exists",
    });
  }

  if (!user.isActive) {
    return res.status(401).json({
      success: false,
      message: "Your account has been disabled",
    });
  }

  if (user.passwordChangedAt) {
    const changedTimestamp = parseInt(user.passwordChangedAt / 1000, 10);
    if (verification.decoded.iat < changedTimestamp) {
      return res.status(401).json({
        success: false,
        message: "Password was changed. Please login again.",
      });
    }
  }

  req.user = user;
  next();
};

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Role '${req.user.role}' is not authorized to access this route`,
      });
    }
    next();
  };
};

export const isAdmin = (req, res, next) => {
  if (req.user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "Admin access required",
    });
  }
  next();
};

export const isManagerOrAdmin = (req, res, next) => {
  if (!["admin", "manager"].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: "Manager or Admin access required",
    });
  }
  next();
};

export const isManager = (req, res, next) => {
  if (req.user.role !== "manager") {
    return res.status(403).json({
      success: false,
      message: "Manager access required",
    });
  }
  next();
};

export const isSalesRep = (req, res, next) => {
  if (req.user.role !== "sales_rep") {
    return res.status(403).json({
      success: false,
      message: "Sales Representative access required",
    });
  }
  next();
};
