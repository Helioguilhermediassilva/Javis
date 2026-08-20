import { useLanguage } from "@/contexts/LanguageContext";
import { useLocation } from "@/contexts/LocationContext";

const COUNTRY_OPTIONS = [
  { value: "Brasil", labels: { pt: "Brasil", en: "Brazil", es: "Brasil" } },
  { value: "Estados Unidos", labels: { pt: "Estados Unidos", en: "United States", es: "Estados Unidos" } },
  { value: "Espanha", labels: { pt: "Espanha", en: "Spain", es: "España" } },
];

export default function LocationSelector() {
  const { locale, t } = useLanguage();
  const { location, updateLocation } = useLocation();

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
            value={location.country}
            onChange={(event) => updateLocation({ country: event.target.value })}
            className="h-7 border border-cyan-500/30 bg-[#000d14] px-1.5 text-[9px] uppercase text-cyan-100 outline-none focus:border-cyan-300"
            aria-label={t("location.country")}
          >
            {COUNTRY_OPTIONS.map((country) => (
              <option key={country.value} value={country.value}>
                {country.labels[locale]}
              </option>
            ))}
            {!COUNTRY_OPTIONS.some((country) => country.value === location.country) && (
              <option value={location.country}>{location.country}</option>
            )}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[8px] uppercase text-cyan-500/80">
          {t("location.state")}
          <input
            value={location.state}
            onChange={(event) => updateLocation({ state: event.target.value })}
            placeholder={t("location.selectState")}
            list="xavier-state-options"
            className="h-7 border border-cyan-500/30 bg-[#000d14] px-1.5 text-[9px] text-cyan-100 outline-none placeholder:text-cyan-700 focus:border-cyan-300"
            aria-label={t("location.state")}
          />
        </label>
        <label className="flex flex-col gap-1 text-[8px] uppercase text-cyan-500/80">
          {t("location.city")}
          <input
            value={location.city}
            onChange={(event) => updateLocation({ city: event.target.value })}
            placeholder={t("location.selectCity")}
            list="xavier-city-options"
            className="h-7 border border-cyan-500/30 bg-[#000d14] px-1.5 text-[9px] text-cyan-100 outline-none placeholder:text-cyan-700 focus:border-cyan-300"
            aria-label={t("location.city")}
          />
        </label>
      </div>
      <datalist id="xavier-state-options">
        <option value="Distrito Federal" />
        <option value="São Paulo" />
        <option value="Rio de Janeiro" />
        <option value="Minas Gerais" />
        <option value="Bahia" />
        <option value="Paraná" />
        <option value="Rio Grande do Sul" />
      </datalist>
      <datalist id="xavier-city-options">
        <option value="Brasília" />
        <option value="São Paulo" />
        <option value="Rio de Janeiro" />
        <option value="Belo Horizonte" />
        <option value="Salvador" />
        <option value="Curitiba" />
        <option value="Porto Alegre" />
      </datalist>
      <div className="mt-2 text-[7px] normal-case text-cyan-600">{t("location.saved")}</div>
    </div>
  );
}
