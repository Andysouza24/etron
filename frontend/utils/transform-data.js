export default function transformData(rawData, options) {
  const { valueToTrack, dateField, dimensions, timeFrame } = options;

  // Parse timestamps with plain Date()
  const filteredData = rawData.filter(row => {
    const ts = new Date(row[dateField]);

    if (isNaN(ts)) return false; // skip invalid dates

    if (!timeFrame) return true;

    const now = new Date();
    let cutoff;

    switch (timeFrame.unit) {
      case "hours":
        cutoff = new Date(now.getTime() - timeFrame.value * 60 * 60 * 1000);
        break;
      case "days":
        cutoff = new Date(now.getTime() - timeFrame.value * 24 * 60 * 60 * 1000);
        break;
      case "minutes":
        cutoff = new Date(now.getTime() - timeFrame.value * 60 * 1000);
        break;
      default:
        return true;
    }

    return ts >= cutoff;
  });

  // Pick which values to track
  let mappedData = [];
  if (valueToTrack === "X only") {
    mappedData = filteredData.map(row => ({ x: row.x }));
  } else if (valueToTrack === "Y only") {
    mappedData = filteredData.map(row => ({ y: row.y }));
  } else if (valueToTrack === "X and Y") {
    mappedData = filteredData.map(row => ({ x: row.x, y: row.y }));
  }

  // Limit to number of dimensions (points) requested
  if (dimensions) {
    mappedData = mappedData.slice(-dimensions);
  }

  return mappedData;
}