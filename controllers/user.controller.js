import bcrypt from "bcryptjs";

import {
  readSheet,
  writeSheet,
} from "../utils/excelDb.js";

/* --------------------------------------------------------
   Configuration
-------------------------------------------------------- */

const USERS_SHEET_NAME = "Users";

const VALID_USER_ROLES = [
  "Admin",
  "Dentist",
  "Receptionist",
  "Cashier",
];

/* --------------------------------------------------------
   General helpers
-------------------------------------------------------- */

const normalizeText = (value) => {
  return String(value ?? "").trim();
};

const normalizeEmail = (value) => {
  return normalizeText(value).toLowerCase();
};

const normalizeUsername = (value) => {
  return normalizeText(value).toLowerCase();
};

const normalizeRole = (value) => {
  const requestedRole = normalizeText(value).toLowerCase();

  return (
    VALID_USER_ROLES.find(
      (role) =>
        role.toLowerCase() === requestedRole,
    ) || ""
  );
};

const getUserId = (user) => {
  return normalizeText(
    user?.id ||
      user?.user_id ||
      user?._id,
  );
};

const getAuthenticatedUserId = (req) => {
  return normalizeText(
    req.user?.id ||
      req.user?.user_id ||
      req.user?._id,
  );
};

const sanitizeUser = (user) => {
  if (!user) {
    return null;
  }

  const {
    password,
    password_hash,
    passwordHash,
    reset_token,
    resetToken,
    ...safeUser
  } = user;

  return safeUser;
};

const loadUsers = async () => {
  const users = await readSheet(USERS_SHEET_NAME);

  return Array.isArray(users) ? users : [];
};

const saveUsers = async (users) => {
  await writeSheet(USERS_SHEET_NAME, users);
};

const getNextUserId = (users) => {
  const highestNumber = users.reduce(
    (currentHighest, user) => {
      const userId = getUserId(user);

      const match = userId.match(
        /^USR_(\d+)$/i,
      );

      if (!match) {
        return currentHighest;
      }

      const numericId = Number(match[1]);

      if (Number.isNaN(numericId)) {
        return currentHighest;
      }

      return Math.max(
        currentHighest,
        numericId,
      );
    },
    0,
  );

  return `USR_${String(
    highestNumber + 1,
  ).padStart(4, "0")}`;
};

const countAdministrators = (users) => {
  return users.filter(
    (user) =>
      normalizeRole(user?.role) === "Admin",
  ).length;
};

const isValidEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    email,
  );
};

const isValidUsername = (username) => {
  return /^[a-zA-Z0-9._-]+$/.test(
    username,
  );
};

const isValidPhone = (phone) => {
  if (!phone) {
    return true;
  }

  return /^[0-9+\-\s]{9,15}$/.test(phone);
};

/* --------------------------------------------------------
   Request validation
-------------------------------------------------------- */

const validateUserDetails = ({
  name,
  email,
  username,
  phone,
  role,
  password,
  passwordRequired,
}) => {
  if (!name) {
    return "Full name is required.";
  }

  if (name.length < 3) {
    return "Full name must contain at least 3 characters.";
  }

  if (!email) {
    return "Email address is required.";
  }

  if (!isValidEmail(email)) {
    return "Enter a valid email address.";
  }

  if (!username) {
    return "Username is required.";
  }

  if (username.length < 4) {
    return "Username must contain at least 4 characters.";
  }

  if (!isValidUsername(username)) {
    return "Username can contain only letters, numbers, dots, underscores and hyphens.";
  }

  if (!isValidPhone(phone)) {
    return "Enter a valid phone number.";
  }

  if (!role) {
    return "Select a valid user role.";
  }

  if (passwordRequired && !password) {
    return "Password is required.";
  }

  if (password && password.length < 6) {
    return "Password must contain at least 6 characters.";
  }

  return "";
};

/* --------------------------------------------------------
   Register user
-------------------------------------------------------- */

const register = async (req, res) => {
  try {
    const name = normalizeText(req.body?.name);
    const email = normalizeEmail(req.body?.email);
    const username = normalizeUsername(
      req.body?.username,
    );
    const phone = normalizeText(req.body?.phone);
    const role = normalizeRole(req.body?.role);
    const password = String(
      req.body?.password || "",
    );

    const validationError =
      validateUserDetails({
        name,
        email,
        username,
        phone,
        role,
        password,
        passwordRequired: true,
      });

    if (validationError) {
      return res.status(400).json({
        message: validationError,
      });
    }

    const users = await loadUsers();

    const emailExists = users.some(
      (user) =>
        normalizeEmail(user?.email) ===
        email,
    );

    if (emailExists) {
      return res.status(409).json({
        message:
          "A user with this email address already exists.",
      });
    }

    const usernameExists = users.some(
      (user) =>
        normalizeUsername(user?.username) ===
        username,
    );

    if (usernameExists) {
      return res.status(409).json({
        message:
          "This username is already being used.",
      });
    }

    const currentDateTime =
      new Date().toISOString();

    const hashedPassword =
      await bcrypt.hash(password, 10);

    const newUser = {
      id: getNextUserId(users),
      name,
      email,
      username,
      password: hashedPassword,
      phone,
      role,
      created_at: currentDateTime,
      updated_at: currentDateTime,
    };

    users.push(newUser);

    await saveUsers(users);

    return res.status(201).json({
      message: "User registered successfully.",
      user: sanitizeUser(newUser),
    });
  } catch (error) {
    console.error(
      "Error registering user:",
      error,
    );

    return res.status(500).json({
      message: "Unable to register the user.",
    });
  }
};

