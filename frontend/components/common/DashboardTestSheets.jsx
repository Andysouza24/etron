// Old dashboard code preserved for future reference.
// Contains bottom sheet test examples (Quick Note, Profile Actions, Quick Icons, Search Footer).
// These were defined but never rendered in the original dashboard JSX.

import { View, StyleSheet, Image } from "react-native";
import { useState, useCallback, useMemo } from "react";
import { router } from "expo-router";
import { useTheme, Avatar, List, Divider, TextInput, Button, HelperText } from "react-native-paper";
import CustomBottomSheet from "../BottomSheet";
import ResponsiveScreen from "../layout/ResponsiveScreen";
import Header from "../layout/Header";

const DashboardTestSheets = () => {
    const theme = useTheme();
    const [showSheet, setShowSheet] = useState(false);
    const [showCompactSheet, setShowCompactSheet] = useState(false);
    const [showProfileActionsSheet, setShowProfileActionsSheet] = useState(false);
    const [showQuickIconSheet, setShowQuickIconSheet] = useState(false);
    const [showQuickNoteSheet, setShowQuickNoteSheet] = useState(false);
    const [showSearchFooterSheet, setShowSearchFooterSheet] = useState(false);

    // quick note form state
    const [noteTitle, setNoteTitle] = useState("");
    const [noteBody, setNoteBody] = useState("");

    // example data for new sheets
    const profileActionItems = useMemo(() => ([
        { icon: 'account-edit', label: 'Account Details', onPress: () => router.navigate('/settings/account/account') },
        { icon: 'image-edit', label: 'Personal Details', onPress: () => router.navigate('/settings/account/personal-details') },
        { icon: 'bell-ring', label: 'Notification Settings', onPress: () => router.navigate('/modules/day-book/notifications/notifications') },
        { icon: 'shield-account', label: 'Password & Security', onPress: () => router.navigate('/settings/account/password-security') },
        { icon: 'logout-variant', label: 'Sign Out', onPress: () => { /* does nothing */ } },
    ]), [router]);

    const quickIconActions = useMemo(() => ([
        { icon: 'plus-box', label: 'New Entry', onPress: () => router.navigate('/modules/day-book/data-management/new-entry') },
        { icon: 'chart-timeline-variant', label: 'View Metrics', onPress: () => router.navigate('/modules/day-book/metrics/metric-management') },
        { icon: 'file-chart', label: 'Reports', onPress: () => router.navigate('/modules/day-book/reports/report-management') },
        { icon: 'bell', label: 'Alerts', onPress: () => router.navigate('/modules/day-book/notifications/notifications') },
        { icon: 'account-multiple-plus', label: 'Invite User', onPress: () => router.navigate('/collaboration') },
    ]), [router]);

    const settingOptionButtons = [
        { icon: "tray-arrow-up", label: "Testing - Example Bottom Sheet", onPress: () => { setShowSheet(true); setShowCompactSheet(false);} },
        { icon: "view-compact", label: "Testing - Compact Bottom Sheet", onPress: () => { setShowCompactSheet(true); setShowSheet(false);} },
        { icon: "account-box", label: "Testing - Profile Actions Sheet", onPress: () => { setShowProfileActionsSheet(true); } },
        { icon: "flash", label: "Testing - Quick Icon Actions Sheet", onPress: () => { setShowQuickIconSheet(true); } },
        { icon: "note-plus", label: "Testing - Quick Note Sheet (Custom)", onPress: () => { 
            setShowSheet(false);
            setShowCompactSheet(false);
            setShowProfileActionsSheet(false);
            setShowQuickIconSheet(false);
            setShowQuickNoteSheet(true); 
        } },
        { icon: "magnify", label: "Testing - Search Footer Sheet", onPress: () => { setShowSearchFooterSheet(true); } },
    ];

    // custom content for quick note sheet with no list rendering
    const quickNoteContent = (
        <View style={{ flex: 1 }}>
            <TextInput
                mode="outlined"
                label="Title"
                value={noteTitle}
                onChangeText={setNoteTitle}
                style={{ marginBottom: 12 }}
            />
            <TextInput
                mode="outlined"
                label="Details"
                value={noteBody}
                onChangeText={setNoteBody}
                multiline
                numberOfLines={5}
                style={{ marginBottom: 8 }}
            />
            <HelperText type={noteTitle.length ? "info" : "error"} visible>
                {noteTitle.length ? `${noteTitle.length} chars in title` : 'Title is recommended'}
            </HelperText>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 }}>
                <Button onPress={() => { setShowQuickNoteSheet(false); setNoteTitle(''); setNoteBody(''); }} style={{ marginRight: 8 }}>Cancel</Button>
                <Button
                    mode="contained"
                    disabled={!noteTitle.trim() && !noteBody.trim()}
                    onPress={() => {
                        // does nothing
                        setShowQuickNoteSheet(false);
                        setNoteTitle('');
                        setNoteBody('');
                    }}
                >
                    Save
                </Button>
            </View>
        </View>
    );

    // custom renderers for new sheets
    const renderProfileActionItem = useCallback(({ item }) => (
        <List.Item
            title={item.label}
            left={(props) => <List.Icon {...props} icon={item.icon} />}
            onPress={() => { setShowProfileActionsSheet(false); item.onPress?.(); }}
        />
    ), []);

    const renderQuickIconItem = useCallback(({ item }) => (
        <List.Item
            title={item.label}
            left={(props) => <List.Icon {...props} icon={item.icon} />}
            style={{ paddingVertical: 4 }}
            onPress={() => { setShowQuickIconSheet(false); item.onPress?.(); }}
        />
    ), []);

    const profileHeaderChildren = (
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Avatar.Text size={36} label="ON" style={{ marginRight: 12 }} />
            <View>
                <List.Subheader style={{ paddingLeft: 0, paddingRight: 0, paddingTop: 0, paddingBottom: 0 }}>Onion</List.Subheader>
            </View>
        </View>
    );
    
    return (
        <ResponsiveScreen
            header={
                <Header title="Dashboard" showMenu />
            }
            center={false}
            padded={false}
            scroll={false}
        >         
            <View style={styles.header}>
                <Image
                    source={require('../../assets/images/eTRON_logo.png')}
                    style={styles.logo}
                />
            </View>
        </ResponsiveScreen>
    )
}

const styles = StyleSheet.create({
    background: {
        flex: 1,
    },
    container: {
        flex: 1,
        padding: 20,
    },
    header: {
        width: '100%',
        alignItems: 'center',
        marginTop: 140,
    },
    logo: {
        width: '100%',
        height: 100,
        resizeMode: 'contain',
    },
})

export default DashboardTestSheets;
