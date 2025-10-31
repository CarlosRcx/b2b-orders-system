-- B2B Orders System - Seed Data

-- Insert sample customers
INSERT INTO customers (name, email, phone) VALUES
('ACME Corporation', 'ops@acme.com', '+1-555-0101'),
('Global Tech Solutions', 'contact@globaltech.com', '+1-555-0102'),
('Premium Retailers Inc', 'orders@premiumretail.com', '+1-555-0103'),
('Distribuidora El Sol', 'ventas@elsol.com', '+52-555-0104'),
('European Trading Co', 'sales@eurotrading.eu', '+44-20-5550105');

-- Insert sample products
INSERT INTO products (sku, name, price_cents, stock) VALUES
('SKU-LAPTOP-001', 'Business Laptop Pro 15"', 129900, 50),
('SKU-MOUSE-001', 'Wireless Mouse Ergonomic', 3500, 200),
('SKU-KEYBOARD-001', 'Mechanical Keyboard RGB', 8900, 120),
('SKU-MONITOR-001', 'LED Monitor 27" 4K', 45900, 35),
('SKU-HEADSET-001', 'Noise Cancelling Headset', 12500, 80),
('SKU-WEBCAM-001', 'HD Webcam 1080p', 6900, 150),
('SKU-DOCK-001', 'USB-C Docking Station', 18900, 45),
('SKU-CABLE-001', 'HDMI Cable 2m', 1200, 500),
('SKU-ADAPTER-001', 'USB-C to HDMI Adapter', 2500, 300),
('SKU-BAG-001', 'Laptop Backpack Water Resistant', 5500, 100);

-- Insert sample orders (for testing)
INSERT INTO orders (customer_id, status, total_cents, created_at) VALUES
(1, 'CONFIRMED', 259800, NOW() - INTERVAL 5 DAY),
(2, 'CONFIRMED', 389700, NOW() - INTERVAL 3 DAY),
(3, 'CREATED', 129900, NOW() - INTERVAL 1 DAY);

-- Insert sample order items
INSERT INTO order_items (order_id, product_id, qty, unit_price_cents, subtotal_cents) VALUES
(1, 1, 2, 129900, 259800),
(2, 1, 3, 129900, 389700),
(3, 1, 1, 129900, 129900);
