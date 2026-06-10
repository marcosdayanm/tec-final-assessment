from src.ml.features import FeatureBuilder


def test_clean_text_replaces_sensitive_patterns() -> None:
    builder = FeatureBuilder()
    cleaned = builder._clean_text("Email me at test@example.com or visit https://bank.test now!")

    assert "__email__" in cleaned
    assert "__url__" in cleaned


def test_build_feature_frame_creates_expected_columns() -> None:
    builder = FeatureBuilder()
    features = builder.transform(["Call me at 5551234567 right now!"])

    assert list(features.columns) == [
        "clean_text",
        "message_length",
        "word_count",
        "digit_count",
        "exclamation_count",
    ]
    assert int(features.loc[0, "exclamation_count"]) == 1
    assert int(features.loc[0, "digit_count"]) > 0
