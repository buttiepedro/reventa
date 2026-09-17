"""The conversation loop, driven by a stand-in for the model.

This does not test the model. It tests that the shapes the loop builds are the
shapes it can read back, that tool calls round-trip, and that stored history is
safe to resend.
"""

import json
from types import SimpleNamespace

import pytest

from app.core.config import settings
from app.services import agent, tools
from tests.conftest import needs_db

pytestmark = needs_db


def _reply(content=None, tool_calls=None, refusal=None):
    message = SimpleNamespace(content=content, tool_calls=tool_calls, refusal=refusal)
    return SimpleNamespace(choices=[SimpleNamespace(message=message, finish_reason="stop")])


def _call(call_id, name, args):
    return SimpleNamespace(
        id=call_id, function=SimpleNamespace(name=name, arguments=json.dumps(args))
    )


class FakeOpenAI:
    """Returns scripted replies in order and records every request it received."""

    def __init__(self, replies):
        self.replies = list(replies)
        self.requests = []
        self.chat = SimpleNamespace(completions=SimpleNamespace(create=self._create))

    async def _create(self, **request):
        self.requests.append(request)
        return self.replies.pop(0)


class FakeStockar:
    def __init__(self):
        self.calls = []

    async def me(self):
        return {"full_name": "Ana", "role": "company_user", "company": {"name": "Autos Sur"}}

    async def get(self, path, params=None):
        self.calls.append((path, params))
        return 200, {"items": [{"brand": "Toyota", "model": "Corolla", "year": 2019}], "total": 1}


@pytest.fixture
def fake_model(monkeypatch):
    holder = {}

    def install(replies):
        client = FakeOpenAI(replies)
        monkeypatch.setattr(agent, "AsyncOpenAI", lambda api_key: client)
        holder["client"] = client
        return client

    return install


@pytest.fixture
def stockar(monkeypatch):
    client = FakeStockar()
    monkeypatch.setattr(agent, "StockarClient", lambda user_id: client)
    return client


@pytest.fixture
async def conversation(session, phone, user_id):
    return await agent.get_or_create_conversation(session, phone, user_id)


async def test_a_plain_answer_comes_back_and_is_stored(session, conversation, user_id, fake_model, stockar):
    model = fake_model([_reply(content="Hola Ana, ¿qué buscás?")])

    reply = await agent.run_turn(session, conversation, user_id, "hola")

    assert reply == "Hola Ana, ¿qué buscás?"
    request = model.requests[0]
    assert request["messages"][0]["role"] == "system"
    assert "Autos Sur" in request["messages"][0]["content"], "the profile did not reach the prompt"
    assert request["messages"][-1] == {"role": "user", "content": "hola"}
    assert [m["role"] for m in conversation.messages] == ["user", "assistant"]


async def test_a_tool_call_round_trips_into_the_next_request(session, conversation, user_id, fake_model, stockar):
    model = fake_model([
        _reply(tool_calls=[_call("call_1", "buscar_en_la_red", {"brand": "Toyota", "model": "Corolla"})]),
        _reply(content="Hay un Corolla 2019."),
    ])

    reply = await agent.run_turn(session, conversation, user_id, "¿hay corollas?")

    assert reply == "Hay un Corolla 2019."
    assert stockar.calls == [("/vehicles", {"brand": "Toyota", "model": "Corolla"})]

    second = model.requests[1]["messages"]
    assert second[-2]["role"] == "assistant"
    assert second[-2]["tool_calls"][0]["id"] == "call_1"
    assert second[-1] == {"role": "tool", "tool_call_id": "call_1",
                          "content": json.dumps({"items": [{"brand": "Toyota", "model": "Corolla", "year": 2019}], "total": 1}, ensure_ascii=False)}


async def test_a_failed_tool_is_flagged_for_the_model(session, conversation, user_id, fake_model, stockar):
    model = fake_model([
        _reply(tool_calls=[_call("call_1", "tool_inexistente", {})]),
        _reply(content="No pude."),
    ])

    await agent.run_turn(session, conversation, user_id, "x")

    tool_message = model.requests[1]["messages"][-1]
    assert tool_message["role"] == "tool"
    assert tool_message["content"].startswith("ERROR:")


