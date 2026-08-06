import {
  getAuthenticatedUser,
  loginUser,
  registerUser,
} from "../services/auth.service.js";

/* --------------------------------------------------------
   Error response helper
-------------------------------------------------------- */

const sendError = (
  res,
  error,
  fallbackMessage,
) => {
  console.error(error);

  return res
    .status(error?.statusCode || 500)
    .json({
      success: false,
      message:
        error?.message ||
        fallbackMessage,
    });
};

/* --------------------------------------------------------
   Login
-------------------------------------------------------- */

export const login = async (
  req,
  res,
) => {
  try {
    const {
      username,
      password,
    } = req.body;

    const result =
      await loginUser({
        username,
        password,
      });

    return res.status(200).json({
      success: true,
      message: "Login successful.",
      data: result,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      "Login failed.",
    );
  }
};

/* --------------------------------------------------------
   Get current authenticated user
-------------------------------------------------------- */

export const getCurrentUser = async (
  req,
  res,
) => {
  try {
    const userId =
      req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication is required.",
      });
    }

    const user =
      await getAuthenticatedUser(
        userId,
      );

    return res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      "Failed to load the authenticated user.",
    );
  }
};

/* --------------------------------------------------------
   Register user
-------------------------------------------------------- */

export const register = async (
  req,
  res,
) => {
  try {
    const result =
      await registerUser(
        req.body,
      );

    return res.status(201).json({
      success: true,
      message:
        "User registered successfully.",
      data: result,
    });
  } catch (error) {
    return sendError(
      res,
      error,
      "User registration failed.",
    );
  }
};

/* --------------------------------------------------------
   Logout
-------------------------------------------------------- */

export const logout = async (
  req,
  res,
) => {
  try {
    /*
     * JWT authentication is stateless.
     *
     * The frontend must remove the token from
     * localStorage, sessionStorage, cookies,
     * or the application's authentication state.
     */
    return res.status(200).json({
      success: true,
      message: "Logout successful.",
    });
  } catch (error) {
    return sendError(
      res,
      error,
      "Logout failed.",
    );
  }
};

/* --------------------------------------------------------
   Default export
-------------------------------------------------------- */

export default {
  login,
  getCurrentUser,
  register,
  logout,
};