import csv
import io
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Response
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, desc, asc
from database import get_db
import models
import schemas
from dependencies import require_admin, require_inventory_manager, require_staff_or_admin, log_audit, create_notification

router = APIRouter(prefix="", tags=["Products & Categories"])

# ==========================================
# CATEGORIES
# ==========================================
@router.get("/categories", response_model=List[schemas.CategoryResponse])
def get_categories(db: Session = Depends(get_db)):
    categories = db.query(models.Category).order_by(models.Category.category_id).all()
    return [schemas.CategoryResponse.model_validate(c) for c in categories]

@router.post("/categories", response_model=schemas.CategoryResponse)
def create_category(
    cat: schemas.CategoryCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_inventory_manager)
):
    existing = db.query(models.Category).filter(models.Category.name.ilike(cat.name)).first()
    if existing:
        raise HTTPException(status_code=400, detail="Category name already exists")

    new_cat = models.Category(name=cat.name, description=cat.description)
    db.add(new_cat)
    db.commit()
    db.refresh(new_cat)
    log_audit(db, current_user, "CATEGORY_CREATED", "categories", new_cat.category_id, f"Created category {new_cat.name}")
    return schemas.CategoryResponse.model_validate(new_cat)

@router.put("/categories/{category_id}", response_model=schemas.CategoryResponse)
def update_category(
    category_id: int,
    cat_update: schemas.CategoryUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_inventory_manager)
):
    category = db.query(models.Category).filter(models.Category.category_id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    if cat_update.name and cat_update.name != category.name:
        existing = db.query(models.Category).filter(
            models.Category.name.ilike(cat_update.name),
            models.Category.category_id != category_id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Category with this name already exists")
        category.name = cat_update.name

    if cat_update.description is not None:
        category.description = cat_update.description

    db.commit()
    db.refresh(category)
    log_audit(db, current_user, "CATEGORY_UPDATED", "categories", category.category_id, f"Updated category {category.name}")
    return schemas.CategoryResponse.model_validate(category)

@router.delete("/categories/{category_id}")
def delete_category(
    category_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin)
):
    category = db.query(models.Category).filter(models.Category.category_id == category_id).first()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    product_count = db.query(models.Product).filter(models.Product.category_id == category_id).count()
    if product_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete category. {product_count} products are currently assigned to it."
        )

    db.delete(category)
    db.commit()
    log_audit(db, current_user, "CATEGORY_DELETED", "categories", category_id, f"Deleted category {category.name}")
    return {"message": "Category deleted successfully"}


# ==========================================
# PRODUCTS
# ==========================================
def compute_stock_status(total_stock: int, reorder_level: int) -> str:
    if total_stock <= 0:
        return "Out of Stock"
    elif total_stock <= reorder_level:
        return "Low Stock"
    return "In Stock"

