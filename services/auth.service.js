import bcrypt from "bcryptjs";
import crypto from "crypto";

import {
  readSheet,
  writeSheet,
} from "../utils/googleSheets.js";

import { generateToken } from "../utils/token.js";

const USERS_SHEET = "Users";

const ALLOWED_ROLES = [
  "Admin",
  "Dentist",
  "Cashier",
  "Receptionist",
];

/* ========================================================
   General helpers
======================================================== */

const createError = (
  message,
  statusCode = 400,
) => {
  const error = new Error(message);

  error.statusCode = statusCode;

  return error;
};

const normalizeText = (value) => {
  return String(value ?? "")
    .trim()
    .toLowerCase();
};

const normalizeEmail = (email = "") => {
  return String(email)
    .trim()
    .toLowerCase();
};

const normalizeUsername = (username = "") => {
  return String(username)
    .trim()
    .toLowerCase();
};

const getNow = () => {
  return new Date().toISOString();
};

const generateUserId = () => {
  const randomPart = crypto
    .randomBytes(4)
    .toString("hex");

  return `USR_${randomPart}`;
};

const sanitizeUser = (user) => {
  if (!user) {
    return null;
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    username: user.username,
    phone: user.phone,
    role: user.role,
    status: user.status,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
};

/* ========================================================
   User lookup helpers
======================================================== */

const findUserByUsername = async (
  username,
) => {
  const users =
    await readSheet(USERS_SHEET);

  const normalizedUsername =
    normalizeUsername(username);

  return users.find((user) => {
    return (
      normalizeUsername(user?.username) ===
      normalizedUsername
    );
  });
};

const findUserById = async (userId) => {
  const users =
    await readSheet(USERS_SHEET);

  const normalizedUserId = String(
    userId ?? "",
  ).trim();

  return users.find((user) => {
    return (
      String(user?.id ?? "").trim() ===
      normalizedUserId
    );
  });
};

/* ========================================================
   User status validation
======================================================== */

const validateUserStatus = (user) => {
  const status =
    normalizeText(user?.status);

  /*
   * An empty status or any status other than Active
   * prevents login and authenticated access.
   */
  if (status !== "active") {
    throw createError(
      "This user account is inactive.",
      403,
    );
  }
};

/* ========================================================
   Login
======================================================== */

export const loginUser = async ({
  username,
  password,
}) => {
  if (
    !normalizeUsername(username) ||
    !password
  ) {
    throw createError(
      "Username and password are required.",
      400,
    );
  }

  const user =
    await findUserByUsername(username);

  if (!user) {
    throw createError(
      "Invalid username or password.",
      401,
    );
  }

  validateUserStatus(user);

  /*
   * password_hash is the recommended field.
   * password is retained as a compatibility fallback
   * for users already saved in the old Excel database.
   */
  const passwordHash =
    user.password_hash ||
    user.password;

  if (!passwordHash) {
    throw createError(
      "The user account does not have a password configured.",
      500,
    );
  }

  const passwordMatches =
    await bcrypt.compare(
      String(password),
      String(passwordHash),
    );

  if (!passwordMatches) {
    throw createError(
      "Invalid username or password.",
      401,
    );
  }

  const token = generateToken({
    userId: user.id,
    username: user.username,
    role: user.role,
  });

  return {
    token,
    user: sanitizeUser(user),
  };
};

/* ========================================================
   Get authenticated user
======================================================== */

export const getAuthenticatedUser = async (
  userId,
) => {
  if (!String(userId ?? "").trim()) {
    throw createError(
      "User ID is required.",
      400,
    );
  }

  const user =
    await findUserById(userId);

  if (!user) {
    throw createError(
      "Authenticated user was not found.",
      404,
    );
  }

  validateUserStatus(user);

  return sanitizeUser(user);
};

/* ========================================================
   Hash password
======================================================== */

export const hashPassword = async (
  password,
) => {
  const passwordValue =
    String(password ?? "");

  if (passwordValue.length < 6) {
    throw createError(
      "Password must contain at least 6 characters.",
      400,
    );
  }

  return bcrypt.hash(
    passwordValue,
    12,
  );
};

/* ========================================================
   Register user
======================================================== */

export const registerUser = async (
  data = {},
) => {
  const {
    name,
    email,
    username,
    password,
    phone = "",
    role = "Receptionist",
  } = data;

  const formattedName =
    String(name ?? "").trim();

  const formattedEmail =
    normalizeEmail(email);

  const formattedUsername =
    normalizeUsername(username);

  const passwordValue =
    String(password ?? "");

  const formattedRole =
    String(role ?? "").trim();

  if (!formattedName) {
    throw createError(
      "Name is required",
      400,
    );
  }

  if (!formattedEmail) {
    throw createError(
      "Email is required",
      400,
    );
  }

  if (!formattedUsername) {
    throw createError(
      "Username is required",
      400,
    );
  }

  if (!passwordValue) {
    throw createError(
      "Password is required",
      400,
    );
  }

  if (passwordValue.length < 6) {
    throw createError(
      "Password must contain at least 6 characters",
      400,
    );
  }

  if (
    !ALLOWED_ROLES.includes(
      formattedRole,
    )
  ) {
    throw createError(
      `Invalid user role. Use ${ALLOWED_ROLES.join(
        ", ",
      )}`,
      400,
    );
  }

  const users =
    await readSheet(USERS_SHEET);

  const emailExists =
    users.some((user) => {
      return (
        normalizeEmail(user?.email) ===
        formattedEmail
      );
    });

  if (emailExists) {
    throw createError(
      "Email is already registered",
      409,
    );
  }

  const usernameExists =
    users.some((user) => {
      return (
        normalizeUsername(
          user?.username,
        ) === formattedUsername
      );
    });

  if (usernameExists) {
    throw createError(
      "Username is already registered",
      409,
    );
  }

  const passwordHash =
    await hashPassword(passwordValue);

  const timestamp = getNow();

  const newUser = {
    id: generateUserId(),

    name:
      formattedName,

    email:
      formattedEmail,

    username:
      formattedUsername,

    phone:
      String(phone ?? "").trim(),

    password_hash:
      passwordHash,

    role:
      formattedRole,

    status:
      "Active",

    created_at:
      timestamp,

    updated_at:
      timestamp,
  };

  users.push(newUser);

  await writeSheet(
    USERS_SHEET,
    users,
  );

  return sanitizeUser(newUser);
};

export default {
  loginUser,
  getAuthenticatedUser,
  hashPassword,
  registerUser,
};