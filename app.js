/******************
 * Pokédex — DOM, state, then fetch / render / listeners
 ******************/

const apiUrl = 'https://pokeapi.co/api/v2/pokemon/';
const generationApiUrl = 'https://pokeapi.co/api/v2/generation/';
const typeApiUrl = 'https://pokeapi.co/api/v2/type/';
const pokemonInput = document.getElementById('pokemon-input');
const searchForm = document.getElementById('search-form');
const pokemonGrid = document.getElementById('pokemon-grid');
const prevButtons = document.querySelectorAll('.prev-button');
const nextButtons = document.querySelectorAll('.next-button');
const currentPageEls = document.querySelectorAll('.current-page');
const pageRangeEls = document.querySelectorAll('.page-range');
const searchQueryEl = document.getElementById('search-query');
const pokemonDetail = document.getElementById('pokemon-detail');
const detailPrevButton = document.getElementById('detail-prev');
const detailNextButton = document.getElementById('detail-next');
const detailBackButton = document.querySelector('#pokemon-detail .back-to-list');
const noResultsBackButton = document.querySelector('#no-results .back-to-list');
const brandEl = document.querySelector('.brand');
const randomButton = document.getElementById('random-button');
const recentlyViewedEl = document.getElementById('recently-viewed-list');
const recentlyViewedSection = document.getElementById('recently-viewed');
const noResults = document.getElementById('no-results');
const loading = document.getElementById('loading');
const browse = document.getElementById('browse');
const pokemonCompare = document.getElementById('pokemon-compare');
const compareButton = document.getElementById('compare-button');
const addToCompareButton = document.getElementById('add-to-compare');
const compareBackButton = document.getElementById('compare-back');
const totalPokemonEl = document.getElementById('total-pokemon');
const detailImage = document.getElementById('detail-image');
const detailId = document.getElementById('detail-id');
const detailName = document.getElementById('detail-name');
const detailTypes = document.getElementById('detail-types');
const detailHeight = document.getElementById('detail-height');
const detailWeight = document.getElementById('detail-weight');
const detailAbilities = document.getElementById('detail-abilities');
const abilityName = document.getElementById('ability-name');
const abilityDescription = document.getElementById('ability-description');
const detailBaseExperience = document.getElementById('detail-base-experience');
const detailStats = document.getElementById('detail-stats');
const detailGenus = document.getElementById('detail-genus');
const detailFlavor = document.getElementById('detail-flavor');
const compareHeads = document.getElementById('compare-heads');
const compareNameLeft = document.getElementById('compare-name-left');
const compareNameRight = document.getElementById('compare-name-right');
const compareHint = document.getElementById('compare-hint');
const compareStats = document.getElementById('compare-stats');
const evolutionChainContainer = document.getElementById('evolution-list');
const movesList = document.getElementById('moves-list');
const pageFilterInput = document.getElementById('page-filter-input');
const pageFilterType = document.getElementById('page-filter-type');
const generationFilter = document.getElementById('generation-filter');
const typeFilter = document.getElementById('type-filter');

let pokemonTypes = [];

// limit each page to 20 pokemons
const pageLimit = 20;
const maxRecentlyViewed = 5;
let currentPage = 1;
let totalPages = 1;

// Slot in GET /pokemon?offset= — not always the same as pokemon.id
let currentListIndex = 0;
let totalCount = 1;
let recentlyViewedList = [];
let compareList = [];
let currentDetailPokemon = null;
let currentPagePokemon = [];
let currentBrowseList = null;
const generationCache = {};

// this is used to update the current page number in the pagination section
currentPageEls.forEach((el) => {
    el.textContent = currentPage;
});

/******************
 * Shared helpers
 ******************/

// Show one screen: loading, empty, detail, grid, or compare
const setScreen = (screen) => {
    loading.classList.toggle('hidden', screen !== 'loading');
    noResults.classList.toggle('hidden', screen !== 'empty');
    pokemonDetail.classList.toggle('hidden', screen !== 'detail');
    browse.classList.toggle('hidden', screen !== 'grid');
    pokemonCompare.classList.toggle('hidden', screen !== 'compare');
};

// Capitalize each hyphenated word: special-attack → Special Attack
const formatString = (str) => {
    return str
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
};

