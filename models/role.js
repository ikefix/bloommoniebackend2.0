import mongoose from "mongoose";

const permissionSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  description: {
    type: String,
    default: ""
  },
  module: {
    type: String,
    enum: ["dashboard", "inventory", "sales", "purchases", "expenses", "reports", "settings", "staff"],
    required: true
  },
  resource: {
    type: String,
    enum: ["all", "own", "department", "team"],
    default: "own"
  },
  action: {
    type: String,
    enum: ["create", "read", "update", "delete", "approve", "reject", "export", "import"],
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  }
}, {
  timestamps: true
});

const roleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true
  },
  description: {
    type: String,
    default: ""
  },
  level: {
    type: Number,
    required: true,
    min: 1,
    max: 10
  },
  department: {
    type: String,
    enum: ["sales", "inventory", "management", "finance", "hr", "it", "operations"],
    required: true
  },
  permissions: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Permission"
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  isSystemRole: {
    type: Boolean,
    default: false
  },
  maxSalary: {
    type: Number,
    default: null
  },
  responsibilities: [String],
  requirements: [String],
  benefits: [String],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
permissionSchema.index({ code: 1 });
permissionSchema.index({ module: 1 });
permissionSchema.index({ isActive: 1 });

roleSchema.index({ code: 1 });
roleSchema.index({ level: 1 });
roleSchema.index({ department: 1 });
roleSchema.index({ isActive: 1 });

// Static method to get all permissions
permissionSchema.statics.getAllPermissions = function() {
  return this.find({ isActive: true })
    .sort({ module: 1, action: 1 });
};

// Static method to get permissions by module
permissionSchema.statics.getPermissionsByModule = function(module) {
  return this.find({ module, isActive: true })
    .sort({ action: 1 });
};

// Static method to create default permissions
permissionSchema.statics.createDefaultPermissions = async function(userId) {
  const defaultPermissions = [
    // Dashboard permissions
    { name: "View Dashboard", code: "DASHBOARD_VIEW", module: "dashboard", action: "read" },
    
    // Inventory permissions
    { name: "View Products", code: "INVENTORY_READ", module: "inventory", action: "read" },
    { name: "Create Products", code: "INVENTORY_CREATE", module: "inventory", action: "create" },
    { name: "Update Products", code: "INVENTORY_UPDATE", module: "inventory", action: "update" },
    { name: "Delete Products", code: "INVENTORY_DELETE", module: "inventory", action: "delete" },
    
    // Sales permissions
    { name: "View Sales", code: "SALES_READ", module: "sales", action: "read" },
    { name: "Create Sales", code: "SALES_CREATE", module: "sales", action: "create" },
    { name: "Update Sales", code: "SALES_UPDATE", module: "sales", action: "update" },
    { name: "Delete Sales", code: "SALES_DELETE", module: "sales", action: "delete" },
    
    // Purchase permissions
    { name: "View Purchases", code: "PURCHASE_READ", module: "purchases", action: "read" },
    { name: "Create Purchases", code: "PURCHASE_CREATE", module: "purchases", action: "create" },
    { name: "Update Purchases", code: "PURCHASE_UPDATE", module: "purchases", action: "update" },
    { name: "Delete Purchases", code: "PURCHASE_DELETE", module: "purchases", action: "delete" },
    
    // Expense permissions
    { name: "View Expenses", code: "EXPENSE_READ", module: "expenses", action: "read" },
    { name: "Create Expenses", code: "EXPENSE_CREATE", module: "expenses", action: "create" },
    { name: "Update Expenses", code: "EXPENSE_UPDATE", module: "expenses", action: "update" },
    { name: "Delete Expenses", code: "EXPENSE_DELETE", module: "expenses", action: "delete" },
    { name: "Approve Expenses", code: "EXPENSE_APPROVE", module: "expenses", action: "approve" },
    
    // Reports permissions
    { name: "View Reports", code: "REPORTS_READ", module: "reports", action: "read" },
    { name: "Export Reports", code: "REPORTS_EXPORT", module: "reports", action: "export" },
    
    // Settings permissions
    { name: "View Settings", code: "SETTINGS_READ", module: "settings", action: "read" },
    { name: "Update Settings", code: "SETTINGS_UPDATE", module: "settings", action: "update" },
    
    // Staff permissions
    { name: "View Staff", code: "STAFF_READ", module: "staff", action: "read" },
    { name: "Create Staff", code: "STAFF_CREATE", module: "staff", action: "create" },
    { name: "Update Staff", code: "STAFF_UPDATE", module: "staff", action: "update" },
    { name: "Delete Staff", code: "STAFF_DELETE", module: "staff", action: "delete" }
  ];
  
  for (const permission of defaultPermissions) {
    permission.createdBy = userId;
    await new Permission(permission).save();
  }
  
  return defaultPermissions;
};

