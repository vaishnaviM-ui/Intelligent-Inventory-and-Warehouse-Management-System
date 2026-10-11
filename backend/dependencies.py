from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from auth import verify_token
from database import get_db
import models

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> models.User:
    payload = verify_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"}
        )
    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
            headers={"WWW-Authenticate": "Bearer"}
        )
    user = db.query(models.User).filter(models.User.user_id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"}
        )
    return user

def require_admin(
    current_user: models.User = Depends(get_current_user)
) -> models.User:
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user

def require_inventory_manager(
    current_user: models.User = Depends(get_current_user)
) -> models.User:
    if current_user.role not in ["admin", "inventory_manager"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inventory Manager or Admin access required"
        )
    return current_user

def require_staff_or_admin(
    current_user: models.User = Depends(get_current_user)
) -> models.User:
    if current_user.role not in ["staff", "inventory_manager", "admin"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Authorized access required"
        )
    return current_user

def log_audit(
    db: Session,
    user: models.User,
    action: str,
    entity_type: str = None,
    entity_id: int = None,
    details: str = None
):
    try:
        audit = models.AuditLog(
            user_id=user.user_id if user else None,
            username=user.name if user else "System",
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            details=details
        )
        db.add(audit)
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Failed to write audit log: {e}")

def create_notification(
    db: Session,
    user_id: int = None,
    title: str = "",
    message: str = "",
    notification_type: str = "info"
):
    try:
        notif = models.Notification(
            user_id=user_id,
            title=title,
            message=message,
            notification_type=notification_type
        )
        db.add(notif)
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Failed to create notification: {e}")