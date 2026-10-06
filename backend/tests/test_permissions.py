"""Quién puede qué. Cada test es una frase del modelo de permisos."""

import pytest

from tests.conftest import login, needs_db

pytestmark = needs_db


class TestAdminDeAgencia:
    async def test_crea_usuarios_en_su_agencia(self, client, world):
        r = await client.post(
            f"/companies/{world['a']['company']['id']}/users", headers=world["a"]["headers"],
            json={"email": f"nuevo.{world['tag']}@t.com", "password": "pass1234",
                  "full_name": "Nuevo", "role": "company_user"},
        )
        assert r.status_code == 201

    async def test_ve_los_usuarios_de_su_agencia(self, client, world):
        r = await client.get(
            f"/companies/{world['a']['company']['id']}/users", headers=world["a"]["headers"]
        )
        assert r.status_code == 200
        assert any(u["role"] == "company_admin" for u in r.json())

    async def test_no_ve_los_de_otra_agencia(self, client, world):
        r = await client.get(
            f"/companies/{world['b']['company']['id']}/users", headers=world["a"]["headers"]
        )
        assert r.status_code == 403

    async def test_no_crea_usuarios_en_otra_agencia(self, client, world):
        r = await client.post(
            f"/companies/{world['b']['company']['id']}/users", headers=world["a"]["headers"],
            json={"email": f"intruso.{world['tag']}@t.com", "password": "pass1234",
                  "full_name": "X", "role": "company_user"},
        )
        assert r.status_code == 403

    @pytest.mark.parametrize("role", ["super_admin", "reventa"])
    async def test_no_puede_crear_cuentas_de_plataforma(self, client, world, role):
        r = await client.post(
            f"/companies/{world['a']['company']['id']}/users", headers=world["a"]["headers"],
            json={"email": f"x.{role}.{world['tag']}@t.com", "password": "pass1234",
                  "full_name": "X", "role": role},
        )
        assert r.status_code == 403


class TestEscaladaDePrivilegios:
    async def test_no_puede_ascenderse_a_super_admin(self, client, world):
        """El agujero: antes esto devolvía 200 y lo convertía en dueño de la plataforma."""
        r = await client.put(
            f"/users/{world['a']['admin']['id']}", headers=world["a"]["headers"],
            json={"role": "super_admin"},
        )
        assert r.status_code == 403

        me = await client.get("/auth/me", headers=world["a"]["headers"])
        assert me.json()["role"] == "company_admin"

    async def test_no_puede_ascender_a_un_companiero(self, client, world):
        otro = (await client.post(
            f"/companies/{world['a']['company']['id']}/users", headers=world["a"]["headers"],
            json={"email": f"otro.{world['tag']}@t.com", "password": "pass1234",
                  "full_name": "Otro", "role": "company_user"},
        )).json()
        r = await client.put(f"/users/{otro['id']}", headers=world["a"]["headers"],
                             json={"role": "super_admin"})
        assert r.status_code == 403

    async def test_si_puede_hacer_admin_a_un_companiero(self, client, world):
        otro = (await client.post(
            f"/companies/{world['a']['company']['id']}/users", headers=world["a"]["headers"],
            json={"email": f"asciende.{world['tag']}@t.com", "password": "pass1234",
                  "full_name": "Otro", "role": "company_user"},
        )).json()
        r = await client.put(f"/users/{otro['id']}", headers=world["a"]["headers"],
                             json={"role": "company_admin"})
        assert r.status_code == 200
        assert r.json()["role"] == "company_admin"

    async def test_el_super_admin_tampoco_cambia_su_propio_rol(self, client, world, super_admin):
        r = await client.put(f"/users/{world['super_id']}", headers=super_admin,
                             json={"role": "company_user"})
        assert r.status_code == 403, "un super admin podría dejarse afuera de la plataforma"


