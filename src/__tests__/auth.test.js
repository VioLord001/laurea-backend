// ============================================
// STAGE 5: BACKEND TESTS — Auth
// Run: npm test
// ============================================
const request = require('supertest');
const app = require('../../server');

describe('Auth API', () => {
  const testUser = { firstName: 'Test', lastName: 'User', email: `test${Date.now()}@example.com`, password: 'Test@1234' };

  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      const res = await request(app).post('/api/auth/register').send(testUser);
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.user.email).toBe(testUser.email);
      expect(res.body.token).toBeDefined();
    });

    it('should reject duplicate email', async () => {
      await request(app).post('/api/auth/register').send(testUser);
      const res = await request(app).post('/api/auth/register').send(testUser);
      expect(res.status).toBe(400);
    });

    it('should reject weak password', async () => {
      const res = await request(app).post('/api/auth/register').send({ ...testUser, password: '123', email: 'other@test.com' });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with correct credentials', async () => {
      await request(app).post('/api/auth/register').send(testUser);
      const res = await request(app).post('/api/auth/login').send({ email: testUser.email, password: testUser.password });
      expect(res.status).toBe(200);
      expect(res.body.token).toBeDefined();
    });

    it('should reject wrong password', async () => {
      const res = await request(app).post('/api/auth/login').send({ email: testUser.email, password: 'wrongpassword' });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return current user with valid token', async () => {
      const loginRes = await request(app).post('/api/auth/login').send({ email: testUser.email, password: testUser.password });
      const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${loginRes.body.token}`);
      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
    });

    it('should reject without token', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });
  });
});
