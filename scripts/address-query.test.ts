/**
 * Validação do preparo do texto de busca de endereço (abreviações, número da casa, acentos).
 * Rodar com: bun run scripts/address-query.test.ts
 */
import { accentPattern, attachNumber, expandAbbreviations, planQuery, splitHouseNumber } from "../src/lib/services/address-query";

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

// --- abreviações ---
check("Av. vira Avenida", expandAbbreviations("Av. Rio Branco"), "Avenida Rio Branco");
check("R. vira Rua", expandAbbreviations("R. Humberto de Campos"), "Rua Humberto de Campos");
check("Pç vira Praça", expandAbbreviations("Pç Rui Barbosa"), "Praça Rui Barbosa");
check("Trav. vira Travessa", expandAbbreviations("trav. das Flores"), "Travessa das Flores");
check("Dr. no meio vira Doutor", expandAbbreviations("Rua Dr. Luiz Viana"), "Rua doutor Luiz Viana");
check("Sta. no meio vira Santa", expandAbbreviations("Rua Sta. Rita"), "Rua santa Rita");
check("'nº' e 's/n' saem", expandAbbreviations("Av. Brasil nº 150"), "Avenida Brasil 150");
check("s/n sai", expandAbbreviations("Rua das Flores s/n"), "Rua das Flores");
check("abreviação ambígua só vale na 1ª palavra (al no meio fica)", expandAbbreviations("Rua Al Qaeda"), "Rua Al Qaeda");
check("'est' no meio não vira estrada", expandAbbreviations("Rua Est Central"), "Rua Est Central");
check("'res' na 1ª palavra vira residencial", expandAbbreviations("Res Segredo"), "Residencial Segredo");
check("texto normal não muda", expandAbbreviations("Rua das Laranjeiras"), "Rua das Laranjeiras");
check("palavra comum não confunde (Rua Gen... mantém nome comum)", expandAbbreviations("Rua General Osório"), "Rua General Osório");

// --- número da casa ---
check("rua + número com vírgula", splitHouseNumber("Avenida Brasil, 150"), { street: "Avenida Brasil", number: "150" });
check("rua + número sem vírgula", splitHouseNumber("Rua das Flores 25"), { street: "Rua das Flores", number: "25" });
check("número com letra", splitHouseNumber("Rua das Flores 25A"), { street: "Rua das Flores", number: "25A" });
check("'Rua 15' (nome numérico) NÃO separa", splitHouseNumber("Rua 15"), { street: "Rua 15", number: null });
check("'BR 116' NÃO separa", splitHouseNumber("BR 116"), { street: "BR 116", number: null });
check("'Rodovia BR 116' NÃO separa", splitHouseNumber("Rodovia BR 116"), { street: "Rodovia BR 116", number: null });
check("'Rodovia BA 262' NÃO separa", splitHouseNumber("Rodovia BA 262"), { street: "Rodovia BA 262", number: null });
check("número no meio (Rua 7 de Setembro) NÃO separa", splitHouseNumber("Rua 7 de Setembro"), { street: "Rua 7 de Setembro", number: null });
check("sem número", splitHouseNumber("Praça Rui Barbosa"), { street: "Praça Rui Barbosa", number: null });
check("só número não separa", splitHouseNumber("245"), { street: "245", number: null });

// --- plano de busca ---
check(
  "plano com número: busca principal + só a rua",
  planQuery("Av. Rio Branco nº 245"),
  { primary: "Avenida Rio Branco 245", streetOnly: "Avenida Rio Branco", number: "245", scoreText: "Avenida Rio Branco" },
);
check(
  "plano sem número: não tem busca extra",
  planQuery("R. Humberto de Campos"),
  { primary: "Rua Humberto de Campos", streetOnly: null, number: null, scoreText: "Rua Humberto de Campos" },
);

// --- colocar o número no resultado de rua ---
{
  const it = { street: "Avenida Rio Branco", label: "Avenida Rio Branco, Jequié - Bahia, Brasil" };
  const r = attachNumber(it, "245");
  check("número entra no nome e no endereço completo", [r.street, r.label], ["Avenida Rio Branco, 245", "Avenida Rio Branco, 245, Jequié - Bahia, Brasil"]);
  check("sem número não muda nada", attachNumber(it, null), it);
  const ja = { street: "Rua A, 10", label: "Rua A, 10, Jequié" };
  check("resultado que já tem número não recebe outro", attachNumber(ja, "245"), ja);
}

// --- acento no Overpass ---
{
  const re = new RegExp(accentPattern("Antonio"), "i");
  check("'Antonio' casa com 'Antônio'", re.test("Rua Antônio Carlos"), true);
  const re2 = new RegExp(accentPattern("Magalhães"), "i");
  check("'Magalhães' casa com 'Magalhaes'", re2.test("Magalhaes"), true);
  const re3 = new RegExp(accentPattern("Praça"), "i");
  check("'Praça' casa com 'Praca'", re3.test("Praca Rui Barbosa"), true);
  check("pontuação vira texto literal", accentPattern("a.b"), "[aáàâãä]\\.b");
}

console.log(results.join("\n"));
console.log(`\n${passed}/${total} verificações passaram`);
