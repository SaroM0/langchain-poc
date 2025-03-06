const Organization = require("../../../models/db/organization.model");

async function ensureOrganization() {
  const orgName = "straico";
  const [organization] = await Organization.findOrCreate({
    where: { name: orgName },
    defaults: { created_at: new Date() },
  });
  return organization.id;
}

module.exports = { ensureOrganization };
