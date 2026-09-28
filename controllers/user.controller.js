import bcrypt from "bcryptjs";

import {
  readSheet,
  writeSheet,
} from "../utils/googleSheets.js";

/* ========================================================
   CONFIGURATION
======================================================== */

const USERS_SHEET_NAME = "Users";

const VALID_USER_ROLES = [
  "Super Admin",
  "Admin",
  "Dentist",
  "Receptionist",
  "Cashier",
  "User",
];

/* ========================================================
   PERMISSION CONFIGURATION
======================================================== */

/*
 * Keep permission names consistent everywhere:
 *
 * Frontend:
 *   appointment_history
 *   queue_manager
 *
 * API:
 *   appointment_history
 *   queue_manager
 *
 * Google Sheet:
 *   appointment_history
 *   queue_manager
 */

const PERMISSION_FIELDS = {
  appointment_history:
    "appointment_history",

  queue_manager:
    "queue_manager",

  doctor_treatment:
    "doctor_treatment",

  payment_history:
    "payment_history",

  common_treatments:
    "common_treatments",

  drugs:
    "drugs",

  locations:
    "locations",
};

const DEFAULT_PERMISSIONS = {
  appointment_history: false,
  queue_manager: false,
  doctor_treatment: false,
  payment_history: false,
  common_treatments: false,
  drugs: false,
  locations: false,
};

/* ========================================================
   GENERAL HELPERS
======================================================== */

const normalizeText = (value) => {
  return String(value ?? "").trim();
};

const normalizeEmail = (value) => {
  return normalizeText(
    value,
  ).toLowerCase();
};

const normalizeUsername = (
  value,
) => {
  return normalizeText(
    value,
  ).toLowerCase();
};

const normalizeRole = (value) => {
  const requestedRole =
    normalizeText(
      value,
    ).toLowerCase();

  return (
    VALID_USER_ROLES.find(
      (role) =>
        role.toLowerCase() ===
        requestedRole,
    ) || ""
  );
};

const normalizeBoolean = (
  value,
) => {
  if (value === true) {
    return true;
  }

  if (value === false) {
    return false;
  }

  const normalizedValue =
    normalizeText(
      value,
    ).toLowerCase();

  return (
    normalizedValue ===
      "true" ||
    normalizedValue === "1" ||
    normalizedValue === "yes"
  );
};

const getUserId = (user) => {
  return normalizeText(
    user?.id ||
      user?.user_id ||
      user?._id,
  );
};

const getAuthenticatedUserId = (
  req,
) => {
  return normalizeText(
    req.user?.id ||
      req.user?.user_id ||
      req.user?._id,
  );
};

/* ========================================================
   PERMISSION HELPERS
======================================================== */

/*
 * Normalize permission object.
 *
 * Super Admin always receives
 * every permission.
 */

const normalizePermissions = (
  permissions = {},
  role = "",
) => {
  const normalizedRole =
    normalizeRole(role);

  if (
    normalizedRole ===
    "Super Admin"
  ) {
    return Object.keys(
      DEFAULT_PERMISSIONS,
    ).reduce(
      (result, key) => {
        result[key] = true;

        return result;
      },
      {},
    );
  }

  return Object.keys(
    DEFAULT_PERMISSIONS,
  ).reduce(
    (result, key) => {
      result[key] =
        normalizeBoolean(
          permissions?.[key],
        );

      return result;
    },
    {},
  );
};

/*
 * Read permissions from a user
 * loaded from Google Sheets.
 *
 * Supports both:
 *
 * user.queue_manager
 *
 * and:
 *
 * user.permissions.queue_manager
 */

const getUserPermissions = (
  user,
) => {
  const role =
    normalizeRole(
      user?.role,
    );

  if (
    role === "Super Admin"
  ) {
    return normalizePermissions(
      {},
      role,
    );
  }

  const permissions = {
    ...DEFAULT_PERMISSIONS,
  };

  Object.keys(
    DEFAULT_PERMISSIONS,
  ).forEach((key) => {
    permissions[key] =
      normalizeBoolean(
        user?.permissions?.[
          key
        ] ??
          user?.[key],
      );
  });

  return permissions;
};

/*
 * Convert normalized permissions
 * into individual Google Sheet
 * fields.
 */

