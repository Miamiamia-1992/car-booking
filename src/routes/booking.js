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
    next();
  } catch {
    res.status(401).json({ message: 'token无效' });
  }
};

router.get('/vehicles', (req, res) => {
  const vehicles = db.prepare('SELECT * FROM vehicles WHERE is_active = 1').all();
  res.json(vehicles);
});

router.get('/all', (req, res) => {
  const bookings = db.prepare(`
    SELECT b.*, v.name as vehicle_name, v.plate as vehicle_plate
    FROM bookings b 
    LEFT JOIN vehicles v ON b.vehicle_id = v.id
    ORDER BY b.date DESC, b.start_time
  `).all();
  res.json(bookings);
});

router.get('/date/:date', (req, res) => {
  const { date } = req.params;
  const bookings = db.prepare(`
    SELECT b.*, v.name as vehicle_name, v.plate as vehicle_plate
    FROM bookings b 
    LEFT JOIN vehicles v ON b.vehicle_id = v.id
    WHERE b.date = ? AND b.status != 'rejected'
    ORDER BY b.vehicle_id, b.start_time
  `).all(date);
  
  const unavailable = db.prepare('SELECT vehicle_id FROM vehicle_unavailable WHERE date = ?').all(date);
  const unavailableIds = unavailable.map(u => u.vehicle_id);
  
  res.json({ bookings, unavailable: unavailableIds });
});

router.post('/', (req, res) => {
  const { date, vehicle_id, start_time, end_time, visitor_name, visitor_phone, reason } = req.body;
  
  if (!date || !vehicle_id || !start_time || !end_time) {
    return res.status(400).json({ message: '请填写完整信息' });
  }
  if (!visitor_name || !visitor_phone) {
    return res.status(400).json({ message: '请填写姓名和电话' });
  }

  const unavailable = db.prepare('SELECT id FROM vehicle_unavailable WHERE vehicle_id = ? AND date = ?').get(vehicle_id, date);
  if (unavailable) {
    return res.status(400).json({ message: '该车辆当日不可用' });
  }

  const conflict = db.prepare(`
    SELECT id FROM bookings 
    WHERE date = ? AND vehicle_id = ? AND status != 'rejected'
    AND ((start_time <= ? AND end_time > ?) OR (start_time < ? AND end_time >= ?) OR (start_time >= ? AND end_time <= ?))
  `).get(date, vehicle_id, start_time, start_time, end_time, end_time, start_time, end_time);
  
  if (conflict) {
    return res.status(400).json({ message: '该时间段已被预约' });
  }

  const result = db.prepare(`
    INSERT INTO bookings (user_id, vehicle_id, date, start_time, end_time, visitor_name, visitor_phone, reason, status) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(1, vehicle_id, date, start_time, end_time, visitor_name, visitor_phone, reason || '', 'pending');
  res.json({ message: '预约成功，等待审批', id: result.lastInsertRowid });
});

export default router;