let io = null;

function setIo(serverIo) {
  io = serverIo;
}

function getIo() {
  return io;
}

function emit(event, payload) {
  if (io) io.emit(event, payload);
}

function notifyPassChange(action, pass) {
  if (!io) return;
  emit('pass:change', { action, pass, at: new Date().toISOString() });
  if (action === 'create' && pass && pass.estado_pago === 'pendiente') {
    emit('payment:pending', {
      pass,
      at: new Date().toISOString(),
    });
  }
}

module.exports = { setIo, getIo, emit, notifyPassChange };
