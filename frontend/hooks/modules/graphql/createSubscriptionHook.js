import useResilientSubscription from "./useResilientSubscription";

// Build a workspace-scoped subscription hook on top of useResilientSubscription.
// The returned hook takes (onUpdate, workspaceId, onReconnect) and only
// subscribes once a workspaceId is present.
// `selectData` pulls the payload out of the subscription response shape.
export default function createSubscriptionHook({ query, label, selectData }) {
    return function useSubscription(onUpdate, workspaceId, onReconnect) {
        useResilientSubscription({
            query,
            variables: workspaceId ? { workspaceId } : null,
            enabled: !!workspaceId,
            selectData,
            onUpdate,
            onReconnect,
            label,
        });
    };
}
