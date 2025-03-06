const Role = require("../../../models/db/role.model");

async function saveRole(role) {
  const created_at = new Date();
  // Usamos el campo "hoist" para definir la descripción del rol.
  const description = role.hoist ? "Hoisted role" : "";

  // Upsert: actualiza el rol si existe (identificado por su nombre) o lo crea si no.
  await Role.upsert({
    name: role.name,
    description,
    created_at,
  });

  // Buscar el registro para obtener su ID interno.
  const savedRole = await Role.findOne({ where: { name: role.name } });
  return savedRole.id;
}

module.exports = { saveRole };
