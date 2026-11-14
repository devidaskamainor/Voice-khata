import mongoose from 'mongoose'

const transactionSchema = new mongoose.Schema(
  {
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: ['CREDIT', 'PAYMENT'],
      required: true
    },
    amount: {
      type: Number,
      required: true,
      min: 0.01
    },
    note: {
      type: String,
      trim: true,
      default: '',
      maxlength: 240
    },
    source: {
      type: String,
      enum: ['manual', 'voice'],
      default: 'manual'
    },
    transactionDate: {
      type: Date,
      default: Date.now
    },
    idempotencyKey: {
      type: String,
      select: false,
      maxlength: 80
    }
  },
  { timestamps: true }
)

transactionSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true })
transactionSchema.index({ transactionDate: 1, type: 1 })
transactionSchema.index({ customer: 1, transactionDate: -1 })

export default mongoose.models.Transaction ||
  mongoose.model('Transaction', transactionSchema)
