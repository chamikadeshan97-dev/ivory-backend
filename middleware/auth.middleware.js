import {
  verifyToken,
} from "../utils/token.js";

const extractBearerToken = (
  authorizationHeader,
) => {
  if (!authorizationHeader) {
    return null;
  }

  const [
    scheme,
    token,
  ] = authorizationHeader.split(" ");

  if (
    scheme !== "Bearer" ||
    !token
  ) {
    return null;
  }

  return token;
};

export const authenticate = (
  req,
  res,
  next,
) => {
  try {
    const token =
      extractBearerToken(
        req.headers.authorization,
      );

    if (!token) {
      return res.status(401).json({
        success: false,
        message:
          "Authentication token is required.",
      });
    }

    const decoded =
      verifyToken(token);

    req.user = {
      userId: decoded.userId,
      username: decoded.username,
      role: decoded.role,
    };

    req.token = token;

    return next();
  } catch (error) {
    console.error(error);

    if (
      error?.name ===
      "TokenExpiredError"
    ) {
      return res.status(401).json({
        success: false,
        message:
          "Your session has expired. Please log in again.",
      });
    }

    if (
      error?.name ===
      "JsonWebTokenError"
    ) {
      return res.status(401).json({
        success: false,
        message:
          "Invalid authentication token.",
      });
    }

    return res.status(401).json({
      success: false,
      message:
        "Authentication failed.",
    });
  }
};

export default authenticate;