revoke execute on function app_private.is_tenant_admin() from public, anon;
revoke execute on function app_private.is_admin_for_tenant(uuid) from public, anon;

grant execute on function app_private.is_tenant_admin() to authenticated;
grant execute on function app_private.is_admin_for_tenant(uuid) to authenticated;
