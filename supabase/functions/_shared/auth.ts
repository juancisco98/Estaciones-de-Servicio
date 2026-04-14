import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL          = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const SUPABASE_ANON_KEY     = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

export class AuthError extends Error {
  constructor(public code: 'no_token' | 'invalid_token' | 'not_whitelisted', public status = 401) {
    super(code);
  }
}

export type AuthContext = {
  email: string;
  isSuperadmin: boolean;
  accessToken: string;
  userScopedClient: SupabaseClient;
  serviceClient: SupabaseClient;
};

/**
 * Validates the Authorization: Bearer <jwt> header.
 * Returns both a user-scoped client (respects RLS) and a service-role client.
 */
export async function requireAuth(req: Request): Promise<AuthContext> {
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) throw new AuthError('no_token');
  const accessToken = authHeader.slice('Bearer '.length);
  if (!accessToken) throw new AuthError('no_token');

  const service = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { data: { user }, error } = await service.auth.getUser(accessToken);
  if (error || !user?.email) throw new AuthError('invalid_token');

  const email = user.email.toLowerCase();
  const { data: allowed } = await service
    .from('allowed_emails')
    .select('is_superadmin')
    .eq('email', email)
    .maybeSingle();
  if (!allowed) throw new AuthError('not_whitelisted', 403);

  const userScoped = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return {
    email,
    isSuperadmin: !!allowed.is_superadmin,
    accessToken,
    userScopedClient: userScoped,
    serviceClient: service,
  };
}
