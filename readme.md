# LLM Pokédex

A vanilla JavaScript Pokédex that lets you **search**, **browse**, and **explore** Pokémon using [PokéAPI](https://pokeapi.co/). Built with HTML, CSS, and JavaScript only — no frameworks.

This project was completed as part of an LLM-assisted JavaScript learning assignment: use an AI coding assistant as a pair programmer while still writing and understanding the application yourself.

---

## Features

### Core search & detail
- Search by **Pokémon name** or **Pokédex number**
- Handles capitalization and extra spaces (`trim` + `toLowerCase`)
- Displays:
  - Name, ID, image (official artwork when available)
  - Type badges (1 or 2 types)
  - Height, weight, base experience
  - Abilities
  - All six base stats with visual bars
- **Species data**: English genus/category and flavor text description
- **Loading** and **error / not found** screens
- Search again without refreshing the page; previous data is cleared

### Random Pokémon
- Header **Random** button picks a random Pokémon from the current browse list
- Works with the full national dex, a selected **generation**, a selected **type**, or both filters together
- Opens the detail view for that Pokémon (same card as a normal search)

### Generation list / filter
- Dropdown populated from PokéAPI’s `/generation/` endpoint
- Shows each region with its generation name (e.g. Kanto, Johto)
- **All generations** — browse the full paginated national list
- Choosing a generation — browse **only** that gen’s species
- Previous / Next / Random stay inside the selected generation when one is active

### Type list / filter (global)
- Dropdown next to Generation in the browse hero (`#type-filter`)
- Filled once on startup from PokéAPI’s `/type/` endpoint (all types)
- Choosing a type (e.g. Electric) fetches `/type/{name}` and browses that type’s full `pokemon` list across generations
- Pagination works on that list via `currentBrowseList` (same pattern as generation)
- **Combined with Generation**: shows only Pokémon that are in that gen **and** have that type (list intersection)
- Previous / Next / Random respect the active type (and generation) browse list
- Different from **Filter this page**, which only filters cards already on the current page

### Filter this page
- On the browse grid, filter **cards already loaded on the current page**
- Filter by **name or Pokédex number** (text input)
- Filter by **type** (dropdown of types present on that page only)
- Pure client-side filtering — **no extra API request** on each keystroke
- Shows an empty message if nothing on the page matches
- Complements the global Types dropdown (page-local vs whole-dex browse)

### Browse & explore
- **Browse grid** of Pokémon with pagination (`limit` / `offset`, 20 per page)
- **Previous / Next** navigation on the detail view
- **Recently viewed** history (click a chip to search again)
- **Compare** two Pokémon side-by-side (stats highlighted)
- **Ability details** — click an ability to fetch its English description
- **Evolution chain** with clickable stages
- **Level-up moves** list (name + level learned)
- **Responsive** layout for desktop, tablet, and mobile
- Basic **accessibility**: form labels, alt text, `aria-*`, keyboard support on cards

---

## How to run

No build step is required.

1. Open the `llm-pokedex` folder.
2. Open `index.html` in a browser  
   **or** serve the folder with a simple local server, for example:
3. Use the search bar, browse the grid, or try Random / Compare.

---

## Project structure

```
llm-pokedex/
├── index.html      # Page structure and UI shells
├── style.css       # Layout, type colors, stats, responsive styles
├── app.js          # All application logic
├── img/            # Local images (pokéball, not-found, etc.)
└── README.md       # This file
```

| File | Role |
|------|------|
| `index.html` | Semantic layout: header/search, browse grid, detail, compare, loading, empty state |
| `style.css` | Theme variables, type badge colors, stat bars, cards, media queries |
| `app.js` | DOM refs, state, helpers, API fetches, rendering, event listeners |

---

## Architecture (`app.js`)

The script is organized by responsibility:

1. **DOM references & state** — elements and variables like `currentPage`, `currentBrowseList`, `compareList`
2. **Shared helpers** — `setScreen`, `formatString`, `getPokemonSprite`, `getIdFromUrl`, `setBrowseTotals`, etc.
3. **Fetch** — reusable API functions (`fetchPokemon`, list pagination, generations, types)
4. **Recently viewed** — remember and re-open Pokémon
5. **Compare** — two-slot comparison UI
6. **Detail** — render card, species, evolution, abilities, moves
7. **Grid + search** — browse pages, search, generation/type filters, prev/next
8. **Event listeners** — wire buttons and forms
9. **`main()`** — start the app (load generations + types + first grid page)

### Screen model

`setScreen(screen)` shows exactly one main view:

| Screen | When |
|--------|------|
| `loading` | Waiting on the API |
| `empty` | Invalid search / no results |
| `detail` | One Pokémon’s full card |
| `grid` | Browse list |
| `compare` | Side-by-side stats |

### Important state variables

| Variable | Meaning |
|----------|---------|
| `currentPage` | Current grid page number |
| `currentListIndex` | Position in the active browse list (for Prev/Next/Random) |
| `currentBrowseList` | Custom list when a **generation** and/or **type** filter is active; `null` means “all Pokémon” via the national API list |
| `currentPagePokemon` | Pokémon already loaded on the current grid page (used by client-side filter) |
| `compareList` | Up to 2 Pokémon selected for comparison |
| `generationCache` | Cached species lists per generation |

---

## APIs used

Base docs: [https://pokeapi.co/api/v2/](https://pokeapi.co/api/v2/)

| Endpoint | Used for |
|----------|----------|
| `GET /pokemon/{name-or-id}` | Main Pokémon details |
| `GET /pokemon?limit=&offset=` | Paginated browse list |
| `GET /pokemon-species/{…}` | Genus + English description (via species URL on the Pokémon) |
| `GET /evolution-chain/{…}` | Evolution stages |
| `GET /ability/{…}` | Ability description when a user clicks an ability |
| `GET /generation/` and `/generation/{id}` | Generation dropdown and region-filtered browse |
| `GET /type/` | Fill the global Types dropdown |
| `GET /type/{name}` | All Pokémon of that type (used as a browse list; includes forms across generations) |

Each search or detail view can trigger **multiple** async requests (Pokémon + species + evolution, and optionally ability).

---

## Main user flows

### Search
1. User submits the form.
2. Input is trimmed and lowercased.
3. `fetchPokemon` runs; failed/`!response.ok` → empty screen.
4. Success → `showDetail` → render stats/types/abilities, then load species + evolution.

### Browse
1. On load, `renderPokemonGrid` fetches a page of names, then details for each card.
2. Pagination Previous/Next changes `currentPage` and reloads the grid.

### Generation list
1. On startup, `fillGenerationOptions` loads `/generation/` and fills the dropdown.
2. User picks a generation (or “All generations”).
3. Grid reloads from page 1.
4. If a generation is selected, `currentBrowseList` is set to that gen’s species; otherwise it is `null` (full national list) unless a type is also selected.

### Type list (global)
1. On startup, `fillAllTypeFilterOptions` loads `/type/` and fills the Types dropdown.
2. User picks a type (or “All types”).
3. Grid reloads from page 1 via `renderPokemonGrid`.
4. If a type is selected, `fetchTypePokemon` loads `/type/{name}` and maps `pokemon` into `{ name, id }`.
5. That list becomes `currentBrowseList` and is paginated with `slice`.
6. If **both** type and generation are selected, the app keeps Pokémon that appear in **both** lists (intersection), then paginates that result.

### Filter this page
1. User types a name/number and/or chooses a type on the browse screen.
2. `applyPageFilter` filters `currentPagePokemon` in memory.
3. Matching cards are re-rendered; no new PokéAPI request is made.

### Random Pokémon
1. User clicks **Random** in the header.
2. A random index is chosen between `0` and `totalCount - 1`.
3. `fetchPokemonAtIndex` loads that Pokémon (respecting generation and/or type browse if active).
4. Detail view opens for the result.

### Previous / Next on detail
- Uses `fetchPokemonAtIndex(index)`.
- If `currentBrowseList` is set → pick from that filtered list (generation and/or type).
- If not → use API `offset` on the full national list.

---

## Tech & learning concepts practiced

- DOM selection and dynamic rendering
- Form submit + `preventDefault`
- `fetch`, Promises, `async` / `await`
- `try` / `catch` and `response.ok`
- Objects & arrays from a real API
- Guard clauses and separated fetch vs render functions
- Responsive CSS and type-colored UI
- LLM-assisted planning, debugging, and design (pair programming, not copy-paste entire solutions)

---

## Explain your code (FAQ)

These answers match how this project’s `app.js` works and are useful for demos or code reviews.

### Why does `fetch` need `await`?

`fetch()` returns a **Promise**. Without `await`, JavaScript continues immediately and you do not have the response yet. `await` pauses that `async` function until the network request finishes, then gives you the `Response` so you can call `.json()` and use the data.

Example in this app: `const response = await fetch(...)` inside `fetchPokemon`.

### What does `response.ok` tell you?

`response.ok` is `true` when the HTTP status is in the success range (**200–299**). A request can “complete” and still be a failure (for example **404 Not Found**). Checking `response.ok` lets the app treat bad statuses as errors instead of trying to parse missing Pokémon data as success.

In this app: `if (!response.ok) return null;`

### Why are you using `try/catch`?

Network requests can fail for reasons outside HTTP status — offline network, CORS issues, or JSON parse problems. `try/catch` catches those thrown errors so the app does not crash. Combined with `response.ok`, the UI can show a not-found / empty state instead of breaking.

### Where does this value exist inside the API response?

Examples from PokéAPI Pokémon JSON used in this project:

| UI value | Path in API response |
|----------|----------------------|
| Name | `data.name` |
| Pokédex ID | `data.id` |
| Image | `data.sprites.other['official-artwork'].front_default` (fallback: `data.sprites.front_default`) |
| Types | `data.types` → each `type.type.name` |
| Abilities | `data.abilities` → each `ability.ability.name` / `.url` |
| Height / weight | `data.height`, `data.weight` |
| Base experience | `data.base_experience` |
| Stats | `data.stats` → each `stat.stat.name` and `stat.base_stat` |
| Species URL | `data.species.url` (then a second fetch for genus / flavor text) |
| Moves | `data.moves` |

### What causes `renderPokemon()` to run?

`renderPokemon(pokemonData, listIndex)` builds **one grid card**. It runs when the browse grid draws cards — typically from `applyPageFilter()`, which loops over the filtered `currentPagePokemon` list after `renderPokemonGrid()` has fetched that page’s details.

It does **not** run for the full detail page; that uses `renderDetail` / `showDetail` instead.

### How does clicking Search trigger your JavaScript?

1. The search `<form id="search-form">` has a submit listener.
2. Clicking Search (or pressing Enter) fires `submit`.
3. The listener calls `e.preventDefault()` so the page does not reload.
4. It then calls `search()`, which reads the input, fetches the Pokémon, and shows detail or the empty state.

```js
searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    search();
});
```

### Why do you clear the previous DOM elements?

If you do not clear old content, a new search or page change leaves leftover types, stats, abilities, errors, or cards from the last Pokémon. Clearing (for example `pokemonGrid.innerHTML = ''`, resetting detail fields, or switching screens with `setScreen`) keeps the UI accurate and avoids mixed/stale data.

### Why is this function `async`?

A function is `async` when it needs to use `await` for Promises (usually `fetch`). Examples: `fetchPokemon`, `search`, `renderPokemonGrid`, `showDetail`, `loadSpeciesData`. Marking them `async` lets the code wait for API data in a readable top-to-bottom style instead of nested `.then()` chains.

### Why did you separate these two functions?

Fetch and render do different jobs:

- **`fetchPokemon`** — talk to the API and return data (or `null`)
- **`renderPokemon` / `renderDetail`** — turn that data into DOM

Separating them makes the code easier to test, reuse (grid, search, random, prev/next all fetch; only some paths render a card), and explain. One giant function that fetches and builds the whole UI is harder to maintain.

### What happens when the API returns a 404?

For an invalid name like `superMegaPikachu9000`:

1. `fetch` still resolves with a response.
2. `response.ok` is `false` (status 404).
3. `fetchPokemon` returns `null`.
4. `search()` shows the **empty / not found** screen via `setScreen('empty')` and does not leave an old Pokémon card on screen.

### What did Codex (the LLM) help you with?

Used as a **pair programmer**, not to dump the whole app:

- Understanding PokéAPI response shape (where name, types, stats, species live)
- Planning feature order (search → render → errors → loading → stretch goals)
- Debugging async / UI state issues (e.g. browse list vs national list, `currentBrowseList`)
- Ideas for layout, type colors, stat bars, and accessibility
- Reviewing whether functions should be helpers vs fetch vs render

### What code did you change after Codex suggested it?

Examples of changes driven by review / suggestions (then implemented and understood by hand):

- Keeping **fetch** and **render** in separate functions
- Checking **`response.ok`** instead of assuming every response is good data
- Using **`setScreen`** so loading / empty / detail / grid / compare do not fight each other
- Treating utilities like **`getIdFromUrl`** as helpers, not “fetch” logic
- Adding stretch UX: random, generation dropdown, page filter, compare, evolution, ability details

### Why did you accept or reject that suggestion?

**Accepted** when it improved clarity or correctness without hiding how the code works — e.g. guard clauses, separation of concerns, loading/error states, accessible labels.

**Rejected or simplified** when a suggestion was over-engineered for a vanilla class project (extra libraries, huge rewrites, or code that could not be explained). The rule: if it cannot be explained, it does not ship.

---

## Credits

- Data from [PokéAPI](https://pokeapi.co/)
- Pokémon and Pokémon character names are trademarks of Nintendo
- Icons via Font Awesome (CDN)

---

## License / academic note

Built for educational purposes as an interactive Pokédex using public PokéAPI data.
