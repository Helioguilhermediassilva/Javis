import path from "node:path";
import { defineConfig, type Plugin, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";

/**
 * Plugin Vite para servir as APIs do JARVIS no dev server.
 * Em produção (Vercel) as mesmas funções rodam como serverless em /api/*.
 */
function vitePluginJavisApi(): Plugin {
  const proxyPath = path.resolve(import.meta.dirname, "server", "jarvisProxy.ts");
  const dfPath = path.resolve(import.meta.dirname, "server", "dfDataProxy.ts");
  const grokPath = path.resolve(import.meta.dirname, "server", "grokProxy.ts");

  type Handler = (req: unknown, res: unknown) => Promise<void> | void;

  function attach(server: ViteDevServer, route: string, method: string, modulePath: string, exportName: string) {
    server.middlewares.use(route, async (req, res, next) => {
      if (req.method !== method) return next();
      // Connect monta por prefixo: evite que /api/jarvis/chat capture /api/jarvis/chat/stream
      if (route === "/api/jarvis/chat" && req.url && req.url.startsWith("/stream")) return next();
      try {
        const mod = (await server.ssrLoadModule(modulePath)) as Record<string, Handler>;
        const handler = mod[exportName];
        if (!handler) throw new Error(`Handler ${exportName} não encontrado em ${modulePath}`);
        await handler(req, res);
      } catch (e) {
        if (!res.headersSent) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: `Proxy error: ${(e as Error).message}` }));
        }
      }
    });
  }

  return {
    name: "javis-api",
    configureServer(server) {
      // SSE primeiro para evitar shadowing
      attach(server, "/api/jarvis/chat/stream", "POST", proxyPath, "handleJarvisChatStream");
      attach(server, "/api/jarvis/chat", "POST", proxyPath, "handleJarvisChat");
      attach(server, "/api/jarvis/tts", "POST", proxyPath, "handleJarvisTts");
      attach(server, "/api/df/topics", "GET", dfPath, "handleDfTopics");
      attach(server, "/api/df/search", "GET", dfPath, "handleDfSearch");
      attach(server, "/api/df/dataset", "GET", dfPath, "handleDfDataset");
      attach(server, "/api/grok/sentiment", "POST", grokPath, "handleGrokSentiment");
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), jsxLocPlugin(), vitePluginJavisApi()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist"),
    emptyOutDir: true,
  },
  server: {
    port: 3000,
    strictPort: false,
    host: true,
  },
});
