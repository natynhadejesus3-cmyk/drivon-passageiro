/**
 * Compartilhar o motorista com um amigo: o link do QR tem que ser o MESMO convite que o app já entende
 * (baixar o app e já entrar com o motorista).
 * Rodar com: bun run scripts/share-driver.test.ts
 */
import { driverFirstName, driverShareMessage, driverShareUrl, formatPhone, telUrl, whatsappUrl } from "../src/lib/share-driver";
import { SITE_URL, buildOpenAppUrl, parseInviteCode } from "../src/lib/invite";

const results: string[] = [];
let total = 0;
let passed = 0;
function check(name: string, actual: unknown, expected: unknown) {
  total++;
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) passed++;
  results.push(`${ok ? "PASS" : "FAIL"} — ${name}${ok ? "" : ` (esperado ${JSON.stringify(expected)}, obtido ${JSON.stringify(actual)})`}`);
  if (!ok) process.exitCode = 1;
}

const CODE = "AB3D9FGHJK";

// --- o link do QR ---
check("o link é o convite do app (?p=CODIGO)", driverShareUrl(CODE), `${SITE_URL}?p=${CODE}`);
check("o app consegue ler o código de volta do link (ida e volta)", parseInviteCode(driverShareUrl(CODE)), CODE);
check("código em minúsculas também vira link válido", driverShareUrl("ab3d9fghjk"), `${SITE_URL}?p=${CODE}`);
check("código inválido não vira link (sem QR quebrado)", driverShareUrl("123"), null);
check("sem código não vira link", driverShareUrl(null), null);
check("código com letras proibidas (0, O, 1, I, L) não vira link", driverShareUrl("O0I1LAB3D9"), null);
check("o botão 'Abrir no app' do convite entende o mesmo código", buildOpenAppUrl(CODE).includes(`://p/${CODE}`), true);

// --- nome ---
check("primeiro nome", driverFirstName("Maria da Silva"), "Maria");
check("nome com espaços sobrando", driverFirstName("   João   Pedro "), "João");
check("sem nome", driverFirstName(null), "o motorista");
check("nome vazio", driverFirstName("   "), "o motorista");

// --- mensagem para mandar ---
{
  const url = driverShareUrl(CODE)!;
  const m = driverShareMessage("Maria da Silva", url);
  check("mensagem cita o primeiro nome", m.startsWith("Conheça Maria, meu motorista no Drivon!"), true);
  check("mensagem leva o link do convite", m.endsWith(url), true);
  check("mensagem explica o que acontece", m.includes("baixe o app e já entre com ele"), true);
  check("sem nome a mensagem continua certa", driverShareMessage(null, url).startsWith("Conheça o meu motorista no Drivon!"), true);
}

// --- telefone / WhatsApp ---
check("telefone com 11 dígitos ganha o 55", whatsappUrl("(74) 99999-8888"), "https://wa.me/5574999998888");
check("telefone com 10 dígitos (fixo) ganha o 55", whatsappUrl("74 3525-1234"), "https://wa.me/557435251234");
check("já com 55 não duplica", whatsappUrl("+55 74 99999-8888"), "https://wa.me/5574999998888");
check("zero na frente do DDD é ignorado", whatsappUrl("074999998888"), "https://wa.me/5574999998888");
check("telefone curto demais não vira link", whatsappUrl("9999-888"), null);
check("sem telefone não vira link", whatsappUrl(null), null);
check("texto sem número não vira link", whatsappUrl("não tenho"), null);
check("ligar usa o +55", telUrl("74999998888"), "tel:+5574999998888");
check("formata celular", formatPhone("74999998888"), "(74) 99999-8888");
check("formata fixo", formatPhone("7435251234"), "(74) 3525-1234");
check("formata celular que veio com 55", formatPhone("+55 (74) 99999-8888"), "(74) 99999-8888");
check("o que não dá para formatar volta como veio", formatPhone(" abc "), "abc");

console.log(results.join("\n"));
console.log(`\n${passed}/${total} verificações passaram`);
