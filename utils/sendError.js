function sendError(res, error, defaultMessage = "Something went wrong") {
  const statusCode = error.statusCode || 500;

  res.status(statusCode).json({
    success: false,
    message: error.message || defaultMessage,
  });
}

export default sendError;