from sqlalchemy import Column, Integer, String, Text, Numeric, Date, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base

class User(Base):
    __tablename__ = "users"

    user_id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, nullable=False, index=True)
    password = Column(String(255), nullable=False)
    role = Column(String(50), default="staff")  # admin, inventory_manager, staff
    created_at = Column(DateTime, server_default=func.now())

    audit_logs = relationship("AuditLog", back_populates="user")
    notifications = relationship("Notification", back_populates="user")


class Category(Base):
    __tablename__ = "categories"

    category_id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)
    description = Column(Text, nullable=True)

    products = relationship("Product", back_populates="category")


class Supplier(Base):
    __tablename__ = "suppliers"

    supplier_id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    contact_person = Column(String(100), nullable=True)
    phone = Column(String(50), nullable=True)
    email = Column(String(150), nullable=True)
    address = Column(Text, nullable=True)

    products = relationship("Product", back_populates="supplier")
    purchases = relationship("Purchase", back_populates="supplier")


class Warehouse(Base):
    __tablename__ = "warehouses"

    warehouse_id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    location = Column(String(200), nullable=True)
    manager = Column(String(100), nullable=True)
    capacity = Column(Integer, nullable=True)

    inventory_items = relationship("Inventory", back_populates="warehouse")
    stock_transactions = relationship("StockTransaction", back_populates="warehouse")
    purchases = relationship("Purchase", back_populates="warehouse")
    sales = relationship("Sale", back_populates="warehouse")


class Product(Base):
    __tablename__ = "products"

    product_id = Column(Integer, primary_key=True, index=True)
    sku = Column(String(100), unique=True, index=True, nullable=True)
    name = Column(String(150), nullable=False, index=True)
    description = Column(Text, nullable=True)
    category_id = Column(Integer, ForeignKey("categories.category_id"), nullable=False)
    supplier_id = Column(Integer, ForeignKey("suppliers.supplier_id"), nullable=False)
    unit_price = Column(Numeric(10, 2), nullable=False)
    cost_price = Column(Numeric(10, 2), default=0.0)
    created_at = Column(DateTime, server_default=func.now())

    category = relationship("Category", back_populates="products")
    supplier = relationship("Supplier", back_populates="products")
    inventory_records = relationship("Inventory", back_populates="product", cascade="all, delete-orphan")
    stock_transactions = relationship("StockTransaction", back_populates="product")
    purchase_items = relationship("PurchaseItem", back_populates="product")
    sale_items = relationship("SaleItem", back_populates="product")
    predictions = relationship("DemandPrediction", back_populates="product")


class Inventory(Base):
    __tablename__ = "inventory"

    inventory_id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.product_id"), nullable=False)
    warehouse_id = Column(Integer, ForeignKey("warehouses.warehouse_id"), nullable=False)
    quantity = Column(Integer, default=0, nullable=False)
    reorder_level = Column(Integer, default=10, nullable=False)
    last_updated = Column(DateTime, server_default=func.now(), onupdate=func.now())

    product = relationship("Product", back_populates="inventory_records")
    warehouse = relationship("Warehouse", back_populates="inventory_items")


class StockTransaction(Base):
    __tablename__ = "stock_transactions"

    transaction_id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.product_id"), nullable=False)
    warehouse_id = Column(Integer, ForeignKey("warehouses.warehouse_id"), nullable=False)
    transaction_type = Column(String(50), nullable=False)  # IN, OUT, TRANSFER, ADJUSTMENT
    quantity = Column(Integer, nullable=False)
    transaction_date = Column(DateTime, server_default=func.now())
    reference_id = Column(Integer, nullable=True)

    product = relationship("Product", back_populates="stock_transactions")
    warehouse = relationship("Warehouse", back_populates="stock_transactions")


class Purchase(Base):
    __tablename__ = "purchases"

    purchase_id = Column(Integer, primary_key=True, index=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.supplier_id"), nullable=False)
    warehouse_id = Column(Integer, ForeignKey("warehouses.warehouse_id"), nullable=False)
    purchase_date = Column(Date, server_default=func.current_date())
    total_amount = Column(Numeric(12, 2), default=0.0)
    status = Column(String(50), default="Pending")  # Draft, Pending, Approved, Partially Received, Completed, Cancelled

    supplier = relationship("Supplier", back_populates="purchases")
    warehouse = relationship("Warehouse", back_populates="purchases")
    items = relationship("PurchaseItem", back_populates="purchase", cascade="all, delete-orphan")


from sqlalchemy.schema import FetchedValue

class PurchaseItem(Base):
    __tablename__ = "purchase_items"

    item_id = Column(Integer, primary_key=True, index=True)
    purchase_id = Column(Integer, ForeignKey("purchases.purchase_id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.product_id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Numeric(10, 2), nullable=False)
    total_price = Column(Numeric(12, 2), FetchedValue())

    purchase = relationship("Purchase", back_populates="items")
    product = relationship("Product", back_populates="purchase_items")


class Sale(Base):
    __tablename__ = "sales"

    sale_id = Column(Integer, primary_key=True, index=True)
    customer_name = Column(String(150), nullable=True)
    warehouse_id = Column(Integer, ForeignKey("warehouses.warehouse_id"), nullable=False)
    sale_date = Column(Date, server_default=func.current_date())
    total_amount = Column(Numeric(12, 2), default=0.0)
    status = Column(String(50), default="Completed")  # Draft, Confirmed, Completed, Cancelled, Returned

    warehouse = relationship("Warehouse", back_populates="sales")
    items = relationship("SaleItem", back_populates="sale", cascade="all, delete-orphan")


class SaleItem(Base):
    __tablename__ = "sale_items"

    item_id = Column(Integer, primary_key=True, index=True)
    sale_id = Column(Integer, ForeignKey("sales.sale_id"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.product_id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    unit_price = Column(Numeric(10, 2), nullable=False)
    total_price = Column(Numeric(12, 2), FetchedValue())

    sale = relationship("Sale", back_populates="items")
    product = relationship("Product", back_populates="sale_items")


class DemandPrediction(Base):
    __tablename__ = "demand_predictions"

    prediction_id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.product_id"), nullable=False)
    predicted_quantity = Column(Integer, nullable=False)
    prediction_date = Column(Date, server_default=func.current_date())
    model_used = Column(String(100), default="Linear Regression")
    confidence_score = Column(Numeric(5, 2), nullable=True)

    product = relationship("Product", back_populates="predictions")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    log_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id", ondelete="SET NULL"), nullable=True)
    username = Column(String(100), nullable=True)
    action = Column(String(100), nullable=False)
    entity_type = Column(String(100), nullable=True)
    entity_id = Column(Integer, nullable=True)
    details = Column(Text, nullable=True)
    timestamp = Column(DateTime, server_default=func.now())

    user = relationship("User", back_populates="audit_logs")


class Notification(Base):
    __tablename__ = "notifications"

    notification_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.user_id", ondelete="CASCADE"), nullable=True)
    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=False)
    notification_type = Column(String(50), default="info")  # low_stock, out_of_stock, transfer, po_received, info
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User", back_populates="notifications")