const permissionsToSheetFields = (
  permissions = {},
) => {
  const sheetFields = {};

  Object.entries(
    PERMISSION_FIELDS,
  ).forEach(
    ([
      permissionKey,
      sheetKey,
    ]) => {
      sheetFields[sheetKey] =
        normalizeBoolean(
          permissions?.[
            permissionKey
          ],
        );
    },
  );

  return sheetFields;
};

/* ========================================================
   SANITIZE USER
======================================================== */

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

  const permissions =
    getUserPermissions(user);

  /*
   * Keep individual permission
   * properties available because
   * AppLayout supports:
   *
   * user.queue_manager
   */

  Object.keys(
    DEFAULT_PERMISSIONS,
  ).forEach((key) => {
    safeUser[key] =
      permissions[key];
  });

  /*
   * Also return a nested object:
   *
   * user.permissions.queue_manager
   */

  safeUser.permissions =
    permissions;

  return safeUser;
};

/* ========================================================
   GOOGLE SHEET HELPERS
======================================================== */

const loadUsers = async () => {
  const users =
    await readSheet(
      USERS_SHEET_NAME,
    );

  return Array.isArray(users)
    ? users
    : [];
};

const saveUsers = async (
  users,
) => {
  await writeSheet(
    USERS_SHEET_NAME,
    users,
  );
};

/* ========================================================
   GENERATE USER ID
======================================================== */

