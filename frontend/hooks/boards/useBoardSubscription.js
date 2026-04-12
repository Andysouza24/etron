import { useEffect, useRef } from "react";
import { generateClient } from "aws-amplify/api";
import { onBoardUpdate } from "../modules/graphql/subscriptions";


export default function useBoardSubscription(onUpdate, workspaceId) {
    const onUpdateRef = useRef(onUpdate);
    onUpdateRef.current = onUpdate;

    useEffect(() => {
        if (!workspaceId) return;

        let subscription;
        
        try {
            const client = generateClient();
            console.log("[BoardSub] Subscribing to workspace:", workspaceId);

            subscription = client.graphql({
                query: onBoardUpdate,
                variables: { workspaceId }, 
            }).subscribe({
                next: ({ data }) => {
                    const updated = data.onBoardUpdate;
                    console.log("[BoardSub] Received update:", updated);
                    onUpdateRef.current(updated);
                },
                error: (err) => console.error("[BoardSub] Subscription error:", err),
            });
        } catch (error) {
            console.error("[BoardSub] Failed to start subscription:", error);
        }

        return () => {
            if (subscription) subscription.unsubscribe();
        };
    }, [workspaceId]);
}