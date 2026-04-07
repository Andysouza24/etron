import { useEffect, useRef } from "react";
import { generateClient } from "aws-amplify/api";
import { onMetricUpdate } from "../../graphql/subscriptions";

export default function useMetricSubscription(onUpdate, workspaceId) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    if (!workspaceId) return;

    let subscription;

    try {
      const client = generateClient();
      console.log("Subscribing to metric updates for workspace:", workspaceId);

      subscription = client.graphql({
        query: onMetricUpdate,
        variables: { workspaceId },
      }).subscribe({
        next: ({ data }) => {
          const updatedMetric = data.onMetricUpdate;
          onUpdateRef.current(updatedMetric);
        },
        error: (err) => console.error("Subscription error:", err),
      });
    } catch (error) {
      console.error("Failed to start subscription:", error);
    }

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, [workspaceId]);
}