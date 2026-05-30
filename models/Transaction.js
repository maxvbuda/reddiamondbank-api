const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema(
  {
    fromUser: { type: String, required: true, index: true },
    toUser: { type: String, required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    note: { type: String, default: '', maxlength: 200 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

transactionSchema.methods.toPublic = function () {
  return {
    id: this._id.toString(),
    fromUser: this.fromUser,
    toUser: this.toUser,
    amount: this.amount,
    note: this.note,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('Transaction', transactionSchema);
