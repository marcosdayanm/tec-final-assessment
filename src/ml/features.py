import re
from typing import Any

import pandas as pd
from sklearn.base import BaseEstimator, TransformerMixin


class FeatureBuilder(BaseEstimator, TransformerMixin):
    FEATURE_COLUMNS = [
        "clean_text",
        "message_length",
        "word_count",
        "digit_count",
        "exclamation_count",
    ]
    NUMERIC_COLUMNS = FEATURE_COLUMNS[1:]
    _URL_RE = re.compile(r"(https?://\S+|www\.\S+)")
    _EMAIL_RE = re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b")
    _PHONE_RE = re.compile(r"(\+?\d[\d\-\s().]{6,}\d)")

    def fit(self, X: Any, y: Any = None) -> "FeatureBuilder":
        return self

    def transform(self, X: Any) -> pd.DataFrame:
        return self._build_feature_frame(self._extract_messages(X))

    def _extract_messages(self, X: Any) -> list[str]:
        if isinstance(X, pd.DataFrame):
            if "TEXT" in X.columns:
                return X["TEXT"].astype(str).tolist()
            return X.iloc[:, 0].astype(str).tolist()
        if isinstance(X, pd.Series):
            return X.astype(str).tolist()
        return [str(message) for message in X]

    def _build_feature_frame(self, messages: list[str]) -> pd.DataFrame:
        message_series = pd.Series(messages, dtype="string")
        frame = pd.DataFrame({"TEXT": message_series.fillna("")})
        frame["clean_text"] = frame["TEXT"].map(self._clean_text)
        frame["message_length"] = frame["TEXT"].str.len()
        frame["word_count"] = frame["TEXT"].str.split().map(len)
        frame["digit_count"] = frame["TEXT"].map(self._count_digits)
        frame["exclamation_count"] = frame["TEXT"].str.count("!")
        return frame[self.FEATURE_COLUMNS]

    def _clean_text(self, text: str) -> str:
        cleaned = str(text).lower()
        cleaned = self._URL_RE.sub(" __url__ ", cleaned)
        cleaned = self._EMAIL_RE.sub(" __email__ ", cleaned)
        cleaned = self._PHONE_RE.sub(" __phone__ ", cleaned)
        return re.sub(r"\s+", " ", cleaned).strip()

    def _count_digits(self, text: str) -> int:
        return sum(char.isdigit() for char in str(text))
