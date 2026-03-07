import express from 'express';
import jwt from 'jsonwebtoken';
import cors from 'cors';
import bcrypt from 'bcrypt';


const app = express();
const users = []; 
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_key';
const SALT_ROUNDS = 10;

app.use(cors());
app.use(express.json()); // Built-in express body parsing

// --- Middleware ---
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

// --- Routes ---

app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (users.find(u => u.email === email)) return res.status(409).send('User exists');

    // Hash the password before saving!
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const newUser = { email, password: hashedPassword, role: 'user' };
    
    users.push(newUser);
    const token = jwt.sign({ email: newUser.email, role: newUser.role }, JWT_SECRET, { expiresIn: '1h' });
    
    res.status(201).json({ token });
  } catch {
    res.status(500).send('Error creating user');
  }
});

app.post('/api/auth/login', async (req, res) => {
  const user = users.find(u => u.email === req.body.email);
  if (!user) return res.status(400).send('Cannot find user');

  try {
    // Compare hashed password
    if (await bcrypt.compare(req.body.password, user.password)) {
      const token = jwt.sign({ email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
      res.json({ token });
    } else {
      res.status(401).send('Invalid credentials');
    }
  } catch {
    res.status(500).send();
  }
});

app.get('/api/protected', authenticateToken, (req, res) => {
  res.json({ message: 'Welcome to the inner circle', user: req.user });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server live on ${PORT}`));