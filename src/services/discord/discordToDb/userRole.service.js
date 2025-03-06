const UserRole = require("../../../models/db/userRole.model");

async function saveUserRole(userInternalId, roleId, assignedAt) {
  // Se utiliza findOrCreate para crear o encontrar la asociación entre el usuario y el rol.
  const [userRole, created] = await UserRole.findOrCreate({
    where: { fk_user_id: userInternalId, fk_role_id: roleId },
    defaults: { assigned_at: assignedAt },
  });

  // Si ya existía y la fecha de asignación es distinta, se actualiza.
  if (
    !created &&
    userRole.assigned_at.getTime() !== new Date(assignedAt).getTime()
  ) {
    userRole.assigned_at = assignedAt;
    await userRole.save();
  }
}

module.exports = { saveUserRole };
