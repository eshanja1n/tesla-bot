export const errorHandler = (error, req, res, next) => {
  console.error('Unhandled error:', error);

  if (error.response && error.response.status) {
    return res.status(error.response.status).json({
      error: error.response.data?.error || error.message,
      code: error.response.status
    });
  }

  if (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND') {
    return res.status(503).json({
      error: 'Service temporarily unavailable. Please try again later.',
      code: 503
    });
  }

  if (error.name === 'ValidationError') {
    return res.status(400).json({
      error: error.message,
      code: 400
    });
  }

  res.status(500).json({
    error: 'Internal server error',
    code: 500
  });
};