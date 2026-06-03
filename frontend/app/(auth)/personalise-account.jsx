// Author(s): Noah Bradley, Rhys Cleary

import { useState, useEffect } from 'react';
import { View } from 'react-native';
import { Text } from 'react-native-paper';
import TextField from '../../components/common/input/TextField';
import BasicButton from '../../components/common/buttons/BasicButton';
import { useTheme } from 'react-native-paper';
import { router } from 'expo-router';
import StackLayout from '../../components/layout/StackLayout';
import AvatarButton from '../../components/common/buttons/AvatarButton';
import { fetchUserAttributes, signOut } from 'aws-amplify/auth';
import useProfilePhoto from '../../hooks/system/useProfilePhoto';
import { updateUserAttributeWithStep } from '../../utils/userAttributes';
import DecisionDialog from '../../components/overlays/DecisionDialog';
import ResponsiveScreen from '../../components/layout/ResponsiveScreen';
import Header from '../../components/layout/Header';

//import * as ImagePicker from 'expo-image-picker';

const PersonaliseAccount = () => {
	const [firstName, setFirstName] = useState('');
	const [lastName, setLastName] = useState('');
	const [phoneNumber, setPhoneNumber] = useState('');
	const [saving, setSaving] = useState(false);
	const [loading, setLoading] = useState(false);
	const [showWorkspaceModal, setWorkspaceModal] = useState(false);
	const [needsPhoneConfirmation, setNeedsPhoneConfirmation] = useState(false);
	const [message, setMessage] = useState('');
	const [errors, setErrors] = useState({
		firstName: false,
		lastName: false,
		phoneNumber: false,
	});

	const {
		profilePicture,
		pictureChanged,
		choosePhoto: handleChoosePhoto,
		removePhoto: handleRemovePhoto,
		loadPhoto,
		uploadPhoto,
		clearStoredPhoto,
	} = useProfilePhoto();

	useEffect(() => {
		loadProfileData();
	}, []);

	async function loadProfileData() {
		setLoading(true);
		try {
			const userAttributes = await fetchUserAttributes();
			
			setFirstName(userAttributes.given_name || "");
			setLastName(userAttributes.family_name || "");
			// remove country code from phone number
			const phoneNumber = userAttributes.phone_number || "";
			const cleanPhone = phoneNumber.startsWith('+61') ? 
					phoneNumber.substring(3) : phoneNumber;
			setPhoneNumber(cleanPhone);

			await loadPhoto();

		} catch (error) {
			console.error("Error loading personal details: ", error);
			setMessage("Error loading personal details");
		}
		setLoading(false);
	}

	// updates user details, requesting a phone confirmation code if Cognito asks for one
	async function handleUpdateUserAttribute(attributeKey, value) {
		return updateUserAttributeWithStep(attributeKey, value, {
			onError: setMessage,
			onCodeRequired: (key) => {
				if (key === 'phone_number') {
					setNeedsPhoneConfirmation(true);
				}
			},
		});
	}


	async function handleSaveUserAttributes() {
		try {
			if (firstName?.trim()) {
				await handleUpdateUserAttribute('given_name', firstName.trim());
			};

			if (lastName?.trim()) {
				await handleUpdateUserAttribute('family_name', lastName.trim());
			};

			if (phoneNumber?.trim()) {
				// clean the phone number. ensure it starts with +61
				const formattedPhone = phoneNumber.startsWith('+61') ? phoneNumber : `+61${phoneNumber}`;
				await handleUpdateUserAttribute('phone_number', formattedPhone);
			};

			if (pictureChanged) {
				if (profilePicture) {
					const s3Url = await uploadPhoto();
					if (s3Url) {
						await handleUpdateUserAttribute('picture', s3Url);
					}
				} else {
					await handleUpdateUserAttribute('picture', "");
					await clearStoredPhoto();
				}
			}

			setWorkspaceModal(true);

		} catch (error) {
			console.error("Error updating Cognito attributes:", error);
		}
	}

	async function handleContinue() {
		const newErrors = {
			firstName: !firstName.trim(),
			lastName: !lastName.trim(),
			phoneNumber: phoneNumber && (phoneNumber.length < 9 || phoneNumber.length > 10),
		};
		setErrors(newErrors);

		if (Object.values(newErrors).some(Boolean)) {
			return;
		}

		setSaving(true);

		try {
			await handleSaveUserAttributes();
		} finally {
			setSaving(false);
		}
	};

	const theme = useTheme();

	async function handleBackSignOut() {
        try {
            await signOut();
            router.replace("/landing");
        } catch (error) {
            console.error("Error signing out:", error);
        }
    }

	return (
		<ResponsiveScreen
			header={<Header
				title="Account Personalisation"
				showBack
                backIcon="logout"
                onBackPress={handleBackSignOut}
			/>}
			loadingOverlayActive={saving}
		>
			<View style={{ alignItems: "center"}}>
				<AvatarButton 
					type={profilePicture ? "image" : "default"}
					imageSource={profilePicture ? {uri: profilePicture} : undefined}
					firstName={firstName}
					lastName={lastName}
					badgeType={profilePicture ? "edit" : "plus"}
					onPress={handleChoosePhoto}
				/>
				{profilePicture && (
					<BasicButton label="Remove Photo" onPress={handleRemovePhoto} />
				)}
			</View>

			<TextField
				label="First Name"
				placeholder="First Name"
				value={firstName}
				onChangeText={setFirstName}
			/>

			{errors.firstName && (
				<Text style={{ color: theme.colors.error }}>Please enter your first name</Text>
			)}

			<TextField
				label="Last Name"
				placeholder="Last Name"
				value={lastName}
				onChangeText={setLastName}
			/>

			{errors.lastName && (
				<Text style={{ color: theme.colors.error }}>Please enter your last name</Text>
			)}

			<TextField
				label="Phone Number (Optional)"
				placeholder="Phone Number"
				value={phoneNumber}
				maxLength={10}
				keyboardType="numeric"
				textContentType="telephoneNumber"
				onChangeText={(text) => {
					setPhoneNumber(text);
					if (text.length >= 9 && text.length <= 10) {
						setErrors((prev) => ({ ...prev, phoneNumber: false }));
					}
				}}
			/>

			{errors.phoneNumber && (
				<Text style={{ color: theme.colors.error }}>Phone number must be 9-10 digits</Text>
			)}

			<View style={{ alignItems: 'flex-end' }}>
				<BasicButton
					label={saving ? "Saving..." : "Continue"}
					onPress={handleContinue}
				/>
			</View>

			<DecisionDialog
				visible={showWorkspaceModal}
				title="Workspace"
				message="Create your own workspace or join an existing one."
				showGoBack={true}
				leftActionLabel="Create"
				handleLeftAction={() => {
					setWorkspaceModal(false);
					router.navigate("/(auth)/create-workspace");
				}}
				rightActionLabel="Join"
				handleRightAction={() => {
					setWorkspaceModal(false);
					router.navigate("/(auth)/join-workspace");
				}}
				handleGoBack={() => {
					setWorkspaceModal(false);
				}}
			/>

		</ResponsiveScreen>
	);
}

export default PersonaliseAccount;