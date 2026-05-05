import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { authApi } from '../lib/api';

interface User {
  id: string; username: string; firstName: string; lastName: string;
  role: string; branchId: string | null; permissions: string[];
  branch?: { name: string; code: string } | null;
}

interface AuthState {
  user: User | null; token: string | null; isLoading: boolean;
  login:  (username: string, password: string) => Promise<void>;
  logout: () => void;
  hasPermission: (key: string) => boolean;
  isRole: (...roles: string[]) => boolean;
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null, token: null, isLoading: false,

      login: async (username, password) => {
        set({ isLoading: true });
        try {
          const data = await authApi.login(username, password);
          localStorage.setItem('fm_token', data.access_token);
          set({ user: data.user, token: data.access_token, isLoading: false });
        } finally {
          set({ isLoading: false });
        }
      },

      logout: () => {
        localStorage.removeItem('fm_token');
        set({ user: null, token: null });
        window.location.href = '/login';
      },

      hasPermission: (key: string) => {
        const { user } = get();
        if (!user) return false;
        if (user.role === 'SUPER_ADMIN') return true;
        return user.permissions.includes(key);
      },

      isRole: (...roles: string[]) => {
        const { user } = get();
        return !!user && roles.includes(user.role);
      },
    }),
    { name: 'fm-auth', partialize: (s) => ({ user: s.user, token: s.token }) },
  ),
);
