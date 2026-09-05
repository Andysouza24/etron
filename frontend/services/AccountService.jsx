// Author(s): Matthew Parkinson, Holly Wyatt

import { Amplify } from 'aws-amplify';
import { 
    signIn, 
    signUp, 
    confirmSignUp, 
    signInWithRedirect, 
    getCurrentUser, 
    signOut,
} from 'aws-amplify/auth';
import { Linking } from 'react-native';
import { AccountStorage } from '../storage/accountStorage';
import AuthService from './AuthService';
import { removeWorkspaceInfo } from '../storage/workspaceStorage';
import { clearPermissionsCache } from '../storage/permissionsStorage';
import workspaceService from './WorkspaceService';

class AccountService {
    constructor() {
        this.socialLoading = { google: false, microsoft: false };
        this.callbacks = {
            onMessage: null,
            onSocialLoadingChange: null,
            onNavigate: null,
            onAuthSuccess: null
        };
        this.isLinking = false;
    }

    // Set callback functions for UI updates
    setCallbacks(callbacks) {
        this.callbacks = { ...this.callbacks, ...callbacks };
    }

    // Helper method to show messages
    showMessage(message, isError = false) {
        if (this.callbacks.onMessage) {
            this.callbacks.onMessage(message, isError);
        }
    }

    // Helper method to update social loading state
    updateSocialLoading(provider, loading) {
        this.socialLoading[provider] = loading;
        if (this.callbacks.onSocialLoadingChange) {
            this.callbacks.onSocialLoadingChange(this.socialLoading);
        }
    }

    // Helper method to navigate
    navigate(path, params = {}) {
        if (this.callbacks.onNavigate) {
            this.callbacks.onNavigate(path, params);
        }
    }

    // Helper method to handle authentication success
    async handleAuthSuccess(provider = 'Cognito') {
        try {
            if (this.callbacks.onAuthSuccess) {
                await this.callbacks.onAuthSuccess(provider);
            }
            // After app-level auth success, fetch and store the user's workspace
            try {
                await workspaceService.fetchAndSetWorkspaceForCurrentUser();
            } catch (wsErr) {
                console.warn('[AccountService] Could not fetch/set workspace after login:', wsErr?.message || wsErr);
            }
        
            // If we were linking, add the account to storage
            if (this.isLinking) {
                try {
                const userInfo = await AuthService.getCurrentUserInfo();
                if (userInfo.email) {
                    // Add to linked accounts with user attributes
                    await AccountStorage.addLinkedAccount(userInfo.email, provider, userInfo.attributes);
                    console.log(`Successfully linked account: ${userInfo.email}`);
                    this.showMessage(`Successfully linked ${userInfo.email}`);
                }
                } catch (storageError) {
                console.error('[AccountService] Failed to store linked account:', storageError);
                this.showMessage('Account linked but failed to save locally', true);
                }
                this.isLinking = false;
            }
        } catch (error) {
            console.error('[AccountService] Error handling auth success:', error);
            this.showMessage('Authentication successful but failed to update account info', true);
        }
    }

    // Sign out user (useful for linking accounts)
    async signOutUser() {
        try {
            await signOut();
            try { await removeWorkspaceInfo(); } catch {}
            try { await clearPermissionsCache(); } catch {} // clear cached permissions on sign out
            console.log("User signed out successfully.");
            return { success: true };
        } catch (error) {
            console.error('[AccountService] Error signing out:', error);
            this.showMessage("Error signing out previous user. Please try again.", true);
            return { success: false, error: error.message };
        }
    }

    // Sign in with email and password
    async signInWithEmail(email, password) {
        try {
            this.showMessage('');
            const result = await signIn({ username: email, password });
            console.log('Sign in successful:', result);
            
            // Handle auth success and account linking
            await this.handleAuthSuccess('Cognito');
            
            this.navigate("(auth)/home");
            return { success: true, result };
        } catch (error) {
            console.log('Error signing in:', error);
            this.showMessage(`Error: ${error.message}`, true);
            return { success: false, error: error.message };
        }
    }

    // Sign up with email and password
    async signUpWithEmail(email, password, confirmPassword) {
        try {
            if (password !== confirmPassword) {
                return { success: false, error: "Passwords do not match" };
            }

            const result = await signUp({
                username: email,
                password,
                options: {
                    userAttributes: {
                        email
                    }
                }
            });

            console.log('Sign up successful:', result);
            return { success: true, result };
        } catch (error) {
            console.log('Error signing up:', error);
            return { success: false, error: error.message };
        }
    }

    // Confirm sign up with verification code
    async confirmSignUpCode(email, verificationCode) {
        try {
            const result = await confirmSignUp({ 
                username: email, 
                confirmationCode: verificationCode 
            });
            console.log("Confirmation successful:", result);
            return { success: true, result };
        } catch (error) {
            console.log('Error confirming code:', error);
            this.showMessage(`Error: ${error.message}`, true);
            return { success: false, error: error.message };
        }
    }

    // Complete sign up process (confirm + sign in)
    async completeSignUp(email, password, verificationCode) {
        const confirmResult = await this.confirmSignUpCode(email, verificationCode);
        if (confirmResult.success) {
            console.log("Confirmation successful! Signing in user...");
            return await this.signInWithEmail(email, password);
        }
        return confirmResult;
    }

