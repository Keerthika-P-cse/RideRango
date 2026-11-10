import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import pool from '../config/db.js'
import { env } from '../config/env.js'

export const authService = {
  /**
   * Authenticate customer with email and password
   */
  async loginCustomer(email, password) {
    if (!email || !password) {
      throw new Error('Email and password are required.')
    }

    const cleanEmail = email.trim().toLowerCase()
    const [rows] = await pool.query(
      `SELECT id, first_name, last_name, email, phone, password_hash, address_line1, city, state, pincode, 
              driving_license_number, verification_status, is_active 
       FROM customers 
       WHERE email = ?`,
      [cleanEmail]
    )

    if (rows.length === 0) {
      throw new Error('Invalid email or password.')
    }

    const customer = rows[0]
    if (!customer.is_active) {
      throw new Error('Your account is currently deactivated. Please contact support.')
    }

    const isValidPassword = await bcrypt.compare(password, customer.password_hash)
    if (!isValidPassword) {
      throw new Error('Invalid email or password.')
    }

    const token = jwt.sign(
      {
        id: customer.id,
        email: customer.email,
        role: 'customer'
      },
      env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    const { password_hash: _, ...safeCustomer } = customer
    return { token, customer: safeCustomer }
  },

  /**
   * Register a new customer account
   */
  async registerCustomer(data) {
    const {
      first_name,
      last_name,
      email,
      phone,
      password,
      address_line1,
      city,
      state,
      pincode,
      driving_license_number
    } = data

    if (!first_name || !last_name || !email || !phone || !password) {
      throw new Error('First name, last name, email, phone number, and password are required.')
    }

    const cleanEmail = email.trim().toLowerCase()
    const cleanPhone = phone.trim()

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(cleanEmail)) {
      throw new Error('Please provide a valid email address.')
    }

    // Check duplicate email
    const [existingEmail] = await pool.query(
      'SELECT id FROM customers WHERE email = ?',
      [cleanEmail]
    )
    if (existingEmail.length > 0) {
      throw new Error('An account with this email address already exists.')
    }

    // Check duplicate phone
    const [existingPhone] = await pool.query(
      'SELECT id FROM customers WHERE phone = ?',
      [cleanPhone]
    )
    if (existingPhone.length > 0) {
      throw new Error('An account with this phone number already exists.')
    }

    const passwordHash = await bcrypt.hash(password, 10)

    const [result] = await pool.query(
      `INSERT INTO customers 
       (first_name, last_name, email, phone, password_hash, address_line1, city, state, pincode, driving_license_number, verification_status, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'verified', TRUE)`,
      [
        first_name.trim(),
        last_name.trim(),
        cleanEmail,
        cleanPhone,
        passwordHash,
        address_line1 || null,
        city || 'Bengaluru',
        state || 'Karnataka',
        pincode || null,
        driving_license_number ? driving_license_number.trim().toUpperCase() : null
      ]
    )

    const newCustomerId = result.insertId
    const token = jwt.sign(
      {
        id: newCustomerId,
        email: cleanEmail,
        role: 'customer'
      },
      env.JWT_SECRET,
      { expiresIn: '7d' }
    )

    return {
      token,
      customer: {
        id: newCustomerId,
        first_name: first_name.trim(),
        last_name: last_name.trim(),
        email: cleanEmail,
        phone: cleanPhone,
        address_line1: address_line1 || null,
        city: city || 'Bengaluru',
        state: state || 'Karnataka',
        pincode: pincode || null,
        driving_license_number: driving_license_number ? driving_license_number.trim().toUpperCase() : null,
        verification_status: 'verified',
        is_active: true
      }
    }
  },

  /**
   * Get authenticated customer profile
   */
  async getCustomerProfile(id) {
    const [rows] = await pool.query(
      `SELECT id, first_name, last_name, email, phone, address_line1, address_line2, city, state, pincode, 
              driving_license_number, verification_status, created_at 
       FROM customers 
       WHERE id = ?`,
      [id]
    )

    if (rows.length === 0) {
      throw new Error('Customer not found.')
    }

    return rows[0]
  }
}

export default authService
