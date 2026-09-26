const { ZodError } = require('zod');

const validateRequest = (schema) => {
  return (req, res, next) => {
    try {
      const validatedData = schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      req.validated = validatedData;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        return res.status(400).json({
          success: false,
          error: {
            message: 'Validation Error',
            details: error.errors
          }
        });
      }
      next(error);
    }
  };
};

module.exports = validateRequest;
