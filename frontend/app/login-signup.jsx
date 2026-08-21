// Author(s): Matthew Parkinson, Holly Wyatt, Rhys Cleary

import { useRouter, Link, useLocalSearchParams } from "expo-router";
import { Text, Snackbar, Portal, ActivityIndicator } from 'react-native-paper';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useEffect, useState } from "react";
import { View, Modal, TextInput, Keyboard, StyleSheet, Pressable } from 'react-native';
import TextField from '../components/common/input/TextField';
import BasicButton from '../components/common/buttons/BasicButton';
import { useTheme } from 'react-native-paper';
import GoogleButton from '../components/common/buttons/GoogleButton';
import MicrosoftButton from '../components/common/buttons/MicrosoftButton';
import Divider from "../components/layout/Divider";
import { commonStyles } from "../assets/styles/stylesheets/common";
import ResponsiveScreen from "../components/layout/ResponsiveScreen";
import accountService from '../services/AccountService';
import { Amplify } from 'aws-amplify';
import { useApp } from "../contexts/AppContext";
import { 
    signIn, 
    signUp, 
    confirmSignUp, 
    signInWithRedirect, 
    getCurrentUser,
    signOut
} from 'aws-amplify/auth';
import Header from "../components/layout/Header";
import useOAuthCallbacks from "../hooks/system/useOAuthCallbacks";
import useWorkspaceProvisioning from "../hooks/system/useWorkspaceProvisioning";
import useSignUpFlow from "../hooks/system/useSignUpFlow";

import VerificationDialog from "../components/overlays/VerificationDialog";

//Amplify.configure(awsmobile);

