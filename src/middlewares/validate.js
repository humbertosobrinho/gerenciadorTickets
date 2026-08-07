export const validateBody = (schema) => {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.errors.map(err => ({
        campo: err.path.join('.'),
        mensagem: err.message
      }));
      return res.status(400).json({ error: 'Dados de entrada inválidos.', detalhes: errors });
    }
    req.body = result.data;
    next();
  };
};
