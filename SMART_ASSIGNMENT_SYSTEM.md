# Issue-Based Smart Auto Assignment System

## Overview

The Smart Auto Assignment System transforms the CT University Grievance Portal from a manual assignment system to an intelligent ticket routing automation system, similar to enterprise helpdesk systems like Jira and ServiceNow.

## Key Features

### 1. Issue Type Management
- Department Admins can define specific issue types for their department
- Each issue type has a name and description
- Issue types can be activated/deactivated
- Example: "Grade Dispute", "Fee Issue", "Hostel Problem"

### 2. Routing Rules Configuration
- Department Admins create routing rules for each issue type
- Assign multiple staff members to handle specific issue types
- Choose from three assignment modes:
  - **Single Assign**: Always assigns to the first available staff
  - **Round Robin**: Distributes grievances evenly among all assigned staff
  - **Pool Accept**: All assigned staff see the grievance, first to accept gets assigned

### 3. Auto-Assignment Logic
- When students submit grievances with an issue type selected, the system automatically checks for routing rules
- If a routing rule exists, the grievance is auto-assigned based on the configured mode
- If no routing rule exists, the grievance follows the traditional manual assignment workflow
- Auto-assigned grievances show a badge indicating the assignment mode

### 4. Pool Accept Mode
- Staff members can view a "Pool Accept Queue" in their dashboard
- Grievances with pool_accept mode appear in this queue for all assigned staff
- Staff can click "Accept" to take ownership
- First staff to accept gets assigned, others see the grievance disappear from their queue
- This enables real-time, competitive assignment like modern helpdesk systems

## Workflow Comparison

### Traditional Manual Workflow
```
Student → Submit Grievance → Category Admin Inbox → Admin Manually Assigns → Staff Works → Resolution
```

### Smart Auto-Assignment Workflow
```
Student → Select Issue Type → Submit Grievance → Auto-Assign (if rule exists) → Staff Works → Resolution
                                   ↓
                              (if no rule)
                                   ↓
                         Manual Assignment Fallback
```

## Database Schema Changes

### New Models

#### IssueType
```javascript
{
  department: String,
  issueName: String (unique),
  description: String,
  isActive: Boolean (default: true),
  createdAt: Date,
  updatedAt: Date
}
```

#### RoutingRule
```javascript
{
  issueTypeId: ObjectId (ref: IssueType),
  department: String,
  assignedStaff: [{
    staffId: String,
    staffName: String,
    isAvailable: Boolean,
    roundRobinIndex: Number
  }],
  assignmentMode: Enum ["single", "round_robin", "pool_accept"],
  isActive: Boolean (default: true),
  createdAt: Date,
  updatedAt: Date
}
```

#### StaffPool
```javascript
{
  staffId: String,
  staffName: String,
  department: String,
  issueTypeIds: [ObjectId (ref: IssueType)],
  isAvailable: Boolean (default: true),
  currentLoad: Number (default: 0),
  maxLoad: Number (default: 10),
  assignedGrievanceIds: [ObjectId (ref: Grievance)],
  createdAt: Date,
  updatedAt: Date
}
```

### Modified Models

#### Grievance (Added Fields)
```javascript
{
  issueTypeId: ObjectId (ref: IssueType, default: null),
  assignmentMode: Enum ["manual", "single", "round_robin", "pool_accept", default: "manual"]
}
```

## API Endpoints

### Issue Types
- `POST /api/issue-types` - Create issue type
- `GET /api/issue-types` - Get all issue types
- `GET /api/issue-types/department/:department` - Get issue types by department
- `PUT /api/issue-types/:id` - Update issue type
- `DELETE /api/issue-types/:id` - Delete issue type (soft delete)

### Routing Rules
- `POST /api/routing-rules` - Create routing rule
- `GET /api/routing-rules` - Get all routing rules
- `GET /api/routing-rules/department/:department` - Get routing rules by department
- `GET /api/routing-rules/issue-type/:issueTypeId` - Get routing rule by issue type
- `PUT /api/routing-rules/:id` - Update routing rule
- `DELETE /api/routing-rules/:id` - Delete routing rule (soft delete)

### Staff Pool
- `POST /api/staff-pool` - Add staff to pool
- `GET /api/staff-pool` - Get all staff pool entries
- `GET /api/staff-pool/department/:department` - Get staff pool by department
- `GET /api/staff-pool/issue-type/:issueTypeId` - Get staff pool by issue type
- `PUT /api/staff-pool/:id/availability` - Update staff availability
- `PUT /api/staff-pool/:id/load` - Update staff load
- `DELETE /api/staff-pool/:id` - Remove staff from pool

### Pool Accept Mode
- `GET /api/grievances/pool-accept?staffId=&department=` - Get grievances available for pool accept
- `POST /api/grievances/accept/:grievanceId` - Accept a grievance from pool

## Frontend Components

### Admin Configuration Pages

#### IssueManagementPage (`/admin/smart-assignment`)
- Tab-based interface for Department Admins
- **Issue Types Tab**: Create, edit, activate/deactivate issue types
- **Routing Rules Tab**: Create, edit, delete routing rules with staff assignment

#### IssueManagementPanel Component
- Displays all issue types for a department
- Add/Edit issue type forms
- Activate/Deactivate toggles
- Delete functionality

#### RoutingRuleConfig Component
- Displays all routing rules for a department
- Create routing rule form with:
  - Issue type selection
  - Assignment mode selection (Single, Round Robin, Pool Accept)
  - Staff member selection (multi-select)
