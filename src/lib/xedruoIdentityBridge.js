/** Central Xedruo Identity bridge. Requires an authenticated central Supabase client. SMS OTP is intentionally deferred. */
export async function completeXedruoIdentity({supabase,companySlug,countryCode,phoneE164,callingCode,displayName}) {
  if (!supabase?.auth?.getUser || !supabase?.rpc) throw new Error("A central Xedruo Supabase client is required.");
  const slug=String(companySlug||"").trim().toLowerCase(), country=String(countryCode||"").trim().toUpperCase();
  const dial=String(callingCode||"").trim(), phone=String(phoneE164||"").trim();
  if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(slug)) throw new Error("Invalid Xedruo company application.");
  if (!/^[A-Z]{2}$/.test(country)) throw new Error("Select your issuing country.");
  if (!/^\+[1-9]\d{0,3}$/.test(dial)||!phone.startsWith(dial)||!/^\+[1-9]\d{7,14}$/.test(phone)) throw new Error("Phone number must match the selected country's calling code.");
  const {data:{user},error:userError}=await supabase.auth.getUser();
  if(userError||!user) throw new Error("Sign in inside this company app first.");
  if(!(user.identities||[]).some(x=>x.provider==="google")) throw new Error("Confirm your Google account before completing Xedruo registration.");
  const {data:rows,error}=await supabase.rpc("ensure_xedruo_identity",{p_country_code:country});
  if(error) throw error; const identity=Array.isArray(rows)?rows[0]:rows;
  if(!identity?.xedruo_id) throw new Error("The central Xedruo ID could not be allocated.");
  const {data:phones,error:phoneError}=await supabase.rpc("set_xedruo_identity_phone",{p_country_code:country,p_phone_e164:phone});
  if(phoneError) throw phoneError; const contact=Array.isArray(phones)?phones[0]:phones;
  const {error:profileError}=await supabase.rpc("ensure_xedruo_company_profile",{p_company_slug:slug,p_display_name:displayName||user.user_metadata?.full_name||user.user_metadata?.name||null});
  if(profileError) throw profileError;
  return {xedruoId:contact?.xedruo_id||identity.xedruo_id,issuingCountry:country,phoneE164:phone,phoneVerified:Boolean(contact?.phone_verified_at),company:slug};
}
