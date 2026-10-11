import random
from datetime import datetime, timedelta, date
from pathlib import Path
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=env_path)

from database import engine, SessionLocal
import models
from ai.train_model import train_all_models

def seed_demo_data():
    db = SessionLocal()
    print("Checking database for demo seeding...")

    try:
        # Check sales count
        existing_sales_count = db.query(models.Sale).count()
        print(f"Current sales count: {existing_sales_count}")

        # If we have less than 50 sales, enrich with realistic demo sales history over the last 90 days
        if existing_sales_count < 50:
            print("Enriching with realistic demo sales transactions for high-accuracy AI modeling...")
            products = db.query(models.Product).all()
            warehouses = db.query(models.Warehouse).all()

            if not products or not warehouses:
                print("Missing products or warehouses. Skipping sales generation.")
                return

            customers = [
                "Acme Retailers", "Global Tech Corp", "Apex Innovations", "Prime Supply Ltd",
                "Starlight Offices", "Vanguard Logistics", "Horizon Enterprises", "Zenith Commerce",
                "BlueWave Distributors", "Metro Supermarket", "Swift Express", "Crestline Trading"
            ]

            # Generate 90 days of sales
            end_date = datetime.now().date()
            start_date = end_date - timedelta(days=90)
            current_date = start_date

            sales_added = 0
            while current_date <= end_date:
                # 1 to 3 sales per day
                num_sales_today = random.randint(1, 3)
                for _ in range(num_sales_today):
                    customer = random.choice(customers)
                    wh = random.choice(warehouses)

                    sale = models.Sale(
                        customer_name=customer,
                        warehouse_id=wh.warehouse_id,
                        sale_date=current_date,
                        status="Completed",
                        total_amount=0.0
                    )
                    db.add(sale)
                    db.flush()

                    # 1 to 3 items per sale
                    sampled_products = random.sample(products, min(len(products), random.randint(1, 3)))
                    sale_total = 0.0

                    for prod in sampled_products:
                        # Realistic weekly seasonality: weekends higher
                        is_weekend = current_date.weekday() >= 5
                        base_qty = random.randint(4, 18)
                        qty = int(base_qty * (1.3 if is_weekend else 1.0))

                        price = float(prod.unit_price)
                        item_total = qty * price
                        sale_total += item_total

                        item = models.SaleItem(
                            sale_id=sale.sale_id,
                            product_id=prod.product_id,
                            quantity=qty,
                            unit_price=price
                        )
                        db.add(item)

                    sale.total_amount = round(sale_total, 2)
                    sales_added += 1

                current_date += timedelta(days=1)

            db.commit()
            print(f"Successfully added {sales_added} historical demo sales records!")

        # Train models with the rich historical data
        print("Training AI models...")
        result = train_all_models()
        print(f"AI training completed: {result.get('trained_count', 0)} models active.")

    except Exception as e:
        db.rollback()
        print(f"Error during seeding: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_demo_data()
