const Joi = require('joi');
const OrderModel = require('../models/orderModel');

const createProductSchema = Joi.object({
  sku: Joi.string().max(100).required(),
  name: Joi.string().min(2).max(255).required(),
  price_cents: Joi.number().integer().min(0).required(),
  stock: Joi.number().integer().min(0).required()
});

const updateProductSchema = Joi.object({
  price_cents: Joi.number().integer().min(0),
  stock: Joi.number().integer().min(0)
}).min(1);

const createOrderSchema = Joi.object({
  customer_id: Joi.number().integer().positive().required(),
  items: Joi.array().items(
    Joi.object({
      product_id: Joi.number().integer().positive().required(),
      qty: Joi.number().integer().positive().required()
    })
  ).min(1).required()
});

class OrdersController {
  static async createProduct(req, res) {
    try {
      const { error, value } = createProductSchema.validate(req.body);
      if (error) {
        return res.status(400).json({ 
          success: false, 
          error: error.details[0].message 
        });
      }

      const productId = await OrderModel.createProduct(value);
      const product = await OrderModel.getProduct(productId);

      res.status(201).json({ 
        success: true, 
        data: product 
      });
    } catch (err) {
      console.error('Create product error:', err);
      res.status(500).json({ 
        success: false, 
        error: 'Internal server error' 
      });
    }
  }

  static async getProduct(req, res) {
    try {
      const { id } = req.params;
      const product = await OrderModel.getProduct(id);

      if (!product) {
        return res.status(404).json({ 
          success: false, 
          error: 'Product not found' 
        });
      }

      res.json({ 
        success: true, 
        data: product 
      });
    } catch (err) {
      console.error('Get product error:', err);
      res.status(500).json({ 
        success: false, 
        error: 'Internal server error' 
      });
    }
  }

  static async updateProduct(req, res) {
    try {
      const { id } = req.params;
      const { error, value } = updateProductSchema.validate(req.body);
      
      if (error) {
        return res.status(400).json({ 
          success: false, 
          error: error.details[0].message 
        });
      }

      const updated = await OrderModel.updateProduct(id, value);
      if (!updated) {
        return res.status(404).json({ 
          success: false, 
          error: 'Product not found' 
        });
      }

      const product = await OrderModel.getProduct(id);
      res.json({ 
        success: true, 
        data: product 
      });
    } catch (err) {
      console.error('Update product error:', err);
      res.status(500).json({ 
        success: false, 
        error: 'Internal server error' 
      });
    }
  }

  static async searchProducts(req, res) {
    try {
      const { search = '', cursor = '0', limit = '20' } = req.query;
      const result = await OrderModel.searchProducts({ search, cursor, limit });

      res.json({ 
        success: true, 
        ...result 
      });
    } catch (err) {
      console.error('Search products error:', err);
      res.status(500).json({ 
        success: false, 
        error: 'Internal server error' 
      });
    }
  }

  static async createOrder(req, res) {
    try {
      const { error, value } = createOrderSchema.validate(req.body);
      if (error) {
        return res.status(400).json({ 
          success: false, 
          error: error.details[0].message 
        });
      }

      const customer = await OrderModel.validateCustomer(value.customer_id);
      if (!customer) {
        return res.status(404).json({ 
          success: false, 
          error: 'Customer not found' 
        });
      }

      const orderId = await OrderModel.createOrder(value.customer_id, value.items);
      const order = await OrderModel.getOrderById(orderId);

      res.status(201).json({ 
        success: true, 
        data: order 
      });
    } catch (err) {
      console.error('Create order error:', err);
      
      if (err.message.includes('not found') || err.message.includes('Insufficient stock')) {
        return res.status(400).json({ 
          success: false, 
          error: err.message 
        });
      }

      res.status(500).json({ 
        success: false, 
        error: 'Internal server error' 
      });
    }
  }

  static async getOrder(req, res) {
    try {
      const { id } = req.params;
      const order = await OrderModel.getOrderById(id);

      if (!order) {
        return res.status(404).json({ 
          success: false, 
          error: 'Order not found' 
        });
      }

      res.json({ 
        success: true, 
        data: order 
      });
    } catch (err) {
      console.error('Get order error:', err);
      res.status(500).json({ 
        success: false, 
        error: 'Internal server error' 
      });
    }
  }

  static async searchOrders(req, res) {
    try {
      const { status, from, to, cursor = '0', limit = '20' } = req.query;
      const result = await OrderModel.searchOrders({ status, from, to, cursor, limit });

      res.json({ 
        success: true, 
        ...result 
      });
    } catch (err) {
      console.error('Search orders error:', err);
      res.status(500).json({ 
        success: false, 
        error: 'Internal server error' 
      });
    }
  }

  static async confirmOrder(req, res) {
    try {
      const { id } = req.params;
      const idempotencyKey = req.headers['x-idempotency-key'];

      const order = await OrderModel.confirmOrder(id, idempotencyKey);

      res.json({ 
        success: true, 
        data: order 
      });
    } catch (err) {
      console.error('Confirm order error:', err);
      
      if (err.message.includes('not found') || err.message.includes('Cannot confirm')) {
        return res.status(400).json({ 
          success: false, 
          error: err.message 
        });
      }

      res.status(500).json({ 
        success: false, 
        error: 'Internal server error' 
      });
    }
  }

  static async cancelOrder(req, res) {
    try {
      const { id } = req.params;
      const order = await OrderModel.cancelOrder(id);

      res.json({ 
        success: true, 
        data: order 
      });
    } catch (err) {
      console.error('Cancel order error:', err);
      
      if (err.message.includes('not found') || err.message.includes('Cannot cancel')) {
        return res.status(400).json({ 
          success: false, 
          error: err.message 
        });
      }

      res.status(500).json({ 
        success: false, 
        error: 'Internal server error' 
      });
    }
  }
}

module.exports = OrdersController;
