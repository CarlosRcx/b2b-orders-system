const db = require('../db');

class CustomerModel {
  static async create({ name, email, phone }) {
    const [result] = await db.execute(
      'INSERT INTO customers (name, email, phone) VALUES (?, ?, ?)',
      [name, email, phone || null]
    );
    return result.insertId;
  }

  static async findById(id) {
    const [rows] = await db.execute(
      'SELECT id, name, email, phone, created_at, updated_at FROM customers WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    return rows[0] || null;
  }

  static async findByEmail(email) {
    const [rows] = await db.execute(
      'SELECT id, name, email, phone, created_at, updated_at FROM customers WHERE email = ? AND deleted_at IS NULL',
      [email]
    );
    return rows[0] || null;
  }

  static async search({ search = '', cursor = 0, limit = 20 }) {
    try {
      const offset = Math.max(0, parseInt(cursor, 10) || 0);
      const pageLimit = Math.min(Math.max(1, parseInt(limit, 10) || 20), 100);
      
      let query = 'SELECT id, name, email, phone, created_at FROM customers WHERE deleted_at IS NULL';
      const params = [];

      if (search && search.trim() !== '') {
        query += ' AND (name LIKE ? OR email LIKE ? OR phone LIKE ?)';
        const searchPattern = `%${search}%`;
        params.push(searchPattern, searchPattern, searchPattern);
      }

      query += ` ORDER BY id DESC LIMIT ${pageLimit} OFFSET ${offset}`;

      console.log('SQL Query:', query);
      console.log('SQL Params:', params);

      const [rows] = await db.execute(query, params);
      
      return {
        data: rows,
        cursor: offset + rows.length,
        hasMore: rows.length === pageLimit
      };
    } catch (error) {
      console.error('Search error in model:', error);
      throw error;
    }
  }

  static async update(id, { name, email, phone }) {
    const updates = [];
    const params = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    if (email !== undefined) {
      updates.push('email = ?');
      params.push(email);
    }
    if (phone !== undefined) {
      updates.push('phone = ?');
      params.push(phone);
    }

    if (updates.length === 0) return false;

    params.push(id);
    const [result] = await db.execute(
      `UPDATE customers SET ${updates.join(', ')} WHERE id = ? AND deleted_at IS NULL`,
      params
    );

    return result.affectedRows > 0;
  }

  static async softDelete(id) {
    const [result] = await db.execute(
      'UPDATE customers SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL',
      [id]
    );
    return result.affectedRows > 0;
  }
}

module.exports = CustomerModel;
