import pickle
from typing import Any

import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics import accuracy_score, classification_report, f1_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import MaxAbsScaler
from sklearn.svm import LinearSVC

from src.config import Settings
from src.ml.features import FeatureBuilder


SEED = 42


def train_model() -> None:
    settings = Settings.from_env()
    preprocessor = ColumnTransformer(
        transformers=[
            (
                "text_tfidf",
                TfidfVectorizer(stop_words="english", ngram_range=(1, 2), min_df=2),
                "clean_text",
            ),
            ("numeric_data", MaxAbsScaler(), FeatureBuilder.NUMERIC_COLUMNS),
        ]
    )

    # FeatureBuilder -> TF-IDF + features numéricas escaladas -> LinearSVC, todo en un pipeline serializable.
    pipeline: Pipeline = Pipeline(
        steps=[
            ("feature_builder", FeatureBuilder()),
            ("preprocessor", preprocessor),
            ("classifier", LinearSVC(random_state=SEED)),
        ]
    )

    dataset = pd.read_csv(settings.dataset_path)
    # Split 80/20 estratificado por clase para conservar la proporción ham/spam/smishing en test.
    X_train, X_test, y_train, y_test = train_test_split(
        dataset["TEXT"],
        dataset["LABEL"],
        test_size=0.2,
        random_state=SEED,
        stratify=dataset["LABEL"],
    )

    pipeline.fit(X_train, y_train)

    predictions = pipeline.predict(X_test)
    metrics: dict[str, Any] = {
        "accuracy": accuracy_score(y_test, predictions),
        "macro_f1": f1_score(y_test, predictions, average="macro"),
    }

    settings.model_path.parent.mkdir(parents=True, exist_ok=True)
    with settings.model_path.open("wb") as file:
        pickle.dump(pipeline, file)

    print(classification_report(y_test, predictions, digits=4))
    print(f"Saved trained model to {settings.model_path}")
    print(f"Metrics: {metrics}")


def main() -> None:
    train_model()


if __name__ == "__main__":
    main()
