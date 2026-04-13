const { evaluate } = require("./evaluatorService");

exports.handler = async (event) => {
    let statusCode = 200;
    let body;

    try {
        const requestJSON = event.body ? JSON.parse(event.body) : {};
        const authUserId = event.requestContext?.authorizer?.claims?.sub;

        const routeKey = event.httpMethod
            ? `${event.httpMethod} ${event.resource}`
            : "SCHEDULED";

        switch (routeKey) {
            // manual trigger via API (useful for testing)
            case "POST /notifications/evaluate": {
                if (!authUserId) {
                    throw new Error("User not authenticated");
                }
                body = await evaluate(requestJSON);
                break;
            }

            // scheduled invocation (EventBridge) — future use
            case "SCHEDULED": {
                body = await evaluate({});
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