// get pokemon official artwork, then default sprite, then a local pokéball
const getPokemonSprite = (pokemonData) => {
    const other = pokemonData.sprites.other || {};
    const artwork = other['official-artwork'] || {};
    const home = other.home || {};
    return (
        artwork.front_default ||
        pokemonData.sprites.front_default ||
        home.front_default ||
        'img/pokeball.png'
    );
};

// Build colored type badge HTML from the types array
const renderTypeBadges = (types) => {
    return types
        .map((t) => `<span class="type-badge type-${t.type.name}">${t.type.name}</span>`)
        .join('');
};

// Return the first English item from a PokéAPI language list
const findEnglishEntry = (entries) => {
    return entries.find((entry) => entry.language.name === 'en');
};

// Disable detail Previous/Next while loading, or at the first/last list slot
const updateDetailNav = (busy = false) => {
    if (busy) {
        detailPrevButton.disabled = true;
        detailNextButton.disabled = true;
        return;
    }
    // Form IDs (10000+) are not list offsets — navigate by id instead
    if (!currentBrowseList && currentDetailPokemon && currentDetailPokemon.id >= 10000) {
        detailPrevButton.disabled = currentDetailPokemon.id <= 10001;
        detailNextButton.disabled = false;
        return;
    }
    detailPrevButton.disabled = currentListIndex <= 0;
    detailNextButton.disabled = currentListIndex >= totalCount - 1;
};

// Point the count + pagination at this many Pokémon
const setBrowseTotals = (count) => {
    totalCount = count;
    totalPages = Math.max(1, Math.ceil(count / pageLimit));
    // update the total count of pokemons in the pagination section
    totalPokemonEl.textContent = count.toLocaleString();
};

// Last number in a PokéAPI URL is the resource id
const getIdFromUrl = (url) => {
    const parts = url.split('/').filter(Boolean);
    return Number(parts[parts.length - 1]);
};

// Replace spaces with hyphens for the search name
const pokemanSearchName = (pokemonName) => {
    return pokemonName.replaceAll(' ', '-');
};

/******************
 * Fetch
 ******************/

// GET /pokemon/{name or id} — returns JSON or null
const fetchPokemon = async (pokemon) => {
    try {
        pokemon = pokemanSearchName(String(pokemon));
        const response = await fetch(`${apiUrl}${pokemon}`);
        if (!response.ok) return null;
        return await response.json();
    } catch (error) {
        console.error('Error fetching pokemon:', error);
        return null;
    }
};

// GET one page of the Pokémon list and store totalCount / totalPages
const fetchPokemonList = async (page) => {
    try {
        const response = await fetch(`${apiUrl}?limit=${pageLimit}&offset=${(page - 1) * pageLimit}`);
        if (!response.ok) return null;
        const data = await response.json();
        // et total count of pokemons
        if (data.count != null) {
            totalCount = data.count;
            // update the total count of pokemons in the pagination section
            totalPokemonEl.textContent = data.count.toLocaleString();
            // update the total pages in the pagination section
            totalPages = Math.ceil(data.count / pageLimit);
        }
        return data;
    } catch (error) {
        console.error('Error fetching pokemon list:', error);
        return null;
    }
};

// GET the Pokémon at a list offset (used by Previous / Next / Random)
const fetchPokemonAtIndex = async (index) => {
    // if the current browse list is not empty, get the pokemon at the index
    if (currentBrowseList) {
        const item = currentBrowseList[index];
        if (!item) return null;
        return fetchPokemon(item.name);
    }
    try {
        const response = await fetch(`${apiUrl}?limit=1&offset=${index}`);
        if (!response.ok) return null;
        const data = await response.json();
        if (!data.results || !data.results[0]) return null;
        return fetchPokemon(data.results[0].name);
    } catch (error) {
        console.error('Error fetching pokemon at index:', error);
        return null;
    }
};

const fetchTypeList = async () => {
    try {
        const response = await fetch(`${typeApiUrl}`);
        if (!response.ok) return [];
        const data = await response.json();
        return data.results || [];
    } catch (error) {
        console.error('Error fetching type list:', error);
        return [];
    }
};

// GET /type/{name} — all Pokémon with that type (any generation)
const fetchTypePokemon = async (typeName) => {
    try {
        const response = await fetch(`${typeApiUrl}${typeName}`);
        if (!response.ok) return null;
        const data = await response.json();
        return data.pokemon
            .map((entry) => ({
                name: entry.pokemon.name,
                id: getIdFromUrl(entry.pokemon.url)
            }))
            .sort((a, b) => a.id - b.id);
    } catch (error) {
        console.error('Error fetching type pokemon:', error);
        return null;
    }
};

