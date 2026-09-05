// authService.js - Separate authentication service
import { getCurrentUser, fetchAuthSession } from 'aws-amplify/auth';

class AuthService {
  // Check if user is authenticated
  static async isAuthenticated() {
    try {
      const user = await getCurrentUser();
      return !!user;
    } catch (error) {
      console.log('[AuthService] isAuthenticated:', error);
      return false;
    }
  }

  // Get current auth session
  static async getAuthSession() {
    try {
      const { tokens } = await fetchAuthSession();
      return {
        accessToken: tokens?.accessToken?.toString(),
        idToken: tokens?.idToken?.toString(),
        refreshToken: tokens?.refreshToken?.toString(),
        isValid: !!tokens?.accessToken,
      };
    } catch (error) {
      console.error('[AuthService] getAuthSession:', error);
      return {
        accessToken: null,
        idToken: null,
        refreshToken: null,
        isValid: false,
      };
    }
  }

  // Get auth headers for API requests
  static async getAuthHeaders() {
    try {
      const session = await this.getAuthSession();
      if (session.isValid && session.idToken) {
        return {
          'Authorization': `Bearer ${session.idToken}`,
          'Content-Type': 'application/json',
        };
      }
      return {
        'Content-Type': 'application/json',
      };
    } catch (error) {
      console.error('[AuthService] getAuthHeaders:', error);
      return {
        'Content-Type': 'application/json',
      };
    }
  }

  // Get current user info
  static async getCurrentUserInfo() {
    try {
      const user = await getCurrentUser();
      return {
        userId: user.userId,
        username: user.username,
        email: user.attributes?.email || user.username,
        attributes: user.attributes || {},
      };
    } catch (error) {
      console.error('[AuthService] getCurrentUserInfo:', error);
      return {
        userId: null,
        username: null,
        email: null,
        attributes: {},
      };
    }
  }

  // Get current authenticated user (for compatibility)
  static async getCurrentUser() {
    try {
      const user = await getCurrentUser();
      return { success: true, user };
    } catch (error) {
      console.log('[AuthService] getCurrentUser:', error);
      return { success: false, error: error.message };
    }
  }

  // Create auth service object for adapters
  static async createAuthServiceObject() {
    try {
      const userInfo = await this.getCurrentUserInfo();
      const session = await this.getAuthSession();
      
      return {
        getCurrentUser: () => Promise.resolve({
          userId: userInfo.userId,
          username: userInfo.username || userInfo.email,
          email: userInfo.email,
          attributes: userInfo.attributes || {},
        }),
        
        getSession: () => Promise.resolve({
          accessToken: session.accessToken,
          idToken: session.idToken,
          refreshToken: session.refreshToken,
          isValid: session.isValid,
        }),
        
        getAuthHeaders: async () => {
          return await this.getAuthHeaders();
        },
        
        isAuthenticated: () => this.isAuthenticated(),
        
        getUserContext: async () => {
          return {
            user: {
              userId: userInfo.userId,
              username: userInfo.username || userInfo.email,
              email: userInfo.email,
              attributes: userInfo.attributes || {},
            },
            session: {
              accessToken: session.accessToken,
              idToken: session.idToken,
              isValid: session.isValid,
            },
            isAuthenticated: session.isValid,
          };
        },
      };
    } catch (error) {
      console.error('[AuthService] createAuthServiceObject:', error);
      // Return a mock auth service for demo mode
      return {
        getCurrentUser: () => Promise.resolve({
          userId: "demo_user",
          username: "demo@example.com",
          email: "demo@example.com",
          attributes: {},
        }),
        getSession: () => Promise.resolve({
          accessToken: "demo_token",
          idToken: "demo_token",
          refreshToken: "demo_token",
          isValid: true,
        }),
        getAuthHeaders: () => Promise.resolve({
          Authorization: "Bearer demo_token",
          "Content-Type": "application/json",
        }),
        isAuthenticated: () => Promise.resolve(true),
        getUserContext: () => Promise.resolve({
          user: {
            userId: "demo_user",
            username: "demo@example.com",
            email: "demo@example.com",
            attributes: {},
          },
          session: {
            accessToken: "demo_token",
            idToken: "demo_token",
            isValid: true,
          },
          isAuthenticated: true,
        }),
      };
    }
  }
}

export default AuthService;