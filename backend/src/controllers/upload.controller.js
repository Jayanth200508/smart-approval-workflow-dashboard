const { success } = require('../utils/responseHelpers');

const uploadAttachment = async (req, res) => {
  if (!req.file) {
    const error = new Error('Attachment file is required');
    error.statusCode = 400;
    throw error;
  }

  return success(
    res,
    {
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      url: `/uploads/${req.file.filename}`,
    },
    201
  );
};

module.exports = {
  uploadAttachment,
};

