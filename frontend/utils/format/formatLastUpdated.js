// Formats a timestamp as a friendly "last updated" string for cards/lists.
// Examples:
//   Today - 3:45 PM
//   Yesterday - 8:12 AM
//   3 days ago - 9:00 AM
//   a week ago - 2:30 PM
//   12 May - 4:15 PM           (this year)
//   12 May 24 - 4:15 PM        (different year)
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

export default function formatLastUpdated(timestamp) {
	if (timestamp == null) return undefined;
	const then = dayjs(timestamp);
	if (!then.isValid()) return undefined;

	const now = dayjs();
	const dayDiff = now.startOf("day").diff(then.startOf("day"), "day");
	const timeStr = then.format("h:mm A");

	let datePart;
	if (dayDiff === 0) {
		datePart = "Today";
	} else if (dayDiff === 1) {
		datePart = "Yesterday";
	} else if (dayDiff > 1 && dayDiff <= 7) {
		datePart = then.from(now); // "3 days ago", "a week ago"
	} else {
		datePart = then.year() === now.year()
			? then.format("D MMMM")
			: then.format("D MMMM YY");
	}

	return `${datePart} - ${timeStr}`;
}