async def test_malformed_arguments_do_not_crash_the_turn(session, conversation, user_id, fake_model, stockar):
    broken = SimpleNamespace(id="call_1", function=SimpleNamespace(name="mi_stock", arguments="{not json"))
    fake_model([_reply(tool_calls=[broken]), _reply(content="Perdón, repetime.")])

    reply = await agent.run_turn(session, conversation, user_id, "x")

    assert reply == "Perdón, repetime."


async def test_the_tool_catalogue_is_sent_in_function_calling_shape(session, conversation, user_id, fake_model, stockar):
    model = fake_model([_reply(content="ok")])

    await agent.run_turn(session, conversation, user_id, "x")

    sent = model.requests[0]["tools"]
    assert len(sent) == len(tools.TOOLS)
    assert all(t["type"] == "function" for t in sent)
    assert {t["function"]["name"] for t in sent} == {t["name"] for t in tools.TOOLS}
    assert all("parameters" in t["function"] for t in sent)


async def test_reasoning_effort_is_only_sent_when_configured(session, conversation, user_id, fake_model, stockar, monkeypatch):
    monkeypatch.setattr(settings, "agent_reasoning_effort", "")
    model = fake_model([_reply(content="ok")])
    await agent.run_turn(session, conversation, user_id, "x")
    assert "reasoning_effort" not in model.requests[0]

    monkeypatch.setattr(settings, "agent_reasoning_effort", "low")
    model = fake_model([_reply(content="ok")])
    await agent.run_turn(session, conversation, user_id, "x")
    assert model.requests[0]["reasoning_effort"] == "low"


async def test_a_refusal_is_relayed_without_a_tool_loop(session, conversation, user_id, fake_model, stockar):
    fake_model([_reply(refusal="policy")])

    reply = await agent.run_turn(session, conversation, user_id, "x")

    assert reply == "No puedo ayudarte con eso."


async def test_photos_are_sent_as_data_urls_but_not_stored(session, conversation, user_id, fake_model, stockar):
    model = fake_model([_reply(content="Es un Corolla.")])

    await agent.run_turn(session, conversation, user_id, "¿qué auto es?", images=[(b"\xff\xd8", "image/jpeg")])

    sent = model.requests[0]["messages"][-1]["content"]
    assert sent[0]["type"] == "image_url"
    assert sent[0]["image_url"]["url"].startswith("data:image/jpeg;base64,")
    assert sent[-1] == {"type": "text", "text": "¿qué auto es?"}

    stored = conversation.messages[0]["content"]
    assert all(part["type"] == "text" for part in stored), "base64 leaked into stored history"


async def test_the_loop_gives_up_instead_of_spinning(session, conversation, user_id, fake_model, stockar, monkeypatch):
    monkeypatch.setattr(settings, "max_tool_iterations", 3)
    fake_model([_reply(tool_calls=[_call(f"c{i}", "mi_stock", {})]) for i in range(3)])

    reply = await agent.run_turn(session, conversation, user_id, "x")

    assert "reformular" in reply


class TestTrim:
    def test_never_cuts_between_a_tool_call_and_its_result(self):
        history = [
            {"role": "user", "content": "a"},
            {"role": "assistant", "content": "", "tool_calls": [{"id": "1"}]},
            {"role": "tool", "tool_call_id": "1", "content": "r"},
            {"role": "assistant", "content": "done"},
            {"role": "user", "content": "b"},
            {"role": "assistant", "content": "ok"},
        ]
        trimmed = agent._trim(history, 3)
        assert trimmed[0]["role"] == "user", "a window must open on a user turn"
        assert trimmed == history[4:]

    def test_short_history_is_untouched(self):
        history = [{"role": "user", "content": "a"}]
        assert agent._trim(history, 10) == history
