import { Router } from "express";
import Staff from "../models/staff.js";
import Role, { Permission } from "../models/role.js";
import auth from "../middlewares/auth.js";
import mongoose from "mongoose";

const router = Router();

/* =========================
   STAFF ACCOUNTS
========================= */

// Get all staff
router.get("/accounts", auth, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      search, 
      department, 
      status,
      role 
    } = req.query;
    
    const skip = (page - 1) * limit;
    const filters = { createdBy: req.user._id };
    
    if (department) filters.department = department;
    if (status) filters.status = status;
    if (role) filters.role = role;
    
    let query = Staff.find(filters);
    
    if (search) {
      query = Staff.searchStaff(search, filters);
    }
    
    const staff = await query
      .populate('role', 'name permissions')
      .sort({ lastName: 1, firstName: 1 })
      .skip(skip)
      .limit(parseInt(limit));
    
    const totalCount = await Staff.countDocuments(filters);
    
    res.json({
      success: true,
      data: {
        staff,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / limit),
          totalCount,
          limit: parseInt(limit)
        }
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Get single staff
router.get("/accounts/:id", auth, async (req, res) => {
  try {
    const staff = await Staff.findOne({ 
      _id: req.params.id, 
      createdBy: req.user._id 
    })
      .populate('role', 'name permissions');
    
    if (!staff) {
      return res.status(404).json({ message: "Staff not found" });
    }
    
    res.json({
      success: true,
      data: staff
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Create staff account
router.post("/accounts", auth, async (req, res) => {
  try {
    const staffData = {
      ...req.body,
      createdBy: req.user._id
    };
    
    // Generate employee ID if not provided
    if (!staffData.employeeId) {
      const count = await Staff.countDocuments();
      staffData.employeeId = `EMP${String(count + 1).padStart(6, '0')}`;
    }
    
    const staff = new Staff(staffData);
    await staff.save();
    
    await Staff.findById(staff._id)
      .populate('role', 'name permissions');
    
    res.status(201).json({
      success: true,
      message: "Staff account created successfully",
      data: staff
    });
  } catch (err) {
    console.error(err);
    if (err.code === 11000) {
      return res.status(400).json({ message: "Email or employee ID already exists" });
    }
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Update staff account
router.put("/accounts/:id", auth, async (req, res) => {
  try {
    const staff = await Staff.findOne({ 
      _id: req.params.id, 
      createdBy: req.user._id 
    });
    
    if (!staff) {
      return res.status(404).json({ message: "Staff not found" });
    }
    
    Object.assign(staff, req.body, { updatedBy: req.user._id });
    await staff.save();
    
    await Staff.findById(staff._id)
      .populate('role', 'name permissions');
    
    res.json({
      success: true,
      message: "Staff account updated successfully",
      data: staff
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Delete staff account
router.delete("/accounts/:id", auth, async (req, res) => {
  try {
    const staff = await Staff.findOne({ 
      _id: req.params.id, 
      createdBy: req.user._id 
    });
    
    if (!staff) {
      return res.status(404).json({ message: "Staff not found" });
    }
    
    await Staff.findByIdAndDelete(staff._id);
    
    res.json({
      success: true,
      message: "Staff account deleted successfully"
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

/* =========================
   ROLES & PERMISSIONS
========================= */

// Get all roles
router.get("/roles", auth, async (req, res) => {
  try {
    const roles = await Role.getRolesWithPermissions();
    
    res.json({
      success: true,
      data: roles
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Get role by level
router.get("/roles/level/:level", auth, async (req, res) => {
  try {
    const { level } = req.params;
    
    const roles = await Role.getRolesByLevel(parseInt(level));
    
    res.json({
      success: true,
      data: roles
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Create role
router.post("/roles", auth, async (req, res) => {
  try {
    const roleData = {
      ...req.body,
      createdBy: req.user._id
    };
    
    // Generate role code if not provided
    if (!roleData.code) {
      const count = await Role.countDocuments();
      roleData.code = `ROLE${String(count + 1).padStart(3, '0')}`;
    }
    
    const role = new Role(roleData);
    await role.save();
    
    await Role.findById(role._id)
      .populate('permissions');
    
    res.status(201).json({
      success: true,
      message: "Role created successfully",
      data: role
    });
  } catch (err) {
    console.error(err);
    if (err.code === 11000) {
      return res.status(400).json({ message: "Role code already exists" });
    }
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Update role
router.put("/roles/:id", auth, async (req, res) => {
  try {
    const role = await Role.findOne({ 
      _id: req.params.id, 
      createdBy: req.user._id 
    });
    
    if (!role) {
      return res.status(404).json({ message: "Role not found" });
    }
    
    Object.assign(role, req.body);
    await role.save();
    
    await Role.findById(role._id)
      .populate('permissions');
    
    res.json({
      success: true,
      message: "Role updated successfully",
      data: role
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Delete role
router.delete("/roles/:id", auth, async (req, res) => {
  try {
    const role = await Role.findOne({ 
      _id: req.params.id, 
      createdBy: req.user._id 
    });
    
    if (!role) {
      return res.status(404).json({ message: "Role not found" });
    }
    
    // Check if role is assigned to any staff
    const staffCount = await Staff.countDocuments({ role: role._id });
    if (staffCount > 0) {
      return res.status(400).json({ 
        message: "Cannot delete role assigned to staff members" 
      });
    }
    
    await Role.findByIdAndDelete(role._id);
    
    res.json({
      success: true,
      message: "Role deleted successfully"
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Get all permissions
router.get("/permissions", auth, async (req, res) => {
  try {
    const permissions = await Permission.getAllPermissions();
    
    res.json({
      success: true,
      data: permissions
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Get permissions by module
router.get("/permissions/:module", auth, async (req, res) => {
  try {
    const { module } = req.params;
    
    const permissions = await Permission.getPermissionsByModule(module);
    
    res.json({
      success: true,
      data: permissions
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

/* =========================
   STAFF PERFORMANCE
========================= */

// Get staff performance
router.get("/performance", auth, async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      department 
    } = req.query;
    
    const performance = await Staff.getStaffSalesPerformance(startDate, endDate);
    
    if (department) {
      performance = performance.filter(p => 
        p.department === department
      );
    }
    
    res.json({
      success: true,
      data: performance
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

// Update staff performance
router.post("/performance/:id", auth, async (req, res) => {
  try {
    const { performanceData } = req.body;
    
    const staff = await Staff.findOne({ 
      _id: req.params.id, 
      createdBy: req.user._id 
    });
    
    if (!staff) {
      return res.status(404).json({ message: "Staff not found" });
    }
    
    await staff.updatePerformance(performanceData);
    
    res.json({
      success: true,
      message: "Performance updated successfully",
      data: staff
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

/* =========================
   STAFF SALES REPORT
========================= */

// Get staff sales report
router.get("/sales-report", auth, async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      staffId 
    } = req.query;
    
    const performance = await Staff.getStaffSalesPerformance(startDate, endDate);
    
    if (staffId) {
      const staff = await Staff.findById(staffId);
      const staffPerformance = performance.find(p => p.staffId.toString() === staffId);
      
      if (staffPerformance) {
        return res.json({
          success: true,
          data: {
            staff,
            performance: staffPerformance
          }
        });
      }
    }
    
    res.json({
      success: true,
      data: performance
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message || "Server error" });
  }
});

export default router;