// GET /generation/ — the list of gens for the dropdown
const fetchGenerationList = async () => {
    try {
        const response = await fetch(generationApiUrl);
        if (!response.ok) return [];
        const data = await response.json();
        return data.results || [];
    } catch (error) {
        console.error('Error fetching generation list:', error);
        return [];
    }
};

// Store species names from a generation payload, sorted by National Dex id
const cacheGenerationSpecies = (generationId, data) => {
    generationCache[generationId] = data.pokemon_species
        .map((species) => ({
            name: species.name,
            id: getIdFromUrl(species.url)
        }))
        .sort((a, b) => a.id - b.id);
};

// GET /generation/{id} — used for region labels and the species list
const fetchGenerationData = async (generationId) => {
    try {
        const response = await fetch(`${generationApiUrl}${generationId}`);
        if (!response.ok) return null;
        const data = await response.json();
        cacheGenerationSpecies(generationId, data);
        return data;
    } catch (error) {
        console.error('Error fetching generation:', error);
        return null;
    }
};

// Species list for a generation (from cache after the dropdown loads)
const fetchGenerationPokemon = async (generationId) => {
    if (generationCache[generationId]) {
        return generationCache[generationId];
    }
    const data = await fetchGenerationData(generationId);
    return data ? generationCache[generationId] : null;
};


/******************
 * Recently viewed
 ******************/

// Add a Pokémon to the front of recently viewed (max 5, no duplicates)
const rememberViewed = (pokemonData) => {
    recentlyViewedList = recentlyViewedList.filter((p) => p.id !== pokemonData.id);
    recentlyViewedList.unshift(pokemonData);
    if (recentlyViewedList.length > maxRecentlyViewed) {
        recentlyViewedList.pop();
    }
    renderRecentlyViewedList();
};

// Draw recently viewed chips; clicking one runs search again
const renderRecentlyViewedList = () => {
    recentlyViewedEl.innerHTML = '';
    recentlyViewedList.forEach((pokemonData) => {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.classList.add('recent-chip');
        chip.textContent = formatString(pokemonData.name);
        chip.addEventListener('click', () => {
            pokemonInput.value = pokemonData.name;
            search();
        });
        recentlyViewedEl.appendChild(chip);
    });
    recentlyViewedSection.classList.toggle('hidden', recentlyViewedList.length === 0);
};

/******************
 * Compare — two slots; a third add drops the oldest
 ******************/

// Toggle the detail button between "Add to Compare" and "In Compare"
const setAddToCompareLabel = (inCompare) => {
    addToCompareButton.innerHTML = inCompare
        ? 'In Compare'
        : '<i class="fa fa-plus" aria-hidden="true"></i> Add to Compare';
};

// Enable the header Compare button and show how many slots are filled
const updateCompareHeaderButton = () => {
    compareButton.disabled = compareList.length === 0;
    const countLabel = compareList.length === 0
        ? 'Compare'
        : `Compare (${compareList.length})`;
    compareButton.innerHTML = `<i class="fa fa-balance-scale" aria-hidden="true"></i> ${countLabel}`;
};

// HTML for one compare column, or an empty-slot message
const renderCompareSlot = (pokemonData, slot) => {
    if (!pokemonData) {
        return `
          <div class="compare-pokemon compare-empty">
            <p>Slot ${slot + 1} empty</p>
            <p>Open a Pokémon and click Add to Compare</p>
          </div>`;
    }
    const name = formatString(pokemonData.name);
    return `
      <div class="compare-pokemon">
        <button type="button" class="compare-remove" data-id="${pokemonData.id}" aria-label="Remove ${name}">&times;</button>
        <img src="${getPokemonSprite(pokemonData)}" alt="${name}" />
        <p>#${pokemonData.id}</p>
        <h3>${name}</h3>
        <div class="types">${renderTypeBadges(pokemonData.types)}</div>
      </div>`;
};

