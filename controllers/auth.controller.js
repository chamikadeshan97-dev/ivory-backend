import {
  getAuthenticatedUser,
  loginUser,registerUser
} from "../services/auth.service.js";

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

export const login = async (
  req,
  res,
) => {
  try {
    const {
      username,
      password,
    } = req.body;

    const result = await loginUser({
      username,
      password,
    });

    return res.status(200).json({
      success: true,
      message:
        "Login successful.",
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

export const getCurrentUser = async (
  req,
  res,
) => {
  try {
    const user =
      await getAuthenticatedUser(
        req.user.userId,
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

export const logout = async (
  req,
  res,
) => {
  try {
    /*
      JWT authentication is stateless.

      The frontend should remove the token
      from localStorage, sessionStorage, or
      its authentication state.

      A token blacklist can be added later
      if server-side token invalidation is needed.
    */

    return res.status(200).json({
      success: true,
      message:
        "Logout successful.",
    });
  } catch (error) {
    return sendError(
      res,
      error,
      "Logout failed.",
    );
  }
};
const register = async (req, res) => {
  try {
    const result = await registerUser(req.body);

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      data: result,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;

    return res.status(statusCode).json({
      success: false,
      message: error.message || "User registration failed",
    });
  }
};
export default {
  login,
  getCurrentUser,
  logout,register
};