@router.get("/products", response_model=List[schemas.ProductResponse])
def get_products(
    search: Optional[str] = Query(None, description="Search by product name, SKU, or ID"),
    category_id: Optional[int] = Query(None),
    supplier_id: Optional[int] = Query(None),
    warehouse_id: Optional[int] = Query(None),
    stock_status: Optional[str] = Query(None, description="'In Stock', 'Low Stock', 'Out of Stock'"),
    sort_by: Optional[str] = Query("product_id"),
    sort_dir: Optional[str] = Query("asc"),
    page: Optional[int] = Query(1, ge=1),
    limit: Optional[int] = Query(100, ge=1, le=500),
    db: Session = Depends(get_db)
):
    query = db.query(models.Product)

    # Search filter
    if search:
        search_term = f"%{search.strip()}%"
        try:
            search_id = int(search.strip())
            query = query.filter(
                or_(
                    models.Product.name.ilike(search_term),
                    models.Product.sku.ilike(search_term),
                    models.Product.description.ilike(search_term),
                    models.Product.product_id == search_id
                )
            )
        except ValueError:
            query = query.filter(
                or_(
                    models.Product.name.ilike(search_term),
                    models.Product.sku.ilike(search_term),
                    models.Product.description.ilike(search_term)
                )
            )

    if category_id:
        query = query.filter(models.Product.category_id == category_id)

    if supplier_id:
        query = query.filter(models.Product.supplier_id == supplier_id)

    if warehouse_id:
        query = query.join(models.Inventory).filter(models.Inventory.warehouse_id == warehouse_id)

    # Sorting
    sort_column = getattr(models.Product, sort_by, models.Product.product_id)
    if sort_dir.lower() == "desc":
        query = query.order_by(desc(sort_column))
    else:
        query = query.order_by(asc(sort_column))

    products = query.offset((page - 1) * limit).limit(limit).all()

    # Pre-calculate inventory totals for loaded products
    product_ids = [p.product_id for p in products]
    stock_map = {}
    reorder_map = {}
    if product_ids:
        inv_records = db.query(
            models.Inventory.product_id,
            func.sum(models.Inventory.quantity).label("total_qty"),
            func.max(models.Inventory.reorder_level).label("max_reorder")
        ).filter(models.Inventory.product_id.in_(product_ids)).group_by(models.Inventory.product_id).all()

        for inv in inv_records:
            stock_map[inv.product_id] = int(inv.total_qty or 0)
            reorder_map[inv.product_id] = int(inv.max_reorder or 10)

    results = []
    for p in products:
        total_stk = stock_map.get(p.product_id, 0)
        reorder_lvl = reorder_map.get(p.product_id, 10)
        status_label = compute_stock_status(total_stk, reorder_lvl)

        if stock_status and stock_status.lower() != status_label.lower():
            continue

        cost = float(p.cost_price if p.cost_price is not None else round(float(p.unit_price) * 0.7, 2))
        results.append(schemas.ProductResponse(
            product_id=p.product_id,
            sku=p.sku,
            name=p.name,
            description=p.description,
            category_id=p.category_id,
            category_name=p.category.name if p.category else None,
            supplier_id=p.supplier_id,
            supplier_name=p.supplier.name if p.supplier else None,
            unit_price=float(p.unit_price),
            cost_price=cost,
            total_stock=total_stk,
            reorder_level=reorder_lvl,
            stock_status=status_label,
            created_at=p.created_at
        ))

    return results

@router.get("/products/{product_id}", response_model=schemas.ProductDetailResponse)
def get_product_detail(product_id: int, db: Session = Depends(get_db)):
    product = db.query(models.Product).filter(models.Product.product_id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    inv_records = db.query(models.Inventory).filter(models.Inventory.product_id == product_id).all()
    warehouse_stocks = []
    total_stk = 0
    max_reorder = 10
    for inv in inv_records:
        total_stk += inv.quantity
        if inv.reorder_level > max_reorder:
            max_reorder = inv.reorder_level
        warehouse_stocks.append(schemas.ProductWarehouseStock(
            warehouse_id=inv.warehouse_id,
            warehouse_name=inv.warehouse.name if inv.warehouse else f"Warehouse {inv.warehouse_id}",
            quantity=inv.quantity,
            reorder_level=inv.reorder_level,
            last_updated=inv.last_updated
        ))

    cost = float(product.cost_price if product.cost_price is not None else round(float(product.unit_price) * 0.7, 2))
    return schemas.ProductDetailResponse(
        product_id=product.product_id,
        sku=product.sku,
        name=product.name,
        description=product.description,
        category_id=product.category_id,
        category_name=product.category.name if product.category else None,
        supplier_id=product.supplier_id,
        supplier_name=product.supplier.name if product.supplier else None,
        unit_price=float(product.unit_price),
        cost_price=cost,
        total_stock=total_stk,
        reorder_level=max_reorder,
        stock_status=compute_stock_status(total_stk, max_reorder),
        created_at=product.created_at,
        warehouse_stocks=warehouse_stocks
    )

@router.post("/products", response_model=schemas.ProductResponse)
def create_product(
    prod: schemas.ProductCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_inventory_manager)
):
    # Category validation
    category = db.query(models.Category).filter(models.Category.category_id == prod.category_id).first()
    if not category:
        raise HTTPException(status_code=400, detail="Invalid category_id")

    # Supplier validation
    supplier = db.query(models.Supplier).filter(models.Supplier.supplier_id == prod.supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=400, detail="Invalid supplier_id")

    # Generate or validate SKU
    sku = prod.sku.strip() if prod.sku else None
    if sku:
        existing_sku = db.query(models.Product).filter(models.Product.sku.ilike(sku)).first()
        if existing_sku:
            raise HTTPException(status_code=400, detail=f"Duplicate SKU '{sku}'. SKU must be unique.")
    else:
        # Auto-generate unique SKU
        count = db.query(models.Product).count() + 1
        sku = f"SKU-{prod.name[:3].upper()}-{count:04d}"

    cost_price = prod.cost_price if prod.cost_price is not None else round(prod.unit_price * 0.70, 2)

    new_prod = models.Product(
        sku=sku,
        name=prod.name,
        description=prod.description,
        category_id=prod.category_id,
        supplier_id=prod.supplier_id,
        unit_price=prod.unit_price,
        cost_price=cost_price
    )
    db.add(new_prod)
    db.commit()
    db.refresh(new_prod)

    # Initial inventory creation if specified
    total_initial_stock = 0
    if prod.initial_stock and prod.initial_stock > 0 and prod.initial_warehouse_id:
        wh = db.query(models.Warehouse).filter(models.Warehouse.warehouse_id == prod.initial_warehouse_id).first()
        if wh:
            inv = models.Inventory(
                product_id=new_prod.product_id,
                warehouse_id=wh.warehouse_id,
                quantity=0,
                reorder_level=prod.reorder_level or 10
            )
            db.add(inv)
            db.flush()
            # Record initial stock transaction (trigger updates inventory.quantity)
            txn = models.StockTransaction(
                product_id=new_prod.product_id,
                warehouse_id=wh.warehouse_id,
                transaction_type="IN",
                quantity=prod.initial_stock,
                reference_id=new_prod.product_id
            )
            db.add(txn)
            db.commit()
            total_initial_stock = prod.initial_stock

    log_audit(db, current_user, "PRODUCT_CREATED", "products", new_prod.product_id, f"Created product {new_prod.name} ({new_prod.sku})")

    return schemas.ProductResponse(
        product_id=new_prod.product_id,
        sku=new_prod.sku,
        name=new_prod.name,
        description=new_prod.description,
        category_id=new_prod.category_id,
        category_name=category.name,
        supplier_id=new_prod.supplier_id,
        supplier_name=supplier.name,
        unit_price=float(new_prod.unit_price),
        cost_price=float(new_prod.cost_price),
        total_stock=total_initial_stock,
        reorder_level=prod.reorder_level or 10,
        stock_status=compute_stock_status(total_initial_stock, prod.reorder_level or 10),
        created_at=new_prod.created_at
    )

