import mongoose from 'mongoose';
import bcrypt from 'bcryptjs'; // optional: for password hashing

const ManagerSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Manager name is required'],
      trim: true,
      minlength: 3,
      maxlength: 50,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please use a valid email address'],
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      unique: true,
      match: [/^\d{10}$/, 'Please use a valid 10-digit phone number'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: 6,
      select: false, // 🔐 Do not return password by default in queries
    },
    role: {
      type: String,
      trim: true,
      enum: ['manager'], // 🔒 restrict to expected role(s)
      default: 'manager',
    },
  },
  { timestamps: true }
);

// ✅ Optional: Hash password before saving (if you're not already doing this elsewhere)
ManagerSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// ✅ Optional: Method to compare password during login
ManagerSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

const Manager = mongoose.models.Manager || mongoose.model('Manager', ManagerSchema);

export default Manager;
