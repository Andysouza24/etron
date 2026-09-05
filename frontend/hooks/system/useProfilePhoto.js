import { useState, useCallback } from 'react';
import {
    loadProfilePhoto,
    removeProfilePhotoFromLocalStorage,
    getPhotoFromDevice,
    saveProfilePhoto,
} from '../../utils/profilePhoto';

// Profile-photo state plus the device-pick and S3 upload/remove operations.
// The screen still owns persisting the resulting URL to the user's attributes.
export default function useProfilePhoto() {
    const [profilePicture, setProfilePicture] = useState(null);
    const [pictureChanged, setPictureChanged] = useState(false);

    const choosePhoto = useCallback(async () => {
        const uri = await getPhotoFromDevice();
        setProfilePicture(uri);
        setPictureChanged(true);
    }, []);

    const removePhoto = useCallback(() => {
        setProfilePicture(null);
        setPictureChanged(true);
    }, []);

    const loadPhoto = useCallback(async () => {
        const profilePhotoUri = await loadProfilePhoto();
        setProfilePicture(profilePhotoUri || null);
    }, []);

    const uploadPhoto = useCallback(async () => {
        return saveProfilePhoto(profilePicture);
    }, [profilePicture]);

    const clearStoredPhoto = useCallback(async () => {
        await removeProfilePhotoFromLocalStorage();
    }, []);

    return {
        profilePicture,
        setProfilePicture,
        pictureChanged,
        setPictureChanged,
        choosePhoto,
        removePhoto,
        loadPhoto,
        uploadPhoto,
        clearStoredPhoto,
    };
}
