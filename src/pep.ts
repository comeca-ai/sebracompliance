import { buscarNoticias, type Noticia } from "./noticias";

export type Socio = {
  nome: string;
  qualificacao: string;
  entrada?: string;
  pep: boolean;
  fonte: string;
  detalhe: string;
};

export type FluxoPep = {
  demo: boolean;
  etapa: string[];
  cnpj: string;
  razao: string;
  situacao: string;
  origem_qsa: string;
  socios: Socio[];
  pep_count: number;
  noticias: Noticia[];
  score: number;
  recomendacao: "limpo" | "sinalizado" | "bloqueado";
  aviso: string;
};

const UA = "sebracompliance/0.4 (SEBRAE-RO PoC; qsa-pep)";

const DEMO: Record<
  string,
  { razao: string; situacao: string; socios: Omit<Socio, "pep" | "fonte" | "detalhe">[]; pep: Record<string, string> }
> = {
  "12345678000190": {
    razao: "Logística Norte Ltda",
    situacao: "ATIVA",
    socios: [
      { nome: "M. A. Lima", qualificacao: "Sócio-administrador", entrada: "2019-03-12" },
      { nome: "R. S. Costa", qualificacao: "Sócio", entrada: "2021-08-01" },
    ],
    pep: {
      "M. A. Lima": "Hit DEMO em base pública de PEP: ocupante de cargo no executivo estadual nos últimos 5 anos.",
    },
  },
  "23456789000101": {
    razao: "Oficina Clara Consultoria",
    situacao: "ATIVA",
    socios: [{ nome: "C. M. Oliveira", qualificacao: "Titular", entrada: "2018-02-10" }],
    pep: {},
  },
  "56789012000134": {
    razao: "Peças e Serviços Madeira ME",
    situacao: "ATIVA",
    socios: [{ nome: "A. F. Madeira", qualificacao: "Titular", entrada: "2016-11-20" }],
    pep: {},
  },
  "45678901000123": {
    razao: "Circuito Porto Velho Eventos",
    situacao: "ATIVA",
    socios: [
      { nome: "P. H. Campos", qualificacao: "Sócio-administrador", entrada: "2022-01-15" },
      { nome: "L. B. Souza", qualificacao: "Sócio", entrada: "2022-01-15" },
    ],
    pep: {},
  },
  "78901234000156": {
    razao: "Rio Madeira Transportes",
    situacao: "ATIVA",
    socios: [
      { nome: "J. P. Nunes", qualificacao: "Sócio-administrador", entrada: "2026-08-20" },
      { nome: "E. T. Ramos", qualificacao: "Sócio", entrada: "2017-05-04" },
    ],
    pep: {},
  },
};

function digits(cnpj: string) {
  return cnpj.replace(/\D/g, "").slice(0, 14);
}

function fold(s: string) {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

const PEP_NEWS =
  /\b(pep|pessoa exposta|deputad|senador|ministro|governador|prefeit|vereador|secretario de estado|cargo em comiss)\b/i;

function recomendar(pepCount: number, adversas: number): FluxoPep["recomendacao"] {
  if (pepCount > 0 || adversas > 1) return "sinalizado";
  if (adversas === 1) return "sinalizado";
  return "limpo";
}

function scoreOf(pepCount: number, adversas: number, socios: number) {
  let s = 12;
  s += pepCount * 28;
  s += Math.min(30, adversas * 10);
  if (socios === 0) s += 8;
  return Math.min(99, s);
}

async function qsaPublico(cnpj: string): Promise<{ razao: string; situacao: string; socios: Socio[]; origem: string } | null> {
  const url = `https://brasilapi.com.br/api/cnpj/v1/${cnpj}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": UA },
    cf: { cacheTtl: 21600, cacheEverything: true },
  } as RequestInit);
  if (!res.ok) return null;
  const d = (await res.json()) as {
    message?: string;
    razao_social?: string;
    descricao_situacao_cadastral?: string;
    qsa?: { nome_socio?: string; qualificacao_socio?: string; data_entrada_sociedade?: string }[];
  };
  if (d.message || !d.razao_social) return null;
  const socios: Socio[] = (d.qsa ?? []).slice(0, 12).map((s) => ({
    nome: s.nome_socio || "não informado",
    qualificacao: s.qualificacao_socio || "sócio",
    entrada: s.data_entrada_sociedade,
    pep: false,
    fonte: "BrasilAPI / Receita (QSA)",
    detalhe: "Sem hit PEP nesta PoC. Humano confirma.",
  }));
  return {
    razao: d.razao_social,
    situacao: d.descricao_situacao_cadastral || "—",
    socios,
    origem: "BrasilAPI · QSA da Receita, cache no Worker",
  };
}

export async function fluxoPep(cnpjRaw: string): Promise<FluxoPep> {
  const cnpj = digits(cnpjRaw);
  if (cnpj.length !== 14) {
    throw new Error("CNPJ precisa de 14 dígitos.");
  }

  const demo = DEMO[cnpj];
  let razao: string;
  let situacao: string;
  let origem: string;
  let socios: Socio[];
  let isDemo = false;

  if (demo) {
    isDemo = true;
    razao = demo.razao;
    situacao = demo.situacao;
    origem = "Amostra DEMO da Fase 1 (CNPJ fictício)";
    socios = demo.socios.map((s) => {
      const hit = demo.pep[s.nome];
      return {
        ...s,
        pep: Boolean(hit),
        fonte: hit ? "Base pública de PEP (DEMO)" : "Sem hit na amostra",
        detalhe: hit || "Sócio sem hit PEP na amostra. Investigado não é condenado.",
      };
    });
  } else {
    const pub = await qsaPublico(cnpj);
    if (!pub) {
      throw new Error("CNPJ não encontrado na consulta pública de QSA.");
    }
    razao = pub.razao;
    situacao = pub.situacao;
    origem = pub.origem;
    socios = pub.socios;
  }

  const nomes = socios.map((s) => s.nome).filter((n) => n.length > 3).slice(0, 4);
  const newsQ = nomes.length
    ? nomes.map((n) => `"${n}"`).join(" OR ") + " (PEP OR deputado OR senador OR ministro)"
    : `"${razao}" PEP`;
  let noticias: Noticia[] = [];
  try {
    const pack = await buscarNoticias(newsQ, 8);
    noticias = pack.itens;
  } catch {
    noticias = [];
  }

  for (const s of socios) {
    if (s.pep) continue;
    const fn = fold(s.nome);
    const hitNews = noticias.find((n) => fold(n.titulo).includes(fn.split(" ")[0] || "___") && PEP_NEWS.test(fold(n.titulo)));
    if (hitNews) {
      s.pep = true;
      s.fonte = "Google Notícias · clipping PEP";
      s.detalhe = `Notícia: ${hitNews.titulo}. Clipping não é decisão. Humano classifica.`;
    }
  }

  const pepCount = socios.filter((s) => s.pep).length;
  const adversas = noticias.filter((n) => n.adversa || PEP_NEWS.test(fold(n.titulo))).length;
  const rec = recomendar(pepCount, adversas);

  return {
    demo: isDemo,
    etapa: ["Identificar", "QSA", "PEP / mídia", "HITL", "Registro"],
    cnpj,
    razao,
    situacao,
    origem_qsa: origem,
    socios,
    pep_count: pepCount,
    noticias,
    score: scoreOf(pepCount, adversas, socios.length),
    recomendacao: rec,
    aviso:
      "IA e bases públicas sugerem. Hit PEP não é condenação. Sócio de empresa da amostra DEMO não é pessoa real. Decisão cadastral exige humano.",
  };
}
