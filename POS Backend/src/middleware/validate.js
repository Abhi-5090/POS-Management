'use strict';

const AppError = require('../utils/AppError');

/**
 *   validate({ body: joiSchema, params: joiSchema, query: joiSchema })
 */
module.exports = function validate(schemas) {
  return (req, _res, next) => {
    for (const [key, schema] of Object.entries(schemas || {})) {
      if (!schema) continue;
      const { value, error } = schema.validate(req[key], {
        abortEarly: false,
        stripUnknown: true,
        convert: true,
      });
      if (error) {
        return next(
          AppError.badRequest('Validation failed', {
            location: key,
            issues: error.details.map((d) => ({ path: d.path.join('.'), message: d.message })),
          }),
        );
      }
      req[key] = value;
    }
    next();
  };
};
