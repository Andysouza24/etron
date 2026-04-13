const {
    registerPushToken,
    removePushToken,
    getPreferences,
    updatePreferences,
} = require("./notificationService");

exports.handler = async (event) => {
    let statusCode = 200;
    let body;

    try {
        const requestJSON = event.body ? JSON.parse(event.body) : {};
        const authUserId = event.requestContext.authorizer.claims.sub;

        if (!authUserId) {
            throw new Error("User not authenticated");
        }

        const routeKey = `${event.httpMethod} ${event.resource}`;

        switch (routeKey) {
            case "POST /notifications/push-token": {
                body = await registerPushToken(authUserId, requestJSON);
                break;
            }

            case "DELETE /notifications/push-token": {
                body = await removePushToken(authUserId, requestJSON);
                break;
            }

            case "GET /notifications/preferences": {
                body = await getPreferences(authUserId);
                break;
            }

            case "PUT /notifications/preferences": {
                body = await updatePreferences(authUserId, requestJSON);
                break;
            }

            default:
                statusCode = 404;
                body = { message: `Unsupported route: ${routeKey}` };
                break;
        }
    } catch (error) {
        console.error(error);
        statusCode = 400;
        body = { error: error.message };
    }

    return {
        statusCode,
        body: JSON.stringify(body),
    };
};