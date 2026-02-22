# backend/api/auth.py
import os
import hmac
import hashlib
from datetime import datetime, timedelta
from typing import Optional, Dict, Any

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError

# ---- Config ----
SECRET_KEY = os.getenv("JWT_SECRET", "dev-secret-change-me")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("JWT_EXPIRE_MINUTES", "720"))  # 12h

# ⚠️ Important: change-le en prod
PASSWORD_SALT = os.getenv("PASSWORD_SALT", "dev-salt-change-me")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def _hash_password(password: str) -> str:
    # hash stable: sha256(salt + password)
    msg = (PASSWORD_SALT + password).encode("utf-8", errors="ignore")
    return hashlib.sha256(msg).hexdigest()


# ---- Users (2 users fixes) ----
DROKEN_PASSWORD = os.getenv("DROKEN_PASSWORD", "droken")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin")

USERS_DB = {
    "Droken": {
        "username": "Droken",
        "role": "superadmin",
        "password_hash": _hash_password(DROKEN_PASSWORD),
    },
    "Admin": {
        "username": "Admin",
        "role": "admin",
        "password_hash": _hash_password(ADMIN_PASSWORD),
    },
}


def authenticate_user(username: str, password: str) -> Optional[Dict[str, Any]]:
    user = USERS_DB.get(username)
    if not user:
        return None
    candidate = _hash_password(password)
    if not hmac.compare_digest(candidate, user["password_hash"]):
        return None
    return user


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(token: str = Depends(oauth2_scheme)) -> Dict[str, Any]:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        role: str = payload.get("role")
        if not username or not role:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    user = USERS_DB.get(username)
    if not user:
        raise credentials_exception
    return {"username": username, "role": role}


def require_roles(*allowed_roles: str):
    def dep(user: Dict[str, Any] = Depends(get_current_user)):
        if user["role"] not in allowed_roles:
            raise HTTPException(status_code=403, detail="Forbidden")
        return user
    return dep