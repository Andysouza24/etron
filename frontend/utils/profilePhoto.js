import { fetchUserAttributes, getCurrentUser, updateUserAttribute } from "aws-amplify/auth";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { uploadData, getUrl } from 'aws-amplify/storage';
import { Buffer } from 'buffer';
import AsyncStorage from "@react-native-async-storage/async-storage";
//import awsconfig from '../src/aws-exports';

global.Buffer = global.Buffer || Buffer

const profilePhotoUriKey = "profilePhotoUri"

export async function loadProfilePhoto() {
    try {
        const cachedUri = await AsyncStorage.getItem(profilePhotoUriKey);
        if (cachedUri) return cachedUri;

        // Fall back to S3 when no local cache exists.
        const userAttributes = await fetchUserAttributes();
        const S3Path = userAttributes.picture;
        if (!S3Path) return null;
        
        const S3UrlResult = await getUrl({path: S3Path});
        await AsyncStorage.setItem(profilePhotoUriKey, S3UrlResult.url.toString());
        return S3UrlResult.url.toString();
    } catch (error) {
        console.error("Error fetching profile photo URL:", error);
        return null;
    }
}

export async function unloadProfilePhoto() {
    try {
        await AsyncStorage.removeItem(profilePhotoUriKey);
    } catch (error) {
        console.error("Error removing profile photo URL:", error);
    }
}

export async function getPhotoFromDevice() {
    // Get photo library access permission
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
        throw new Error("Photo picking failed: Photo access was denied.");
    }

    // Open photo library and get user to pick photo
    const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [1, 1],  // Forces user to crop image to a square
        quality: 0.1, 
    });
    if (result.canceled) {
        throw new Error("Photo picking failed: User cancelled image picker.");
    }

    // Get the selected photo URI from the device 
    const asset = result.assets[0];
    return asset.uri;
}

export async function saveProfilePhoto(profilePhotoUri) {
    // Get the destination S3 path
    const { userId } = await getCurrentUser();
    const fileName = `${userId}.jpg`;
    const S3FilePath = `profile-pictures/${fileName}`;

    // Upload the photo to S3

    const fileBuffer = await FileSystem.readAsStringAsync(profilePhotoUri, {
        encoding: FileSystem.EncodingType.Base64,
    });

    try {
        await uploadData({
            path: `users/${userId}/accountpicture.jpg`,
            data: Buffer.from(fileBuffer, 'base64'),
            options: {
                bucket: "users"
            }
        }).result;
    } catch (error) {
        throw new Error(`Error uploading photo: ${error.message}`);
    }

    // Replace local storage of photo
    await AsyncStorage.removeItem(profilePhotoUriKey);
    await AsyncStorage.setItem(profilePhotoUriKey, profilePhotoUri);
    return S3FilePath;
}

export async function removeProfilePhotoFromLocalStorage() {
    try {
        await AsyncStorage.removeItem(profilePhotoUriKey);
        return null;
    } catch (error) {
        console.error("Error removing profile photo:", error);
        return null;
    }
}

