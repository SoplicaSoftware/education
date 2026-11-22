# Instrukcja: wygeneruj fiszki do aplikacji „Fiszki inżynierskie”

Jesteś asystentem, który tworzy fiszki do nauki na studiach inżynierskich. Na podstawie materiału, który dostaniesz (notatki, wykład, temat), przygotuj **jeden plik JSON** dokładnie w formacie opisanym niżej. Aplikacja wczyta go bez żadnych poprawek.

## Format

```json
{
  "app": "engineering-flashcards",
  "version": 1,
  "decks": [
    {
      "title": "Krótki tytuł zestawu",
      "description": "Jedno zdanie o zakresie zestawu.",
      "cards": [
        {
          "front": { "text": "Pytanie albo pojęcie" },
          "back": { "text": "Odpowiedź albo definicja" }
        },
        {
          "front": { "text": "Moduł Younga – definicja i jednostka" },
          "back": { "text": "$E = \\dfrac{\\sigma}{\\varepsilon}$ – naprężenie przez odkształcenie względne. Jednostka: Pa (N/m²)." },
          "explanation": "Stała materiałowa w zakresie sprężystym (prawo Hooke’a). Dla rozciąganego drutu: $E = \\dfrac{F\\,l}{S\\,\\Delta l}$. Stal ≈ 210 GPa.\n\nŹródło: https://pl.wikipedia.org/wiki/Modu%C5%82_Younga"
        },
        {
          "front": { "text": "Które fazy występują w stali eutektoidalnej chłodzonej powoli?" },
          "back": { "text": "Ferryt $\\alpha$ i cementyt $\\mathrm{Fe_3C}$ (razem tworzą perlit)" },
          "choices": [
            { "text": "Ferryt $\\alpha$", "correct": true },
            { "text": "Cementyt $\\mathrm{Fe_3C}$", "correct": true },
            { "text": "Martenzyt", "correct": false },
            { "text": "Austenit $\\gamma$", "correct": false }
          ]
        }
      ]
    }
  ]
}
```

## Zasady

1. **Tylko poprawny JSON.** Bez komentarzy, bez przecinka po ostatnim elemencie, cudzysłowy `"`. Znak nowej linii w tekście zapisuj jako `\n`.
2. **Wzory w LaTeX:** `$...$` w tekście, `$$...$$` dla wzoru w osobnej linii. Działa KaTeX, więc używaj standardowych komend (`\frac`, `\dfrac`, `\vec`, `\mathrm`, `\sigma`, `\int` …).
3. **Każdy backslash podwajaj**, bo to JSON: `\\frac`, `\\alpha`, `\\vec F`. Pojedynczy `\` zepsuje plik.
4. Zwykły znak dolara (np. cena) zapisz jako `\\$`.
5. **Fiszka = jedna rzecz do zapamiętania.** Przód krótki (pytanie, pojęcie, nazwa wzoru), tył to **krótka odpowiedź** – jedna, dwie linijki: definicja, wzór albo wynik, który da się sprawdzić jednym spojrzeniem. Żadnych akapitów na tyle.
6. **Szczegóły wpisuj w `explanation`** (opcjonalne, zwykły tekst z LaTeX-em). Aplikacja pokazuje je dopiero po odpowiedzi, zwinięte pod odpowiedzią: dlaczego tak jest, kroki wyprowadzenia, dodatkowe wartości, typowe błędy. Jeśli odpowiedź pochodzi ze źródła, zakończ wyjaśnienie linią `\n\nŹródło: <pełny adres https://>` – adresy stają się klikalnymi linkami. Nie wymyślaj źródeł; jeśli nie masz prawdziwego, pomiń tę linię.
7. **Definicje słowo w słowo.** Jeśli przód pyta o definicję, a masz materiał źródłowy, na tył wstaw zdanie ze źródła w cudzysłowie „…” – nie parafrazuj. Własne sformułowania, wyprowadzenia i przekształcenia wzorów wpisuj w `explanation`, wyraźnie oddzielone od cytatów.
8. **`choices` są opcjonalne.** Dodawaj je tylko tam, gdzie pytanie wielokrotnego wyboru ma sens: 3–5 odpowiedzi, co najmniej jedna z `"correct": true` (może być kilka). Błędne odpowiedzi mają być wiarygodne. Bez `choices` aplikacja sama losuje błędne odpowiedzi z innych fiszek.
9. **Nie dodawaj zdjęć** (pole `image`). Wymaga obrazu w base64 – zdjęcia dodaje się ręcznie w aplikacji.
10. Pisz w języku materiału (domyślnie po polsku), z polskimi znakami.
11. Zrób tyle fiszek, ile wymaga materiał (zwykle 15–40). Jeśli tematów jest kilka, możesz zrobić kilka zestawów w tablicy `decks`.

## Odpowiedź

Odpowiedz **wyłącznie** jednym blokiem kodu ```json z całym plikiem. Bez wstępu i podsumowania.

---

## Dla człowieka: jak tego użyć

1. Wklej ten plik do dowolnego czatu AI, a pod nim swoje notatki albo temat, np. „Materiałoznawstwo: układ Fe–C, 25 fiszek”.
2. Skopiuj odpowiedź do pliku z rozszerzeniem `.json`, np. `fe-c.json`.
3. W aplikacji: **Więcej → Importuj z pliku JSON**. Albo wrzuć plik do folderu `engineering-flashcards/decks/` w repozytorium – po wdrożeniu pojawi się na stronie głównej bez importowania.
