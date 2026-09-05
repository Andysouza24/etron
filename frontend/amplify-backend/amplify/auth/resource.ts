import { defineAuth, secret } from '@aws-amplify/backend';

/**
 * Define and configure your auth resource
 * @see https://docs.amplify.aws/gen2/build-a-backend/auth
 */
export const auth = defineAuth({
  
  loginWith: {
    email: true,
    
    /*externalProviders: {
      google: {
        clientId: secret('GOOGLE_CLIENT_ID'),
        clientSecret: secret('GOOGLE_CLIENT_SECRET'),

        scopes: ['email', 'profile', 'openid'],

        attributeMapping: {
          email: 'email',
          emailVerified: 'email_verified',
          givenName: 'given_name',
          familyName: 'family_name',
        }
      },

      oidc: [
        {
          name: 'MicrosoftEntraID',
          clientId: secret('MICROSOFT_ENTRA_ID_CLIENT_ID'),
          clientSecret: secret('MICROSOFT_ENTRA_ID_CLIENT_SECRET'),
          issuerUrl: 'https://login.microsoftonline.com/bacabe25-4b37-4686-b4ff-eb5fe4a61be4/oauth2/v2.0',

          scopes: ['openid', 'email', 'profile', 'offline_access'],
          attributeMapping: {
            email: 'email',
            emailVerified: 'email_verified',
            givenName: 'given_name',
            familyName: 'family_name',
          }
        }
      ],

      callbackUrls: ["myapp://callback"],
      logoutUrls: ["myapp://signout/"],
    }*/
  },

  userAttributes: {
    "custom:has_workspace": {
      dataType: "String",
      mutable: true,
    },

    "custom:country_code": {
      dataType: "String",
      mutable: true,
    },
  },

});