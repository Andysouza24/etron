// Author(s): Rhys Cleary

import BasicDialog from "./BasicDialog";

const UnsavedChangesDialog = ({
    visible,
    onDismiss,
    handleLeftAction = () => {},
    handleRightAction = () => {}
}) => {
    return (
        <BasicDialog
            visible={visible}
            onDismiss={onDismiss}
            title="Discard changes?"
            message="You have unsaved changes."
            leftActionLabel="Discard Changes"
            handleLeftAction={handleLeftAction}
            rightActionLabel="Keep Editing"
            handleRightAction={handleRightAction}
        />
    );

};

export default UnsavedChangesDialog;