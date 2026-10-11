import os
import joblib
from typing import List, Optional
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from database import get_db
import models
import schemas
from dependencies import require_staff_or_admin, require_inventory_manager, log_audit, create_notification
from ai.demand_prediction import predict_demand
from ai.train_model import train_all_models

router = APIRouter(prefix="", tags=["AI Demand Forecasting & Restocking Engine"])

@router.post("/ai/train")
def train_models_endpoint(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_inventory_manager)
):
    result = train_all_models()
    log_audit(db, current_user, "AI_MODELS_RETRAINED", "ai", None, f"Retrained models for {result.get('trained_count', 0)} products")
    return {
        "success": True,
        "message": "AI demand forecasting models trained successfully",
        "result": result
    }

@router.get("/ai/forecast/{product_id}", response_model=schemas.DemandForecastResponse)
def get_ai_forecast(
    product_id: int,
    days: int = Query(30, ge=7, le=90, description="Forecast horizon in days"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_staff_or_admin)
):
    product = db.query(models.Product).filter(models.Product.product_id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Current stock across all warehouses
    current_stock = db.query(func.coalesce(func.sum(models.Inventory.quantity), 0)).filter(
        models.Inventory.product_id == product_id
    ).scalar() or 0

    # Historical sales count
    sales_count = db.query(models.SaleItem).filter(models.SaleItem.product_id == product_id).count()

    # Generate prediction
    prediction = predict_demand(product_id, days_ahead=days)

    pred_units = prediction["predicted_demand"]
    stock_diff = current_stock - pred_units

    if current_stock == 0:
        risk_level = "Critical Out-of-Stock"
        explanation = f"{product.name} is completely out of stock with expected demand of {pred_units:.0f} units over {days} days."
    elif stock_diff < 0:
        risk_level = "Shortage Risk"
        explanation = f"Current inventory ({current_stock} units) is insufficient to cover projected {days}-day demand of {pred_units:.0f} units (projected deficit: {abs(stock_diff):.0f} units)."
    elif current_stock > (pred_units * 2.5) and current_stock > 50:
        risk_level = "Excess Stock"
        explanation = f"Current inventory ({current_stock} units) exceeds 250% of the projected {days}-day demand ({pred_units:.0f} units), tying up working capital."
    else:
        risk_level = "Balanced"
        explanation = f"Current inventory ({current_stock} units) adequately matches expected {days}-day demand of {pred_units:.0f} units."

    # Record prediction into demand_predictions table for tracking
    try:
        dp = models.DemandPrediction(
            product_id=product_id,
            predicted_quantity=int(round(pred_units)),
            model_used=prediction["model_used"],
            confidence_score=prediction["evaluation_metrics"].get("r2", 0.85) * 100
        )
        db.add(dp)
        db.commit()
    except Exception as e:
        db.rollback()

    return schemas.DemandForecastResponse(
        product_id=product.product_id,
        product_name=product.name,
        sku=product.sku,
        days_ahead=days,
        total_predicted_demand=pred_units,
        daily_predictions=[
            schemas.DailyForecastPoint(
                day=dp["day"],
                date=dp["date"],
                predicted_units=dp["predicted_units"]
            )
            for dp in prediction["daily_predictions"]
        ],
        historical_sales_count=sales_count,
        model_used=prediction["model_used"],
        is_baseline_model=prediction["is_baseline_model"],
        evaluation_metrics=prediction["evaluation_metrics"],
        current_stock=current_stock,
        stock_difference=stock_diff,
        risk_level=risk_level,
        explanation=explanation
    )

@router.get("/ai/restock-recommendations", response_model=List[schemas.RestockRecommendation])
def get_all_restock_recommendations(
    warehouse_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_staff_or_admin)
):
    products = db.query(models.Product).all()

    # Pre-calculate stock map
    stock_query = db.query(
        models.Inventory.product_id,
        func.coalesce(func.sum(models.Inventory.quantity), 0).label("qty"),
        func.max(models.Inventory.reorder_level).label("reorder")
    )
    if warehouse_id:
        stock_query = stock_query.filter(models.Inventory.warehouse_id == warehouse_id)
    stock_records = dict(
        (row.product_id, (int(row.qty), int(row.reorder)))
        for row in stock_query.group_by(models.Inventory.product_id).all()
    )

    # Pre-calculate pending incoming PO quantities
    pending_po_query = db.query(
        models.PurchaseItem.product_id,
        func.coalesce(func.sum(models.PurchaseItem.quantity), 0)
    ).join(models.Purchase).filter(models.Purchase.status.in_(["Pending", "Approved"]))
    if warehouse_id:
        pending_po_query = pending_po_query.filter(models.Purchase.warehouse_id == warehouse_id)
    pending_pos = dict(pending_po_query.group_by(models.PurchaseItem.product_id).all())

    # Pre-calculate 90-day sales velocity
    ninety_days_ago = datetime.now() - timedelta(days=90)
    sales_velocity_records = dict(
        db.query(
            models.SaleItem.product_id,
            func.coalesce(func.sum(models.SaleItem.quantity), 0)
        ).join(models.Sale).filter(
            models.Sale.status.in_(["Completed", "Confirmed"]),
            models.Sale.sale_date >= ninety_days_ago.date()
        ).group_by(models.SaleItem.product_id).all()
    )

    recommendations = []

    for prod in products:
        stock_info = stock_records.get(prod.product_id, (0, 10))
        current_stock = stock_info[0]
        reorder_level = stock_info[1]
        pending_incoming = int(pending_pos.get(prod.product_id, 0))

        # Calculate daily sales velocity
        total_90d_sold = float(sales_velocity_records.get(prod.product_id, 0))
        daily_velocity = round(total_90d_sold / 90.0, 2)
        if daily_velocity == 0:
            daily_velocity = 0.5  # Nominal minimum baseline

        # Predict 30-day demand
        pred = predict_demand(prod.product_id, days_ahead=30)
        predicted_30d = pred["predicted_demand"] if pred else round(daily_velocity * 30, 2)

        # Safety Stock formula: (Daily Velocity * Lead Time 7 days) + Reorder Level
        lead_time_days = 7
        safety_stock = int(round(daily_velocity * lead_time_days)) + reorder_level

        # Recommended order quantity: (Demand + Safety Stock) - (Current Stock + Pending POs)
        needed_qty = (predicted_30d + safety_stock) - (current_stock + pending_incoming)
        recommended_order_qty = max(0, int(round(needed_qty)))

        # Days until stockout
        if daily_velocity > 0:
            days_until_stockout = round(current_stock / daily_velocity, 1)
        else:
            days_until_stockout = None

        # Urgency level
        if current_stock == 0 or (days_until_stockout is not None and days_until_stockout <= 3):
            urgency = "Critical"
        elif current_stock <= reorder_level or (days_until_stockout is not None and days_until_stockout <= 7):
            urgency = "Warning"
        else:
            urgency = "Normal"

        cost_price = float(prod.cost_price or (float(prod.unit_price) * 0.7))
        estimated_cost = round(recommended_order_qty * cost_price, 2)

        # Rationale
        if urgency == "Critical":
            explanation = f"CRITICAL: Stock is at {current_stock} units. At current velocity of {daily_velocity} units/day, stock will be depleted in {days_until_stockout or 0} days. Reorder {recommended_order_qty} units immediately."
        elif urgency == "Warning":
            explanation = f"WARNING: Stock ({current_stock} units) is below reorder threshold ({reorder_level}). Projected 30-day demand is {predicted_30d:.0f} units. Recommended order: {recommended_order_qty} units."
        else:
            explanation = f"Healthy stock level ({current_stock} units). Buffer of {days_until_stockout or 30} days before reorder needed."

        recommendations.append(schemas.RestockRecommendation(
            product_id=prod.product_id,
            product_name=prod.name,
            sku=prod.sku,
            category_name=prod.category.name if prod.category else None,
            current_stock=current_stock,
            reorder_level=reorder_level,
            daily_sales_velocity=daily_velocity,
            predicted_demand_30d=predicted_30d,
            pending_po_units=pending_incoming,
            recommended_order_quantity=recommended_order_qty,
            days_until_stockout=days_until_stockout,
            urgency=urgency,
            suggested_supplier_id=prod.supplier_id,
            suggested_supplier_name=prod.supplier.name if prod.supplier else None,
            estimated_cost=estimated_cost,
            explanation=explanation
        ))

    # Sort so Critical and Warning items appear at the very top
    priority_order = {"Critical": 0, "Warning": 1, "Normal": 2}
    recommendations.sort(key=lambda r: (priority_order[r.urgency], -r.recommended_order_quantity))

    return recommendations

