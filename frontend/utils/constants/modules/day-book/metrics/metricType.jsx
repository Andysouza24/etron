

const MetricTypes = Object.freeze({
    SIMPLE: "simple",
    DIMENSIONAL: "dimensional",
    CALCULATED: "calculated",
});

export const metricTypeOptions = [
    {
        key: MetricTypes.SIMPLE,
        title: 'Simple Metric',
        description: 'New metric created from a single data source.',
        route: '/modules/day-book/metrics/create-metric/simple',
    },
    {
        key: MetricTypes.DIMENSIONAL,
        title: 'Dimensional Metric',
        description: 'New dimensional metric created from existing metrics.',
        route: '/modules/day-book/metrics/create-metric/dimensional',
    },
    {
        key: MetricTypes.CALCULATED,
        title: 'Calculated Metric',
        description: 'New calculated metric created from existing metrics.',
        route: '/modules/day-book/metrics/create-metric/calculated',
    },
];

export default MetricTypes;