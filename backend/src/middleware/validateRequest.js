const validateRequest = (schema, source = 'body') => (req, res, next) => {
  const { error, value } = schema.validate(req[source], {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      details: error.details.map((item) => item.message),
    });
  }

  req[source] = value;
  return next();
};

module.exports = validateRequest;

