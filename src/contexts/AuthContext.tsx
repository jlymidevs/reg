import React, { createContext, useContext, useEffect, useState } from 'react';

interface AuthContextType {
  isAdmin: boolean;
  loading: boolean;
  signIn: (password: string) => boolean;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType>({
  isAdmin: false,
  loading: true,
  signIn: () => false,
  signOut: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const check = localStorage.getItem('jlycc_admin_auth');
    if (check === 'true') {
      setIsAdmin(true);
    }
    setLoading(false);
  }, []);

  const signIn = (password: string) => {
    // Hardcoded password for bypass
    if (password === 'JlyccAdmin2026!#Secure') {
      localStorage.setItem('jlycc_admin_auth', 'true');
      setIsAdmin(true);
      return true;
    }
    return false;
  };

  const signOut = () => {
    localStorage.removeItem('jlycc_admin_auth');
    setIsAdmin(false);
  };

  return (
    <AuthContext.Provider value={{ isAdmin, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};
