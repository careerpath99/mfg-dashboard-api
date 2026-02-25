/**
 * Manufacturing Dashboard API
 * Node.js + Express + Supabase
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const { createClient } = require('@supabase/supabase-js');

// Initialize Express
const app = express();
const PORT = process.env.PORT || 3000;

// Security Middleware
app.use(helmet());
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Body Parser
app.use(express.json({ limit: '10mb' }));
app.use(morgan('combined'));

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ ERROR: SUPABASE_URL dan SUPABASE_KEY harus diatur di environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Helper: Async handler
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// ============================================
// HEALTH CHECK
// ============================================
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    uptime: process.uptime()
  });
});

// ============================================
// PR ROUTES (Production Reliability)
// ============================================

// GET all PR records with pagination
app.get('/api/pr', asyncHandler(async (req, res) => {
  const { page = 1, limit = 50 } = req.query;
  const from = (parseInt(page) - 1) * parseInt(limit);
  const to = from + parseInt(limit) - 1;

  const { data, error, count } = await supabase
    .from('pr_records')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) throw error;

  res.json({
    success: true,
    data,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total: count,
      totalPages: Math.ceil(count / parseInt(limit))
    }
  });
}));

// POST new PR record
app.post('/api/pr', asyncHandler(async (req, res) => {
  const {
    date,
    line_name,
    running_hours,
    running_minutes,
    ppm,
    theoretical_output,
    actual_output,
    pr_percent
  } = req.body;

  // Validation
  if (!date || !line_name || actual_output === undefined) {
    return res.status(400).json({
      success: false,
      error: 'Required fields: date, line_name, actual_output'
    });
  }

  const { data, error } = await supabase
    .from('pr_records')
    .insert([{
      date,
      line_name,
      running_hours: running_hours || 0,
      running_minutes: running_minutes || 0,
      ppm: ppm || 0,
      theoretical_output: theoretical_output || 0,
      actual_output,
      pr_percent: pr_percent || 0
    }])
    .select()
    .single();

  if (error) throw error;

  res.status(201).json({ success: true, data });
}));

// DELETE PR record
app.delete('/api/pr/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase
    .from('pr_records')
    .delete()
    .eq('id', id);

  if (error) throw error;

  res.json({ success: true, message: 'PR record deleted' });
}));

// ============================================
// FTY ROUTES (First Time Yield)
// ============================================

// GET all FTY records
app.get('/api/fty', asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('fty_records')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;

  res.json({ success: true, data });
}));

// POST new FTY record
app.post('/api/fty', asyncHandler(async (req, res) => {
  const {
    date,
    equipment_name,
    equipment_no,
    total_output,
    ng_fty,
    actual_output,
    fty_percent,
    quantity
  } = req.body;

  if (!date || !equipment_name) {
    return res.status(400).json({
      success: false,
      error: 'Required fields: date, equipment_name'
    });
  }

  const { data, error } = await supabase
    .from('fty_records')
    .insert([{
      date,
      equipment_name,
      equipment_no: equipment_no || 1,
      total_output: total_output || 0,
      ng_fty: ng_fty || 0,
      actual_output: actual_output || 0,
      fty_percent: fty_percent || 0,
      quantity: quantity || 1
    }])
    .select()
    .single();

  if (error) throw error;

  res.status(201).json({ success: true, data });
}));

// DELETE FTY record
app.delete('/api/fty/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase
    .from('fty_records')
    .delete()
    .eq('id', id);

  if (error) throw error;

  res.json({ success: true, message: 'FTY record deleted' });
}));

// ============================================
// DOWNTIME ROUTES
// ============================================

// GET all downtime records
app.get('/api/downtime', asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('downtime_records')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;

  res.json({ success: true, data });
}));

// POST new downtime record
app.post('/api/downtime', asyncHandler(async (req, res) => {
  const {
    date,
    equipment_count,
    total_units,
    avg_downtime,
    status,
    equipments
  } = req.body;

  const { data, error } = await supabase
    .from('downtime_records')
    .insert([{
      date,
      equipment_count: equipment_count || 0,
      total_units: total_units || 0,
      avg_downtime: avg_downtime || 0,
      status: status || 'Normal',
      equipments: equipments || []
    }])
    .select()
    .single();

  if (error) throw error;

  res.status(201).json({ success: true, data });
}));

// DELETE downtime record
app.delete('/api/downtime/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase
    .from('downtime_records')
    .delete()
    .eq('id', id);

  if (error) throw error;

  res.json({ success: true, message: 'Downtime record deleted' });
}));

// ============================================
// PPM ROUTES (Parts Per Minute)
// ============================================

// GET all PPM records
app.get('/api/ppm', asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('ppm_records')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;

  res.json({ success: true, data });
}));

// POST new PPM record
app.post('/api/ppm', asyncHandler(async (req, res) => {
  const {
    machine_name,
    design_ppm,
    machine_count,
    target_ppm,
    total_time,
    total_output,
    actual_ppm,
    achieved,
    achievement_percent
  } = req.body;

  const { data, error } = await supabase
    .from('ppm_records')
    .insert([{
      machine_name: machine_name || 'Unknown',
      design_ppm: design_ppm || 0,
      machine_count: machine_count || 1,
      target_ppm: target_ppm || 0,
      total_time: total_time || 0,
      total_output: total_output || 0,
      actual_ppm: actual_ppm || 0,
      achieved: achieved || false,
      achievement_percent: achievement_percent || 0
    }])
    .select()
    .single();

  if (error) throw error;

  res.status(201).json({ success: true, data });
}));

// DELETE PPM record
app.delete('/api/ppm/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;

  const { error } = await supabase
    .from('ppm_records')
    .delete()
    .eq('id', id);

  if (error) throw error;

  res.json({ success: true, message: 'PPM record deleted' });
}));

// ============================================
// SUMMARY STATS
// ============================================

app.get('/api/summary/stats', asyncHandler(async (req, res) => {
  const [prRes, ftyRes, dtRes, ppmRes] = await Promise.all([
    supabase.from('pr_records').select('pr_percent'),
    supabase.from('fty_records').select('fty_percent'),
    supabase.from('downtime_records').select('avg_downtime'),
    supabase.from('ppm_records').select('achievement_percent')
  ]);

  const calculateAvg = (data, field) => {
    if (!data || data.length === 0) return 0;
    const sum = data.reduce((acc, item) => acc + (item[field] || 0), 0);
    return sum / data.length;
  };

  const prAvg = calculateAvg(prRes.data, 'pr_percent');
  const ftyAvg = calculateAvg(ftyRes.data, 'fty_percent');
  const dtAvg = calculateAvg(dtRes.data, 'avg_downtime');
  const ppmAvg = calculateAvg(ppmRes.data, 'achievement_percent');

  res.json({
    success: true,
    data: {
      pr_average: prAvg.toFixed(2),
      fty_average: ftyAvg.toFixed(2),
      downtime_average: dtAvg.toFixed(2),
      ppm_average: ppmAvg.toFixed(2),
      counts: {
        pr: prRes.data?.length || 0,
        fty: ftyRes.data?.length || 0,
        downtime: dtRes.data?.length || 0,
        ppm: ppmRes.data?.length || 0
      }
    }
  });
}));

// ============================================
// ROOT & ERROR HANDLING
// ============================================

app.get('/', (req, res) => {
  res.json({
    message: '🏭 Manufacturing Dashboard API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/api/health',
      pr: '/api/pr',
      fty: '/api/fty',
      downtime: '/api/downtime',
      ppm: '/api/ppm',
      summary: '/api/summary/stats'
    }
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint not found' });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error('❌ Error:', err);
  res.status(500).json({
    success: false,
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 API Base: http://localhost:${PORT}`);
  console.log(`🏥 Health Check: http://localhost:${PORT}/api/health`);
});
