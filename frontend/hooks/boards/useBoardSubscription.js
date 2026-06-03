import { onBoardUpdate } from "../modules/graphql/subscriptions";
import createSubscriptionHook from "../modules/graphql/createSubscriptionHook";


export default createSubscriptionHook({
    query: onBoardUpdate,
    label: "BoardSub",
    selectData: (data) => data?.onBoardUpdate,
});