const getNextUserId = (
  users,
) => {
  const highestNumber =
    users.reduce(
      (
        currentHighest,
        user,
      ) => {
        const userId =
          getUserId(user);

        const match =
          userId.match(
            /^USR_(\d+)$/i,
          );

        if (!match) {
          return currentHighest;
        }

        const numericId =
          Number(
            match[1],
          );

        if (
          Number.isNaN(
            numericId,
          )
        ) {
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

/* ========================================================
   ADMINISTRATOR HELPERS
======================================================== */

const countAdministrators = (
  users,
) => {
  return users.filter(
    (user) => {
      const role =
        normalizeRole(
          user?.role,
        );

      return (
        role === "Admin" ||
        role ===
          "Super Admin"
      );
    },
  ).length;
};

/* ========================================================
   VALIDATION HELPERS
======================================================== */

const isValidEmail = (
  email,
) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    email,
  );
};

const isValidUsername = (
  username,
) => {
  return /^[a-zA-Z0-9._-]+$/.test(
    username,
  );
};

const isValidPhone = (
  phone,
) => {
  if (!phone) {
    return true;
  }

  return /^[0-9+\-\s]{9,15}$/.test(
    phone,
  );
};

/* ========================================================
   REQUEST VALIDATION
======================================================== */

const validateUserDetails = ({
  name,
  email,
  username,
  phone,
  role,
  password,
  passwordRequired,
}) => {
  const cleanName =
    normalizeText(name);

  const cleanEmail =
    normalizeText(email);

  const cleanUsername =
    normalizeText(
      username,
    );

  const cleanPhone =
    normalizeText(phone);

  const cleanRole =
    normalizeRole(role);

  if (!cleanName) {
    return "Full name is required.";
  }

  if (
    cleanName.length < 3
  ) {
    return "Full name must contain at least 3 characters.";
  }

  if (!cleanEmail) {
    return "Email address is required.";
  }

  if (
    !isValidEmail(
      cleanEmail,
    )
  ) {
    return "Enter a valid email address.";
  }

  if (!cleanUsername) {
    return "Username is required.";
  }

  if (
    cleanUsername.length <
    4
  ) {
    return "Username must contain at least 4 characters.";
  }

  if (
    !isValidUsername(
      cleanUsername,
    )
  ) {
    return "Username can contain only letters, numbers, dots, underscores and hyphens.";
  }

  /*
   * Phone remains optional because
   * your React form currently treats
   * it as optional.
   */

  if (
    cleanPhone &&
    !isValidPhone(
      cleanPhone,
    )
  ) {
    return "Enter a valid phone number.";
  }

  if (!cleanRole) {
    return "Select a valid user role.";
  }

  if (
    passwordRequired &&
    !password
  ) {
    return "Password is required.";
  }

  if (
    password &&
    password.length < 6
  ) {
    return "Password must contain at least 6 characters.";
  }

  return "";
};

/* ========================================================
   REGISTER USER
======================================================== */

const register = async (
  req,
  res,
) => {
  try {
    /* ----------------------------------------------------
       Basic details
    ---------------------------------------------------- */

    const name =
      normalizeText(
        req.body?.name,
      );

    const email =
      normalizeEmail(
        req.body?.email,
      );

    const username =
      normalizeUsername(
        req.body?.username,
      );

    const phone =
      normalizeText(
        req.body?.phone,
      );

    const role =
      normalizeRole(
        req.body?.role,
      );

    const password =
      String(
        req.body?.password ??
          "",
      );

    /* ----------------------------------------------------
       Permissions
    ---------------------------------------------------- */

    const permissions =
      normalizePermissions(
        req.body
          ?.permissions ||
          {},
        role,
      );

    /* ----------------------------------------------------
       Validate
    ---------------------------------------------------- */

    const validationError =
      validateUserDetails({
        name,
        email,
        username,
        phone,
        role,
        password,
        passwordRequired:
          true,
      });

    if (validationError) {
      return res
        .status(400)
        .json({
          success: false,

          message:
            validationError,
        });
    }

    /* ----------------------------------------------------
       Load users
    ---------------------------------------------------- */

    const users =
      await loadUsers();

    /* ----------------------------------------------------
       Duplicate email
    ---------------------------------------------------- */

    const emailExists =
      users.some(
        (user) =>
          normalizeEmail(
            user?.email,
          ) === email,
      );

    if (emailExists) {
      return res
        .status(409)
        .json({
          success: false,

          message:
            "A user with this email address already exists.",
        });
    }

    /* ----------------------------------------------------
       Duplicate username
    ---------------------------------------------------- */

    const usernameExists =
      users.some(
        (user) =>
          normalizeUsername(
            user?.username,
          ) === username,
      );

    if (
      usernameExists
    ) {
      return res
        .status(409)
        .json({
          success: false,

          message:
            "This username is already being used.",
        });
    }

    /* ----------------------------------------------------
       Hash password
    ---------------------------------------------------- */

    const hashedPassword =
      await bcrypt.hash(
        password,
        12,
      );

    /* ----------------------------------------------------
       Date
    ---------------------------------------------------- */

    const currentDateTime =
      new Date().toISOString();

    /* ----------------------------------------------------
       Convert permissions for Sheet
    ---------------------------------------------------- */

    const permissionFields =
      permissionsToSheetFields(
        permissions,
      );

    /* ----------------------------------------------------
       New user
    ---------------------------------------------------- */

    const newUser = {
      id:
        getNextUserId(
          users,
        ),

      name,

      email,

      username,

      phone,

      /*
       * Keep using "password"
       * because your current Google
       * Sheet uses this column.
       *
       * Your authentication service
       * already supports password_hash
       * OR password.
       */

      password:
        hashedPassword,

      role,

      status: "Active",

      ...permissionFields,

      created_at:
        currentDateTime,

      updated_at:
        currentDateTime,
    };

    /* ----------------------------------------------------
       Save
    ---------------------------------------------------- */

    users.push(
      newUser,
    );

    await saveUsers(
      users,
    );

    /* ----------------------------------------------------
       Response
    ---------------------------------------------------- */

    return res
      .status(201)
      .json({
        success: true,

        message:
          "User registered successfully.",

        user:
          sanitizeUser(
            newUser,
          ),
      });
  } catch (error) {
    console.error(
      "Error registering user:",
      error,
    );

    return res
      .status(500)
      .json({
        success: false,

        message:
          error?.message ||
          "Unable to register the user.",
      });
  }
};

/* ========================================================
   GET ALL USERS
======================================================== */

const getAllUsers = async (
  req,
  res,
) => {
  try {
    const users =
      await loadUsers();

    const safeUsers =
      users
        .map((user) =>
          sanitizeUser(
            user,
          ),
        )
        .sort(
          (
            firstUser,
            secondUser,
          ) => {
            const firstName =
              normalizeText(
                firstUser?.name,
              );

            const secondName =
              normalizeText(
                secondUser?.name,
              );

            return firstName.localeCompare(
              secondName,
            );
          },
        );

    return res
      .status(200)
      .json({
        success: true,

        message:
          "Users loaded successfully.",

        count:
          safeUsers.length,

        users:
          safeUsers,
      });
  } catch (error) {
    console.error(
      "Error loading users:",
      error,
    );

    return res
      .status(500)
      .json({
        success: false,

        message:
          error?.message ||
          "Unable to load registered users.",
      });
  }
};

/* ========================================================
   GET USER BY ID
======================================================== */

const getUserById = async (
  req,
  res,
) => {
  try {
    const userId =
      normalizeText(
        req.params.userId,
      );

    if (!userId) {
      return res
        .status(400)
        .json({
          success: false,

          message:
            "User ID is required.",
        });
    }

    const users =
      await loadUsers();

    const selectedUser =
      users.find(
        (user) =>
          getUserId(
            user,
          ) === userId,
      );

    if (!selectedUser) {
      return res
        .status(404)
        .json({
          success: false,

          message:
            "User not found.",
        });
    }

    return res
      .status(200)
      .json({
        success: true,

        message:
          "User loaded successfully.",

        user:
          sanitizeUser(
            selectedUser,
          ),
      });
  } catch (error) {
    console.error(
      "Error loading user:",
      error,
    );

    return res
      .status(500)
      .json({
        success: false,

        message:
          error?.message ||
          "Unable to load the user.",
      });
  }
};

/* ========================================================
   UPDATE USER
======================================================== */

const updateUser = async (
  req,
  res,
) => {
  try {
    /* ----------------------------------------------------
       User ID
    ---------------------------------------------------- */

    const userId =
      normalizeText(
        req.params.userId,
      );

    if (!userId) {
      return res
        .status(400)
        .json({
          success: false,

          message:
            "User ID is required.",
        });
    }

    /* ----------------------------------------------------
       Details
    ---------------------------------------------------- */

    const name =
      normalizeText(
        req.body?.name,
      );

    const email =
      normalizeEmail(
        req.body?.email,
      );

    const username =
      normalizeUsername(
        req.body?.username,
      );

    const phone =
      normalizeText(
        req.body?.phone,
      );

    const role =
      normalizeRole(
        req.body?.role,
      );

    const password =
      String(
        req.body?.password ??
          "",
      );

    /* ----------------------------------------------------
       Validate
    ---------------------------------------------------- */

    const validationError =
      validateUserDetails({
        name,
        email,
        username,
        phone,
        role,
        password,
        passwordRequired:
          false,
      });

    if (validationError) {
      return res
        .status(400)
        .json({
          success: false,

          message:
            validationError,
        });
    }

    /* ----------------------------------------------------
       Load users
    ---------------------------------------------------- */

    const users =
      await loadUsers();

    const userIndex =
      users.findIndex(
        (user) =>
          getUserId(
            user,
          ) === userId,
      );

    if (
      userIndex === -1
    ) {
      return res
        .status(404)
        .json({
          success: false,

          message:
            "User not found.",
        });
    }

    const existingUser =
      users[userIndex];

    /* ----------------------------------------------------
       Duplicate email
    ---------------------------------------------------- */

    const emailExists =
      users.some(
        (
          user,
          index,
        ) =>
          index !==
            userIndex &&
          normalizeEmail(
            user?.email,
          ) === email,
      );

    if (emailExists) {
      return res
        .status(409)
        .json({
          success: false,

          message:
            "Another user already uses this email address.",
        });
    }

    /* ----------------------------------------------------
       Duplicate username
    ---------------------------------------------------- */

    const usernameExists =
      users.some(
        (
          user,
          index,
        ) =>
          index !==
            userIndex &&
          normalizeUsername(
            user?.username,
          ) === username,
      );

    if (
      usernameExists
    ) {
      return res
        .status(409)
        .json({
          success: false,

          message:
            "Another user already uses this username.",
        });
    }

    /* ----------------------------------------------------
       Protect final administrator
    ---------------------------------------------------- */

    const previousRole =
      normalizeRole(
        existingUser?.role,
      );

    const wasAdministrator =
      previousRole ===
        "Admin" ||
      previousRole ===
        "Super Admin";

    const willBeAdministrator =
      role === "Admin" ||
      role ===
        "Super Admin";

    if (
      wasAdministrator &&
      !willBeAdministrator &&
      countAdministrators(
        users,
      ) <= 1
    ) {
      return res
        .status(400)
        .json({
          success: false,

          message:
            "The final administrator cannot be changed to another role.",
        });
    }

    /* ----------------------------------------------------
       Permissions
    ---------------------------------------------------- */

    let permissions;

    if (
      role ===
      "Super Admin"
    ) {
      /*
       * Super Admin:
       * force everything ON.
       */

      permissions =
        normalizePermissions(
          {},
          role,
        );
    } else if (
      req.body
        ?.permissions !==
      undefined
    ) {
      /*
       * New permission object
       * supplied by frontend.
       */

      permissions =
        normalizePermissions(
          req.body
            .permissions,
          role,
        );
    } else {
      /*
       * No permission object:
       * preserve existing values.
       */

      permissions =
        getUserPermissions(
          existingUser,
        );
    }

    const permissionFields =
      permissionsToSheetFields(
        permissions,
      );

    /* ----------------------------------------------------
       Build updated user
    ---------------------------------------------------- */

    const updatedUser = {
      ...existingUser,

      id:
        getUserId(
          existingUser,
        ) || userId,

      name,

      email,

      username,

      phone,

      role,

      ...permissionFields,

      updated_at:
        new Date().toISOString(),
    };

    /* ----------------------------------------------------
       Remove old nested permissions
    ---------------------------------------------------- */

    delete updatedUser.permissions;

    /* ----------------------------------------------------
       Update password only if supplied
    ---------------------------------------------------- */

    if (password) {
      updatedUser.password =
        await bcrypt.hash(
          password,
          12,
        );

      /*
       * Remove alternative old
       * password fields if present.
       */

      delete updatedUser
        .password_hash;

      delete updatedUser
        .passwordHash;
    }

    /* ----------------------------------------------------
       Save
    ---------------------------------------------------- */

    users[userIndex] =
      updatedUser;

    await saveUsers(
      users,
    );

    /* ----------------------------------------------------
       Response
    ---------------------------------------------------- */

    return res
      .status(200)
      .json({
        success: true,

        message:
          "User updated successfully.",

        user:
          sanitizeUser(
            updatedUser,
          ),
      });
  } catch (error) {
    console.error(
      "Error updating user:",
      error,
    );

    return res
      .status(500)
      .json({
        success: false,

        message:
          error?.message ||
          "Unable to update the user.",
      });
  }
};

/* ========================================================
   DELETE USER
======================================================== */

const deleteUser = async (
  req,
  res,
) => {
  try {
    /* ----------------------------------------------------
       IDs
    ---------------------------------------------------- */

    const userId =
      normalizeText(
        req.params.userId,
      );

    const currentUserId =
      getAuthenticatedUserId(
        req,
      );

    if (!userId) {
      return res
        .status(400)
        .json({
          success: false,

          message:
            "User ID is required.",
        });
    }

    /* ----------------------------------------------------
       Prevent deleting own account
    ---------------------------------------------------- */

    if (
      currentUserId &&
      currentUserId ===
        userId
    ) {
      return res
        .status(400)
        .json({
          success: false,

          message:
            "You cannot delete your own account while you are logged in.",
        });
    }

    /* ----------------------------------------------------
       Load users
    ---------------------------------------------------- */

    const users =
      await loadUsers();

    const userIndex =
      users.findIndex(
        (user) =>
          getUserId(
            user,
          ) === userId,
      );

    if (
      userIndex === -1
    ) {
      return res
        .status(404)
        .json({
          success: false,

          message:
            "User not found.",
        });
    }

    const selectedUser =
      users[userIndex];

    /* ----------------------------------------------------
       Protect final administrator
    ---------------------------------------------------- */

    const selectedRole =
      normalizeRole(
        selectedUser?.role,
      );

    const isAdministrator =
      selectedRole ===
        "Admin" ||
      selectedRole ===
        "Super Admin";

    if (
      isAdministrator &&
      countAdministrators(
        users,
      ) <= 1
    ) {
      return res
        .status(400)
        .json({
          success: false,

          message:
            "The final administrator account cannot be deleted.",
        });
    }

    /* ----------------------------------------------------
       Delete user
    ---------------------------------------------------- */

    const updatedUsers =
      users.filter(
        (
          _,
          index,
        ) =>
          index !==
          userIndex,
      );

    await saveUsers(
      updatedUsers,
    );

    /* ----------------------------------------------------
       Response
    ---------------------------------------------------- */

    return res
      .status(200)
      .json({
        success: true,

        message:
          "User deleted successfully.",

        deleted_user:
          sanitizeUser(
            selectedUser,
          ),
      });
  } catch (error) {
    console.error(
      "Error deleting user:",
      error,
    );

    return res
      .status(500)
      .json({
        success: false,

        message:
          error?.message ||
          "Unable to delete the user.",
      });
  }
};

/* ========================================================
   EXPORT
======================================================== */

const userController = {
  register,
  getAllUsers,
  getUserById,
  updateUser,
  deleteUser,
};

export default userController;