@router.put("/products/{product_id}", response_model=schemas.ProductResponse)
def update_product(
    product_id: int,
    prod_update: schemas.ProductUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_inventory_manager)
):
    product = db.query(models.Product).filter(models.Product.product_id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    if prod_update.sku and prod_update.sku != product.sku:
        existing_sku = db.query(models.Product).filter(
            models.Product.sku.ilike(prod_update.sku.strip()),
            models.Product.product_id != product_id
        ).first()
        if existing_sku:
            raise HTTPException(status_code=400, detail=f"SKU '{prod_update.sku}' is already in use by another product")
        product.sku = prod_update.sku.strip()

    if prod_update.name:
        product.name = prod_update.name
    if prod_update.description is not None:
        product.description = prod_update.description
    if prod_update.category_id:
        cat = db.query(models.Category).filter(models.Category.category_id == prod_update.category_id).first()
        if not cat:
            raise HTTPException(status_code=400, detail="Invalid category_id")
        product.category_id = prod_update.category_id
    if prod_update.supplier_id:
        sup = db.query(models.Supplier).filter(models.Supplier.supplier_id == prod_update.supplier_id).first()
        if not sup:
            raise HTTPException(status_code=400, detail="Invalid supplier_id")
        product.supplier_id = prod_update.supplier_id
    if prod_update.unit_price is not None:
        product.unit_price = prod_update.unit_price
    if prod_update.cost_price is not None:
        product.cost_price = prod_update.cost_price

    db.commit()
    db.refresh(product)
    log_audit(db, current_user, "PRODUCT_UPDATED", "products", product.product_id, f"Updated product {product.name} ({product.sku})")

    # Get updated total stock
    total_stk = db.query(func.coalesce(func.sum(models.Inventory.quantity), 0)).filter(
        models.Inventory.product_id == product_id
    ).scalar() or 0

    return schemas.ProductResponse(
        product_id=product.product_id,
        sku=product.sku,
        name=product.name,
        description=product.description,
        category_id=product.category_id,
        category_name=product.category.name if product.category else None,
        supplier_id=product.supplier_id,
        supplier_name=product.supplier.name if product.supplier else None,
        unit_price=float(product.unit_price),
        cost_price=float(product.cost_price or 0),
        total_stock=total_stk,
        reorder_level=10,
        stock_status=compute_stock_status(total_stk, 10),
        created_at=product.created_at
    )

@router.delete("/products/{product_id}")
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_admin)
):
    product = db.query(models.Product).filter(models.Product.product_id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    # Check dependencies in sales or purchases
    sales_count = db.query(models.SaleItem).filter(models.SaleItem.product_id == product_id).count()
    po_count = db.query(models.PurchaseItem).filter(models.PurchaseItem.product_id == product_id).count()
    if sales_count > 0 or po_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete product with existing sales ({sales_count}) or purchase orders ({po_count})."
        )

    # Delete inventory and transactions
    db.query(models.StockTransaction).filter(models.StockTransaction.product_id == product_id).delete()
    db.query(models.Inventory).filter(models.Inventory.product_id == product_id).delete()
    db.query(models.DemandPrediction).filter(models.DemandPrediction.product_id == product_id).delete()
    
    prod_name = product.name
    sku = product.sku
    db.delete(product)
    db.commit()

    log_audit(db, current_user, "PRODUCT_DELETED", "products", product_id, f"Deleted product {prod_name} ({sku})")
    return {"message": f"Product '{prod_name}' deleted successfully"}