@router.post("/ai/convert-recommendation-to-po")
def convert_recommendation_to_po(
    payload: schemas.ConvertRecommendationToPO,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_inventory_manager)
):
    product = db.query(models.Product).filter(models.Product.product_id == payload.product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    supplier_id = payload.supplier_id or product.supplier_id
    supplier = db.query(models.Supplier).filter(models.Supplier.supplier_id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=400, detail="Invalid supplier")

    warehouse = db.query(models.Warehouse).filter(models.Warehouse.warehouse_id == payload.warehouse_id).first()
    if not warehouse:
        raise HTTPException(status_code=400, detail="Invalid warehouse")

    cost_price = float(product.cost_price or (float(product.unit_price) * 0.7))
    total_amount = float(payload.quantity) * cost_price

    po = models.Purchase(
        supplier_id=supplier_id,
        warehouse_id=payload.warehouse_id,
        status="Pending",
        total_amount=total_amount
    )
    db.add(po)
    db.flush()

    po_item = models.PurchaseItem(
        purchase_id=po.purchase_id,
        product_id=payload.product_id,
        quantity=payload.quantity,
        unit_price=cost_price
    )
    db.add(po_item)
    db.commit()
    db.refresh(po)

    details_str = f"Generated Draft PO #{po.purchase_id} from AI Restock Recommendation for {product.name} ({payload.quantity} units, ₹{total_amount:.2f})"
    log_audit(db, current_user, "AI_PO_GENERATED", "purchases", po.purchase_id, details_str)
    create_notification(
        db,
        user_id=current_user.user_id,
        title=f"Draft PO #{po.purchase_id} Generated",
        message=details_str,
        notification_type="info"
    )

    return {
        "success": True,
        "message": details_str,
        "purchase_id": po.purchase_id,
        "total_amount": total_amount,
        "status": po.status
    }

# ==========================================
# BACKWARD COMPATIBILITY ENDPOINTS
# ==========================================
@router.get("/predictions/{product_id}")
def legacy_get_prediction(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_staff_or_admin)
):
    pred = predict_demand(product_id, days_ahead=30)
    if not pred:
        return {"message": "No prediction available"}
    return pred

