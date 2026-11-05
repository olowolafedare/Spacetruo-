import React,{useState} from 'react';
import {Link,useNavigate} from 'react-router-dom';
import {supabase} from '@/api/xedruoClient';

export default function Auth({mode='login'}){
 const nav=useNavigate();
 const register=mode==='register';
 const [xedruoId,setXedruoId]=useState('');
 const [password,setPassword]=useState('');
 const [error,setError]=useState('');
 const [busy,setBusy]=useState(false);
 const destination="/dashboard";
 async function google(){
  setBusy(true);setError('');
  try{
   const {error:e}=await supabase.auth.signInWithOAuth({provider:'google',options:{redirectTo:window.location.origin+destination,queryParams:{prompt:'select_account'}}});
   if(e)throw e;
  }catch(e){setError(e?.message||'Google sign-in failed.');setBusy(false);}
 }
 async function signInWithId(event){
  event.preventDefault();setBusy(true);setError('');
  try{
   const {data,error:e}=await supabase.functions.invoke('xedruo-id-login',{body:{xedruo_id:xedruoId.trim().toUpperCase(),password}});
   if(e)throw new Error(e.message||'Xedruo ID sign-in failed.');
   if(!data?.access_token||!data?.refresh_token)throw new Error(data?.error||'Xedruo ID or password is incorrect.');
   const {error:sessionError}=await supabase.auth.setSession({access_token:data.access_token,refresh_token:data.refresh_token});
   if(sessionError)throw sessionError;
   nav(destination,{replace:true});
  }catch(e){setError(e?.message||'Xedruo ID sign-in failed.');}
  finally{setBusy(false);}
 }
 return <main className="min-h-screen grid place-items-center px-5 py-12 bg-background text-foreground"><section className="w-full max-w-md rounded-2xl border border-border bg-card p-7">
  <h1 className="text-2xl font-black">{register?'Create your Xedruo account':'Welcome to '+"SpaceTruo"}</h1>
  <p className="mt-2 text-sm text-muted-foreground">{register?'Create your shared Xedruo account with Google, then add your country and phone number.':'Sign in with Google or your Xedruo ID and password. Your session stays inside this company app.'}</p>
  {error&&<div role="alert" className="mt-4 rounded-xl border border-red-300 p-3 text-sm text-red-700">{error}</div>}
  <button type="button" onClick={google} disabled={busy} className="mt-5 w-full rounded-xl border border-border px-4 py-3 font-semibold disabled:opacity-60">{busy?'Connecting…':register?'Create account with Google':'Continue with Google'}</button>
  {!register&&<><div className="my-5 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border"/><span>OR SIGN IN WITH XEDRUO ID</span><span className="h-px flex-1 bg-border"/></div>
   <form onSubmit={signInWithId} className="space-y-3">
    <label className="block text-sm font-semibold">Xedruo ID<input required value={xedruoId} onChange={e=>setXedruoId(e.target.value.toUpperCase())} placeholder="NG-1234567890" autoComplete="username" className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-3"/></label>
    <label className="block text-sm font-semibold">Password<input required type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password" placeholder="Your password" className="mt-2 w-full rounded-xl border border-border bg-background px-3 py-3"/></label>
    <button type="submit" disabled={busy||!xedruoId.trim()||!password} className="w-full rounded-xl bg-primary px-4 py-3 font-bold text-primary-foreground disabled:opacity-60">{busy?'Signing in…':'Sign in with Xedruo ID'}</button>
   </form></>}
  <p className="mt-5 text-center text-sm">{register?<>Already have an account? <Link className="underline" to="/login">Sign in</Link></>:<>New to Xedruo? <Link className="underline" to="/register">Create an account</Link></>}</p>
  <p className="mt-4 text-xs leading-5 text-muted-foreground">Phone number is collected during Xedruo identity onboarding. SMS verification is not required.</p>
 </section></main>;
}
