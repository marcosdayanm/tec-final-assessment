def test_predict_endpoint_returns_label(client) -> None:
    response = client.post("/predict", json={"message": "verify your bank account"})

    assert response.status_code == 200
    assert response.json() == {"label": "smishing"}