# ==========================================
# CSV IMPORT / EXPORT
# ==========================================
@router.get("/products/export/csv")
def export_products_csv(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_staff_or_admin)
):
    products = db.query(models.Product).order_by(models.Product.product_id).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["product_id", "sku", "name", "description", "category", "supplier", "unit_price", "cost_price", "total_stock"])

    for p in products:
        total_stk = db.query(func.coalesce(func.sum(models.Inventory.quantity), 0)).filter(
            models.Inventory.product_id == p.product_id
        ).scalar() or 0
        writer.writerow([
            p.product_id,
            p.sku or "",
            p.name,
            p.description or "",
            p.category.name if p.category else "",
            p.supplier.name if p.supplier else "",
            float(p.unit_price),
            float(p.cost_price or 0),
            total_stk
        ])

    csv_data = output.getvalue()
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=products_catalog.csv"}
    )

@router.post("/products/import/csv")
async def import_products_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(require_inventory_manager)
):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")

    content = await file.read()
    try:
        decoded = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        decoded = content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(decoded))
    imported = 0
    errors = []

    categories = {c.name.lower(): c.category_id for c in db.query(models.Category).all()}
    suppliers = {s.name.lower(): s.supplier_id for s in db.query(models.Supplier).all()}
    default_cat_id = next(iter(categories.values()), 1)
    default_sup_id = next(iter(suppliers.values()), 1)

    row_num = 1
    for row in reader:
        row_num += 1
        name = row.get("name", "").strip()
        if not name:
            errors.append(f"Row {row_num}: Missing product name")
            continue

        sku = row.get("sku", "").strip()
        if sku:
            if db.query(models.Product).filter(models.Product.sku.ilike(sku)).first():
                errors.append(f"Row {row_num}: Duplicate SKU '{sku}'")
                continue
        else:
            count = db.query(models.Product).count() + 1
            sku = f"SKU-{name[:3].upper()}-{count:04d}"

        try:
            unit_price = float(row.get("unit_price", 0))
        except ValueError:
            errors.append(f"Row {row_num}: Invalid unit_price")
            continue

        cost_price = float(row.get("cost_price", 0)) if row.get("cost_price") else round(unit_price * 0.7, 2)

        cat_name = row.get("category", "").strip().lower()
        cat_id = categories.get(cat_name, default_cat_id)

        sup_name = row.get("supplier", "").strip().lower()
        sup_id = suppliers.get(sup_name, default_sup_id)

        desc = row.get("description", "").strip() or None

        new_prod = models.Product(
            sku=sku,
            name=name,
            description=desc,
            category_id=cat_id,
            supplier_id=sup_id,
            unit_price=unit_price,
            cost_price=cost_price
        )
        db.add(new_prod)
        imported += 1

    db.commit()
    log_audit(db, current_user, "PRODUCTS_BULK_IMPORT", "products", None, f"Imported {imported} products from CSV")

    return {
        "success": True,
        "imported_count": imported,
        "errors": errors
    }
