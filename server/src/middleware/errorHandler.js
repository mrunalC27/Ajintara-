export function notFound(req, res) {
  res.status(404).json({ error: 'Route not found' });
}

// Last safety net. Any crash ends up here instead of showing the user a stack trace.
export function errorHandler(err, req, res, next) {
  // Errors we threw on purpose (HttpError)
  if (err.status) {
    return res.status(err.status).json({
      error: err.message,
      ...(err.details ? { details: err.details } : {}),
    });
  }
  // A bad id like /properties/abc
  if (err.name === 'CastError') {
    return res.status(400).json({ error: 'That id is not valid' });
  }
  if (err.name === 'ValidationError') {
    return res.status(400).json({ error: 'Please check your input', details: err.message });
  }
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on our side' });
}
