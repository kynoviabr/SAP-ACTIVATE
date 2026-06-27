-- Secure user provisioning for tenant/client administrators.
-- Called by the Admin console through supabase.rpc('admin_create_tenant_user', ...).

create or replace function public.admin_create_tenant_user(
  p_tenant_id uuid,
  p_full_name text,
  p_email text,
  p_password text,
  p_role text default 'USER'
)
returns public.users
language plpgsql
security definer
set search_path = public, auth, app_private, extensions
as $$
declare
  v_user_id uuid;
  v_email text;
  v_role text;
  v_existing_profile public.users%rowtype;
  v_auto_tenant_id uuid;
  v_created_profile public.users%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required.';
  end if;

  v_email := lower(trim(p_email));
  v_role := upper(trim(coalesce(p_role, 'USER')));

  if not exists (select 1 from public.tenants where id = p_tenant_id and active = true) then
    raise exception 'Tenant not found or inactive.';
  end if;

  if not (app_private.is_platform_admin() or app_private.is_admin_for_tenant(p_tenant_id)) then
    raise exception 'Not authorized to create users for this tenant.';
  end if;

  if not app_private.is_platform_admin() and p_tenant_id <> app_private.current_tenant_id() then
    raise exception 'Tenant admins can only create users for their own tenant.';
  end if;

  if v_role not in ('ADMIN', 'USER', 'VIEWER', 'SUPER_ADMIN') then
    raise exception 'Invalid user role.';
  end if;

  if v_role = 'SUPER_ADMIN' and not app_private.is_platform_admin() then
    raise exception 'Only platform admins can create SUPER_ADMIN users.';
  end if;

  if trim(coalesce(p_full_name, '')) = '' then
    raise exception 'Full name is required.';
  end if;

  if v_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then
    raise exception 'Valid email is required.';
  end if;

  if length(coalesce(p_password, '')) < 8 then
    raise exception 'Password must have at least 8 characters.';
  end if;

  select id into v_user_id
  from auth.users
  where lower(email) = v_email
  limit 1;

  if v_user_id is not null then
    select * into v_existing_profile
    from public.users
    where id = v_user_id;

    if v_existing_profile.id is not null and v_existing_profile.tenant_id <> p_tenant_id then
      raise exception 'This email is already assigned to another tenant.';
    end if;

    update auth.users
    set encrypted_password = crypt(p_password, gen_salt('bf')),
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        raw_app_meta_data = jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
        raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('full_name', trim(p_full_name)),
        updated_at = now()
    where id = v_user_id;
  else
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
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      email_change_token_current,
      recovery_token,
      reauthentication_token,
      is_super_admin,
      is_sso_user,
      is_anonymous
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_user_id,
      'authenticated',
      'authenticated',
      v_email,
      crypt(p_password, gen_salt('bf')),
      now(),
      jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
      jsonb_build_object('full_name', trim(p_full_name)),
      now(),
      now(),
      '',
      '',
      '',
      '',
      '',
      '',
      false,
      false,
      false
    );

    insert into auth.identities (
      id,
      provider_id,
      user_id,
      identity_data,
      provider,
      last_sign_in_at,
      created_at,
      updated_at
    ) values (
      v_user_id,
      v_user_id::text,
      v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', v_email, 'email_verified', true, 'phone_verified', false),
      'email',
      now(),
      now(),
      now()
    )
    on conflict (provider_id, provider) do update set
      user_id = excluded.user_id,
      identity_data = excluded.identity_data,
      updated_at = now();
  end if;

  select tenant_id into v_auto_tenant_id
  from public.users
  where id = v_user_id;

  insert into public.users (
    id,
    tenant_id,
    full_name,
    email,
    role,
    active
  ) values (
    v_user_id,
    p_tenant_id,
    trim(p_full_name),
    v_email,
    v_role,
    true
  )
  on conflict (id) do update set
    tenant_id = excluded.tenant_id,
    full_name = excluded.full_name,
    email = excluded.email,
    role = excluded.role,
    active = true,
    updated_at = now()
  returning * into v_created_profile;

  if v_auto_tenant_id is not null and v_auto_tenant_id <> p_tenant_id then
    delete from public.tenants t
    where t.id = v_auto_tenant_id
      and not exists (select 1 from public.users u where u.tenant_id = t.id)
      and not exists (select 1 from public.projects p where p.tenant_id = t.id);
  end if;

  return v_created_profile;
end;
$$;

revoke all on function public.admin_create_tenant_user(uuid, text, text, text, text) from public, anon;
grant execute on function public.admin_create_tenant_user(uuid, text, text, text, text) to authenticated;
