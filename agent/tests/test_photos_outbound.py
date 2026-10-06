"""Showing a car means sending the photo, not a link to it."""

import pytest

from app.core.config import settings
from app.services import agent, tools
from tests.conftest import needs_db

pytestmark = needs_db

DETAIL = {
    "id": "v1", "brand": "Toyota", "model": "Corolla", "year": 2019,
    "price_resale": 25000000,
    "images": [
        {"id": "i2", "url": "https://s3/firmada-2", "display_order": 1, "is_primary": False},
        {"id": "i1", "url": "https://s3/firmada-1", "display_order": 0, "is_primary": True},
        {"id": "i3", "url": "https://s3/firmada-3", "display_order": 2, "is_primary": False},
    ],
}


class FakeStockar:
    def __init__(self, body=DETAIL, status=200):
        self.body, self.status = body, status

    async def get(self, path, params=None):
        return self.status, self.body


class FakeMeta:
    def __init__(self, fail=False):
        self.images, self.fail = [], fail

    async def send_image(self, to, link, caption=None):
        self.images.append((to, link, caption))
        return (not self.fail), ("boom" if self.fail else "")


@pytest.fixture
def meta(monkeypatch):
    client = FakeMeta()
    monkeypatch.setattr(tools, "MetaClient", lambda: client)
    return client


@pytest.fixture
async def ctx(session, phone, user_id):
    conversation = await agent.get_or_create_conversation(session, phone, user_id)
    return tools.ToolContext(
        client=FakeStockar(), session=session, conversation=conversation, user_id=user_id
    )


class TestUrlsNeverReachTheModel:
    def test_a_detail_payload_loses_its_signed_urls(self):
        clean = tools._without_media_urls(DETAIL)
        assert "images" not in clean
        assert clean["fotos"] == 3
        assert "firmada" not in str(clean), "una URL firmada llegó al modelo"

    def test_a_list_payload_loses_its_thumbnail_url(self):
        listing = {"items": [{"id": "v1", "primary_image_url": "https://s3/firmada"},
                             {"id": "v2", "primary_image_url": None}]}
        clean = tools._without_media_urls(listing)
        assert [i["fotos"] for i in clean["items"]] == [1, 0]
        assert "firmada" not in str(clean)

    def test_everything_else_survives_untouched(self):
        clean = tools._without_media_urls(DETAIL)
        assert clean["brand"] == "Toyota" and clean["price_resale"] == 25000000


class TestSending:
    async def test_photos_go_out_as_images_cover_first(self, ctx, meta):
        out, is_error = await tools.execute("enviar_fotos", {"vehicle_id": "v1"}, ctx)

        assert not is_error
        assert [img[1] for img in meta.images] == [
            "https://s3/firmada-1", "https://s3/firmada-2", "https://s3/firmada-3",
        ], "la portada no salió primero"
        assert all(img[0] == ctx.conversation.phone_e164 for img in meta.images)
        assert "3 foto(s)" in out

    async def test_only_the_first_photo_carries_the_caption(self, ctx, meta):
        await tools.execute("enviar_fotos", {"vehicle_id": "v1", "caption": "Corolla XEI"}, ctx)

        assert meta.images[0][2] == "Corolla XEI"
        assert [img[2] for img in meta.images[1:]] == [None, None]

    async def test_the_caption_falls_back_to_the_car(self, ctx, meta):
        await tools.execute("enviar_fotos", {"vehicle_id": "v1"}, ctx)
        assert meta.images[0][2] == "Toyota Corolla 2019"

    async def test_a_long_gallery_is_capped(self, ctx, meta, monkeypatch):
        monkeypatch.setattr(settings, "max_photos_per_send", 2)
        await tools.execute("enviar_fotos", {"vehicle_id": "v1"}, ctx)
        assert len(meta.images) == 2

    async def test_a_car_with_no_photos_is_reported(self, ctx, meta):
        ctx.client = FakeStockar(body={**DETAIL, "images": []})
        out, is_error = await tools.execute("enviar_fotos", {"vehicle_id": "v1"}, ctx)
        assert not is_error
        assert "no tiene fotos" in out
        assert meta.images == []

    async def test_a_failed_send_does_not_claim_success(self, ctx, monkeypatch):
        failing = FakeMeta(fail=True)
        monkeypatch.setattr(tools, "MetaClient", lambda: failing)
        out, _ = await tools.execute("enviar_fotos", {"vehicle_id": "v1"}, ctx)
        assert "No pude enviar" in out

    async def test_a_missing_vehicle_is_reported(self, ctx, meta):
        ctx.client = FakeStockar(body={"detail": "Vehicle not found"}, status=404)
        out, _ = await tools.execute("enviar_fotos", {"vehicle_id": "nope"}, ctx)
        assert "404" in out
        assert meta.images == []
