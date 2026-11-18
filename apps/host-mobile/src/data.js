import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
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
const dashboardResources = ['vehicles', 'bookings', 'charters', 'earnings', 'wallet', 'verification'];
const supportedFleet = (key, data) => !fleetResources.has(key) ? data : data.filter((row) => {
  const vehicle = key === 'vehicles' ? row : key === 'listings' ? row.vehicle : row.listing?.vehicle;
  return HOSTING_CATEGORIES.some((category) => category.key === vehicle?.type);
});
export function HostData({ children }) {
  const [resources, setResources] = useState({});
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(null);
  const mounted = useRef(true);
  const active = useRef(new Map());
  const refresh = useCallback((keys = Object.keys(endpoints)) => {
    if (mounted.current) setLoading(true);
    const tasks = [...new Set(keys)].filter((key) => endpoints[key]).map((key) => {
      if (active.current.has(key)) return active.current.get(key);
      const task = api.get(endpoints[key]).then((result) => {
        if (mounted.current) setResources((old) => ({ ...old, [key]: { data: supportedFleet(key, result.data), error: null, loaded: true } }));
      }).catch((error) => {
        if (mounted.current) setResources((old) => ({ ...old, [key]: { ...old[key], error: error.message } }));
      }).finally(() => {
        active.current.delete(key);
      });
      active.current.set(key, task);
      return task;
    });
    return Promise.all(tasks).finally(() => {
      if (mounted.current) { setLoading(active.current.size > 0); setUpdatedAt(new Date()); }
    });
  }, []);
  useEffect(() => {
    mounted.current = true;
    refresh(dashboardResources);
    return () => { mounted.current = false; };
  }, [refresh]);
  return <DataContext.Provider value={{ resources, loading, updatedAt, refresh }}>{children}</DataContext.Provider>;
}
export const useHost = () => useContext(DataContext);
