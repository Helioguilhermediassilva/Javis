import {
  getAllCitiesOfCountry,
  getCitiesOfState,
  getCountries,
  getStatesOfCountry,
  type ICity,
  type ICountry,
  type IState,
} from "@countrystatecity/countries-browser";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export interface XavierLocation {
  country: string;
  state: string;
  city: string;
}

export interface LocationSelection {
  location: XavierLocation;
  countryCode: string;
  stateCode: string;
  cityId: number | null;
}

export type LocationLoadingLevel = "countries" | "states" | "cities" | null;

const STORAGE_KEY = "xavier-location";

export const DEFAULT_LOCATION: XavierLocation = {
  country: "Brasil",
  state: "Distrito Federal",
  city: "Brasília",
};

const DEFAULT_SELECTION: LocationSelection = {
  location: DEFAULT_LOCATION,
  countryCode: "BR",
  stateCode: "DF",
  cityId: null,
};

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase();
}

function readInitialSelection(): LocationSelection {
  if (typeof window === "undefined") return DEFAULT_SELECTION;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_SELECTION;
    const parsed = JSON.parse(raw) as Partial<XavierLocation & LocationSelection>;
    return {
      location: {
        country: typeof parsed.country === "string" && parsed.country.trim() ? parsed.country.trim() : DEFAULT_LOCATION.country,
        state: typeof parsed.state === "string" ? parsed.state.trim() : DEFAULT_LOCATION.state,
        city: typeof parsed.city === "string" ? parsed.city.trim() : DEFAULT_LOCATION.city,
      },
      countryCode: typeof parsed.countryCode === "string" ? parsed.countryCode.trim().toUpperCase() : "",
      stateCode: typeof parsed.stateCode === "string" ? parsed.stateCode.trim().toUpperCase() : "",
      cityId: typeof parsed.cityId === "number" ? parsed.cityId : null,
    };
  } catch {
    return DEFAULT_SELECTION;
  }
}

