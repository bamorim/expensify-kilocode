# Task: Create Expense Submission workflow

## Meta Information

- **Task ID**: TASK-007
- **Title**: Create Expense Submission workflow
- **Status**: Not Started
- **Priority**: P0
- **Created**: 2025-10-26
- **Updated**: 2025-10-26
- **Estimated Effort**: 3 days
- **Actual Effort**: [Hours/Days]

## Related Documents

- **PRD**: [docs/product/prd-main.md](../product/prd-main.md) (FR6: Expense Submission)
- **ADR**: [docs/technical/decisions/0001-use-t3-stack.md](../technical/decisions/0001-use-t3-stack.md)
- **Dependencies**: TASK-004 (Expense Categories), TASK-006 (Policy Resolution Engine)

## Description

Implement the core expense submission workflow that allows users to submit expenses with automatic policy application. The system must validate expenses against policies, handle auto-approval, and route expenses for manual review when required.

## Acceptance Criteria

- [ ] Expense model with proper fields and status tracking
- [ ] tRPC procedures for expense CRUD operations
- [ ] Automatic policy validation and application
- [ ] Auto-approval for compliant expenses
- [ ] Manual review routing for policy violations
- [ ] Expense submission form with real-time validation
- [ ] Expense list and status tracking interface
- [ ] Comprehensive tests for expense workflows

## TODOs

### Database Schema
- [ ] Create Expense model with required fields
- [ ] Add expense status tracking (submitted, approved, rejected)
- [ ] Create ExpenseAudit model for state changes
- [ ] Add proper indexes for expense queries
- [ ] Create database migration
- [ ] Add organization-scoped constraints

### API Implementation
- [ ] Create expense tRPC router
- [ ] Implement createExpense procedure with policy validation
- [ ] Implement getExpenses procedure (user-scoped)
- [ ] Implement updateExpense procedure (limited updates)
- [ ] Implement deleteExpense procedure (draft only)
- [ ] Implement getExpenseStatus procedure
- [ ] Add policy integration to expense creation

### Policy Integration
- [ ] Integrate Policy Resolution Engine
- [ ] Implement automatic policy validation
- [ ] Add auto-approval logic
- [ ] Handle policy violations and rejections
- [ ] Create policy explanation for users

### UI Components
- [ ] Create expense submission form
- [ ] Create expense list component with filtering
- [ ] Create expense detail view
- [ ] Add real-time policy validation to form
- [ ] Create expense status indicators
- [ ] Add expense editing for draft expenses

### Status Management
- [ ] Implement expense state machine
- [ ] Handle status transitions (draft → submitted → approved/rejected)
- [ ] Create audit trail for state changes
- [ ] Add status notifications to users

### Integration Points
- [ ] Integrate with Policy Resolution Engine
- [ ] Prepare for Review Workflow integration
- [ ] Ensure category selection works properly
- [ ] Add organization data isolation

### Testing
- [ ] Write unit tests for expense procedures
- [ ] Write integration tests for expense workflows
- [ ] Test policy validation and auto-approval
- [ ] Test expense status transitions
- [ ] Test organization data isolation

## Progress Updates

### 2025-10-26 - Architect
**Status**: Not Started
**Progress**: Task created based on PRD requirements
**Blockers**: Depends on TASK-004 and TASK-006 completion
**Next Steps**: Wait for Expense Categories and Policy Resolution Engine implementation

## Completion Checklist

- [ ] All acceptance criteria met
- [ ] Code follows project standards
- [ ] Tests written and passing
- [ ] Documentation updated (if needed)
- [ ] Code review completed

## Notes

Expense submission is the core user-facing feature of the system. It must provide a smooth experience while enforcing policies consistently and transparently.

Key considerations:
- Policy validation should happen in real-time during form entry
- Auto-approval should be seamless for compliant expenses
- Users should understand why expenses are rejected or require review
- Expense data must be properly isolated by organization
- Status tracking should provide clear visibility to users
- Consider providing expense templates for common scenarios
- Form validation should be helpful and guide users to compliance