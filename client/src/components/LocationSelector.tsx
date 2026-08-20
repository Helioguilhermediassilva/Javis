import { useLanguage } from "@/contexts/LanguageContext";
import { useLocation } from "@/contexts/LocationContext";

function selectClassName(disabled: boolean): string {
  return `h-7 border border-cyan-500/30 bg-[#000d14] px-1.5 text-[9px] uppercase text-cyan-100 outline-none focus:border-cyan-300 ${disabled ? "cursor-not-allowed opacity-50" : ""}`;
}

export default function LocationSelector() {
  const { t } = useLanguage();
  const {
    location,
    countryCode,
    stateCode,
    cityId,
    countries,
    states,
    cities,
    statesReady,
    loading,
    error,
    selectCountry,
    selectState,
    selectCity,
    retry,
  } = useLocation();

  const countriesLoading = loading === "countries" && countries.length === 0;
  const statesLoading = loading === "states";
  const citiesLoading = loading === "cities";
  const hasStateLevel = states.length > 0;
  const stateDisabled = !countryCode || statesLoading || Boolean(error === "states") || (statesReady && !hasStateLevel);
  const cityDisabled = (!stateCode && hasStateLevel) || !countryCode || citiesLoading || Boolean(error === "cities");

  return (
    <div
      className="border border-cyan-500/30 bg-cyan-500/5 p-2"
      style={{ color: "#7DD3FC", fontFamily: "JetBrains Mono, monospace" }}
    >
      <div className="mb-2 text-[9px] font-bold tracking-[0.08em] text-cyan-300">▸ {t("location.title")}</div>
      <div className="grid grid-cols-1 gap-1.5">
        <label className="flex flex-col gap-1 text-[8px] uppercase text-cyan-500/80">
          {t("location.country")}
          <select
            value={countryCode}
            onChange={(event) => selectCountry(event.target.value)}
            className={selectClassName(countriesLoading || countries.length === 0)}
            aria-label={t("location.country")}
            aria-busy={countriesLoading}
            disabled={countriesLoading || countries.length === 0}
          >
            <option value="">{countriesLoading ? t("location.loadingCountries") : t("location.selectCountry")}</option>
            {countries.map((country) => (
              <option key={country.iso2} value={country.iso2}>
                {country.emoji ? `${country.emoji} ` : ""}{country.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[8px] uppercase text-cyan-500/80">
          {t("location.state")}
          <select
            value={stateCode}
            onChange={(event) => selectState(event.target.value)}
            className={selectClassName(stateDisabled)}
            aria-label={t("location.state")}
            aria-busy={statesLoading}
            disabled={stateDisabled}
          >
            <option value="">
              {statesLoading
                ? t("location.loadingStates")
                : statesReady && !hasStateLevel
                  ? t("location.noStates")
                  : countryCode
                    ? t("location.selectState")
                    : t("location.selectCountryFirst")}
            </option>
            {states.map((state) => (
              <option key={`${state.country_code}-${state.iso2}`} value={state.iso2}>
                {state.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[8px] uppercase text-cyan-500/80">
          {t("location.city")}
          <select
            value={cityId === null ? "" : String(cityId)}
            onChange={(event) => selectCity(Number(event.target.value))}
            className={selectClassName(cityDisabled)}
            aria-label={t("location.city")}
            aria-busy={citiesLoading}
            disabled={cityDisabled}
          >
            <option value="">
              {citiesLoading
                ? t("location.loadingCities")
                : stateCode || (statesReady && !hasStateLevel)
                  ? t("location.selectCity")
                  : t("location.selectStateFirst")}
            </option>
            {cities.map((city) => (
              <option key={city.id} value={city.id}>
                {city.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {error && (
        <div className="mt-2 flex items-center justify-between gap-2 text-[7px] normal-case text-rose-300">
          <span>{t("location.loadError")}</span>
          <button type="button" onClick={retry} className="border border-rose-400/40 px-1.5 py-0.5 uppercase hover:border-rose-200">
            {t("location.retry")}
          </button>
        </div>
      )}
      {!error && <div className="mt-2 text-[7px] normal-case text-cyan-600">{t("location.saved")}</div>}
      <a
        href="https://github.com/dr5hn/countries-states-cities-database"
        target="_blank"
        rel="noreferrer"
        className="mt-1 block text-[7px] normal-case text-cyan-700 underline decoration-cyan-700/50 underline-offset-2 hover:text-cyan-300"
      >
        {t("location.dataSource")}
      </a>
      <div className="sr-only" aria-live="polite">
        {location.country}{location.state ? `, ${location.state}` : ""}{location.city ? `, ${location.city}` : ""}
      </div>
    </div>
  );
}
