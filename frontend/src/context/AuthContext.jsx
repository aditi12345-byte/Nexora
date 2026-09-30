import { useState } from 'react';
import api from '../services/api';
import { AuthContext } from './auth-context';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('folio_user');
    return raw ? JSON.parse(raw) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('folio_token'));

  function persist(nextToken, nextUser) {
    setToken(nextToken);
    setUser(nextUser);
    if (nextToken) localStorage.setItem('folio_token', nextToken);
    else localStorage.removeItem('folio_token');
    if (nextUser) localStorage.setItem('folio_user', JSON.stringify(nextUser));
    else localStorage.removeItem('folio_user');
  }

  async function login(email, password) {
    const response = await api.post('/api/auth/login', { email, password });
    persist(response.data.data.token, response.data.data.user);
    return response.data.data.user;
  }

  async function register(name, email, password) {
    await api.post('/api/auth/register', { name, email, password });
    return login(email, password);
  }

  async function logout() {
    try {
      if (token) await api.post('/api/auth/logout');
    } finally {
      persist(null, null);
    }
  }

  return <AuthContext.Provider value={{ user, token, login, register, logout }}>{children}</AuthContext.Provider>;
}
