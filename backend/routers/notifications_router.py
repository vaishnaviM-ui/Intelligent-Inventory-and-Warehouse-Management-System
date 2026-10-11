from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_
from database import get_db
import models
import schemas
from dependencies import require_staff_or_admin, require_admin

router = APIRouter(prefix="", tags=["Notifications & Audit Trail"])

@router.get("/notifications", response_model=List[schemas.NotificationResponse])
def get_notifications(
    limit: Optional[int] = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_staff_or_admin)
):
    # Fetch notifications for current user or global (user_id is None)
    notifs = db.query(models.Notification).filter(
        or_(models.Notification.user_id == current_user.user_id, models.Notification.user_id == None)
    ).order_by(desc(models.Notification.created_at)).limit(limit).all()

    # Also dynamically generate critical alerts if not existing
    return [schemas.NotificationResponse.model_validate(n) for n in notifs]

@router.get("/notifications/unread-count")
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_staff_or_admin)
):
    count = db.query(models.Notification).filter(
        or_(models.Notification.user_id == current_user.user_id, models.Notification.user_id == None),
        models.Notification.is_read == False
    ).count()
    return {"unread_count": count}

@router.put("/notifications/{notification_id}/read")
def mark_notification_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_staff_or_admin)
):
    notif = db.query(models.Notification).filter(models.Notification.notification_id == notification_id).first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    notif.is_read = True
    db.commit()
    return {"success": True, "notification_id": notification_id, "is_read": True}

@router.put("/notifications/read-all")
def mark_all_notifications_read(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_staff_or_admin)
):
    db.query(models.Notification).filter(
        or_(models.Notification.user_id == current_user.user_id, models.Notification.user_id == None)
    ).update({"is_read": True})
    db.commit()
    return {"success": True, "message": "All notifications marked as read"}

@router.get("/audit-logs", response_model=List[schemas.AuditLogResponse])
def get_audit_logs(
    search: Optional[str] = Query(None),
    entity_type: Optional[str] = Query(None),
    limit: Optional[int] = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin)
):
    query = db.query(models.AuditLog)

    if entity_type:
        query = query.filter(models.AuditLog.entity_type.ilike(entity_type))

    if search:
        search_term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                models.AuditLog.username.ilike(search_term),
                models.AuditLog.action.ilike(search_term),
                models.AuditLog.details.ilike(search_term)
            )
        )

    logs = query.order_by(desc(models.AuditLog.timestamp)).limit(limit).all()
    return [schemas.AuditLogResponse.model_validate(l) for l in logs]