@router.post("/predictions/{product_id}")
def legacy_save_prediction(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_staff_or_admin)
):
    pred = predict_demand(product_id, days_ahead=30)
    if not pred:
        raise HTTPException(status_code=404, detail="Prediction failed")

    dp = models.DemandPrediction(
        product_id=product_id,
        predicted_quantity=int(round(pred["predicted_demand"])),
        model_used=pred["model_used"],
        confidence_score=pred["evaluation_metrics"].get("r2", 0.85) * 100
    )
    db.add(dp)
    db.commit()
    db.refresh(dp)

    return {
        "prediction_id": dp.prediction_id,
        "product_id": dp.product_id,
        "predicted_quantity": dp.predicted_quantity,
        "prediction_date": dp.prediction_date,
        "model_used": dp.model_used,
        "confidence_score": float(dp.confidence_score or 0)
    }

@router.get("/restock/{product_id}")
def legacy_restock(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_staff_or_admin)
):
    recs = get_all_restock_recommendations(warehouse_id=None, db=db, current_user=current_user)
    match = next((r for r in recs if r.product_id == product_id), None)
    if not match:
        raise HTTPException(status_code=404, detail="Product not found")

    return {
        "product_id": match.product_id,
        "predicted_demand": match.predicted_demand_30d,
        "current_stock": match.current_stock,
        "recommended_restock_quantity": match.recommended_order_quantity,
        "recommendation": "Restock Required" if match.recommended_order_quantity > 0 else "Stock Sufficient"
    }
