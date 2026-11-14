import mongoose from 'mongoose'

const customerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    phone: { type: String, trim: true, default: '', maxlength: 24 },
  },
  { timestamps: true },
)

export default mongoose.models.Customer || mongoose.model('Customer', customerSchema)
