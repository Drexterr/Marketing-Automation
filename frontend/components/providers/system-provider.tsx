"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import axios from 'axios';

type SystemState = {
  health: {
    status: 'HEALTHY' | 'DEGRADED' | 'ERROR';
    details: {
      schedulerFailures: number;
      claudeDegraded: boolean;
      dbHealthy: boolean;
    };
  };
  pulse: {
    status: string;
    activeTask: string | null;
    lastHeartbeat: string | null;
  };
  emergencyStop: boolean;
};

const initialState: SystemState = {
  health: {
    status: 'HEALTHY',
    details: { schedulerFailures: 0, claudeDegraded: false, dbHealthy: true }
  },
  pulse: {
    status: 'IDLE',
    activeTask: null,
    lastHeartbeat: null
  },
  emergencyStop: false
};

const SystemContext = createContext<{
  state: SystemState;
  refresh: () => Promise<void>;
} | null>(null);

export function SystemProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SystemState>(initialState);

  const fetchSystemState = async () => {
    try {
      // Fetch health and state concurrently
      const [healthRes, stateRes] = await Promise.all([
        axios.get('/api/state/health').catch(() => ({ data: initialState.health })),
        axios.get('/api/state').catch(() => ({ data: { pulse: initialState.pulse, emergency_stop: false } }))
      ]);

      setState({
        health: healthRes.data,
        pulse: stateRes.data.pulse || initialState.pulse,
        emergencyStop: stateRes.data.emergency_stop || false,
      });
    } catch (error) {
      console.error("Failed to fetch system state", error);
    }
  };

  useEffect(() => {
    fetchSystemState();
    const interval = setInterval(fetchSystemState, 5000); // Poll every 5s
    return () => clearInterval(interval);
  }, []);

  return (
    <SystemContext.Provider value={{ state, refresh: fetchSystemState }}>
      {children}
    </SystemContext.Provider>
  );
}

export function useSystem() {
  const context = useContext(SystemContext);
  if (!context) throw new Error("useSystem must be used within a SystemProvider");
  return context;
}
