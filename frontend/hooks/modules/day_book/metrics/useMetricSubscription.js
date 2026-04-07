import { useEffect } from "react";
import { onMetricUpdate } from "../../graphql/subscriptions";
import { getWorkspaceId } from "../../../../storage/workspaceStorage";
import { generateClient } from "aws-amplify/api";

const client = generateClient();

export default function useMetricSubscription(onUpdate) {
  useEffect(() => {
    let subscription;

    const subscribe = async () => {
      try {
        const workspaceId = await getWorkspaceId();

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

    // Cleanup when component unmounts
    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, [onUpdate]);
}
