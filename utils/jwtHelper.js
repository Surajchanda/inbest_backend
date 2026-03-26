import jwt from "jsonwebtoken";

const JWT_SECRET = "lead_management_super_secret_key_2024_secure_123456789";
const JWT_EXPIRE = "7d";

export const createToken = (userId, email, role) => {
  const payload = {
    id: userId,
    email: email,
    role: role,
    iat: Math.floor(Date.now() / 1000),
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRE,
  });
};

export const verifyToken = (token) => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return {
      isValid: true,
      decoded: decoded,
      error: null,
    };
  } catch (error) {
    let message = "Invalid token";

    if (error.name === "TokenExpiredError") {
      message = "Token expired";
    } else if (error.name === "JsonWebTokenError") {
      message = "Invalid token format";
    }

    return {
      isValid: false,
      decoded: null,
      error: message,
    };
  }
};

export const decodeToken = (token) => {
  try {
    return jwt.decode(token);
  } catch (error) {
    return null;
  }
};

export const isTokenExpired = (token) => {
  const decoded = decodeToken(token);
  if (!decoded) return true;

  const currentTime = Math.floor(Date.now() / 1000);
  return decoded.exp < currentTime;
};
