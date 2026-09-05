import OAuthButton from './OAuthButton';

// Thin wrapper preserving the GoogleButton import name at call sites.
const GoogleButton = (props) => <OAuthButton {...props} />;

export default GoogleButton;
