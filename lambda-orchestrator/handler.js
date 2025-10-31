const axios = require('axios');
const Joi = require('joi');

const requestSchema = Joi.object({
  customer_id: Joi.number().integer().positive().required(),
  items: Joi.array().items(
    Joi.object({
      product_id: Joi.number().integer().positive().required(),
      qty: Joi.number().integer().positive().required()
    })
  ).min(1).required(),
  idempotency_key: Joi.string().required(),
  correlation_id: Joi.string().optional()
});

const CUSTOMERS_API_BASE = process.env.CUSTOMERS_API_BASE || 'http://localhost:3001';
const ORDERS_API_BASE = process.env.ORDERS_API_BASE || 'http://localhost:3002';
const SERVICE_TOKEN = process.env.SERVICE_TOKEN || 'internal-service-token-2025';

async function createAndConfirmOrder(event) {
  console.log('🚀 Lambda orchestrator invoked');
  console.log('Event:', JSON.stringify(event, null, 2));

  try {
    const body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    
    const { error, value } = requestSchema.validate(body);
    if (error) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: error.details[0].message
        })
      };
    }

    const { customer_id, items, idempotency_key, correlation_id } = value;

    console.log(`Processing order for customer ${customer_id} with correlation ID: ${correlation_id || 'N/A'}`);

    console.log('Step 1: Validating customer...');
    let customer;
    try {
      const customerResponse = await axios.get(
        `${CUSTOMERS_API_BASE}/internal/customers/${customer_id}`,
        {
          headers: {
            'Authorization': `Bearer ${SERVICE_TOKEN}`
          }
        }
      );
      
      if (!customerResponse.data.success) {
        return {
          statusCode: 404,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            error: 'Customer not found',
            correlationId: correlation_id
          })
        };
      }
      
      customer = customerResponse.data.data;
      console.log(`✅ Customer validated: ${customer.name}`);
    } catch (err) {
      console.error('Customer validation failed:', err.message);
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: 'Customer not found or service unavailable',
          correlationId: correlation_id
        })
      };
    }

    console.log('Step 2: Creating order...');
    let order;
    try {
      const orderResponse = await axios.post(
        `${ORDERS_API_BASE}/orders`,
        {
          customer_id,
          items
        }
      );
      
      if (!orderResponse.data.success) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            error: orderResponse.data.error || 'Failed to create order',
            correlationId: correlation_id
          })
        };
      }
      
      order = orderResponse.data.data;
      console.log(`✅ Order created: ID ${order.id}`);
    } catch (err) {
      console.error('Order creation failed:', err.response?.data || err.message);
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: err.response?.data?.error || 'Failed to create order',
          correlationId: correlation_id
        })
      };
    }

    console.log('Step 3: Confirming order...');
    try {
      const confirmResponse = await axios.post(
        `${ORDERS_API_BASE}/orders/${order.id}/confirm`,
        {},
        {
          headers: {
            'X-Idempotency-Key': idempotency_key
          }
        }
      );
      
      if (!confirmResponse.data.success) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            success: false,
            error: confirmResponse.data.error || 'Failed to confirm order',
            correlationId: correlation_id
          })
        };
      }
      
      order = confirmResponse.data.data;
      console.log(`✅ Order confirmed: ID ${order.id}`);
    } catch (err) {
      console.error('Order confirmation failed:', err.response?.data || err.message);
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          success: false,
          error: err.response?.data?.error || 'Failed to confirm order',
          correlationId: correlation_id
        })
      };
    }

    const response = {
      success: true,
      correlationId: correlation_id || null,
      data: {
        customer: {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone
        },
        order: {
          id: order.id,
          status: order.status,
          total_cents: order.total_cents,
          items: order.items.map(item => ({
            product_id: item.product_id,
            product_name: item.product_name,
            sku: item.sku,
            qty: item.qty,
            unit_price_cents: item.unit_price_cents,
            subtotal_cents: item.subtotal_cents
          }))
        }
      }
    };

    console.log('✅ Orchestration completed successfully');

    return {
      statusCode: 201,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(response)
    };

  } catch (err) {
    console.error('❌ Orchestration error:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: 'Internal server error'
      })
    };
  }
}

module.exports = {
  createAndConfirmOrder
};
