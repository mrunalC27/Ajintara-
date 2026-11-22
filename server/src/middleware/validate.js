// Checks req.body against a zod schema. If wrong, sends a clear 400 message.
export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const details = result.error.issues.map((i) => ({
        field: i.path.join('.'),
        message: i.message,
      }));
      return res.status(400).json({ error: 'Please check your input', details });
    }
    req.body = result.data;
    next();
  };
}
