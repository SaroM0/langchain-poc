// userRole.service.js
const UserRole = require("../../../models/db/userRole.model");
const Role = require("../../../models/db/role.model");

/**
 * Guarda o actualiza la relación entre un usuario y un rol.
 *
 * @param {number} userInternalId - El ID interno del usuario.
 * @param {string} discordRoleId - El ID de rol asignado por Discord (snowflake).
 * @param {Date} assignedAt - Fecha en que se asignó el rol.
 * @returns {Promise<number>} El ID interno de la relación, o null si no se pudo guardar.
 */
async function saveUserRole(userInternalId, discordRoleId, assignedAt) {
  // Buscar el rol en la tabla role usando su discord_id.
  const roleRecord = await Role.findOne({
    where: { discord_id: discordRoleId },
  });
  if (!roleRecord) {
    console.warn(`Role with discord_id ${discordRoleId} not found.`);
    return null;
  }

  // Ahora usamos el ID interno del rol (roleRecord.id) para guardar la relación.
  const [userRoleRecord, created] = await UserRole.findOrCreate({
    where: {
      fk_user_id: userInternalId,
      fk_role_id: roleRecord.id,
    },
    defaults: {
      assigned_at: assignedAt,
    },
  });

  return userRoleRecord.id;
}

module.exports = { saveUserRole };
