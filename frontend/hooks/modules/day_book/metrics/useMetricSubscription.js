import { onMetricUpdate } from "../../graphql/subscriptions";
import createSubscriptionHook from "../../graphql/createSubscriptionHook";

export default createSubscriptionHook({
  query: onMetricUpdate,
  label: "MetricSub",
  selectData: (data) => data?.onMetricUpdate,
});
