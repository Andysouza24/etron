import { useEffect, useRef } from "react";
import { generateClient } from "aws-amplify/api";
import { onMetricUpdate } from "../../graphql/subscriptions";
import { getWorkspaceId } from "../../../../storage/workspaceStorage";

export default function useMetricSubscription(onUpdate) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    let subscription;
    let retryTimeout;

    const subscribe = async () => {
      try {
        const client = generateClient();
        const workspaceId = await getWorkspaceId();

        if (!workspaceId) {
          retryTimeout = setTimeout(subscribe, 2000);
          return;
        }
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
    };

    subscribe();

    return () => {
      if (subscription) subscription.unsubscribe();
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, []);
}