import bcrypt from "bcryptjs";
import crypto from "crypto";

import { readSheet ,writeSheet} from "../utils/excelDb.js";
import { generateToken } from "../utils/token.js";

const normalizeText = (value) => {
  return String(value ?? "")
    .trim()
    .toLowerCase();
};

const sanitizeUser = (user) => {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    username: user.username,
    role: user.role,
    status: user.status,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
};

const findUserByUsername = async (username) => {
  const users = await readSheet("Users");

  const normalizedUsername = normalizeText(username);

  return users.find(
    (user) => normalizeText(user.username) === normalizedUsername,
  );
};

const findUserById = async (userId) => {
  const users = await readSheet("Users");

  return users.find((user) => String(user.id).trim() === String(userId).trim());
};

const validateUserStatus = (user) => {
  const status = normalizeText(user?.status);

  if (!status) {
    const error = new Error("This user account is inactive.");

    error.statusCode = 403;

    throw error;
  }
};

export const loginUser = async ({ username, password }) => {
  if (!username || !password) {
    const error = new Error("Username and password are required.");

    error.statusCode = 400;

    throw error;
  }

  const user = await findUserByUsername(username);

  if (!user) {
    const error = new Error("Invalid username or password.");

    error.statusCode = 401;

    throw error;
  }

//  validateUserStatus(user);

  const passwordHash = user.password_hash || user.password;

  if (!passwordHash) {
    const error = new Error(
      "The user account does not have a password configured.",
    );

    error.statusCode = 500;

    throw error;
  }

  const passwordMatches = await bcrypt.compare(
    String(password),
    String(passwordHash),
  );

  if (!passwordMatches) {
    const error = new Error("Invalid username or password.");

    error.statusCode = 401;

    throw error;
  }

  const safeUser = sanitizeUser(user);

  const token = generateToken({
    userId: user.id,
    username: user.username,
    role: user.role,
  });

  return {
    token,
    user: safeUser,
  };
};

export const getAuthenticatedUser = async (userId) => {
  const user = await findUserById(userId);

  if (!user) {
    const error = new Error("Authenticated user was not found.");

    error.statusCode = 404;

    throw error;
  }

  validateUserStatus(user);

  return sanitizeUser(user);
};

export const hashPassword = async (password) => {
  if (!password || String(password).length < 6) {
    const error = new Error("Password must contain at least 6 characters.");

    error.statusCode = 400;

    throw error;
  }

  const saltRounds = 12;

  return bcrypt.hash(String(password), saltRounds);
};






const USERS_SHEET = "Users";

const createError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const normalizeEmail = (email = "") =>
  String(email).trim().toLowerCase();

const normalizeUsername = (username = "") =>
  String(username).trim().toLowerCase();

const getNow = () => new Date().toISOString();

const generateUserId = () => {
  const randomPart = crypto.randomBytes(4).toString("hex");
  return `USR_${randomPart}`;
};

export const registerUser = async (data) => {
  const {
    name,
    email,
    username,
    password,
    phone = "",
    role = "Receptionist",
  } = data;

  if (!name?.trim()) {
    throw createError("Name is required");
  }

  if (!email?.trim()) {
    throw createError("Email is required");
  }

  if (!username?.trim()) {
    throw createError("Username is required");
  }

  if (!password) {
    throw createError("Password is required");
  }

  if (password.length < 6) {
    throw createError(
      "Password must contain at least 6 characters",
    );
  }

  const allowedRoles = [
    "Admin",
    "Dentist","Cashier",
    "Receptionist",
  ];

  if (!allowedRoles.includes(role)) {
    throw createError("Invalid user role");
  }

  const users = await readSheet(USERS_SHEET);

  const formattedEmail = normalizeEmail(email);
  const formattedUsername = normalizeUsername(username);

  const emailExists = users.some(
    (user) =>
      normalizeEmail(user.email) === formattedEmail,
  );

  if (emailExists) {
    throw createError("Email is already registered", 409);
  }

  const usernameExists = users.some(
    (user) =>
      normalizeUsername(user.username) ===
      formattedUsername,
  );

  if (usernameExists) {
    throw createError("Username is already registered", 409);
  }

  const hashedPassword = await bcrypt.hash(password, 12);
  const now = getNow();

  const newUser = {
    id: generateUserId(),
    name: name.trim(),
    email: formattedEmail,
    username: formattedUsername,
    password: hashedPassword,
    phone: String(phone).trim(),
    role,
    status: "Active",
    created_at: now,
    updated_at: now,
  };

  users.push(newUser);

  await writeSheet(USERS_SHEET, users);

  return {
    id: newUser.id,
    name: newUser.name,
    email: newUser.email,
    username: newUser.username,
    phone: newUser.phone,
    role: newUser.role,
    status: newUser.status,
    created_at: newUser.created_at,
  };
};




export default {
  loginUser,
  getAuthenticatedUser,
  hashPassword,registerUser
};
