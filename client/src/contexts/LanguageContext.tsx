import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Locale = "pt" | "en" | "es";

export const localeLabels: Record<Locale, string> = {
  pt: "PT",
  en: "EN",
  es: "ES",
};

const STORAGE_KEY = "xavier-locale";

const messages = {
  pt: {
    common: {
      session: "VALIDANDO SESSÃO",
      logout: "SAIR",
      cockpit: "COCKPIT",
      loading: "CARREGANDO...",
      cancel: "Cancelar",
      copy: "Copiar link",
      copied: "Link copiado",
      connected: "CONECTADO",
      disconnect: "Desconectar",
      language: "Idioma",
    },
    login: {
      eyebrow: "INTELIGÊNCIA SOBERANA",
      heroLead: "Seu cérebro pessoal de Inteligência Soberana.",
      heroTagline: "Sua inteligência. Sua memória. Seu controle.",
      title: "XAVIER",
      subtitle: "Sistema inteligente operacional da NowGo AI",
      signIn: "Entrar",
      createAccount: "Criar conta",
      email: "E-mail",
      password: "Senha",
      displayName: "Nome de exibição",
      emailPlaceholder: "seu@email.com",
      passwordPlaceholder: "Sua senha",
      namePlaceholder: "Como o Xavier deve chamar você?",
      submitSignIn: "Entrar no Xavier",
      submitSignUp: "Criar minha conta",
      signingIn: "ENTRANDO...",
      signingUp: "CRIANDO...",
      confirmation: "Conta criada. Confirme o e-mail enviado para continuar.",
      forgotPassword: "Esqueceu sua senha?",
      resetUnavailable: "A recuperação de senha será feita pelo ambiente central da NowGo AI.",
      authUnavailable: "Autenticação indisponível no momento.",
      genericError: "Não foi possível concluir a autenticação.",
      redirectedSignup: "Você será encaminhado para o ambiente central de cadastro da NowGo AI.",
    },
    home: {
      monitor: "MONITOR DO SISTEMA",
      memory: "MEMÓRIA",
      telegram: "TELEGRAM",
      closeSession: "Encerrar sessão",
      active: "ATIVO",
      process: "PROC",
      os: "SO",
      aiCore: "NÚCLEO IA\nATIVO",
      security: "SEG\nLIBERADA",
      activity: "REGISTRO DE ATIVIDADE",
      generatedFiles: "ARQUIVOS GERADOS",
      download: "Baixar",
      uploadFile: "ENVIAR ARQUIVO",
      command: "COMANDO",
      fileReady: "Diga ao XAVIER o que fazer com {file}",
      noFile: "Nenhum arquivo carregado — arraste ou clique acima",
      commandPlaceholder: "Digite um comando ou pergunta…",
      microphoneMuted: "MICROFONE SILENCIADO",
      microphoneActive: "MICROFONE ATIVO",
      fullscreen: "TELA CHEIA",
      shortcuts: "[F4] Silenciar  ·  [F11] Tela Cheia",
      confidential: "CONFIDENCIAL",
      poweredBy: "POWERED BY NOWGO AI",
      assistantSubtitle: "Sistema Inteligente Operacional · NowGo AI",
      setupOnline: "Sistema inicializado. XAVIER online.",
      wakeWord: "Modo wake-word ativo — diga 'Ei XAVIER' antes do comando.",
      microphoneOff: "Microfone silenciado.",
      microphoneOn: "Microfone ativo.",
      fileLoaded: "ARQ: {file} ({size}) carregado",
      fileReadyToSend: "SYS: Pronto — pergunte algo sobre {file} ou pressione ▸ para enviar",
      fileReadError: "SYS: Erro ao ler arquivo — {error}",
      sourceLookup: "SYS: consultando fontes ({sources})...",
      pdfGenerated: "SYS: PDF gerado — {file}",
      attachment: "[anexo: {file}]",
      attachmentGeneric: "[anexo]",
      you: "Você",
      xavier: "Xavier",
      systemCode: "SYS",
      error: "Erro",
    },
    telegram: {
      eyebrow: "CANAL TELEGRAM",
      title: "Seu canal Telegram",
      description: "Conecte sua conta ao bot oficial do Xavier. A vinculação é individual e seus dados permanecem isolados.",
      connectTitle: "Vincular ao bot oficial",
      connectDescription: "Escaneie o QR Code ou abra o link abaixo. O Telegram abrirá o bot oficial; toque em Iniciar e sua conta será vinculada automaticamente.",
      generateCode: "Gerar código de vinculação",
      generatingCode: "GERANDO CÓDIGO...",
      openBot: "Abrir bot oficial",
      scanToOpen: "Escaneie para abrir",
      copyCode: "Copiar código",
      codeCopied: "Código copiado",
      codeExpires: "O código expira em poucos minutos e pode ser usado uma única vez.",
      linked: "Sua conta está vinculada ao bot oficial Xavier.",
      chatId: "Chat Telegram vinculado",
      webhook: "Webhook ativo para o bot oficial.",
      pending: "PENDÊNCIAS TELEGRAM",
      lastVerification: "ÚLTIMA VERIFICAÇÃO",
      unlink: "Desvincular Telegram",
      unlinkConfirm: "Desvincular o Telegram desta conta? O histórico permanecerá associado à sua conta.",
      connectError: "Não foi possível iniciar a vinculação Telegram.",
      statusError: "Não foi possível consultar a conexão Telegram.",
      unlinked: "Telegram desvinculado. Seu histórico permanece associado à conta.",
      setupTitle: "Como conectar",
      setupStep1: "Abra o bot oficial do Xavier no Telegram.",
      setupStep2: "Gere o vínculo nesta página para receber seu QR Code e link seguro.",
      setupStep3: "Escaneie o QR Code ou abra o link e toque em Iniciar. A confirmação será automática.",
      officialBot: "Bot oficial",
      noToken: "Nenhum token é solicitado ou armazenado pelo usuário.",
      memoryTitle: "Memória e custo",
      memoryDescription: "O Xavier mantém contexto econômico por conta, aplica limites de uso e não guarda áudio bruto.",
    },
    setup: {
      title: "XAVIER — INICIALIZAÇÃO",
      subtitle: "Configure sua interface antes de ativar o XAVIER",
      io: "ENTRADA / SAÍDA",
      voice: "VOZ DO XAVIER (alto-falantes)",
      microphone: "MICROFONE (reconhecimento de voz)",
      enabled: "ATIVADA",
      disabled: "DESATIVADA",
      enabledMasculine: "ATIVADO",
      disabledMasculine: "DESATIVADO",
      honorific: "COMO O XAVIER DEVE TRATAR VOCÊ?",
      sir: "SENHOR",
      madam: "SENHORA",
      honorificNote: "O XAVIER aplicará o tratamento escolhido em todas as respostas e na concordância.",
      activation: "ATIVAÇÃO POR VOZ",
      continuous: "CONTÍNUA",
      wakeword: "WAKE-WORD: 'EI XAVIER'",
      wakewordNote: "O XAVIER só processará comandos que comecem com 'XAVIER' ou 'Ei XAVIER'. Útil em ambientes com conversa de fundo (gabinete, reuniões).",
      continuousNote: "Tudo que o microfone captar vai ser enviado ao XAVIER. Recomendado em ambiente silencioso.",
      browserNote: "O idioma segue a escolha feita no login. Ao ativar, o navegador poderá pedir permissão para o microfone.",
      activate: "ATIVAR XAVIER",
    },
    location: {
      title: "LOCALIZAÇÃO DO BRIEFING",
      country: "País",
      state: "Estado / Província",
      city: "Cidade",
      selectCountry: "Selecione o país",
      selectState: "Informe o estado ou província",
      selectCity: "Informe a cidade",
      saved: "Localização salva nesta sessão.",
      briefingTitle: "BRIEFING SOCIAL",
      sync: "SINCRONIZANDO...",
      collecting: "Coletando menções recentes no X...",
      error: "ERRO",
      complaints: "TOP RECLAMAÇÕES",
      praises: "TOP ELOGIOS / O QUE DÁ CERTO",
      noData: "Nenhum sinal social disponível para esta localização.",
      updatedAt: "Atualizado às {time}",
      topicGeneral: "GERAL",
      topicHealth: "SAÚDE",
      topicSecurity: "SEGURANÇA",
      topicMobility: "MOBILIDADE",
      topicEducation: "EDUCAÇÃO",
    },
    memory: {
      title: "Memória do Xavier",
      description: "Revise e controle o contexto persistente associado à sua conta.",
    },
  },
  en: {
    common: {
      session: "VALIDATING SESSION",
      logout: "SIGN OUT",
      cockpit: "COCKPIT",
      loading: "LOADING...",
      cancel: "Cancel",
      copy: "Copy link",
      copied: "Link copied",
      connected: "CONNECTED",
      disconnect: "Disconnect",
      language: "Language",
    },
    login: {
      eyebrow: "SOVEREIGN INTELLIGENCE",
      heroLead: "Your personal brain of Sovereign Intelligence.",
      heroTagline: "Your intelligence. Your memory. Your control.",
      title: "XAVIER",
      subtitle: "NowGo AI operational intelligence system",
      signIn: "Sign in",
      createAccount: "Create account",
      email: "Email",
      password: "Password",
      displayName: "Display name",
      emailPlaceholder: "you@email.com",
      passwordPlaceholder: "Your password",
      namePlaceholder: "How should Xavier address you?",
      submitSignIn: "Enter Xavier",
      submitSignUp: "Create my account",
      signingIn: "SIGNING IN...",
      signingUp: "CREATING...",
      confirmation: "Account created. Confirm the email we sent to continue.",
      forgotPassword: "Forgot your password?",
      resetUnavailable: "Password recovery will be handled by the central NowGo AI environment.",
      authUnavailable: "Authentication is currently unavailable.",
      genericError: "We could not complete authentication.",
      redirectedSignup: "You will be redirected to the central NowGo AI signup environment.",
    },
    home: {
      monitor: "SYSTEM MONITOR",
      memory: "MEMORY",
      telegram: "TELEGRAM",
      closeSession: "End session",
      active: "ACTIVE",
      process: "PROC",
      os: "OS",
      aiCore: "AI CORE\nACTIVE",
      security: "SEC\nCLEARED",
      activity: "ACTIVITY LOG",
      generatedFiles: "GENERATED FILES",
      download: "Download",
      uploadFile: "UPLOAD FILE",
      command: "COMMAND",
      fileReady: "Tell XAVIER what to do with {file}",
      noFile: "No file loaded — drag or click above",
      commandPlaceholder: "Type a command or question…",
      microphoneMuted: "MICROPHONE MUTED",
      microphoneActive: "MICROPHONE ACTIVE",
      fullscreen: "FULL SCREEN",
      shortcuts: "[F4] Mute  ·  [F11] Full screen",
      confidential: "CONFIDENTIAL",
      poweredBy: "POWERED BY NOWGO AI",
      assistantSubtitle: "Operational Intelligence System · NowGo AI",
      setupOnline: "System initialized. XAVIER online.",
      wakeWord: "Wake-word mode active — say 'Hey XAVIER' before the command.",
      microphoneOff: "Microphone muted.",
      microphoneOn: "Microphone active.",
      fileLoaded: "FILE: {file} ({size}) loaded",
      fileReadyToSend: "SYS: Ready — ask something about {file} or press ▸ to send",
      fileReadError: "SYS: File read error — {error}",
      sourceLookup: "SYS: consulting sources ({sources})...",
      pdfGenerated: "SYS: PDF generated — {file}",
      attachment: "[attachment: {file}]",
      attachmentGeneric: "[attachment]",
      you: "You",
      xavier: "Xavier",
      systemCode: "SYS",
      error: "Error",
    },
    telegram: {
      eyebrow: "TELEGRAM CHANNEL",
      title: "Your Telegram channel",
      description: "Link your account to Xavier's official bot. The link is individual and your data stays isolated.",
      connectTitle: "Link to the official bot",
      connectDescription: "Scan the QR Code or open the link below. Telegram will open the official bot; tap Start and your account will be linked automatically.",
      generateCode: "Generate link code",
      generatingCode: "GENERATING CODE...",
      openBot: "Open official bot",
      scanToOpen: "Scan to open",
      copyCode: "Copy code",
      codeCopied: "Code copied",
      codeExpires: "The code expires in a few minutes and can be used only once.",
      linked: "Your account is linked to the official Xavier bot.",
      chatId: "Linked Telegram chat",
      webhook: "Webhook active for the official bot.",
      pending: "TELEGRAM PENDING",
      lastVerification: "LAST VERIFICATION",
      unlink: "Unlink Telegram",
      unlinkConfirm: "Unlink Telegram from this account? History will remain associated with your account.",
      connectError: "Could not start Telegram linking.",
      statusError: "Could not read the Telegram connection.",
      unlinked: "Telegram unlinked. Your history remains associated with the account.",
      setupTitle: "How to connect",
      setupStep1: "Open Xavier's official bot in Telegram.",
      setupStep2: "Generate the link here to receive your secure QR Code and link.",
      setupStep3: "Scan the QR Code or open the link and tap Start. Confirmation is automatic.",
      officialBot: "Official bot",
      noToken: "No token is requested or stored from the user.",
      memoryTitle: "Memory and cost",
      memoryDescription: "Xavier keeps economical context per account, applies usage limits and does not retain raw audio.",
    },
    setup: {
      title: "XAVIER — INITIALIZATION",
      subtitle: "Configure your interface before activating XAVIER",
      io: "INPUT / OUTPUT",
      voice: "XAVIER VOICE (speakers)",
      microphone: "MICROPHONE (voice recognition)",
      enabled: "ENABLED",
      disabled: "DISABLED",
      enabledMasculine: "ENABLED",
      disabledMasculine: "DISABLED",
      honorific: "HOW SHOULD XAVIER ADDRESS YOU?",
      sir: "SIR",
      madam: "MA'AM",
      honorificNote: "XAVIER will use the selected form of address in responses and agreement.",
      activation: "VOICE ACTIVATION",
      continuous: "CONTINUOUS",
      wakeword: "WAKE-WORD: 'HEY XAVIER'",
      wakewordNote: "XAVIER will process only commands beginning with 'XAVIER' or 'Hey XAVIER'. Useful in rooms with background conversation.",
      continuousNote: "Everything captured by the microphone will be sent to XAVIER. Recommended in quiet environments.",
      browserNote: "The language follows the choice made at login. When activated, your browser may request microphone permission.",
      activate: "ACTIVATE XAVIER",
    },
    location: {
      title: "BRIEFING LOCATION",
      country: "Country",
      state: "State / Province",
      city: "City",
      selectCountry: "Select country",
      selectState: "Enter state or province",
      selectCity: "Enter city",
      saved: "Location saved for this session.",
      briefingTitle: "SOCIAL BRIEFING",
      sync: "SYNCING...",
      collecting: "Collecting recent mentions on X...",
      error: "ERROR",
      complaints: "TOP COMPLAINTS",
      praises: "TOP PRAISE / WHAT IS WORKING",
      noData: "No social signal available for this location.",
      updatedAt: "Updated at {time}",
      topicGeneral: "GENERAL",
      topicHealth: "HEALTH",
      topicSecurity: "SECURITY",
      topicMobility: "MOBILITY",
      topicEducation: "EDUCATION",
    },
    memory: {
      title: "Xavier memory",
      description: "Review and control the persistent context associated with your account.",
    },
  },
  es: {
    common: {
      session: "VALIDANDO SESIÓN",
      logout: "SALIR",
      cockpit: "COCKPIT",
      loading: "CARGANDO...",
      cancel: "Cancelar",
      copy: "Copiar enlace",
      copied: "Enlace copiado",
      connected: "CONECTADO",
      disconnect: "Desconectar",
      language: "Idioma",
    },
    login: {
      eyebrow: "INTELIGENCIA SOBERANA",
      heroLead: "Tu cerebro personal de Inteligencia Soberana.",
      heroTagline: "Tu inteligencia. Tu memoria. Tu control.",
      title: "XAVIER",
      subtitle: "Sistema inteligente operacional de NowGo AI",
      signIn: "Entrar",
      createAccount: "Crear cuenta",
      email: "Correo electrónico",
      password: "Contraseña",
      displayName: "Nombre visible",
      emailPlaceholder: "tu@email.com",
      passwordPlaceholder: "Tu contraseña",
      namePlaceholder: "¿Cómo debe llamarte Xavier?",
      submitSignIn: "Entrar en Xavier",
      submitSignUp: "Crear mi cuenta",
      signingIn: "ENTRANDO...",
      signingUp: "CREANDO...",
      confirmation: "Cuenta creada. Confirma el correo que enviamos para continuar.",
      forgotPassword: "¿Olvidaste tu contraseña?",
      resetUnavailable: "La recuperación de contraseña se realizará en el entorno central de NowGo AI.",
      authUnavailable: "La autenticación no está disponible en este momento.",
      genericError: "No fue posible completar la autenticación.",
      redirectedSignup: "Serás enviado al entorno central de registro de NowGo AI.",
    },
    home: {
      monitor: "MONITOR DEL SISTEMA",
      memory: "MEMORIA",
      telegram: "TELEGRAM",
      closeSession: "Cerrar sesión",
      active: "ACTIVO",
      process: "PROC",
      os: "SO",
      aiCore: "NÚCLEO IA\nACTIVO",
      security: "SEG\nLIBERADA",
      activity: "REGISTRO DE ACTIVIDAD",
      generatedFiles: "ARCHIVOS GENERADOS",
      download: "Descargar",
      uploadFile: "ENVIAR ARCHIVO",
      command: "COMANDO",
      fileReady: "Dile a XAVIER qué hacer con {file}",
      noFile: "Ningún archivo cargado — arrastra o haz clic arriba",
      commandPlaceholder: "Escribe un comando o pregunta…",
      microphoneMuted: "MICRÓFONO SILENCIADO",
      microphoneActive: "MICRÓFONO ACTIVO",
      fullscreen: "PANTALLA COMPLETA",
      shortcuts: "[F4] Silenciar  ·  [F11] Pantalla completa",
      confidential: "CONFIDENCIAL",
      poweredBy: "POWERED BY NOWGO AI",
      assistantSubtitle: "Sistema Inteligente Operacional · NowGo AI",
      setupOnline: "Sistema inicializado. XAVIER online.",
      wakeWord: "Modo wake-word activo — di 'Hola XAVIER' antes del comando.",
      microphoneOff: "Micrófono silenciado.",
      microphoneOn: "Micrófono activo.",
      fileLoaded: "ARCH: {file} ({size}) cargado",
      fileReadyToSend: "SYS: Listo — pregunta algo sobre {file} o pulsa ▸ para enviar",
      fileReadError: "SYS: Error al leer archivo — {error}",
      sourceLookup: "SYS: consultando fuentes ({sources})...",
      pdfGenerated: "SYS: PDF generado — {file}",
      attachment: "[adjunto: {file}]",
      attachmentGeneric: "[adjunto]",
      you: "Tú",
      xavier: "Xavier",
      systemCode: "SYS",
      error: "Error",
    },
    telegram: {
      eyebrow: "CANAL TELEGRAM",
      title: "Tu canal Telegram",
      description: "Vincula tu cuenta al bot oficial de Xavier. La vinculación es individual y tus datos permanecen aislados.",
      connectTitle: "Vincular al bot oficial",
      connectDescription: "Escanea el código QR o abre el enlace. Telegram abrirá el bot oficial; toca Iniciar y tu cuenta se vinculará automáticamente.",
      generateCode: "Generar código de vinculación",
      generatingCode: "GENERANDO CÓDIGO...",
      openBot: "Abrir bot oficial",
      scanToOpen: "Escanea para abrir",
      copyCode: "Copiar código",
      codeCopied: "Código copiado",
      codeExpires: "El código caduca en pocos minutos y solo puede usarse una vez.",
      linked: "Tu cuenta está vinculada al bot oficial Xavier.",
      chatId: "Chat Telegram vinculado",
      webhook: "Webhook activo para el bot oficial.",
      pending: "PENDIENTES TELEGRAM",
      lastVerification: "ÚLTIMA VERIFICACIÓN",
      unlink: "Desvincular Telegram",
      unlinkConfirm: "¿Desvincular Telegram de esta cuenta? El historial seguirá asociado a tu cuenta.",
      connectError: "No fue posible iniciar la vinculación Telegram.",
      statusError: "No fue posible consultar la conexión Telegram.",
      unlinked: "Telegram desvinculado. Tu historial permanece asociado a la cuenta.",
      setupTitle: "Cómo conectar",
      setupStep1: "Abre el bot oficial de Xavier en Telegram.",
      setupStep2: "Genera el vínculo aquí para recibir tu código QR y enlace seguro.",
      setupStep3: "Escanea el código QR o abre el enlace y toca Iniciar. La confirmación es automática.",
      officialBot: "Bot oficial",
      noToken: "No se solicita ni almacena ningún token del usuario.",
      memoryTitle: "Memoria y coste",
      memoryDescription: "Xavier mantiene contexto económico por cuenta, aplica límites de uso y no guarda audio bruto.",
    },
    setup: {
      title: "XAVIER — INICIALIZACIÓN",
      subtitle: "Configura tu interfaz antes de activar XAVIER",
      io: "ENTRADA / SALIDA",
      voice: "VOZ DE XAVIER (altavoces)",
      microphone: "MICRÓFONO (reconocimiento de voz)",
      enabled: "ACTIVADA",
      disabled: "DESACTIVADA",
      enabledMasculine: "ACTIVADO",
      disabledMasculine: "DESACTIVADO",
      honorific: "¿CÓMO DEBE TRATARTE XAVIER?",
      sir: "SEÑOR",
      madam: "SEÑORA",
      honorificNote: "XAVIER aplicará el tratamiento elegido en todas las respuestas y concordancias.",
      activation: "ACTIVACIÓN POR VOZ",
      continuous: "CONTINUA",
      wakeword: "WAKE-WORD: 'HOLA XAVIER'",
      wakewordNote: "XAVIER solo procesará comandos que comiencen con 'XAVIER' o 'Hola XAVIER'. Útil en ambientes con conversaciones de fondo.",
      continuousNote: "Todo lo que capte el micrófono se enviará a XAVIER. Recomendado en ambientes silenciosos.",
      browserNote: "El idioma sigue la elección hecha al iniciar sesión. Al activar, el navegador puede solicitar permiso para el micrófono.",
      activate: "ACTIVAR XAVIER",
    },
    location: {
      title: "UBICACIÓN DEL BRIEFING",
      country: "País",
      state: "Estado / Provincia",
      city: "Ciudad",
      selectCountry: "Selecciona el país",
      selectState: "Indica el estado o provincia",
      selectCity: "Indica la ciudad",
      saved: "Ubicación guardada en esta sesión.",
      briefingTitle: "BRIEFING SOCIAL",
      sync: "SINCRONIZANDO...",
      collecting: "Recopilando menciones recientes en X...",
      error: "ERROR",
      complaints: "PRINCIPALES QUEJAS",
      praises: "PRINCIPALES ELOGIOS / LO QUE FUNCIONA",
      noData: "No hay señales sociales disponibles para esta ubicación.",
      updatedAt: "Actualizado a las {time}",
      topicGeneral: "GENERAL",
      topicHealth: "SALUD",
      topicSecurity: "SEGURIDAD",
      topicMobility: "MOVILIDAD",
      topicEducation: "EDUCACIÓN",
    },
    memory: {
      title: "Memoria de Xavier",
      description: "Revisa y controla el contexto persistente asociado a tu cuenta.",
    },
  },
} as const;

