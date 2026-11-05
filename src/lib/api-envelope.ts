/** Accounts' response envelope, as the BFF forwards it. */
export type ApiError = { message?: string; scope?: string; meta?: unknown };

export type Envelope = {
  success?: boolean;
  data?: unknown;
  error?: ApiError | string;
};

/** The error of an envelope, in object form (the BFF and Accounts differ). */
export function apiError(json: Envelope | null): ApiError | undefined {
  const err = json?.error;
  if (err && typeof err === 'object') return err;
  if (typeof err === 'string' && err) return { message: err };
  return undefined;
}
