const { v4: uuidv4 } = require("uuid");

const now = () => new Date().toISOString();

const today = () => new Date().toISOString().split("T")[0];

const createId = (prefix) => {
  return `${prefix}_${uuidv4().slice(0, 8)}`;
};

module.exports = {
  now,
  today,
  createId,
};