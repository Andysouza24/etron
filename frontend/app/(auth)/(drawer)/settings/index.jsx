// Author(s): Rhys Cleary

import { useEffect, useState, useMemo } from 'react';
import { Text } from 'react-native-paper';
import { router } from 'expo-router';
import ResponsiveScreen from '../../../../components/layout/ResponsiveScreen';
import Header from '../../../../components/layout/Header';
import StackLayout from '../../../../components/layout/StackLayout';
import DescriptiveButton from '../../../../components/common/buttons/DescriptiveButton';
import PermissionGate from '../../../../components/common/PermissionGate';
import { hasPermission } from '../../../../utils/permissions';
import { useHasPermission } from '../../../../hooks/useHasPermission';

const SettingsItem = ({ item}) => {
    const {allowed} = useHasPermission(item.permKey);
    return (
        <PermissionGate
            key={item.label}
            allowed={allowed}
            onAllowed={item.onPress}
        >
            <DescriptiveButton
                icon={item.icon}
                image={item.image}
                label={item.label}
                description={item.description}
            />
        </PermissionGate>
    );
}

const Settings = () => { 
    const settingButtonMap = useMemo(() => [
        {
            permKey: 'app.workspace.view_workspace_settings',
            icon: 'briefcase-outline',
            label: 'Workspace',
            onPress: () => router.navigate('/settings/workspace/workspace-settings'),
        },
        /*{ 
            icon: "palette-outline", 
            label: "Themes", 
            onPress: () => router.navigate("/settings/theme-settings") 
        },*/
        /*{ 
            image: require("../../../../assets/icons/menu/accessibility.png"), 
            label: "Accessibility", 
            onPress: () => router.navigate("/settings/accessibility-settings") 
        },*/
        /*{ 
            icon: "information-outline", 
            label: "Support", 
            onPress: () => router.navigate("/settings/support-settings") 
        },*/
        /*{ 
            image: require("../../../../assets/icons/menu/privacy_policy.png"), 
            label: "Privacy Policy", 
        },*/
        /*{ 
            icon: "file-document-multiple-outline", 
            label: "Terms and Conditions",
        },*/
    ], []);
    return (
        <ResponsiveScreen
            header={
                <Header title="Settings" showMenu />
            }
            center={false}
            scroll={true}
        >
            <StackLayout spacing={12}>
                {settingButtonMap.map((item) => (
                    <SettingsItem key={item.label} item={item} />
                ))}
                <Text>More options will be added to this page in the future.</Text>
            </StackLayout>
        </ResponsiveScreen>
    )
}

export default Settings;