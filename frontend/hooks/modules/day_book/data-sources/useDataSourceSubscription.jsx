import { useEffect, useRef } from "react";
import { generateClient } from "aws-amplify/api";
import { onDataSourceUpdate } from "../../graphql/subscriptions";

export default function useDataSourceSubscription(onUpdate, workspaceId) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    if (!workspaceId) return;

    let subscription;

    try {
      const client = generateClient();
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

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, [workspaceId]);
}