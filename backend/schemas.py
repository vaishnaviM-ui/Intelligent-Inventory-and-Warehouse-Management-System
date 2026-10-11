from typing import List, Optional
from datetime import date, datetime
from pydantic import BaseModel, EmailStr, Field

# ==========================================
# AUTH & USERS
# ==========================================
class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    role: Optional[str] = "staff"

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(BaseModel):
    user_id: int
    name: str
    email: str
    role: str
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class UserUpdateRole(BaseModel):
    role: str

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: Optional[UserResponse] = None

# ==========================================
# CATEGORIES
# ==========================================
class CategoryCreate(BaseModel):
    name: str
    description: Optional[str] = None

class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class CategoryResponse(BaseModel):
    category_id: int
    name: str
    description: Optional[str] = None

    class Config:
        from_attributes = True

# ==========================================
# SUPPLIERS
# ==========================================
class SupplierCreate(BaseModel):
    name: str
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None

class SupplierUpdate(BaseModel):
    name: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None

class SupplierResponse(BaseModel):
    supplier_id: int
    name: str
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None

    class Config:
        from_attributes = True

# ==========================================
# WAREHOUSES
# ==========================================
class WarehouseCreate(BaseModel):
    name: str
    location: Optional[str] = None
    manager: Optional[str] = None
    capacity: Optional[int] = 5000

class WarehouseUpdate(BaseModel):
    name: Optional[str] = None
    location: Optional[str] = None
    manager: Optional[str] = None
    capacity: Optional[int] = None

class WarehouseResponse(BaseModel):
    warehouse_id: int
    name: str
    location: Optional[str] = None
    manager: Optional[str] = None
    capacity: Optional[int] = None
    total_stock: Optional[int] = 0
    utilization_rate: Optional[float] = 0.0

    class Config:
        from_attributes = True

# ==========================================
# PRODUCTS & INVENTORY
# ==========================================
class ProductCreate(BaseModel):
    sku: Optional[str] = None
    name: str
    description: Optional[str] = None
    category_id: int
    supplier_id: int
    unit_price: float = Field(..., ge=0)
    cost_price: Optional[float] = Field(None, ge=0)
    initial_stock: Optional[int] = Field(0, ge=0)
    initial_warehouse_id: Optional[int] = None
    reorder_level: Optional[int] = Field(10, ge=0)

class ProductUpdate(BaseModel):
    sku: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    category_id: Optional[int] = None
    supplier_id: Optional[int] = None
    unit_price: Optional[float] = Field(None, ge=0)
    cost_price: Optional[float] = Field(None, ge=0)

class ProductResponse(BaseModel):
    product_id: int
    sku: Optional[str] = None
    name: str
    description: Optional[str] = None
    category_id: int
    category_name: Optional[str] = None
    supplier_id: int
    supplier_name: Optional[str] = None
    unit_price: float
    cost_price: float
    total_stock: int = 0
    reorder_level: int = 10
    stock_status: str = "In Stock"  # In Stock, Low Stock, Out of Stock
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class ProductWarehouseStock(BaseModel):
    warehouse_id: int
    warehouse_name: str
    quantity: int
    reorder_level: int
    last_updated: Optional[datetime] = None

class ProductDetailResponse(ProductResponse):
    warehouse_stocks: List[ProductWarehouseStock] = []

class StockTransactionCreate(BaseModel):
    product_id: int
    warehouse_id: int
    transaction_type: str  # IN, OUT, ADJUSTMENT
    quantity: int = Field(..., gt=0)
    reference_id: Optional[int] = None
    notes: Optional[str] = None

class StockTransferCreate(BaseModel):
    product_id: int
    from_warehouse_id: int
    to_warehouse_id: int
    quantity: int = Field(..., gt=0)
    notes: Optional[str] = None

class StockAdjustmentCreate(BaseModel):
    product_id: int
    warehouse_id: int
    new_quantity: int = Field(..., ge=0)
    reason: str

class StockTransactionResponse(BaseModel):
    transaction_id: int
    product_id: int
    product_name: Optional[str] = None
    sku: Optional[str] = None
    warehouse_id: int
    warehouse_name: Optional[str] = None
    transaction_type: str
    quantity: int
    reference_id: Optional[int] = None
    transaction_date: Optional[datetime] = None

    class Config:
        from_attributes = True

# ==========================================
# PURCHASES & ORDERS
# ==========================================
class PurchaseItemCreate(BaseModel):
    product_id: int
    quantity: int = Field(..., gt=0)
    unit_price: float = Field(..., ge=0)

