# B2B Orders System

Sistema de gestión de pedidos B2B compuesto por dos APIs (Customers y Orders) y un Lambda orquestador, todo corriendo sobre Node.js 22, MySQL 8.0 y Docker.


## 🏗️ Arquitectura
Customers API (port 3001)
Orders API (port 3002)
Lambda Orchestrator
MySQL (port 3306)

## 📦 Requisitos

- **Docker** >= 20.10
- **Docker Compose** >= 2.0
- **Node.js** >= 22.x
- **npm** >= 10.x
- **Serverless Framework** >= 3.x (para el Lambda)

## 🚀 Instalación
### 1. Clonar el repositorio
git clone https://github.com/CarlosRcx/b2b-orders-system.git
cd b2b-orders-system


### 2. Configurar variables de entorno
Customers API
cp customers-api/.env.example customers-api/.env

Orders API
cp orders-api/.env.example orders-api/.env

Lambda Orchestrator
cp lambda-orchestrator/.env.example lambda-orchestrator/.env


### 3. Levantar servicios con Docker Compose
docker-compose build
docker-compose up -d


Esto iniciará:
- **MySQL** en puerto 3306
- **Customers API** en puerto 3001
- **Orders API** en puerto 3002

### 4. Verificar servicios
Customers API
curl http://localhost:3001/health

Orders API
curl http://localhost:3002/health

## ⚙️ Configuración

### Variables de entorno

#### Customers API (.env)
NODE_ENV=development
PORT=3001
DB_HOST=mysql
DB_PORT=3306
DB_USER=root
DB_PASSWORD=rootpassword
DB_NAME=b2b_orders
JWT_SECRET=jwt-secret-key
SERVICE_TOKEN=internal-service-token-2025

#### Orders API (.env)
NODE_ENV=development
PORT=3002
DB_HOST=mysql
DB_PORT=3306
DB_USER=root
DB_PASSWORD=rootpassword
DB_NAME=b2b_orders
JWT_SECRET=jwt-secret-key
SERVICE_TOKEN=internal-service-token-2025
CUSTOMERS_API_BASE=http://customers-api:3001

#### Lambda Orchestrator (.env)
CUSTOMERS_API_BASE=http://localhost:3001
ORDERS_API_BASE=http://localhost:3002
SERVICE_TOKEN=internal-service-token-2025

## 📖 Uso
### Customers API
#### Crear cliente
curl -X POST http://localhost:3001/customers \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ACME Corporation",
    "email": "ops@acme.com",
    "phone": "+1-555-0101"
  }'


#### Obtener cliente
curl http://localhost:3001/customers/1

#### Buscar clientes
curl "http://localhost:3001/customers?search=ACME&limit=10"


#### Actualizar cliente
curl -X PUT http://localhost:3001/customers/1 \
  -H "Content-Type: application/json" \
  -d '{"phone": "+1-555-9999"}'


#### Eliminar cliente (soft delete)
curl -X DELETE http://localhost:3001/customers/1


### Orders API
#### Crear producto
curl -X POST http://localhost:3002/products \
  -H "Content-Type: application/json" \
  -d '{
    "sku": "SKU-TEST-001",
    "name": "Test Product",
    "price_cents": 10000,
    "stock": 100
  }'


#### Actualizar producto
curl -X PATCH http://localhost:3002/products/1 \
  -H "Content-Type: application/json" \
  -d '{"price_cents":12000,"stock":150}'


#### Crear orden
curl -X POST http://localhost:3002/orders \
  -H "Content-Type: application/json" \
  -d '{"customer_id":2,"items":[{"product_id":1,"qty":3}]}'


#### Confirmar orden (idempotente)
curl -X POST http://localhost:3002/orders/1/confirm
-H "X-Idempotency-Key: unique-key-123"

#### Cancelar orden
curl -X POST http://localhost:3002/orders/1/cancel


#### Buscar órdenes
curl "http://localhost:3002/orders?status=CONFIRMED&limit=20"


## 🔄 Lambda Orchestrator
### Instalación local
cd lambda-orchestrator
npm install


### Ejecutar localmente con serverless-offline
npm run dev

El Lambda estará disponible en `http://localhost:3000`

### Invocar el Lambda
curl -X POST http://localhost:3000/orchestrator/create-and-confirm-order \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": 2,
    "items": [{"product_id": 1, "qty": 2}],
    "idempotency_key": "test-key-'$(date +%s)'",
    "correlation_id": "corr-'$(date +%s)'"
  }' | jq


### Respuesta esperada
{
  "success": true,
  "correlationId": "corr-1761880115",
  "data": {
    "customer": {
      "id": 2,
      "name": "Global Tech Solutions",
      "email": "contact@globaltech.com",
      "phone": "+1-555-0102"
    },
    "order": {
      "id": 5,
      "status": "CREATED",
      "total_cents": 24000,
      "items": [
        {
          "product_id": 1,
          "product_name": "Business Laptop Pro 15\"",
          "sku": "SKU-LAPTOP-001",
          "qty": 2,
          "unit_price_cents": 12000,
          "subtotal_cents": 24000
        }
      ]
    }
  }
}


## ☁️ Despliegue en AWS
### Prerequisitos
1. Configurar credenciales AWS:
aws configure

2. Actualizar variables de entorno en `lambda-orchestrator/.env`:
CUSTOMERS_API_BASE=https://api-customers.tu-dominio.com
ORDERS_API_BASE=https://api-orders.tu-dominio.com
SERVICE_TOKEN=production-token-xyz


### Desplegar Lambda
cd lambda-orchestrator
serverless deploy --stage prod


### Ver logs
serverless logs -f orchestrator --tail


### Eliminar despliegue
serverless remove --stage prod

## 📄 Licencia
MIT

## 👥 Autor
Carlos Ramirez - [@CarlosRcx](https://github.com/CarlosRcx)