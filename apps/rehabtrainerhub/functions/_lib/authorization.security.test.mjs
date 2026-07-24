import assert from 'node:assert/strict';
import {
  CreateSignedValue,
  authCookieName,
} from './auth.js';
import {
  CanAccessPatient,
  GetAuthenticatedUser,
  IsStaffUser,
  userRoles,
} from './authorization.js';

const secret = '0123456789abcdef0123456789abcdef';
const users = new Map([
  ['patient-1', {
    id: 'patient-1',
    display_name: 'Patient One',
    email: 'patient@example.test',
    role: 'patient',
  }],
  ['therapist-1', {
    id: 'therapist-1',
    display_name: 'Therapist One',
    email: 'therapist@example.test',
    role: 'therapist',
  }],
  ['admin-1', {
    id: 'admin-1',
    display_name: 'Admin One',
    email: 'admin@example.test',
    role: 'admin',
  }],
]);
const assignments = new Set(['therapist-1:patient-1']);
const env = {
  ADMIN_ALLOW_BEARER: '1',
  AUTH_SESSION_SECRET: secret,
  REHAB_DB: CreateAuthorizationDb(users, assignments),
};

const forgedRoleToken = await CreateSignedValue(
  { sub: 'patient-1', role: 'admin' },
  secret,
  60,
);
const forgedRoleUser = await GetAuthenticatedUser(new Request('https://trainerhub.cc/api/admin/overview', {
  headers: {
    Authorization: `Bearer ${forgedRoleToken}`,
  },
}), env);
assert.equal(forgedRoleUser.role, userRoles.patient);
assert.equal(IsStaffUser(forgedRoleUser), false);

const bearerDisabledUser = await GetAuthenticatedUser(new Request('https://trainerhub.cc/api/admin/overview', {
  headers: {
    Authorization: `Bearer ${forgedRoleToken}`,
  },
}), {
  ...env,
  ADMIN_ALLOW_BEARER: '0',
});
assert.equal(bearerDisabledUser, null);

const therapistToken = await CreateSignedValue({ sub: 'therapist-1' }, secret, 60);
const therapist = await GetAuthenticatedUser(new Request('https://trainerhub.cc/api/admin/overview', {
  headers: {
    Cookie: `${authCookieName}=${encodeURIComponent(therapistToken)}`,
  },
}), env);
assert.equal(therapist.role, userRoles.therapist);
assert.equal(IsStaffUser(therapist), true);
assert.equal(await CanAccessPatient(env, therapist, 'patient-1'), true);
assert.equal(await CanAccessPatient(env, therapist, 'patient-2'), false);

const crossOriginCookieUser = await GetAuthenticatedUser(new Request('https://trainerhub.cc/api/admin/overview', {
  headers: {
    Origin: 'https://motor.trainerhub.cc',
    Cookie: `${authCookieName}=${encodeURIComponent(therapistToken)}`,
  },
}), env);
assert.equal(crossOriginCookieUser, null);

const admin = users.get('admin-1');
assert.equal(await CanAccessPatient(env, admin, 'any-patient'), true);

console.log('authorization security checks passed');

function CreateAuthorizationDb(userRows, assignmentRows) {
  return {
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              if (/FROM app_users\s+WHERE id = \?/i.test(sql)) {
                return userRows.get(args[0]) || null;
              }
              if (/FROM therapist_patient_assignments/i.test(sql)) {
                return assignmentRows.has(`${args[0]}:${args[1]}`)
                  ? { allowed: 1 }
                  : null;
              }
              return null;
            },
          };
        },
      };
    },
  };
}