/* --------------------------------------------------------
   Get all users
-------------------------------------------------------- */

const getAllUsers = async (req, res) => {
  try {
    const users = await loadUsers();

    const safeUsers = users
      .map((user) => sanitizeUser(user))
      .sort((firstUser, secondUser) => {
        const firstName = normalizeText(
          firstUser?.name,
        );

        const secondName = normalizeText(
          secondUser?.name,
        );

        return firstName.localeCompare(
          secondName,
        );
      });

    return res.status(200).json({
      message: "Users loaded successfully.",
      count: safeUsers.length,
      users: safeUsers,
    });
  } catch (error) {
    console.error(
      "Error loading users:",
      error,
    );

    return res.status(500).json({
      message:
        "Unable to load registered users.",
    });
  }
};

/* --------------------------------------------------------
   Get one user
-------------------------------------------------------- */

const getUserById = async (req, res) => {
  try {
    const userId = normalizeText(
      req.params.userId,
    );

    const users = await loadUsers();

    const selectedUser = users.find(
      (user) => getUserId(user) === userId,
    );

    if (!selectedUser) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    return res.status(200).json({
      message: "User loaded successfully.",
      user: sanitizeUser(selectedUser),
    });
  } catch (error) {
    console.error(
      "Error loading user:",
      error,
    );

    return res.status(500).json({
      message: "Unable to load the user.",
    });
  }
};

/* --------------------------------------------------------
   Update user
-------------------------------------------------------- */

const updateUser = async (req, res) => {
  try {
    const userId = normalizeText(
      req.params.userId,
    );

    const name = normalizeText(req.body?.name);
    const email = normalizeEmail(req.body?.email);
    const username = normalizeUsername(
      req.body?.username,
    );
    const phone = normalizeText(req.body?.phone);
    const role = normalizeRole(req.body?.role);
    const password = String(
      req.body?.password || "",
    );

    const validationError =
      validateUserDetails({
        name,
        email,
        username,
        phone,
        role,
        password,
        passwordRequired: false,
      });

    if (validationError) {
      return res.status(400).json({
        message: validationError,
      });
    }

    const users = await loadUsers();

    const userIndex = users.findIndex(
      (user) => getUserId(user) === userId,
    );

    if (userIndex === -1) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    const existingUser = users[userIndex];

    const emailExists = users.some(
      (user, index) =>
        index !== userIndex &&
        normalizeEmail(user?.email) ===
          email,
    );

    if (emailExists) {
      return res.status(409).json({
        message:
          "Another user already uses this email address.",
      });
    }

    const usernameExists = users.some(
      (user, index) =>
        index !== userIndex &&
        normalizeUsername(user?.username) ===
          username,
    );

    if (usernameExists) {
      return res.status(409).json({
        message:
          "Another user already uses this username.",
      });
    }

    const previousRole = normalizeRole(
      existingUser?.role,
    );

    if (
      previousRole === "Admin" &&
      role !== "Admin" &&
      countAdministrators(users) <= 1
    ) {
      return res.status(400).json({
        message:
          "The final administrator cannot be changed to another role.",
      });
    }

    const updatedUser = {
      ...existingUser,
      id:
        getUserId(existingUser) ||
        userId,
      name,
      email,
      username,
      phone,
      role,
      updated_at: new Date().toISOString(),
    };

    if (password) {
      updatedUser.password =
        await bcrypt.hash(password, 10);
    }

    users[userIndex] = updatedUser;

    await saveUsers(users);

    return res.status(200).json({
      message: "User updated successfully.",
      user: sanitizeUser(updatedUser),
    });
  } catch (error) {
    console.error(
      "Error updating user:",
      error,
    );

    return res.status(500).json({
      message: "Unable to update the user.",
    });
  }
};

/* --------------------------------------------------------
   Delete user
-------------------------------------------------------- */

const deleteUser = async (req, res) => {
  try {
    const userId = normalizeText(
      req.params.userId,
    );

    const currentUserId =
      getAuthenticatedUserId(req);

    if (
      currentUserId &&
      currentUserId === userId
    ) {
      return res.status(400).json({
        message:
          "You cannot delete your own account while you are logged in.",
      });
    }

    const users = await loadUsers();

    const userIndex = users.findIndex(
      (user) => getUserId(user) === userId,
    );

    if (userIndex === -1) {
      return res.status(404).json({
        message: "User not found.",
      });
    }

    const selectedUser = users[userIndex];

    if (
      normalizeRole(selectedUser?.role) ===
        "Admin" &&
      countAdministrators(users) <= 1
    ) {
      return res.status(400).json({
        message:
          "The final administrator account cannot be deleted.",
      });
    }

    const updatedUsers = users.filter(
      (_, index) => index !== userIndex,
    );

    await saveUsers(updatedUsers);

    return res.status(200).json({
      message: "User deleted successfully.",
      deleted_user:
        sanitizeUser(selectedUser),
    });
  } catch (error) {
    console.error(
      "Error deleting user:",
      error,
    );

    return res.status(500).json({
      message: "Unable to delete the user.",
    });
  }
};

const userController = {
  register,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
};

export default userController;