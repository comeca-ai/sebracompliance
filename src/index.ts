import page from "./app.html";
import data from "./data.json";

type Env = { ASSETS?: Fetcher };

const jsonHeaders: Record<string, string> = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "cache-control": "no-store",
};

const htmlHeaders: Record<string, string> = {
  "content-type": "text/html; charset=utf-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "x-frame-options": "DENY",
  "content-security-policy":
    "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self' 'unsafe-inline'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: jsonHeaders });
}

const OPENAPI = {
  openapi: "3.0.3",
  info: {
    title: "sebracompliance",
    version: "0.2.0",
    description: "PoC Fase 1 — Mesa de Integridade SEBRAE/RO. Amostra DEMO.",
  },
  paths: {
    "/health": { get: { summary: "Liveness" } },
    "/api/contratos": { get: { summary: "Amostra de contratos" } },
    "/api/terceiros": { get: { summary: "Screening mínimo" } },
    "/api/normas": { get: { summary: "Catálogo normativo" } },
    "/api/seguranca": { get: { summary: "Itens de segurança do TR" } },
    "/api/controles": { get: { summary: "Catálogo de controles internos" } },
    "/api/tarefas": { get: { summary: "Tarefas geradas por cláusula" } },
  },
};

export default {
  async fetch(request: Request, _env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: jsonHeaders });
    }

    if (path === "/health") {
      return json({
        ok: true,
        service: "sebracompliance",
        fase: "1",
        tenant: "SEBRAE/RO",
        demo: true,
      });
    }

    if (path === "/openapi.json") return json(OPENAPI);

    if (path === "/api/contratos") {
      return json({ demo: true, total: data.CONTRATOS.length, data: data.CONTRATOS });
    }
    if (path === "/api/terceiros") {
      return json({ demo: true, fontes: ["Portal da Transparência", "OpenSanctions", "sanções federais"], data: data.TERCEIROS });
    }
    if (path === "/api/normas") {
      return json({ demo: true, data: data.NORMAS });
    }
    if (path === "/api/controles") {
      return json({ demo: true, data: (data as { CONTROLES?: unknown[] }).CONTROLES ?? [] });
    }
    if (path === "/api/tarefas") {
      return json({ demo: true, data: (data as { TAREFAS?: unknown[] }).TAREFAS ?? [] });
    }
    if (path === "/api/seguranca") {
      return json({ demo: true, fonte: "Termo de Referência SEBRAE/RO, 18/08/2026", ...data.contagem, grupos: data.GRUPOS });
    }

    if (
      path === "/" ||
      path === "/integridade" ||
      path === "/painel" ||
      path === "/terceiros" ||
      path === "/canal" ||
      path === "/controles" ||
      path === "/tarefas" ||
      path === "/relatorio" ||
      path === "/seguranca"
    ) {
      return new Response(page, { status: 200, headers: htmlHeaders });
    }

    return json({ error: "Rota não encontrada" }, 404);
  },
};
