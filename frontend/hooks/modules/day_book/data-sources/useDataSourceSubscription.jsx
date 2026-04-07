import { useEffect, useRef } from "react";
import { generateClient } from "aws-amplify/api";
import { onDataSourceUpdate } from "../../graphql/subscriptions";
import { getWorkspaceId } from "../../../../storage/workspaceStorage";

export default function useDataSourceSubscription(onUpdate) {
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

        console.log("Subscribing to data source updates for workspace:", workspaceId);

        subscription = client.graphql({
          query: onDataSourceUpdate,
          variables: { workspaceId },
        }).subscribe({
          next: ({ data }) => {
            const updated = data.onDataSourceUpdate;
            onUpdateRef.current(updated);
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
  }, []);
}