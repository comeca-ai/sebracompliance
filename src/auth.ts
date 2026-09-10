export type Identity = { email: string; name: string };

type AccessCtx = ExecutionContext & {
  access?: { getIdentity?: () => Promise<{ email?: string; name?: string } | null | undefined> };
};

export async function identidade(request: Request, ctx: AccessCtx): Promise<Identity | null> {
  try {
    const id = await ctx.access?.getIdentity?.();
    if (id?.email) return { email: id.email.toLowerCase(), name: id.name || "" };
  } catch {
    /* Access pode não ter corrido no wrangler local */
  }
  const email = request.headers.get("Cf-Access-Authenticated-User-Email");
  if (email) return { email: email.toLowerCase(), name: "" };
  return null;
}

export type Acervo = {
  documentos: unknown[];
  regras: unknown[];
};

export async function lerAcervo(kv: KVNamespace, email: string): Promise<Acervo> {
  const raw = await kv.get(`acervo:${email.toLowerCase()}`);
  if (!raw) return { documentos: [], regras: [] };
  try {
    const p = JSON.parse(raw) as Acervo;
    return {
      documentos: Array.isArray(p.documentos) ? p.documentos : [],
      regras: Array.isArray(p.regras) ? p.regras : [],
    };
  } catch {
    return { documentos: [], regras: [] };
  }
}

export async function gravarAcervo(kv: KVNamespace, email: string, body: Acervo) {
  await kv.put(
    `acervo:${email.toLowerCase()}`,
    JSON.stringify({
      documentos: Array.isArray(body.documentos) ? body.documentos : [],
      regras: Array.isArray(body.regras) ? body.regras : [],
    }),
  );
}
