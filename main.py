from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import numpy as np
from sentence_transformers import SentenceTransformer
import umap
from sklearn.metrics.pairwise import cosine_similarity
import warnings

# Suppress umap warnings
warnings.filterwarnings('ignore')

app = FastAPI()

# Allow CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mock Movie Data
MOCK_MOVIES = [
    {"id": 1, "title": "Inception", "genre": "Sci-Fi", "overview": "A thief who steals corporate secrets through the use of dream-sharing technology is given the inverse task of planting an idea into the mind of a C.E.O., but his tragic past may doom the project and his team to disaster."},
    {"id": 2, "title": "Interstellar", "genre": "Sci-Fi", "overview": "When Earth becomes uninhabitable in the future, a farmer and ex-NASA pilot, Joseph Cooper, is tasked to pilot a spacecraft, along with a team of researchers, to find a new planet for humans."},
    {"id": 3, "title": "The Matrix", "genre": "Sci-Fi", "overview": "When a beautiful stranger leads computer hacker Neo to a forbidding underworld, he discovers the shocking truth--the life he knows is the elaborate deception of an evil cyber-intelligence."},
    {"id": 4, "title": "The Dark Knight", "genre": "Action", "overview": "When the menace known as the Joker wreaks havoc and chaos on the people of Gotham, Batman must accept one of the greatest psychological and physical tests of his ability to fight injustice."},
    {"id": 5, "title": "Pulp Fiction", "genre": "Crime", "overview": "The lives of two mob hitmen, a boxer, a gangster and his wife, and a pair of diner bandits intertwine in four tales of violence and redemption."},
    {"id": 6, "title": "Forrest Gump", "genre": "Drama", "overview": "The presidencies of Kennedy and Johnson, the Vietnam War, the Watergate scandal and other historical events unfold from the perspective of an Alabama man with an IQ of 75, whose only desire is to be reunited with his childhood sweetheart."},
    {"id": 7, "title": "Spirited Away", "genre": "Animation", "overview": "During her family's move to the suburbs, a sullen 10-year-old girl wanders into a world ruled by gods, witches, and spirits, and where humans are changed into beasts."},
    {"id": 8, "title": "Parasite", "genre": "Thriller", "overview": "Greed and class discrimination threaten the newly formed symbiotic relationship between the wealthy Park family and the destitute Kim clan."},
    {"id": 9, "title": "The Godfather", "genre": "Crime", "overview": "The aging patriarch of an organized crime dynasty in postwar New York City transfers control of his clandestine empire to his reluctant youngest son."},
    {"id": 10, "title": "Avengers: Endgame", "genre": "Action", "overview": "After the devastating events of Infinity War, the universe is in ruins. With the help of remaining allies, the Avengers assemble once more in order to reverse Thanos' actions and restore balance to the universe."},
    {"id": 11, "title": "Toy Story", "genre": "Animation", "overview": "A cowboy doll is profoundly threatened and jealous when a new spaceman action figure supplants him as top toy in a boy's bedroom."},
    {"id": 12, "title": "WALL-E", "genre": "Animation", "overview": "In the distant future, a small waste-collecting robot inadvertently embarks on a space journey that will ultimately decide the fate of mankind."},
    {"id": 13, "title": "Blade Runner 2049", "genre": "Sci-Fi", "overview": "Young Blade Runner K's discovery of a long-buried secret leads him to track down former Blade Runner Rick Deckard, who's been missing for thirty years."},
    {"id": 14, "title": "Gladiator", "genre": "Action", "overview": "A former Roman General sets out to exact vengeance against the corrupt emperor who murdered his family and sent him into slavery."},
    {"id": 15, "title": "The Silence of the Lambs", "genre": "Thriller", "overview": "A young F.B.I. cadet must receive the help of an incarcerated and manipulative cannibal killer to help catch another serial killer, a madman who skins his victims."}
]

# State variables
movie_vectors = []
movie_coords = []
movie_data_dict = {}

@app.on_event("startup")
async def startup_event():
    global movie_coords, movie_vectors, movie_data_dict
    print("Loading SentenceTransformer model...")
    # Use a small, fast model
    model = SentenceTransformer('all-MiniLM-L6-v2')

    print("Vectorizing movie overviews...")
    overviews = [m["overview"] for m in MOCK_MOVIES]
    vectors = model.encode(overviews)
    movie_vectors = vectors

    print("Reducing dimensions with UMAP...")
    # UMAP parameters adjusted for a very small dataset
    reducer = umap.UMAP(n_neighbors=5, min_dist=0.3, random_state=42)
    coords = reducer.fit_transform(vectors)

    for i, movie in enumerate(MOCK_MOVIES):
        movie_data_dict[movie["id"]] = {
            **movie,
            "x": float(coords[i][0]),
            "y": float(coords[i][1]),
            "vector_idx": i
        }
    print("Startup complete. Data ready.")

@app.get("/map")
async def get_map():
    return {"map_data": list(movie_data_dict.values())}

@app.get("/search")
async def search_movies(q: str):
    q_lower = q.lower()
    results = []
    for movie in movie_data_dict.values():
        if q_lower in movie["title"].lower() or q_lower in movie["genre"].lower():
            results.append(movie)
    return {"results": results}

@app.get("/relation")
async def get_relation(id1: int, id2: int):
    if id1 not in movie_data_dict or id2 not in movie_data_dict:
        raise HTTPException(status_code=404, detail="Movie not found")

    m1 = movie_data_dict[id1]
    m2 = movie_data_dict[id2]

    idx1 = m1["vector_idx"]
    idx2 = m2["vector_idx"]

    v1 = movie_vectors[idx1].reshape(1, -1)
    v2 = movie_vectors[idx2].reshape(1, -1)

    # Calculate cosine similarity
    similarity = cosine_similarity(v1, v2)[0][0]

    # Mock LLM explanation
    if similarity > 0.6:
        explanation = f"Both '{m1['title']}' and '{m2['title']}' share highly similar themes, likely revolving around common concepts found in their overviews. They might explore similar philosophical ideas or take place in related settings."
    elif similarity > 0.3:
        explanation = f"'{m1['title']}' and '{m2['title']}' have some thematic overlap. While their main plots differ, they share underlying motifs or genres."
    else:
        explanation = f"'{m1['title']}' and '{m2['title']}' are quite different in their core concepts and narratives. One focuses on '{m1['genre']}' elements, while the other leans towards '{m2['genre']}'."

    # Additional simple heuristic based on genre
    if m1['genre'] == m2['genre']:
        explanation += f" However, they both belong to the {m1['genre']} genre, which explains some structural similarities."

    return {
        "similarity": float(similarity),
        "relation_explanation": explanation
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