// Draw both compare slots and the side-by-side stats table
const renderCompare = () => {
    const left = compareList[0] || null;
    const right = compareList[1] || null;
    compareHeads.innerHTML = renderCompareSlot(left, 0) + renderCompareSlot(right, 1);
    compareNameLeft.textContent = left ? formatString(left.name) : '—';
    compareNameRight.textContent = right ? formatString(right.name) : '—';

    if (compareList.length < 2) {
        compareHint.textContent = 'Add a second Pokémon from a detail page. A third add replaces the oldest.';
    } else {
        compareHint.textContent = 'The higher stat in each row is highlighted. Add another Pokémon to replace the oldest.';
    }

    if (!left || !right) {
        compareStats.innerHTML = '<tr><td colspan="3">Stats appear when two Pokémon are selected.</td></tr>';
    } else {
        const statRows = left.stats.map((leftStat) => {
            const rightStat = right.stats.find((s) => s.stat.name === leftStat.stat.name);
            const leftValue = leftStat.base_stat;
            const rightValue = rightStat ? rightStat.base_stat : 0;
            const leftWin = leftValue > rightValue ? ' class="stat-winner"' : '';
            const rightWin = rightValue > leftValue ? ' class="stat-winner"' : '';
            return `
              <tr>
                <th>${formatString(leftStat.stat.name)}</th>
                <td${leftWin}>${leftValue}</td>
                <td${rightWin}>${rightValue}</td>
              </tr>`;
        }).join('');
        const leftTotal = left.stats.reduce((sum, s) => sum + s.base_stat, 0);
        const rightTotal = right.stats.reduce((sum, s) => sum + s.base_stat, 0);
        const leftTotalWin = leftTotal > rightTotal ? ' class="stat-winner"' : '';
        const rightTotalWin = rightTotal > leftTotal ? ' class="stat-winner"' : '';
        compareStats.innerHTML =
            statRows +
            `<tr class="stat-total">
               <th>Total</th>
               <td${leftTotalWin}>${leftTotal}</td>
               <td${rightTotalWin}>${rightTotal}</td>
             </tr>`;
    }

    // remove a pokemon from the compare list
    document.querySelectorAll('.compare-remove').forEach((btn) => {
        btn.addEventListener('click', () => {
            const id = Number(btn.dataset.id);
            compareList = compareList.filter((p) => p.id !== id);
            // if the current detail pokemon is in the compare list, update the add to compare label
            if (currentDetailPokemon) {
                setAddToCompareLabel(
                    compareList.some((p) => p.id === currentDetailPokemon.id)
                );
            }
            updateCompareHeaderButton();
            // render the compare list
            renderCompare();
        });
    });
};

// Put a Pokémon in compare; a third add replaces the oldest
const addToCompare = (pokemonData) => {
    if (!pokemonData) return;
    if (compareList.some((p) => p.id === pokemonData.id)) {
        renderCompare();
        setScreen('compare');
        return;
    }
    compareList.push(pokemonData);
    if (compareList.length > 2) {
        compareList.shift();
    }
    // update the add to compare label
    setAddToCompareLabel(true);
    updateCompareHeaderButton();
    renderCompare();
    // if the compare list has 2 pokemons, show the compare screen
    if (compareList.length === 2) {
        setScreen('compare');
    }
};

/******************
 * Detail
 ******************/

// Fill the detail page from Pokémon data (species/chain load separately)
const renderDetail = (pokemonData) => {
    const name = formatString(pokemonData.name);
    detailImage.src = getPokemonSprite(pokemonData);
    detailImage.alt = name;
    detailId.textContent = `#${pokemonData.id}`;
    detailName.textContent = name;
    detailTypes.innerHTML = renderTypeBadges(pokemonData.types);

    // API: height is decimeters, weight is hectograms
    const heightMeters = pokemonData.height / 10;
    const weightKg = pokemonData.weight / 10;
    detailHeight.textContent = `${heightMeters} m / ${(heightMeters * 3.28084).toFixed(2)} ft`;
    detailWeight.textContent = `${weightKg} kg / ${(weightKg * 2.20462).toFixed(2)} lbs`;
    detailBaseExperience.textContent = `${pokemonData.base_experience}`;

    detailAbilities.innerHTML = '';
    pokemonData.abilities.forEach((a) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ability-btn';
        btn.textContent = formatString(a.ability.name);
        btn.addEventListener('click', () => {
            showAbilityDetail(a.ability.name, a.ability.url);
        });
        detailAbilities.appendChild(btn);
    });
    abilityName.textContent = '';
    abilityDescription.textContent = 'Click an ability to see its description.';

    const statRows = pokemonData.stats.map((s) => {
        const percent = (s.base_stat / 255) * 100;
        return `
          <li class="stat-row">
            <span class="stat-name">${formatString(s.stat.name)}</span>
            <span class="stat-value">${s.base_stat}</span>
            <div class="stat-bar">
              <div class="stat-bar-fill stat-${s.stat.name}" style="width: ${percent}%"></div>
            </div>
          </li>`;
    }).join('');
    const total = pokemonData.stats.reduce((sum, s) => sum + s.base_stat, 0);
    detailStats.innerHTML =
        statRows +
        `<li class="stat-row stat-total">
           <span class="stat-name">Total</span>
           <span class="stat-value">${total}</span>
         </li>`;

    detailGenus.textContent = '';
    detailFlavor.textContent = '';
    // clear old revolution chain before the new one is loaded
    evolutionChainContainer.innerHTML = '<p class="evolution-loading">Loading evolution chain...</p>';
};

