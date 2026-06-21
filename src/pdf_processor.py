import os
import re
import numpy as np
from typing import List
from pypdf import PdfReader
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


class DocumentAssistant:
    def __init__(self, base_dir: str):
        self.base_dir = base_dir
        self.upload_dir = os.path.join(self.base_dir, "data", "uploads")
        self.processed_dir = os.path.join(self.base_dir, "data", "processed")
        os.makedirs(self.upload_dir, exist_ok=True)
        os.makedirs(self.processed_dir, exist_ok=True)

        self.document_name = None
        self.page_count = 0
        self.pages = []
        self.chunks = []
        self.embeddings = None
        self.has_document = False

        self.vectorizer = TfidfVectorizer(stop_words="english")

    def _clean_text(self, text: str) -> str:
        text = text.replace("\r\n", "\n").strip()
        text = "\n".join(line.strip() for line in text.splitlines() if line.strip())
        text = re.sub(r"\s+", " ", text)
        return text

    def _extract_pages(self, filepath: str) -> List[dict]:
        reader = PdfReader(filepath)
        pages = []
        for page_number, page in enumerate(reader.pages, start=1):
            text = page.extract_text() or ""
            pages.append({"page": page_number, "text": text})
        return pages

    def _chunk_pages(self, pages: List[dict]) -> List[dict]:
        chunks = []
        chunk_id = 0
        for page in pages:
            text = self._clean_text(page["text"])
            if not text:
                continue
            window = 700
            overlap = 150
            start = 0
            while start < len(text):
                chunk_text = text[start : start + window].strip()
                if chunk_text:
                    chunks.append({
                        "chunk_id": chunk_id,
                        "page": page["page"],
                        "text": chunk_text,
                    })
                    chunk_id += 1
                start += window - overlap
        return chunks

    def _build_embeddings(self, texts: List[str]) -> np.ndarray:
        if not texts:
            return np.zeros((0, 1), dtype=np.float32)
        matrix = self.vectorizer.fit_transform(texts)
        return matrix.toarray().astype(np.float32)

    def _count_words(self, text: str) -> int:
        return len(re.findall(r"\w+", text))

    def _count_sentences(self, text: str) -> int:
        sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]
        return max(1, len(sentences))

    def _count_syllables(self, word: str) -> int:
        word = word.lower()
        patterns = re.findall(r"[aeiouy]+", word)
        count = len(patterns)
        if word.endswith("e") and len(patterns) > 1:
            count -= 1
        return max(1, count)

    def _flesch_reading_ease(self, text: str) -> float:
        words = re.findall(r"\w+", text)
        sentence_count = self._count_sentences(text)
        syllable_count = sum(self._count_syllables(word) for word in words)
        if not words:
            return 0.0
        score = 206.835 - 1.015 * (len(words) / sentence_count) - 84.6 * (syllable_count / len(words))
        return round(max(0.0, min(100.0, score)), 1)

    def _top_phrases(self, text: str, top_n: int = 8) -> List[str]:
        try:
            from sklearn.feature_extraction.text import CountVectorizer
        except ImportError:
            return []

        vectorizer = CountVectorizer(
            stop_words="english",
            ngram_range=(2, 2),
            max_features=top_n,
        )
        matrix = vectorizer.fit_transform([text])
        phrases = vectorizer.get_feature_names_out()
        counts = matrix.toarray().flatten()
        ranked = sorted(zip(phrases, counts), key=lambda x: -x[1])
        return [phrase for phrase, _ in ranked]

    def _avg_chunk_length(self) -> float:
        if not self.chunks:
            return 0.0
        lengths = [len(chunk["text"]) for chunk in self.chunks]
        return round(sum(lengths) / len(lengths), 1)

    def _extract_sections(self, text: str) -> List[str]:
        matches = re.findall(r"\bSection\s+\d+[A-Za-z\-]*\b|\b(?:Code of Civil Procedure|CPC|Limitation Act|FEMA|IBC)\b", text, re.IGNORECASE)
        return [m.strip() for m in matches][:12]

    def _page_preview(self) -> str:
        if not self.pages:
            return ""
        first_page = self.pages[0]["text"]
        text = self._clean_text(first_page)
        sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text) if s.strip()]
        return " ".join(sentences[:3])

    def load_pdf(self, filepath: str) -> dict:
        if not os.path.exists(filepath):
            raise FileNotFoundError("Uploaded document could not be found.")

        self.document_name = os.path.basename(filepath)
        pages = self._extract_pages(filepath)
        self.page_count = len(pages)
        self.pages = pages

        if self.page_count == 0:
            raise ValueError("Unable to read any pages from the PDF.")

        self.chunks = self._chunk_pages(pages)
        texts = [chunk["text"] for chunk in self.chunks]
        self.embeddings = self._build_embeddings(texts)
        self.document_text = "\n\n".join(texts)
        self.has_document = True

        return {
            "document_name": self.document_name,
            "page_count": self.page_count,
            "chunk_count": len(self.chunks),
        }

    def summarize(self, max_sentences: int = 4) -> str:
        if not self.has_document:
            return "No document loaded."

        sentences = re.split(r"(?<=[.!?])\s+", self.document_text)
        sentences = [s.strip() for s in sentences if len(s.strip()) > 20]
        summary_sentences = sentences[:max_sentences]
        return " ".join(summary_sentences) if summary_sentences else "No summary available."

    def extract_keywords(self, top_n: int = 12) -> List[str]:
        if not self.has_document:
            return []

        feature_array = self.vectorizer.get_feature_names_out()
        if self.embeddings is None:
            return []

        importance = np.asarray(self.embeddings).mean(axis=0)
        top_indices = np.argsort(importance)[::-1][:top_n]
        return [feature_array[idx] for idx in top_indices if idx < len(feature_array)]

    def retrieve(self, query: str, top_k: int = 5) -> List[dict]:
        if not self.has_document or self.embeddings is None:
            raise RuntimeError("No document is loaded. Upload a PDF first.")

        query_vec = self.vectorizer.transform([query]).toarray().astype(np.float32)
        similarity = cosine_similarity(self.embeddings, query_vec).flatten()
        ranking = np.argsort(similarity)[::-1][:top_k]

        return [
            {
                "score": float(similarity[idx]),
                "chunk_id": int(self.chunks[idx]["chunk_id"]),
                "page": int(self.chunks[idx]["page"]),
                "text": self.chunks[idx]["text"],
            }
            for idx in ranking
        ]

    def ask(self, question: str) -> dict:
        retrieval = self.retrieve(question, top_k=5)
        answer = "\n\n".join(
            f"Page {chunk['page']}: {chunk['text']}"
            for chunk in retrieval
        )
        if not answer:
            answer = "No relevant content could be retrieved from the uploaded document."

        return {
            "answer": answer,
            "retrieved": retrieval,
        }
