import mongoose from "mongoose";

const routingRuleSchema = new mongoose.Schema({
  issueTypeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "IssueType",
    required: true,
    index: true
  },
  department: {
    type: String,
    required: true,
    index: true
  },
  assignedStaff: [{
    staffId: {
      type: String,
      required: true
    },
    staffName: {
      type: String,
      required: true
    },
    isAvailable: {
      type: Boolean,
      default: true
    },
    roundRobinIndex: {
      type: Number,
      default: 0
    }
  }],
  assignmentMode: {
    type: String,
    enum: ["single", "round_robin", "pool_accept"],
    required: true,
    default: "single"
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

// Compound index for quick lookups
routingRuleSchema.index({ issueTypeId: 1, department: 1, isActive: 1 });

// Update timestamp on save
routingRuleSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const RoutingRule = mongoose.model("RoutingRule", routingRuleSchema);
export default RoutingRule;