// Draw the evolution row; the current Pokémon is highlighted and stages are clickable
const renderEvolutionChain = (stages) => {
    evolutionChainContainer.innerHTML = '';
    stages.forEach((stage, i) => {
        if (i > 0) {
            const arrow = document.createElement('span');
            arrow.className = 'evolution-arrow';
            arrow.setAttribute('aria-hidden', 'true');
            arrow.textContent = '→';
            evolutionChainContainer.appendChild(arrow);
        }
        const chainButton = document.createElement('button');
        chainButton.type = 'button';
        chainButton.classList.add('evolution-stage');
        if (currentDetailPokemon && currentDetailPokemon.name === stage.apiName) {
            chainButton.classList.add('evolution-current');
        }
        chainButton.innerHTML = `
            <img src="${stage.sprite}" alt="${stage.name}">
            <span>${stage.name}</span>
        `;
        chainButton.addEventListener('click', () => {
            pokemonInput.value = stage.apiName;
            search();
        });
        evolutionChainContainer.appendChild(chainButton);
    });
};

// Open detail: render the card, then load species + evolution chain
const showDetail = async (pokemonData) => {
    if (!pokemonData || !pokemonData.sprites) return;
    currentDetailPokemon = pokemonData;
    setAddToCompareLabel(compareList.some((p) => p.id === pokemonData.id));
    rememberViewed(pokemonData);
    renderDetail(pokemonData);
    setScreen('detail');
    updateDetailNav();
    const species = await loadSpeciesData(pokemonData.species.url);
    if (species && species.evolution_chain && species.evolution_chain.url) {
        loadEvolutionChain(species.evolution_chain.url, pokemonData.id);
    }

    renderMoves(pokemonData.moves);
};

// Level-up name + level only — already on the Pokémon, no extra fetch
const renderMoves = (moves) => {
    movesList.innerHTML = '';
    const levelUpMoves = [];
    moves.forEach((move) => {
        const levelUp = move.version_group_details.filter(
            (detail) => detail.move_learn_method.name === 'level-up'
        );
        if (levelUp.length === 0) return;
        const latest = levelUp[levelUp.length - 1];
        levelUpMoves.push({
            name: move.move.name,
            level: latest.level_learned_at
        });
    });
    levelUpMoves.sort((a, b) => a.level - b.level);
    if (levelUpMoves.length === 0) {
        movesList.innerHTML = '<li class="move-row">No level-up moves listed.</li>';
        return;
    }
    levelUpMoves.forEach((move) => {
        const item = document.createElement('li');
        item.className = 'move-row';
        item.innerHTML = `
            <span class="move-level">Lv. ${move.level}</span>
            <span class="move-name">${formatString(move.name)}</span>
        `;
        movesList.appendChild(item);
    });
};

// Walk nested evolves_to and return names in order (also handles branches like Eevee)
const collectEvolutionIds = (node, ids = []) => {
    ids.push(getIdFromUrl(node.species.url));
    node.evolves_to.forEach((next) => {
        collectEvolutionIds(next, ids);
    });
    return ids;
};