function LoginSignup() {
    const { emailParam, isSignUp, link, fromAccounts } = useLocalSearchParams();
    const isSignUpBool = isSignUp == 'true';
    const isLinking = link === 'true';
    const fromAccountsBool = fromAccounts === 'true';

    const [email, setEmail] = useState(emailParam || "");
    const [password, setPassword] = useState('');
    const [message, setMessage] = useState('');
    const [snack, setSnack] = useState({ visible: false, text: '' , tone: 'error'});  //tone: 'error' | 'info'
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [socialLoading, setSocialLoading] = useState({ google: false, microsoft: false });
    const [signedOutForLinking, setSignedOutForLinking] = useState(!isLinking);
    const [loadingNextPage, setLoadingNextPage] = useState(false);

    const router = useRouter();
    const theme = useTheme();
    const insets = useSafeAreaInsets();

    const { user, actions } = useApp();

    // Setup AccountService callbacks
    useEffect(() => {
        accountService.setCallbacks({
            onMessage: (msg, isError) => {
                setMessage(msg);
            },
            onSocialLoadingChange: (loadingState) => {
                setSocialLoading(loadingState);
            },
            onNavigate: (path, params) => {
                if (params) router.push({ pathname: path, params });
                else router.push(path);
            },
            onAuthSuccess: async (provider) => {
                await actions.login(provider);
            }
        });
    }, [router, actions.login]);

    // Handle sign out for linking
    useEffect(() => {
        if (isLinking && !signedOutForLinking) {
            (async () => {
                const result = await accountService.signOutUser();
                if (result.success) {
                    setSignedOutForLinking(true);
                    console.log("Signed out for linking.");
                    setMessage("Ready to link a new account. Please sign in below.");
                } else {
                    setMessage("Error signing out previous user. Please try again.");
                }
            })();
        }
    }, [isLinking, signedOutForLinking]);

    const { provisionAfterAuth } = useWorkspaceProvisioning({ router, setMessage });
    const { handleGoogleSignIn, handleMicrosoftSignIn } = useOAuthCallbacks({ router, setMessage, isLinking, provisionAfterAuth });

    const showSnack = (text, tone = 'error') => {
        setSnack({ visible: true, text, tone});
    }

    const {
        showVerificationModal,
        setShowVerificationModal,
        verificationCode,
        setVerificationCode,
        resendCooldown,
        setResendCooldown,
        handleResend,
        handleSignUp,
        handleConfirmCode,
    } = useSignUpFlow({ email, password, confirmPassword, isLinking, router, showSnack, setLoading, setMessage });

    const handleSignIn = async () => {
        setLoading(true);
        setMessage('');
        try {
            try {
                const currentUser = await getCurrentUser();
                if (currentUser) {
                    console.log("User is already signed in. Signing out before continuing...");
                    await signOut();
                }
            } catch (error) {  // If the user isn't authenticated, then this is expected behaviour.
                if (!error.message.includes("User needs to be authenticated to call this API")) console.error("Error retrieving signed in user:", error);
            }

            const { isSignedIn, nextStep } = await signIn({ username: email, password });
            
            // Check if email confirmation still required
            if (!isSignedIn && nextStep.signInStep === "CONFIRM_SIGN_UP") {
                setShowVerificationModal(true);
                if (resendCooldown === 0) {
                    handleResend();
                    setResendCooldown(60);
                }
                return;
            }

            router.replace("(auth)/authenticated-loading");
            return;
        } catch (error) {
            if (error.message.includes("Incorrect username or password")) {
                showSnack("Incorrect email or password", 'error');
                await signOut();
            } else if (error.message.includes("Password attempts exceeded")) {
                showSnack("Password attempt limit reached, please try again later.", 'error');
            } else {
                console.error("Sign in error:", error);
                showSnack("Sign in failed. Please try again.", 'error');
                await signOut();
            }
        } finally {
            setLoading(false);
        }
    };

    const handleToggleSignUp = () => {
        const params = { isSignUp: (!isSignUpBool).toString() };
        
        // Preserve linking and fromAccounts params + email
        if (isLinking) params.link = 'true';
        if (fromAccountsBool) params.fromAccounts = 'true';
        params.emailParam = email;
        
        router.push({
            pathname: '/login-signup',
            params,
        });
        setConfirmPassword('');
        setMessage('');
    };

    const getPageTitle = () => {
        if (isLinking) {
            return isSignUpBool ? 'Link New Account' : 'Link Existing Account';
        }
        return isSignUpBool ? 'Welcome' : 'Welcome Back';
    };

    const getButtonLabel = () => {
        if (loading) return 'Loading...';
        if (isLinking) {
            return isSignUpBool ? 'Create & Link Account' : 'Link Account';
        }
        return isSignUpBool ? 'Sign Up' : 'Login';
    };

    return (
        <ResponsiveScreen
            loadingOverlayActive={loading}
        >
            {(isLinking || fromAccountsBool) && (
                <Header
                    title={isLinking ? "Link Account" : ""}
                    showBack
                    onBack={() => router.push('/(auth)/accounts')}
                />
            )}
            
            <View style={{ padding: 20, gap: 30, flex: 1, justifyContent: 'center' }}>
                <Text style={{ fontSize: 40, textAlign: 'center' }}>
                    {getPageTitle()}
                </Text>

                {isLinking && (
                    <Text style={{ 
                        fontSize: 16, 
                        textAlign: 'center', 
                        color: theme.colors.onSurfaceVariant,
                        marginTop: -20
                    }}>
                        Sign in to an existing account or create a new one to link it to your current account.
                    </Text>
                )}

                <View style={{ gap: 30 }}>
                    <TextField
                        label="Email"
                        placeholder="Email"
                        value={email}
                        onChangeText={setEmail}
                        disabled={!signedOutForLinking && isLinking}
                    />

                    <View>
                        <TextField
                            label="Password"
                            placeholder="Password"
                            value={password}
                            secureTextEntry
                            onChangeText={setPassword}
                            disabled={!signedOutForLinking && isLinking}
                        />

                    {!isSignUpBool && (
                        <View style={{ marginTop: 10 }}>
                            <Link href="/reset-password">
                                <Text style={{
                                    textDecorationLine: 'underline'
                                }}>
                                    Forgot Your Password?
                                </Text>
                            </Link>
                        </View>
                    )}
                </View>

                    {isSignUpBool && (
                        <TextField
                            label="Confirm Password"
                            placeholder="Confirm Password"
                            value={confirmPassword}
                            secureTextEntry
                            onChangeText={setConfirmPassword}
                            disabled={!signedOutForLinking && isLinking}
                        />
                    )}
                </View>

            <View style={{alignItems: 'flex-end' }}>
                <BasicButton
                    label={loading ? 'Loading...' : (isSignUpBool ? 'Sign Up' : 'Login')}
                    onPress={() => {
                        Keyboard.dismiss();
                        isSignUpBool ? handleSignUp() : handleSignIn()
                    }}
                    disabled={(isLinking && !signedOutForLinking) || loading || !email.trim() || !password || password.length < 8 || (isSignUpBool && !confirmPassword)}
                />
            </View>

            <Text style={{ fontSize: 20, textAlign: 'center' }}>
                OR
            </Text>

                <View style={{ gap: 20, marginTop: -10 }}>
                    <GoogleButton
                        imageSource={require('../assets/images/Google.jpg')}
                        label={socialLoading.google ? "Connecting to Google..." : 
                               isLinking ? "Link with Google" : "Continue with Google"}
                        onPress={handleGoogleSignIn}
                        disabled={(!signedOutForLinking && isLinking) || socialLoading.google || socialLoading.microsoft}
                    />

                    <MicrosoftButton
                        imageSource={require('../assets/images/Microsoft.png')}
                        label={socialLoading.microsoft ? "Connecting to Microsoft..." : 
                               isLinking ? "Link with Microsoft" : "Continue with Microsoft"}
                        onPress={handleMicrosoftSignIn}
                        disabled={(!signedOutForLinking && isLinking) || socialLoading.google || socialLoading.microsoft}
                    />
                </View>

            <Divider />

                <BasicButton
                    label={isSignUpBool ? 'Already have an account? Log In'
                        : "Don't have an account? Sign Up"}
                    onPress={handleToggleSignUp}
                    fullWidth
                    altBackground='true'
                    altText='true'
                    disabled={!signedOutForLinking && isLinking}
                />

                <Modal
                    visible={showVerificationModal}
                    animationType="slide"
                    transparent={true}
                >
                    <View style={{
                        flex: 1,
                        justifyContent: 'center',
                        alignItems: 'center',
                        backgroundColor: 'rgba(0,0,0,0.5)'
                    }}>
                        <View style={{
                            backgroundColor: theme.colors.background,
                            padding: 10,
                            borderRadius: 10,
                            width: '65%',
                            alignItems: 'center'
                        }}>
                            <Text style={{ fontSize: 24, marginBottom: 20 }}>
                                Enter Verification Code
                            </Text>

                            <TextInput
                                placeholder="Code"
                                placeholderTextColor={theme.colors.darkNeutral}
                                value={verificationCode}
                                onChangeText={setVerificationCode}
                                keyboardType="numeric"
                                style={{ 
                                    borderWidth: 1, 
                                    padding: 10, 
                                    marginBottom: 20,
                                    borderColor: theme.colors.outline,
                                    borderRadius: 5,
                                    minWidth: 200,
                                    color: theme.colors.darkNeutral
                                }}
                            />

                            <View style={{
                                flexDirection: 'row',
                                justifyContent: 'space-between',
                                width: '100%',
                                marginBottom: 20,
                                gap: 10
                            }}>
                                <BasicButton
                                    label="Cancel"
                                    danger="true"
                                    onPress={() => setShowVerificationModal(false)}
                                    style={{ marginRight: 10 }}
                                />

                                <BasicButton
                                    label="Confirm"
                                    onPress={handleConfirmCode}
                                    style={{ marginLeft: 10 }}
                                />
                            </View>
                            <Pressable onPress={handleResend} disabled={resendCooldown > 0}>
                                <Text
                                    style={{
                                        color: resendCooldown > 0 ? theme.colors.onSurfaceVariant : theme.colors.primary,
                                        opacity: resendCooldown > 0 ? 0.5 : 1,
                                    }}
                                >
                                    {resendCooldown > 0 ? `Resend Code (${resendCooldown}s)` : 'Resend Code'}
                                </Text>
                            </Pressable>
                        </View>
                    </View>
                </Modal>
            </View>
            <Portal>
                <Snackbar
                    visible={snack.visible}
                    onDismiss={() => setSnack(s => ({ ...s, visible: false }))}
                    wrapperStyle={{
                        bottom: (insets.bottom ?? 0) + 12, //keeps it above home indicator
                        alignItems: 'center',
                        justifyContent: 'center',
                        
                    }}
                    style={{
                        alignSelf: 'center',
                        borderRadius: 12,
                        width: "90%",
                        maxWidth: 600,
                        backgroundColor:
                            snack.tone === 'error'
                                ? theme.colors.errorContainer
                                : theme.colors.inverseSurface,
                    }}
                    theme={{
                        colors: {
                            onSurface:
                                snack.tone === 'error'
                                ? theme.colors.onErrorContainer
                                : theme.colors.inverseOnSurface,
                        },
                    }}
                    action={{
                        label: 'Dismiss',
                        onPress: () => setSnack(s => ({ ...s, visible: false })),
                    }}
                >
                    <Text
                        style={{
                        fontWeight: '600',
                        marginBottom: 2,
                        color:
                            snack.tone === 'error'
                            ? theme.colors.onErrorContainer
                            : theme.colors.inverseOnSurface,
                        }}
                    >
                        {snack.tone === 'error' ? (isSignUpBool ? 'Sign-up error' : 'Sign-in error') : 'Notice'}
                    </Text>
                    <Text
                        style={{
                        color:
                            snack.tone === 'error'
                            ? theme.colors.onErrorContainer
                            : theme.colors.inverseOnSurface,
                        }}
                    >
                        {snack.text}
                    </Text>
                </Snackbar>
            </Portal>
            <Portal>
                { loading && (
                    <View style={styles.loadingOverlay} pointerEvents="auto">
                        <ActivityIndicator size="large" />
                    </View>
                )}
            </Portal>
        </ResponsiveScreen>
    );
}

export default LoginSignup;

const styles = StyleSheet.create({
    loadingOverlay: {
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.35)',
        alignItems: 'center',
        justifyContent: 'center',
    },
});