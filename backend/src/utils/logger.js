const format = (level, message, meta) => {
  const timestamp = new Date().toISOString();
  const base = `[${timestamp}] [${level}] ${message}`;
  if (!meta) return base;
  return `${base} ${JSON.stringify(meta)}`;
};

const logger = {
  info(message, meta) {
    // eslint-disable-next-line no-console
    console.log(format('INFO', message, meta));
  },
  warn(message, meta) {
    // eslint-disable-next-line no-console
    console.warn(format('WARN', message, meta));
  },
  error(message, meta) {
    // eslint-disable-next-line no-console
    console.error(format('ERROR', message, meta));
  },
};

module.exports = logger;

