let chartInstance = null;
let selectedMovies = []; // Max 2

// DOM Elements
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const searchResults = document.getElementById('search-results');
const movie1Info = document.getElementById('movie1-info');
const movie2Info = document.getElementById('movie2-info');
const getRelationBtn = document.getElementById('get-relation-btn');
const relationResult = document.getElementById('relation-result');
const selectionInfo = document.getElementById('selection-info');

// Initialize Map
function initMap() {
    renderChart(MOVIE_DATA);
}

// Render Chart.js Scatter Plot
function renderChart(data) {
    const ctx = document.getElementById('movieMap').getContext('2d');
    
    const scatterData = data.map(m => ({
        x: m.x,
        y: m.y,
        movie: m // attach full object for tooltip/click
    }));

    // Maintain vector line state
    let vectorData = [];
    if (selectedMovies.length === 2) {
        vectorData = [
            { x: selectedMovies[0].x, y: selectedMovies[0].y },
            { x: selectedMovies[1].x, y: selectedMovies[1].y }
        ];
    }

    if (chartInstance) {
        chartInstance.destroy();
    }

    chartInstance = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [
                {
                    label: 'Movies',
                    data: scatterData,
                    backgroundColor: '#3498db',
                    pointRadius: 6,
                    pointHoverRadius: 8,
                    order: 2
                },
                {
                    label: 'Relation Vector',
                    data: vectorData,
                    type: 'line',
                    borderColor: '#e74c3c',
                    borderWidth: 2,
                    pointRadius: 0,
                    showLine: true,
                    order: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            if (context.datasetIndex === 1) return null; // hide tooltip for line
                            const movie = context.raw.movie;
                            return `${movie.title} (${movie.genre})`;
                        }
                    }
                },
                legend: { display: false },
                zoom: {
                    zoom: {
                        wheel: {
                            enabled: true,
                        },
                        pinch: {
                            enabled: true
                        },
                        mode: 'xy',
                    },
                    pan: {
                        enabled: true,
                        mode: 'xy',
                    }
                }
            },
            onClick: (event, elements) => {
                if (elements.length > 0) {
                    const idx = elements[0].datasetIndex;
                    if (idx === 0) {
                        const index = elements[0].index;
                        const movie = chartInstance.data.datasets[0].data[index].movie;
                        handleMovieSelect(movie);
                    }
                }
            }
        }
    });
}

// Search Logic
function handleSearch() {
    const query = searchInput.value.trim().toLowerCase();
    if (!query) {
        searchResults.classList.add('hidden');
        renderChart(MOVIE_DATA); // Reset to full map
        return;
    }

    const results = MOVIE_DATA.filter(movie =>
        movie.title.toLowerCase().includes(query) ||
        movie.genre.toLowerCase().includes(query)
    );
    displaySearchResults(results);

    // Highlight search results on map
    const resultIds = new Set(results.map(r => r.id));
    highlightMapPoints(resultIds);
}

function displaySearchResults(results) {
    searchResults.innerHTML = '';
    if (results.length === 0) {
        searchResults.innerHTML = '<div class="search-result-item">No results found.</div>';
    } else {
        results.forEach(movie => {
            const div = document.createElement('div');
            div.className = 'search-result-item';
            div.textContent = `${movie.title} (${movie.genre})`;
            div.addEventListener('click', () => {
                handleMovieSelect(movie);
                searchInput.value = ''; // Clear search to reset highlights
                searchResults.classList.add('hidden');
                renderChart(MOVIE_DATA); // Reset chart to clear search highlights, vector state will be maintained
            });
            searchResults.appendChild(div);
        });
    }
    searchResults.classList.remove('hidden');
}

function highlightMapPoints(highlightIds) {
    if (!chartInstance) return;
    
    const colors = MOVIE_DATA.map(m => highlightIds.has(m.id) ? '#e74c3c' : '#bdc3c7');
    chartInstance.data.datasets[0].backgroundColor = colors;
    chartInstance.update();
}

