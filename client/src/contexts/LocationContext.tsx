import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export interface XavierLocation {
  country: string;
  state: string;
  city: string;
}

const STORAGE_KEY = "xavier-location";

export const DEFAULT_LOCATION: XavierLocation = {
  country: "Brasil",
  state: "Distrito Federal",
  city: "Brasília",
};

function readInitialLocation(): XavierLocation {
  if (typeof window === "undefined") return DEFAULT_LOCATION;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_LOCATION;
    const parsed = JSON.parse(raw) as Partial<XavierLocation>;
    return {
      country: typeof parsed.country === "string" && parsed.country.trim() ? parsed.country.trim() : DEFAULT_LOCATION.country,
      state: typeof parsed.state === "string" ? parsed.state.trim() : DEFAULT_LOCATION.state,
      city: typeof parsed.city === "string" ? parsed.city.trim() : DEFAULT_LOCATION.city,
    };
  } catch {
    return DEFAULT_LOCATION;
  }
}

interface LocationContextValue {
  location: XavierLocation;
  setLocation: (location: XavierLocation) => void;
  updateLocation: (patch: Partial<XavierLocation>) => void;
}

const LocationContext = createContext<LocationContextValue | null>(null);

export function LocationProvider({ children }: { children: ReactNode }) {
  const [location, setLocationState] = useState<XavierLocation>(readInitialLocation);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(location));
  }, [location]);

  const value = useMemo<LocationContextValue>(() => ({
    location,
    setLocation: setLocationState,
    updateLocation(patch) {
      setLocationState((current) => ({ ...current, ...patch }));
    },
  }), [location]);

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocation(): LocationContextValue {
  const value = useContext(LocationContext);
  if (!value) throw new Error("useLocation deve ser usado dentro de LocationProvider");
  return value;
}

export { STORAGE_KEY as LOCATION_STORAGE_KEY };
