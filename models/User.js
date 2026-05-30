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
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    passwordHash: { type: String, required: true },
    accountNumber: { type: String, required: true, unique: true },
    balance: { type: Number, required: true, default: 1000, min: 0 },
    isVerified: { type: Boolean, default: false },
    verificationCode: { type: String, default: null },
    verificationExpiry: { type: Date, default: null },
  },
  { timestamps: true }
);

userSchema.methods.toPublic = function () {
  return {
    username: this.username,
    email: this.email,
    accountNumber: this.accountNumber,
    balance: this.balance,
    isVerified: this.isVerified,
  };
};

module.exports = mongoose.model('User', userSchema);