// Selection Logic
function handleMovieSelect(movie) {
    // Prevent adding the same movie twice
    if (selectedMovies.find(m => m.id === movie.id)) return;

    if (selectedMovies.length >= 2) {
        // Shift logic: remove first, add to end
        selectedMovies.shift();
    }
    selectedMovies.push(movie);
    updateSelectionUI();

    // Re-apply highlights if needed (clear previous search highlight if any)
    if (chartInstance && searchInput.value.trim() !== '') {
        // Option 1: Keep search highlights, just highlight selection.
        // For simplicity, let's just make sure the selected movies are visually distinct or we leave it.
        // For now, updating the selection UI draws the line. 
    } else {
        // If search is empty, just reset highlights to default
        highlightMapPoints(new Set());
    }
}

function updateSelectionUI() {
    if (selectedMovies.length === 0) {
        movie1Info.classList.remove('active');
        movie2Info.classList.remove('active');
        getRelationBtn.classList.add('hidden');
        relationResult.classList.add('hidden');
        selectionInfo.style.display = 'block';
        
        // Clear vector line
        if (chartInstance) {
            chartInstance.data.datasets[1].data = [];
            chartInstance.update();
        }
        return;
    }

    selectionInfo.style.display = 'none';
    
    if (selectedMovies[0]) {
        movie1Info.innerHTML = `<strong>1: ${selectedMovies[0].title}</strong><br><small>${selectedMovies[0].genre}</small>`;
        movie1Info.classList.add('active');
        
        // Clear vector line if only 1 is selected
        if (chartInstance && selectedMovies.length === 1) {
            chartInstance.data.datasets[1].data = [];
            chartInstance.update();
        }
    }
    
    if (selectedMovies[1]) {
        movie2Info.innerHTML = `<strong>2: ${selectedMovies[1].title}</strong><br><small>${selectedMovies[1].genre}</small>`;
        movie2Info.classList.add('active');
        getRelationBtn.classList.remove('hidden');
        
        // Draw vector line between the two selected movies
        if (chartInstance) {
            chartInstance.data.datasets[1].data = [
                { x: selectedMovies[0].x, y: selectedMovies[0].y },
                { x: selectedMovies[1].x, y: selectedMovies[1].y }
            ];
            chartInstance.update();
        }
    } else {
        movie2Info.classList.remove('active');
        getRelationBtn.classList.add('hidden');
    }

    relationResult.classList.add('hidden');
}

function cosineSimilarity(vecA, vecB) {
    let dotProduct = 0.0;
    let normA = 0.0;
    let normB = 0.0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Relation Logic
function getRelation() {
    if (selectedMovies.length !== 2) return;

    getRelationBtn.disabled = true;
    getRelationBtn.textContent = 'Analyzing...';
    relationResult.classList.add('hidden');

    try {
        const m1 = selectedMovies[0];
        const m2 = selectedMovies[1];
        
        const similarity = cosineSimilarity(m1.vector, m2.vector);

        // Mock LLM explanation logic moved to JS
        let explanation = "";
        if (similarity > 0.6) {
            explanation = `Both '${m1.title}' and '${m2.title}' share highly similar themes, likely revolving around common concepts found in their overviews. They might explore similar philosophical ideas or take place in related settings.`;
        } else if (similarity > 0.3) {
            explanation = `'${m1.title}' and '${m2.title}' have some thematic overlap. While their main plots differ, they share underlying motifs or genres.`;
        } else {
            explanation = `'${m1.title}' and '${m2.title}' are quite different in their core concepts and narratives. One focuses on '${m1.genre}' elements, while the other leans towards '${m2.genre}'.`;
        }

        if (m1.genre === m2.genre) {
            explanation += ` However, they both belong to the ${m1.genre} genre, which explains some structural similarities.`;
        }

        relationResult.innerHTML = `<strong>Semantic Match:</strong> ${(similarity * 100).toFixed(1)}%<br><br>${explanation}`;
        relationResult.classList.remove('hidden');
    } catch (error) {
        console.error("Failed to get relation:", error);
        relationResult.innerHTML = "Error computing relationship.";
        relationResult.classList.remove('hidden');
    } finally {
        getRelationBtn.disabled = false;
        getRelationBtn.textContent = 'Explain Relation';
    }
}

// Event Listeners
searchBtn.addEventListener('click', handleSearch);
searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSearch();
});

// Close search results when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('#search-section')) {
        searchResults.classList.add('hidden');
    }
});

getRelationBtn.addEventListener('click', getRelation);

// Boot
window.onload = initMap;
