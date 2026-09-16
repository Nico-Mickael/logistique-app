import { createContext, useContext, useState } from 'react';
import { authService } from '../api/authService';
import { setSiteOverride } from '../api/axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      localStorage.removeItem('user');
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      return null;
    }
  });

  const login = async (email, password) => {
    const { data } = await authService.login(email, password);
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    localStorage.setItem('user', JSON.stringify(data.user));
    // Un utilisateur non-superadmin ne peut pas conserver un filtre de site global.
    if (data.user.role !== 'superadmin') setSiteOverride(null);
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    try {
      if (refreshToken) {
        await authService.logout(refreshToken);
      }
    } catch {
      // proceed with local cleanup even if server call fails
    }
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    setSiteOverride(null);
    setUser(null);
  };

  // Met à jour la disponibilité professionnelle (statut + dates de congé) de
  // l'utilisateur connecté, puis synchronise l'objet user local/session.
  const updateAvailability = async (payload) => {
    const { data } = await authService.updateAvailability(payload);
    setUser((prev) => {
      const next = { ...prev, ...data };
      localStorage.setItem('user', JSON.stringify(next));
      return next;
    });
    return data;
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, updateAvailability }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);
