declare module "*.json" {
  const value: {
    CONTRATOS: unknown[];
    TERCEIROS: unknown[];
    NORMAS: unknown[];
    GRUPOS: unknown[];
    contagem: { total: number; real: number; parcial: number; simulado: number; fora: number };
  };
  export default value;
}