// Fetch the evolution chain and sprites; ignore the result if another Pokémon opened
const loadEvolutionChain = async (evolutionUrl, requestedId) => {
    try {
        const evolutionResponse = await fetch(evolutionUrl);
        if (!evolutionResponse.ok) return;
        const evolution = await evolutionResponse.json();
        const ids = collectEvolutionIds(evolution.chain);
        const details = await Promise.all(ids.map((id) => fetchPokemon(id)));
        // Ignore this result if the user already opened another Pokémon
        if (currentDetailPokemon && currentDetailPokemon.id !== requestedId) return;
        const stages = details
            .filter((data) => data && data.sprites)
            .map((data) => ({
                apiName: data.name,
                name: formatString(data.name),
                sprite: getPokemonSprite(data)
            }));
        renderEvolutionChain(stages);
    } catch (error) {
        console.error('Error fetching evolution chain:', error);
    }
};

// Fetch one ability URL and show its English short effect
const showAbilityDetail = async (name, url) => {
    abilityName.textContent = formatString(name);
    abilityDescription.textContent = 'Loading...';
    try {
        const response = await fetch(url);
        if (!response.ok) {
            abilityDescription.textContent = 'Could not load this ability.';
            return;
        }
        const data = await response.json();
        const entry = findEnglishEntry(data.effect_entries);
        abilityDescription.textContent = entry
            ? (entry.short_effect || entry.effect)
            : 'No English description found.';
    } catch (error) {
        console.error('Error fetching ability:', error);
        abilityDescription.textContent = 'Could not load this ability.';
    }
};

// Fetch species: set genus + flavor text, return the JSON for the evolution URL
const loadSpeciesData = async (speciesUrl) => {
    try {
        const response = await fetch(speciesUrl);
        if (!response.ok) return null;
        const species = await response.json();
        const genusEntry = findEnglishEntry(species.genera);
        if (genusEntry) {
            detailGenus.textContent = genusEntry.genus;
        }
        const flavorEntry = findEnglishEntry(species.flavor_text_entries);
        if (flavorEntry) {
            detailFlavor.textContent = flavorEntry.flavor_text.replace(/\f/g, ' ').replace(/\n/g, ' ');
        }
        return species;
    } catch (error) {
        console.error('Error fetching species data:', error);
        return null;
    }
};


/******************
 * Grid + search
 ******************/

// Create one grid card; click or Enter/Space opens detail
const renderPokemon = (pokemonData, listIndex) => {
    if (!pokemonData || !pokemonData.sprites) return;
    const pokemonCard = document.createElement('article');
    const name = formatString(pokemonData.name);
    pokemonCard.classList.add('card');
    pokemonCard.tabIndex = 0;
    pokemonCard.setAttribute('role', 'button');
    pokemonCard.setAttribute('aria-label', `View ${name}`);
    pokemonCard.innerHTML = `
    <img src="${getPokemonSprite(pokemonData)}" alt="${name}">
    <div class="pokemon-id">#${pokemonData.id}</div>
    <h2>${name}</h2>
    <div class="types">
        ${renderTypeBadges(pokemonData.types)}
    </div>
    `;

    const openDetail = () => {
        currentListIndex = listIndex;
        showDetail(pokemonData);
    };

    pokemonCard.addEventListener('click', openDetail);
    pokemonCard.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openDetail();
        }
    });

    pokemonGrid.appendChild(pokemonCard);
};

// Clear search and return to page 1 of the grid
const goToGrid = () => {
    pokemonInput.value = '';
    currentPage = 1;
    renderPokemonGrid();
};

// Update page number, range text, and disable grid Previous/Next at the ends
const updatePageInfo = () => {
    prevButtons.forEach((btn) => {
        btn.disabled = currentPage === 1;
    });
    nextButtons.forEach((btn) => {
        btn.disabled = currentPage === totalPages;
    });
    currentPageEls.forEach((el) => {
        el.textContent = currentPage;
    });
    const rangeStart = (currentPage - 1) * pageLimit + 1;
    const rangeEnd = Math.min(currentPage * pageLimit, totalCount);
    const rangeText = `Showing ${rangeStart.toLocaleString()}–${rangeEnd.toLocaleString()} of ${totalCount.toLocaleString()}`;
    pageRangeEls.forEach((el) => {
        el.textContent = rangeText;
    });
};

