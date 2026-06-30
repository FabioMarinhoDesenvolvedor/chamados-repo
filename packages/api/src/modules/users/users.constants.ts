// Custo (work factor) do bcrypt. 12 é o padrão recomendado atual; hashes antigos
// (custo menor) continuam validando — só os novos usam este valor.
export const BCRYPT_ROUNDS = 12;
