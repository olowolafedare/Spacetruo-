import React,{useEffect,useState} from "react";
import {Link} from "react-router-dom";
import {supabase} from "../api/xedruoClient";

const countryRegionNames=new Intl.DisplayNames(["en"],{type:"region"});
const countryName=code=>countryRegionNames.of(String(code||"").trim().toUpperCase())||String(code||"").trim().toUpperCase();
const countryFlag=code=>[...String(code||"").trim().toUpperCase()].map(ch=>String.fromCodePoint(127397+ch.charCodeAt(0))).join("");

export default function XedruoIdentityGate({companySlug,children}) {
  const [loading,setLoading]=useState(true);
  const [user,setUser]=useState(null);
  const [identity,setIdentity]=useState(null);
  const [countries,setCountries]=useState([]);
  const [countryCode,setCountryCode]=useState("");
  const [countrySearch,setCountrySearch]=useState("");
  const [phone,setPhone]=useState("");
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const [complete,setComplete]=useState(false);

  async function load() {
    setLoading(true); setError("");
    try {
      const {data:{user:current},error:userError}=await supabase.auth.getUser();
      if(userError) throw userError;
      setUser(current||null);
      if(!current){setIdentity(null);setComplete(false);return;}
      const [{data:existing,error:identityError},{data:countryRows,error:countryError}]=await Promise.all([
        supabase.from("xedruo_identity").select("xedruo_id,country_code,phone_e164").eq("user_id",current.id).maybeSingle(),
        supabase.from("xedruo_country_calling_codes").select("country_code,calling_code").order("country_code")
      ]);
      if(identityError) throw identityError;
      if(countryError) throw countryError;
      setIdentity(existing||null);
      setCountries(countryRows||[]);
      if(existing?.country_code) setCountryCode(String(existing.country_code).trim());
      if(existing?.phone_e164) { const dial=String((countryRows||[]).find(x=>String(x.country_code).trim()===String(existing.country_code).trim())?.calling_code||"").trim(); const stored=String(existing.phone_e164); setPhone(dial&&stored.startsWith(dial)?stored.slice(dial.length):stored); }
      if(existing?.xedruo_id && existing?.phone_e164) {
        const {error:profileError}=await supabase.rpc("ensure_xedruo_company_profile",{
          p_company_slug:companySlug,
          p_display_name:current.user_metadata?.full_name||current.user_metadata?.name||current.email||null
        });
        if(profileError) throw profileError;
        setComplete(true);
      } else setComplete(false);
    } catch(e) { setError(e?.message||"Unable to verify your Xedruo identity."); }
    finally { setLoading(false); }
  }

  useEffect(()=>{
    let active=true;
    load();
    const {data:listener}=supabase.auth.onAuthStateChange(()=>{if(active) load();});
    return ()=>{active=false;listener.subscription.unsubscribe();};
  },[companySlug]);

  async function submit(e) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const {data:{user:current},error:userError}=await supabase.auth.getUser();
      if(userError||!current) throw new Error("Please sign in with your Xedruo Google account first.");
      if(!(current.identities||[]).some(x=>x.provider==="google")) throw new Error("This account must be connected to Google before it can use the Xedruo ecosystem.");
      const selected=identity?.country_code?String(identity.country_code).trim():countryCode;
      if(!selected) throw new Error("Select your issuing country.");
      const country=countries.find(x=>String(x.country_code).trim()===selected);
      if(!country) throw new Error("The selected country calling code is unavailable. Refresh and try again.");
      const digits=phone.replace(/\D/g,"");
      const dial=String(country.calling_code||"").trim();
      const e164=dial+digits;
      if(!/^\+[1-9]\d{7,14}$/.test(e164)) throw new Error("Enter a valid phone number with the selected country's calling code.");
      if(!identity?.xedruo_id) {
        const {data:rows,error:identityError}=await supabase.rpc("ensure_xedruo_identity",{p_country_code:selected});
        if(identityError) throw identityError;
        const created=Array.isArray(rows)?rows[0]:rows;
        if(!created?.xedruo_id) throw new Error("The central Xedruo ID could not be allocated.");
      }
      const {error:phoneError}=await supabase.rpc("set_xedruo_identity_phone",{p_country_code:selected,p_phone_e164:e164});
      if(phoneError) throw phoneError;
      const {error:profileError}=await supabase.rpc("ensure_xedruo_company_profile",{
        p_company_slug:companySlug,
        p_display_name:current.user_metadata?.full_name||current.user_metadata?.name||current.email||null
      });
      if(profileError) throw profileError;
      await load();
    } catch(e) { setError(e?.message||"Xedruo identity setup failed."); }
    finally { setBusy(false); }
  }

  async function connectGoogle() {
    setBusy(true); setError("");
    try {
      const {error:linkError}=await supabase.auth.linkIdentity({provider:"google",options:{redirectTo:window.location.href,queryParams:{prompt:"select_account"}}});
      if(linkError) throw linkError;
    } catch(e) { setError(e instanceof Error?e.message:"Google account connection failed."); setBusy(false); }
  }

  if(loading) return <div className="min-h-screen grid place-items-center bg-background text-foreground"><p className="text-sm text-muted-foreground">Checking your Xedruo identity…</p></div>;
  if(!user) return <main className="min-h-screen grid place-items-center bg-background px-5 text-foreground"><section className="w-full max-w-md rounded-2xl border bg-card p-7"><h1 className="text-2xl font-black">Sign in with Xedruo</h1><p className="mt-2 text-sm text-muted-foreground">Sign in to continue to this company workspace.</p><Link to="/login" className="mt-5 inline-flex rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground">Sign in</Link></section></main>;
  if(complete) return children;
  const googleConnected=(user.identities||[]).some(x=>x.provider==="google");
  const filteredCountries=countries.filter(c=>{const q=countrySearch.trim().toLowerCase();return !q||countryName(c.country_code).toLowerCase().includes(q)||String(c.country_code).toLowerCase().includes(q)||String(c.calling_code).includes(q);}).sort((a,b)=>countryName(a.country_code).localeCompare(countryName(b.country_code)));
  const selectedCountry=countries.find(c=>String(c.country_code).trim()===countryCode);
  const selectedCallingCode=String(selectedCountry?.calling_code||"").trim();
  if(!googleConnected) return <main className="min-h-screen grid place-items-center bg-background px-5 text-foreground"><section className="w-full max-w-md rounded-2xl border bg-card p-7"><h1 className="text-2xl font-black">Connect your Google account</h1><p className="mt-2 text-sm text-muted-foreground">Xedruo requires Google authentication together with your phone number. Connect Google to this existing account to continue.</p>{error&&<p role="alert" className="mt-4 text-sm text-red-600">{error}</p>}<button disabled={busy} onClick={connectGoogle} className="mt-5 w-full rounded-xl bg-primary px-5 py-3 font-semibold text-primary-foreground disabled:opacity-60">{busy?"Connecting…":"Connect Google account"}</button></section></main>;
  return <main className="min-h-screen grid place-items-center bg-background px-5 py-10 text-foreground"><section className="w-full max-w-lg rounded-2xl border bg-card p-7 shadow-sm"><div className="text-xs font-bold uppercase tracking-[.2em] text-primary">Unified Xedruo identity</div><h1 className="mt-3 text-2xl font-black">Complete your Xedruo ID</h1><p className="mt-2 text-sm text-muted-foreground">Your Google account is connected. Select your issuing country and add your phone number to activate this company workspace. Your Xedruo ID is shared across the ecosystem.</p>{identity?.xedruo_id&&<div className="mt-5 rounded-xl border bg-muted/40 p-4"><div className="text-xs text-muted-foreground">Your Xedruo ID</div><div className="mt-1 font-bold">{identity.xedruo_id}</div><div className="mt-1 text-xs text-muted-foreground">Issuing country: {String(identity.country_code||"").trim()}</div></div>}{error&&<div role="alert" className="mt-5 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</div>}<form onSubmit={submit} className="mt-5 space-y-4"><label className="block text-sm font-semibold">Country selection<input type="search" value={countrySearch} onChange={e=>setCountrySearch(e.target.value)} placeholder="Search country…" disabled={Boolean(identity?.country_code)} className="mt-2 w-full rounded-xl border bg-background px-3 py-3"/><select disabled={Boolean(identity?.country_code)} required value={countryCode} onChange={e=>setCountryCode(e.target.value)} className="mt-2 w-full rounded-xl border bg-background px-3 py-3"><option value="">Select country</option>{filteredCountries.map(c=><option key={c.country_code} value={String(c.country_code).trim()}>{countryFlag(c.country_code)} {countryName(c.country_code)}</option>)}</select></label><label className="block text-sm font-semibold">Country calling code<input readOnly value={selectedCallingCode} placeholder="Selected automatically" className="mt-2 w-full rounded-xl border bg-muted px-3 py-3" /></label><label className="block text-sm font-semibold">Phone number<input required type="tel" inputMode="tel" autoComplete="tel-national" value={phone} onChange={e=>setPhone(e.target.value.replace(/[^0-9\s()-]/g,""))} placeholder="Enter your number" className="mt-2 w-full rounded-xl border bg-background px-3 py-3" /></label><p className="text-xs text-muted-foreground">The selected country's calling code is added automatically. SMS verification can be completed when the phone OTP rollout is enabled.</p><button disabled={busy||!countries.length} className="w-full rounded-xl bg-primary px-5 py-3 font-bold text-primary-foreground disabled:opacity-60">{busy?"Saving your Xedruo identity…":"Save and continue"}</button></form></section></main>;
}
