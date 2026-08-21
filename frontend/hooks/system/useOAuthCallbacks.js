import { useEffect, useCallback } from 'react';
import { Linking } from 'react-native';
import { getCurrentUser, signOut } from 'aws-amplify/auth';
import accountService from '../../services/AccountService';

// Owns OAuth (Google/Microsoft) sign-in initiation and the deep-link listener
// that completes a social sign-in or sign-out. On a successful callback it
// delegates workspace resolution + redirect to provisionAfterAuth.
export default function useOAuthCallbacks({ router, setMessage, isLinking, provisionAfterAuth }) {
    useEffect(() => {
        const handleDeepLink = async (objectUrl) => {
            console.log('Deep link received:', objectUrl);

            let url = objectUrl.url || objectUrl;
            if (!url) return;

            // check if the URL is a valid social sign-in callback
            if (url && (url.includes('myapp://callback'))) {
                try {
                    // wait to ensure the sign-in process completes
                    setTimeout(async () => {
                        try {
                            const user = await getCurrentUser();
                            console.log('Social sign-in successful:', user);
                            await provisionAfterAuth(user);
                        } catch (error) {
                            console.error('No authenticated user found after social sign-in');
                            setMessage("Social sign-in was cancelled or failed");
                        }
                    }, 1000);
                } catch (error) {
                    console.error('Error handling social sign-in callback:', error);
                    setMessage("Error completing social sign-in");
                    await signOut();
                }
            }

            // check if the URL is a valid social sign-out
            if (url && (url.includes('myapp://signout/'))) {
                router.dismissAll();
                try {
                    // navigate to landing with signout()
                    await signOut();
                    setMessage("Signed out successfully!");

                } catch (error) {
                    console.error('Error handling social sign-out:', error);
                    setMessage("Social sign-out was cancelled or failed");
                }
            }
        };

        // listen for deep links
        const subscription = Linking.addEventListener('url', handleDeepLink);

        // check if the app was opened with a deep link
        Linking.getInitialURL().then(handleDeepLink);

        return () => subscription?.remove();
    }, []);

    const handleGoogleSignIn = useCallback(async () => {
        const result = await accountService.signInWithGoogle(isLinking);

        if (result.success && isLinking) {
            setMessage("Google sign-in initiated. You'll be redirected after authentication.");
        }
    }, [isLinking, setMessage]);

    const handleMicrosoftSignIn = useCallback(async () => {
        const result = await accountService.signInWithMicrosoft(isLinking);

        if (result.success && isLinking) {
            setMessage("Microsoft sign-in initiated. You'll be redirected after authentication.");
        }
    }, [isLinking, setMessage]);

    return { handleGoogleSignIn, handleMicrosoftSignIn };
}
