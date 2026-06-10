import pytest
from starlette.websockets import WebSocketDisconnect

from tests.helpers import auth_headers, register_user


class UnavailableModelClient:
    async def predict_label(self, message: str) -> str:
        return "unclassified"

    async def aclose(self) -> None:
        return None


def test_create_fetch_direct_conversation_and_list_only_user_conversations(client) -> None:
    alice = register_user(client, "alice")
    bob = register_user(client, "bob")
    carol = register_user(client, "carol")

    response = client.post(
        f"/v1/conversations/direct/{bob['user']['id']}",
        headers=auth_headers(alice["token"]),
    )

    assert response.status_code == 200
    conversation_id = response.json()["conversation"]["conversation_id"]

    second_response = client.post(
        f"/v1/conversations/direct/{bob['user']['id']}",
        headers=auth_headers(alice["token"]),
    )
    assert second_response.json()["conversation"]["conversation_id"] == conversation_id

    alice_list = client.get("/v1/conversations", headers=auth_headers(alice["token"]))
    carol_list = client.get("/v1/conversations", headers=auth_headers(carol["token"]))

    assert len(alice_list.json()["conversations"]) == 1
    assert carol_list.json()["conversations"] == []


def test_conversations_sorted_by_latest_message(client) -> None:
    alice = register_user(client, "alice")
    bob = register_user(client, "bob")
    carol = register_user(client, "carol")

    first = client.post(f"/v1/conversations/direct/{bob['user']['id']}", headers=auth_headers(alice["token"])).json()
    second = client.post(f"/v1/conversations/direct/{carol['user']['id']}", headers=auth_headers(alice["token"])).json()

    client.post(
        "/v1/messages",
        headers=auth_headers(alice["token"]),
        json={"conversation_id": first["conversation"]["conversation_id"], "content": "hello bob"},
    )
    client.post(
        "/v1/messages",
        headers=auth_headers(alice["token"]),
        json={"conversation_id": second["conversation"]["conversation_id"], "content": "winner prize"},
    )

    response = client.get("/v1/conversations", headers=auth_headers(alice["token"]))

    assert response.status_code == 200
    assert response.json()["conversations"][0]["other_participant"]["username"] == "carol"


def test_search_users_partial_match_excludes_self(client) -> None:
    alice = register_user(client, "alice")
    register_user(client, "alicia")
    register_user(client, "bob")

    response = client.get("/v1/users/search?query=ali", headers=auth_headers(alice["token"]))

    assert response.status_code == 200
    assert [user["username"] for user in response.json()["users"]] == ["alicia"]


def test_message_persists_with_classification_label(client) -> None:
    alice = register_user(client, "alice")
    bob = register_user(client, "bob")
    conversation = client.post(
        f"/v1/conversations/direct/{bob['user']['id']}",
        headers=auth_headers(alice["token"]),
    ).json()["conversation"]

    response = client.post(
        "/v1/messages",
        headers=auth_headers(alice["token"]),
        json={"conversation_id": conversation["conversation_id"], "content": "verify your bank account"},
    )

    assert response.status_code == 201
    assert response.json()["message"]["classification_label"] == "smishing"

    history = client.get(
        f"/v1/direct_messages/{conversation['conversation_id']}",
        headers=auth_headers(alice["token"]),
    )
    assert history.json()["messages"][0]["classification_label"] == "smishing"


def test_cannot_send_message_to_other_users_conversation(client) -> None:
    alice = register_user(client, "alice")
    bob = register_user(client, "bob")
    carol = register_user(client, "carol")
    conversation = client.post(
        f"/v1/conversations/direct/{bob['user']['id']}",
        headers=auth_headers(alice["token"]),
    ).json()["conversation"]

    response = client.post(
        "/v1/messages",
        headers=auth_headers(carol["token"]),
        json={"conversation_id": conversation["conversation_id"], "content": "hello"},
    )

    assert response.status_code == 404


def test_authenticated_websocket_receives_message_created_event(client) -> None:
    alice = register_user(client, "alice")
    bob = register_user(client, "bob")
    conversation = client.post(
        f"/v1/conversations/direct/{bob['user']['id']}",
        headers=auth_headers(alice["token"]),
    ).json()["conversation"]

    with client.websocket_connect(f"/v1/ws?token={bob['token']}") as websocket:
        response = client.post(
            "/v1/messages",
            headers=auth_headers(alice["token"]),
            json={"conversation_id": conversation["conversation_id"], "content": "verify your bank now"},
        )

        assert response.status_code == 201
        event = websocket.receive_json()
        assert event["type"] == "message_created"
        assert event["message"]["content"] == "verify your bank now"
        assert event["sender"]["username"] == "alice"


def test_invalid_websocket_token_is_rejected(client) -> None:
    with pytest.raises(WebSocketDisconnect):
        with client.websocket_connect("/v1/ws?token=bad-token"):
            pass


def test_offline_recipient_does_not_break_message_send(client) -> None:
    alice = register_user(client, "alice")
    bob = register_user(client, "bob")
    conversation = client.post(
        f"/v1/conversations/direct/{bob['user']['id']}",
        headers=auth_headers(alice["token"]),
    ).json()["conversation"]

    response = client.post(
        "/v1/messages",
        headers=auth_headers(alice["token"]),
        json={"conversation_id": conversation["conversation_id"], "content": "hello bob"},
    )

    assert response.status_code == 201


def test_http_send_websocket_receive_and_history_reload_match(client) -> None:
    alice = register_user(client, "alice")
    bob = register_user(client, "bob")
    conversation = client.post(
        f"/v1/conversations/direct/{bob['user']['id']}",
        headers=auth_headers(alice["token"]),
    ).json()["conversation"]

    with client.websocket_connect(f"/v1/ws?token={bob['token']}") as websocket:
        response = client.post(
            "/v1/messages",
            headers=auth_headers(alice["token"]),
            json={"conversation_id": conversation["conversation_id"], "content": "winner prize claim now"},
        )
        delivered = websocket.receive_json()

    history = client.get(
        f"/v1/direct_messages/{conversation['conversation_id']}",
        headers=auth_headers(bob["token"]),
    )

    assert response.status_code == 201
    assert delivered["message"]["id"] == history.json()["messages"][0]["id"]
    assert delivered["message"]["classification_label"] == history.json()["messages"][0]["classification_label"]


def test_message_falls_back_to_unclassified_when_ml_service_is_unavailable(client) -> None:
    client.app.state.runtime.model_client = UnavailableModelClient()
    alice = register_user(client, "alice")
    bob = register_user(client, "bob")
    conversation = client.post(
        f"/v1/conversations/direct/{bob['user']['id']}",
        headers=auth_headers(alice["token"]),
    ).json()["conversation"]

    response = client.post(
        "/v1/messages",
        headers=auth_headers(alice["token"]),
        json={"conversation_id": conversation["conversation_id"], "content": "service down test"},
    )

    assert response.status_code == 201
    assert response.json()["message"]["classification_label"] == "unclassified"
