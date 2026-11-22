// Checks the incoming data against a zod schema. If wrong, sends a clear 400 message.
//   validate(schema)           checks the body   -> clean data in req.body
//   validate(schema, 'query')  checks the ?query -> clean data in req.validatedQuery
export function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = result.error.issues.map((i) => ({
        field: i.path.join('.'),
        message: i.message,
      }));
      return res.status(400).json({ error: 'Please check your input', details });
    }
    if (source === 'query') req.validatedQuery = result.data;
    else req[source] = result.data;
    next();
  };
}
