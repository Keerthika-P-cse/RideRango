-- =============================================================================
-- RideRango – Vehicle Rental Management System
-- Database Seed Data
-- =============================================================================

USE riderango_db;

-- -----------------------------------------------------------------------------
-- 1. VEHICLE CATEGORIES (Mandatory 4 categories)
-- -----------------------------------------------------------------------------
INSERT INTO vehicle_categories (id, name, slug, description, base_deposit_amount, is_active) VALUES
(1, 'Cars', 'cars', 'Hatchbacks, sedans, SUVs, and luxury electric vehicles for urban and highway travel.', 3000.00, TRUE),
(2, 'Bikes', 'bikes', 'Commuter and premium sports motorcycles built for performance and exploration.', 1500.00, TRUE),
(3, 'Scooters', 'scooters', 'Lightweight, agile scooters and electric mopeds tailored for swift city commuting.', 1000.00, TRUE),
(4, 'Commercial', 'commercial', 'Cargo vans, mini-trucks, and transport vehicles for business logistics and shifting.', 5000.00, TRUE)
ON DUPLICATE KEY UPDATE name=VALUES(name), description=VALUES(description), base_deposit_amount=VALUES(base_deposit_amount);

-- -----------------------------------------------------------------------------
-- 2. INITIAL STAFF ROLES (Admin & Fleet Staff)
-- Note: Passwords represent pre-hashed demonstration credentials ('Admin@123')
-- -----------------------------------------------------------------------------
INSERT INTO staff (id, first_name, last_name, email, phone, password_hash, role, approval_status, is_active) VALUES
(1, 'System', 'Admin', 'admin@riderango.com', '+919876543210', '$2b$10$69wfXHMx2BlwawYvoxmFnuiPJm1L2R1jvhJwvoYhHtKqWMnzYZdY2', 'admin', 'approved', TRUE),
(2, 'Rajesh', 'Kumar', 'rajesh.fleet@riderango.com', '+919876543211', '$2b$10$69wfXHMx2BlwawYvoxmFnuiPJm1L2R1jvhJwvoYhHtKqWMnzYZdY2', 'fleet_staff', 'approved', TRUE)
ON DUPLICATE KEY UPDATE first_name=VALUES(first_name), role=VALUES(role), approval_status=VALUES(approval_status), password_hash=VALUES(password_hash);

-- -----------------------------------------------------------------------------
-- 3. INITIAL VEHICLES (Cars, Bikes, Scooters, Commercial)
-- -----------------------------------------------------------------------------
INSERT INTO vehicles (id, category_id, registration_number, make, model, year, color, fuel_type, transmission, seating_capacity, daily_rate, hourly_rate, security_deposit, current_odometer_km, availability_status, location, features_json, is_active) VALUES
-- Cars
(1, 1, 'KA-01-MJ-1001', 'Tata', 'Nexon EV Empowered', 2024, 'Intense Teal', 'electric', 'automatic', 5, 2499.00, 220.00, 3000.00, 12500, 'available', 'Main Hub - Indiranagar', '{"range_km": 465, "battery_kwh": 40.5, "fast_charging": true, "gps": true, "airbags": 6}', TRUE),
(2, 1, 'KA-03-NB-4422', 'Hyundai', 'Creta SX(O)', 2024, 'Abyss Black', 'petrol', 'automatic', 5, 2899.00, 260.00, 3500.00, 18400, 'available', 'Airport Hub - Devanahalli', '{"panoramic_sunroof": true, "cruise_control": true, "ventilated_seats": true, "gps": true}', TRUE),

-- Bikes
(3, 2, 'KA-05-EX-7890', 'Yamaha', 'YZF R15 V4', 2023, 'Racing Blue', 'petrol', 'manual', 2, 1199.00, 110.00, 2000.00, 8900, 'available', 'Main Hub - Indiranagar', '{"abs": "dual-channel", "traction_control": true, "quick_shifter": true}', TRUE),
(4, 2, 'KA-04-TR-3311', 'Royal Enfield', 'Hunter 350', 2023, 'Dapper Ash', 'petrol', 'manual', 2, 999.00, 95.00, 1500.00, 14200, 'available', 'Koramangala Hub', '{"engine_cc": 349, "abs": "dual-channel", "usb_charging": true}', TRUE),

-- Scooters
(5, 3, 'KA-01-EV-2045', 'Ather', '450X Gen 3', 2024, 'Space Grey', 'electric', 'automatic', 2, 699.00, 70.00, 1000.00, 6200, 'available', 'Main Hub - Indiranagar', '{"range_km": 150, "touchscreen_dashboard": true, "google_maps": true}', TRUE),
(6, 3, 'KA-02-AC-9081', 'Honda', 'Activa 6G', 2023, 'Pearl Precious White', 'petrol', 'automatic', 2, 499.00, 50.00, 1000.00, 16700, 'available', 'Whitefield Hub', '{"combi_brake": true, "engine_start_stop": true}', TRUE),

-- Commercial
(7, 4, 'KA-03-CV-5501', 'Tata', 'Ace EV', 2024, 'Polar White', 'electric', 'automatic', 2, 1899.00, 180.00, 5000.00, 9800, 'available', 'Peenya Industrial Hub', '{"payload_kg": 600, "cargo_volume_cu_ft": 208, "telematics": true}', TRUE),
(8, 4, 'KA-51-LD-6712', 'Mahindra', 'Bolero Maxi Truck Plus', 2023, 'Diamond White', 'diesel', 'manual', 2, 1799.00, 170.00, 5000.00, 28000, 'available', 'Electronic City Hub', '{"payload_kg": 1200, "power_steering": true}', TRUE)
ON DUPLICATE KEY UPDATE make=VALUES(make), model=VALUES(model), daily_rate=VALUES(daily_rate);

-- -----------------------------------------------------------------------------
-- 4. SAMPLE CUSTOMER (Demonstration baseline)
-- Note: Password represents pre-hashed demonstration credentials ('Password@123')
-- -----------------------------------------------------------------------------
INSERT INTO customers (id, first_name, last_name, email, phone, password_hash, address_line1, city, state, pincode, driving_license_number, verification_status, is_active) VALUES
(1, 'Arjun', 'Sharma', 'arjun.sharma@example.com', '+919988776655', '$2b$10$KoMMiZUQGsCgKjBWbhFV4Ojb6wmSLOwyTBhXHaiQKfttyisV1XLGi', '42, 4th Cross, 100ft Road', 'Bengaluru', 'Karnataka', '560038', 'KA0120220014589', 'verified', TRUE)
ON DUPLICATE KEY UPDATE first_name=VALUES(first_name), verification_status=VALUES(verification_status), password_hash=VALUES(password_hash);
