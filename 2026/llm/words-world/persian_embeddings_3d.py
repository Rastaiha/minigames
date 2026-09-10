#!/usr/bin/env python3
"""
Download pretrained Persian fastText word vectors, keep Persian-only tokens,
reduce them to 3D using t-SNE (nonlinear)

Output:
    persian_word_embeddings_3d.csv

Install dependencies:
    pip install numpy pandas scikit-learn requests tqdm

Usage:
    python persian_embeddings_3d.py

Notes:
- The official fastText Persian Wikipedia vectors are 300-dimensional.
- Vocabulary is ordered roughly by frequency, so taking the first N valid
  Persian words gives a useful set of relatively common words.
- t-SNE can be slow for very large N. 5,000 is a reasonable default.
"""

import re
from pathlib import Path

import numpy as np
import pandas as pd
import requests
from sklearn.manifold import TSNE
from sklearn.preprocessing import normalize
from tqdm import tqdm


# ---------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------

FASTTEXT_URL = (
    "https://dl.fbaipublicfiles.com/fasttext/vectors-wiki/wiki.fa.vec"
)

VECTOR_FILE = Path("wiki.fa.vec")
OUTPUT_CSV = Path("persian_word_embeddings_3d.csv")

# Number of Persian words to keep.
# Increase if you want, but t-SNE runtime grows substantially.
MAX_WORDS = 5000

RANDOM_STATE = 42

# Require tokens to consist only of Persian/Arabic-script letters and ZWNJ.
# This intentionally excludes numbers, punctuation, Latin characters, etc.
PERSIAN_TOKEN_RE = re.compile(
    r"^[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\u200c]+$"
)


# ---------------------------------------------------------------------
# Download
# ---------------------------------------------------------------------

def download_file(url: str, output_path: Path) -> None:
    if output_path.exists():
        print(f"Using existing file: {output_path}")
        return

    print(f"Downloading:\n  {url}")
    with requests.get(url, stream=True, timeout=60) as response:
        response.raise_for_status()
        total = int(response.headers.get("content-length", 0))

        with output_path.open("wb") as f, tqdm(
            total=total,
            unit="B",
            unit_scale=True,
            desc=output_path.name,
        ) as progress:
            for chunk in response.iter_content(chunk_size=1024 * 1024):
                if chunk:
                    f.write(chunk)
                    progress.update(len(chunk))


# ---------------------------------------------------------------------
# Persian token filtering
# ---------------------------------------------------------------------

def is_persian_word(word: str) -> bool:
    if not word:
        return False

    # Remove ZWNJ only for the "contains actual Persian letters" test.
    letters_only = word.replace("\u200c", "")

    if not letters_only:
        return False

    if not PERSIAN_TOKEN_RE.fullmatch(word):
        return False

    # Exclude Arabic/Persian punctuation that happens to lie in same block.
    return all(
        ch == "\u200c" or ch.isalpha()
        for ch in word
    )


# ---------------------------------------------------------------------
# Load only the first MAX_WORDS Persian words
# ---------------------------------------------------------------------

def load_persian_vectors(path: Path, max_words: int):
    words = []
    vectors = []

    print("Reading vectors and filtering Persian words...")

    with path.open("r", encoding="utf-8", errors="ignore") as f:
        header = f.readline().strip().split()

        # fastText .vec files normally begin with:
        # <vocabulary_size> <embedding_dimension>
        if len(header) == 2 and all(x.isdigit() for x in header):
            expected_dim = int(header[1])
        else:
            # Rare fallback if the file has no header.
            expected_dim = None
            f.seek(0)

        for line in tqdm(f, desc="Filtering", unit="words"):
            parts = line.rstrip().split()

            if len(parts) < 2:
                continue

            word = parts[0]

            if not is_persian_word(word):
                continue

            try:
                vector = np.asarray(parts[1:], dtype=np.float32)
            except ValueError:
                continue

            if expected_dim is not None and len(vector) != expected_dim:
                continue

            words.append(word)
            vectors.append(vector)

            if len(words) >= max_words:
                break

    if not vectors:
        raise RuntimeError("No Persian vectors were found.")

    X = np.vstack(vectors)

    print(f"Loaded {len(words):,} Persian words.")
    print(f"Original embedding dimension: {X.shape[1]}")

    return words, X


# ---------------------------------------------------------------------
# Dimensionality reduction
# ---------------------------------------------------------------------

def reduce_embeddings(X: np.ndarray):
    # L2 normalization is usually helpful when working with semantic
    # word-vector geometry because cosine similarity is commonly used.
    X_norm = normalize(X, norm="l2")

    print("Running t-SNE -> 3D...")
    tsne = TSNE(
        n_components=3,
        perplexity=min(30, max(5, (len(X_norm) - 1) // 3)),
        init="pca",
        learning_rate="auto",
        max_iter=1000,
        metric="cosine",
        random_state=RANDOM_STATE,
        verbose=1,
    )
    X_tsne = tsne.fit_transform(X_norm)

    return X_tsne


# ---------------------------------------------------------------------
# Save
# ---------------------------------------------------------------------

def save_csv(words, X_tsne, output_path: Path):
    df = pd.DataFrame(
        {
            "word": words,
            "tsne_x": X_tsne[:, 0],
            "tsne_y": X_tsne[:, 1],
            "tsne_z": X_tsne[:, 2],
        }
    )

    df.to_csv(output_path, index=False, encoding="utf-8-sig")

    print(f"\nSaved: {output_path.resolve()}")
    print(df.head(10).to_string(index=False))


def main():
    download_file(FASTTEXT_URL, VECTOR_FILE)

    words, X = load_persian_vectors(
        VECTOR_FILE,
        max_words=MAX_WORDS,
    )

    X_tsne = reduce_embeddings(X)

    save_csv(
        words,
        X_tsne,
        OUTPUT_CSV,
    )


if __name__ == "__main__":
    main()
