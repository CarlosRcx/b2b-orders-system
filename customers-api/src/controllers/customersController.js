const Joi = require('joi');
const CustomerModel = require('../models/customerModel');

const createCustomerSchema = Joi.object({
  name: Joi.string().min(2).max(255).required(),
  email: Joi.string().email().required(),
  phone: Joi.string().max(50).allow('', null)
});

const updateCustomerSchema = Joi.object({
  name: Joi.string().min(2).max(255),
  email: Joi.string().email(),
  phone: Joi.string().max(50).allow('', null)
}).min(1);

class CustomersController {
  static async create(req, res) {
    try {
      const { error, value } = createCustomerSchema.validate(req.body);
      if (error) {
        return res.status(400).json({ 
          success: false, 
          error: error.details[0].message 
        });
      }

      const existing = await CustomerModel.findByEmail(value.email);
      if (existing) {
        return res.status(409).json({ 
          success: false, 
          error: 'Email already registered' 
        });
      }

      const customerId = await CustomerModel.create(value);
      const customer = await CustomerModel.findById(customerId);

      res.status(201).json({ 
        success: true, 
        data: customer 
      });
    } catch (err) {
      console.error('Create customer error:', err);
      res.status(500).json({ 
        success: false, 
        error: 'Internal server error' 
      });
    }
  }

  static async getById(req, res) {
    try {
      const { id } = req.params;
      const customer = await CustomerModel.findById(id);

      if (!customer) {
        return res.status(404).json({ 
          success: false, 
          error: 'Customer not found' 
        });
      }

      res.json({ 
        success: true, 
        data: customer 
      });
    } catch (err) {
      console.error('Get customer error:', err);
      res.status(500).json({ 
        success: false, 
        error: 'Internal server error' 
      });
    }
  }

  static async search(req, res) {
    try {
      const { search = '', cursor = '0', limit = '20' } = req.query;
      const result = await CustomerModel.search({ search, cursor, limit });

      res.json({ 
        success: true, 
        ...result 
      });
    } catch (err) {
      console.error('Search customers error:', err);
      res.status(500).json({ 
        success: false, 
        error: 'Internal server error' 
      });
    }
  }

  static async update(req, res) {
    try {
      const { id } = req.params;
      const { error, value } = updateCustomerSchema.validate(req.body);
      
      if (error) {
        return res.status(400).json({ 
          success: false, 
          error: error.details[0].message 
        });
      }

      if (value.email) {
        const existing = await CustomerModel.findByEmail(value.email);
        if (existing && existing.id !== parseInt(id)) {
          return res.status(409).json({ 
            success: false, 
            error: 'Email already registered' 
          });
        }
      }

      const updated = await CustomerModel.update(id, value);
      if (!updated) {
        return res.status(404).json({ 
          success: false, 
          error: 'Customer not found' 
        });
      }

      const customer = await CustomerModel.findById(id);
      res.json({ 
        success: true, 
        data: customer 
      });
    } catch (err) {
      console.error('Update customer error:', err);
      res.status(500).json({ 
        success: false, 
        error: 'Internal server error' 
      });
    }
  }

  static async delete(req, res) {
    try {
      const { id } = req.params;
      const deleted = await CustomerModel.softDelete(id);

      if (!deleted) {
        return res.status(404).json({ 
          success: false, 
          error: 'Customer not found' 
        });
      }

      res.json({ 
        success: true, 
        message: 'Customer deleted successfully' 
      });
    } catch (err) {
      console.error('Delete customer error:', err);
      res.status(500).json({ 
        success: false, 
        error: 'Internal server error' 
      });
    }
  }

  static async getByIdInternal(req, res) {
    try {
      const { id } = req.params;
      const customer = await CustomerModel.findById(id);

      if (!customer) {
        return res.status(404).json({ 
          success: false, 
          error: 'Customer not found' 
        });
      }

      res.json({ 
        success: true, 
        data: customer 
      });
    } catch (err) {
      console.error('Get customer internal error:', err);
      res.status(500).json({ 
        success: false, 
        error: 'Internal server error' 
      });
    }
  }
}

module.exports = CustomersController;
