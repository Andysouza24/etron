import { useEffect, useRef } from "react";
import { generateClient } from "aws-amplify/api";
import { onDataUpdate } from "../../graphql/subscriptions";
import { getWorkspaceId } from "../../../../storage/workspaceStorage";

export default function useDataUpdateSubscription(onUpdate) {
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
    };

    subscribe();

    return () => {
      if (subscription) subscription.unsubscribe();
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, []);
}