function sortByName<T extends { name: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

function findCountry(countries: ICountry[], selection: LocationSelection): ICountry | undefined {
  if (selection.countryCode) {
    const byCode = countries.find((country) => country.iso2 === selection.countryCode);
    if (byCode) return byCode;
  }
  const wanted = normalize(selection.location.country);
  return countries.find((country) => [country.name, country.native, country.iso2, country.iso3].some((value) => normalize(value) === wanted))
    ?? countries.find((country) => (wanted === "brasil" || wanted === "brazil") && country.iso2 === "BR");
}

function findState(states: IState[], selection: LocationSelection): IState | undefined {
  if (selection.stateCode) {
    const byCode = states.find((state) => state.iso2 === selection.stateCode);
    if (byCode) return byCode;
  }
  const wanted = normalize(selection.location.state);
  return states.find((state) => [state.name, state.native, state.iso2].some((value) => typeof value === "string" && normalize(value) === wanted));
}

function findCity(cities: ICity[], selection: LocationSelection): ICity | undefined {
  if (selection.cityId !== null) {
    const byId = cities.find((city) => city.id === selection.cityId);
    if (byId) return byId;
  }
  const wanted = normalize(selection.location.city);
  return cities.find((city) => [city.name, city.native].some((value) => typeof value === "string" && normalize(value) === wanted));
}

interface LocationContextValue {
  location: XavierLocation;
  countryCode: string;
  stateCode: string;
  cityId: number | null;
  countries: ICountry[];
  states: IState[];
  cities: ICity[];
  statesReady: boolean;
  loading: LocationLoadingLevel;
  error: string | null;
  selectCountry: (countryCode: string) => void;
  selectState: (stateCode: string) => void;
  selectCity: (cityId: number) => void;
  setLocation: (location: XavierLocation) => void;
  updateLocation: (patch: Partial<XavierLocation>) => void;
  retry: () => void;
}

const LocationContext = createContext<LocationContextValue | null>(null);

export function LocationProvider({ children }: { children: ReactNode }) {
  const [selection, setSelection] = useState<LocationSelection>(readInitialSelection);
  const [countries, setCountries] = useState<ICountry[]>([]);
  const [states, setStates] = useState<IState[]>([]);
  const [statesLoadedForCountry, setStatesLoadedForCountry] = useState<string | null>(null);
  const [cities, setCities] = useState<ICity[]>([]);
  const [loading, setLoading] = useState<LocationLoadingLevel>("countries");
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
      ...selection.location,
      countryCode: selection.countryCode,
      stateCode: selection.stateCode,
      cityId: selection.cityId,
    }));
  }, [selection]);

  useEffect(() => {
    let cancelled = false;
    setLoading("countries");
    setError(null);
    getCountries()
      .then((nextCountries) => {
        if (cancelled) return;
        const ordered = sortByName(nextCountries);
        setCountries(ordered);
        setSelection((current) => {
          const country = findCountry(ordered, current);
          if (!country) {
            return {
              ...current,
              countryCode: "",
              stateCode: "",
              cityId: null,
              location: { ...current.location, state: "", city: "" },
            };
          }
          return {
            ...current,
            countryCode: country.iso2,
            location: { ...current.location, country: current.location.country || country.name },
          };
        });
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          console.error("[location] countries catalog failed", loadError);
          setError("countries");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(null);
      });
    return () => { cancelled = true; };
  }, [reloadToken]);

  useEffect(() => {
    if (!selection.countryCode) {
      setStates([]);
      setCities([]);
      return;
    }
    let cancelled = false;
    setLoading("states");
    setError(null);
    setStates([]);
    setStatesLoadedForCountry(null);
    setCities([]);
    getStatesOfCountry(selection.countryCode)
      .then((nextStates) => {
        if (cancelled) return;
        const ordered = sortByName(nextStates);
        setStates(ordered);
        setStatesLoadedForCountry(selection.countryCode);
        setSelection((current) => {
          const state = findState(ordered, current);
          if (!state) {
            return {
              ...current,
              stateCode: "",
              cityId: null,
              location: { ...current.location, state: "", city: "" },
            };
          }
          return {
            ...current,
            stateCode: state.iso2,
            location: { ...current.location, state: current.location.state || state.name },
          };
        });
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          console.error("[location] states catalog failed", loadError);
          setError("states");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(null);
      });
    return () => { cancelled = true; };
  }, [selection.countryCode]);

  useEffect(() => {
    if (!selection.countryCode || (!selection.stateCode && (statesLoadedForCountry !== selection.countryCode || states.length > 0))) {
      setCities([]);
      return;
    }
    let cancelled = false;
    setLoading("cities");
    setError(null);
    setCities([]);
    const citiesRequest = selection.stateCode
      ? getCitiesOfState(selection.countryCode, selection.stateCode)
      : getAllCitiesOfCountry(selection.countryCode);
    citiesRequest
      .then((nextCities) => {
        if (cancelled) return;
        const ordered = sortByName(nextCities);
        setCities(ordered);
        setSelection((current) => {
          const city = findCity(ordered, current);
          if (!city) {
            return { ...current, cityId: null, location: { ...current.location, city: "" } };
          }
          return {
            ...current,
            cityId: city.id,
            location: { ...current.location, city: current.location.city || city.name },
          };
        });
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          console.error("[location] cities catalog failed", loadError);
          setError("cities");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(null);
      });
    return () => { cancelled = true; };
  }, [selection.countryCode, selection.stateCode, states, statesLoadedForCountry]);

  const value = useMemo<LocationContextValue>(() => ({
    location: selection.location,
    countryCode: selection.countryCode,
    stateCode: selection.stateCode,
    cityId: selection.cityId,
    countries,
    states,
    cities,
    statesReady: Boolean(selection.countryCode && statesLoadedForCountry === selection.countryCode),
    loading,
    error,
    selectCountry(countryCode) {
      const country = countries.find((item) => item.iso2 === countryCode);
      if (!country) return;
      setSelection({
        location: { country: country.name, state: "", city: "" },
        countryCode: country.iso2,
        stateCode: "",
        cityId: null,
      });
    },
    selectState(stateCode) {
      const state = states.find((item) => item.iso2 === stateCode);
      if (!state) return;
      setSelection((current) => ({
        ...current,
        location: { ...current.location, state: state.name, city: "" },
        stateCode: state.iso2,
        cityId: null,
      }));
    },
    selectCity(cityId) {
      const city = cities.find((item) => item.id === cityId);
      if (!city) return;
      setSelection((current) => ({
        ...current,
        location: { ...current.location, city: city.name },
        cityId: city.id,
      }));
    },
    setLocation(nextLocation) {
      setSelection((current) => ({ ...current, location: nextLocation }));
    },
    updateLocation(patch) {
      setSelection((current) => ({ ...current, location: { ...current.location, ...patch } }));
    },
    retry() {
      setReloadToken((current) => current + 1);
    },
  }), [cities, countries, error, loading, selection, states, statesLoadedForCountry]);

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
}

export function useLocation(): LocationContextValue {
  const value = useContext(LocationContext);
  if (!value) throw new Error("useLocation deve ser usado dentro de LocationProvider");
  return value;
}

export { STORAGE_KEY as LOCATION_STORAGE_KEY };
