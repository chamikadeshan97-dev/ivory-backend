const normalizeRole = (role) => {
  return String(role ?? "")
    .trim()
    .toLowerCase();
};

export const authorizeRoles = (
  ...allowedRoles
) => {
  const normalizedAllowedRoles =
    allowedRoles.map(
      normalizeRole,
    );

  return (
    req,
    res,
    next,
  ) => {
  
    

    const currentRole =
      normalizeRole(
        req.user.role,
      );

    if (
      !normalizedAllowedRoles.includes(
        currentRole,
      )
    ) {
      return res.status(403).json({
        success: false,
        message:
          "You do not have permission to access this resource.",
      });
    }

    return next();
  };
};

export const adminOnly =
  authorizeRoles("Admin");

export const clinicStaff =
  authorizeRoles(
    "Admin",
    "Receptionist",
    "Dentist",
    "Cashier",
  );

export const clinicalStaff =
  authorizeRoles(
    "Admin",
    "Dentist",
  );

export const paymentStaff =
  authorizeRoles(
    "Admin",
    "Cashier",
  );

export default authorizeRoles;