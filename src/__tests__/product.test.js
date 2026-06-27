const request = require('supertest');
const app = require('../../server');

describe('Products API', () => {
  describe('GET /api/products', () => {
    it('should return product list', async () => {
      const res = await request(app).get('/api/products');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.products)).toBe(true);
    });

    it('should filter by department', async () => {
      const res = await request(app).get('/api/products?department=women');
      expect(res.status).toBe(200);
      res.body.products.forEach(p => expect(p.department).toBe('women'));
    });

    it('should paginate correctly', async () => {
      const res = await request(app).get('/api/products?page=1&limit=5');
      expect(res.status).toBe(200);
      expect(res.body.products.length).toBeLessThanOrEqual(5);
    });
  });
});
