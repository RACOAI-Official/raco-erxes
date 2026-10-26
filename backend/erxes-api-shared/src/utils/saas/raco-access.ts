export interface RacoTenantAccess {
  racoManaged?: boolean;
  racoStatus?: string;
  racoTrialEndsAt?: Date | string;
  racoPaidUntil?: Date | string;
}

export const assertRacoTenantAccess = (organization: RacoTenantAccess, now = Date.now()) => {
  if (!organization.racoManaged) return;
  const until = organization.racoStatus === 'active'
    ? organization.racoPaidUntil : organization.racoTrialEndsAt;
  if (!['trialing', 'active'].includes(organization.racoStatus || '') ||
      !until || !Number.isFinite(new Date(until).getTime()) || new Date(until).getTime() <= now) {
    throw new Error('WORKSPACE_ACCESS_PAUSED: Open /saas to review your workspace subscription.');
  }
};

export const racoTenantDatabaseName = (organizationId: string, pattern = 'erxes_<organizationId>') => {
  if (!/^[a-f0-9]{24}$/i.test(organizationId) || !pattern.includes('<organizationId>')) {
    throw new Error('SaaS DB_NAME must contain <organizationId> for database isolation');
  }
  const name = pattern.replace('<organizationId>', organizationId);
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) throw new Error('Invalid SaaS database name');
  return name;
};
