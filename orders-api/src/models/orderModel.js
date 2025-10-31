const db = require('../db');
const axios = require('axios');

class OrderModel {
  // Validate customer
  static async validateCustomer(customerId) {
    try {
      const response = await axios.get(
        `${process.env.CUSTOMERS_API_BASE}/internal/customers/${customerId}`,
        {
          headers: {
            'Authorization': `Bearer ${process.env.SERVICE_TOKEN}`
          }
        }
      );
      return response.data.success ? response.data.data : null;
    } catch (err) {
      console.error('Customer validation error:', err.message);
      return null;
    }
  }

  // Get product by ID
  static async getProduct(productId) {
    const [rows] = await db.execute(
      'SELECT id, sku, name, price_cents, stock FROM products WHERE id = ?',
      [productId]
    );
    return rows[0] || null;
  }

  // Create product
  static async createProduct({ sku, name, price_cents, stock }) {
    const [result] = await db.execute(
      'INSERT INTO products (sku, name, price_cents, stock) VALUES (?, ?, ?, ?)',
      [sku, name, price_cents, stock]
    );
    return result.insertId;
  }

  // Update product
  static async updateProduct(id, { price_cents, stock }) {
    const updates = [];
    const params = [];

    if (price_cents !== undefined) {
      updates.push('price_cents = ?');
      params.push(price_cents);
    }
    if (stock !== undefined) {
      updates.push('stock = ?');
      params.push(stock);
    }

    if (updates.length === 0) return false;

    params.push(id);
    const [result] = await db.execute(
      `UPDATE products SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
    return result.affectedRows > 0;
  }

  // Search products
  static async searchProducts({ search = '', cursor = 0, limit = 20 }) {
    const offset = Math.max(0, parseInt(cursor, 10) || 0);
    const pageLimit = Math.min(Math.max(1, parseInt(limit, 10) || 20), 100);
    
    let query = 'SELECT id, sku, name, price_cents, stock, created_at FROM products WHERE 1=1';
    const params = [];

    if (search && search.trim() !== '') {
      query += ' AND (sku LIKE ? OR name LIKE ?)';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern);
    }

    query += ` ORDER BY id DESC LIMIT ${pageLimit} OFFSET ${offset}`;

    const [rows] = await db.execute(query, params);
    
    return {
      data: rows,
      cursor: offset + rows.length,
      hasMore: rows.length === pageLimit
    };
  }

  // Create order with transaction
  static async createOrder(customerId, items) {
    const connection = await db.getConnection();
    
    try {
      await connection.beginTransaction();

      // Calculate total and verify stock
      let totalCents = 0;
      const processedItems = [];

      for (const item of items) {
        const [productRows] = await connection.execute(
          'SELECT id, price_cents, stock FROM products WHERE id = ? FOR UPDATE',
          [item.product_id]
        );

        const product = productRows[0];
        if (!product) {
          throw new Error(`Product ${item.product_id} not found`);
        }

        if (product.stock < item.qty) {
          throw new Error(`Insufficient stock for product ${item.product_id}`);
        }

        const subtotal = product.price_cents * item.qty;
        totalCents += subtotal;

        processedItems.push({
          product_id: item.product_id,
          qty: item.qty,
          unit_price_cents: product.price_cents,
          subtotal_cents: subtotal
        });

        // Deduct stock
        await connection.execute(
          'UPDATE products SET stock = stock - ? WHERE id = ?',
          [item.qty, item.product_id]
        );
      }

      // Create order
      const [orderResult] = await connection.execute(
        'INSERT INTO orders (customer_id, status, total_cents) VALUES (?, ?, ?)',
        [customerId, 'CREATED', totalCents]
      );

      const orderId = orderResult.insertId;

      // Create order items
      for (const item of processedItems) {
        await connection.execute(
          'INSERT INTO order_items (order_id, product_id, qty, unit_price_cents, subtotal_cents) VALUES (?, ?, ?, ?, ?)',
          [orderId, item.product_id, item.qty, item.unit_price_cents, item.subtotal_cents]
        );
      }

      await connection.commit();
      return orderId;

    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }

  // Get order by ID with items
  static async getOrderById(orderId) {
    const [orderRows] = await db.execute(
      'SELECT id, customer_id, status, total_cents, created_at, updated_at, confirmed_at, canceled_at FROM orders WHERE id = ?',
      [orderId]
    );

    if (orderRows.length === 0) return null;

    const order = orderRows[0];

    const [itemRows] = await db.execute(
      'SELECT oi.id, oi.product_id, oi.qty, oi.unit_price_cents, oi.subtotal_cents, p.name as product_name, p.sku FROM order_items oi JOIN products p ON oi.product_id = p.id WHERE oi.order_id = ?',
      [orderId]
    );

    order.items = itemRows;
    return order;
  }

  // Search orders
static async searchOrders({ status, from, to, cursor = 0, limit = 20 }) {
    const offset = Math.max(0, parseInt(cursor, 10) || 0);
    const pageLimit = Math.min(Math.max(1, parseInt(limit, 10) || 20), 100);
    
    let query = 'SELECT id, customer_id, status, total_cents, created_at, confirmed_at, canceled_at FROM orders WHERE 1=1';
    const params = [];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    if (from) {
      query += ' AND created_at >= ?';
      params.push(from);
    }

    if (to) {
      query += ' AND created_at <= ?';
      params.push(to);
    }

    // LIMIT y OFFSET concatenados
    query += ` ORDER BY id DESC LIMIT ${pageLimit} OFFSET ${offset}`;

    const [rows] = await db.execute(query, params);
    
    return {
      data: rows,
      cursor: offset + rows.length,
      hasMore: rows.length === pageLimit
    };
  }

  // Confirm order with idempotency
  static async confirmOrder(orderId, idempotencyKey) {
    const connection = await db.getConnection();
    
    try {
      await connection.beginTransaction();

      // Check idempotency key
      if (idempotencyKey) {
        const [keyRows] = await connection.execute(
          'SELECT * FROM idempotency_keys WHERE `key` = ?',
          [idempotencyKey]
        );

        if (keyRows.length > 0) {
          // Return cached response
          const cachedKey = keyRows[0];
          await connection.rollback();
          return JSON.parse(cachedKey.response_body);
        }
      }

      // Get order
      const [orderRows] = await connection.execute(
        'SELECT id, customer_id, status, total_cents FROM orders WHERE id = ? FOR UPDATE',
        [orderId]
      );

      if (orderRows.length === 0) {
        throw new Error('Order not found');
      }

      const order = orderRows[0];

      if (order.status === 'CONFIRMED') {
        // Already confirmed, return current state
        const result = await this.getOrderById(orderId);
        await connection.commit();
        return result;
      }

      if (order.status === 'CANCELED') {
        throw new Error('Cannot confirm a canceled order');
      }

      // Confirm order
      await connection.execute(
        'UPDATE orders SET status = ?, confirmed_at = NOW() WHERE id = ?',
        ['CONFIRMED', orderId]
      );

      const result = await this.getOrderById(orderId);

      // Store idempotency key
      if (idempotencyKey) {
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24); // 24 hours expiration

        await connection.execute(
          'INSERT INTO idempotency_keys (`key`, target_type, target_id, status, response_body, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
          [idempotencyKey, 'order_confirmation', orderId, 'completed', JSON.stringify(result), expiresAt]
        );
      }

      await connection.commit();
      return result;

    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }

  // Cancel order
  static async cancelOrder(orderId) {
    const connection = await db.getConnection();
    
    try {
      await connection.beginTransaction();

      // Get order
      const [orderRows] = await connection.execute(
        'SELECT id, status, created_at, confirmed_at FROM orders WHERE id = ? FOR UPDATE',
        [orderId]
      );

      if (orderRows.length === 0) {
        throw new Error('Order not found');
      }

      const order = orderRows[0];

      if (order.status === 'CANCELED') {
        // Already canceled
        await connection.commit();
        return await this.getOrderById(orderId);
      }

      // Check if can cancel
      if (order.status === 'CONFIRMED') {
        const confirmedAt = new Date(order.confirmed_at);
        const now = new Date();
        const diffMinutes = (now - confirmedAt) / 1000 / 60;

        if (diffMinutes > 10) {
          throw new Error('Cannot cancel order confirmed more than 10 minutes ago');
        }
      }

      // Restore stock
      const [items] = await connection.execute(
        'SELECT product_id, qty FROM order_items WHERE order_id = ?',
        [orderId]
      );

      for (const item of items) {
        await connection.execute(
          'UPDATE products SET stock = stock + ? WHERE id = ?',
          [item.qty, item.product_id]
        );
      }

      // Cancel order
      await connection.execute(
        'UPDATE orders SET status = ?, canceled_at = NOW() WHERE id = ?',
        ['CANCELED', orderId]
      );

      await connection.commit();
      return await this.getOrderById(orderId);

    } catch (err) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  }
}

module.exports = OrderModel;
