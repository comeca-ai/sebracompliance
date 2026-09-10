export type OcrEnv = {
  KIMI_API_KEY?: string;
  KIMI_BASE_URL?: string;
  KIMI_MODEL?: string;
};

const DEFAULT_BASE =
  "https://ws-1pvp9wq6k8pv0n4t.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1";
const DEFAULT_MODEL = "kimi-k3";
const MAX_BYTES = 3_500_000;

const SYSTEM = `Você é o agente de compliance da Unidade de Integridade do SEBRAE/RO.
Leia o documento. Se for imagem, faça OCR. Extraia só o que está escrito.
Não invente CNPJ, prazo, cláusula ou norma.
Responda APENAS um JSON, sem markdown:
{"texto":"transcrição","cnpj":null,"contrato":null,"obrigacoes":[{"clausula":"...","prazo":null,"norma":null}],"ressalvas":"..."}
Português. Saída da IA não cadastra sozinha. Humano decide.`;

function parseJson(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return { texto: text, obrigacoes: [], ressalvas: "JSON não estruturado." };
  try {
    return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
  } catch {
    return { texto: text, obrigacoes: [], ressalvas: "Falha ao ler JSON da IA." };
  }
}

export async function lerDocumento(
  env: OcrEnv,
  input: { filename: string; mime: string; data: string },
): Promise<Response> {
  const key = env.KIMI_API_KEY;
  if (!key) {
    return Response.json(
      { error: "KIMI_API_KEY não configurada neste Worker.", demo: true },
      { status: 503 },
    );
  }
  const raw = input.data.includes(",") ? input.data.split(",").pop() ?? "" : input.data;
  let bytes: Uint8Array;
  try {
    const bin = atob(raw);
    bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch {
    return Response.json({ error: "Base64 inválido." }, { status: 400 });
  }
  if (bytes.byteLength > MAX_BYTES) {
    return Response.json({ error: "Arquivo acima de 3,5 MB." }, { status: 413 });
  }
  const mime = (input.mime || "application/octet-stream").toLowerCase();
  const image = mime.startsWith("image/");
  const textish = mime.startsWith("text/") || mime === "application/json";
  const content: unknown[] = [{ type: "text", text: `Arquivo: ${input.filename} (${mime}).` }];
  if (image) {
    content.push({
      type: "image_url",
      image_url: { url: `data:${mime};base64,${raw}` },
    });
  } else if (textish) {
    content.push({ type: "text", text: new TextDecoder("utf-8", { fatal: false }).decode(bytes).slice(0, 24000) });
  } else if (mime === "application/pdf") {
    content.push({
      type: "text",
      text:
        "PDF binário. Se não houver texto abaixo, peça ao usuário um PNG/JPG da página. Tentativa de leitura UTF-8:\n" +
        new TextDecoder("utf-8", { fatal: false }).decode(bytes).replace(/[^\x09\x0a\x0d\x20-\x7e\u00a0-\u024f]/g, " ").slice(0, 8000),
    });
  } else {
    return Response.json(
      { error: "Envie PNG, JPG, WEBP, TXT ou PDF. DOCX não entra nesta PoC." },
      { status: 415 },
    );
  }

  const base = (env.KIMI_BASE_URL || DEFAULT_BASE).replace(/\/+$/, "");
  const model = env.KIMI_MODEL || DEFAULT_MODEL;
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      enable_thinking: false,
      max_tokens: 1800,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content },
      ],
    }),
  });
  const payload = (await res.json()) as {
    error?: { message?: string };
    model?: string;
    usage?: unknown;
    choices?: { message?: { content?: string } }[];
  };
  if (!res.ok) {
    return Response.json(
      { error: payload.error?.message || "Kimi recusou a leitura.", status: res.status },
      { status: 502 },
    );
  }
  const text = payload.choices?.[0]?.message?.content ?? "";
  const extracted = parseJson(text);
  return Response.json({
    demo: true,
    modelo: payload.model || model,
    provedor: "Kimi · Alibaba MaaS · espaço comercial",
    arquivo: input.filename,
    mime,
    uso: payload.usage ?? null,
    ...extracted,
    aviso: "IA sugere. Humano decide. Arquivo saiu do tenant para a API Kimi (Singapura).",
  });
}