type MessageTree = typeof messages.pt;
export type MessageKey =
  | `common.${keyof MessageTree["common"] & string}`
  | `login.${keyof MessageTree["login"] & string}`
  | `home.${keyof MessageTree["home"] & string}`
  | `setup.${keyof MessageTree["setup"] & string}`
  | `telegram.${keyof MessageTree["telegram"] & string}`
  | `location.${keyof MessageTree["location"] & string}`
  | `memory.${keyof MessageTree["memory"] & string}`;

function detectInitialLocale(): Locale {
  if (typeof window === "undefined") return "pt";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === "pt" || stored === "en" || stored === "es") return stored;
  const language = window.navigator.language.toLowerCase();
  if (language.startsWith("en")) return "en";
  if (language.startsWith("es")) return "es";
  return "pt";
}

function interpolate(value: string, vars?: Record<string, string | number>): string {
  if (!vars) return value;
  return value.replace(/\{(\w+)\}/g, (_, key: string) => String(vars[key] ?? `{${key}}`));
}

interface LanguageContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
  locales: readonly Locale[];
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectInitialLocale);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, locale);
    document.documentElement.lang = locale === "pt" ? "pt-BR" : locale;
  }, [locale]);

  const value = useMemo<LanguageContextValue>(() => ({
    locale,
    locales: ["pt", "en", "es"],
    setLocale: setLocaleState,
    t(key, vars) {
      const [namespace, item] = key.split(".") as [keyof MessageTree, string];
      const source = messages[locale][namespace] as Record<string, string>;
      const fallback = messages.pt[namespace] as Record<string, string>;
      return interpolate(source[item] || fallback[item] || key, vars);
    },
  }), [locale]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage(): LanguageContextValue {
  const value = useContext(LanguageContext);
  if (!value) throw new Error("useLanguage deve ser usado dentro de LanguageProvider");
  return value;
}

export function LanguageSelector({ compact = false }: { compact?: boolean }) {
  const { locale, locales, setLocale } = useLanguage();
  return (
    <div className={compact ? "flex items-center gap-1" : "flex items-center gap-2"} aria-label="Language selector">
      {!compact && <span className="text-[9px] uppercase tracking-[0.16em] text-[#3a8a9a]">{localeLabels[locale]}</span>}
      {locales.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => setLocale(item)}
          aria-pressed={locale === item}
          className="border px-2 py-1 text-[9px] font-semibold tracking-[0.12em] transition"
          style={{
            borderColor: locale === item ? "#00d4ff" : "#0d3347",
            color: locale === item ? "#d8f8ff" : "#5ab8cc",
            background: locale === item ? "#001f2e" : "transparent",
          }}
        >
          {localeLabels[item]}
        </button>
      ))}
    </div>
  );
}

export { messages };
