"""El sync de catálogo tiene que decir por qué no trajo nada."""

import httpx
import pytest

from app.core.config import settings
from app.services import carapi_sync
from app.services.carapi_sync import CarApiNotConfigured, _fetch_all, _get_jwt


def _client(handler) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="https://carapi.app")


class TestSinCredenciales:
    async def test_avisa_en_vez_de_devolver_none(self, monkeypatch):
        """Antes devolvía None y el sync saltaba modelos y trims sin decir nada."""
        monkeypatch.setattr(settings, "carapi_username", "")
        monkeypatch.setattr(settings, "carapi_api_token", "")

        async with _client(lambda r: httpx.Response(200)) as client:
            with pytest.raises(CarApiNotConfigured) as exc:
                await _get_jwt(client)

        assert "CARAPI_USERNAME" in str(exc.value)

    async def test_el_estado_del_sync_lo_reporta(self, monkeypatch):
        monkeypatch.setattr(settings, "carapi_username", "")
        monkeypatch.setattr(settings, "carapi_api_token", "")

        await carapi_sync.run_sync()

        status = carapi_sync.get_sync_status()
        assert status.running is False
        assert status.errors, "un sync que no pudo hacer nada se reportaba como exitoso"
        assert "CARAPI_USERNAME" in status.errors[0]
        assert (status.makes, status.models, status.trims) == (0, 0, 0)


class TestCredencialesRechazadas:
    @pytest.mark.parametrize("code", [401, 403])
    async def test_un_rechazo_no_se_traga(self, code):
        """Antes un 403 cortaba el bucle y devolvía [] como si no hubiera datos."""
        async with _client(lambda r: httpx.Response(code)) as client:
            with pytest.raises(PermissionError) as exc:
                await _fetch_all(client, "https://carapi.app/api/models", {})

        assert str(code) in str(exc.value)

    async def test_un_500_tampoco_pasa_desapercibido(self):
        async with _client(lambda r: httpx.Response(500)) as client:
            with pytest.raises(httpx.HTTPStatusError):
                await _fetch_all(client, "https://carapi.app/api/makes", {})


class TestPaginado:
    async def test_recorre_todas_las_páginas(self):
        def handler(request: httpx.Request) -> httpx.Response:
            page = int(request.url.params.get("page", 1))
            return httpx.Response(200, json={"data": [{"id": page, "name": f"M{page}"}], "pages": 3})

        async with _client(handler) as client:
            items = await _fetch_all(client, "https://carapi.app/api/makes", {})

        assert [i["id"] for i in items] == [1, 2, 3]

    async def test_corta_cuando_la_página_viene_vacía(self):
        async with _client(lambda r: httpx.Response(200, json={"data": [], "pages": 99})) as client:
            assert await _fetch_all(client, "https://carapi.app/api/makes", {}) == []
