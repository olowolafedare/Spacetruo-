# Xedruo unified identity rollout

This application must use the central Xedruo identity onboarding RPC `complete_xedruo_identity_onboarding` after Google authentication. Collect full legal name, ISO country code, country calling code, and phone number. Do not request SMS OTP. Keep the application callback on this application origin. Keep Xedruo ID/password as an alternative sign-in method while retaining Google sign-in. Do not treat a phone number as verified; KYC and phone verification remain separate future workflows.
