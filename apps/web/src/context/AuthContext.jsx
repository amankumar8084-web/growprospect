import React, { createContext, useContext, useState, useEffect } from 'react';
import { sessionManager } from '../services/sessionManager';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(sessionManager.getSessionInfo());
  const [isLoaded, setIsLoaded] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(sessionManager.isAuthenticated());

  useEffect(() => {
    // Initial session check
    sessionManager.initSession().then(() => {
      setSession(sessionManager.getSessionInfo());
      setIsAuthenticated(sessionManager.isAuthenticated());
      setIsLoaded(true);
    });

    const unsubscribe = sessionManager.subscribe(() => {
      setSession(sessionManager.getSessionInfo());
      setIsAuthenticated(sessionManager.isAuthenticated());
    });

    return unsubscribe;
  }, []);

  const login = async (email, password) => {
    return await sessionManager.login(email, password);
  };

  const register = async (userData) => {
    return await sessionManager.register(userData);
  };

  const logout = async () => {
    return await sessionManager.logout();
  };

  const user = session?.user || null;
  const role = sessionManager.getRole();
  const orgId = sessionManager.getOrgId();

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        orgId,
        session,
        isLoaded,
        isAuthenticated,
        login,
        register,
        logout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function useUser() {
  const { user, isLoaded } = useAuth();
  return { user, isLoaded, isSignedIn: Boolean(user) };
}
