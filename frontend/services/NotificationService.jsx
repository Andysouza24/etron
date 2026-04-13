import endpoints from "../utils/api/endpoints";
import { apiGet, apiPost, apiPut, apiDelete } from "../utils/api/apiClient";

class NotificationService {

    // get all notifications for the current user
    async getNotifications() {
        return apiGet(endpoints.notifications.getNotifications);
    }

    // create a new notification
    async createNotification({ title, body, data }) {
        return apiPost(endpoints.notifications.createNotification, {
            title,
            body,
            data,
        });
    }

    // register a device push token with the backend
    async registerPushToken(pushToken, platform) {
        return apiPost(endpoints.notifications.registerPushToken, {
            pushToken,
            platform,
        });
    }

    // remove a device push token from the backend
    async removePushToken(pushToken) {
        return apiDelete(endpoints.notifications.removePushToken, {
            pushToken,
        });
    }

    // get notification preferences for the current user
    async getPreferences() {
        return apiGet(endpoints.notifications.getPreferences);
    }

    // update notification preferences for the current user
    async updatePreferences(preferences) {
        return apiPut(endpoints.notifications.updatePreferences, preferences);
    }
}

const notificationService = new NotificationService();
export default notificationService;
export { NotificationService };
