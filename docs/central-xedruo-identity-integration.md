# Central Xedruo Identity integration

Company slug: `spacetruo`.

`src/lib/xedruoIdentityBridge.js` implements the shared RPC contract for a central Supabase-authenticated Google user. SpaceTruo's existing local Supabase client uses the central Xedruo project URL, so it is a candidate for direct in-app integration once the central migration is applied. The auth page still needs to collect issuing country and phone and call the bridge after Google confirmation.

Do not send users to the Xedruo platform. Preserve existing SpaceTruo profiles and records. SMS OTP remains deferred.
