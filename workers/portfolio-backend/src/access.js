import { createRemoteJWKSet, jwtVerify } from 'jose';

const keySets = new Map();

function normalizeTeamDomain(value) {
  const domain = String(value || '').replace(/\/+$/, '');
  if (!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/i.test(domain)) {
    throw new Error('TEAM_DOMAIN is not configured.');
  }
  return domain;
}

export async function verifyAccessJwt(request, env) {
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) {
    return null;
  }
  if (!env.POLICY_AUD) {
    throw new Error('POLICY_AUD is not configured.');
  }
  const teamDomain = normalizeTeamDomain(env.TEAM_DOMAIN);
  let keySet = keySets.get(teamDomain);
  if (!keySet) {
    keySet = createRemoteJWKSet(new URL(`${teamDomain}/cdn-cgi/access/certs`));
    keySets.set(teamDomain, keySet);
  }
  const { payload } = await jwtVerify(token, keySet, {
    audience: env.POLICY_AUD,
    issuer: teamDomain,
  });
  return {
    email: typeof payload.email === 'string' ? payload.email : '',
    subject: payload.sub,
  };
}
