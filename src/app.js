import express from 'express';
import mongoose from 'mongoose';
import TaskItem from './models/TaskItem.js';

const app = express();
app.use(express.json());

// On Vercel, serverless-http hands Express the body as raw bytes (a Buffer) and Express
// skips parsing it. Locally this does nothing, because express.json() already made an object.
app.use((req, res, next) => {
  if (Buffer.isBuffer(req.body)) {
    try {
      req.body = req.body.length ? JSON.parse(req.body.toString('utf8')) : {};
    } catch {
      return res.status(400).json({ error: 'Request body must be valid JSON.' });
    }
  }
  next();
});

// Reuse one connection across warm serverless invocations.
let connecting;
const connect = () => (connecting ??= mongoose.connect(process.env.MONGODB_URI));

app.use('/api', async (req, res, next) => {
  try {
    await connect();
    next();
  } catch (err) {
    connecting = undefined;
    next(err);
  }
});

const router = express.Router();

// Create
router.post('/', async (req, res) => {
  res.status(201).json(await TaskItem.create(req.body));
});

// Read all (sent to the browser exactly as Mongo returns it)
router.get('/', async (req, res) => {
  res.json(await TaskItem.find());
});

// Read one
router.get('/:id', async (req, res) => {
  const task = await TaskItem.findById(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found.' });
  res.json(task);
});

// Update (casting + validators run on update too)
router.put('/:id', async (req, res) => {
  const task = await TaskItem.findByIdAndUpdate(req.params.id, req.body, {
    new: true,
    runValidators: true,
  });
  if (!task) return res.status(404).json({ error: 'Task not found.' });
  res.json(task);
});

// Delete
router.delete('/:id', async (req, res) => {
  const task = await TaskItem.findByIdAndDelete(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found.' });
  res.json(task);
});

app.use('/api/tasks', router);

app.use((err, req, res, next) => {
  console.error('API error:', err.name, err.message);
  const bad = err.name === 'ValidationError' || err.name === 'CastError';
  res.status(bad ? 400 : 500).json({ error: err.message });
});

export default app;