// Search by name or number; empty input reloads the grid
const search = async () => {
    const searchQuery = pokemonInput.value.trim().toLowerCase();
    currentPage = 1;
    pokemonGrid.innerHTML = '';

    // if the search query is empty, reload the grid
    if (!searchQuery) {
        renderPokemonGrid();
        return;
    }

    // set the screen to loading
    setScreen('loading');
    const pokemonData = await fetchPokemon(searchQuery);
    if (!pokemonData || !pokemonData.sprites) {
        searchQueryEl.textContent = searchQuery;
        setScreen('empty');
        return;
    }
    // if the current browse list is set, find the index of the pokemon in the list
    if (currentBrowseList) {
        const browseIndex = currentBrowseList.findIndex((item) => item.name === pokemonData.name);
        currentListIndex = browseIndex >= 0 ? browseIndex : 0;
    } else if (pokemonData.id < 10000) {
        // National Dex ids match list offset; form ids (10000+) do not
        currentListIndex = pokemonData.id - 1;
    }
    showDetail(pokemonData);
};

// Fetch the current page of names, then fetch each one's details and draw cards
const renderPokemonGrid = async () => {
    pokemonGrid.innerHTML = '';
    setScreen('loading');
    const generationId = generationFilter.value;
    const typeName = typeFilter.value;
    let pageResults;

    // Type and/or generation → build a custom browse list
    if (typeName || generationId) {
        let browseList = null;

        if (typeName && generationId) {
            // Both filters: Pokémon that are in this gen AND have this type
            const [typeList, genList] = await Promise.all([
                fetchTypePokemon(typeName),
                fetchGenerationPokemon(generationId)
            ]);
            if (!typeList || !genList) {
                setScreen('empty');
                return;
            }
            const genNames = genList.map((p) => p.name);
            browseList = typeList.filter((p) => genNames.includes(p.name));
        } else if (typeName) {
            browseList = await fetchTypePokemon(typeName);
        } else {  
            browseList = await fetchGenerationPokemon(generationId);
        }

        if (!browseList) {
            setScreen('empty');
            return;
        }

        currentBrowseList = browseList;
        setBrowseTotals(browseList.length);
        const start = (currentPage - 1) * pageLimit;
        pageResults = browseList.slice(start, start + pageLimit);
    } else {
        // No filters → normal national dex pagination
        currentBrowseList = null;
        const pokemonList = await fetchPokemonList(currentPage);
        if (!pokemonList || !pokemonList.results) {
            setScreen('empty');
            return;
        }
        pageResults = pokemonList.results;
    }
    const details = await Promise.all(
        pageResults.map((pokemon) => fetchPokemon(pokemon.name))
    );

    // Unique types on this page, for the page-only type dropdown
    pokemonTypes = [];
    details.forEach((pokemon) => {
        if (!pokemon || !pokemon.types) return;
        pokemon.types.forEach((type) => {
            if (!pokemonTypes.includes(type.type.name)) {
                pokemonTypes.push(type.type.name);
            }
        });
    });

    fillTypeFilterOptions();    
    currentPagePokemon = details.map((pokemonData, i) => ({
        data: pokemonData,
        listIndex: (currentPage - 1) * pageLimit + i
    })).filter((item) => item.data && item.data.sprites);
    pageFilterInput.value = '';
    pageFilterType.value = '';
    setScreen('grid');
    applyPageFilter();
    updatePageInfo();
};

// Filter the cards already on this page — no extra API request
const applyPageFilter = () => {
    const query = pageFilterInput.value.trim().toLowerCase();
    const type = pageFilterType.value;
    const matches = currentPagePokemon.filter((item) => {
        const pokemonData = item.data;
        const matchesText = !query ||
            pokemonData.name.includes(query) ||
            String(pokemonData.id).includes(query);
        const matchesType = !type ||
            pokemonData.types.some((t) => t.type.name === type);
        return matchesText && matchesType;
    });
    pokemonGrid.innerHTML = '';
    if (matches.length === 0) {
        pokemonGrid.innerHTML = '<p class="page-filter-empty">No matches on this page.</p>';
        return;
    }
    matches.forEach((item) => {
        renderPokemon(item.data, item.listIndex);
    });
};