- Delete routing rules

### Student Interface

#### Updated Grievance Submission Form
- Added issue type dropdown (populated from department's issue types)
- Shows "🤖 This grievance will be auto-assigned based on routing rules" when issue type selected
- Optional - if no issue type selected, uses manual assignment

### Staff Interface

#### AdminStaffDashboard Updates
- Added "Pool Accept Queue" tab
- Auto-assignment badge on assigned grievances (🤖 Auto (mode))
- Pool accept queue shows grievances available for acceptance
- Accept button to take ownership of pool grievances
- Real-time updates when grievances are accepted

## Assignment Modes Explained

### Single Assign Mode
- Always assigns to the first staff in the assigned list
- Simple, predictable assignment
- Best for: Dedicated staff for specific issues

### Round Robin Mode
- Distributes grievances evenly using round-robin algorithm
- Tracks assignment count per staff via `roundRobinIndex`
- Balances workload automatically
- Best for: Teams with similar skill levels

### Pool Accept Mode
- All assigned staff see the grievance in their "Pool Accept Queue"
- Staff must actively accept the grievance
- First to accept gets assigned
- Competitive, real-time assignment
- Best for: High-priority issues requiring quick response

## Setup Instructions

### For Department Admins

1. Navigate to `/admin/smart-assignment`
2. Go to **Issue Types** tab
3. Create issue types relevant to your department (e.g., "Grade Dispute", "Schedule Conflict")
4. Go to **Routing Rules** tab
5. Create routing rules:
   - Select an issue type
   - Choose assignment mode
   - Select staff members to handle this issue type
6. Save the routing rule

### For Students

1. Navigate to grievance submission form
2. Select department
3. Select issue type (if available)
4. Submit grievance
5. If routing rule exists, grievance auto-assigns
6. Otherwise, goes to manual assignment

### For Staff

1. Check "My Assigned Tasks" for auto-assigned grievances
2. Check "Pool Accept Queue" for grievances available to accept
3. Click "Accept" to take ownership of pool grievances
4. Process grievances as usual

## Benefits

1. **Reduced Manual Work**: Eliminates manual assignment for common issue types
2. **Faster Response Time**: Auto-assignment happens immediately upon submission
3. **Workload Balancing**: Round Robin mode ensures fair distribution
4. **Flexibility**: Pool Accept mode allows staff to choose based on availability
5. **Scalability**: Easy to add new issue types and routing rules
6. **Fallback**: Manual assignment still available for complex cases

## Technical Implementation

### Auto-Assignment Logic
When a grievance is submitted:
1. Check if `issueTypeId` is provided
2. Query `RoutingRule` collection for matching `issueTypeId` and `department`
3. If rule exists:
   - Apply assignment mode logic
   - Set `assignedTo`, `assignedRole`, `assignedBy`, `deadlineDate`
   - Set status to "Assigned"
   - Send email notification to assigned staff
4. If no rule exists:
   - Keep status as "Pending"
   - Use traditional manual assignment flow

### Round Robin Implementation
- Each staff member has a `roundRobinIndex` in the routing rule
- On assignment, select staff with lowest index
- Increment their index for next assignment
- Ensures even distribution over time

### Pool Accept Implementation
- Grievances with `pool_accept` mode stay in "Pending" status
- Staff query `/api/grievances/pool-accept` to see available grievances
- Staff calls `/api/grievances/accept/:id` to claim
- First successful claim updates the grievance assignment
- Subsequent claims fail (already assigned)

## Future Enhancements

1. **Load Balancing**: Integrate with StaffPool model for advanced load management
2. **SLA Tracking**: Track response times per issue type
3. **Analytics**: Dashboard showing assignment statistics
4. **Skill-Based Routing**: Match staff skills to issue types
5. **Escalation Rules**: Auto-escalate after deadline
6. **Bulk Assignment**: Assign multiple staff to complex issues

## Files Modified/Created

### Backend
- `models/IssueType.js` (NEW)
- `models/RoutingRule.js` (NEW)
- `models/StaffPool.js` (NEW)
- `models/GrievanceModel.js` (MODIFIED - added issueTypeId, assignmentMode)
- `controllers/issueController.js` (NEW)
- `controllers/routingRuleController.js` (NEW)
- `controllers/staffPoolController.js` (NEW)
- `controllers/grievanceController.js` (MODIFIED - added auto-assignment, pool accept)
- `routes/issueRoutes.js` (NEW)
- `routes/routingRuleRoutes.js` (NEW)
- `routes/staffPoolRoutes.js` (NEW)
- `routes/grievanceRoutes.js` (MODIFIED - added pool accept routes)
- `server.js` (MODIFIED - registered new routes)

### Frontend
- `components/IssueManagementPanel.jsx` (NEW)
- `components/RoutingRuleConfig.jsx` (NEW)
- `pages/IssueManagementPage.jsx` (NEW)
- `pages/StudentWelfare.jsx` (MODIFIED - added issue type dropdown)
- `pages/AdminStaffDashboard.jsx` (MODIFIED - added pool queue, auto badge)
- `App.js` (MODIFIED - added smart assignment route)

## Conclusion

The Smart Auto Assignment System successfully transforms the grievance portal into an intelligent, automated ticket routing system while maintaining backward compatibility with the manual assignment workflow. The system is production-ready and follows enterprise helpdesk best practices.
