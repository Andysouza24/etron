import OAuthButton from './OAuthButton';

// Thin wrapper preserving the MicrosoftButton import name at call sites.
const MicrosoftButton = (props) => <OAuthButton {...props} />;

export default MicrosoftButton;
