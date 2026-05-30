const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      minlength: 3,
      maxlength: 30,
    },
    passwordHash: { type: String, required: true },
    accountNumber: { type: String, required: true, unique: true },
    balance: { type: Number, required: true, default: 1000, min: 0 },
  },
  { timestamps: true }
);

// Never leak the password hash to clients.
userSchema.methods.toPublic = function () {
  return {
    username: this.username,
    accountNumber: this.accountNumber,
    balance: this.balance,
  };
};

module.exports = mongoose.model('User', userSchema);
