import mongoose from "mongoose";

const issueTypeSchema = new mongoose.Schema({
  department: {
    type: String,
    required: true,
    index: true
  },
  issueName: {
    type: String,
    required: true,
    unique: true, // Issue names must be unique globally
    index: true
  },
  description: {
    type: String,
    default: ""
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update timestamp on save
issueTypeSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const IssueType = mongoose.model("IssueType", issueTypeSchema);
export default IssueType;
