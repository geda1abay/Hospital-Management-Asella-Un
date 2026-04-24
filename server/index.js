import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pkg from 'pg';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const { Pool } = pkg;

dotenv.config({ path: '../.env' }); // Load from root .env

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

// Middleware to verify JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Auth Routes
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM public.app_users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user) return res.status(401).json({ message: 'Invalid credentials' });

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) return res.status(401).json({ message: 'Invalid credentials' });

    const roleResult = await pool.query('SELECT role FROM public.user_roles WHERE user_id = $1', [user.id]);
    const role = roleResult.rows[0]?.role;

    const token = jwt.sign({ id: user.id, email: user.email, role }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ token, user: { id: user.id, email: user.email, role, full_name: user.full_name } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const userResult = await pool.query('SELECT id, email, full_name FROM public.app_users WHERE id = $1', [req.user.id]);
    const profileResult = await pool.query('SELECT * FROM public.profiles WHERE user_id = $1', [req.user.id]);
    const roleResult = await pool.query('SELECT role FROM public.user_roles WHERE user_id = $1', [req.user.id]);

    res.json({
      user: userResult.rows[0],
      profile: profileResult.rows[0],
      role: roleResult.rows[0]?.role
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Stats
app.get('/api/stats', authenticateToken, async (req, res) => {
  try {
    const patients = await pool.query('SELECT COUNT(*) FROM public.patients');
    const doctors = await pool.query('SELECT COUNT(*) FROM public.user_roles WHERE role != \'admin\'');
    const bills = await pool.query('SELECT * FROM public.bills');
    const payments = await pool.query('SELECT * FROM public.payments');

    const totalBillsAmount = bills.rows.reduce((sum, b) => sum + Number(b.final_amount || 0), 0);
    const totalPaymentsAmount = payments.rows.reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const totalRevenue = totalBillsAmount + totalPaymentsAmount;
    const pendingBills = bills.rows.filter(b => b.status === 'pending').length;

    res.json({
      patients: parseInt(patients.rows[0].count),
      doctors: parseInt(doctors.rows[0].count),
      revenue: totalRevenue,
      bills: bills.rows.length,
      pendingBills,
      payments: payments.rows.length
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Patients Routes
app.get('/api/patients', authenticateToken, async (req, res) => {
  try {
    let query = 'SELECT * FROM public.patients';
    let params = [];
    if (req.user.role === 'general_doctor') {
      query += ' WHERE assigned_general_doctor_id = $1';
      params.push(req.user.id);
    } else if (req.user.role === 'specialist_doctor') {
      query += ' WHERE referred_specialist_id = $1';
      params.push(req.user.id);
    }
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/patients', authenticateToken, async (req, res) => {
  const { name, age, gender, contact, address, assigned_general_doctor_id, medical_history } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO public.patients (name, age, gender, contact, address, assigned_general_doctor_id, medical_history) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [name, age, gender, contact, address, assigned_general_doctor_id, medical_history]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/patients/:id', authenticateToken, async (req, res) => {
  const { name, age, gender, contact, address, assigned_general_doctor_id, medical_history, referred_specialist_id, status } = req.body;
  try {
    const result = await pool.query(
      'UPDATE public.patients SET name = COALESCE($1, name), age = COALESCE($2, age), gender = COALESCE($3, gender), contact = COALESCE($4, contact), address = COALESCE($5, address), assigned_general_doctor_id = COALESCE($6, assigned_general_doctor_id), medical_history = COALESCE($7, medical_history), referred_specialist_id = COALESCE($8, referred_specialist_id), status = COALESCE($9, status) WHERE id = $10 RETURNING *',
      [name, age, gender, contact, address, assigned_general_doctor_id, medical_history, referred_specialist_id, status, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/patients/:id/refer', authenticateToken, async (req, res) => {
  const { referred_specialist_id } = req.body;
  try {
    const result = await pool.query(
      'UPDATE public.patients SET referred_specialist_id = $1, status = $2 WHERE id = $3 RETURNING *',
      [referred_specialist_id, 'referred', req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/patients/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM public.patients WHERE id = $1', [req.params.id]);
    res.json({ message: 'Patient deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Departments
app.get('/api/departments', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM public.departments ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/departments', authenticateToken, async (req, res) => {
  const { name } = req.body;
  try {
    const result = await pool.query('INSERT INTO public.departments (name) VALUES ($1) RETURNING *', [name]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/departments/:id', authenticateToken, async (req, res) => {
  const { name } = req.body;
  try {
    const result = await pool.query('UPDATE public.departments SET name = $1 WHERE id = $2 RETURNING *', [name, req.params.id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/departments/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM public.departments WHERE id = $1', [req.params.id]);
    res.json({ message: 'Department deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Doctors
app.post('/api/doctors', authenticateToken, async (req, res) => {
  const { email, password, full_name, role, department_id } = req.body;
  console.log('Creating staff member:', { email, full_name, role, department_id });

  try {
    const hash = await bcrypt.hash(password, 10);

    // Start a transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const userResult = await client.query(
        'INSERT INTO public.app_users (email, password_hash, full_name) VALUES ($1, $2, $3) RETURNING id',
        [email, hash, full_name]
      );
      const userId = userResult.rows[0].id;

      await client.query('INSERT INTO public.user_roles (user_id, role) VALUES ($1, $2)', [userId, role]);

      await client.query(
        'INSERT INTO public.profiles (user_id, full_name, email, department_id) VALUES ($1, $2, $3, $4)',
        [userId, full_name, email, (department_id || null)]
      );

      await client.query('COMMIT');
      console.log('Staff member created successfully id:', userId);
      res.json({ message: 'Doctor created', id: userId });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error creating staff:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/doctors/:userId', authenticateToken, async (req, res) => {
  const { full_name, role, department_id } = req.body;
  try {
    await pool.query('UPDATE public.app_users SET full_name = $1 WHERE id = $2', [full_name, req.params.userId]);
    await pool.query('UPDATE public.user_roles SET role = $1 WHERE user_id = $2', [role, req.params.userId]);
    await pool.query('UPDATE public.profiles SET full_name = $1, department_id = $2 WHERE user_id = $3', [full_name, department_id, req.params.userId]);
    res.json({ message: 'Doctor updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/doctors/:userId/reset_password', authenticateToken, async (req, res) => {
  const { password } = req.body;
  try {
    const hash = await bcrypt.hash(password, 10);
    await pool.query('UPDATE public.app_users SET password_hash = $1 WHERE id = $2', [hash, req.params.userId]);
    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/doctors/:userId', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM public.profiles WHERE user_id = $1', [req.params.userId]);
    await pool.query('DELETE FROM public.user_roles WHERE user_id = $1', [req.params.userId]);
    await pool.query('DELETE FROM public.app_users WHERE id = $1', [req.params.userId]);
    res.json({ message: 'Doctor deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Profiles/Roles
app.get('/api/profiles', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM public.profiles');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/user_roles', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM public.user_roles');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Bills
app.get('/api/bills', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM public.bills ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/bills', authenticateToken, async (req, res) => {
  const { patient_id, total_amount, tax, discount, final_amount } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO public.bills (patient_id, total_amount, tax, discount, final_amount) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [patient_id, total_amount, tax, discount, final_amount]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Payments
app.get('/api/payments', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM public.payments ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/payments', authenticateToken, async (req, res) => {
  const { bill_id, amount, method, reference_number, status } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO public.payments (bill_id, amount, method, reference_number, status) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [bill_id, amount, method, reference_number, status]
    );

    // Update bill status logic
    const billRes = await pool.query('SELECT final_amount FROM public.bills WHERE id = $1', [bill_id]);
    const finalAmount = billRes.rows[0].final_amount;
    const payRes = await pool.query('SELECT SUM(amount) FROM public.payments WHERE bill_id = $1 AND status = \'completed\'', [bill_id]);
    const totalPaid = payRes.rows[0].sum || 0;

    const newStatus = totalPaid >= finalAmount ? 'paid' : totalPaid > 0 ? 'partial' : 'pending';
    await pool.query('UPDATE public.bills SET status = $1 WHERE id = $2', [newStatus, bill_id]);

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/payments/:id', authenticateToken, async (req, res) => {
  const { amount, method, reference_number, status } = req.body;
  try {
    const result = await pool.query(
      'UPDATE public.payments SET amount = $1, method = $2, reference_number = $3, status = $4 WHERE id = $5 RETURNING *',
      [amount, method, reference_number, status, req.params.id]
    );
    // Logic for bill status update could be repeated or extracted
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/payments/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM public.payments WHERE id = $1', [req.params.id]);
    res.json({ message: 'Payment deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Diagnoses
app.get('/api/diagnoses', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM public.diagnoses ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/diagnoses', authenticateToken, async (req, res) => {
  const { patient_id, doctor_id, diagnosis, notes, recommendation } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO public.diagnoses (patient_id, doctor_id, diagnosis, notes, recommendation) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [patient_id, doctor_id, diagnosis, notes, recommendation]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/diagnoses/:id', authenticateToken, async (req, res) => {
  const { diagnosis, notes, recommendation } = req.body;
  try {
    const result = await pool.query(
      'UPDATE public.diagnoses SET diagnosis = $1, notes = $2, recommendation = $3 WHERE id = $4 RETURNING *',
      [diagnosis, notes, recommendation, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/diagnoses/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM public.diagnoses WHERE id = $1', [req.params.id]);
    res.json({ message: 'Diagnosis deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Services
app.get('/api/services', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM public.services ORDER BY name');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/services', authenticateToken, async (req, res) => {
  const { name, price, category } = req.body;
  try {
    const result = await pool.query('INSERT INTO public.services (name, price, category) VALUES ($1, $2, $3) RETURNING *', [name, price, category]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/services/:id', authenticateToken, async (req, res) => {
  const { name, price, category } = req.body;
  try {
    const result = await pool.query('UPDATE public.services SET name = $1, price = $2, category = $3 WHERE id = $4 RETURNING *', [name, price, category, req.params.id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/services/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM public.services WHERE id = $1', [req.params.id]);
    res.json({ message: 'Service deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Lab Requests
app.get('/api/lab_requests', authenticateToken, async (req, res) => {
  try {
    let query = 'SELECT * FROM public.lab_requests';
    let params = [];
    if (req.user.role === 'specialist_doctor') {
      query += ' WHERE doctor_id = $1';
      params.push(req.user.id);
    }
    query += ' ORDER BY created_at DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/lab_requests', authenticateToken, async (req, res) => {
  const { patient_id, test_description } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO public.lab_requests (patient_id, doctor_id, test_description) VALUES ($1, $2, $3) RETURNING *',
      [patient_id, req.user.id, test_description]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/lab_requests/:id', authenticateToken, async (req, res) => {
  const { cost_birr, result_note, payment_status, status } = req.body;
  try {
    const result = await pool.query(
      'UPDATE public.lab_requests SET cost_birr = COALESCE($1, cost_birr), result_note = COALESCE($2, result_note), payment_status = COALESCE($3, payment_status), status = COALESCE($4, status), updated_at = now() WHERE id = $5 RETURNING *',
      [cost_birr, result_note, payment_status, status, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/lab_requests/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM public.lab_requests WHERE id = $1', [req.params.id]);
    res.json({ message: 'Lab request deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
  });
}

export default app;

