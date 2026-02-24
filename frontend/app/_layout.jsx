// Author(s): Rhys Cleary

import { Slot } from 'expo-router';
import { PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { themes } from '../assets/styles/themes/themes';
import SafeView from '../components/layout/SafeView';
import { Authenticator } from '@aws-amplify/ui-react-native';
import { VerificationProvider } from '../contexts/VerificationContext'; // temp until backend
import { AppProvider } from '../contexts/AppContext';
import { Amplify } from 'aws-amplify';

import * as Linking from 'expo-linking';

Linking.addEventListener('url', (event) => { //deep linking; used for microsoft/google sign in redirects
    console.log('App was opened with URL:', event.url);
})

const currentTheme = themes['light'];

export default function RootLayout() {
    return (    
        <PaperProvider theme={currentTheme}>
            <Authenticator.Provider>
                {/*Wrap the drawer layout around the safe area and the slot */}
                {/* temp until backend */}
                <AppProvider>
                    <VerificationProvider> 
                        <SafeAreaProvider>
                            <SafeView>            
                                <Slot />
                            </SafeView>
                        </SafeAreaProvider>
                    </VerificationProvider>
                </AppProvider>
            </Authenticator.Provider>
        </PaperProvider>
    );
}