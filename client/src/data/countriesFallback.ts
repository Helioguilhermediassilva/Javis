export interface CountryFallback {
  name: string;
  iso2: string;
  iso3: string;
  emoji: string;
}

/** Lightweight offline fallback for the country selector. States and cities remain lazy-loaded. */
export const FALLBACK_COUNTRIES: CountryFallback[] = [
  {
    "name": "Afghanistan",
    "iso2": "AF",
    "iso3": "AFG",
    "emoji": "🇦🇫"
  },
  {
    "name": "Aland Islands",
    "iso2": "AX",
    "iso3": "ALA",
    "emoji": "🇦🇽"
  },
  {
    "name": "Albania",
    "iso2": "AL",
    "iso3": "ALB",
    "emoji": "🇦🇱"
  },
  {
    "name": "Algeria",
    "iso2": "DZ",
    "iso3": "DZA",
    "emoji": "🇩🇿"
  },
  {
    "name": "American Samoa",
    "iso2": "AS",
    "iso3": "ASM",
    "emoji": "🇦🇸"
  },
  {
    "name": "Andorra",
    "iso2": "AD",
    "iso3": "AND",
    "emoji": "🇦🇩"
  },
  {
    "name": "Angola",
    "iso2": "AO",
    "iso3": "AGO",
    "emoji": "🇦🇴"
  },
  {
    "name": "Anguilla",
    "iso2": "AI",
    "iso3": "AIA",
    "emoji": "🇦🇮"
  },
  {
    "name": "Antarctica",
    "iso2": "AQ",
    "iso3": "ATA",
    "emoji": "🇦🇶"
  },
  {
    "name": "Antigua and Barbuda",
    "iso2": "AG",
    "iso3": "ATG",
    "emoji": "🇦🇬"
  },
  {
    "name": "Argentina",
    "iso2": "AR",
    "iso3": "ARG",
    "emoji": "🇦🇷"
  },
  {
    "name": "Armenia",
    "iso2": "AM",
    "iso3": "ARM",
    "emoji": "🇦🇲"
  },
  {
    "name": "Aruba",
    "iso2": "AW",
    "iso3": "ABW",
    "emoji": "🇦🇼"
  },
  {
    "name": "Australia",
    "iso2": "AU",
    "iso3": "AUS",
    "emoji": "🇦🇺"
  },
  {
    "name": "Austria",
    "iso2": "AT",
    "iso3": "AUT",
    "emoji": "🇦🇹"
  },
  {
    "name": "Azerbaijan",
    "iso2": "AZ",
    "iso3": "AZE",
    "emoji": "🇦🇿"
  },
  {
    "name": "Bahrain",
    "iso2": "BH",
    "iso3": "BHR",
    "emoji": "🇧🇭"
  },
  {
    "name": "Bangladesh",
    "iso2": "BD",
    "iso3": "BGD",
    "emoji": "🇧🇩"
  },
  {
    "name": "Barbados",
    "iso2": "BB",
    "iso3": "BRB",
    "emoji": "🇧🇧"
  },
  {
    "name": "Belarus",
    "iso2": "BY",
    "iso3": "BLR",
    "emoji": "🇧🇾"
  },
  {
    "name": "Belgium",
    "iso2": "BE",
    "iso3": "BEL",
    "emoji": "🇧🇪"
  },
  {
    "name": "Belize",
    "iso2": "BZ",
    "iso3": "BLZ",
    "emoji": "🇧🇿"
  },
  {
    "name": "Benin",
    "iso2": "BJ",
    "iso3": "BEN",
    "emoji": "🇧🇯"
  },
  {
    "name": "Bermuda",
    "iso2": "BM",
    "iso3": "BMU",
    "emoji": "🇧🇲"
  },
  {
    "name": "Bhutan",
    "iso2": "BT",
    "iso3": "BTN",
    "emoji": "🇧🇹"
  },
  {
    "name": "Bolivia",
    "iso2": "BO",
    "iso3": "BOL",
    "emoji": "🇧🇴"
  },
  {
    "name": "Bonaire, Sint Eustatius and Saba",
    "iso2": "BQ",
    "iso3": "BES",
    "emoji": "🇧🇶"
  },
  {
    "name": "Bosnia and Herzegovina",
    "iso2": "BA",
    "iso3": "BIH",
    "emoji": "🇧🇦"
  },
  {
    "name": "Botswana",
    "iso2": "BW",
    "iso3": "BWA",
    "emoji": "🇧🇼"
  },
  {
    "name": "Bouvet Island",
    "iso2": "BV",
    "iso3": "BVT",
    "emoji": "🇧🇻"
  },
  {
    "name": "Brazil",
    "iso2": "BR",
    "iso3": "BRA",
    "emoji": "🇧🇷"
  },
  {
    "name": "British Indian Ocean Territory",
    "iso2": "IO",
    "iso3": "IOT",
    "emoji": "🇮🇴"
  },
  {
    "name": "Brunei",
    "iso2": "BN",
    "iso3": "BRN",
    "emoji": "🇧🇳"
  },
  {
    "name": "Bulgaria",
    "iso2": "BG",
    "iso3": "BGR",
    "emoji": "🇧🇬"
  },
  {
    "name": "Burkina Faso",
    "iso2": "BF",
    "iso3": "BFA",
    "emoji": "🇧🇫"
  },
  {
    "name": "Burundi",
    "iso2": "BI",
    "iso3": "BDI",
    "emoji": "🇧🇮"
  },
  {
    "name": "Cambodia",
    "iso2": "KH",
    "iso3": "KHM",
    "emoji": "🇰🇭"
  },
  {
    "name": "Cameroon",
    "iso2": "CM",
    "iso3": "CMR",
    "emoji": "🇨🇲"
  },
  {
    "name": "Canada",
    "iso2": "CA",
    "iso3": "CAN",
    "emoji": "🇨🇦"
  },
  {
    "name": "Cape Verde",
    "iso2": "CV",
    "iso3": "CPV",
    "emoji": "🇨🇻"
  },
  {
    "name": "Cayman Islands",
    "iso2": "KY",
    "iso3": "CYM",
    "emoji": "🇰🇾"
  },
  {
    "name": "Central African Republic",
    "iso2": "CF",
    "iso3": "CAF",
    "emoji": "🇨🇫"
  },
  {
    "name": "Chad",
    "iso2": "TD",
    "iso3": "TCD",
    "emoji": "🇹🇩"
  },
  {
    "name": "Chile",
    "iso2": "CL",
    "iso3": "CHL",
    "emoji": "🇨🇱"
  },
  {
    "name": "China",
    "iso2": "CN",
    "iso3": "CHN",
    "emoji": "🇨🇳"
  },
  {
    "name": "Christmas Island",
    "iso2": "CX",
    "iso3": "CXR",
    "emoji": "🇨🇽"
  },
  {
    "name": "Cocos (Keeling) Islands",
    "iso2": "CC",
    "iso3": "CCK",
    "emoji": "🇨🇨"
  },
  {
    "name": "Colombia",
    "iso2": "CO",
    "iso3": "COL",
    "emoji": "🇨🇴"
  },
  {
    "name": "Comoros",
    "iso2": "KM",
    "iso3": "COM",
    "emoji": "🇰🇲"
  },
  {
    "name": "Congo",
    "iso2": "CG",
    "iso3": "COG",
    "emoji": "🇨🇬"
  },
  {
    "name": "Cook Islands",
    "iso2": "CK",
    "iso3": "COK",
    "emoji": "🇨🇰"
  },
  {
    "name": "Costa Rica",
    "iso2": "CR",
    "iso3": "CRI",
    "emoji": "🇨🇷"
  },
  {
    "name": "Croatia",
    "iso2": "HR",
    "iso3": "HRV",
    "emoji": "🇭🇷"
  },
  {
    "name": "Cuba",
    "iso2": "CU",
    "iso3": "CUB",
    "emoji": "🇨🇺"
  },
  {
    "name": "Curaçao",
    "iso2": "CW",
    "iso3": "CUW",
    "emoji": "🇨🇼"
  },
  {
    "name": "Cyprus",
    "iso2": "CY",
    "iso3": "CYP",
    "emoji": "🇨🇾"
  },
  {
    "name": "Czech Republic",
    "iso2": "CZ",
    "iso3": "CZE",
    "emoji": "🇨🇿"
  },
  {
    "name": "Democratic Republic of the Congo",
    "iso2": "CD",
    "iso3": "COD",
    "emoji": "🇨🇩"
  },
  {
    "name": "Denmark",
    "iso2": "DK",
    "iso3": "DNK",
    "emoji": "🇩🇰"
  },
  {
    "name": "Djibouti",
    "iso2": "DJ",
    "iso3": "DJI",
    "emoji": "🇩🇯"
  },
  {
    "name": "Dominica",
    "iso2": "DM",
    "iso3": "DMA",
    "emoji": "🇩🇲"
  },
  {
    "name": "Dominican Republic",
    "iso2": "DO",
    "iso3": "DOM",
    "emoji": "🇩🇴"
  },
  {
    "name": "Ecuador",
    "iso2": "EC",
    "iso3": "ECU",
    "emoji": "🇪🇨"
  },
  {
    "name": "Egypt",
    "iso2": "EG",
    "iso3": "EGY",
    "emoji": "🇪🇬"
  },
  {
    "name": "El Salvador",
    "iso2": "SV",
    "iso3": "SLV",
    "emoji": "🇸🇻"
  },
  {
    "name": "Equatorial Guinea",
    "iso2": "GQ",
    "iso3": "GNQ",
    "emoji": "🇬🇶"
  },
  {
    "name": "Eritrea",
    "iso2": "ER",
    "iso3": "ERI",
    "emoji": "🇪🇷"
  },
  {
    "name": "Estonia",
    "iso2": "EE",
    "iso3": "EST",
    "emoji": "🇪🇪"
  },
  {
    "name": "Eswatini",
    "iso2": "SZ",
    "iso3": "SWZ",
    "emoji": "🇸🇿"
  },
  {
    "name": "Ethiopia",
    "iso2": "ET",
    "iso3": "ETH",
    "emoji": "🇪🇹"
  },
  {
    "name": "Falkland Islands",
    "iso2": "FK",
    "iso3": "FLK",
    "emoji": "🇫🇰"
  },
  {
    "name": "Faroe Islands",
    "iso2": "FO",
    "iso3": "FRO",
    "emoji": "🇫🇴"
  },
  {
    "name": "Fiji Islands",
    "iso2": "FJ",
    "iso3": "FJI",
    "emoji": "🇫🇯"
  },
  {
    "name": "Finland",
    "iso2": "FI",
    "iso3": "FIN",
    "emoji": "🇫🇮"
  },
  {
    "name": "France",
    "iso2": "FR",
    "iso3": "FRA",
    "emoji": "🇫🇷"
  },
  {
    "name": "French Guiana",
    "iso2": "GF",
    "iso3": "GUF",
    "emoji": "🇬🇫"
  },
  {
    "name": "French Polynesia",
    "iso2": "PF",
    "iso3": "PYF",
    "emoji": "🇵🇫"
  },
  {
    "name": "French Southern Territories",
    "iso2": "TF",
    "iso3": "ATF",
    "emoji": "🇹🇫"
  },
  {
    "name": "Gabon",
    "iso2": "GA",
    "iso3": "GAB",
    "emoji": "🇬🇦"
  },
  {
    "name": "Georgia",
    "iso2": "GE",
    "iso3": "GEO",
    "emoji": "🇬🇪"
  },
  {
    "name": "Germany",
    "iso2": "DE",
    "iso3": "DEU",
    "emoji": "🇩🇪"
  },
  {
    "name": "Ghana",
    "iso2": "GH",
    "iso3": "GHA",
    "emoji": "🇬🇭"
  },
  {
    "name": "Gibraltar",
    "iso2": "GI",
    "iso3": "GIB",
    "emoji": "🇬🇮"
  },
  {
    "name": "Greece",
    "iso2": "GR",
    "iso3": "GRC",
    "emoji": "🇬🇷"
  },
  {
    "name": "Greenland",
    "iso2": "GL",
    "iso3": "GRL",
    "emoji": "🇬🇱"
  },
  {
    "name": "Grenada",
    "iso2": "GD",
    "iso3": "GRD",
    "emoji": "🇬🇩"
  },
  {
    "name": "Guadeloupe",
    "iso2": "GP",
    "iso3": "GLP",
    "emoji": "🇬🇵"
  },
  {
    "name": "Guam",
    "iso2": "GU",
    "iso3": "GUM",
    "emoji": "🇬🇺"
  },
  {
    "name": "Guatemala",
    "iso2": "GT",
    "iso3": "GTM",
    "emoji": "🇬🇹"
  },
  {
    "name": "Guernsey",
    "iso2": "GG",
    "iso3": "GGY",
    "emoji": "🇬🇬"
  },
  {
    "name": "Guinea",
    "iso2": "GN",
    "iso3": "GIN",
    "emoji": "🇬🇳"
  },
  {
    "name": "Guinea-Bissau",
    "iso2": "GW",
    "iso3": "GNB",
    "emoji": "🇬🇼"
  },
  {
    "name": "Guyana",
    "iso2": "GY",
    "iso3": "GUY",
    "emoji": "🇬🇾"
  },
  {
    "name": "Haiti",
    "iso2": "HT",
    "iso3": "HTI",
    "emoji": "🇭🇹"
  },
  {
    "name": "Heard Island and McDonald Islands",
    "iso2": "HM",
    "iso3": "HMD",
    "emoji": "🇭🇲"
  },
  {
    "name": "Honduras",
    "iso2": "HN",
    "iso3": "HND",
    "emoji": "🇭🇳"
  },
  {
    "name": "Hong Kong S.A.R.",
    "iso2": "HK",
    "iso3": "HKG",
    "emoji": "🇭🇰"
  },
  {
    "name": "Hungary",
    "iso2": "HU",
    "iso3": "HUN",
    "emoji": "🇭🇺"
  },
  {
    "name": "Iceland",
    "iso2": "IS",
    "iso3": "ISL",
    "emoji": "🇮🇸"
  },
  {
    "name": "India",
    "iso2": "IN",
    "iso3": "IND",
    "emoji": "🇮🇳"
  },
  {
    "name": "Indonesia",
    "iso2": "ID",
    "iso3": "IDN",
    "emoji": "🇮🇩"
  },
  {
    "name": "Iran",
    "iso2": "IR",
    "iso3": "IRN",
    "emoji": "🇮🇷"
  },
  {
    "name": "Iraq",
    "iso2": "IQ",
    "iso3": "IRQ",
    "emoji": "🇮🇶"
  },
  {
    "name": "Ireland",
    "iso2": "IE",
    "iso3": "IRL",
    "emoji": "🇮🇪"
  },
  {
    "name": "Israel",
    "iso2": "IL",
    "iso3": "ISR",
    "emoji": "🇮🇱"
  },
  {
    "name": "Italy",
    "iso2": "IT",
    "iso3": "ITA",
    "emoji": "🇮🇹"
  },
  {
    "name": "Ivory Coast",
    "iso2": "CI",
    "iso3": "CIV",
    "emoji": "🇨🇮"
  },
  {
    "name": "Jamaica",
    "iso2": "JM",
    "iso3": "JAM",
    "emoji": "🇯🇲"
  },
  {
    "name": "Japan",
    "iso2": "JP",
    "iso3": "JPN",
    "emoji": "🇯🇵"
  },
  {
    "name": "Jersey",
    "iso2": "JE",
    "iso3": "JEY",
    "emoji": "🇯🇪"
  },
  {
    "name": "Jordan",
    "iso2": "JO",
    "iso3": "JOR",
    "emoji": "🇯🇴"
  },
  {
    "name": "Kazakhstan",
    "iso2": "KZ",
    "iso3": "KAZ",
    "emoji": "🇰🇿"
  },
  {
    "name": "Kenya",
    "iso2": "KE",
    "iso3": "KEN",
    "emoji": "🇰🇪"
  },
  {
    "name": "Kiribati",
    "iso2": "KI",
    "iso3": "KIR",
    "emoji": "🇰🇮"
  },
  {
    "name": "Kosovo",
    "iso2": "XK",
    "iso3": "XKX",
    "emoji": "🇽🇰"
  },
  {
    "name": "Kuwait",
    "iso2": "KW",
    "iso3": "KWT",
    "emoji": "🇰🇼"
  },
  {
    "name": "Kyrgyzstan",
    "iso2": "KG",
    "iso3": "KGZ",
    "emoji": "🇰🇬"
  },
  {
    "name": "Laos",
    "iso2": "LA",
    "iso3": "LAO",
    "emoji": "🇱🇦"
  },
  {
    "name": "Latvia",
    "iso2": "LV",
    "iso3": "LVA",
    "emoji": "🇱🇻"
  },
  {
    "name": "Lebanon",
    "iso2": "LB",
    "iso3": "LBN",
    "emoji": "🇱🇧"
  },
  {
    "name": "Lesotho",
    "iso2": "LS",
    "iso3": "LSO",
    "emoji": "🇱🇸"
  },
  {
    "name": "Liberia",
    "iso2": "LR",
    "iso3": "LBR",
    "emoji": "🇱🇷"
  },
  {
    "name": "Libya",
    "iso2": "LY",
    "iso3": "LBY",
    "emoji": "🇱🇾"
  },
  {
    "name": "Liechtenstein",
    "iso2": "LI",
    "iso3": "LIE",
    "emoji": "🇱🇮"
  },
  {
    "name": "Lithuania",
    "iso2": "LT",
    "iso3": "LTU",
    "emoji": "🇱🇹"
  },
  {
    "name": "Luxembourg",
    "iso2": "LU",
    "iso3": "LUX",
    "emoji": "🇱🇺"
  },
  {
    "name": "Macau S.A.R.",
    "iso2": "MO",
    "iso3": "MAC",
    "emoji": "🇲🇴"
  },
  {
    "name": "Madagascar",
    "iso2": "MG",
    "iso3": "MDG",
    "emoji": "🇲🇬"
  },
  {
    "name": "Malawi",
    "iso2": "MW",
    "iso3": "MWI",
    "emoji": "🇲🇼"
  },
  {
    "name": "Malaysia",
    "iso2": "MY",
    "iso3": "MYS",
    "emoji": "🇲🇾"
  },
  {
    "name": "Maldives",
    "iso2": "MV",
    "iso3": "MDV",
    "emoji": "🇲🇻"
  },
  {
    "name": "Mali",
    "iso2": "ML",
    "iso3": "MLI",
    "emoji": "🇲🇱"
  },
  {
    "name": "Malta",
    "iso2": "MT",
    "iso3": "MLT",
    "emoji": "🇲🇹"
  },
  {
    "name": "Man (Isle of)",
    "iso2": "IM",
    "iso3": "IMN",
    "emoji": "🇮🇲"
  },
  {
    "name": "Marshall Islands",
    "iso2": "MH",
    "iso3": "MHL",
    "emoji": "🇲🇭"
  },
  {
    "name": "Martinique",
    "iso2": "MQ",
    "iso3": "MTQ",
    "emoji": "🇲🇶"
  },
  {
    "name": "Mauritania",
    "iso2": "MR",
    "iso3": "MRT",
    "emoji": "🇲🇷"
  },
  {
    "name": "Mauritius",
    "iso2": "MU",
    "iso3": "MUS",
    "emoji": "🇲🇺"
  },
  {
    "name": "Mayotte",
    "iso2": "YT",
    "iso3": "MYT",
    "emoji": "🇾🇹"
  },
  {
    "name": "Mexico",
    "iso2": "MX",
    "iso3": "MEX",
    "emoji": "🇲🇽"
  },
  {
    "name": "Micronesia",
    "iso2": "FM",
    "iso3": "FSM",
    "emoji": "🇫🇲"
  },
  {
    "name": "Moldova",
    "iso2": "MD",
    "iso3": "MDA",
    "emoji": "🇲🇩"
  },
  {
    "name": "Monaco",
    "iso2": "MC",
    "iso3": "MCO",
    "emoji": "🇲🇨"
  },
  {
    "name": "Mongolia",
    "iso2": "MN",
    "iso3": "MNG",
    "emoji": "🇲🇳"
  },
  {
    "name": "Montenegro",
    "iso2": "ME",
    "iso3": "MNE",
    "emoji": "🇲🇪"
  },
  {
    "name": "Montserrat",
    "iso2": "MS",
    "iso3": "MSR",
    "emoji": "🇲🇸"
  },
  {
    "name": "Morocco",
    "iso2": "MA",
    "iso3": "MAR",
    "emoji": "🇲🇦"
  },
  {
    "name": "Mozambique",
    "iso2": "MZ",
    "iso3": "MOZ",
    "emoji": "🇲🇿"
  },
  {
    "name": "Myanmar",
    "iso2": "MM",
    "iso3": "MMR",
    "emoji": "🇲🇲"
  },
  {
    "name": "Namibia",
    "iso2": "NA",
    "iso3": "NAM",
    "emoji": "🇳🇦"
  },
  {
    "name": "Nauru",
    "iso2": "NR",
    "iso3": "NRU",
    "emoji": "🇳🇷"
  },
  {
    "name": "Nepal",
    "iso2": "NP",
    "iso3": "NPL",
    "emoji": "🇳🇵"
  },
  {
    "name": "Netherlands",
    "iso2": "NL",
    "iso3": "NLD",
    "emoji": "🇳🇱"
  },
  {
    "name": "New Caledonia",
    "iso2": "NC",
    "iso3": "NCL",
    "emoji": "🇳🇨"
  },
  {
    "name": "New Zealand",
    "iso2": "NZ",
    "iso3": "NZL",
    "emoji": "🇳🇿"
  },
  {
    "name": "Nicaragua",
    "iso2": "NI",
    "iso3": "NIC",
    "emoji": "🇳🇮"
  },
  {
    "name": "Niger",
    "iso2": "NE",
    "iso3": "NER",
    "emoji": "🇳🇪"
  },
  {
    "name": "Nigeria",
    "iso2": "NG",
    "iso3": "NGA",
    "emoji": "🇳🇬"
  },
  {
    "name": "Niue",
    "iso2": "NU",
    "iso3": "NIU",
    "emoji": "🇳🇺"
  },
  {
    "name": "Norfolk Island",
    "iso2": "NF",
    "iso3": "NFK",
    "emoji": "🇳🇫"
  },
  {
    "name": "North Korea",
    "iso2": "KP",
    "iso3": "PRK",
    "emoji": "🇰🇵"
  },
  {
    "name": "North Macedonia",
    "iso2": "MK",
    "iso3": "MKD",
    "emoji": "🇲🇰"
  },
  {
    "name": "Northern Mariana Islands",
    "iso2": "MP",
    "iso3": "MNP",
    "emoji": "🇲🇵"
  },
  {
    "name": "Norway",
    "iso2": "NO",
    "iso3": "NOR",
    "emoji": "🇳🇴"
  },
  {
    "name": "Oman",
    "iso2": "OM",
    "iso3": "OMN",
    "emoji": "🇴🇲"
  },
  {
    "name": "Pakistan",
    "iso2": "PK",
    "iso3": "PAK",
    "emoji": "🇵🇰"
  },
  {
    "name": "Palau",
    "iso2": "PW",
    "iso3": "PLW",
    "emoji": "🇵🇼"
  },
  {
    "name": "Palestinian Territory Occupied",
    "iso2": "PS",
    "iso3": "PSE",
    "emoji": "🇵🇸"
  },
  {
    "name": "Panama",
    "iso2": "PA",
    "iso3": "PAN",
    "emoji": "🇵🇦"
  },
  {
    "name": "Papua New Guinea",
    "iso2": "PG",
    "iso3": "PNG",
    "emoji": "🇵🇬"
  },
  {
    "name": "Paraguay",
    "iso2": "PY",
    "iso3": "PRY",
    "emoji": "🇵🇾"
  },
  {
    "name": "Peru",
    "iso2": "PE",
    "iso3": "PER",
    "emoji": "🇵🇪"
  },
  {
    "name": "Philippines",
    "iso2": "PH",
    "iso3": "PHL",
    "emoji": "🇵🇭"
  },
  {
    "name": "Pitcairn Island",
    "iso2": "PN",
    "iso3": "PCN",
    "emoji": "🇵🇳"
  },
  {
    "name": "Poland",
    "iso2": "PL",
    "iso3": "POL",
    "emoji": "🇵🇱"
  },
  {
    "name": "Portugal",
    "iso2": "PT",
    "iso3": "PRT",
    "emoji": "🇵🇹"
  },
  {
    "name": "Puerto Rico",
    "iso2": "PR",
    "iso3": "PRI",
    "emoji": "🇵🇷"
  },
  {
    "name": "Qatar",
    "iso2": "QA",
    "iso3": "QAT",
    "emoji": "🇶🇦"
  },
  {
    "name": "Reunion",
    "iso2": "RE",
    "iso3": "REU",
    "emoji": "🇷🇪"
  },
  {
    "name": "Romania",
    "iso2": "RO",
    "iso3": "ROU",
    "emoji": "🇷🇴"
  },
  {
    "name": "Russia",
    "iso2": "RU",
    "iso3": "RUS",
    "emoji": "🇷🇺"
  },
  {
    "name": "Rwanda",
    "iso2": "RW",
    "iso3": "RWA",
    "emoji": "🇷🇼"
  },
  {
    "name": "Saint Helena",
    "iso2": "SH",
    "iso3": "SHN",
    "emoji": "🇸🇭"
  },
  {
    "name": "Saint Kitts and Nevis",
    "iso2": "KN",
    "iso3": "KNA",
    "emoji": "🇰🇳"
  },
  {
    "name": "Saint Lucia",
    "iso2": "LC",
    "iso3": "LCA",
    "emoji": "🇱🇨"
  },
  {
    "name": "Saint Pierre and Miquelon",
    "iso2": "PM",
    "iso3": "SPM",
    "emoji": "🇵🇲"
  },
  {
    "name": "Saint Vincent and the Grenadines",
    "iso2": "VC",
    "iso3": "VCT",
    "emoji": "🇻🇨"
  },
  {
    "name": "Saint-Barthelemy",
    "iso2": "BL",
    "iso3": "BLM",
    "emoji": "🇧🇱"
  },
  {
    "name": "Saint-Martin (French part)",
    "iso2": "MF",
    "iso3": "MAF",
    "emoji": "🇲🇫"
  },
  {
    "name": "Samoa",
    "iso2": "WS",
    "iso3": "WSM",
    "emoji": "🇼🇸"
  },
  {
    "name": "San Marino",
    "iso2": "SM",
    "iso3": "SMR",
    "emoji": "🇸🇲"
  },
  {
    "name": "Sao Tome and Principe",
    "iso2": "ST",
    "iso3": "STP",
    "emoji": "🇸🇹"
  },
  {
    "name": "Saudi Arabia",
    "iso2": "SA",
    "iso3": "SAU",
    "emoji": "🇸🇦"
  },
  {
    "name": "Senegal",
    "iso2": "SN",
    "iso3": "SEN",
    "emoji": "🇸🇳"
  },
  {
    "name": "Serbia",
    "iso2": "RS",
    "iso3": "SRB",
    "emoji": "🇷🇸"
  },
  {
    "name": "Seychelles",
    "iso2": "SC",
    "iso3": "SYC",
    "emoji": "🇸🇨"
  },
  {
    "name": "Sierra Leone",
    "iso2": "SL",
    "iso3": "SLE",
    "emoji": "🇸🇱"
  },
  {
    "name": "Singapore",
    "iso2": "SG",
    "iso3": "SGP",
    "emoji": "🇸🇬"
  },
  {
    "name": "Sint Maarten (Dutch part)",
    "iso2": "SX",
    "iso3": "SXM",
    "emoji": "🇸🇽"
  },
  {
    "name": "Slovakia",
    "iso2": "SK",
    "iso3": "SVK",
    "emoji": "🇸🇰"
  },
  {
    "name": "Slovenia",
    "iso2": "SI",
    "iso3": "SVN",
    "emoji": "🇸🇮"
  },
  {
    "name": "Solomon Islands",
    "iso2": "SB",
    "iso3": "SLB",
    "emoji": "🇸🇧"
  },
  {
    "name": "Somalia",
    "iso2": "SO",
    "iso3": "SOM",
    "emoji": "🇸🇴"
  },
  {
    "name": "South Africa",
    "iso2": "ZA",
    "iso3": "ZAF",
    "emoji": "🇿🇦"
  },
  {
    "name": "South Georgia",
    "iso2": "GS",
    "iso3": "SGS",
    "emoji": "🇬🇸"
  },
  {
    "name": "South Korea",
    "iso2": "KR",
    "iso3": "KOR",
    "emoji": "🇰🇷"
  },
  {
    "name": "South Sudan",
    "iso2": "SS",
    "iso3": "SSD",
    "emoji": "🇸🇸"
  },
  {
    "name": "Spain",
    "iso2": "ES",
    "iso3": "ESP",
    "emoji": "🇪🇸"
  },
  {
    "name": "Sri Lanka",
    "iso2": "LK",
    "iso3": "LKA",
    "emoji": "🇱🇰"
  },
  {
    "name": "Sudan",
    "iso2": "SD",
    "iso3": "SDN",
    "emoji": "🇸🇩"
  },
  {
    "name": "Suriname",
    "iso2": "SR",
    "iso3": "SUR",
    "emoji": "🇸🇷"
  },
  {
    "name": "Svalbard and Jan Mayen Islands",
    "iso2": "SJ",
    "iso3": "SJM",
    "emoji": "🇸🇯"
  },
  {
    "name": "Sweden",
    "iso2": "SE",
    "iso3": "SWE",
    "emoji": "🇸🇪"
  },
  {
    "name": "Switzerland",
    "iso2": "CH",
    "iso3": "CHE",
    "emoji": "🇨🇭"
  },
  {
    "name": "Syria",
    "iso2": "SY",
    "iso3": "SYR",
    "emoji": "🇸🇾"
  },
  {
    "name": "Taiwan",
    "iso2": "TW",
    "iso3": "TWN",
    "emoji": "🇹🇼"
  },
  {
    "name": "Tajikistan",
    "iso2": "TJ",
    "iso3": "TJK",
    "emoji": "🇹🇯"
  },
  {
    "name": "Tanzania",
    "iso2": "TZ",
    "iso3": "TZA",
    "emoji": "🇹🇿"
  },
  {
    "name": "Thailand",
    "iso2": "TH",
    "iso3": "THA",
    "emoji": "🇹🇭"
  },
  {
    "name": "The Bahamas",
    "iso2": "BS",
    "iso3": "BHS",
    "emoji": "🇧🇸"
  },
  {
    "name": "The Gambia",
    "iso2": "GM",
    "iso3": "GMB",
    "emoji": "🇬🇲"
  },
  {
    "name": "Timor-Leste",
    "iso2": "TL",
    "iso3": "TLS",
    "emoji": "🇹🇱"
  },
  {
    "name": "Togo",
    "iso2": "TG",
    "iso3": "TGO",
    "emoji": "🇹🇬"
  },
  {
    "name": "Tokelau",
    "iso2": "TK",
    "iso3": "TKL",
    "emoji": "🇹🇰"
  },
  {
    "name": "Tonga",
    "iso2": "TO",
    "iso3": "TON",
    "emoji": "🇹🇴"
  },
  {
    "name": "Trinidad and Tobago",
    "iso2": "TT",
    "iso3": "TTO",
    "emoji": "🇹🇹"
  },
  {
    "name": "Tunisia",
    "iso2": "TN",
    "iso3": "TUN",
    "emoji": "🇹🇳"
  },
  {
    "name": "Turkey",
    "iso2": "TR",
    "iso3": "TUR",
    "emoji": "🇹🇷"
  },
  {
    "name": "Turkmenistan",
    "iso2": "TM",
    "iso3": "TKM",
    "emoji": "🇹🇲"
  },
  {
    "name": "Turks and Caicos Islands",
    "iso2": "TC",
    "iso3": "TCA",
    "emoji": "🇹🇨"
  },
  {
    "name": "Tuvalu",
    "iso2": "TV",
    "iso3": "TUV",
    "emoji": "🇹🇻"
  },
  {
    "name": "Uganda",
    "iso2": "UG",
    "iso3": "UGA",
    "emoji": "🇺🇬"
  },
  {
    "name": "Ukraine",
    "iso2": "UA",
    "iso3": "UKR",
    "emoji": "🇺🇦"
  },
  {
    "name": "United Arab Emirates",
    "iso2": "AE",
    "iso3": "ARE",
    "emoji": "🇦🇪"
  },
  {
    "name": "United Kingdom",
    "iso2": "GB",
    "iso3": "GBR",
    "emoji": "🇬🇧"
  },
  {
    "name": "United States",
    "iso2": "US",
    "iso3": "USA",
    "emoji": "🇺🇸"
  },
  {
    "name": "United States Minor Outlying Islands",
    "iso2": "UM",
    "iso3": "UMI",
    "emoji": "🇺🇲"
  },
  {
    "name": "Uruguay",
    "iso2": "UY",
    "iso3": "URY",
    "emoji": "🇺🇾"
  },
  {
    "name": "Uzbekistan",
    "iso2": "UZ",
    "iso3": "UZB",
    "emoji": "🇺🇿"
  },
  {
    "name": "Vanuatu",
    "iso2": "VU",
    "iso3": "VUT",
    "emoji": "🇻🇺"
  },
  {
    "name": "Vatican City State (Holy See)",
    "iso2": "VA",
    "iso3": "VAT",
    "emoji": "🇻🇦"
  },
  {
    "name": "Venezuela",
    "iso2": "VE",
    "iso3": "VEN",
    "emoji": "🇻🇪"
  },
  {
    "name": "Vietnam",
    "iso2": "VN",
    "iso3": "VNM",
    "emoji": "🇻🇳"
  },
  {
    "name": "Virgin Islands (British)",
    "iso2": "VG",
    "iso3": "VGB",
    "emoji": "🇻🇬"
  },
  {
    "name": "Virgin Islands (US)",
    "iso2": "VI",
    "iso3": "VIR",
    "emoji": "🇻🇮"
  },
  {
    "name": "Wallis and Futuna Islands",
    "iso2": "WF",
    "iso3": "WLF",
    "emoji": "🇼🇫"
  },
  {
    "name": "Western Sahara",
    "iso2": "EH",
    "iso3": "ESH",
    "emoji": "🇪🇭"
  },
  {
    "name": "Yemen",
    "iso2": "YE",
    "iso3": "YEM",
    "emoji": "🇾🇪"
  },
  {
    "name": "Zambia",
    "iso2": "ZM",
    "iso3": "ZMB",
    "emoji": "🇿🇲"
  },
  {
    "name": "Zimbabwe",
    "iso2": "ZW",
    "iso3": "ZWE",
    "emoji": "🇿🇼"
  }
];
