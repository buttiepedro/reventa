from fastapi import APIRouter

from app.api.v1.endpoints import auth, catalog, companies, favorites, health, share, sheet, users, vehicles

api_router = APIRouter()

api_router.include_router(health.router, prefix="/health", tags=["health"])
api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(catalog.router, prefix="/catalog", tags=["catalog"])
api_router.include_router(companies.router, prefix="/companies", tags=["companies"])
api_router.include_router(users.router, prefix="/users", tags=["users"])
api_router.include_router(vehicles.router, prefix="/vehicles", tags=["vehicles"])
api_router.include_router(share.router, prefix="/share", tags=["share"])
api_router.include_router(favorites.router, prefix="/favorites", tags=["favorites"])
api_router.include_router(sheet.router, prefix="/sheet", tags=["sheet"])