class TestBorrado:
    async def test_no_borra_usuarios_de_otra_agencia(self, client, world):
        """El agujero: antes devolvía 204 y el usuario desaparecía."""
        r = await client.delete(f"/users/{world['b']['user']['id']}", headers=world["a"]["headers"])
        assert r.status_code == 403

        sigue = await client.get(f"/users/{world['b']['user']['id']}", headers=world["b"]["headers"])
        assert sigue.status_code == 200

    async def test_no_borra_al_super_admin(self, client, world):
        r = await client.delete(f"/users/{world['super_id']}", headers=world["a"]["headers"])
        assert r.status_code == 403

    async def test_nadie_se_borra_a_si_mismo(self, client, world):
        r = await client.delete(f"/users/{world['a']['admin']['id']}", headers=world["a"]["headers"])
        assert r.status_code == 403

    async def test_si_borra_a_los_suyos(self, client, world):
        victima = (await client.post(
            f"/companies/{world['a']['company']['id']}/users", headers=world["a"]["headers"],
            json={"email": f"chau.{world['tag']}@t.com", "password": "pass1234",
                  "full_name": "Chau", "role": "company_user"},
        )).json()
        r = await client.delete(f"/users/{victima['id']}", headers=world["a"]["headers"])
        assert r.status_code == 204


class TestPausaDeAgencia:
    async def test_pausar_corta_el_login(self, client, world, super_admin):
        await client.put(f"/companies/{world['a']['company']['id']}", headers=super_admin,
                         json={"is_active": False})

        r = await client.post("/auth/login",
                              json={"email": f"admin.a{world['tag']}@t.com", "password": "pass1234"})
        assert r.status_code == 403
        assert "pausada" in r.json()["detail"]

    async def test_pausar_invalida_los_tokens_ya_emitidos(self, client, world, super_admin):
        """Si solo se chequeara en el login, un token vivo seguiría entrando."""
        headers = world["a"]["headers"]
        assert (await client.get("/auth/me", headers=headers)).status_code == 200

        await client.put(f"/companies/{world['a']['company']['id']}", headers=super_admin,
                         json={"is_active": False})

        r = await client.get("/auth/me", headers=headers)
        assert r.status_code == 403
        assert "pausada" in r.json()["detail"]

    async def test_la_pausa_no_toca_a_las_otras_agencias(self, client, world, super_admin):
        await client.put(f"/companies/{world['a']['company']['id']}", headers=super_admin,
                         json={"is_active": False})
        assert (await client.get("/auth/me", headers=world["b"]["headers"])).status_code == 200

    async def test_reactivar_devuelve_el_acceso(self, client, world, super_admin):
        cid = world["a"]["company"]["id"]
        await client.put(f"/companies/{cid}", headers=super_admin, json={"is_active": False})
        await client.put(f"/companies/{cid}", headers=super_admin, json={"is_active": True})

        headers = await login(client, f"admin.a{world['tag']}@t.com", "pass1234")
        assert (await client.get("/auth/me", headers=headers)).status_code == 200

    async def test_el_super_admin_no_se_pausa_a_si_mismo(self, client, world, super_admin):
        """No tiene empresa, así que ninguna pausa lo puede dejar afuera."""
        assert (await client.get("/auth/me", headers=super_admin)).status_code == 200


class TestSuperAdmin:
    async def test_ve_todas_las_agencias(self, client, world, super_admin):
        r = await client.get("/companies", headers=super_admin)
        assert r.status_code == 200
        slugs = {c["slug"] for c in r.json()}
        assert {world["a"]["company"]["slug"], world["b"]["company"]["slug"]} <= slugs

    async def test_ve_los_usuarios_de_cualquier_agencia(self, client, world, super_admin):
        r = await client.get(f"/companies/{world['b']['company']['id']}/users", headers=super_admin)
        assert r.status_code == 200

    async def test_solo_el_crea_agencias(self, client, world):
        r = await client.post("/companies", headers=world["a"]["headers"],
                              json={"name": "Trucha", "slug": f"trucha{world['tag']}"})
        assert r.status_code == 403

    async def test_no_crea_otro_super_admin_desde_la_app(self, client, world, super_admin):
        r = await client.post(
            f"/companies/{world['a']['company']['id']}/users", headers=super_admin,
            json={"email": f"super2.{world['tag']}@t.com", "password": "pass1234",
                  "full_name": "Super 2", "role": "super_admin"},
        )
        assert r.status_code == 403
