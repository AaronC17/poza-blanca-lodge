const mongoose = require('mongoose');
const config = require('./env');

mongoose.set('strictQuery', true);

let connecting = null;

function getDb() {
  return mongoose;
}

async function connectDb() {
  if (mongoose.connection.readyState === 1) return mongoose;
  if (connecting) return connecting;

  if (!config.mongodbUri) {
    throw new Error('MONGODB_URI no configurada. Define la variable de entorno.');
  }

  connecting = mongoose.connect(config.mongodbUri, {
    dbName: config.mongodbDbName,
    serverApi: { version: '1', strict: true, deprecationErrors: true },
    maxPoolSize: 10,
    minPoolSize: 1,
    serverSelectionTimeoutMS: 15000,
    socketTimeoutMS: 45000,
  });

  try {
    await connecting;
    connecting = null;
    console.log('[db] Conexión MongoDB establecida.');
    return mongoose;
  } catch (err) {
    connecting = null;
    console.error('[db] Error conectando a MongoDB:', err.message);
    throw err;
  }
}

// ---------- Esquemas / Modelos ----------

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  password_hash: { type: String, required: true },
  name: { type: String, required: true, trim: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

const passSchema = new mongoose.Schema({
  cedula: { type: String, required: true, index: true },
  nombre: { type: String, required: true },
  telefono: { type: String, default: null },
  correo: { type: String, default: null },
  cantidad_personas: { type: Number, default: 1 },
  placa_vehiculo: { type: String, default: null },
  fecha: { type: String, required: true, index: true },
  hora_entrada: { type: String, default: null },
  hora_salida: { type: String, default: null },
  monto: { type: Number, default: 0 },
  estado_pago: { type: String, default: 'pagado', enum: ['pagado', 'pendiente'], index: true },
  observaciones: { type: String, default: null },
  creado_por: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
  tipo_pase: { type: String, default: 'rio', enum: ['rio', 'camping', 'rancho', 'piscina', 'parqueo'], index: true },
  forma_pago: { type: String, default: 'efectivo', enum: ['efectivo', 'sinpe', 'tarjeta'] },
  adultos: { type: Number, default: 1 },
  ninos: { type: Number, default: 0 },
  parqueos: { type: Number, default: 0 },
});

const emailLogSchema = new mongoose.Schema({
  pass_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Pass', default: null, index: true },
  to_address: { type: String, required: true },
  subject: { type: String, default: null },
  status: { type: String, required: true },
  error: { type: String, default: null },
  sent_at: { type: Date, default: Date.now },
});

const User = mongoose.model('User', userSchema, 'users');
const Pass = mongoose.model('Pass', passSchema, 'passes');
const EmailLog = mongoose.model('EmailLog', emailLogSchema, 'email_logs');

// Text index para búsqueda libre (nombre, cédula, correo, placa)
passSchema.index({ nombre: 'text', cedula: 'text', correo: 'text', placa_vehiculo: 'text' });

function getModels() {
  return { User, Pass, EmailLog };
}

module.exports = {
  getDb,
  connectDb,
  getModels,
  User,
  Pass,
  EmailLog,
};
