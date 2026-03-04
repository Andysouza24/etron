import { useEffect } from "react";
import { API, graphqlOperation } from "aws-amplify";
import { onMetricUpdated } from "../../graphql/subscriptions";
import { getWorkspaceId } from "../../../../storage/workspaceStorage";

export default function useMetricsSubscription(onUpdate) {
  useEffect(() => {
    let subscription;

    const subscribe = async () => {
      try {
        const workspaceId = await getWorkspaceId();

        subscription = API.graphql(
          graphqlOperation(onMetricUpdated, { workspaceId })
        ).subscribe({
          next: ({ value }) => {
            const updatedMetric = value.data.onMetricUpdated;
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
