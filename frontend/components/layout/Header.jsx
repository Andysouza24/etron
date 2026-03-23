// Author(s): Rhys Cleary, Matthew Page, Noah Bradley

import React, { useState } from "react";
import { useRouter } from "expo-router";
import { Appbar, useTheme } from "react-native-paper";
import { useNavigation } from '@react-navigation/native';
import PermissionGate from "../common/PermissionGate";

/*
    Removed code. Incase want to add a second right icon:
    {rightIcon && (<Appbar.Action icon={rightIcon} onPress={onRightIconPress} />)}
*/

const Header = ({
    title,
    subtitle,
    showBack,
    showMenu,
    showEdit,
    showCheck,
    showCheckLeft,
    showPlus,
    showEllipsis,
    rightIconPermission = true,
    onRightIconPress,
    onLeftIconPress,
    onEllipsisPress,
    onBackPress,
    backIcon,
    rightActions = [],
    titleAlignment = 'left',
    titleStyle,
    subtitleStyle
}) => {
    const router = useRouter();
    const theme = useTheme();
    const navigation = useNavigation();

    const [noPermVisible, setNoPermVisible] = useState(false);
    
    return (
        <Appbar.Header mode="center-aligned"
            style={{
                backgroundColor: theme.colors.background,
                marginBottom: 12
            }}
        >
            {
                showBack ? (
                    <Appbar.Action
                        icon={backIcon || "arrow-left"}
                        onPress={async() => {
                            if (onBackPress) return await onBackPress();
                            router.back();
                        }} 
                    />
                ) : showMenu ? (
                    <Appbar.Action icon="menu" onPress={() => navigation.openDrawer()} />
                ) : null
            }
            
            <Appbar.Content
                title={title}
                subtitle={subtitle}
                titleStyle={[
                    titleAlignment === 'right' && { textAlign: 'right' },
                    titleAlignment === 'center' && { textAlign: 'center' },
                    titleStyle
                ]}
                subtitleStyle={[
                    titleAlignment === 'right' && { textAlign: 'right' },
                    titleAlignment === 'center' && { textAlign: 'center' },
                    subtitleStyle
                ]}
            />

            {showEllipsis && (
                <Appbar.Action icon="dots-vertical" onPress={onEllipsisPress} />
            )}

            {rightActions.length > 0
                ? rightActions.map((action, index) => (
                    action?.render
                        ? (
                            <React.Fragment key={action.key || index}>
                                {action.render({ theme })}
                            </React.Fragment>
                        )
                        : (
                            <Appbar.Action
                                key={action.key || index}
                                icon={action.icon}
                                onPress={action.onPress}
                                disabled={action.disabled}
                            />
                        )
                ))
                : (showPlus || showEdit || showCheck) && (
                    <PermissionGate
                        allowed={rightIconPermission}
                        onAllowed={onRightIconPress}
                    >
                        <Appbar.Action
                            icon={
                                showPlus ? "plus" :
                                showEdit ? "pencil" :
                                showCheck ? "check" : "line"
                            }
                        />
                    </PermissionGate>
                )
            }
        </Appbar.Header>
    );
}

export default Header;