const express = require('express');
const OrdersController = require('../controllers/ordersController');

const router = express.Router();

// Product routes
router.post('/products', OrdersController.createProduct);
router.get('/products/:id', OrdersController.getProduct);
router.patch('/products/:id', OrdersController.updateProduct);
router.get('/products', OrdersController.searchProducts);

// Order routes
router.post('/orders', OrdersController.createOrder);
router.get('/orders/:id', OrdersController.getOrder);
router.get('/orders', OrdersController.searchOrders);
router.post('/orders/:id/confirm', OrdersController.confirmOrder);
router.post('/orders/:id/cancel', OrdersController.cancelOrder);

module.exports = router;
