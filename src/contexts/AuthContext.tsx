import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

import * as apiClient from '../api/apiClient';

interface AuthContextType {
  isAuthenticated: boolean;
  username: string | null;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(apiClient.isLoggedIn());
  const [username, setUsername] = useState<string | null>(apiClient.getUsername());

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const result = await apiClient.login(username, password);
      localStorage.setItem('token', result.token);
      localStorage.setItem('username', result.user.username);
      setIsAuthenticated(true);
      setUsername(result.user.username);
      return true;
    } catch (error) {
      setIsAuthenticated(false);
      setUsername(null);
      return false;
    }
  };

  const logout = () => {
    apiClient.logout();
    setIsAuthenticated(false);
    setUsername(null);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, username, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
