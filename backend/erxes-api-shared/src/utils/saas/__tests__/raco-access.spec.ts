import { assertRacoTenantAccess, racoTenantDatabaseName } from '../raco-access';

describe('Raco SaaS tenant boundaries', () => {
  const now = new Date('2026-10-24T00:00:00Z').getTime();
  it('leaves legacy self-hosted organizations unchanged', () => {
    expect(() => assertRacoTenantAccess({}, now)).not.toThrow();
  });
  it('admits a valid trial and rejects expiry at the exact boundary', () => {
    const organization = { racoManaged: true, racoStatus: 'trialing', racoTrialEndsAt: new Date(now + 1) };
    expect(() => assertRacoTenantAccess(organization, now)).not.toThrow();
    expect(() => assertRacoTenantAccess(organization, now + 1)).toThrow('WORKSPACE_ACCESS_PAUSED');
  });
  it.each(['provisioning', 'suspended', undefined])('denies workspace state %s', status => {
    expect(() => assertRacoTenantAccess({ racoManaged: true, racoStatus: status, racoTrialEndsAt: new Date(now + 1000) }, now)).toThrow();
  });
  it('does not grant paid access without a valid paid-through date', () => {
    expect(() => assertRacoTenantAccess({ racoManaged: true, racoStatus: 'active' }, now)).toThrow();
    expect(() => assertRacoTenantAccess({ racoManaged: true, racoStatus: 'active', racoPaidUntil: new Date(now + 1000) }, now)).not.toThrow();
  });
  it('generates separate databases and refuses a static shared DB_NAME', () => {
    const a = racoTenantDatabaseName('aaaaaaaaaaaaaaaaaaaaaaaa');
    const b = racoTenantDatabaseName('bbbbbbbbbbbbbbbbbbbbbbbb');
    expect(a).not.toEqual(b);
    expect(() => racoTenantDatabaseName('aaaaaaaaaaaaaaaaaaaaaaaa', 'erxes')).toThrow('isolation');
    expect(() => racoTenantDatabaseName('../invalid')).toThrow();
  });
});