// Move Next or previous pokemon (step is -1 or 1) for detail page and open that Pokémon
const goToNeighbor = async (step) => {
    // Form / variant IDs (10000+) are not the same as national list offsets.
    // After searching e.g. 10004, prev/next should go to 10003 / 10005 by id.
    if (!currentBrowseList && currentDetailPokemon && currentDetailPokemon.id >= 10000) {
        const nextId = currentDetailPokemon.id + step;
        if (nextId < 10001) return;
        updateDetailNav(true);
        setScreen('loading');
        const data = await fetchPokemon(String(nextId));
        if (!data || !data.sprites) {
            setScreen('detail');
            updateDetailNav();
            return;
        }
        showDetail(data);
        return;
    }

    const nextIndex = currentListIndex + step;
    if (nextIndex < 0 || nextIndex >= totalCount) return;
    updateDetailNav(true);
    setScreen('loading');
    const data = await fetchPokemonAtIndex(nextIndex);
    if (!data || !data.sprites) {
        setScreen('detail');
        updateDetailNav();
        return;
    }
    currentListIndex = nextIndex;
    showDetail(data);
};

// Move one Next or Previous grid page (step is -1 or 1)
const changePage = (step) => {
    // get the next page
    const nextPage = currentPage + step;
    // if the next page is out of bounds, return
    if (nextPage < 1 || nextPage > totalPages) return;
    // set the current page
    currentPage = nextPage;
    // render the pokemon grid
    renderPokemonGrid();
};

// Global all types Fill the type dropdown from the API
const fillAllTypeFilterOptions = async () => {
    const types = await fetchTypeList();
    types.forEach((type) => {
        // ignore unknown and stellar types
        if (type.name === 'unknown' || type.name === 'stellar') return;
        const option = document.createElement('option');
        option.value = type.name;
        option.textContent = formatString(type.name);
        typeFilter.appendChild(option);
    });
};

// Start the app: set compare button state and load the first grid page
// Fill the generation dropdown from the API (keep the All option)
const fillGenerationOptions = async () => {
    const generations = await fetchGenerationList();
    const details = await Promise.all(
        generations.map((generation) => fetchGenerationData(getIdFromUrl(generation.url)))
    );
    details.forEach((data) => {
        if (!data) return;
        const option = document.createElement('option');
        option.value = String(data.id);
        const region = formatString(data.main_region.name);
        const genName = findEnglishEntry(data.names)?.name || formatString(data.name);
        option.textContent = `${region} (${genName})`;
        generationFilter.appendChild(option);
    });
};

const fillTypeFilterOptions = () => {
    pageFilterType.innerHTML = '';
    const option = document.createElement('option');
    option.value = '';
    option.textContent = 'All Types';
    pageFilterType.appendChild(option);
    pokemonTypes.forEach((type) => {
        const option = document.createElement('option');
        option.value = type;
        option.textContent = formatString(type);
        pageFilterType.appendChild(option);
    });
};

/******************
 * Event listeners
 ******************/

compareButton.addEventListener('click', () => {
    renderCompare();
    setScreen('compare');
});

addToCompareButton.addEventListener('click', () => {
    addToCompare(currentDetailPokemon);
});

compareBackButton.addEventListener('click', () => {
    renderPokemonGrid();
});

randomButton.addEventListener('click', async () => {
    setScreen('loading');
    const randomIndex = Math.floor(Math.random() * totalCount);
    currentListIndex = randomIndex;
    const data = await fetchPokemonAtIndex(randomIndex);
    if (!data || !data.sprites) {
        setScreen('grid');
        return;
    }
    showDetail(data);
});

detailPrevButton.addEventListener('click', () => {
    goToNeighbor(-1);
});

detailNextButton.addEventListener('click', () => {
    goToNeighbor(1);
});

detailBackButton.addEventListener('click', () => {
    pokemonInput.value = '';
    currentPage = Math.floor(currentListIndex / pageLimit) + 1;
    renderPokemonGrid();
});

noResultsBackButton.addEventListener('click', goToGrid);

brandEl.addEventListener('click', (e) => {
    e.preventDefault();
    goToGrid();
});

prevButtons.forEach((btn) => {
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        changePage(-1);
    });
});

nextButtons.forEach((btn) => {
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        changePage(1);
    });
});

searchForm.addEventListener('submit', (e) => {
    e.preventDefault();
    search();
});

pageFilterInput.addEventListener('input', applyPageFilter);
pageFilterType.addEventListener('change', applyPageFilter);

generationFilter.addEventListener('change', () => {
    currentPage = 1;
    renderPokemonGrid();
});

typeFilter.addEventListener('change', () => {
    currentPage = 1;
    renderPokemonGrid();
});

// main function to start the app
const main = async () => {
    updateCompareHeaderButton();
    fillGenerationOptions();
    fillAllTypeFilterOptions();
    renderPokemonGrid();
};

// Start the app
main();
