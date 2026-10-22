-- PocketPilot Migration 003: Development Auth Provisioning & RLS Test Users
-- Ensures signInWithPassword works reliably even when Supabase's free-tier 2-email/hr SMTP rate limit is active
-- or before dashboard toggles are flipped.

create or replace function public.provision_auth_user(
  p_email text,
  p_password text,
  p_display_name text default 'there',
  p_is_anonymous boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_user_id uuid;
  v_clean_email text := lower(btrim(p_email));
begin
  if v_clean_email is null or v_clean_email = '' then
    raise exception 'Email is required';
  end if;

  if p_password is null or char_length(p_password) < 6 then
    raise exception 'Password must be at least 6 characters';
  end if;

  select id into v_user_id
  from auth.users
  where email = v_clean_email
  limit 1;

  if v_user_id is not null then
    -- Ensure email is confirmed so signInWithPassword succeeds in development
    update auth.users
    set
      email_confirmed_at = coalesce(email_confirmed_at, now()),
      updated_at = now()
    where id = v_user_id;
    return v_user_id;
  end if;

  v_user_id := gen_random_uuid();

  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    is_sso_user,
    is_anonymous,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  )
  values (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    v_clean_email,
    extensions.crypt(p_password, extensions.gen_salt('bf')),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('display_name', coalesce(nullif(btrim(p_display_name), ''), 'there')),
    false,
    p_is_anonymous,
    now(),
    now(),
    '',
    '',
    '',
    ''
  );

  insert into auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  )
  values (
    gen_random_uuid(),
    v_user_id,
    v_user_id::text,
    jsonb_build_object(
      'sub', v_user_id::text,
      'email', v_clean_email,
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    now(),
    now(),
    now()
  );

  return v_user_id;
end;
$$;

grant execute on function public.provision_auth_user(text, text, text, boolean) to anon, authenticated;
