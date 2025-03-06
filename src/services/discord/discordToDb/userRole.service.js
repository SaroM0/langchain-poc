const UserRole = require("../../../models/db/userRole.model");

async function saveUserRole(userInternalId, roleId, assignedAt) {
  // Find or create the user-role association based on fk_user_id and fk_role_id.
  const [userRole, created] = await UserRole.findOrCreate({
    where: { fk_user_id: userInternalId, fk_role_id: roleId },
    defaults: { assigned_at: assignedAt },
  });

  // If the record already exists and the assigned_at date is different, update it.
  if (
    !created &&
    userRole.assigned_at.getTime() !== new Date(assignedAt).getTime()
  ) {
    userRole.assigned_at = assignedAt;
    await userRole.save();
  }
}

module.exports = { saveUserRole };
