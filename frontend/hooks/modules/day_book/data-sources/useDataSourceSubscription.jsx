import { useEffect } from "react";
import { generateClient } from "aws-amplify/api";
import { onDataSourceUpdate } from "../../graphql/subscriptions";
import { getWorkspaceId } from "../../../../storage/workspaceStorage";

const client = generateClient();

export default function useDataSourceSubscription(onUpdate) {
  useEffect(() => {
    let subscription;
    let retryTimeout;

    const subscribe = async () => {
      try {
        const workspaceId = await getWorkspaceId();

        if (!workspaceId) {
          retryTimeout = setTimeout(subscribe, 2000);
          return;
        }

        subscription = client.graphql({
          query: onDataSourceUpdate,
          variables: { workspaceId },
        }).subscribe({
          next: ({ data }) => {
            const updated = data.onDataSourceUpdate;
            onUpdate(updated);
          },
          error: (err) => console.error("DataSource subscription error:", err),
        });
      } catch (error) {
        console.error("Failed to start DataSource subscription:", error);
      }
    };

    subscribe();

    return () => {
      if (subscription) subscription.unsubscribe();
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, [onUpdate]);
}