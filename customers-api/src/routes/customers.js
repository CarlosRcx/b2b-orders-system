const express = require('express');
const CustomersController = require('../controllers/customersController');

const router = express.Router();

const validateServiceToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const expectedToken = `Bearer ${process.env.SERVICE_TOKEN}`;

  if (!authHeader || authHeader !== expectedToken) {
    return res.status(401).json({ 
      success: false, 
      error: 'Unauthorized' 
    });
  }

  next();
};

router.post('/', CustomersController.create);
router.get('/:id', CustomersController.getById);
router.get('/', CustomersController.search);
router.put('/:id', CustomersController.update);
router.delete('/:id', CustomersController.delete);

router.get('/internal/customers/:id', validateServiceToken, CustomersController.getByIdInternal);

module.exports = router;
