import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { generateClient } from "aws-amplify/api";

// Shared helper for AppSync GraphQL subscriptions used throughout the app.
// Handles three things the raw `client.graphql(...).subscribe(...)` does not:
//   1. Reconnect with exponential backoff after a subscription error
//      (network blip, AppSync deadline exceeded, etc.). Backoff resets on
//      every successful event.
//   2. Re-subscribe automatically when the app comes back to the foreground
//      after a long background period, when stale connections often look
//      "open" but no longer deliver events.
//   3. Optional `onReconnect` callback fired whenever a fresh subscription
//      is established (after the first one). Use it to refetch the list so
//      the UI catches up on anything missed while disconnected.
//
// Inputs:
//   query        : GraphQL subscription document (string)
//   variables    : object of variables for the subscription
//   enabled      : whether to subscribe (false = unsubscribed, no-op)
//   selectData   : (data) => payload to forward to onUpdate
//   onUpdate     : (payload) => void, called per event
//   onReconnect  : optional () => void | Promise<void>, called when a new
//                  subscription replaces a previous one
//   label        : log prefix (e.g. "MetricSub")
export default function useResilientSubscription({
    query,
    variables,
    enabled = true,
    selectData,
    onUpdate,
    onReconnect,
    label = "Subscription",
}) {
    const onUpdateRef = useRef(onUpdate);
    onUpdateRef.current = onUpdate;
    const onReconnectRef = useRef(onReconnect);
    onReconnectRef.current = onReconnect;
    const selectDataRef = useRef(selectData);
    selectDataRef.current = selectData;

    // Serialise variables for the effect dependency so callers can pass
    // a fresh object each render without forcing a resubscribe loop.
    const varsKey = variables ? JSON.stringify(variables) : "";

    useEffect(() => {
        if (!enabled || !query) return undefined;

        let subscription = null;
        let retryTimeout = null;
        let appStateSub = null;
        let cancelled = false;
        let attempts = 0;
        let isFirstSubscription = true;

        const cleanupSubscription = () => {
            if (subscription) {
                try { subscription.unsubscribe(); } catch (e) { /* ignore */ }
                subscription = null;
            }
            if (retryTimeout) {
                clearTimeout(retryTimeout);
                retryTimeout = null;
            }
        };

        const scheduleRetry = () => {
            if (cancelled) return;
            attempts += 1;
            // 1s, 2s, 4s, 8s, capped at 30s, with up to 25% jitter
            const base = Math.min(30000, 1000 * Math.pow(2, attempts - 1));
            const delay = Math.round(base * (0.75 + Math.random() * 0.25));
            console.log(`[${label}] reconnect attempt ${attempts} in ${delay}ms`);
            retryTimeout = setTimeout(subscribe, delay);
        };

        const subscribe = () => {
            if (cancelled) return;
            cleanupSubscription();

            let client;
            try {
                client = generateClient();
            } catch (err) {
                console.error(`[${label}] generateClient failed:`, err);
                scheduleRetry();
                return;
            }

            try {
                subscription = client.graphql({ query, variables }).subscribe({
                    next: ({ data }) => {
                        attempts = 0;
                        try {
                            const payload = selectDataRef.current
                                ? selectDataRef.current(data)
                                : data;
                            onUpdateRef.current?.(payload);
                        } catch (e) {
                            console.error(`[${label}] handler threw:`, e);
                        }
                    },
                    error: (err) => {
                        console.error(`[${label}] subscription error:`, err);
                        scheduleRetry();
                    },
                });

                // If this is a reconnect (not the first subscribe), notify
                // the caller so they can refetch the list to catch any
                // events that arrived while we were disconnected.
                if (!isFirstSubscription && onReconnectRef.current) {
                    try {
                        Promise.resolve(onReconnectRef.current()).catch((e) =>
                            console.error(`[${label}] onReconnect failed:`, e)
                        );
                    } catch (e) {
                        console.error(`[${label}] onReconnect threw:`, e);
                    }
                }
                isFirstSubscription = false;
            } catch (err) {
                console.error(`[${label}] failed to subscribe:`, err);
                scheduleRetry();
            }
        };

        const handleAppStateChange = (next) => {
            if (next === "active") {
                console.log(`[${label}] app foregrounded, resubscribing`);
                attempts = 0;
                subscribe();
            }
        };

        subscribe();
        appStateSub = AppState.addEventListener("change", handleAppStateChange);

        return () => {
            cancelled = true;
            cleanupSubscription();
            if (appStateSub && typeof appStateSub.remove === "function") {
                appStateSub.remove();
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [query, varsKey, enabled]);
}
