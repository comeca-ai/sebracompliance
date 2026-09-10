import page from "./app.html";
import data from "./data.json";
import { lerDocumento, type OcrEnv } from "./ocr";

type Env = OcrEnv & { ASSETS?: Fetcher };

const jsonHeaders: Record<string, string> = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "content-type",
  "access-control-allow-methods": "GET,POST,OPTIONS",
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
    version: "0.3.0",
    description: "PoC Fase 1 — Mesa de Integridade SEBRAE/RO. Amostra DEMO. OCR Kimi.",
  },
  paths: {
    "/health": { get: { summary: "Liveness" } },
    "/api/contratos": { get: { summary: "Amostra de contratos" } },
    "/api/terceiros": { get: { summary: "Screening mínimo" } },
    "/api/normas": { get: { summary: "Catálogo normativo" } },
    "/api/seguranca": { get: { summary: "Itens de segurança do TR" } },
    "/api/controles": { get: { summary: "Catálogo de controles internos" } },
    "/api/tarefas": { get: { summary: "Tarefas geradas por cláusula" } },
    "/api/cobertura": { get: { summary: "Módulos restantes do TR e dossiê do edital" } },
    "/api/ocr": { post: { summary: "Leitura e OCR de documento via Kimi" } },
  },
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
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
        kimi: Boolean(env.KIMI_API_KEY),
      });
    }

    if (path === "/openapi.json") return json(OPENAPI);

    if (path === "/api/ocr" && request.method === "POST") {
      const body = (await request.json().catch(() => null)) as
        | { filename?: string; mime?: string; data?: string }
        | null;
      if (!body?.data || !body.filename) {
        return json({ error: "Envie filename, mime e data (base64)." }, 400);
      }
      const res = await lerDocumento(env, {
        filename: body.filename,
        mime: body.mime || "application/octet-stream",
        data: body.data,
      });
      const headers = new Headers(res.headers);
      for (const [k, v] of Object.entries(jsonHeaders)) headers.set(k, v);
      return new Response(res.body, { status: res.status, headers });
    }

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
    if (path === "/api/cobertura") {
      const d = data as Record<string, unknown>;
      return json({
        demo: true,
        data: {
          TITULARES: d.TITULARES,
          ROPA: d.ROPA,
          PROCESSOS: d.PROCESSOS,
          MEMBROS: d.MEMBROS,
          COLABORADORES: d.COLABORADORES,
          EVENTOS: d.EVENTOS,
          SISTEMAS: d.SISTEMAS,
          COBERTURA: d.COBERTURA,
          EDITAL: d.EDITAL,
        },
      });
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
      path === "/edital" ||
      path === "/integracoes" ||
      path === "/organizacoes" ||
      path === "/juridico" ||
      path === "/privacidade" ||
      path === "/documentos" ||
      path === "/relatorio" ||
      path === "/seguranca"
    ) {
      return new Response(page, { status: 200, headers: htmlHeaders });
    }

    return json({ error: "Rota não encontrada" }, 404);
  },
};
