/**
 * Role normalization utilities.
 *
 * Firestore stores roles in capital-first form: 'Citizen', 'Worker', 'Admin', 'Superadmin', 'Green-Champion'.
 * AuthContext normalizes to lowercase for routing: 'citizen', 'worker', 'admin', 'superadmin', 'green-champion'.
 *
 * ALWAYS use normalizeRoleForStorage() when writing a role to Firestore.
 * ALWAYS use normalizeRoleForRouting() when comparing roles in React code.
 */

const STORAGE_ROLE_MAP: Record<string, string> = {
  citizen: 'Citizen',
  worker: 'Worker',
  admin: 'Admin',
  superadmin: 'Superadmin',
  SUPER_ADMIN: 'Superadmin',
  super_admin: 'Superadmin',
  'zonal-admin': 'Zonal-Admin',
  'zonal_admin': 'Zonal-Admin',
  'Zonal-Admin': 'Zonal-Admin',
  'green-champion': 'Green-Champion',
  'green_champion': 'Green-Champion',
  // already-capitalized forms pass through
  Citizen: 'Citizen',
  Worker: 'Worker',
  Admin: 'Admin',
  Superadmin: 'Superadmin',
  'Green-Champion': 'Green-Champion',
};

const ROUTING_ROLE_MAP: Record<string, string> = {
  citizen: 'citizen',
  Citizen: 'citizen',
  worker: 'worker',
  Worker: 'worker',
  admin: 'admin',
  Admin: 'admin',
  superadmin: 'superadmin',
  Superadmin: 'superadmin',
  SUPER_ADMIN: 'superadmin',
  super_admin: 'superadmin',
  'zonal-admin': 'zonal-admin',
  'zonal_admin': 'zonal-admin',
  'Zonal-Admin': 'zonal-admin',
  'green-champion': 'green-champion',
  'Green-Champion': 'green-champion',
  'green_champion': 'green-champion',
};

/**
 * Normalize a role for writing to Firestore.
 * Returns the capital-first canonical form, or logs an error and defaults to 'Citizen' for unknown roles.
 */
export function normalizeRoleForStorage(role: string): string {
  const normalized = STORAGE_ROLE_MAP[role];
  if (!normalized) {
    console.error(`[roles] Unknown role "${role}" — defaulting to Citizen`);
    return 'Citizen';
  }
  return normalized;
}

/**
 * Normalize a role for use in React routing/comparisons.
 * Returns lowercase form used by AuthContext and App.tsx.
 */
export function normalizeRoleForRouting(role: string): string {
  const normalized = ROUTING_ROLE_MAP[role];
  if (!normalized) {
    console.error(`[roles] Unknown role "${role}" — defaulting to citizen`);
    return 'citizen';
  }
  return normalized;
}
