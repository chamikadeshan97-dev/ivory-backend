import jwt from "jsonwebtoken";

const getJwtSecret = () => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error(
      "JWT_SECRET is not configured in the environment variables.",
    );
  }

  return secret;
};

export const generateToken = (payload) => {
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: process.env.JWT_EXPIRES_IN || "8h",
  });
};

export const verifyToken = (token) => {
  return jwt.verify(token, getJwtSecret());
};

export const decodeToken = (token) => {
  return jwt.decode(token);
};

export default {
  generateToken,
  verifyToken,
  decodeToken,
};