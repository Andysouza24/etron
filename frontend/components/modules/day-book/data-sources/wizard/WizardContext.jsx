// wizard state + navigation context
// each adapter declares array of step decisions and optional finalise async callback
// provider owns in-progress draft + exposes navigation helpers to step components

import React, {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useState,
} from "react";

const WizardContext = createContext(null);

const WizardProvider = ({
    type,
    steps,
    initialDraft = {},
    onFinalise,
    children,
}) => {
    const [draft, setDraftState] = useState(initialDraft);
    const [activeStepIndex, setActiveStepIndex] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const setDraft = useCallback((updater) => {
        setDraftState((prev) =>
            typeof updater === "function" ? updater(prev) : { ...prev, ...updater }
        );
    }, []);

    const resetDraft = useCallback(() => {
        setDraftState(initialDraft);
        setActiveStepIndex(0);
    }, [initialDraft]);

    // steps may opt out via an `applies(draft)` predicate
    // recompute visible list whenever draft changes - flows like "schema review only when a schema preview exists" naturally fall through
    const visibleSteps = useMemo(
        () => (steps || []).filter((step) => !step.applies || step.applies(draft)),
        [steps, draft]
    );

    const safeIndex = Math.min(activeStepIndex, Math.max(visibleSteps.length - 1, 0));
    const activeStep = visibleSteps[safeIndex] || null;

    const goNext = useCallback(() => {
        setActiveStepIndex((i) => Math.min(i + 1, visibleSteps.length - 1));
    }, [visibleSteps.length]);

    const goBack = useCallback(() => {
        setActiveStepIndex((i) => Math.max(i - 1, 0));
    }, []);

    const goToStep = useCallback(
        (key) => {
            const idx = visibleSteps.findIndex((s) => s.key === key);
            if (idx >= 0) setActiveStepIndex(idx);
        },
        [visibleSteps]
    );

    const finalise = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await onFinalise?.(draft);
            return result;
        } catch (e) {
            console.error("[Wizard] finalise:", e);
            setError(e?.message || "Failed to create connection");
            throw e;
        } finally {
            setLoading(false);
        }
    }, [draft, onFinalise]);

    const value = useMemo(
        () => ({
            type,
            draft,
            setDraft,
            resetDraft,
            steps: visibleSteps,
            activeStep,
            activeStepIndex: safeIndex,
            isFirst: safeIndex === 0,
            isLast: safeIndex === visibleSteps.length - 1,
            goNext,
            goBack,
            goToStep,
            loading,
            setLoading,
            error,
            setError,
            finalise,
        }),
        [
            type,
            draft,
            setDraft,
            resetDraft,
            visibleSteps,
            activeStep,
            safeIndex,
            goNext,
            goBack,
            goToStep,
            loading,
            error,
            finalise,
        ]
    );

    return (
        <WizardContext.Provider value={value}>{children}</WizardContext.Provider>
    );
};

export const useWizard = () => {
    const ctx = useContext(WizardContext);
    if (!ctx) {
        throw new Error("useWizard must be used within a WizardProvider");
    }
    return ctx;
};

export default WizardProvider;
