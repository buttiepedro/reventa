import uuid

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.models.user import Role, User
from app.repositories.user import UserRepository
from app.schemas.user import UserCreate, UserUpdate


# Un admin de agencia arma su propio equipo, pero no puede inventar cuentas de
# plataforma: super_admin y reventa quedan fuera de su alcance.
ASSIGNABLE_BY_COMPANY_ADMIN = {Role.COMPANY_USER, Role.COMPANY_ADMIN}


def assert_can_assign(actor: User, role: Role) -> None:
    if actor.role == Role.SUPER_ADMIN:
        if role == Role.SUPER_ADMIN:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="El super admin no se crea desde la app",
            )
        return
    if role not in ASSIGNABLE_BY_COMPANY_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No podés asignar ese rol",
        )


class UserService:
    def __init__(self, session: AsyncSession) -> None:
        self.repo = UserRepository(session)

    async def create_in_company(self, company_id: uuid.UUID, data: UserCreate) -> User:
        if data.role == Role.SUPER_ADMIN:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot assign super_admin role")
        if await self.repo.get_by_email(data.email):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
        user = User(
            email=data.email,
            hashed_password=hash_password(data.password),
            full_name=data.full_name,
            role=data.role,
            company_id=company_id,
        )
        return await self.repo.save(user)

    async def get_by_company(self, company_id: uuid.UUID) -> list[User]:
        return await self.repo.get_by_company(company_id)

    async def get_or_404(self, user_id: uuid.UUID) -> User:
        user = await self.repo.get_by_id(user_id)
        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        return user

    async def update(self, user_id: uuid.UUID, data: UserUpdate, actor: User) -> User:
        user = await self.get_or_404(user_id)
        changes = data.model_dump(exclude_none=True)

        new_role = changes.get("role")
        if new_role is not None and new_role != user.role:
            # Nadie se cambia el rol a sí mismo: ese es el camino corto para que
            # un admin de agencia se vuelva dueño de la plataforma, y también
            # para que el super admin se deje afuera sin querer.
            if user.id == actor.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="No podés cambiar tu propio rol",
                )
            assert_can_assign(actor, new_role)
            if user.role in (Role.SUPER_ADMIN, Role.REVENTA) and actor.role != Role.SUPER_ADMIN:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No podés tocar esa cuenta")

        if changes.get("is_active") is False and user.id == actor.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN, detail="No podés desactivarte a vos mismo"
            )

        for field, value in changes.items():
            setattr(user, field, value)
        return await self.repo.save(user)

    async def delete(self, user_id: uuid.UUID, actor: User) -> None:
        user = await self.get_or_404(user_id)
        if user.id == actor.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No podés borrarte a vos mismo")
        if actor.role != Role.SUPER_ADMIN:
            # Sin esto, un admin podía borrar usuarios de otra agencia, y al super admin.
            if user.company_id != actor.company_id or user.role in (Role.SUPER_ADMIN, Role.REVENTA):
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No podés borrar esa cuenta")
        elif user.role == Role.SUPER_ADMIN:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No se puede borrar un super admin")
        await self.repo.delete(user)
