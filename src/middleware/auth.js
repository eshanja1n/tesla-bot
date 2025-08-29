export const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      error: 'Missing or invalid authorization header. Expected format: Bearer <access_token>' 
    });
  }

  const accessToken = authHeader.substring(7);
  
  if (!accessToken) {
    return res.status(401).json({ error: 'Access token is required' });
  }

  req.tokens = {
    access_token: accessToken
  };

  next();
};