export function notFound(req, res) {
  res.status(404).json({ error: 'Route not found' });
}

// Last safety net. Any crash ends up here instead of showing the user a stack trace.
export function errorHandler(err, req, res, next) {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on our side' });
}
