# Soplica Software Education Hub

Interaktywne narzędzia i materiały do nauki na studiach inżynierskich, publikowane na GitHub Pages.

| Strona | Adres po wdrożeniu |
| --- | --- |
| Strona główna huba (`index.html`) | `https://<login>.github.io/education/` |
| [Fiszki inżynierskie](./engineering-flashcards) | `https://<login>.github.io/education/engineering-flashcards/` |

Wygląd jest wzorowany na przykładach z dokumentacji [Base UI](https://base-ui.com): neutralne kolory, cienkie ramki, ostre rogi i automatyczny tryb ciemny. Komponenty interaktywne (przyciski, menu, okna dialogowe, przełączniki, pasek postępu, powiadomienia itd.) to komponenty Base UI ostylowane jednym plikiem CSS: `engineering-flashcards/src/styles.css`.

## Automatyczne wdrażanie

Przy każdym pushu na `main` workflow `.github/workflows/deploy.yml` uruchamia `scripts/build-site.sh` i publikuje wynik:

- każdy folder z `package.json` jest budowany (`npm ci && npm run build`), a jego `dist/` trafia pod `/<folder>/`,
- każdy folder z samym `index.html` jest kopiowany bez zmian,
- główny `index.html` jest stroną huba.

**Jednorazowa konfiguracja:** w repozytorium na GitHubie wejdź w *Settings → Pages → Build and deployment → Source* i wybierz **GitHub Actions**. Bez tego krok `deploy` kończy się błędem, bo strona Pages nie istnieje.

Po zmianie zależności w `package.json` zawsze uruchom `npm install` i zacommituj zaktualizowany `package-lock.json`. Workflow używa `npm ci`, które przerywa build, gdy lockfile nie zgadza się z `package.json`.

### Podgląd całej strony lokalnie

```bash
bash scripts/build-site.sh
mkdir -p /tmp/pages && ln -sfn "$PWD/_site" /tmp/pages/education
cd /tmp/pages && python3 -m http.server 4319
# http://localhost:4319/education/
```

### Dodawanie kolejnego projektu

1. Utwórz folder, np. `mind-maps/`.
2. Jeśli używasz Vite, ustaw `base: './'` w `vite.config.ts`, żeby aplikacja działała pod dowolną ścieżką.
3. Dodaj link w głównym `index.html`.
4. Zrób push. Projekt pojawi się pod `https://<login>.github.io/education/mind-maps/`.

## Fiszki inżynierskie (`engineering-flashcards/`)

Fiszki z obsługą wzorów LaTeX (KaTeX) i zdjęć, np. do fizyki czy materiałoznawstwa.

- **Zestawy:** tworzenie, edycja, import i eksport do JSON (zdjęcia jako base64) oraz wklejanie listy „pojęcie, separator, definicja”.
- **Zdjęcia:** przycisk „Dodaj zdjęcie” albo wklejenie ze schowka (Ctrl+V). Duże zdjęcia są automatycznie zmniejszane.
- **LaTeX:** `$...$` w tekście, `$$...$$` w osobnej linii, `\$` oznacza zwykły znak dolara.
- **Tryb Fiszki:** odwracanie kart, „umiem / nie umiem” z powtórką trudnych fiszek, losowa kolejność, skróty klawiszowe i gest przesunięcia palcem.
- **Tryb Nauka:** pytania wyboru (ABCD), prawda/fałsz i pisemne. Możesz dodać własne odpowiedzi ABCD z kilkoma poprawnymi. Fiszka jest opanowana po dwóch poprawnych odpowiedziach: najpierw rozpoznanie, potem wpisanie.
- **Zestawy z repozytorium:** pliki JSON wrzucone do [`engineering-flashcards/decks/`](./engineering-flashcards/decks) (także do podfolderów) pojawiają się na stronie głównej w sekcji „Z repozytorium”, bez importowania. Edycja takiego zestawu zapisuje się tylko w przeglądarce, a **Więcej → Przywróć wersję z repozytorium** usuwa lokalne zmiany.
- **Zapis lokalny:** dane trzymane są w IndexedDB przeglądarki, bo localStorage ma za mały limit na zdjęcia. Nic nie trafia na serwer. Eksport do JSON służy jako kopia zapasowa i sposób przenoszenia fiszek między urządzeniami.

Plik testowy: [`engineering-flashcards/examples/test-deck.json`](./engineering-flashcards/examples/test-deck.json). Zawiera wzory LaTeX, zdjęcie PNG w base64, rysunek SVG i pytania ABCD z kilkoma poprawnymi odpowiedziami. Obok leży samo zdjęcie `pearlite.png` do testowania ręcznego dodawania zdjęć.

Stos: React 19, TypeScript, Vite, Base UI, KaTeX.

```bash
cd engineering-flashcards
npm install
npm run dev      # http://localhost:4317 (z hot reloadem)
npm run build    # produkcyjny build do dist/
```

### Format pliku JSON

```json
{
  "app": "engineering-flashcards",
  "version": 1,
  "decks": [
    {
      "title": "Materiałoznawstwo",
      "description": "",
      "cards": [
        {
          "front": { "text": "Co to za mikrostruktura?", "image": "data:image/png;base64,..." },
          "back": { "text": "Perlit – mieszanina ferrytu $\\alpha$ i cementytu" },
          "choices": [
            { "text": "Perlit", "correct": true },
            { "text": "Martenzyt", "correct": false }
          ]
        }
      ]
    }
  ]
}
```

Import przyjmuje też pojedynczy zestaw albo tablicę zestawów. Pola `id`, `image` i `choices` są opcjonalne.
