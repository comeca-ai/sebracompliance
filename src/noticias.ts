export type Noticia = {
  titulo: string;
  fonte: string;
  data: string;
  url: string;
  adversa: boolean;
};

const UA = "sebracompliance/0.3 (SEBRAE-RO PoC; news-rss)";
const ADVERSA =
  /\b(fraude|corrup|sanc|conden|investiga|lavagem|propina|inidone|pris[aã]o|improbidad|desvio|peculato|cartel|suborno|concuss[aã]o|licita[cç]|opera[cç][aã]o\s+polo|ceis|cnep)\b/i;

function decode(s: string) {
  return s
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/&/g, "&")
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tag(block: string, name: string) {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m ? decode(m[1]) : "";
}

function fold(s: string) {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

export async function buscarNoticias(q: string, limit = 15): Promise<{
  demo: true;
  fonte: string;
  query: string;
  total: number;
  adversas: number;
  itens: Noticia[];
}> {
  const query = q.trim().slice(0, 180) || "SEBRAE Rondônia";
  const rss = new URL("https://news.google.com/rss/search");
  rss.searchParams.set("q", query);
  rss.searchParams.set("hl", "pt-BR");
  rss.searchParams.set("gl", "BR");
  rss.searchParams.set("ceid", "BR:pt-419");

  const res = await fetch(rss.toString(), {
    headers: { Accept: "application/rss+xml, application/xml, text/xml", "User-Agent": UA },
    cf: { cacheTtl: 900, cacheEverything: true },
  } as RequestInit);

  if (!res.ok) {
    throw new Error(`Google News RSS ${res.status}`);
  }
  const xml = await res.text();
  const blocks = xml.split("<item>").slice(1);
  const itens: Noticia[] = [];
  for (const b of blocks) {
    const titulo = tag(b, "title");
    const url = tag(b, "link");
    if (!titulo || !url) continue;
    const fonte = tag(b, "source") || titulo.split(" - ").slice(-1)[0] || "Google Notícias";
    const data = tag(b, "pubDate");
    itens.push({
      titulo,
      fonte,
      data,
      url,
      adversa: ADVERSA.test(fold(titulo)),
    });
    if (itens.length >= limit) break;
  }
  return {
    demo: true,
    fonte: "Google Notícias RSS · busca no Worker Cloudflare",
    query,
    total: itens.length,
    adversas: itens.filter((i) => i.adversa).length,
    itens,
  };
}
