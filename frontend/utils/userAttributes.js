import { updateUserAttribute } from 'aws-amplify/auth';

// Update a single Cognito user attribute and interpret the next step.
// Shared by the screens that edit user attributes (personalise-account,
// create-workspace, join-workspace). Returns { needsConfirmation, error? }.
// Screen-specific reactions are passed in:
//   onCodeRequired(attributeKey, codeDeliveryDetails) — a confirmation code was sent
//   onError(message) — surface the failure message however the screen wants
export async function updateUserAttributeWithStep(attributeKey, value, { onCodeRequired, onError } = {}) {
    try {
        const output = await updateUserAttribute({
            userAttribute: {
                attributeKey,
                value
            }
        });

        const { nextStep } = output;

        switch (nextStep.updateAttributeStep) {
            case 'CONFIRM_ATTRIBUTE_WITH_CODE': {
                const codeDeliveryDetails = nextStep.codeDeliveryDetails;
                console.log(`Confirmation code was sent to ${codeDeliveryDetails?.deliveryMedium} at ${codeDeliveryDetails?.destination}`);
                onCodeRequired?.(attributeKey, codeDeliveryDetails);
                return { needsConfirmation: true };
            }
            case 'DONE': {
                const fieldName = attributeKey.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
                console.log(`${fieldName} updated successfully`);
                return { needsConfirmation: false };
            }
            default:
                console.log(`${attributeKey.replace('_', ' ')} update completed`);
                return { needsConfirmation: false };
        }
    } catch (error) {
        console.error("Error updating user attribute:", error);
        const fieldName = attributeKey.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
        onError?.(`Error updating ${fieldName}: ${error.message}`);
        return { needsConfirmation: false, error: true };
    }
}
