from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from database import get_db
import models
import schemas
from auth import hash_password, verify_password, create_access_token
from dependencies import get_current_user, require_admin, log_audit

router = APIRouter(prefix="", tags=["Authentication"])

@router.post("/register", response_model=dict)
def register_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    # Check if username or email already exists
    existing = db.query(models.User).filter(
        (models.User.name == user.username) | (models.User.email == user.email)
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username or email already exists"
        )

    # If first user in database, grant admin role
    total_users = db.query(models.User).count()
    assigned_role = "admin" if total_users == 0 else (user.role or "staff")

    hashed_pw = hash_password(user.password)
    new_user = models.User(
        name=user.username,
        email=user.email,
        password=hashed_pw,
        role=assigned_role
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    log_audit(db, new_user, "USER_REGISTERED", "users", new_user.user_id, f"Registered with role {assigned_role}")

    return {
        "message": "User registered successfully",
        "user": {
            "user_id": new_user.user_id,
            "name": new_user.name,
            "email": new_user.email,
            "role": new_user.role
        }
    }

@router.post("/login", response_model=schemas.Token)
def login_user(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    user = db.query(models.User).filter(
        (models.User.name == form_data.username) | (models.User.email == form_data.username)
    ).first()

    if not user or not verify_password(form_data.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username/email or password"
        )

    token = create_access_token({
        "user_id": user.user_id,
        "username": user.name,
        "role": user.role
    })

    log_audit(db, user, "USER_LOGIN", "users", user.user_id, "User logged in")

    return schemas.Token(
        access_token=token,
        token_type="bearer",
        user=schemas.UserResponse.model_validate(user)
    )

@router.get("/me", response_model=schemas.UserResponse)
def get_current_user_profile(current_user: models.User = Depends(get_current_user)):
    return schemas.UserResponse.model_validate(current_user)

@router.get("/users", response_model=list[schemas.UserResponse])
def get_all_users(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin)
):
    users = db.query(models.User).order_by(models.User.user_id).all()
    return [schemas.UserResponse.model_validate(u) for u in users]

@router.put("/users/{user_id}/role", response_model=schemas.UserResponse)
def update_user_role(
    user_id: int,
    role_update: schemas.UserUpdateRole,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin)
):
    if role_update.role not in ["admin", "inventory_manager", "staff"]:
        raise HTTPException(status_code=400, detail="Invalid role specified")

    user = db.query(models.User).filter(models.User.user_id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    old_role = user.role
    user.role = role_update.role
    db.commit()
    db.refresh(user)

    log_audit(db, current_user, "USER_ROLE_UPDATED", "users", user.user_id, f"Changed role from {old_role} to {user.role}")

    return schemas.UserResponse.model_validate(user)
