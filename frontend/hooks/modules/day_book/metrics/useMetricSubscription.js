import { useEffect } from "react";
import { generateClient } from "aws-amplify/api";
import { onMetricUpdate } from "../../graphql/subscriptions";
import { getWorkspaceId } from "../../../../storage/workspaceStorage";

const client = generateClient();

export default function useMetricSubscription(onUpdate) {
  useEffect(() => {
    let subscription;
    let retryTimeout;

    const subscribe = async () => {
      try {
        const workspaceId = await getWorkspaceId();

        if (!workspaceId) {
          // workspace not loaded yet — retry shortly
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
            onUpdate(updatedMetric);
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
  }, [onUpdate]);
}