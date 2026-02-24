// Author(s): Matthew Parkinson

import React from 'react';
import { View, Image, ImageBackground, StyleSheet } from 'react-native';
import { useTheme } from 'react-native-paper';
import { router } from "expo-router";
import BasicButton from '../components/common/buttons/BasicButton';
import ResponsiveScreen from '../components/layout/ResponsiveScreen';

const Landing = () => {
	const theme = useTheme();

	return (
		/*<ImageBackground
			source={require('../assets/images/LandingTextBackground.png')}
			style={styles.background}
			resizeMode='cover'
		>*/
			<ResponsiveScreen transparent>
				<View style={styles.container}>
					
					{/* --- Top Logo Section --- */}
					<View style={styles.header}>
						<Image
							source={require('../assets/images/Logo.png')}
							style={styles.logo}
						/>
					</View>

					{/* --- Center Foreground & Buttons --- */}
					<View style={styles.centerSection}>
						<Image
							source={require('../assets/images/LandingTextForeground.png')}
							style={styles.foregroundImage}
						/>

						<View style={styles.buttonContainer}>
							<BasicButton
								label='Login'
								onPress={() => router.navigate('/login-signup?isSignUp=false')}
								fullWidth
							/>
							<BasicButton
								label='Sign Up'
								onPress={() => router.navigate('/login-signup?isSignUp=true')}
								fullWidth
							/>
						</View>
					</View>
				</View>
			</ResponsiveScreen>
		/*</ImageBackground>*/
	);
};

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
		marginTop: 40,
	},
	logo: {
		width: '100%',
		height: 100,
		resizeMode: 'contain',
	},

	// This section takes remaining space and centers content
	centerSection: {
		flex: 1,
		alignItems: 'center',
		justifyContent: 'center',
		gap: 30,
	},

	foregroundImage: {
		width: 320,
		height: 220,
		resizeMode: 'contain',
	},
	buttonContainer: {
		width: '100%',
		gap: 20,
		marginTop: 40,
	},
});

export default Landing;
