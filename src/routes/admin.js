import express from 'express';
import jwt from 'jsonwebtoken';
import db from '../db/database.js';

const router = express.Router();
const JWT_SECRET = 'car-booking-secret-key';

const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: '请先登录' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    if (req.user.role !== 'admin') return res.status(403).json({ message: '需要管理员权限' });
    next();
  } catch {
    res.status(401).json({ message: 'token无效' });
  }
};

router.get('/vehicles', authenticate, (req, res) => {
  const vehicles = db.prepare('SELECT * FROM vehicles').all();
  res.json(vehicles);
});

router.put('/vehicles/:id', authenticate, (req, res) => {
  const { name, plate } = req.body;
  db.prepare('UPDATE vehicles SET name = ?, plate = ? WHERE id = ?').run(name, plate, req.params.id);
  res.json({ success: true });
});

router.get('/pending', authenticate, (req, res) => {
  const bookings = db.prepare(`
    SELECT b.*, v.name as vehicle_name, v.plate as vehicle_plate
    FROM bookings b 
    LEFT JOIN vehicles v ON b.vehicle_id = v.id
    WHERE b.status = 'pending'
    ORDER BY b.date, b.start_time
  `).all();
  res.json(bookings);
});

router.post('/approve/:id', authenticate, (req, res) => {
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
  if (!booking) return res.status(404).json({ message: '预约不存在' });
  
  db.prepare('UPDATE bookings SET status = ? WHERE id = ?').run('approved', req.params.id);
  res.json({ message: '已批准' });
});

router.post('/reject/:id', authenticate, (req, res) => {
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
  if (!booking) return res.status(404).json({ message: '预约不存在' });
  
  db.prepare('UPDATE bookings SET status = ? WHERE id = ?').run('rejected', req.params.id);
  res.json({ message: '已拒绝' });
});

router.post('/cancel/:id', authenticate, (req, res) => {
  const booking = db.prepare('SELECT * FROM bookings WHERE id = ?').get(req.params.id);
  if (!booking) return res.status(404).json({ message: '预约不存在' });
  
  db.prepare('DELETE FROM bookings WHERE id = ?').run(req.params.id);
  res.json({ message: '已撤销' });
});

router.get('/all', authenticate, (req, res) => {
  const bookings = db.prepare(`
    SELECT b.*, v.name as vehicle_name, v.plate as vehicle_plate
    FROM bookings b 
    LEFT JOIN vehicles v ON b.vehicle_id = v.id
    ORDER BY b.date DESC, b.start_time
  `).all();
  res.json(bookings);
});

router.get('/unavailable', authenticate, (req, res) => {
  const unavailable = db.prepare(`
    SELECT u.*, v.name as vehicle_name, v.plate as vehicle_plate
    FROM vehicle_unavailable u
    LEFT JOIN vehicles v ON u.vehicle_id = v.id
    ORDER BY u.date DESC
  `).all();
  res.json(unavailable);
});

router.post('/unavailable', authenticate, (req, res) => {
  const { vehicle_id, date, reason } = req.body;
  if (!vehicle_id || !date) {
    return res.status(400).json({ message: '请选择车辆和日期' });
  }
  const existing = db.prepare('SELECT id FROM vehicle_unavailable WHERE vehicle_id = ? AND date = ?').get(vehicle_id, date);
  if (existing) {
    return res.status(400).json({ message: '该车辆该日期已设置不可用' });
  }
  db.prepare('INSERT INTO vehicle_unavailable (vehicle_id, date, reason) VALUES (?, ?, ?)').run(vehicle_id, date, reason || '');
  res.json({ message: '设置成功' });
});

router.delete('/unavailable/:id', authenticate, (req, res) => {
  const item = db.prepare('SELECT * FROM vehicle_unavailable WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ message: '记录不存在' });
  db.prepare('DELETE FROM vehicle_unavailable WHERE id = ?').run(req.params.id);
  res.json({ message: '已删除' });
});

export default router;