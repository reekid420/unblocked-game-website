import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

interface ProxyContextType {
  proxyUrl: string;
  setProxyUrl: (url: string) => void;
}

const ProxyContext = createContext<ProxyContextType | undefined>(undefined);

export const ProxyProvider = ({ children }: { children: ReactNode }) => {
  const [proxyUrl, setProxyUrl] = useState('');
  return (
    <ProxyContext.Provider value={{ proxyUrl, setProxyUrl }}>
      {children}
    </ProxyContext.Provider>
  );
};

export const useProxy = () => {
  const context = useContext(ProxyContext);
  if (!context) throw new Error('useProxy must be used within ProxyProvider');
  return context;
};