class PurchaseItemResponse(BaseModel):
    item_id: int
    product_id: int
    product_name: Optional[str] = None
    sku: Optional[str] = None
    quantity: int
    unit_price: float
    total_price: float

    class Config:
        from_attributes = True

class PurchaseCreate(BaseModel):
    supplier_id: int
    warehouse_id: int
    items: List[PurchaseItemCreate]

class PurchaseStatusUpdate(BaseModel):
    status: str  # Draft, Pending, Approved, Completed, Cancelled

class PurchaseReceiveItem(BaseModel):
    product_id: int
    received_quantity: int = Field(..., gt=0)

class PurchaseReceiveCreate(BaseModel):
    items: Optional[List[PurchaseReceiveItem]] = None  # None = receive all items fully

class PurchaseResponse(BaseModel):
    purchase_id: int
    supplier_id: int
    supplier_name: Optional[str] = None
    warehouse_id: int
    warehouse_name: Optional[str] = None
    purchase_date: Optional[date] = None
    total_amount: float
    status: str
    items: List[PurchaseItemResponse] = []

    class Config:
        from_attributes = True

# ==========================================
# SALES
# ==========================================
class SaleItemCreate(BaseModel):
    product_id: int
    quantity: int = Field(..., gt=0)
    unit_price: Optional[float] = None  # If None, use product unit_price

class SaleItemResponse(BaseModel):
    item_id: int
    product_id: int
    product_name: Optional[str] = None
    sku: Optional[str] = None
    quantity: int
    unit_price: float
    total_price: float

    class Config:
        from_attributes = True

class SaleCreate(BaseModel):
    customer_name: Optional[str] = "Walk-in Customer"
    warehouse_id: int
    items: List[SaleItemCreate]

class SaleReturnCreate(BaseModel):
    reason: Optional[str] = "Customer return"
    items: Optional[List[SaleItemCreate]] = None  # None = full order return

class SaleResponse(BaseModel):
    sale_id: int
    customer_name: Optional[str] = None
    warehouse_id: int
    warehouse_name: Optional[str] = None
    sale_date: Optional[date] = None
    total_amount: float
    status: str
    items: List[SaleItemResponse] = []

    class Config:
        from_attributes = True

# ==========================================
# AI DEMAND FORECASTING & RESTOCK
# ==========================================
class DailyForecastPoint(BaseModel):
    day: int
    date: str
    predicted_units: float

class DemandForecastResponse(BaseModel):
    product_id: int
    product_name: str
    sku: Optional[str] = None
    days_ahead: int
    total_predicted_demand: float
    daily_predictions: List[DailyForecastPoint]
    historical_sales_count: int
    model_used: str
    is_baseline_model: bool
    evaluation_metrics: dict  # mae, rmse, r2
    current_stock: int
    stock_difference: float  # current_stock - predicted_demand
    risk_level: str  # Shortage Risk, Balanced, Excess Stock
    explanation: str

class RestockRecommendation(BaseModel):
    product_id: int
    product_name: str
    sku: Optional[str] = None
    category_name: Optional[str] = None
    current_stock: int
    reorder_level: int
    daily_sales_velocity: float
    predicted_demand_30d: float
    pending_po_units: int
    recommended_order_quantity: int
    days_until_stockout: Optional[float] = None
    urgency: str  # Critical, Warning, Normal
    suggested_supplier_id: Optional[int] = None
    suggested_supplier_name: Optional[str] = None
    estimated_cost: float
    explanation: str

class ConvertRecommendationToPO(BaseModel):
    product_id: int
    quantity: int
    warehouse_id: int
    supplier_id: Optional[int] = None

# ==========================================
# AUDIT LOGS & NOTIFICATIONS
# ==========================================
class AuditLogResponse(BaseModel):
    log_id: int
    user_id: Optional[int] = None
    username: Optional[str] = None
    action: str
    entity_type: Optional[str] = None
    entity_id: Optional[int] = None
    details: Optional[str] = None
    timestamp: datetime

    class Config:
        from_attributes = True

class NotificationResponse(BaseModel):
    notification_id: int
    title: str
    message: str
    notification_type: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True

# ==========================================
# DASHBOARD & REPORTS
# ==========================================
class DashboardMetrics(BaseModel):
    total_products: int
    total_stock_units: int
    inventory_valuation_cost: float
    inventory_valuation_retail: float
    low_stock_items: int
    out_of_stock_items: int
    total_warehouses: int
    total_suppliers: int
    pending_purchase_orders: int
    total_sales_amount: float
    total_completed_orders: int