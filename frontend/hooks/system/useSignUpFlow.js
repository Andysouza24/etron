import { useState, useEffect } from 'react';
import { resendSignUpCode } from 'aws-amplify/auth';
import accountService from '../../services/AccountService';

// Owns the email sign-up + verification flow: the verification modal, the code
// input, and the resend cooldown timer, plus the sign-up and confirm handlers.
// Sign-in lives in the screen but reuses the modal/cooldown state exposed here.
export default function useSignUpFlow({ email, password, confirmPassword, isLinking, router, showSnack, setLoading, setMessage }) {
    const [showVerificationModal, setShowVerificationModal] = useState(false);
    const [verificationCode, setVerificationCode] = useState('');
    const [resendCooldown, setResendCooldown] = useState(0);

    useEffect(() => {
        if (!showVerificationModal || resendCooldown <= 0) return;
        const t = setTimeout(() => setResendCooldown((c) => Math.max(c - 1, 0)), 1000);
        return () => clearTimeout(t);
    }, [showVerificationModal, resendCooldown]);

    const handleResend = async () => {
        if (resendCooldown > 0) return;
        try {
            await resendSignUpCode({ username: email });
            setResendCooldown(60);
        } catch (error) {
            console.error("Error resending the code", error);
        }
    };

    const handleSignUp = async () => {
        setLoading(true);
        setMessage('');

        const result = await accountService.signUpWithEmail(email, password, confirmPassword);

        if (result.success) {
            setShowVerificationModal(true);
        } else {
            showSnack(result.error, "error");
        }
        setLoading(false);
    };

    const handleConfirmCode = async () => {
        setLoading(true);
        setMessage('');
        const result = await accountService.completeSignUp(email, password, verificationCode);

        if (result.success) {
            setShowVerificationModal(false);

            if (isLinking) {
                // If we're linking, navigate back to accounts after successful signup
                setTimeout(() => {
                    router.push('/(auth)/(drawer)/settings/account/accounts');
                }, 1000);
            }
        }
        setLoading(false);
    };

    return {
        showVerificationModal,
        setShowVerificationModal,
        verificationCode,
        setVerificationCode,
        resendCooldown,
        setResendCooldown,
        handleResend,
        handleSignUp,
        handleConfirmCode,
    };
}
