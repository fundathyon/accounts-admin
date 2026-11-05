import type { MetadataFieldSchema } from './admin-types';
import type { Translate } from './i18n/types';

/**
 * User metadata: the schema that signup validates (in the `email_auth`
 * behavior; Community and Pro) and which of its keys go into the access_token
 * (`/api/user-metadata-policy`; Pro only, 404 in Community).
 */

export type FieldType = MetadataFieldSchema['type'];

/** A form row. Numbers stay as typed text until they are saved. */
export type SchemaField = {
  /** Local row id, not persisted. */
  rowId: string;
  name: string;
  type: FieldType;
  required: boolean;
  format: string;
  enumCSV: string;
  min: string;
  max: string;
  minLength: string;
  maxLength: string;
  /** Whether the access_token policy includes the field. */
  inJWT: boolean;
  /** UI only: advanced rules are open. */
  expanded: boolean;
};

export type PolicyPreview = {
  extra_claims: Record<string, unknown>;
  dropped_keys?: string[];
  reason?: string;
};

export const SENSITIVE_KEYS = new Set([
  'phone',
  'email',
  'password',
  'ssn',
  'dob',
  'credit_card',
  'cpf',
  'nss',
  'passport',
  'address',
  'ip',
  'birthdate',
  'national_id',
  'tax_id',
]);

/** The same list as Accounts (reservedClaims, selector/build_claims.go): it answers 400 for these. */
export const RESERVED_KEYS = new Set([
  'sub',
  'iss',
  'aud',
  'exp',
  'iat',
  'nbf',
  'jti',
  'user_id',
  'app_id',
  'entity_id',
  'entity_type',
  'is_active',
  'is_verify',
  'role',
  'role_id',
  'email',
  'email_id',
  'login_method_id',
  'refresh_id',
  'sid',
]);

export function isSensitiveKey(name: string): boolean {
  return SENSITIVE_KEYS.has(name.toLowerCase());
}

function newRowId(): string {
  return typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

export function blankField(): SchemaField {
  return {
    rowId: newRowId(),
    name: '',
    type: 'string',
    required: false,
    format: '',
    enumCSV: '',
    min: '',
    max: '',
    minLength: '',
    maxLength: '',
    inJWT: false,
    expanded: false,
  };
}

const text = (v: unknown) => (v === undefined || v === null ? '' : String(v));

export function fieldsFromScheme(scheme: MetadataFieldSchema[], allowedKeys: string[]): SchemaField[] {
  return scheme.map((f) => ({
    ...blankField(),
    name: text(f.name),
    type: f.type === 'number' || f.type === 'boolean' ? f.type : 'string',
    required: Boolean(f.required),
    format: text(f.format),
    enumCSV: Array.isArray(f.enum) ? f.enum.join(', ') : '',
    min: text(f.minimum),
    max: text(f.maximum),
    minLength: text(f.min_length),
    maxLength: text(f.max_length),
    inJWT: allowedKeys.includes(text(f.name)),
  }));
}

function namedFields(fields: SchemaField[]): SchemaField[] {
  return fields.map((f) => ({ ...f, name: f.name.trim() })).filter((f) => f.name !== '');
}

/** Blank rows do not count; only what applies to the type is sent. */
export function buildScheme(fields: SchemaField[]): MetadataFieldSchema[] {
  return namedFields(fields).map((f) => {
    const out: MetadataFieldSchema = { name: f.name, type: f.type, required: f.required };
    if (f.type === 'string') {
      if (f.format) out.format = f.format;
      const values = f.enumCSV.split(',').map((s) => s.trim()).filter(Boolean);
      if (values.length > 0) out.enum = values;
      const minLength = parseInt(f.minLength, 10);
      if (!Number.isNaN(minLength)) out.min_length = minLength;
      const maxLength = parseInt(f.maxLength, 10);
      if (!Number.isNaN(maxLength)) out.max_length = maxLength;
    } else if (f.type === 'number') {
      const min = parseFloat(f.min);
      if (!Number.isNaN(min)) out.minimum = min;
      const max = parseFloat(f.max);
      if (!Number.isNaN(max)) out.maximum = max;
    }
    return out;
  });
}

export function allowedKeysOf(fields: SchemaField[]): string[] {
  return namedFields(fields).filter((f) => f.inJWT).map((f) => f.name);
}

export function schemaBody(fields: SchemaField[], additionalProperties: boolean) {
  return { scheme: buildScheme(fields), additional_properties: additionalProperties };
}

/** The first problem of the draft, in words; null when it can be saved. */
export function draftIssue(
  fields: SchemaField[],
  schemaEnabled: boolean,
  hasEmailAuth: boolean,
  t: Translate,
): string | null {
  const named = namedFields(fields);
  const seen = new Set<string>();
  for (const f of named) {
    if (seen.has(f.name)) return t('userMetadata.errors.duplicateName', { name: f.name });
    seen.add(f.name);
    if (f.inJWT && RESERVED_KEYS.has(f.name)) return t('userMetadata.errors.reservedClaim', { name: f.name });
  }
  if (schemaEnabled && named.length === 0) return t('userMetadata.errors.needField');
  if (!hasEmailAuth && named.length > 0) return t('userMetadata.errors.noEmailAuth');
  return null;
}