// Static method to get roles with permissions
roleSchema.statics.getRolesWithPermissions = function() {
  return this.find({ isActive: true })
    .populate('permissions')
    .sort({ level: 1, name: 1 });
};

// Static method to get role by level
roleSchema.statics.getRolesByLevel = function(minLevel = 1) {
  return this.find({ 
    level: { $gte: minLevel }, 
    isActive: true 
  })
    .populate('permissions')
    .sort({ level: 1, name: 1 });
};

// Static method to create default roles
roleSchema.statics.createDefaultRoles = async function(userId) {
  const Permission = mongoose.model('Permission');
  const permissions = await Permission.find({ isActive: true });
  
  const defaultRoles = [
    {
      name: "Super Admin",
      code: "SUPER_ADMIN",
      level: 10,
      department: "management",
      isSystemRole: true,
      permissions: permissions.map(p => p._id),
      responsibilities: ["Full system access"],
      requirements: ["Technical expertise"],
      benefits: ["Full benefits package"]
    },
    {
      name: "Manager",
      code: "MANAGER",
      level: 8,
      department: "management",
      permissions: permissions.filter(p => 
        ["dashboard", "inventory", "sales", "purchases", "expenses", "reports", "staff"].includes(p.module)
      ).map(p => p._id),
      responsibilities: ["Department management"],
      requirements: ["Leadership skills"],
      benefits: ["Management benefits"]
    },
    {
      name: "Sales Executive",
      code: "SALES_EXECUTIVE",
      level: 5,
      department: "sales",
      permissions: permissions.filter(p => 
        ["dashboard", "sales", "reports"].includes(p.module)
      ).map(p => p._id),
      responsibilities: ["Sales and customer service"],
      requirements: ["Sales experience"],
      benefits: ["Sales commission"]
    },
    {
      name: "Sales Staff",
      code: "SALES_STAFF",
      level: 3,
      department: "sales",
      permissions: permissions.filter(p => 
        ["dashboard", "sales"].includes(p.module)
      ).map(p => p._id),
      responsibilities: ["Product sales and customer assistance"],
      requirements: ["Basic sales training"],
      benefits: ["Basic salary + commission"]
    },
    {
      name: "Inventory Manager",
      code: "INVENTORY_MANAGER",
      level: 6,
      department: "inventory",
      permissions: permissions.filter(p => 
        ["dashboard", "inventory", "reports"].includes(p.module)
      ).map(p => p._id),
      responsibilities: ["Inventory control and management"],
      requirements: ["Inventory management experience"],
      benefits: ["Management benefits"]
    },
    {
      name: "Cashier",
      code: "CASHIER",
      level: 2,
      department: "sales",
      permissions: permissions.filter(p => 
        ["dashboard", "sales"].includes(p.module)
      ).map(p => p._id),
      responsibilities: ["Cash handling and basic sales"],
      requirements: ["Basic math skills"],
      benefits: ["Hourly wage"]
    }
  ];
  
  for (const role of defaultRoles) {
    role.createdBy = userId;
    await new Role(role).save();
  }
  
  return defaultRoles;
};

export default mongoose.model("Role", roleSchema);
export const Permission = mongoose.model("Permission", permissionSchema);
