import mongoose from "mongoose";

const staffPoolSchema = new mongoose.Schema({
  staffId: {
    type: String,
    required: true,
    index: true
  },
  staffName: {
    type: String,
    required: true
  },
  department: {
    type: String,
    required: true,
    index: true
  },
  issueTypeIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "IssueType"
  }],
  isAvailable: {
    type: Boolean,
    default: true
  },
  currentLoad: {
    type: Number,
    default: 0
  },
  maxLoad: {
    type: Number,
    default: 10
  },
  assignedGrievanceIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Grievance"
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Compound index for quick lookups
staffPoolSchema.index({ department: 1, isAvailable: 1 });
staffPoolSchema.index({ issueTypeIds: 1, isAvailable: 1 });

// Update timestamp on save
staffPoolSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const StaffPool = mongoose.model("StaffPool", staffPoolSchema);
export default StaffPool;
