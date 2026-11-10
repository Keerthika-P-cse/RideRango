-- =============================================================================
-- RideRango – Vehicle Rental Management System
-- Database Schema: Approved Production Specification
-- Recommended Database Engine: MySQL 8.0+ / 8.4 LTS
-- Storage Engine: InnoDB | Character Set: utf8mb4 | Collation: utf8mb4_unicode_ci
-- Currency: Indian Rupee (INR) represented as DECIMAL(10, 2)
-- =============================================================================

CREATE DATABASE IF NOT EXISTS riderango_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE riderango_db;

-- -----------------------------------------------------------------------------
-- 1. CUSTOMERS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(50) NOT NULL,
  last_name VARCHAR(50) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  phone VARCHAR(20) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  address_line1 VARCHAR(150) DEFAULT NULL,
  address_line2 VARCHAR(150) DEFAULT NULL,
  city VARCHAR(50) DEFAULT NULL,
  state VARCHAR(50) DEFAULT NULL,
  pincode VARCHAR(10) DEFAULT NULL,
  driving_license_number VARCHAR(50) DEFAULT NULL UNIQUE,
  verification_status ENUM('pending', 'verified', 'rejected', 'suspended') NOT NULL DEFAULT 'pending',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_customers_email (email),
  INDEX idx_customers_phone (phone),
  INDEX idx_customers_status (verification_status)
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 2. STAFF
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS staff (
  id INT AUTO_INCREMENT PRIMARY KEY,
  first_name VARCHAR(50) NOT NULL,
  last_name VARCHAR(50) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  phone VARCHAR(20) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin', 'manager', 'fleet_staff', 'support') NOT NULL DEFAULT 'fleet_staff',
  approval_status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'approved',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_staff_email (email),
  INDEX idx_staff_role (role)
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 3. VEHICLE CATEGORIES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vehicle_categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  slug VARCHAR(50) NOT NULL UNIQUE,
  description TEXT DEFAULT NULL,
  base_deposit_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_categories_slug (slug)
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 4. VEHICLES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vehicles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  category_id INT NOT NULL,
  registration_number VARCHAR(30) NOT NULL UNIQUE,
  make VARCHAR(50) NOT NULL,
  model VARCHAR(50) NOT NULL,
  year INT NOT NULL,
  color VARCHAR(30) DEFAULT NULL,
  fuel_type ENUM('petrol', 'diesel', 'electric', 'cng', 'hybrid') NOT NULL,
  transmission ENUM('manual', 'automatic') NOT NULL,
  seating_capacity INT NOT NULL DEFAULT 2,
  daily_rate DECIMAL(10, 2) NOT NULL,
  hourly_rate DECIMAL(10, 2) DEFAULT NULL,
  security_deposit DECIMAL(10, 2) NOT NULL DEFAULT 2000.00,
  current_odometer_km INT NOT NULL DEFAULT 0,
  availability_status ENUM('available', 'booked', 'rented', 'maintenance', 'decommissioned') NOT NULL DEFAULT 'available',
  location VARCHAR(100) NOT NULL DEFAULT 'Main Hub',
  features_json JSON DEFAULT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_vehicles_category FOREIGN KEY (category_id) REFERENCES vehicle_categories(id) ON DELETE RESTRICT,
  INDEX idx_vehicles_category (category_id),
  INDEX idx_vehicles_status (availability_status),
  INDEX idx_vehicles_rates (daily_rate),
  INDEX idx_vehicles_registration (registration_number)
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 5. CUSTOMER DOCUMENTS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS customer_documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  customer_id INT NOT NULL,
  document_type ENUM('driving_license', 'aadhaar', 'passport', 'voter_id', 'utility_bill') NOT NULL,
  document_number VARCHAR(50) DEFAULT NULL,
  file_url VARCHAR(255) NOT NULL,
  verification_status ENUM('pending', 'verified', 'rejected') NOT NULL DEFAULT 'pending',
  verified_by_staff_id INT DEFAULT NULL,
  verified_at DATETIME DEFAULT NULL,
  rejection_reason VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_docs_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  CONSTRAINT fk_docs_staff FOREIGN KEY (verified_by_staff_id) REFERENCES staff(id) ON DELETE SET NULL,
  INDEX idx_docs_customer (customer_id),
  INDEX idx_docs_status (verification_status)
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 6. BOOKINGS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bookings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_reference VARCHAR(30) NOT NULL UNIQUE,
  customer_id INT NOT NULL,
  vehicle_id INT NOT NULL,
  start_date DATETIME NOT NULL,
  end_date DATETIME NOT NULL,
  pickup_location VARCHAR(100) NOT NULL DEFAULT 'Main Hub',
  dropoff_location VARCHAR(100) NOT NULL DEFAULT 'Main Hub',
  total_days DECIMAL(5, 2) NOT NULL DEFAULT 1.00,
  rental_rate_per_day DECIMAL(10, 2) NOT NULL,
  base_rental_amount DECIMAL(10, 2) NOT NULL,
  security_deposit_amount DECIMAL(10, 2) NOT NULL,
  total_amount DECIMAL(10, 2) NOT NULL,
  booking_status ENUM('pending', 'confirmed', 'active', 'completed', 'cancelled', 'rejected') NOT NULL DEFAULT 'pending',
  cancellation_reason VARCHAR(255) DEFAULT NULL,
  approved_by_staff_id INT DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_bookings_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
  CONSTRAINT fk_bookings_vehicle FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE RESTRICT,
  CONSTRAINT fk_bookings_staff FOREIGN KEY (approved_by_staff_id) REFERENCES staff(id) ON DELETE SET NULL,
  INDEX idx_bookings_customer (customer_id),
  INDEX idx_bookings_vehicle (vehicle_id),
  INDEX idx_bookings_status (booking_status),
  INDEX idx_bookings_dates (start_date, end_date)
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 7. RENTAL HANDOVER
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rental_handover (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_id INT NOT NULL UNIQUE,
  staff_id INT NOT NULL,
  handover_datetime DATETIME NOT NULL,
  odometer_reading INT NOT NULL,
  fuel_level_percent INT NOT NULL CHECK (fuel_level_percent BETWEEN 0 AND 100),
  initial_damages_notes TEXT DEFAULT NULL,
  customer_signature_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  handover_notes TEXT DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_handover_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE RESTRICT,
  CONSTRAINT fk_handover_staff FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE RESTRICT,
  INDEX idx_handover_booking (booking_id),
  INDEX idx_handover_staff (staff_id)
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 8. RENTAL RETURNS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rental_returns (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_id INT NOT NULL UNIQUE,
  staff_id INT NOT NULL,
  return_datetime DATETIME NOT NULL,
  odometer_reading INT NOT NULL,
  fuel_level_percent INT NOT NULL CHECK (fuel_level_percent BETWEEN 0 AND 100),
  return_condition_notes TEXT DEFAULT NULL,
  damages_identified BOOLEAN NOT NULL DEFAULT FALSE,
  late_return_hours INT NOT NULL DEFAULT 0,
  inspection_status ENUM('passed', 'flagged_for_charges', 'escalated') NOT NULL DEFAULT 'passed',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_returns_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE RESTRICT,
  CONSTRAINT fk_returns_staff FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE RESTRICT,
  INDEX idx_returns_booking (booking_id),
  INDEX idx_returns_staff (staff_id),
  INDEX idx_returns_inspection (inspection_status)
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 9. PAYMENTS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  transaction_reference VARCHAR(50) NOT NULL UNIQUE,
  booking_id INT NOT NULL,
  customer_id INT NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  payment_type ENUM('booking_deposit', 'rental_fee', 'security_deposit', 'damage_penalty', 'late_fee', 'toll_challan', 'refund') NOT NULL,
  payment_method ENUM('upi', 'net_banking', 'credit_card', 'debit_card', 'cash') NOT NULL,
  payment_status ENUM('initiated', 'success', 'failed', 'refunded') NOT NULL DEFAULT 'initiated',
  gateway_transaction_id VARCHAR(100) DEFAULT NULL,
  payment_notes VARCHAR(255) DEFAULT NULL,
  paid_at DATETIME DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_payments_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE RESTRICT,
  CONSTRAINT fk_payments_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE RESTRICT,
  INDEX idx_payments_booking (booking_id),
  INDEX idx_payments_customer (customer_id),
  INDEX idx_payments_status (payment_status),
  INDEX idx_payments_type (payment_type)
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 10. ADDITIONAL CHARGES
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS additional_charges (
  id INT AUTO_INCREMENT PRIMARY KEY,
  booking_id INT NOT NULL,
  charge_type ENUM('late_return', 'damage', 'fuel_refill', 'cleaning_fee', 'traffic_challan', 'toll_tollway', 'extra_km') NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  description VARCHAR(255) NOT NULL,
  assessed_by_staff_id INT NOT NULL,
  payment_status ENUM('pending', 'paid', 'deducted_from_deposit', 'waived') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_charges_booking FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE RESTRICT,
  CONSTRAINT fk_charges_staff FOREIGN KEY (assessed_by_staff_id) REFERENCES staff(id) ON DELETE RESTRICT,
  INDEX idx_charges_booking (booking_id),
  INDEX idx_charges_status (payment_status)
) ENGINE=InnoDB;

-- -----------------------------------------------------------------------------
-- 11. AUDIT LOGS
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  entity_type VARCHAR(50) NOT NULL,
  entity_id INT NOT NULL,
  action VARCHAR(50) NOT NULL,
  actor_type ENUM('customer', 'staff', 'system') NOT NULL,
  actor_id INT DEFAULT NULL,
  ip_address VARCHAR(45) DEFAULT NULL,
  details_json JSON DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_entity (entity_type, entity_id),
  INDEX idx_audit_action (action),
  INDEX idx_audit_actor (actor_type, actor_id),
  INDEX idx_audit_created (created_at)
) ENGINE=InnoDB;
