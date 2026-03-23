import { Stack } from 'expo-router';

export default function BoardsLayout() {
    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="create" />
            <Stack.Screen name="[id]/index" />
            <Stack.Screen name="[id]/settings" />
        </Stack>
    );
}
