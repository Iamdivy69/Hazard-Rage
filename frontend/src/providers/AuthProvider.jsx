import React, { createContext, useContext, useState } from 'react';
import { setToken } from '../services/apiClient.js';
const AuthCtx = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('hz_user') || 'null'); } catch { return null; }
  });
  const login = (u, t) => { setUser(u); setToken(t); sessionStorage.setItem('hz_user', JSON.stringify(u)); sessionStorage.setItem('hz_token', t); };
  const logout = () => { setUser(null); setToken(null); sessionStorage.clear(); };
  // restore token memory on reload
  React.useEffect(() => { const t = sessionStorage.getItem('hz_token'); if (t) setToken(t); }, []);
  return <AuthCtx.Provider value={{ user, login, logout }}>{children}</AuthCtx.Provider>;
}
export const useAuth = () => useContext(AuthCtx);
