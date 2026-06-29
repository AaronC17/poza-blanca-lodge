const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const config = require('./config/env');
const logger = require('./config/logger');

const dataDir = path.dirname(config.dbPath);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const SQLiteStore = require('connect-sqlite3')(session);
const expressLayouts = require('express-ejs-layouts');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const methodOverride = require('method-override');

const { initDatabase } = require('./db/init');
const { requireAuth } = require('./middleware/auth');
const flashMiddleware = require('./middleware/flash');
const csrfMiddleware = require('./middleware/csrf');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const realtime = require('./services/realtimeService');

const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const passesRoutes = require('./routes/passes');
const reportsRoutes = require('./routes/reports');

const app = express();
const server = http.createServer(app);

const { Server } = require('socket.io');
const io = new Server(server, { cors: { origin: config.appUrl } });
realtime.setIo(io);

io.use((socket, next) => {
  const raw = socket.handshake.headers.cookie || '';
  const sid = raw.split(';').map((s) => s.trim()).find((c) => c.startsWith('connect.sid='));
  if (!sid) return next(new Error('No autenticado'));
  next();
});

io.on('connection', (socket) => {
  logger.info({ id: socket.id }, 'socket connected');
  socket.on('disconnect', () => logger.debug({ id: socket.id }, 'socket disconnected'));
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('layout', 'layout');
app.use(expressLayouts);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(methodOverride('_method'));

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: config.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes. Inténtalo de nuevo en unos minutos.' },
});
app.use(globalLimiter);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/login', loginLimiter);

if (!config.isProd) {
  const morgan = require('morgan');
  app.use(morgan('dev'));
}

app.use(express.static(path.join(__dirname, 'public')));

/* Cache-busting para assets locales: versión basada en mtime del archivo.
   Recalcula por request (stat barato) para que cambios en CSS se reflejen
   sin reiniciar el servidor ni tocar configuración. */
app.use((req, res, next) => {
  const cssPath = path.join(__dirname, 'public', 'css', 'poza.css');
  try {
    const mtime = fs.statSync(cssPath).mtimeMs;
    res.locals.assetVersion = Math.floor(mtime).toString(36);
  } catch (e) {
    res.locals.assetVersion = '1';
  }
  next();
});

const sessionMiddleware = session({
  store: new SQLiteStore({ db: 'sessions.db', dir: path.dirname(config.dbPath) }),
  name: 'connect.sid',
  secret: config.sessionSecret,
  resave: false,
  rolling: true,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: config.isProd,
    sameSite: 'lax',
    maxAge: 12 * 60 * 60 * 1000,
  },
});

app.set('trust proxy', 1);

app.use(sessionMiddleware);
app.use(flashMiddleware());

app.use((req, res, next) => {
  res.locals.appUrl = config.appUrl;

  if (req.session && req.session.userId) {
    res.locals.currentUser = {
      id: req.session.userId,
      username: req.session.username,
      name: req.session.name,
    };
  } else {
    res.locals.currentUser = null;
  }

  const isPublic = req.path === '/login' || req.path === '/favicon.ico';
  if (!isPublic && !(req.session && req.session.userId)) {
    req.session.returnTo = req.originalUrl;
  }
  next();
});

app.use(csrfMiddleware());

app.use('/', authRoutes);
app.get('/', (req, res) => res.redirect('/dashboard'));
app.use('/dashboard', requireAuth, dashboardRoutes);
app.use('/pases', requireAuth, passesRoutes);
app.use('/reportes', requireAuth, reportsRoutes);

app.get('/favicon.ico', (req, res) => res.status(204).end());

app.use(notFound);
app.use(errorHandler);

function start() {
  initDatabase();

  server.listen(config.port, '0.0.0.0', () => {
    logger.info(
      { port: config.port, env: config.env, admin: config.admin.username },
      'Camping DayPass iniciado'
    );
    console.log(`\n  Camping DayPass`);
    console.log(`  Servidor iniciado en http://localhost:${config.port}`);
    console.log(`  Accesible en red local: http://<tu-ip-local>:${config.port}`);
    console.log(`  Entorno: ${config.env}`);
    console.log(`  Usuario admin: ${config.admin.username}\n`);
  });
}

if (require.main === module) {
  start();
}

module.exports = { app, server };
