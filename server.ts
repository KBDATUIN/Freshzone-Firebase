import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import sqlite3 from 'sqlite3';
import session from 'express-session';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer);
  const PORT = 3000;

  // Database setup
  const db = new sqlite3.Database('./freshzone.db');

  db.serialize(async () => {
    db.run(`CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      contact_number TEXT,
      position TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      photo_url TEXT,
      emergency_contact TEXT,
      role TEXT DEFAULT 'Staff',
      is_active INTEGER DEFAULT 1,
      date_joined DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS sensor_nodes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      node_code TEXT UNIQUE NOT NULL,
      location_name TEXT NOT NULL,
      floor TEXT,
      description TEXT,
      is_active INTEGER DEFAULT 1,
      last_seen DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS sensor_readings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      node_id INTEGER NOT NULL,
      pm1_0 REAL,
      pm2_5 REAL,
      pm10 REAL,
      aqi_value INTEGER,
      aqi_category TEXT,
      smoke_detected INTEGER DEFAULT 0,
      recorded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(node_id) REFERENCES sensor_nodes(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS detection_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      node_id INTEGER NOT NULL,
      location_name TEXT NOT NULL,
      pm2_5_value REAL,
      aqi_value INTEGER,
      event_status TEXT DEFAULT 'Detected',
      detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      resolved_at DATETIME,
      resolved_by INTEGER,
      notes TEXT,
      FOREIGN KEY(node_id) REFERENCES sensor_nodes(id),
      FOREIGN KEY(resolved_by) REFERENCES accounts(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_ref TEXT UNIQUE NOT NULL,
      account_id INTEGER,
      submitter_name TEXT NOT NULL,
      submitter_email TEXT NOT NULL,
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT DEFAULT 'Open',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(account_id) REFERENCES accounts(id)
    )`);

    // Add default admin if not exists
    const adminPass = await bcrypt.hash('admin123', 12);
    db.run(`INSERT OR IGNORE INTO accounts (employee_id, full_name, email, position, password_hash, role)
            VALUES ('02000383126', 'EJ Perez', 'toxicg332@gmail.com', 'Administrator', ?, 'Admin')`, [adminPass]);

    // Add default nodes
    db.run(`INSERT OR IGNORE INTO sensor_nodes (node_code, location_name, floor, description) VALUES ('ESP32-ZONE1', '4th Floor Male CR', '4th Floor', 'PMS7003 unit inside Male CR')`);
    db.run(`INSERT OR IGNORE INTO sensor_nodes (node_code, location_name, floor, description) VALUES ('ESP32-ZONE2', '4th Floor Female CR', '4th Floor', 'PMS7003 unit inside Female CR')`);
  });

  app.use(express.json({ limit: '10mb' }));
  app.use(session({
    secret: 'freshzone-perez-secret-2026',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 24 * 60 * 60 * 1000 }
  }));

  // Middlewares
  const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if ((req.session as any).userId) next();
    else res.status(401).json({ error: 'Unauthorized' });
  };

  const requireAdmin = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if ((req.session as any).role === 'Admin') next();
    else res.status(403).json({ error: 'Admin access required' });
  };

  // Socket.io
  io.on('connection', (socket) => {
    console.log('Client connected');
  });

  // API Routes
  app.get('/health', (req, res) => res.send('FreshZone Server Online'));

  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body;
    db.get('SELECT * FROM accounts WHERE email = ? AND is_active = 1', [email], async (err, user: any) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (!user) return res.status(401).json({ error: 'Invalid email or account inactive' });
      
      const match = await bcrypt.compare(password, user.password_hash);
      if (!match) return res.status(401).json({ error: 'Invalid password' });

      (req.session as any).userId = user.id;
      (req.session as any).role = user.role;
      (req.session as any).userName = user.full_name;
      
      db.run('UPDATE accounts SET last_login = CURRENT_TIMESTAMP WHERE id = ?', [user.id]);
      res.json({ user: { id: user.id, name: user.full_name, email: user.email, role: user.role, position: user.position } });
    });
  });

  app.post('/api/auth/signup', async (req, res) => {
    const { full_name, employee_id, email, contact_number, position, password } = req.body;
    try {
      const hash = await bcrypt.hash(password, 12);
      db.run(`INSERT INTO accounts (full_name, employee_id, email, contact_number, position, password_hash, role)
              VALUES (?, ?, ?, ?, ?, ?, 'Staff')`,
        [full_name, employee_id, email, contact_number, position, hash],
        function(err) {
          if (err) return res.status(400).json({ error: 'User already exists or data error' });
          res.json({ success: true });
        }
      );
    } catch (e) {
      res.status(500).json({ error: 'Server error' });
    }
  });

  app.get('/api/auth/me', (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });
    db.get('SELECT * FROM accounts WHERE id = ?', [userId], (err, user) => {
      if (err || !user) return res.status(401).json({ error: 'User not found' });
      res.json({ user });
    });
  });

  app.post('/api/auth/logout', (req, res) => {
    req.session.destroy(() => res.json({ success: true }));
  });

  // Email Notification Helper
  const sendEmailNotification = async (location: string, pm25: number, aqi: number) => {
    console.log(`[EMAIL NOTIFICATION] To: admin@freshzone.edu.ph`);
    console.log(`[EMAIL NOTIFICATION] Subject: ALERT: Vape Aerosol Detected at ${location}`);
    console.log(`[EMAIL NOTIFICATION] Message: Vape aerosol was detected at ${location} at ${new Date().toLocaleString()}. PM2.5: ${pm25}, AQI: ${aqi}. Immediate action is recommended.`);
    // Real implementation would use nodemailer or a service like Resend/SendGrid
  };

  // Sensor endpoint for ESP32
  app.post('/api/sensor/reading', (req, res) => {
    const { node_code, pm1_0, pm2_5, pm10, aqi_value, aqi_category, smoke_detected } = req.body;
    db.get('SELECT id, location_name FROM sensor_nodes WHERE node_code = ?', [node_code], (err, node: any) => {
      if (err || !node) return res.status(404).json({ error: 'Node not found' });
      db.run(`INSERT INTO sensor_readings (node_id, pm1_0, pm2_5, pm10, aqi_value, aqi_category, smoke_detected)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [node.id, pm1_0, pm2_5, pm10, aqi_value, aqi_category, smoke_detected],
        function(err) {
          if (err) return res.status(500).json({ error: 'Failed to log reading' });
          if (smoke_detected) {
            db.run(`INSERT INTO detection_events (node_id, location_name, pm2_5_value, aqi_value)
                    VALUES (?, ?, ?, ?)`,
              [node.id, node.location_name, pm2_5, aqi_value],
              function(err) {
                if (!err) {
                  const eventId = this.lastID;
                  io.emit('vape_detected', { id: eventId, location: node.location_name, pm2_5, aqi_value, aqi_category });
                  sendEmailNotification(node.location_name, pm2_5, aqi_value);
                }
              }
            );
          }
          io.emit('reading_updated', { nodeId: node.id, pm1_0, pm2_5, pm10, aqi_value, aqi_category, smoke_detected });
          res.json({ success: true });
        }
      );
    });
  });

  app.get('/api/dashboard/status', requireAuth, (req, res) => {
    db.all(`
      SELECT n.id, n.node_code, n.location_name, n.floor, n.is_active,
             r.pm1_0, r.pm2_5, r.pm10, r.aqi_value, r.aqi_category, r.smoke_detected, r.recorded_at
      FROM sensor_nodes n
      LEFT JOIN (
        SELECT node_id, pm1_0, pm2_5, pm10, aqi_value, aqi_category, smoke_detected, recorded_at
        FROM sensor_readings
        WHERE id IN (SELECT MAX(id) FROM sensor_readings GROUP BY node_id)
      ) r ON n.id = r.node_id
    `, (err, stats) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json({ stats });
    });
  });

  app.get('/api/history', requireAuth, (req, res) => {
    db.all(`
      SELECT e.*, a.full_name as resolved_by_name
      FROM detection_events e
      LEFT JOIN accounts a ON e.resolved_by = a.id
      ORDER BY e.detected_at DESC
    `, (err, history) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json({ history });
    });
  });

  app.delete('/api/history/all', requireAdmin, (req, res) => {
    db.run('DELETE FROM detection_events', (err) => {
      if (err) return res.status(500).json({ error: 'Failed to clear history' });
      io.emit('history_cleared');
      res.json({ success: true });
    });
  });

  app.get('/api/history/export', requireAuth, (req, res) => {
    db.all('SELECT * FROM detection_events ORDER BY detected_at DESC', (err, rows: any[]) => {
      if (err) return res.status(500).send('Export failed');
      let csv = 'ID,Location,PM2.5,AQI,Status,Detected At,Notes\n';
      rows.forEach(r => {
        csv += `${r.id},"${r.location_name}",${r.pm2_5_value},${r.aqi_value},${r.event_status},${r.detected_at},"${r.notes || ''}"\n`;
      });
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=detection-history.csv');
      res.send(csv);
    });
  });

  app.post('/api/tickets', requireAuth, (req, res) => {
    const { subject, message } = req.body;
    const userId = (req.session as any).userId;
    const userName = (req.session as any).userName;
    const ref = `TK-${Math.floor(Math.random() * 900000) + 100000}`;
    db.get('SELECT email FROM accounts WHERE id = ?', [userId], (err, user: any) => {
      db.run(`INSERT INTO tickets (ticket_ref, account_id, submitter_name, submitter_email, subject, message)
              VALUES (?, ?, ?, ?, ?, ?)`,
        [ref, userId, userName, user.email, subject, message],
        (err) => {
          if (err) return res.status(500).json({ error: 'Failed to submit report' });
          res.json({ success: true, ref });
        }
      );
    });
  });

  app.get('/api/tickets/inbox', requireAuth, (req, res) => {
    db.all('SELECT * FROM tickets ORDER BY created_at DESC LIMIT 10', (err, tickets) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json({ tickets });
    });
  });

  app.post('/api/events/:id/acknowledge', requireAuth, (req, res) => {
    const userId = (req.session as any).userId;
    const { id } = req.params;
    db.run(`UPDATE detection_events SET event_status = 'Acknowledged', resolved_by = ?, resolved_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [userId, id], (err) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        io.emit('event_updated', { id, status: 'Acknowledged' });
        res.json({ success: true });
      });
  });

  // Vite setup
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    
    // Explicitly serve index.html for root if Vite middleware doesn't respond
    app.use('*', async (req, res, next) => {
      if (req.originalUrl.startsWith('/api')) return next();
      try {
        let template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(req.originalUrl, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        next(e);
      }
    });
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
