/**
 * Validação das regras do cadastro em etapas.
 * Rodar com: bun run scripts/signup.test.ts
 */
import { errorMessage } from "../src/lib/error-messages";
import {
  SIGNUP_STEPS,
  firstNameOf,
  isValidEmail,
  nextStepIndex,
  passwordScore,
  stepForSignupError,
  strengthLabel,
  validateStep,
} from "../src/lib/signup";

const results: string[] = [];
function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  results.push(`${ok ? "PASS" : "FAIL"} — ${name}${ok ? "" : ` (esperado ${JSON.stringify(expected)}, obtido ${JSON.stringify(actual)})`}`);
  if (!ok) process.exitCode = 1;
}

check("são poucas etapas (4, com a foto opcional por último)", [SIGNUP_STEPS.length, SIGNUP_STEPS.join(",")], [4, "name,email,password,photo"]);

check("e-mails válidos", ["a@b.co", "  maria.silva+x@gmail.com  ", "joao@empresa.com.br"].map(isValidEmail), [true, true, true]);
check("e-mails inválidos", ["", "abc", "a@b", "a@b.", "a b@c.com", "@c.com", "a@@c.com"].map(isValidEmail), [false, false, false, false, false, false, false]);

check("primeiro nome", [firstNameOf("  Maria  Souza "), firstNameOf("João"), firstNameOf("")], ["Maria", "João", ""]);
check("primeiro nome ganha inicial maiúscula (inclusive com acento)", [firstNameOf("maria souza"), firstNameOf("érica"), firstNameOf("JOÃO")], ["Maria", "Érica", "JOÃO"]);

check("senha curta pontua 0", passwordScore("abc"), 0);
check("8 caracteres pontua 1", passwordScore("abcdefgh"), 1);
check("12 caracteres pontua 2", passwordScore("abcdefghijkl"), 2);
check("misturada e longa pontua 4", passwordScore("Abcdefgh1234!"), 4);
check("rótulos da força", [strengthLabel(""), strengthLabel("abc"), strengthLabel("abcdefgh"), strengthLabel("Abcdefgh1234!")], ["", "Muito curta", "Fraca", "Forte"]);

check("nome: vazio e 1 letra recusados, 2 letras aceitas", [validateStep("name", { name: "", email: "", password: "" }), validateStep("name", { name: " A ", email: "", password: "" }), validateStep("name", { name: "Jo", email: "", password: "" })], ["Conta pra gente o seu nome.", "Conta pra gente o seu nome.", null]);
check("e-mail: erro e ok", [validateStep("email", { name: "", email: "x", password: "" }), validateStep("email", { name: "", email: "x@y.com", password: "" })], ["Esse e-mail não parece certo.", null]);
check("senha: 7 recusada, 8 aceita", [validateStep("password", { name: "", email: "", password: "1234567" }), validateStep("password", { name: "", email: "", password: "12345678" })], ["A senha precisa ter pelo menos 8 caracteres.", null]);
check("foto nunca bloqueia", validateStep("photo", { name: "", email: "", password: "" }), null);

// "Continuar" depois de voltar pra corrigir: vai direto até onde a pessoa tinha chegado
const ok = { name: "Maria", email: "maria@exemplo.com", password: "12345678" };
check("avanço normal: vai pra próxima etapa", [nextStepIndex(0, 0, ok), nextStepIndex(1, 1, ok), nextStepIndex(2, 2, ok)], [1, 2, 3]);
check("corrigiu o e-mail (etapa 1) tendo chegado na foto (3): pula direto pra foto", nextStepIndex(1, 3, ok), 3);
check("corrigiu o nome (etapa 0) tendo chegado na foto: pula direto pra foto", nextStepIndex(0, 3, ok), 3);
check("corrigiu a senha (etapa 2) tendo chegado na foto: vai pra foto", nextStepIndex(2, 3, ok), 3);
check("tinha chegado só na senha (2) e voltou ao nome: para na senha", nextStepIndex(0, 2, ok), 2);
check("etapa do meio inválida: para nela em vez de pular", nextStepIndex(0, 3, { ...ok, email: "ruim" }), 1);
check("senha do meio inválida: para na senha", nextStepIndex(1, 3, { ...ok, password: "123" }), 2);
check("nunca passa da última etapa", nextStepIndex(1, 99, ok), 3);

// erro na criação da conta -> volta pra etapa certa (usando as mensagens REAIS já traduzidas)
const msg = (raw: string) => errorMessage(new Error(raw));
check("e-mail já cadastrado volta pro e-mail", stepForSignupError(msg("User already registered")), "email");
check("e-mail temporário (gatilho do banco) volta pro e-mail", stepForSignupError(msg("Database error saving new user")), "email");
check("e-mail inválido volta pro e-mail", stepForSignupError(msg("Unable to validate email address: invalid format")), "email");
check("senha fraca volta pra senha", stepForSignupError(msg("Password is known to be weak and easy to guess")), "password");
check("senha curta volta pra senha", stepForSignupError(msg("Password should be at least 6 characters.")), "password");
check("sem internet não volta pra lugar nenhum", stepForSignupError(msg("Failed to fetch")), null);
check("muitas tentativas não volta pra lugar nenhum", stepForSignupError(msg("For security purposes, you can only request this after 45 seconds.")), null);

console.log(results.join("\n"));
