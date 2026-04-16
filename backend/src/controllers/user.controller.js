const userService = require('../services/user.service');
const { success } = require('../utils/responseHelpers');

const getUsers = async (_req, res) => success(res, await userService.listUsers());

const createUser = async (req, res) => success(res, await userService.addUser(req.body), 201);

const updateUser = async (req, res) =>
  success(
    res,
    await userService.updateUserDetails({
      userId: req.params.id,
      payload: req.body,
    })
  );

const deleteUser = async (req, res) =>
  success(res, await userService.removeUser({ userId: req.params.id }));

module.exports = {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
};
