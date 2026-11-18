// Lets controllers be plain async functions: any thrown error goes to the error middleware.
module.exports = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
