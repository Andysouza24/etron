import { onDataUpdate } from "../../graphql/subscriptions";
import createSubscriptionHook from "../../graphql/createSubscriptionHook";

export default createSubscriptionHook({
  query: onDataUpdate,
  label: "DataUpdateSub",
  selectData: (data) => data?.onDataUpdate,
});
