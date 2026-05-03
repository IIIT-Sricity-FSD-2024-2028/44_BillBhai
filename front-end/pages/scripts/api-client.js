/**
 * API Client - Centralized wrapper for all backend API calls
 * Handles authentication, error handling, and request/response formatting
 * 
 * Usage:
 *   const response = await APIClient.get('/orders');
 *   const order = await APIClient.post('/orders', orderData, 'admin');
 */

class APIClient {
  constructor() {
    this.baseURL = 'http://localhost:3000/api';
    this.timeout = 10000; // 10 seconds
  }

  /**
   * Make HTTP request with automatic role header injection
   * @param {string} method - HTTP method (GET, POST, PUT, DELETE)
   * @param {string} path - API endpoint path (e.g., '/orders')
   * @param {object} data - Request body (for POST/PUT)
   * @param {string} role - User role from localStorage
   * @returns {Promise<object>} - Response data
   */
  async request(method, path, data = null, role = null) {
    const url = `${this.baseURL}${path}`;
    
    // Get role from parameter or localStorage
    const userRole = role || localStorage.getItem('userRole') || 'customer';
    
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-role': userRole, // Role-based access control header
      },
      cache: 'no-store',
    };

    // Add request body for POST/PUT
    if (data && (method === 'POST' || method === 'PUT')) {
      options.body = JSON.stringify(data);
    }

    try {
      // Set up timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      options.signal = controller.signal;

      const response = await fetch(url, options);
      clearTimeout(timeoutId);

      // Handle non-JSON responses
      const contentType = response.headers.get('content-type');
      let responseData;
      
      if (contentType && contentType.includes('application/json')) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }

      // Handle HTTP errors
      if (!response.ok) {
        throw {
          status: response.status,
          statusText: response.statusText,
          data: responseData,
          message: responseData?.message || `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      return responseData;
    } catch (error) {
      // Handle network errors and timeouts
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${this.timeout}ms`);
      }
      if (error instanceof TypeError) {
        throw new Error(`Network error: ${error.message}`);
      }
      throw error;
    }
  }

  // ─────────────────────────────────────
  // GET Methods
  // ─────────────────────────────────────

  async get(path, role = null) {
    return this.request('GET', path, null, role);
  }

  // ─────────────────────────────────────
  // POST Methods (Create)
  // ─────────────────────────────────────

  async post(path, data, role = null) {
    return this.request('POST', path, data, role);
  }

  // ─────────────────────────────────────
  // PUT Methods (Update)
  // ─────────────────────────────────────

  async put(path, data, role = null) {
    return this.request('PUT', path, data, role);
  }

  // ─────────────────────────────────────
  // DELETE Methods
  // ─────────────────────────────────────

  async delete(path, role = null) {
    return this.request('DELETE', path, null, role);
  }

  // ─────────────────────────────────────
  // Auth Endpoints
  // ─────────────────────────────────────

  /**
   * Dummy auth method - validates against hardcoded credentials (for demo)
   * In production, would call backend /api/auth/login
   */
  async login(username, password) {
    try {
      // Fetch auth config from local JSON (fallback to hardcoded)
      const authData = await this.get('/auth/users'); // Placeholder - not implemented in backend
    } catch (error) {
      // Fallback: Use local validation for now
      const defaultUsers = {
        'admin': { role: 'admin', companyId: 'BIZ-101', name: 'Admin User' },
        'cashier': { role: 'cashier', companyId: 'BIZ-101', name: 'Cashier' },
        'inventorymanager': { role: 'inventorymanager', companyId: 'BIZ-101', name: 'Inventory Manager' },
        'deliveryops': { role: 'deliveryops', companyId: 'BIZ-101', name: 'Delivery Ops' },
        'returnhandler': { role: 'returnhandler', companyId: 'BIZ-102', name: 'Return Handler' },
        'superuser': { role: 'superuser', companyId: null, name: 'Superuser' },
      };

      if (defaultUsers[username] && password === `${username}123`) {
        const user = defaultUsers[username];
        return {
          success: true,
          user: {
            username,
            role: user.role,
            companyId: user.companyId,
            name: user.name,
          },
        };
      }

      throw new Error('Invalid username or password');
    }
  }

  // ─────────────────────────────────────
  // Companies Endpoints
  // ─────────────────────────────────────

  async getCompanies(role = 'superuser') {
    return this.get('/companies', role);
  }

  async getCompany(id, role = 'superuser') {
    return this.get(`/companies/${id}`, role);
  }

  async createCompany(data, role = 'superuser') {
    return this.post('/companies', data, role);
  }

  async updateCompany(id, data, role = 'superuser') {
    return this.put(`/companies/${id}`, data, role);
  }

  async deleteCompany(id, role = 'superuser') {
    return this.delete(`/companies/${id}`, role);
  }

  // ─────────────────────────────────────
  // Users Endpoints
  // ─────────────────────────────────────

  async getUsers(companyId = null, role = 'admin') {
    const path = companyId ? `/users?companyId=${companyId}` : '/users';
    return this.get(path, role);
  }

  async getUser(id, role = 'admin') {
    return this.get(`/users/${id}`, role);
  }

  async createUser(data, role = 'admin') {
    return this.post('/users', data, role);
  }

  async updateUser(id, data, role = 'admin') {
    return this.put(`/users/${id}`, data, role);
  }

  async deleteUser(id, role = 'admin') {
    return this.delete(`/users/${id}`, role);
  }

  // ─────────────────────────────────────
  // Customers Endpoints
  // ─────────────────────────────────────

  async getCustomers(companyId = null, role = 'cashier') {
    const path = companyId ? `/customers?companyId=${companyId}` : '/customers';
    return this.get(path, role);
  }

  async getCustomerByPhone(phone, role = 'cashier') {
    return this.get(`/customers/phone/${phone}`, role);
  }

  async getCustomer(id, role = 'cashier') {
    return this.get(`/customers/${id}`, role);
  }

  async createCustomer(data, role = 'cashier') {
    return this.post('/customers', data, role);
  }

  async updateCustomer(id, data, role = 'cashier') {
    return this.put(`/customers/${id}`, data, role);
  }

  async deleteCustomer(id, role = 'admin') {
    return this.delete(`/customers/${id}`, role);
  }

  // ─────────────────────────────────────
  // Products Endpoints
  // ─────────────────────────────────────

  async getProducts(category = null, role = 'cashier') {
    const path = category ? `/products?category=${category}` : '/products';
    return this.get(path, role);
  }

  async getProductCategories(role = 'cashier') {
    return this.get('/products/categories', role);
  }

  async getProductByBarcode(barcode, role = 'cashier') {
    return this.get(`/products/barcode/${barcode}`, role);
  }

  async getProduct(id, role = 'cashier') {
    return this.get(`/products/${id}`, role);
  }

  async createProduct(data, role = 'inventorymanager') {
    return this.post('/products', data, role);
  }

  async updateProduct(id, data, role = 'inventorymanager') {
    return this.put(`/products/${id}`, data, role);
  }

  async deleteProduct(id, role = 'inventorymanager') {
    return this.delete(`/products/${id}`, role);
  }

  // ─────────────────────────────────────
  // Inventory Endpoints
  // ─────────────────────────────────────

  async getInventory(role = 'cashier') {
    return this.get('/inventory', role);
  }

  async getLowStockItems(role = 'inventorymanager') {
    return this.get('/inventory/low-stock', role);
  }

  async getInventoryByProduct(productId, role = 'cashier') {
    return this.get(`/inventory/product/${productId}`, role);
  }

  async getInventoryItem(id, role = 'cashier') {
    return this.get(`/inventory/${id}`, role);
  }

  async updateInventory(id, data, role = 'inventorymanager') {
    return this.put(`/inventory/${id}`, data, role);
  }

  async adjustStock(data, role = 'inventorymanager') {
    return this.post('/inventory/adjust', data, role);
  }

  // ─────────────────────────────────────
  // Orders Endpoints
  // ─────────────────────────────────────

  async getOrders(companyId = null, role = 'cashier') {
    const path = companyId ? `/orders?companyId=${companyId}` : '/orders';
    return this.get(path, role);
  }

  async getOrder(id, role = 'cashier') {
    return this.get(`/orders/${id}`, role);
  }

  async createOrder(data, role = 'cashier') {
    return this.post('/orders', data, role);
  }

  async updateOrder(id, data, role = 'cashier') {
    return this.put(`/orders/${id}`, data, role);
  }

  async deleteOrder(id, role = 'admin') {
    return this.delete(`/orders/${id}`, role);
  }

  // ─────────────────────────────────────
  // Bills Endpoints
  // ─────────────────────────────────────

  async getBills(role = 'cashier') {
    return this.get('/orders/bills/all', role);
  }

  async getBill(billNo, role = 'cashier') {
    return this.get(`/orders/bills/${billNo}`, role);
  }

  async createBill(data, role = 'cashier') {
    return this.post('/orders/bills', data, role);
  }

  // ─────────────────────────────────────
  // Payments Endpoints
  // ─────────────────────────────────────

  async getPayments(role = 'cashier') {
    return this.get('/orders/payments/all', role);
  }

  async getPayment(billNo, role = 'cashier') {
    return this.get(`/orders/payments/${billNo}`, role);
  }

  async createPayment(data, role = 'cashier') {
    return this.post('/orders/payments', data, role);
  }

  // ─────────────────────────────────────
  // Deliveries Endpoints
  // ─────────────────────────────────────

  async getDeliveries(status = null, role = 'deliveryops') {
    const path = status ? `/deliveries?status=${status}` : '/deliveries';
    return this.get(path, role);
  }

  async getDeliveryByOrder(orderId, role = 'deliveryops') {
    return this.get(`/deliveries/order/${orderId}`, role);
  }

  async getDelivery(id, role = 'deliveryops') {
    return this.get(`/deliveries/${id}`, role);
  }

  async createDelivery(data, role = 'deliveryops') {
    return this.post('/deliveries', data, role);
  }

  async updateDelivery(id, data, role = 'deliveryops') {
    return this.put(`/deliveries/${id}`, data, role);
  }

  async deleteDelivery(id, role = 'admin') {
    return this.delete(`/deliveries/${id}`, role);
  }

  // ─────────────────────────────────────
  // Returns Endpoints
  // ─────────────────────────────────────

  async getReturns(status = null, role = 'returnhandler') {
    const path = status ? `/returns?status=${status}` : '/returns';
    return this.get(path, role);
  }

  async getReturn(id, role = 'returnhandler') {
    return this.get(`/returns/${id}`, role);
  }

  async createReturn(data, role = 'returnhandler') {
    return this.post('/returns', data, role);
  }

  async updateReturn(id, data, role = 'returnhandler') {
    return this.put(`/returns/${id}`, data, role);
  }

  async deleteReturn(id, role = 'admin') {
    return this.delete(`/returns/${id}`, role);
  }

  // ─────────────────────────────────────
  // Reports Endpoints
  // ─────────────────────────────────────

  async getSalesReport(role = 'admin') {
    return this.get('/reports/sales', role);
  }

  async getInventoryReport(role = 'admin') {
    return this.get('/reports/inventory', role);
  }

  async getReturnsReport(role = 'admin') {
    return this.get('/reports/returns', role);
  }

  // ─────────────────────────────────────
  // Suppliers Endpoints
  // ─────────────────────────────────────

  async getSuppliers(role = 'inventorymanager') {
    return this.get('/suppliers', role);
  }

  async getSupplier(id, role = 'inventorymanager') {
    return this.get(`/suppliers/${id}`, role);
  }

  async createSupplier(data, role = 'inventorymanager') {
    return this.post('/suppliers', data, role);
  }

  async updateSupplier(id, data, role = 'inventorymanager') {
    return this.put(`/suppliers/${id}`, data, role);
  }

  async deleteSupplier(id, role = 'admin') {
    return this.delete(`/suppliers/${id}`, role);
  }
}

// Create global instance
const APIClient_Instance = new APIClient();
