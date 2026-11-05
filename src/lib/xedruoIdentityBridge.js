/** Shared Xedruo Identity bridge. Company pages own their UI and return paths. SMS OTP is intentionally deferred. */
export async function signInWithXedruoId({supabase,xedruoId,password,companySlug}) {
  if (!supabase?.functions?.invoke || !supabase?.auth?.setSession) throw new Error("Xedruo Identity client is not configured.");
  const id=String(xedruoId||"").trim().toUpperCase();
  if (!/^[A-Z]{2}-?\d{10}$/.test(id) || !password) throw new Error("Enter your Xedruo ID and password.");
  const {data,error}=await supabase.functions.invoke("xedruo-id-login",{body:{xedruo_id:id,password,company_slug:companySlug}});
  if(error) throw new Error(error.message||"Xedruo ID sign-in failed.");
  if(!data?.access_token||!data?.refresh_token||data?.company!==companySlug) throw new Error(data?.error||"The company authentication response was invalid.");
  const {error:sessionError}=await supabase.auth.setSession({access_token:data.access_token,refresh_token:data.refresh_token});
  if(sessionError) throw sessionError;
  return data.user||null;
}
export async function signInWithGoogle({supabase,companyOrigin,returnPath}) {
  const origin=String(companyOrigin||"").replace(/\/$/,"");
  const path=String(returnPath||"/").startsWith("/")?String(returnPath||"/"):"/";
  if(!origin) throw new Error("Company return address is missing.");
  const {error}=await supabase.auth.signInWithOAuth({provider:"google",options:{redirectTo:origin+path,queryParams:{prompt:"select_account"}}});
  if(error) throw error;
}
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
