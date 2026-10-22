import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { api } from './api';
import { HOSTING_CATEGORIES } from './categories';

const endpoints = {
  vehicles: '/vehicles/my', listings: '/rentals/listings/host', bookings: '/rentals/bookings/host',
  verification: '/verifications/status', policies: '/verifications/policies/status',
  earnings: '/rentals/earnings/my', wallet: '/wallet', notifications: '/notifications', transactions: '/wallet/transactions?limit=30',
  charters: '/aviation/inquiries/host',
};
const DataContext = createContext(null);
const fleetResources = new Set(['vehicles', 'listings', 'bookings']);
const supportedFleet = (key, data) => !fleetResources.has(key) ? data : data.filter((row) => {
  const vehicle = key === 'vehicles' ? row : key === 'listings' ? row.vehicle : row.listing?.vehicle;
  return HOSTING_CATEGORIES.some((category) => category.key === vehicle?.type);
});
export function HostData({ children }) {
  const [resources, setResources] = useState({});
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(null);
  const mounted = useRef(true);
  const active = useRef(null);
  const refresh = useCallback(() => {
    if (active.current) return active.current;
    if (mounted.current) setLoading(true);
    const task = Promise.all(Object.entries(endpoints).map(async ([key, path]) => {
      try {
        const result = await api.get(path);
        if (mounted.current) setResources((old) => ({ ...old, [key]: { data: supportedFleet(key, result.data), error: null, loaded: true } }));
      } catch (error) {
        if (mounted.current) setResources((old) => ({ ...old, [key]: { ...old[key], error: error.message } }));
      }
    })).finally(() => {
      if (mounted.current) { setLoading(false); setUpdatedAt(new Date()); }
      active.current = null;
    });
    active.current = task;
    return task;
  }, []);
  useEffect(() => {
    mounted.current = true;
    refresh();
    const sub = AppState.addEventListener('change', (state) => { if (state === 'active') refresh(); });
    const timer = setInterval(() => { if (AppState.currentState === 'active') refresh(); }, 60000);
    return () => { mounted.current = false; sub.remove(); clearInterval(timer); };
  }, [refresh]);
  return <DataContext.Provider value={{ resources, loading, updatedAt, refresh }}>{children}</DataContext.Provider>;
}
export const useHost = () => useContext(DataContext);
