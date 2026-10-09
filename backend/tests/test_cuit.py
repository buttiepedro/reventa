"""Verificación de CUIT: quién lo ve, quién lo aprueba, y qué desbloquea."""

import pytest

from tests.conftest import needs_db

pytestmark = needs_db

# El backend valida el dígito verificador, así que los de los tests son reales.
CUIT_VALIDO = "30712345671"
OTRO_CUIT_VALIDO = "30712345689"

VEHICULO = {
    "brand": "Toyota", "model": "Corolla", "year": 2019, "color": "gris", "mileage": 80000,
    "fuel_type": "gasoline", "transmission": "automatic", "condition": "used",
    "price_resale": 25000000, "price_public": 27000000,
}


@pytest.fixture
async def con_cuit(client, world):
    """La agencia A manda su CUIT y queda pendiente de revisión."""
    r = await client.post("/companies/me/cuit", headers=world["a"]["headers"],
                          json={"cuit": CUIT_VALIDO})
    assert r.status_code == 204
    return world


class TestValidacion:
    async def test_un_cuit_con_digito_verificador_malo_se_rechaza(self, client, world):
        r = await client.post("/companies/me/cuit", headers=world["a"]["headers"],
                              json={"cuit": "30712345678"})
        assert r.status_code == 422


class TestQuienVeElCuit:
    async def test_el_super_admin_lo_ve_en_su_listado(self, client, con_cuit, super_admin):
        r = await client.get("/companies/admin/companies", headers=super_admin)
        assert r.status_code == 200
        agencia = next(c for c in r.json() if c["id"] == con_cuit["a"]["company"]["id"])
        assert agencia["cuit"] == CUIT_VALIDO
        assert agencia["cuit_verified"] is False
        assert agencia["cuit_submitted_at"] is not None

    async def test_puede_filtrar_solo_los_pendientes(self, client, con_cuit, super_admin):
        r = await client.get("/companies/admin/companies?pending_cuit=true", headers=super_admin)
        ids = {c["id"] for c in r.json()}
        assert con_cuit["a"]["company"]["id"] in ids
        assert con_cuit["b"]["company"]["id"] not in ids, "B nunca mandó CUIT"

    async def test_una_agencia_no_ve_el_cuit_de_otra(self, client, con_cuit):
        """El listado abierto no puede filtrar datos fiscales entre agencias."""
        r = await client.get("/companies", headers=con_cuit["b"]["headers"])
        assert r.status_code == 200
        assert "cuit" not in str(r.json()).lower()

    async def test_el_listado_de_admin_es_solo_del_super_admin(self, client, con_cuit):
        r = await client.get("/companies/admin/companies", headers=con_cuit["a"]["headers"])
        assert r.status_code == 403


class TestAprobarYRechazar:
    async def test_aprobar_marca_verificado(self, client, con_cuit, super_admin):
        cid = con_cuit["a"]["company"]["id"]
        r = await client.patch(f"/companies/admin/companies/{cid}/verify-cuit",
                               headers=super_admin, json={"approved": True})
        assert r.status_code == 204

        perfil = await client.get("/companies/me/profile", headers=con_cuit["a"]["headers"])
        assert perfil.json()["cuit_verified"] is True
        assert perfil.json()["cuit_review_notes"] is None

    async def test_rechazar_guarda_el_motivo(self, client, con_cuit, super_admin):
        cid = con_cuit["a"]["company"]["id"]
        await client.patch(f"/companies/admin/companies/{cid}/verify-cuit", headers=super_admin,
                           json={"approved": False, "reason": "No coincide con la razón social"})

        perfil = await client.get("/companies/me/profile", headers=con_cuit["a"]["headers"])
        assert perfil.json()["cuit_verified"] is False
        assert "razón social" in perfil.json()["cuit_review_notes"]

    async def test_la_agencia_recibe_la_notificacion(self, client, con_cuit, super_admin):
        cid = con_cuit["a"]["company"]["id"]
        await client.patch(f"/companies/admin/companies/{cid}/verify-cuit",
                           headers=super_admin, json={"approved": True})

        notifs = (await client.get("/notifications", headers=con_cuit["a"]["headers"])).json()
        assert any(n["entity_type"] == "cuit_verified" for n in notifs)

    async def test_una_agencia_no_se_aprueba_sola(self, client, con_cuit):
        cid = con_cuit["a"]["company"]["id"]
        r = await client.patch(f"/companies/admin/companies/{cid}/verify-cuit",
                               headers=con_cuit["a"]["headers"], json={"approved": True})
        assert r.status_code == 403

    async def test_reenviar_el_cuit_vuelve_a_dejarlo_pendiente(self, client, con_cuit, super_admin):
        cid = con_cuit["a"]["company"]["id"]
        await client.patch(f"/companies/admin/companies/{cid}/verify-cuit",
                           headers=super_admin, json={"approved": True})

        await client.post("/companies/me/cuit", headers=con_cuit["a"]["headers"],
                          json={"cuit": OTRO_CUIT_VALIDO})

        perfil = await client.get("/companies/me/profile", headers=con_cuit["a"]["headers"])
        assert perfil.json()["cuit_verified"] is False, "cambiar el CUIT debe volver a revisión"


class TestQueDesbloquea:
    async def test_sin_cuit_verificado_no_puede_publicar(self, client, con_cuit):
        r = await client.post("/vehicles", headers=con_cuit["a"]["headers"], json=VEHICULO)
        assert r.status_code == 403
        assert "CUIT" in r.json()["detail"]

    async def test_con_cuit_verificado_publica(self, client, con_cuit, super_admin):
        cid = con_cuit["a"]["company"]["id"]
        await client.patch(f"/companies/admin/companies/{cid}/verify-cuit",
                           headers=super_admin, json={"approved": True})

        r = await client.post("/vehicles", headers=con_cuit["a"]["headers"], json=VEHICULO)
        assert r.status_code == 201, r.text
