export function sendError(res, error) {
  const status = error.statusCode || 500;
  const message = error.message || 'Internal server error';
  return res.status(status).json({ error: message });
}

export async function runHandler(res, fn) {
  try {
    const result = await fn();
    return res.status(200).json(result);
  } catch (error) {
    console.error('API error:', error);
    return sendError(res, error);
  }
}
