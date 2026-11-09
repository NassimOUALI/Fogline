import { createContext, useContext, type ReactNode } from 'react';
import type { AppServices } from '../services/services';

const ServicesContext = createContext<AppServices | undefined>(undefined);

export function ServicesProvider(props: {
  readonly services: AppServices;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <ServicesContext.Provider value={props.services}>{props.children}</ServicesContext.Provider>
  );
}

/** The use cases and ports, injected at the composition root. */
export function useServices(): AppServices {
  const services = useContext(ServicesContext);
  if (services === undefined) {
    throw new Error('useServices must be used inside <ServicesProvider>.');
  }
  return services;
}
