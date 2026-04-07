import { useEffect, useRef } from "react";
import { generateClient } from "aws-amplify/api";
import { onDataUpdate } from "../../graphql/subscriptions";

export default function useDataUpdateSubscription(onUpdate, workspaceId) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    if (!workspaceId) return;

    let subscription;

    try {
      const client = generateClient();
      subscription = client.graphql({
        query: onDataUpdate,
        variables: { workspaceId },
      }).subscribe({
        next: ({ data }) => {
          const updated = data.onDataUpdate;
          onUpdateRef.current(updated);
        },
        error: (err) => console.error("DataUpdate subscription error:", err),
      });
    } catch (error) {
      console.error("Failed to start DataUpdate subscription:", error);
    }

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, [workspaceId]);
}