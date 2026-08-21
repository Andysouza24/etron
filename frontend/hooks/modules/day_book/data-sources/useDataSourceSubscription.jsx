import { useEffect, useState } from "react";
import { onDataSourceUpdate } from "../../graphql/subscriptions";
import createSubscriptionHook from "../../graphql/createSubscriptionHook";
import { getWorkspaceId } from "../../../../storage/workspaceStorage";

// Base hook keyed by workspaceId; this wrapper resolves the id itself
// because callers here do not pass one in.
const useDataSourceSubscriptionBase = createSubscriptionHook({
  query: onDataSourceUpdate,
  label: "DataSourceSub",
  selectData: (data) => data?.onDataSourceUpdate,
});

export default function useDataSourceSubscription(onUpdate, onReconnect) {
  const [workspaceId, setWorkspaceId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const id = await getWorkspaceId();
        if (!cancelled) setWorkspaceId(id || null);
      } catch (err) {
        console.error("[DataSourceSub] failed to read workspaceId:", err);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useDataSourceSubscriptionBase(onUpdate, workspaceId, onReconnect);
}
