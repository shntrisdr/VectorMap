const API_BASE = 'http://localhost:8000';

let movieData = [];
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
async function initMap() {
    try {
        const response = await fetch(`${API_BASE}/map`);
        const data = await response.json();
        movieData = data.map_data;
        renderChart(movieData);
    } catch (error) {
        console.error("Failed to load map data:", error);
    }
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
async function handleSearch() {
    const query = searchInput.value.trim();
    if (!query) {
        searchResults.classList.add('hidden');
        renderChart(movieData); // Reset to full map
        return;
    }

    try {
        const response = await fetch(`${API_BASE}/search?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        displaySearchResults(data.results);
        
        // Highlight search results on map
        const resultIds = new Set(data.results.map(r => r.id));
        highlightMapPoints(resultIds);
    } catch (error) {
        console.error("Search failed:", error);
    }
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
                renderChart(movieData); // Reset chart to clear search highlights, vector state will be maintained
            });
            searchResults.appendChild(div);
        });
    }
    searchResults.classList.remove('hidden');
}

function highlightMapPoints(highlightIds) {
    if (!chartInstance) return;
    
    const colors = movieData.map(m => highlightIds.has(m.id) ? '#e74c3c' : '#bdc3c7');
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

// Relation Logic
async function getRelation() {
    if (selectedMovies.length !== 2) return;

    getRelationBtn.disabled = true;
    getRelationBtn.textContent = 'Analyzing...';
    relationResult.classList.add('hidden');

    try {
        const response = await fetch(`${API_BASE}/relation?id1=${selectedMovies[0].id}&id2=${selectedMovies[1].id}`);
        const data = await response.json();
        
        relationResult.innerHTML = `<strong>Semantic Match:</strong> ${(data.similarity * 100).toFixed(1)}%<br><br>${data.relation_explanation}`;
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