    // Sign in with Google
    async signInWithGoogle(isLinking = false) {
        this.updateSocialLoading('google', true);
        this.showMessage('');
        this.isLinking = isLinking;
        
        try {
            console.log('Initiating Google Sign-In...', isLinking ? '(Linking mode)' : '');
            
            // TODO: backend please set up the Google OAuth provider in Cognito
            await signInWithRedirect({
                provider: 'Google',
                customState: isLinking ? 'linking' : 'signin'
            });
            
            return { success: true };
        } catch (error) {
            console.log('Error with Google sign-in:', error);
            this.showMessage(`Google sign-in error: ${error.message}`, true);
            this.updateSocialLoading('google', false);
            this.isLinking = false;
            return { success: false, error: error.message };
        }
    }

    // Sign in with Microsoft
    async signInWithMicrosoft(isLinking = false) {
        this.updateSocialLoading('microsoft', true);
        this.showMessage('');
        this.isLinking = isLinking;
        
        try {
            console.log('Initiating Microsoft Sign-In...', isLinking ? '(Linking mode)' : '');
            
            // TODO: backend please set up the Microsoft OAuth provider in Cognito
            await signInWithRedirect({
                provider: 'SignInWithAmazon', // change this to the correct provider name when configured
                customState: isLinking ? 'linking' : 'signin'
            });
            
            return { success: true };
        } catch (error) {
            console.log('Error with Microsoft sign-in:', error);
            this.showMessage(`Microsoft sign-in error: ${error.message}`, true);
            this.updateSocialLoading('microsoft', false);
            this.isLinking = false;
            return { success: false, error: error.message };
        }
    }

    // Alternative social sign-in method using custom OAuth endpoints
    async signInWithSocialAlternative(provider) {
        try {
            const oauthConfig = {
                google: {
                    // replace with Google OAuth configuration
                    clientId: 'GOOGLE_CLIENT_ID',
                    redirectUri: 'APP_REDIRECT_URI',
                    scope: 'openid email dashboard',
                    responseType: 'code'
                },
                microsoft: {
                    // replace with Microsoft OAuth configuration
                    clientId: 'MICROSOFT_CLIENT_ID',
                    redirectUri: 'APP_REDIRECT_URI',
                    scope: 'openid email dashboard',
                    responseType: 'code'
                }
            };

            const config = oauthConfig[provider];
            const authUrl = provider === 'google' 
                ? `https://accounts.google.com/oauth2/auth?client_id=${config.clientId}&redirect_uri=${config.redirectUri}&scope=${config.scope}&response_type=${config.responseType}`
                : `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${config.clientId}&redirect_uri=${config.redirectUri}&scope=${config.scope}&response_type=${config.responseType}`;

            // open the OAuth URL in the browser
            const supported = await Linking.canOpenURL(authUrl);
            if (supported) {
                await Linking.openURL(authUrl);
                return { success: true };
            } else {
                throw new Error(`Cannot open ${provider} OAuth URL`);
            }

        } catch (error) {
            console.log(`Error with ${provider} sign-in:`, error);
            this.showMessage(`${provider} sign-in error: ${error.message}`, true);
            return { success: false, error: error.message };
        }
    }

    // Handle deep link callbacks from social providers
    async handleDeepLinkCallback(url) {
        console.log('Deep link received:', url);
        
        // check if the URL is a valid social sign-in callback
        if (url && (url.includes('oauth/callback') || url.includes('auth/callback'))) {
            try {
                // wait to ensure the sign-in process completes
                return new Promise((resolve) => {
                    setTimeout(async () => {
                        try {
                            const user = await getCurrentUser();
                            console.log('Social sign-in successful:', user);
                            
                            // Determine provider from URL or user attributes
                            const provider = url.includes('google') ? 'Google' : 
                                           url.includes('microsoft') ? 'Microsoft' : 'OAuth';
                            
                            // Handle auth success and account linking (will also fetch workspace)
                            await this.handleAuthSuccess(provider);
                            
                            this.navigate("(auth)/home");
                            resolve({ success: true, user });
                        } catch (error) {
                            console.log('No authenticated user found after social sign-in');
                            this.showMessage("Social sign-in was cancelled or failed", true);
                            this.isLinking = false;
                            resolve({ success: false, error: "Social sign-in failed" });
                        } finally {
                            this.resetSocialLoading();
                        }
                    }, 1000);
                });
            } catch (error) {
                console.log('Error handling social sign-in callback:', error);
                this.showMessage("Error completing social sign-in", true);
                this.isLinking = false;
                this.resetSocialLoading();
                return { success: false, error: error.message };
            }
        }
        
        return { success: false, error: "Invalid callback URL" };
    }

    // Setup deep link listener
    setupDeepLinkListener() {
        const handleDeepLink = (url) => {
            this.handleDeepLinkCallback(url);
        };

        // listen for deep links
        const subscription = Linking.addEventListener('url', handleDeepLink);

        // check if the app was opened with a deep link
        Linking.getInitialURL().then(handleDeepLink);

        return subscription;
    }

    // Get current authenticated user
    async getCurrentUser() {
        try {
            const user = await getCurrentUser();
            return { success: true, user };
        } catch (error) {
            console.log('No authenticated user:', error);
            return { success: false, error: error.message };
        }
    }

    // Reset social loading states
    resetSocialLoading() {
        this.socialLoading = { google: false, microsoft: false };
        if (this.callbacks.onSocialLoadingChange) {
            this.callbacks.onSocialLoadingChange(this.socialLoading);
        }
    }

    // Switch to a different account
    async switchAccount(targetEmail) {
        try {
            await this.signOutUser();
            // Navigate to login with the target email prefilled
            this.navigate('/login-signup', { 
                email: targetEmail, 
                fromAccounts: 'true' 
            });
            return { success: true };
        } catch (error) {
            console.error('[AccountService] Error switching account:', error);
            this.showMessage('Error switching accounts', true);
            return { success: false, error: error.message };
        }
    }
}

// Export singleton instance
const accountService = new AccountService();
export default accountService;